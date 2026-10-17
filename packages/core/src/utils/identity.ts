import { classifyAuthor } from './authorClassification.js';
import type { IdentityAlias } from '../types.js';
import type { RawCommit } from './git.js';

// ─── Author identity merging ───────────────────────────────────────────────────
//
// `.mailmap` (honored by `%aE|%aN` in getAllCommits) is the authoritative fix,
// but most repos don't maintain one. This pass catches the common leftovers:
// the same person committing from a work address and a GitHub noreply address,
// or from two emails under the same full name. Without it every analyzer keyed
// by email — bus factor, ghost files, contributors — counts them twice.
//
// Rules, applied via union-find over lowercased emails:
//   1. Emails equal ignoring case.
//   2. A GitHub noreply login (`123+login@users.noreply.github.com`) equal to
//      another identity's email local-part or its de-spaced name.
//   3. The same normalized name, only when it has 2+ words and isn't a
//      placeholder. Single names ("Alex") are too common to trust.
// Rules 2 and 3 never touch bots or AI identities — "Claude Code" the human
// and "Claude Code" the agent are not one contributor.

const NOREPLY_RE = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i;

const NAME_DENYLIST = new Set([
  'your name',
  'unknown',
  'root',
  'admin',
  'administrator',
  'github',
  'github action',
  'github actions',
  'ubuntu',
  'user',
  'local user',
  'default user',
]);

interface IdentityStats {
  key: string; // lowercased email
  emails: Map<string, number>; // raw spelling → commits
  names: Map<string, number>;
  human: boolean;
}

function normalizeName(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function noreplyLogin(email: string): string | null {
  return email.match(NOREPLY_RE)?.[1] ?? null;
}

function bump(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

/** Highest count wins; ties break lexicographically so output is deterministic. */
function mostUsed(entries: Iterable<[string, number]>): string {
  let best = '';
  let bestCount = -1;
  for (const [value, count] of entries) {
    if (count > bestCount || (count === bestCount && value < best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    let root = x;
    while (this.parent.has(root) && this.parent.get(root) !== root) {
      root = this.parent.get(root)!;
    }
    // Path compression keeps repeat lookups flat.
    let node = x;
    while (node !== root) {
      const next = this.parent.get(node) ?? root;
      this.parent.set(node, root);
      node = next;
    }
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    // Smaller key becomes root so results don't depend on input order.
    if (ra < rb) this.parent.set(rb, ra);
    else this.parent.set(ra, rb);
  }
}

/**
 * Collapses one person's split identities into a single canonical
 * email/name, rewriting every commit's author and co-author fields.
 * Returns new commit objects for changed commits; the input is not mutated.
 * `identities` lists only clusters that merged two or more emails.
 */
export function mergeIdentities(commits: RawCommit[]): {
  commits: RawCommit[];
  identities: IdentityAlias[];
} {
  const stats = new Map<string, IdentityStats>();
  for (const c of commits) {
    const key = c.authorEmail.toLowerCase();
    let s = stats.get(key);
    if (!s) {
      s = {
        key,
        emails: new Map(),
        names: new Map(),
        human: classifyAuthor(c.authorEmail) === 'human',
      };
      stats.set(key, s);
    }
    bump(s.emails, c.authorEmail);
    bump(s.names, c.authorName);
  }

  // Rule 1 is implicit: stats are already keyed by lowercased email.
  const uf = new UnionFind();
  const humans = [...stats.values()].filter((s) => s.human);

  // Rule 2: noreply login ↔ local-part or de-spaced name.
  const keysByHandle = new Map<string, string[]>();
  for (const s of humans) {
    if (noreplyLogin(s.key)) continue;
    const handles = new Set([s.key.split('@')[0]]);
    for (const name of s.names.keys()) {
      handles.add(normalizeName(name).replace(/ /g, ''));
    }
    for (const h of handles) {
      if (!h) continue;
      const list = keysByHandle.get(h) ?? [];
      list.push(s.key);
      keysByHandle.set(h, list);
    }
  }
  for (const s of humans) {
    const login = noreplyLogin(s.key);
    if (!login) continue;
    for (const other of keysByHandle.get(login) ?? []) uf.union(s.key, other);
  }

  // Rule 3: shared multi-word, non-placeholder name.
  const keyByName = new Map<string, string>();
  for (const s of humans) {
    for (const name of s.names.keys()) {
      const n = normalizeName(name);
      if (!n.includes(' ') || NAME_DENYLIST.has(n)) continue;
      const seen = keyByName.get(n);
      if (seen) uf.union(seen, s.key);
      else keyByName.set(n, s.key);
    }
  }

  const clusters = new Map<string, IdentityStats[]>();
  for (const s of stats.values()) {
    const root = uf.find(s.key);
    const list = clusters.get(root) ?? [];
    list.push(s);
    clusters.set(root, list);
  }

  const canonical = new Map<string, { email: string; name: string }>();
  const identities: IdentityAlias[] = [];
  for (const members of clusters.values()) {
    const emailCounts = new Map<string, number>();
    const nameCounts = new Map<string, number>();
    for (const m of members) {
      for (const [e, n] of m.emails) bump(emailCounts, e, n);
      for (const [nm, n] of m.names) bump(nameCounts, nm, n);
    }
    // A noreply address is a last resort — it says nothing about who you are.
    const preferred = [...emailCounts].filter(([e]) => !noreplyLogin(e));
    const email = mostUsed(preferred.length > 0 ? preferred : emailCounts);
    const name = mostUsed(nameCounts);
    for (const m of members) canonical.set(m.key, { email, name });

    if (emailCounts.size > 1) {
      identities.push({
        canonicalEmail: email,
        name,
        aliases: [...emailCounts]
          .map(([aliasEmail, count]) => ({
            email: aliasEmail,
            name: mostUsed(stats.get(aliasEmail.toLowerCase())!.names),
            commits: count,
          }))
          .sort(
            (a, b) => b.commits - a.commits || a.email.localeCompare(b.email),
          ),
      });
    }
  }
  identities.sort((a, b) => a.canonicalEmail.localeCompare(b.canonicalEmail));

  const merged = commits.map((c) => {
    const target = canonical.get(c.authorEmail.toLowerCase())!;
    let coAuthorsChanged = false;
    const coAuthors = c.coAuthors.map((co) => {
      const t = canonical.get(co.email.toLowerCase());
      if (!t || (t.email === co.email && t.name === co.name)) return co;
      coAuthorsChanged = true;
      return { name: t.name, email: t.email };
    });
    if (
      target.email === c.authorEmail &&
      target.name === c.authorName &&
      !coAuthorsChanged
    ) {
      return c;
    }
    return {
      ...c,
      authorEmail: target.email,
      authorName: target.name,
      coAuthors: coAuthorsChanged ? coAuthors : c.coAuthors,
    };
  });

  return { commits: merged, identities };
}
