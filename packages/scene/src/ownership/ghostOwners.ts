import type { Contributor, GhostFile } from '@gitrelic/core';

export interface TopGhostOwner {
  email: string;
  name: string;
  fileCount: number;
  ghostLoc: number;
}

export function topGhostOwners(
  files: ReadonlyArray<GhostFile>,
  contributors: ReadonlyArray<Contributor>,
  topN: number,
): TopGhostOwner[] {
  if (files.length === 0) return [];

  const nameByEmail = new Map(contributors.map((c) => [c.email, c.name]));

  const aggregates = new Map<string, { fileCount: number; ghostLoc: number }>();
  for (const f of files) {
    const entry = aggregates.get(f.dominantAuthor) ?? {
      fileCount: 0,
      ghostLoc: 0,
    };
    entry.fileCount += 1;
    entry.ghostLoc += f.loc;
    aggregates.set(f.dominantAuthor, entry);
  }

  const rows: TopGhostOwner[] = [];
  for (const [email, agg] of aggregates) {
    const candidateName = nameByEmail.get(email);
    rows.push({
      email,
      name: candidateName && candidateName.length > 0 ? candidateName : email,
      fileCount: agg.fileCount,
      ghostLoc: agg.ghostLoc,
    });
  }

  rows.sort(
    (a, b) => b.fileCount - a.fileCount || a.email.localeCompare(b.email),
  );

  return rows.slice(0, topN);
}
