// Entity ids are the thread that ties views together: the same file or person
// keeps one id in every layout, so its mark can travel between them instead of
// disappearing and reappearing.
//
//   repo                       the repository root
//   analyzer:<preset id>       an analyzer (a lens; the Overview's dots)
//   view:<group id>            a view the Overview fan draws (not Overview itself)
//   file:<path>                a tracked file
//   dir:<path>                 a directory
//   person:<canonical email>   a contributor (after identity merging)
//   cell:<dow>:<hour>          a Commit Timing clock cell
//   week:<email>:<YYYY-MM-DD>  one person's week (Contributors strip)
//   commit:<hash>              a single commit

export const ENTITY_KINDS = [
  'repo',
  'analyzer',
  'view',
  'file',
  'dir',
  'person',
  'cell',
  'week',
  'commit',
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/** A string id, `kind:key` (or just `repo`). */
export type EntityId = string;

export const REPO_ID: EntityId = 'repo';

export const ids = {
  analyzer: (preset: string): EntityId => `analyzer:${preset}`,
  view: (group: string): EntityId => `view:${group}`,
  file: (path: string): EntityId => `file:${path}`,
  dir: (path: string): EntityId => `dir:${path}`,
  person: (email: string): EntityId => `person:${email}`,
  cell: (dow: number, hour: number): EntityId => `cell:${dow}:${hour}`,
  week: (email: string, monday: string): EntityId => `week:${email}:${monday}`,
  commit: (hash: string): EntityId => `commit:${hash}`,
};

/** The kind of an id, or null for anything not shaped like one. */
export function entityKind(id: EntityId): EntityKind | null {
  if (id === REPO_ID) return 'repo';
  const colon = id.indexOf(':');
  if (colon <= 0 || colon === id.length - 1) return null;
  const kind = id.slice(0, colon);
  return kind !== 'repo' && (ENTITY_KINDS as readonly string[]).includes(kind)
    ? (kind as EntityKind)
    : null;
}

/** Everything after `kind:`; empty for `repo` and malformed ids. */
export function entityKey(id: EntityId): string {
  return entityKind(id) && id !== REPO_ID ? id.slice(id.indexOf(':') + 1) : '';
}

/**
 * The structural parent of an id: a file's directory, a directory's parent
 * directory, a week's person, and the repo for everything else. Top-level
 * files and directories belong to the repo. The repo, and anything malformed,
 * has none.
 */
export function parentOf(id: EntityId): EntityId | null {
  const kind = entityKind(id);
  if (kind === null || kind === 'repo') return null;
  const key = entityKey(id);
  if (kind === 'file' || kind === 'dir') {
    const slash = key.lastIndexOf('/');
    return slash > 0 ? ids.dir(key.slice(0, slash)) : REPO_ID;
  }
  if (kind === 'week') {
    // The date never contains a colon; an email practically never does, but
    // splitting on the last one keeps it whole either way.
    const colon = key.lastIndexOf(':');
    return colon > 0 ? ids.person(key.slice(0, colon)) : REPO_ID;
  }
  return REPO_ID;
}
