import type { RawCommit } from '../utils/git.js';
import type { CouplingReport, CoupledPair, FileCouplingProfile } from '../types.js';

const MAX_FILES_PER_COMMIT = 30;
const MIN_CO_OCCURRENCES = 3;
const MIN_COUPLING_STRENGTH = 30;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

export function analyzeCoupling(commits: RawCommit[], trackedFiles: string[]): CouplingReport {
  const trackedSet = new Set(trackedFiles);
  const coOccurrences = new Map<string, number>();
  const fileTotalCommits = new Map<string, number>();

  for (const commit of commits) {
    const files = commit.files.filter(f => trackedSet.has(f));

    if (files.length >= MAX_FILES_PER_COMMIT) continue;

    for (const file of files) {
      fileTotalCommits.set(file, (fileTotalCommits.get(file) ?? 0) + 1);
    }

    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = pairKey(files[i], files[j]);
        coOccurrences.set(key, (coOccurrences.get(key) ?? 0) + 1);
      }
    }
  }

  const pairs: CoupledPair[] = [];

  for (const [key, coCommits] of coOccurrences) {
    if (coCommits < MIN_CO_OCCURRENCES) continue;

    const [fileA, fileB] = key.split('\0');
    const totalCommitsA = fileTotalCommits.get(fileA) ?? 0;
    const totalCommitsB = fileTotalCommits.get(fileB) ?? 0;
    const minCommits = Math.min(totalCommitsA, totalCommitsB);
    const couplingStrength = minCommits > 0 ? Math.round((coCommits / minCommits) * 100) : 0;

    if (couplingStrength < MIN_COUPLING_STRENGTH) continue;

    pairs.push({ fileA, fileB, coCommits, totalCommitsA, totalCommitsB, couplingStrength });
  }

  pairs.sort((a, b) => b.couplingStrength - a.couplingStrength);
  const topPairs = pairs.slice(0, 20);

  const profileMap = new Map<string, CoupledPair[]>();
  for (const pair of pairs) {
    if (!profileMap.has(pair.fileA)) profileMap.set(pair.fileA, []);
    if (!profileMap.has(pair.fileB)) profileMap.set(pair.fileB, []);
    profileMap.get(pair.fileA)!.push(pair);
    profileMap.get(pair.fileB)!.push(pair);
  }

  const fileProfiles: FileCouplingProfile[] = [...profileMap.entries()]
    .map(([file, partners]) => {
      const sorted = [...partners].sort((a, b) => b.couplingStrength - a.couplingStrength);
      const topPartner = sorted[0]
        ? (sorted[0].fileA === file ? sorted[0].fileB : sorted[0].fileA)
        : null;
      const couplingScore = sorted.length > 0
        ? Math.round(sorted.reduce((s, p) => s + p.couplingStrength, 0) / sorted.length)
        : 0;
      return { file, partners: sorted, topPartner, couplingScore };
    })
    .sort((a, b) => b.couplingScore - a.couplingScore);

  const strongest = topPairs[0];
  const summary = pairs.length > 0 && strongest
    ? `${pairs.length} coupled pair${pairs.length !== 1 ? 's' : ''} found, strongest: ${strongest.fileA} ↔ ${strongest.fileB} (${strongest.couplingStrength}%)`
    : 'No temporal coupling detected';

  return { pairs, fileProfiles, topPairs, summary };
}
