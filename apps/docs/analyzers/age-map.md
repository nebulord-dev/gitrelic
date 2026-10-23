---
title: Age
description: Every file by its last change in all of history — how much code has gone cold, where it lives, and which of it nobody left still knows.
---

# Age

**Age** dates every tracked file by its last change, in all of the repository's history, and asks two questions:

- **How much of the code has gone cold, and where?** A file unchanged for a year or more is *cold*. Cold isn't bad in itself: stable code stops changing. The question is where the cold mass sits and how thick it is.
- **Which cold code needs a decision?** Two cases do: a *dormant package* (a whole package nobody has changed in a year) and an *orphaned file* (cold, and everyone who changed it has gone quiet).

Age absorbed the old **Stale Files** analyzer. Stale Files listed every file untouched in the analysis window, without dates, so on a 12-month run it mostly measured how short the window was. Age's table, sorted oldest first, is that list, with dates.

## How it's measured

1. **Every file gets its real last change.** GitRelic reads the analysis window as usual, then the history before it (one `git log --name-only`, about a second on React). A file untouched in the window still gets its true date, however old. Ages count back from the analyzed commit, not from today, so a report on an old commit says what was true then.
2. **Calendar bands.** Each file falls in one of five bands: *under 3 months*, *3–12 months*, *1–2 years*, *2–4 years*, *4+ years*. The last three are cold. The bands are fixed, so a file's band doesn't change when `--since` does.
3. **Orphaned.** A cold file is orphaned when nobody who changed it has made a commit in the year before the analyzed commit. People are matched across their emails over all of history, so someone who changed email is still the same person.
4. **Dormant.** A package (a `packages/<name>` folder in a monorepo, otherwise a top-level folder) with **5 or more source files** and no source change in a year. The badge counts these.
5. **Woken.** A file changed this year after a year or more untouched.

Fixtures and generated files are left out of everything and counted on their own. Tests are left out of the dormant check, so a test change doesn't keep a package awake.

### Why dormant packages badge and old files don't

React has 979 source files unchanged for a year or more, which says the codebase is mature, not neglected. It has one package nobody has changed in 3.4 years, `dom-event-testing-library`, and that one asks for a decision: archive it, delete it, or say why it stays.

### Why woken files are a finding, not a warning

It seems likely that a change to code nobody has touched in years is risky: whoever knew it may be gone. GitRelic checked, using [fix rate](./fix-rate)'s line tracing over React's history. Changes made after a year or more untouched were later fixed **less** often than the rest (1.8% against 2.6%). They're mostly small, deliberate edits. So woken files are listed, with a nudge to check that whoever changed it knew the code, and nothing more.

## In Atlas

Age is a Code Health lens with two forms.

- **Strata** (the default). One row per package, the packages with the most cold lines first. Each dot is a file, placed by time since its last change on a square-root scale (so the last year gets room and a decade still fits) and sized by its lines. Older files are brighter; the side past a year is shaded. Orphaned files wear an accent ring. A dormant package says so under its name, in the accent. Strata shows whether a package's cold is a few old files or a whole layer of them.
- **Warm and cold.** A bar per package, split at a center axis: lines changed within a year to the left, cold lines to the right by band, the oldest outermost, the orphaned part in the accent at the far end. Every row shares one scale, so this is the form that says *how much*.

The **Tests** switch in the stage's corner adds test files to both forms. It's off by default and remembered in your browser.

With nothing selected, the inspector leads with the share of source lines that are cold, then the findings (how much is cold and how thin, dormant packages, orphaned files and where most of them are, the longest-woken file, what was left out) and the coldest packages. The **table** (`T`) lists every source and test file, oldest first, with its band, lines and, for an orphaned file, who it was left by. Selecting a file shows its age in the file card's *Flagged by* list: "Last changed 3.4 years ago · orphaned".

The classic dashboard still has its Age Map histogram (`/classic/#preset=age-map`) and Stale Files list (`/classic/#preset=dead-code`).

## Limits

- **A move counts as a change.** Renames aren't followed (see [Renames](./renames)): a file moved last month reads as changed last month, even if its content is years old. So a package that was just moved looks fresh, not dormant.
- **Orphaned needs a person.** A file whose only changes came from bots, AI agents or sweeping commits (more than 20 files at once) has no recorded author, so it's never called orphaned, even though no person is around who knows it.
- **"Inactive" means no commits.** Someone who stopped committing but still reviews code, or moved to another repository, counts as gone.
- **If the older history can't be read** (a timeout on a huge repository, for instance), ages cover the analysis window only, files untouched in it are missing, and the lens says so. `--git-timeout` raises the limit.
- **Shallow clones** only know the history they fetched.

## In the report

`report.ageMap`:

| Field | What it holds |
|---|---|
| `files[]` | Every tracked file: `lastCommitDate`, `ageInDays`, and classic's window-relative `status` tier. `orphaned` and `orphanedAuthors` (up to three names, most changes first) on orphaned files; `wokeAfterDays` on woken ones. |
| `dormantPackages[]` | `package`, `sourceFiles`, `newestAgeDays`. |
| `source` | `history` (ages from all of history) or `window` (the older history couldn't be read). |
| `medianAgeDays`, `thresholds`, `summary` | Classic's histogram tiers, shares of the analysis window. |

Reports before this version carried `staleFiles` and `ancientFiles` lists; they're `files` filtered by `status` now.
