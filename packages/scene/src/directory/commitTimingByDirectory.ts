import type { FileTimingProfile } from '@gitrelic/core';

export interface CommitTimingDirectoryRow {
  directory: string;
  count: number;
  share: number;
}

function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

export function aggregateCommitTimingByDirectory(
  files: ReadonlyArray<FileTimingProfile>,
): CommitTimingDirectoryRow[] {
  if (files.length === 0) return [];

  const counts = new Map<string, number>();
  for (const f of files) {
    const dir = parentDirectory(f.file);
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }

  const total = files.length;
  const rows: CommitTimingDirectoryRow[] = [];
  for (const [directory, count] of counts) {
    rows.push({ directory, count, share: count / total });
  }

  rows.sort(
    (a, b) => b.count - a.count || a.directory.localeCompare(b.directory),
  );
  return rows;
}
