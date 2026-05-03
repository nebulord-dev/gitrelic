# Commit Timing

The Commit Timing analyzer answers two questions: **when does this team work?** and **is anyone grinding?** It measures every commit's hour-of-day and day-of-week (in the author's local time, parsed from the commit's ISO timezone offset) and surfaces two stress signals: late-night work (11pm–4am) and weekend work (Sat / Sun).

## What it measures

Every commit contributes to a 7×24 hour-day matrix. Per file (and per author) we track:

- **Late-night percent** — commits between 11pm and 4am as a share of total
- **Weekend percent** — commits on Saturday or Sunday as a share of total

Per-file stress score:

```
stressScore = round(lateNightPercent × 0.6 + weekendPercent × 0.4)
```

Late-night is weighted more heavily because it's a stronger crunch / burnout signal — weekend work can be voluntary side-projects, while 3am commits typically aren't.

A file needs at least 3 commits to get a score. An author needs at least 5 commits to appear on the contributor leaderboard. Both floors exclude noise from one-off commits.

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
