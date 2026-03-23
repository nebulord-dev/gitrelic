# Hotspot Health Sentiment — Design Spec

**Date:** 2026-03-22
**Status:** Approved

## Problem

The hotspot UI (CLI and web) presents all entries as warnings regardless of whether they're actually concerning. A file with high churn but low complexity is healthy — it just means the team actively works on well-structured code. The current ranked leaderboard with uniform red/yellow styling makes everything feel alarming. Tornhill's key insight: "If all hotspots have low complexity, you're in great shape."

## Solution

Three rendering-layer changes. No new analyzers, types, or data collection.

### 1. Health Assessment Narrative

A one-sentence verdict based on the category distribution of the top 10 hotspots, shown above the file list in both CLI and web.

**Logic:** Count entries with `category === 'critical'` and `category === 'warning'` in `report.hotspots.topHotspots` (the full curated array, not sliced).

| Condition | Verdict | Color |
|---|---|---|
| 0 critical, ≤2 warning | "Your most-changed files have manageable complexity — active code is well-structured." | Green |
| 0 critical, 3+ warning OR 1–3 critical | "A few hotspots show high churn combined with high complexity — worth investigating." | Yellow/Amber |
| 4+ critical | "Complexity is concentrating where you work most — N of your top hotspots are critical." | Red |

### 2. Per-Entry Sentiment Coloring

Recolor hotspot entries so the visual reads as a diagnostic (healthy vs dangerous) rather than a uniform warning list.

**Mapping (existing category → sentiment color):**

| Category | Current color | New color | Meaning |
|---|---|---|---|
| `critical` | Red | Red | High churn + high complexity — genuine concern |
| `warning` | Yellow | Yellow/Amber | Worth watching |
| `moderate` | Cyan | Green | Active but manageable |
| `low` | Gray | Green | Low activity, healthy |

**Affected functions:**
- CLI: `getHotspotColor()` — change `moderate` return from `'cyan'` to `'green'`, `low` from `'gray'` to `'green'`
- Web: `hotspotBar()` — change `moderate` from `bg-cyan-700` to `bg-green-700`, `low` from `bg-gray-700` to `bg-green-700`
- Web: `hotspotBadge()` — change `moderate` from `bg-cyan-950 text-cyan-400` to `bg-green-950 text-green-400`, `low` from `bg-gray-800 text-gray-400` to `bg-green-950 text-green-400`
- Web: `hotspotDot()` — change `moderate` from `bg-cyan-500` to `bg-green-500`, `low` from `bg-gray-600` to `bg-green-500`

### 3. "All Clear" State

When zero files in `report.hotspots.topHotspots` (full array) have `critical` or `warning` category, replace the hotspot leaderboard with a positive message.

**CLI:** Single green line: `"✓ No concerning hotspots — your active code is well-structured"`. Skip the file list.

**Web:** Centered layout matching existing empty states (Coupling, Shame tabs): emoji + green text + gray subtitle.

## Files Changed

| File | Changes |
|---|---|
| `apps/cli/src/components/App.tsx` | `HotspotPanel`: add health narrative, add all-clear early return. `getHotspotColor`: shift moderate/low to green. |
| `apps/web/src/components/Dashboard.tsx` | `ChurnTab`: add health narrative, add all-clear early return. `hotspotBar`, `hotspotBadge`, `hotspotDot`: shift moderate/low to green. |

## What's NOT In Scope

- No changes to `@gitlore/core` — no new analyzers, types, or scoring logic
- No changes to hotspot clustering (Root Causes panel) — that has its own color scheme by dimension
- No new dependencies
