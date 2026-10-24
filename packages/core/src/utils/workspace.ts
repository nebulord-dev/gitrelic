// A repository's packages, from the workspace definition it already declares
// (pnpm-workspace.yaml, package.json `workspaces`, lerna.json, Cargo.toml
// `[workspace] members`, go.work, Nx project.json files), read from the
// analyzed commit's tree. Every lens that groups by package maps a file to the
// longest root containing it, so `apps/web` and `apps/cli` are two packages
// when the repo says so, and React's nested `compiler/` workspace splits into
// its own packages.
//
// Pure: the runner reads the manifests (`readTextBlobs` in utils/git.ts) and
// hands their text in. Scene mirrors `packageResolver` (report/packages.ts),
// which the browser can't import: keep the two in step.

import type { Workspace, WorkspaceSource } from '../types.js';

/** Files that declare a workspace, read when they sit in the top two levels. */
const MANIFESTS = new Set([
  'package.json',
  'pnpm-workspace.yaml',
  'lerna.json',
  'Cargo.toml',
  'go.work',
]);
const MAX_MANIFEST_DEPTH = 2;
/** With nothing declared, `<container>/<name>` is a package. */
export const CONVENTION_CONTAINERS = ['packages', 'apps', 'libs', 'services'];

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const dirName = (path: string) => {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
};
const depth = (dir: string) => (dir === '' ? 0 : dir.split('/').length);

/** The manifests worth reading, of the tree's paths. */
export function manifestPaths(paths: readonly string[]): string[] {
  return paths.filter(
    (p) =>
      MANIFESTS.has(baseName(p)) && depth(dirName(p)) <= MAX_MANIFEST_DEPTH,
  );
}

/**
 * A file's package: the longest root containing it; outside every root, by
 * convention (`<container>/<name>` for `CONVENTION_CONTAINERS`), else its
 * top-level folder, else '' (the repository root).
 */
export function packageResolver(
  roots: readonly string[],
): (path: string) => string {
  const set = new Set(roots);
  return (path) => {
    const parts = path.split('/');
    for (let k = parts.length - 1; k >= 1; k--) {
      const dir = parts.slice(0, k).join('/');
      if (set.has(dir)) return dir;
    }
    if (parts.length > 2 && CONVENTION_CONTAINERS.includes(parts[0]))
      return `${parts[0]}/${parts[1]}`;
    return parts.length > 1 ? parts[0] : '';
  };
}

/**
 * Globs come from the repository being analyzed, so they're untrusted: one
 * with many wildcards (`*a*a*a…b`) would make the matching regex backtrack
 * for minutes. Real workspace globs have one to three.
 */
const MAX_GLOB_LENGTH = 200;
const MAX_GLOB_WILDCARDS = 8;

/**
 * A glob relative to its manifest's folder, as a whole-path pattern: `*`,
 * `**`, `?`, `{a,b}` and `[abc]` (`[!a]` negated). Null when it is too long
 * or has too many wildcards to match safely; it is then skipped.
 */
function globRegex(raw: string): RegExp | null {
  // `**/**/` is `**/`: collapsing it costs nothing and removes a trap.
  const glob = raw.replace(/(?:\*\*\/)+/g, '**/');
  if (glob.length > MAX_GLOB_LENGTH) return null;
  if ((glob.match(/\*+|\?/g) ?? []).length > MAX_GLOB_WILDCARDS) return null;
  let out = '';
  let braces = 0;
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === '*' && glob[i + 1] === '*') {
      out += '.*';
      i++;
    } else if (ch === '*') out += '[^/]*';
    else if (ch === '?') out += '[^/]';
    else if (ch === '{') {
      braces++;
      out += '(?:';
    } else if (ch === '}' && braces > 0) {
      braces--;
      out += ')';
    } else if (ch === ',' && braces > 0) out += '|';
    else if (ch === '[' && glob.indexOf(']', i + 2) > i) {
      const end = glob.indexOf(']', i + 2);
      let body = glob.slice(i + 1, end).replace(/\\/g, '\\\\');
      if (body.startsWith('!')) body = `^${body.slice(1)}`;
      out += `[${body}]`;
      i = end;
    } else out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  if (braces > 0) return null;
  try {
    return new RegExp(`^${out}$`);
  } catch {
    return null;
  }
}

