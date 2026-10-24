---
title: Coupling
description: Which packages change together, what changes with a file, and how far a change to it usually reaches.
---

# Coupling

**Coupling** reads the commit history for files that change together, and asks three questions:

- **Which packages are coupled in practice?** Two packages whose files keep changing in the same commits depend on each other, whatever their dependency graph declares.
- **When I change this file, what else will I touch?** A file's partners: the files that change with it, and how often.
- **How far does a change to this file usually reach?** Its *blast radius*: the number of other files its commits usually change.

It absorbed the old **Blast Radius** analyzer, which now lives in Coupling's inspector.

## How it's measured

1. **Commits, not imports.** Two files are coupled when they change in the same commit. That catches dependencies no import shows: a protocol split across a client and a server, copies of one file in several packages, a config file every feature touches.
2. **Sweeping commits are left out.** A commit touching more than 20 files (a rename across the codebase, a reformat, a dependency bump) would couple everything with everything. The same line as [fix rate](./fix-rate) and Parallel Dev.
3. **Fixtures and generated files are left out**, as they are for ownership: a snapshot updating with code isn't coupling. Tests stay.
4. **File pairs** need 3 shared commits, and 30% of the quieter file's commits.
5. **Package links** count the commits that changed a file in both packages, and that count as a share of the smaller package's commits. Packages are the repository's own: read from its workspace files (`pnpm-workspace.yaml`, `package.json` workspaces, `Cargo.toml`, `go.work`, Nx), else `packages/*`, `apps/*`, `libs/*` and `services/*` by convention, else top-level folders.
6. **Families** are files that change together *both* ways: 4 shared commits, and 60% of the *busier* file's commits. A file that rides along with a busy one (all of its own commits, a sliver of the other's) isn't family.
7. **Blast radius** is the *median* number of other files a file's commits changed, for files with **8 or more** commits. Below that, one wide commit would decide the number, so those files get none.

### Why a median, and why 8 commits

The old Blast Radius averaged "other files in the same commit" over however few commits a file had, then scaled the result to the widest file. On React, every one of its top 100 files had three commits or fewer, and the top ten were each touched once, by one 27-file commit. A median over 8 or more commits isn't moved by one wide commit, and a 12 means 12 files on any repository.

## In Atlas

Coupling is a lens of **Ownership & Risk**.

- **Boundaries.** The busiest packages around a ring, sized by commits. A chord between two packages is as wide as the commits that changed both, and brighter the bigger their share of the smaller package's commits. Hover a chord for the file pairs behind it; select a package to light its chords and see what it shares with each partner.
- **A file's ripple.** Select a file and the ring gives way to its ripple: the file in the middle, each partner nearer the more often it changes with it, grouped by package, the ones in another package in the accent. The packages stay faintly in place, so the partners grow out of their own package.
- **The inspector.** With nothing selected: how many files usually change with 10 or more others, a histogram of every rated file by its median, the five widest, and how many files have too few commits to say. With a file selected, its *Blast radius* section shows its median and its commits by how many other files each changed.
- **The table** (`T`) lists every file with a blast radius, widest first, with the file it changes with most.

The ring leaves out the repository root and dot-folders (`.github`, `.vscode`). Release commits bump `CHANGELOG.md` beside a package's `package.json`, and CI config changes with everything, so on most repositories the strongest "coupling" was the root and a package. The report keeps those links; the lens says how many it left off.

## Reading the findings

- **The strongest link**: two packages, how many commits changed both, and the file pair most behind it.
- **A family across packages**: files that always change together in several packages. One change, made in several places: copies to merge, or code to generate.
- **The widest changes**: how many files usually drag 10 or more others along.

On React's last year: `react-dom` and `react-dom-bindings` changed together in 34 commits; five copies of `ReactFlightDOMServerNode.js` in five `react-server-dom-*` packages change together; 9 of the 44 files with enough commits usually change with 10 or more others, all `ReactFeatureFlags` forks.

## Limits

- **Coupling isn't causation.** Two files changing together may share a feature, not a dependency. The file pairs behind a link say which.
- **Commit habits matter.** A team that squashes a whole feature into one commit couples everything in it; one that commits file by file couples little.
- **Renames aren't followed.** A file's history starts at its current path (see [Renames](./renames)).

## In the report

`report.coupling`: `pairs` and `fileProfiles` (file pairs), `packageCommits`, `packages` (package links with their `filePairs`) and `families`. `report.blastRadius.files[]`: `medianCoChanged` and `footprint` on files with `minCommits` commits (`rated` counts them); classic's `avgCoChangedFiles` and `blastScore` stay.
