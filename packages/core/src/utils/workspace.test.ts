import { describe, expect, it } from 'vitest';

import { manifestPaths, packageResolver, workspaceFrom } from './workspace.js';

const files = (...paths: string[]) => paths;

describe('packageResolver', () => {
  const of = packageResolver([
    'apps/web',
    'compiler/packages/babel',
    'compiler',
  ]);

  it('maps a file to the longest root containing it', () => {
    expect(of('apps/web/src/main.ts')).toBe('apps/web');
    expect(of('compiler/packages/babel/src/a.ts')).toBe(
      'compiler/packages/babel',
    );
    expect(of('compiler/scripts/x.ts')).toBe('compiler');
  });

  it('falls back to convention, then the top-level folder, then the root', () => {
    // An undeclared package in a convention folder is still its own package.
    expect(of('libs/ui/index.ts')).toBe('libs/ui');
    expect(of('packages/extra/a.ts')).toBe('packages/extra');
    expect(of('scripts/build.js')).toBe('scripts');
    expect(of('README.md')).toBe('');
    // A file beside the roots, not under one.
    expect(of('apps/README.md')).toBe('apps');
  });
});

describe('manifestPaths', () => {
  it('reads workspace files in the top two levels only', () => {
    expect(
      manifestPaths(
        files(
          'package.json',
          'pnpm-workspace.yaml',
          'compiler/package.json',
          'compiler/Cargo.toml',
          'go.work',
          'lerna.json',
          'packages/react/package.json',
          'packages/react/src/deep/package.json',
          'src/index.ts',
        ),
      ).sort(),
    ).toEqual([
      'compiler/Cargo.toml',
      'compiler/package.json',
      'go.work',
      'lerna.json',
      'package.json',
      'packages/react/package.json',
      'pnpm-workspace.yaml',
    ]);
  });
});

