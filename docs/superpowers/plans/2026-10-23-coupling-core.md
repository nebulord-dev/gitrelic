# Coupling core (RELIC-350) Implementation Plan

> Executed inline in the session that wrote it; code lands in the commits. Spec: `docs/atlas-views.md` › *Ownership & Risk › Coupling*.

**Goal:** Coupling and Blast Radius on honest inputs, plus the package coupling, families and blast-radius spread the lens needs.

1. **Shared inputs.** Both analyzers skip commits touching more than `MAX_FIX_FILES` (20) kept files (today 30) and read the ownership file set (fixtures and generated files out, tests in), as Fix rate does. Tests: a 21-file commit is ignored; a fixture never pairs.
2. **Coupling: packages.** `packageCommits` (commits per package, `packageOf`) and `packages` (each package pair with 3+ commits that changed both: commits, share of the smaller package's, its strongest file pairs, up to 4). Tests: counts, share, the root package, file pairs only across the two.
3. **Coupling: families.** Components of pairs with 4+ shared commits and 60%+ of the busier file's commits; files, the packages they span, their pairs; largest first. Tests: a riding-along file stays out, a cross-package family names its packages.
4. **Blast radius: honest median.** Per file, the median of other files its commits changed and its footprint (commits by other files changed, 0–19) when it has `MIN_BLAST_COMMITS` (8) commits; `minCommits` and `rated` on the report. Classic's fields stay. Tests: median vs mean on a skewed file, unrated under 8, footprint sums to commits.
5. **Wiring + backfill.** Runner passes the ownership files; `normalizeReport` backfills `packages`, `packageCommits`, `families`, `minCommits`, `rated`; fixture regenerated; snapshot updated.
6. **Check** on React and gitrelic against the canvas numbers; PR (not closing RELIC-350: the lens PR does).
