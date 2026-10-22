# Commit Timing

The Commit Timing analyzer answers two questions: **when does this team work?** and **is anyone grinding?** It measures every commit's hour-of-day and day-of-week (in the author's local time, parsed from the commit's ISO timezone offset) and surfaces two stress signals: late-night work (11pm–5am: commits from 23:00 through 04:59) and weekend work (Sat / Sun).

## What it measures

Every commit contributes to a 7×24 hour-day matrix. Per file (and per author) we track:

- **Late-night percent** — commits from 11pm to 5am (23:00 through 04:59) as a share of total
- **Weekend percent** — commits on Saturday or Sunday as a share of total

Per-file stress score:

```
stressScore = round(lateNightPercent × 0.6 + weekendPercent × 0.4)
```

Late-night is weighted more heavily because it's a stronger crunch / burnout signal — weekend work can be voluntary side-projects, while 3am commits typically aren't.

A file needs at least 3 commits to get a score. An author needs at least 5 commits to appear on the contributor leaderboard. Both floors exclude noise from one-off commits.

## Which code changes off-hours

Per-file stress scores are rated from three commits, so one 2am commit in a three-commit test file scores 67% late night: on React's last 12 months, every top "stressed" file had three or four commits. The report therefore also asks the question at the package level, with enough commits to answer it:

- A commit is **off-hours** when it's late night or on a weekend, in the author's local time.
- **Packages** are `packages/<name>` in a `packages/` monorepo, otherwise the top-level directory. A commit counts once in each package it touches.
- **Sweeping commits** (more than 20 files) and **bot commits** are left out, of the repo's rate and of every package's count: a 300-file dependency bump at 1am isn't three hundred files changing at night.
- A package with at least **10 commits** is tested against the repo's own off-hours rate, the same test [Fix rate](/analyzers/fix-rate) uses: it's **above chance** when that many off-hours commits would happen by chance less than 2.5% of the time.

On React's last 12 months, 10.4% of commits are off-hours. `react-server` (15 of 66, 23%) and `react-dom` (16 of 86, 19%) are above chance; the compiler is the most regular package (5 of 87). The test adapts to each team: a repo that works evenings has a higher rate, and only packages unusual for that team stand out.

## In Atlas: the punch card

Atlas (`gitrelic --ui atlas`) draws Commit Timing as a **punch card** under **Team & Activity**: days down (Monday first, the weekend last), hours across, each cell a day and hour's commits in their authors' local time, shaded by how many (log scale, so a few late commits still show beside a busy afternoon).

- **Off-hours cells take the risk color**, over a faint band marking where off-hours are: the weekend's rows and the 11pm–5am columns. Working hours stay grey.
- **Select a package or a file** (from the inspector, the table, another lens or the Overview) and the grid redraws from its own commits, with its off-hours in the accent: where "this module changes at 2am" shows up. A selection's hours leave out sweeping and bot commits, as the package test does, so the lit cells add up to the count beside them.

Hover a cell for the day and hour, its commits and their share of the repo's, and, with a selection, how many of them touched it.

With nothing selected, the inspector leads with the off-hours share. Its findings name the packages above chance, when the team works (the share of commits on weekdays 9am–7pm, and the busiest hour), and the most regular package, when one keeps well under the repo's rate. A list of the packages with the most off-hours follows; each selects its package.

The detail table (`T`) lists every tested package: commits, off-hours, the share, what chance allows and whether it's above chance, tiered from below the repo's rate to above chance at twice the rate.

### People who work off-hours regularly

A share of someone's commits can't tell one crunch weekend from every Saturday: on React's last 12 months, Josh Story's six weekend commits were all from one weekend, 1 of the 11 weeks he committed. So the report measures **regularity** instead, per person (in their local time):

- **Active weeks** — Monday-start weeks with any commit.
- **Weekend weeks** and **late-night weeks** — of those, the weeks with a weekend commit, or a late-night one.
- **Late nights** — distinct nights with a late commit (a 1am commit counts toward the evening before).

Someone works off-hours **regularly** when weekend (or late-night) commits fall in **at least a third of their active weeks, over at least 6 active weeks**. Bots are never named.

In Atlas, the Commit Timing lens's **Off-hours, by person** list names every regular first, each with a line like "weekends in 9 of 12 active weeks", then fills up to five with the people who have the most off-hours (among those with 6 or more active weeks), and says so when nobody is regular (as on React). Hover a cell of the punch card to see who committed in it ("by Ann 3, Joe 1 +2 more"; for a selected package, its own commits). Select a person, from that list or anywhere else, and the punch card redraws from every commit they made, their off-hours in the accent: someone working most Saturdays lights up the Saturday row. Every person card shows the same measure ("weekends in 5 of 29 weeks · 6 late nights"), flagged when it's regular.

Read it as a reason to check in, not a verdict: times come from each author's own machine, so travel or a clock set to UTC can look like night work, and weekend commits can be a choice, especially in open source.

## How to read the punch card

The default hero is a **7×24 heatmap** — rows are days (Sun–Sat), columns are hours (0–23). Each cell's intensity is the repo-wide commit count for that (day, hour) bucket, **log-scaled** so rare-but-meaningful off-hours commits don't get washed out next to a busy weekday-afternoon peak.

Two things make stress visible without breaking the unified color ramp:

- Weekend rows (Sat, Sun) get a subtle warning-color tint behind them
- Late-night columns (23, 0–4) get the same tint
- The intersection (Sat 3am, Sun 1am, etc.) gets the tint twice and is visibly the worst quadrant

Hover any cell for the count + share-of-total %.

## How to read the stress trend

The alt hero is a **3-layer disjoint stacked bar by month**. Each bar's three layers (bottom → top):

- **`weekend-late-night`** — both criteria (worst). Critical / red.
- **`single-criterion`** — exactly one criterion. Warning / orange.
- **`healthy`** — neither. Neutral.

Bars sum cleanly to total commits in that month. The chart answers "is off-hours pressure trending up?" via the temporal axis the punch card cannot show.

## The KPI panel

The bottom panel pivots to the *people* axis — commit timing is fundamentally about humans, not files. The big number is the count of files with `stressScore ≥ 70` (the `High Stress` band). The finding under it lists the top-3 stressed contributors:

```
<full git author name> · Late: N% · Weekend: K% · M commits
```

If two contributors share an identical full git-name string, the analyzer disambiguates with the email's local-part (e.g. `Alex Lee (alex)` / `Alex Lee (alee)`).

The subline carries the repo-aggregate `X% late-night · Y% weekend across the analyzed window`. The `Where they live` extras section is a top-5 directory rollup of the high-stress files — empty on healthy repos, which is the correct signal.

## What earns a flag

| Signal | Tier |
|---|---|
| `highStress = 0` | Healthy |
| `highStress` 1–4 | Moderate |
| `highStress ≥ 5` | High Stress |

Per-author stress band for the metrics strip:

| Per-author `stressScore` | Counted in `Stressed Authors` slot |
|---|---|
| `< 50` | No |
| `≥ 50` | Yes |

## See also

- [Shame](/analyzers/shame) — keyword-flagged commits (revert / hotfix / fix) often correlate with crisis stress
- [Hotspots](/analyzers/hotspots) — high-churn × high-LOC files often coincide with stress patterns
