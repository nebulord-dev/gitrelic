# GitLore — Web Dashboard Design Spec

> Reference document for Claude Code. Drop this in your project root or link it in your Claude Code session so it informs all frontend work.

---

## Design philosophy

Minimal, warm, and elegant. Think "thoughtful developer tool" — not corporate SaaS. The aesthetic draws from editorial design and retro computing, with generous whitespace, thin borders, and a muted earthy palette. Every element earns its place. No decoration for decoration's sake.

**Key principles:**

- Information density over chrome — show data, not containers
- Synthesize signals, don't silo them — one file row should tell its full story
- Progressive disclosure — dashboard first, drill-downs on click
- Light/dark theme support as a first-class concern

---

## Color palette

### Light theme

```css
:root {
  --bg:       #F5F2EC;   /* warm off-white page background */
  --bg2:      #EEEBE4;   /* surface/card background */
  --bg3:      #E6E3DC;   /* subtle emphasis, hover states */
  --fg:       #1A1A18;   /* primary text */
  --fg2:      #6B6860;   /* secondary text */
  --fg3:      #9C9990;   /* tertiary/muted text, labels */
  --border:   #D4D1C8;   /* primary borders */
  --border2:  #C2BFB6;   /* emphasized borders */

  /* Semantic accent colors — retro, muted, not neon */
  --red:       #C4503A;
  --red-bg:    #F5E6E2;
  --red-fg:    #8A3122;

  --amber:     #B87A1A;
  --amber-bg:  #F5EDD8;
  --amber-fg:  #7A5010;

  --teal:      #1A8C6A;
  --teal-bg:   #E0F0E8;
  --teal-fg:   #0E5E48;

  --blue:      #2E6CB8;
  --blue-bg:   #E2EDF8;
  --blue-fg:   #1A4478;

  --purple:    #6B52B0;
  --purple-bg: #EBE6F5;
  --purple-fg: #3E2E78;
}
```

### Dark theme

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg:       #1C1B18;
    --bg2:      #252420;
    --bg3:      #2E2D28;
    --fg:       #E4E1D8;
    --fg2:      #9C9990;
    --fg3:      #6B6860;
    --border:   #3A3830;
    --border2:  #4A4840;

    --red:       #E06B55;
    --red-bg:    #3A2420;
    --red-fg:    #F0A090;

    --amber:     #E0A030;
    --amber-bg:  #3A3018;
    --amber-fg:  #F0C870;

    --teal:      #30B888;
    --teal-bg:   #1A3028;
    --teal-fg:   #80DDB8;

    --blue:      #5090D0;
    --blue-bg:   #1A2838;
    --blue-fg:   #90C0E8;

    --purple:    #9078D0;
    --purple-bg: #28203A;
    --purple-fg: #C0B0E8;
  }
}
```

### Color usage rules

- **Red** → critical severity, high-risk signals
- **Amber** → warnings, medium severity, temporal signals
- **Teal** → healthy/fresh, positive signals, ok status
- **Blue** → coupling relationships, structural signals
- **Purple** → ownership, contributor-related signals
- **Gray tones (fg, fg2, fg3)** → all neutral text hierarchy
- Badge text always uses the `*-fg` variant on the `*-bg` background — never raw black/white on colored backgrounds

---

## Typography

### Font stack

```css
/* Primary — system sans-serif, clean and neutral */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

