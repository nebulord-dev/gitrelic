// Which package a file belongs to: the longest of the report's workspace
// roots containing it; outside them, `packages/<name>`, `apps/<name>`,
// `libs/<name>` or `services/<name>`, else its top-level folder, else ''. Every
// view that groups by package reads it, so they agree with core's analyzers.
//
// Mirrors core's `packageResolver` (utils/workspace.ts), which the browser
// can't import: keep the two in step.

import type { GitrelicReport } from '@gitrelic/core';

/** Core's `CONVENTION_CONTAINERS`: outside every root, `<container>/<name>`. */
const CONVENTION_CONTAINERS = ['packages', 'apps', 'libs', 'services'];

export function packageResolver(
  roots: readonly string[],
): (path: string) => string {
  const set = new Set(roots);
  return (path) => {
    const parts = path.split('/');
    for (let k = parts.length - 1; k >= 1; k--) {
      const dir = parts.slice(0, k).join('/');
      if (set.has(dir)) return dir;
    }
    if (parts.length > 2 && CONVENTION_CONTAINERS.includes(parts[0]))
      return `${parts[0]}/${parts[1]}`;
    return parts.length > 1 ? parts[0] : '';
  };
}

const cache = new WeakMap<GitrelicReport, (path: string) => string>();

/** The report's resolver, built once per report. */
export function packagesOf(report: GitrelicReport): (path: string) => string {
  let of = cache.get(report);
  if (!of) {
    // Raw fixtures in tests may predate the field; normalizeReport fills it.
    of = packageResolver(report.workspace?.roots ?? []);
    cache.set(report, of);
  }
  return of;
}