describe('workspaceFrom', () => {
  it('expands pnpm globs to folders with a package.json, minus exclusions', () => {
    const ws = workspaceFrom(
      files(
        'pnpm-workspace.yaml',
        'apps/web/package.json',
        'apps/cli/package.json',
        'apps/notes/README.md',
        'packages/core/package.json',
        'packages/old/package.json',
      ),
      new Map([
        [
          'pnpm-workspace.yaml',
          "packages:\n  - 'packages/*'\n  - \"apps/*\" # the dashboards\n  - '!packages/old'\n\ncatalog:\n  x: ^1\n",
        ],
      ]),
    );
    expect(ws).toEqual({
      sources: ['pnpm'],
      roots: ['apps/cli', 'apps/web', 'packages/core'],
    });
  });

  it('reads npm workspaces, the object form, and nested workspaces', () => {
    const ws = workspaceFrom(
      files(
        'package.json',
        'packages/react/package.json',
        'compiler/package.json',
        'compiler/packages/babel/package.json',
        'compiler/packages/eslint/package.json',
      ),
      new Map([
        ['package.json', '{"workspaces":["packages/*"]}'],
        ['compiler/package.json', '{"workspaces":{"packages":["packages/*"]}}'],
        ['packages/react/package.json', '{"name":"react"}'],
      ]),
    );
    expect(ws).toEqual({
      sources: ['npm'],
      roots: [
        'compiler/packages/babel',
        'compiler/packages/eslint',
        'packages/react',
      ],
    });
  });

  it('reads Cargo workspace members, Lerna, go.work and Nx projects', () => {
    const ws = workspaceFrom(
      files(
        'compiler/Cargo.toml',
        'compiler/crates/ast/Cargo.toml',
        'compiler/crates/hir/Cargo.toml',
        'lerna.json',
        'libs/a/package.json',
        'go.work',
        'svc/api/go.mod',
        'tools/gen/go.mod',
        'nx.json',
        'projects/admin/project.json',
      ),
      new Map([
        [
          'compiler/Cargo.toml',
          '[package]\nname = "x"\n\n[workspace]\nmembers = [\n  "crates/*",\n]\nexclude = ["crates/hir"]\n\n[profile.release]\nlto = true\n',
        ],
        ['lerna.json', '{"packages":["libs/*"]}'],
        [
          'go.work',
          'go 1.22\n\nuse (\n\t./svc/api\n\t./tools/gen // generators\n)\n',
        ],
      ]),
    );
    expect(ws).toEqual({
      sources: ['cargo', 'go', 'lerna', 'nx'],
      roots: [
        'compiler/crates/ast',
        'libs/a',
        'projects/admin',
        'svc/api',
        'tools/gen',
      ],
    });
  });

  it('matches ** at any depth, never inside node_modules or at the workspace’s own folder', () => {
    const ws = workspaceFrom(
      files(
        'package.json',
        'modules/a/b/package.json',
        'modules/node_modules/x/package.json',
      ),
      new Map([['package.json', '{"workspaces":["modules/**", "."]}']]),
    );
    expect(ws.roots).toEqual(['modules/a/b']);
  });

  it('falls back to convention when nothing declares a workspace', () => {
    const ws = workspaceFrom(
      files(
        'package.json',
        'apps/web/src/a.ts',
        'libs/ui/index.ts',
        'services/api/main.go',
        'packages/core/x.ts',
        'packages/README.md',
        'src/index.ts',
      ),
      new Map([['package.json', '{"name":"single"}']]),
    );
    expect(ws).toEqual({
      sources: ['convention'],
      roots: ['apps/web', 'libs/ui', 'packages/core', 'services/api'],
    });
  });

  it('survives manifests it can’t parse', () => {
    const ws = workspaceFrom(
      files('package.json', 'packages/a/x.ts'),
      new Map([['package.json', '{not json']]),
    );
    expect(ws).toEqual({ sources: ['convention'], roots: ['packages/a'] });
  });

  it('reads brace and class globs', () => {
    const ws = workspaceFrom(
      files(
        'package.json',
        'apps/web/package.json',
        'apps/cli/package.json',
        'apps/notes/package.json',
        'tools/a1/package.json',
        'tools/b1/package.json',
      ),
      new Map([
        ['package.json', '{"workspaces":["apps/{web,cli}", "tools/[a]1"]}'],
      ]),
    );
    expect(ws.roots).toEqual(['apps/cli', 'apps/web', 'tools/a1']);
  });

  it('reads pnpm flow lists and keeps a # inside quotes', () => {
    const files2 = files(
      'pnpm-workspace.yaml',
      'apps/web/package.json',
      'pkgs/#1/package.json',
    );
    expect(
      workspaceFrom(
        files2,
        new Map([
          ['pnpm-workspace.yaml', 'packages: [\'apps/*\', "pkgs/#1"] # both\n'],
        ]),
      ).roots,
    ).toEqual(['apps/web', 'pkgs/#1']);
    expect(
      workspaceFrom(
        files2,
        new Map([
          ['pnpm-workspace.yaml', "packages:\n  - 'pkgs/#1' # the odd one\n"],
        ]),
      ).roots,
    ).toEqual(['pkgs/#1']);
  });

  it('stays fast on a hostile glob, skipping it', () => {
    // `*a` thirty times against a long run of a's: catastrophic for a
    // backtracking regex if it ran.
    const dirs = Array.from(
      { length: 50 },
      (_, i) => `${'a'.repeat(60)}${i}/package.json`,
    );
    const hostile = `${'*a'.repeat(30)}b`;
    const start = performance.now();
    const ws = workspaceFrom(
      files('package.json', 'packages/real/package.json', ...dirs),
      new Map([
        [
          'package.json',
          JSON.stringify({
            workspaces: [hostile, `${'**/'.repeat(40)}x`, 'packages/*'],
          }),
        ],
      ]),
    );
    expect(performance.now() - start).toBeLessThan(500);
    // The hostile globs are skipped; the honest one still counts.
    expect(ws.roots).toEqual(['packages/real']);
  });

  it('survives a Cargo.toml it can’t parse', () => {
    const ws = workspaceFrom(
      files('Cargo.toml', 'crates/a/Cargo.toml'),
      new Map([['Cargo.toml', '[workspace\nmembers = ["crates/*"']]),
    );
    expect(ws).toEqual({ sources: [], roots: [] });
  });
});
