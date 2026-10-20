---
title: Fix Rate
description: How often a file's changes are followed, within 30 days, by a fix of the very lines they wrote.
---

# Fix Rate

**Fix rate** asks a direct question of each file: *when someone changes it, how often does a fix of that change follow soon after?* A file where one change in four needs a follow-up fix within a month is fragile in a way churn alone can't show: it changes often *and* its changes don't hold.

It's the successor to [Shame](./shame) as a measure of struggling files. Shame scores what commit messages *say* about a file; fix rate checks which change a fix actually repaired.

## How it's measured

1. **Find the fixes.** A fix is a commit whose subject line says so (`fix`, `fixes`, `fixed`, `bug`, `bugfix`, `hotfix`, `regression`, `oops`, `broke`, `broken`, whole words, any case) or a revert (a subject starting `Revert`). Commits by bots (Dependabot, Renovate, GitHub Actions and the like) are left out, as fixes and as changes. Merge commits never count.
2. **Trace each fix to its cause.** For every file a fix touched, GitRelic runs `git blame` on the lines the fix changed or removed, as they were just before it. Blame names the commits that wrote those lines. This is the SZZ method from software-engineering research, kept lightweight. Whitespace-only edits aren't treated as the origin, and a fix that only *adds* lines blames nothing.
3. **Count a change as fixed-after** when a fix within **30 days** traced back to it.
4. **Rate** = fixed-after changes ÷ changes.

### Why blame and not "a fix touched the file soon after"

The simpler rule blames every recent change to a file for each fix. On React's history it named the right change only **15%** of the time, and **11%** on busy files, because a busy file has several innocent changes before every fix. Blame looks at the lines the fix actually rewrote.

## What gets a rate

- **Only changes at least 30 days old are rated.** A change from last week hasn't had its chance to be fixed yet, so counting it as clean would flatter the newest files.
- **A file needs 8 rated changes.** Below that, a single fix swings the rate by 12 points or more, which is noise rather than a signal. Those files are counted in `unratedFiles` and get no rate.
- **Fixtures and generated files are left out**, as they are for ownership: a snapshot update isn't a fix. `--include-fixtures` brings them back.
- **Sweeping fixes are skipped.** A fix commit touching more than 20 files (a rename across the codebase, a mass snapshot update) would blame every file it passed through. It's counted in `sweepingSkipped` and not traced. The median fix commit touches 2 files.

## Reading the numbers

Expect low numbers. Most changes are never followed by a fix of their own lines within a month. On React over the last 12 months, the repo-wide rate is about **1%**, and over its whole history about **2%**. A file that stands out at 20–40% has earned a look:

- **A high rate on a busy file** means its changes keep needing repair: a sign that it is hard to change safely, under-tested, or doing too much.
- **The fixes listed for a file** (up to five, newest first) say what kept breaking. Each one names the changes it repaired (`causes`).
- **The month series** (`byMonth`, by the month of the change) shows whether changes have been holding up better or worse over time.

## Limits

- **Messages decide what a fix is.** A commit saying "fix typo" counts; a real fix described as "handle empty list" doesn't. The analysis only traces what the subject line admits to.
- **Blame names the last writer, not always the culprit.** If a fix changes a line next to the bug, blame names whoever wrote that line.
- **Renames since the change.** A change counts under the path the file had then. A file renamed since keeps only the changes made under its current name.

## In the report

`gitrelic --json` includes it as `fixRate`:

| Field | Meaning |
| --- | --- |
| `files[]` | Rated files: `file`, `changes`, `fixedAfter`, `rate`, `fixes[]` (`hash`, `message`, `date`, `revert`, `causes`) |
| `unratedFiles` | Files with rated changes, but fewer than 8 |
| `changes`, `fixedAfter`, `rate` | Repo-wide, over every rated change |
| `byMonth[]` | `month`, `changes`, `fixedAfter`, by the month of the change |
| `fixCommits`, `reverts` | Fix commits traced, and how many of them were reverts |
| `sweepingSkipped` | Fix commits left untraced for touching more than 20 files |
| `blameTimeouts` | Files a fix touched whose blame hit git's 30-second limit; they're skipped and the rest are still rated |
| `windowDays`, `minChanges` | The rules this report used (30 and 8) |

Tracing costs one `git diff` and one `git blame` per file a fix touched. On React that's about 2 seconds for 12 months of history, and 15 seconds for all of it.
