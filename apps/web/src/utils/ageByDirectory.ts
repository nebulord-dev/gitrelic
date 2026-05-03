import type { FileAge } from '@gitrelic/core';

export interface AgeDirectoryRow {
  directory: string;
  fileCount: number;
  medianAgeDays: number;
  freshCount: number;
  agingCount: number;
  staleCount: number;
  ancientCount: number;
  oldestFile: string;
  oldestFileAgeDays: number;
}

function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor(sorted.length / 2)];
}

export function aggregateAgeByDirectory(
  files: ReadonlyArray<FileAge>,
): AgeDirectoryRow[] {
  if (files.length === 0) return [];

  // Bucket files by parent directory.
  const byDir = new Map<string, FileAge[]>();
  for (const f of files) {
    const dir = parentDirectory(f.file);
    const bucket = byDir.get(dir);
    if (bucket) bucket.push(f);
    else byDir.set(dir, [f]);
  }

  const rows: AgeDirectoryRow[] = [];
  for (const [directory, dirFiles] of byDir) {
    let freshCount = 0;
    let agingCount = 0;
    let staleCount = 0;
    let ancientCount = 0;
    let oldest: FileAge = dirFiles[0];
    const ages: number[] = [];

    for (const f of dirFiles) {
      ages.push(f.ageInDays);
      if (f.ageInDays > oldest.ageInDays) oldest = f;
      switch (f.status) {
        case 'fresh':
          freshCount++;
          break;
        case 'aging':
          agingCount++;
          break;
        case 'stale':
          staleCount++;
          break;
        case 'ancient':
          ancientCount++;
          break;
      }
    }

    ages.sort((a, b) => a - b);
    rows.push({
      directory,
      fileCount: dirFiles.length,
      medianAgeDays: median(ages),
      freshCount,
      agingCount,
      staleCount,
      ancientCount,
      oldestFile: oldest.file,
      oldestFileAgeDays: oldest.ageInDays,
    });
  }

  rows.sort(
    (a, b) =>
      b.medianAgeDays - a.medianAgeDays ||
      a.directory.localeCompare(b.directory),
  );
  return rows;
}