function cleanGlob(glob: string): string {
  return glob
    .trim()
    .replace(/^\.\//, '')
    .replace(/\/package\.json$/, '')
    .replace(/\/+$/, '');
}

/**
 * The folders under `base` that hold a marker file (`markerDirs`) and match
 * one of `globs` (a leading `!` excludes), never `base` itself or anything in
 * node_modules.
 */
function expand(
  base: string,
  globs: readonly string[],
  markerDirs: readonly string[],
  excludes: readonly string[] = [],
): string[] {
  const compiled = (list: string[]) =>
    list
      .map((g) => globRegex(cleanGlob(g)))
      .filter((r): r is RegExp => r !== null);
  const include = compiled(globs.filter((g) => !g.trim().startsWith('!')));
  const exclude = compiled([
    ...globs
      .filter((g) => g.trim().startsWith('!'))
      .map((g) => g.trim().slice(1)),
    ...excludes,
  ]);
  const prefix = base === '' ? '' : `${base}/`;
  return markerDirs.filter((dir) => {
    if (dir === base || !dir.startsWith(prefix)) return false;
    if (dir.split('/').includes('node_modules')) return false;
    const rel = dir.slice(prefix.length);
    return (
      include.some((r) => r.test(rel)) && !exclude.some((r) => r.test(rel))
    );
  });
}

const strings = (list: unknown): string[] =>
  Array.isArray(list)
    ? list.filter((g): g is string => typeof g === 'string')
    : [];

/** package.json `workspaces`: a list, or `{ packages: [...] }` (Yarn). */
function npmGlobs(text: string): string[] {
  try {
    const ws = (JSON.parse(text) as { workspaces?: unknown }).workspaces;
    return Array.isArray(ws)
      ? strings(ws)
      : strings((ws as { packages?: unknown } | undefined)?.packages);
  } catch {
    return [];
  }
}

function lernaGlobs(text: string): string[] {
  try {
    return strings((JSON.parse(text) as { packages?: unknown }).packages);
  } catch {
    return [];
  }
}

/** A YAML scalar: quoted (a `#` inside stays), or bare up to a comment. */
function yamlScalar(text: string): string {
  const quoted = text.match(/^\s*(['"])(.*?)\1/);
  return quoted ? quoted[2] : text.replace(/\s+#.*$/, '').trim();
}

/**
 * pnpm-workspace.yaml's `packages:` list, block (`- 'apps/*'`) or flow
 * (`packages: ['apps/*']`): enough YAML for that one key.
 */
function pnpmGlobs(text: string): string[] {
  const globs: string[] = [];
  let inPackages = false;
  for (const line of text.split('\n')) {
    if (/^\S/.test(line)) {
      inPackages = /^packages\s*:/.test(line);
      const flow = inPackages ? line.match(/^packages\s*:\s*\[(.*)\]/) : null;
      if (flow)
        for (const part of flow[1].match(/'[^']*'|"[^"]*"|[^,\s][^,]*/g) ?? [])
          globs.push(yamlScalar(part));
      continue;
    }
    const item = inPackages ? line.match(/^\s+-\s*(.+)$/) : null;
    if (item) globs.push(yamlScalar(item[1]));
  }
  return globs.filter(Boolean);
}

/** Cargo.toml's `[workspace]` members and excludes. */
function cargoMembers(text: string): { members: string[]; exclude: string[] } {
  const start = text.search(/^\[workspace\]\s*$/m);
  if (start < 0) return { members: [], exclude: [] };
  const rest = text.slice(start + '[workspace]'.length);
  const end = rest.search(/^\[/m);
  const section = end < 0 ? rest : rest.slice(0, end);
  const list = (key: string) => {
    const m = section.match(
      new RegExp(`^${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, 'm'),
    );
    return m ? [...m[1].matchAll(/"([^"]*)"/g)].map((s) => s[1]) : [];
  };
  return { members: list('members'), exclude: list('exclude') };
}

/** go.work's `use` paths, single or in a block. */
function goUses(text: string): string[] {
  const clean = text.replace(/\/\/.*$/gm, '');
  const uses: string[] = [];
  for (const block of clean.matchAll(/^\s*use\s*\(([\s\S]*?)\)/gm))
    uses.push(...block[1].split(/\s+/).filter(Boolean));
  for (const single of clean.matchAll(/^\s*use\s+([^\s(]+)\s*$/gm))
    uses.push(single[1]);
  return uses;
}

/**
 * The package roots a tree declares, with which kinds of workspace declared
 * them; by convention (`CONVENTION_CONTAINERS`) when none does.
 * @param paths - Every file in the analyzed commit.
 * @param manifests - The text of `manifestPaths(paths)`, by path.
 */
export function workspaceFrom(
  paths: readonly string[],
  manifests: ReadonlyMap<string, string>,
): Workspace {
  const markerDirs = (marker: string) =>
    paths.filter((p) => baseName(p) === marker).map(dirName);
  const npmDirs = markerDirs('package.json');
  const roots = new Set<string>();
  const sources = new Set<WorkspaceSource>();
  const add = (source: WorkspaceSource, found: string[]) => {
    if (found.length === 0) return;
    sources.add(source);
    for (const r of found) roots.add(r);
  };

  for (const [path, text] of manifests) {
    const base = dirName(path);
    switch (baseName(path)) {
      case 'package.json':
        add('npm', expand(base, npmGlobs(text), npmDirs));
        break;
      case 'pnpm-workspace.yaml':
        add('pnpm', expand(base, pnpmGlobs(text), npmDirs));
        break;
      case 'lerna.json':
        add('lerna', expand(base, lernaGlobs(text), npmDirs));
        break;
      case 'Cargo.toml': {
        const { members, exclude } = cargoMembers(text);
        add('cargo', expand(base, members, markerDirs('Cargo.toml'), exclude));
        break;
      }
      case 'go.work':
        add('go', expand(base, goUses(text), markerDirs('go.mod')));
        break;
    }
  }
  if (paths.includes('nx.json'))
    add(
      'nx',
      markerDirs('project.json').filter(
        (d) => d !== '' && !d.split('/').includes('node_modules'),
      ),
    );

  if (roots.size === 0) {
    for (const p of paths) {
      const parts = p.split('/');
      if (parts.length > 2 && CONVENTION_CONTAINERS.includes(parts[0]))
        roots.add(`${parts[0]}/${parts[1]}`);
    }
    if (roots.size > 0) sources.add('convention');
  }
  return {
    sources: [...sources].sort(),
    roots: [...roots].sort(),
  };
}
