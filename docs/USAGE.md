# GitLore — Usage Guide

Practical tips for getting the most out of GitLore across different repo types and use cases.

---

## All Flags

| Flag | Short | Default | Description |
|------|-------|---------|-------------|
| `--path <path>` | `-p` | `cwd` | Path to the git repository to analyze |
| `--since <date>` | `-s` | `"12 months ago"` | Only analyze commits since this date. Use `all` for full history |
| `--branch <branch>` | `-b` | current branch | Analyze a specific branch instead of the checked-out one |
| `--shame` | — | off | Show the commit message forensics / shame leaderboard panel |
| `--web` | — | off | Open the interactive web dashboard after analysis |
| `--json` | — | off | Output raw JSON to stdout (non-interactive, good for scripting) |

### `--since` accepts natural language or ISO dates

```bash
gitlore --since "6 months ago"
gitlore --since "2023-01-01"
gitlore --since "1 year ago"
gitlore --since all            # full repo history, no time limit
```

---

## When to Use Each Mode

### Quick scan — default

```bash
gitlore --path ~/projects/my-app
```

Best for: a fast first look at any repo. Gives you churn hotspots, cursed files, contributor activity, and bus factor in under 10 seconds. Start here.

---

### Deep history — `--since all`

```bash
gitlore --path ~/projects/my-app --since all
```

Best for: repos older than 1–2 years where the real curse accumulated over time. The default 12-month window can miss files that were actively broken years ago and left that way. Use `--since all` the first time you analyze a legacy codebase.

**Note:** On very large repos (10,000+ commits), this takes longer — expect 15–30 seconds.

---

### Shame audit — `--shame`

```bash
gitlore --path ~/projects/my-app --shame
gitlore --path ~/projects/my-app --since all --shame
```

Best for: retrospectives, pre-refactor assessments, or when you suspect certain files are repeatedly broken. The shame leaderboard surfaces files with a high ratio of `revert`, `hotfix`, and `oops` commits relative to their total commit count.

**Tip:** Combine with `--since all` for the full picture — a file that was reverted 5 times in year 2 won't appear in the last-12-months window.

**Interpreting the score:** A shame score of 30 on a file with 200 commits is meaningful. A score of 80 on a file with 3 commits is less so — look at `shame commits` count alongside the score.

---

### Web dashboard — `--web`

```bash
gitlore --path ~/projects/my-app --web
```

Best for: sharing with the team, presenting to a tech lead, or exploring the Age Map and Contributors tabs which are harder to read in the terminal. The dashboard opens at `http://localhost:7777` and stays running until you kill the process.

**Tip:** Use `--web` when you want to share findings. Take a screenshot of the Overview tab — it's the most immediately readable summary.

---

### Scripting and CI — `--json`

```bash
gitlore --path ~/projects/my-app --json > report.json
gitlore --path ~/projects/my-app --since all --json | jq '.forensics.shameLeaderboard[0]'
gitlore --path ~/projects/my-app --json | jq '.cursedFiles | length'
```

Best for: integrating into CI pipelines, writing scripts that track health over time, or extracting specific metrics. The JSON output is the full `GitloreReport` — every score, every file, every contributor.

**Useful `jq` queries:**
```bash
# Top cursed file
jq '.cursedFiles[0].file' report.json

# Shame leaderboard summary
jq '.forensics.summary' report.json

# Files with critical bus factor
jq '[.busFactors.criticalFiles[].file]' report.json

# Total commits analyzed
jq '.meta.totalCommits' report.json
```

---

### Analyzing a specific branch — `--branch`

```bash
gitlore --path ~/projects/my-app --branch develop
gitlore --path ~/projects/my-app --branch main --since "3 months ago"
```

Best for: comparing health between branches, or analyzing a long-running feature branch before merging. Useful to run on both `main` and a release candidate to see if churn patterns have shifted.

---

## Tips for Large Active Repos

**Start with `--since "3 months ago"` to cut through noise.** On a busy repo with 50+ engineers, the last 12 months default may surface files that are "hot" simply because they're central — configuration files, shared utilities. Narrowing the window to 3 months shows you what's actively on fire *right now*.

**Bus factor is usually the most actionable finding.** Churn is interesting, but "this file has been touched by 1 person in 300 commits and that person left 6 months ago" is something you can act on immediately. Look at the Bus Factor Risk panel first on any multi-person repo.

**Shame score is most useful with full history on large teams.** In a team of 5, `fix` commits are expected and the ratio stays noisy. With 20+ engineers over 3+ years, files with 10+ `revert` commits stand out clearly — those are usually the files everyone knows are fragile but nobody has time to rewrite.

**The Cursed Files panel is the synthesis.** A file appearing there means it has multiple bad signals at once: high churn, concentrated ownership, and/or shame. That's where to start any refactoring or tech debt conversation.

---

## Tips for Young Repos (< 6 months old)

GitLore's thresholds are proportional to repo age, so young repos won't produce false positives from age-based signals. However:

- **Don't use `--since` narrowly.** With a young repo you want all commits — run without `--since` or use `--since all`. They're equivalent for a repo where everything happened in the last few months.
- **Bus factor findings are the most reliable early signal.** Even with 50 commits, if 1 person owns 90% of a critical file, that's already a risk.
- **Shame scores on young repos can be noisy.** Early commits often have exploratory messages. Give it 6+ months of history before drawing conclusions from shame data.

---

## Example Workflows

### First time on an unfamiliar codebase

```bash
# Full history scan with shame, web dashboard for exploration
gitlore --path ~/projects/legacy-app --since all --shame --web
```

### Pre-sprint health check

```bash
# Last 3 months, terminal only, quick scan
gitlore --path ~/projects/my-app --since "3 months ago"
```

### Pre-refactor assessment

```bash
# Full history, shame enabled, export JSON for record-keeping
gitlore --path ~/projects/my-app --since all --shame --json > before-refactor.json
```

### Tracking health over time in CI

```bash
# Run weekly, store JSON, compare cursed file count over time
gitlore --path . --since all --json > gitlore-$(date +%Y-%m-%d).json
```

### Sharing findings with the team

```bash
# Web dashboard stays open for everyone to browse
gitlore --path ~/projects/my-app --since all --web
```
