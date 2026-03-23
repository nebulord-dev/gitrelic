import { execa } from 'execa';
import type { RenameTrackingReport, FileRename, FileRenameChain } from '../types.js';

/**
 * Parses raw output from `git log --diff-filter=R --find-renames --name-status`
 * into structured FileRename entries.
 */
export function parseRenameLog(raw: string): FileRename[] {
  const renames: FileRename[] = [];
  let currentHash = '';
  let currentDate = '';

  for (const line of raw.split('\n')) {
    if (line.startsWith('COMMIT|')) {
      const parts = line.split('|');
      currentHash = parts[1];
      currentDate = parts[2];
    } else if (/^R\d*\t/.test(line)) {
      const parts = line.split('\t');
      if (parts.length === 3) {
        const oldPath = parts[1];
        const newPath = parts[2];
        renames.push({ oldPath, newPath, commitHash: currentHash, date: currentDate });
      }
    }
  }

  return renames;
}

/**
 * Builds rename chains for currently tracked files by walking backwards
 * through rename history.
 */
export function buildRenameChains(renames: FileRename[], trackedFiles: string[]): FileRenameChain[] {
  const trackedSet = new Set(trackedFiles);

  // Build a reverse map: newPath → { oldPath, date }
  // Sort renames by date so we process them in chronological order
  const sorted = [...renames].sort((a, b) => a.date.localeCompare(b.date));

  // For each tracked file, walk backwards through renames to find all previous names
  // Build forward map: oldPath → newPath (chronological)
  // And reverse map: newPath → oldPath
  const reverseMap = new Map<string, { oldPath: string; commitHash: string; date: string }[]>();
  for (const rename of sorted) {
    if (!reverseMap.has(rename.newPath)) reverseMap.set(rename.newPath, []);
    reverseMap.get(rename.newPath)!.push({ oldPath: rename.oldPath, commitHash: rename.commitHash, date: rename.date });
  }

  const chains: FileRenameChain[] = [];

  for (const file of trackedFiles) {
    const previousNames: string[] = [];
    let current = file;
    const visited = new Set<string>();

    // Walk backwards: find what was renamed TO current
    while (true) {
      if (visited.has(current)) break; // prevent cycles
      visited.add(current);

      const entries = reverseMap.get(current);
      if (!entries || entries.length === 0) break;

      // Take the most recent rename to this path (last in sorted order)
      const entry = entries[entries.length - 1];
      previousNames.unshift(entry.oldPath); // prepend (oldest first)
      current = entry.oldPath;
    }

    if (previousNames.length > 0) {
      chains.push({
        currentPath: file,
        previousNames,
        renameCount: previousNames.length,
      });
    }
  }

  return chains;
}

/**
 * Analyzes rename history of files in a git repository.
 * Shells out to git to detect renames via --diff-filter=R --find-renames.
 */
export async function analyzeRenameTracking(
  repoPath: string,
  trackedFiles: string[],
  options?: { since?: string },
): Promise<RenameTrackingReport> {
  const args = [
    'log',
    '--diff-filter=R',
    '--find-renames',
    '--name-status',
    '--format=COMMIT|%H|%aI',
    '--no-merges',
  ];

  if (options?.since) args.push(`--since=${options.since}`);

  let raw = '';
  try {
    const result = await execa('git', args, { cwd: repoPath });
    raw = result.stdout;
  } catch {
    // If git command fails, return empty report
    return {
      renames: [],
      chains: [],
      totalRenames: 0,
      filesWithRenames: 0,
      summary: 'No renames detected',
    };
  }

  const renames = parseRenameLog(raw);
  const chains = buildRenameChains(renames, trackedFiles);

  const totalRenames = renames.length;
  const filesWithRenames = chains.length;

  const summary = `${filesWithRenames} file${filesWithRenames !== 1 ? 's' : ''} have been renamed ${totalRenames} time${totalRenames !== 1 ? 's' : ''} total`;

  return {
    renames,
    chains,
    totalRenames,
    filesWithRenames,
    summary,
  };
}
