// Everything a viewer can select or search for, keyed by entity id: files,
// directories, people, analyzers and views. The URL's selection (`#s=`) is
// resolved through this index — an id that isn't here selects nothing — so a
// crafted link can never put arbitrary text in front of the viewer.

import { CATALOG, PRESET_GROUPS } from './catalog';
import { ids, type EntityId } from './ids';
import type { GitrelicReport } from '@gitrelic/core';

export type SearchKind = 'view' | 'analyzer' | 'person' | 'dir' | 'file';

export interface EntityEntry {
  id: EntityId;
  kind: SearchKind;
  /** What the palette and inspector show as the name. */
  label: string;
  /** Secondary line: a file's directory, a person's email… */
  detail: string;
  /** Extra text that should match a search (aliases, full path). */
  keywords: string[];
}

export interface EntityIndex {
  entries: readonly EntityEntry[];
  get(id: EntityId): EntityEntry | undefined;
}

const dirOf = (path: string) => {
  const slash = path.lastIndexOf('/');
  return slash > 0 ? path.slice(0, slash) : '';
};

export function buildEntityIndex(report: GitrelicReport): EntityIndex {
  const entries: EntityEntry[] = [];

  for (const entry of CATALOG) {
    const group = PRESET_GROUPS.find((g) => g.id === entry.group)?.label ?? '';
    entries.push({
      id: ids.analyzer(entry.id),
      kind: 'analyzer',
      label: entry.label,
      detail: group,
      keywords: [entry.id],
    });
  }

  // The views the Overview fan draws, selectable like a lens.
  for (const group of PRESET_GROUPS) {
    if (group.id === 'overview') continue;
    entries.push({
      id: ids.view(group.id),
      kind: 'view',
      label: group.label,
      detail: 'View',
      keywords: [group.id],
    });
  }

  const aliases = new Map(
    (report.identities ?? []).map((i) => [i.canonicalEmail, i.aliases]),
  );
  for (const c of report.contributors.contributors) {
    entries.push({
      id: ids.person(c.email),
      kind: 'person',
      label: c.name,
      detail: c.email,
      keywords: [
        c.email,
        ...(aliases.get(c.email) ?? []).flatMap((a) => [a.email, a.name]),
      ],
    });
  }

  // Tracked files (LOC) plus anything that changed in the window.
  const files = new Set<string>();
  for (const f of report.loc.files) files.add(f.file);
  for (const f of report.churn.files) files.add(f.file);
  // Every directory either list touches is searchable, but its count is
  // tracked files only, the same number dirFacts shows in the inspector.
  const dirCounts = new Map<string, number>();
  for (const file of files) {
    for (let d = dirOf(file); d; d = dirOf(d))
      if (!dirCounts.has(d)) dirCounts.set(d, 0);
  }
  for (const f of report.loc.files) {
    for (let d = dirOf(f.file); d; d = dirOf(d))
      dirCounts.set(d, (dirCounts.get(d) ?? 0) + 1);
  }
  for (const [dir, count] of [...dirCounts].sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    entries.push({
      id: ids.dir(dir),
      kind: 'dir',
      label: `${dir}/`,
      detail:
        count === 0
          ? 'no tracked files'
          : `${count.toLocaleString()} file${count === 1 ? '' : 's'}`,
      keywords: [],
    });
  }
  for (const file of [...files].sort()) {
    const slash = file.lastIndexOf('/');
    entries.push({
      id: ids.file(file),
      kind: 'file',
      label: slash >= 0 ? file.slice(slash + 1) : file,
      detail: dirOf(file) || '(repository root)',
      keywords: [file],
    });
  }

  const byId = new Map(entries.map((e) => [e.id, e]));
  return { entries, get: (id) => byId.get(id) };
}
