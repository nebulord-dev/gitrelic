---
title: Ownership
description: Who owns each package, how much of it rests on one person, and how many people the code depends on.
---

# Ownership

::: info Ownership replaces Bus Factor, Knowledge Silos and Ghost Files
In Atlas, ownership is measured **per package**, where the numbers are large enough to mean something. Classic's per-file Bus Factor rated 809 of React's files "critical" (one author), and 746 of those had been changed exactly once: one person wrote them because one person touched them. Classic still shows its Bus Factor, Knowledge Silos and Ghost Files views at `/classic/#preset=bus-factor`, `knowledge-silos` and `ghost-files`.
:::

**Ownership** answers one question: **who owns what?** For every package with enough history, it shows who made the most of its commits, how concentrated that is, and whether that person is still around. At the top sits the **truck factor**: how many people would have to leave before most of the code has nobody left who wrote it.

## Quick read

- **The map.** Each cell is a package, sized by its commits and colored by its top contributor. The stronger the color, the more of the package is theirs: faint when nobody made 30% of the commits, full at 75% or more. A **dashed outline** means that person has made no commit in 90 days.
- **The lens card** (right side) leads with the truck factor and the people behind it, then the findings: packages whose top contributor went quiet, packages that rest on one person, how many are shared, and what was left off the map.
- **Hover** a cell for its path, its commits, its top four contributors with their shares, and its flags.
- **Select a person** to dim the packages they don't top.
- **The Mosaic** (the corner toggle) shows every share, not just the top one: one column per package, as wide as its commits, split from the bottom by each person's share (people past the six colors stack as one grey block on top).
- **What if someone left?** In the Mosaic, select a person (click their segment, their name in the color key, or search). Their share fades out, each package nobody else knows gets a strip in the accent color under its column, and a line above the chart counts them. Their person card says the same: how many packages they top, and how many would have nobody else.
- **The table** (`T`) lists every package: commits, top contributor and share, how many people know it, its own truck factor, and its flags.

## How it's measured

Ownership reads the commits in the analysis window (`--since`, 12 months by default).

- **Packages** come from the repository's own workspace files (pnpm, npm, lerna, Cargo, `go.work`, Nx), else `packages/*`, `apps/*`, `libs/*` and `services/*`, else the top-level folder. The map leaves out the repository root and top-level dot-folders (`.github`): release commits and CI config would make whoever cuts releases their "owner".
- **A commit counts once per package**, however many of its files it touches. Deleted and renamed files count too: that work happened in the package.
- **A package needs 10 or more human commits** to be rated. Fewer, and one person owns it by default.
- **The map shows the 60 busiest packages.** Past that the cells are too small to read; the rest are still in the findings and the table.
- **Bots never count** (dependabot, renovate, semantic-release, GitHub Actions). AI agents' own commits do.
- **Fixtures and generated files are left out**, unless you pass `--include-fixtures`.
- **Identities are merged** before counting (`.mailmap`, case variants, GitHub noreply addresses): see [Contributors](/analyzers/contributors).

### The rules

| Term | Rule |
|---|---|
| **Top contributor** | The person with the most commits in the package. |
| **Owner** | The top contributor, when they have 30% or more. Below that the package is **shared**. |
| **Rests on one person** | The top contributor has 75% or more. |
| **Knows it** | 10% or more of the package's commits, and at least 3 of them. |
| **Quiet** | No commit in the 90 days before the last commit analyzed. |

### The truck factor

The truck factor follows Avelino et al., *A novel approach for estimating truck factors* (ICPC 2016):

1. For each file with **two or more human commits**, work out its authors by *degree of authorship*: who changed it first, how many changes each person made, and how many changes everyone else made. Someone who touched a file once, among many changes by another person, isn't one of its authors.
2. Remove the person who authors the most files, then the next, until **more than half** the files have no author left.
3. The number of people removed is the truck factor.

It's computed for the repository and for each package. Files changed only once are left out, because otherwise the number mostly rewards whoever touched the most files once. Only the window's history is read, so "changed it first" means first within the window.

## Reading it

- **A package in strong color** rests on one person. That's normal for a young package or a one-person tool, and a risk for code many people depend on.
- **A faint package** is shared: nobody made 30% of its commits. That's often healthy, but nobody may feel responsible for it either.
- **A dashed outline** is the one to act on: the person who did most of the work has stopped committing. Find out who takes it over. This is also the lens's **badge**, which fires at one such package.
- **One color everywhere** means one person owns everything, which is correct for a solo project. The lens says so instead of leaving the map to imply it.

## Limitations

- **Commits, not knowledge.** Ownership counts who committed, not who understands the code. A reviewer who knows a package well but rarely commits to it doesn't show up.
- **The window.** On the default 12 months, someone who wrote a package years ago and stopped doesn't appear. Widen `--since` to see older ownership.
- **Split identities.** Two emails with different names (a nickname, a bare handle) still count as two people until they're merged; add them to `.mailmap`.
- **Pre-1.0.** The thresholds above may change.

## Related analyzers

- **[Coupling](/analyzers/coupling)**: which packages change together. A coupled pair with different owners means every change needs two people.
- **[Contributors](/analyzers/contributors)**: who is active, who has gone quiet, and where each person works.
- **[Age](/analyzers/age-map)**: files nobody has touched in a year, and the ones nobody left changed.
- **[Cursed Files](/analyzers/cursed-files)**: per-file risk, which still reads file-level ownership as one of its reasons.
