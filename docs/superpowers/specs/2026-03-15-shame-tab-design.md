# Shame Tab — Web Dashboard Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Scope:** New "Shame" tab in the web dashboard (`apps/web/src/components/Dashboard.tsx`)

## Overview

Add a seventh tab to the web dashboard that surfaces commit message forensics data. The forensics analyzer already produces `ForensicsReport` on every `CodeloreReport` — this is purely a UI addition. The tab uses a list + side panel layout (matching the Coupling tab pattern) with color-coded keyword severity tags.

## Data Source

All data comes from `report.forensics` (`ForensicsReport`). No new analyzers, types, or core changes needed.

Key fields consumed:
- `forensics.shameLeaderboard: FileForensics[]` — top 10 files by shame score
- `forensics.totalShameCommits: number` — repo-wide count
- `forensics.summary: string` — human-readable summary
- Per-file `FileForensics`:
  - `shameScore: number` (0–100)
  - `shameCommitCount: number`
  - `dominantKeywords: string[]`
  - `topShameCommits: ShamefulCommit[]` (up to 3, each with `hash`, `message`, `shamePoints`, `keywords`)

## Tab Registration

- Add `'shame'` to the `Tab` union type
- Tab config: `{ id: 'shame', label: 'Shame', emoji: '⚑' }`
- Position: after Coupling (7th tab, last position)

## Layout

### Summary Bar

One line at the top showing `forensics.summary` text and total shame commit count. Matches how other tabs open with their summary string.

### Two-Column Split

Same proportions as `CouplingTab` (`w-1/3` + `flex-1`).

**Left panel — Leaderboard:**
- Scrollable list of files from `forensics.shameLeaderboard`
- Each row: file path (truncated, monospace) + shame score
- Click to select (highlighted with `bg-purple-900 text-purple-300`, matching the shame/purple theme)
- Max height with overflow scroll (`max-h-96 overflow-auto`)

**Right panel — Detail view:**
- **Header**: file name + score displayed prominently (e.g., "82/100")
- **Context line**: "N shame commits out of M total" — cross-reference with `report.churn.files` to get the file's total commit count. If the file has no match in `churn.files`, show only "N shame commits" without the total.
- **Keyword tags**: `dominantKeywords` rendered as color-coded badges (see Keyword Severity Tiers below)
- **Top shame commits**: up to 3 from `topShameCommits`, each showing:
  - The commit message (monospace, in a subtle container)
  - The triggered keyword highlighted inline
  - Shame points for that commit (dimmed)

**Default state** (no file selected): "Click a file to see its shame history" in muted text.

### Empty State

When `forensics.shameLeaderboard` is empty, show centered positive message:
- Large emoji: `✨`
- Primary text: "No commit message red flags detected"
- Secondary text: "Clean commit history — no shame keywords found"
- Matches the pattern in `CursedTab` and `CouplingTab` empty states.

## Keyword Severity Tiers

New helper function `shameKeywordBadge(keyword: string): string` returning Tailwind classes. Matching is case-insensitive (lowercase the input before comparing) since the forensics analyzer produces lowercase keywords, but defensive casing avoids future breakage.

| Tier | Keywords | Colors |
|------|----------|--------|
| Critical | `revert`, `hotfix`, `oops`, `broken` | `bg-red-950 text-red-400` |
| Moderate | `hack`, `workaround`, `todo`, `temporary` | `bg-amber-950 text-amber-400` |
| Mild | `fix`, `typo`, `patch`, `fixup` | `bg-stone-800 text-stone-400` |
| Fallback | anything else | `bg-gray-800 text-gray-400` |

## Tone

Playful but professional. The tab name is "Shame" (not "Commit Message Forensics"). The data presentation is diagnostic — scores, keywords, commits — but the framing has personality. The purple color theme (consistent with the CLI's `ShamePanel`) distinguishes it from the red/danger tone of Cursed Files.

## Files Modified

- `apps/web/src/components/Dashboard.tsx` — add `ShameTab` component, update `Tab` type and tabs array, add `shameKeywordBadge` helper

## Not In Scope

- CLI changes (already has `--shame` panel)
- Overview tab shame summary card (future enhancement)
- Shame trend over time visualization (separate backlog item)
