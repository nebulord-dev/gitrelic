import type { FileChurn } from '@gitrelic/core';

export interface DirectoryChurnRow {
  directory: string;
  commits: number;
  files: number;
  share: number;
  topFile: string;
}

const DEFAULT_LIMIT = 10;

// Files at the repo root use the empty string as their directory key —
// the consumer renders that as a `(root)` label.
function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

function basename(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf('/') + 1);
}

export function aggregateChurnByDirectory(
  files: ReadonlyArray<FileChurn>,
  options?: { limit?: number },
): DirectoryChurnRow[] {
  if (files.length === 0) return [];

  const groups = new Map<string, FileChurn[]>();
  let totalCommits = 0;
  for (const file of files) {
    totalCommits += file.commitCount;
    const dir = parentDirectory(file.file);
    const bucket = groups.get(dir);
    if (bucket) bucket.push(file);
    else groups.set(dir, [file]);
  }

  const rows: DirectoryChurnRow[] = [];
  for (const [directory, dirFiles] of groups) {
    let commits = 0;
    let topFile = dirFiles[0]!;
    for (const f of dirFiles) {
      commits += f.commitCount;
      if (f.commitCount > topFile.commitCount) topFile = f;
    }
    rows.push({
      directory,
      commits,
      files: dirFiles.length,
      share: totalCommits === 0 ? 0 : commits / totalCommits,
      topFile: basename(topFile.file),
    });
  }

  rows.sort((a, b) => b.commits - a.commits);
  return rows.slice(0, options?.limit ?? DEFAULT_LIMIT);
}