/* Monospace — for file paths, scores, numbers, code */
--mono: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
```

### Scale

| Element              | Size   | Weight | Color    | Font  |
|----------------------|--------|--------|----------|-------|
| Page title (repo)    | 18px   | 500    | --fg     | sans  |
| Section labels       | 11px   | 400    | --fg3    | sans, uppercase, letter-spacing: 0.08em |
| Table headers        | 11px   | 400    | --fg3    | sans, uppercase, letter-spacing: 0.06em |
| Body text            | 13px   | 400    | --fg     | sans  |
| Secondary text       | 12px   | 400    | --fg2    | sans  |
| File names           | 12px   | 400    | --fg     | mono  |
| File paths           | 11px   | 400    | --fg3    | sans  |
| Stat numbers         | 22px   | 500    | varies   | sans, letter-spacing: -0.03em |
| Badge text           | 10px   | 500    | *-fg     | sans  |
| Scores/numbers       | 12px   | 400    | --fg     | mono  |
| Subtitle (git arch.) | 13px   | 400    | --fg3    | mono  |

### Rules

- No bold in body text — weight 500 only for headings, stat numbers, and badge text
- Monospace for anything that could be copy-pasted: file paths, scores, commit counts
- Uppercase + letter-spacing for section labels and table headers only
- Negative letter-spacing on large numbers for tighter feel

---

## Layout & spacing

### Page structure

```
┌─────────────────────────────────────┐
│  Header: repo name, subtitle, meta  │
├─────────────────────────────────────┤
│  Nav: Dashboard | Coupling | Age    │
├─────────────────────────────────────┤
│  Stats bar: 4 metric cells          │
├─────────────────────────────────────┤
│  Hotspot table (ranked files)       │
├─────────────────────────────────────┤
│  Two-col: Contributors | Clusters   │
├─────────────────────────────────────┤
│  Age distribution bar               │
├─────────────────────────────────────┤
│  Footer: methodology note           │
└─────────────────────────────────────┘
```

### Three pages total

1. **Dashboard** (main) — synthesized view of all signals
2. **Coupling graph** — interactive force-directed or arc diagram of file coupling relationships
3. **Age map** — full file list grouped by freshness category

### Spacing tokens

```css
/* Vertical rhythm */
--space-xs:  0.5rem;   /* 8px — tight internal gaps */
--space-sm:  0.75rem;  /* 12px — between related items */
--space-md:  1rem;     /* 16px — standard padding */
--space-lg:  1.5rem;   /* 24px — section gaps */
--space-xl:  2rem;     /* 32px — major section breaks */

/* Component internal */
padding-card:    14px 16px;
padding-badge:   2px 7px;
padding-cell:    10px 0;       /* table cells — vertical only, no horizontal */
```

### Borders

```css
/* All borders are thin and muted */
border-width: 0.5px;
border-color: var(--border);
border-style: solid;

