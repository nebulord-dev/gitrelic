// The file card's "Top contributors": bus factor's authors for a file, named
// from the contributor list, with the dominant author's share.

import type { GitrelicReport } from '@gitrelic/core';

export interface FileContributor {
  email: string;
  name: string;
  /** Share of the file's commits, only known for the dominant author. */
  percent: number | null;
}

/** A file's top authors (up to five), dominant author first. */
export function fileContributors(
  file: string,
  report: GitrelicReport,
): FileContributor[] {
  const bf = report.busFactors.files.find((f) => f.file === file);
  if (!bf) return [];
  const names = new Map(
    report.contributors.contributors.map((c) => [c.email, c.name]),
  );
  return bf.authors.slice(0, 5).map((email) => ({
    email,
    name: names.get(email) ?? email.split('@')[0],
    percent: email === bf.dominantAuthor ? bf.dominantAuthorPercent : null,
  }));
}