/* Dividers between sections */
hr {
  border: none;
  border-top: 0.5px solid var(--border);
  margin: 1.5rem 0;
}
```

### Corners

```css
border-radius: 8px;   /* stats grid, cards, age grid */
border-radius: 6px;   /* cluster cards, inner elements */
border-radius: 3px;   /* badges */
```

---

## Components

### Stats bar

A 4-cell grid showing top-level metrics. Cells separated by 1px borders (using background color trick on grid gap).

```
┌──────────┬──────────┬──────────┬──────────┐
│ CRITICAL │ WARNINGS │  CURSED  │ BUS RISK │
│ HOTSPOTS │          │  FILES   │          │
│    2     │    3     │   259    │  1,853   │
└──────────┴──────────┴──────────┴──────────┘
```

- Grid: `repeat(4, 1fr)`, gap: 1px, background: var(--border)
- Each cell: background: var(--bg), padding: 14px 16px
- Label: 11px uppercase, --fg3
- Value: 22px weight 500, colored by severity (--red for critical, --amber for warning, --teal for ok)

### File table (main hotspot ranking)

The centerpiece. Each row shows one file with ALL its signals inline.

| Column      | Width | Content                                    |
|-------------|-------|--------------------------------------------|
| File        | ~50%  | filename (mono) + path below (muted)       |
| Signals     | flex  | inline badges showing why it's flagged     |
| Score       | 80px  | horizontal bar + number                    |
| Churn       | 50px  | mono number                                |
| LOC         | 50px  | mono number                                |

- No zebra striping — rows separated by 0.5px bottom borders
- Score column has a tiny colored bar (4px tall) proportional to score, plus the number
- Bar color: --red for critical (80+), --amber for warning (50-79), --teal for moderate (<50)

### Badges (signal tags)

Small inline pills that explain WHY a file is flagged.

```css
.badge {
  display: inline-block;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 3px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
```

Badge types and their colors:

| Badge           | Background   | Text color   | Example text          |
|-----------------|--------------|--------------|-----------------------|
| Critical        | --red-bg     | --red-fg     | "critical"            |
| Warning         | --amber-bg   | --amber-fg   | "warning"             |
| Ownership       | --purple-bg  | --purple-fg  | "7 authors", "ownership" |
| Coupling        | --blue-bg    | --blue-fg    | "coupling hub", "24 clusters" |
| Temporal        | --teal-bg    | --teal-fg    | "jun 2025"            |
| Shame           | --red-bg     | --red-fg     | "fix churn"           |
| Parallel dev    | --amber-bg   | --amber-fg   | "parallel dev"        |
| Stale           | --bg3        | --fg3        | "stale"               |

### Contributor rows

Horizontal layout with avatar circle, name, and stats.

```
[SM]  Sebastian Markbåge    353 · 339 files · 56% hotspot ownership
```

- Avatar: 24px circle, colored background from accent palette, 10px initials
- Name: 13px regular
- Stats: 11px mono, --fg3
- Highlight dangerous stats in --red (e.g., "56% hotspot ownership")

### Root cause cluster cards

```css
.cluster-card {
  background: var(--bg2);
  border-radius: 6px;
  padding: 12px 14px;
  margin-bottom: 8px;
}
```

Each card has:
- A badge + label line (e.g., `[ownership] sebastian@calyptus.eu — 12 hotspots`)
- A 1-line description in --fg2
- A flex-wrap row of tiny file chips (mono 10px, --bg background, 3px radius)

### Age distribution bar

4-cell grid, same technique as stats bar.

```
┌──────────┬──────────┬──────────┬──────────┐
│   124    │  1,111   │   883    │   717    │
│  FRESH   │  AGING   │  STALE   │ ANCIENT  │
└──────────┴──────────┴──────────┴──────────┘
```

Numbers colored: fresh=--teal, aging=--amber, stale=--red, ancient=--fg3

### Navigation

Minimal tab bar. No pill/button styles — just text links with a bottom border on active.

```css
.nav a {
  font-size: 13px;
  color: var(--fg3);
  padding: 8px 16px;
  border-bottom: 1.5px solid transparent;
}
.nav a.active {
  color: var(--fg);
  border-bottom-color: var(--fg);
}
```

---

## Interaction patterns

### Click-through on file rows

Clicking a file name in the hotspot table should expand an inline detail panel OR navigate to a file detail view showing:
- Full commit timeline
- Author breakdown pie
- All signal details with explanations
- Coupling connections for this file

### Expandable cluster cards

Root cause clusters should be collapsible — show label + score by default, expand to show file list on click.

### Sortable table

The hotspot table should be sortable by Score, Churn, or LOC columns.

---

## What NOT to do

- No gradients, shadows, or glow effects
- No card borders with rounded corners AND shadows together
- No corporate blue as primary color
- No heavy card containers — let the data breathe
- No icons or emojis in the interface (except sparingly in badges if needed)
- No dark backgrounds on the default light theme
- No more than 3 navigation items at the top level
- No separate pages for Contributors, Shame, Parallel Dev — fold them into the dashboard

---

## Implementation notes

- This is a static HTML report generated by the CLI (`gitlore --web`)
- All data comes from a pre-computed JSON report (`GitloreReport`)
- No server required — the HTML file is self-contained
- Use CSS custom properties for theming — `prefers-color-scheme` media query for auto dark mode
- Framework: whatever the existing GitLore web stack uses (likely React/Ink for TUI, vanilla or React for web)
- The coupling graph page will likely need d3-force or a similar library for the interactive network visualization

---

## Reference mockup

The visual mockup was created in this conversation and shows the full dashboard layout with real React codebase data. It demonstrates the stats bar, file table with inline signal badges, two-column contributors/clusters section, and age distribution — all on a single scrollable page.
