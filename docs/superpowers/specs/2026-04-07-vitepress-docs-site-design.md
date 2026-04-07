# VitePress Docs Site — Design

**Date:** 2026-04-07
**Status:** Approved
**Scope:** This session — wiring + skeleton only. Content authoring deferred to future sessions.

## Goal

Add a VitePress documentation site to the GitLore monorepo as a new workspace package, following the same pattern Sickbay uses. This session is strictly scoped to **structural wiring** — get a working docs site checked in with the right brand, navigation, and section skeleton, so future sessions can focus purely on writing content.

## Non-goals (this session)

- Writing detailed analyzer documentation (deferred — there's a planned future session for this)
- Writing usage guides, CLI reference, configuration docs
- Documenting individual web dashboard tabs or hero visualizations
- Setting up CI to build/deploy the docs site
- Configuring custom domain or DNS
- Adding any logo/image assets

## Background

GitLore is a private alpha — no users, no published package, no public repo. The motivation for adding docs *now* is to get the structural foundation in place so subsequent sessions can iteratively fill in real content (especially deep-dives on the 22 analyzers). Sickbay (sister project at `../sickbay`) already has a working VitePress site in `apps/docs/`, and we are mirroring its proven pattern.

## Architecture

### New workspace package: `apps/docs/`

A new pnpm workspace package with the following layout:

```
apps/docs/
├── .gitignore                    # ignores .vitepress/cache, .vitepress/dist, node_modules
├── .vitepress/
│   ├── config.ts                 # VitePress config (title, base, sidebar, theme)
│   └── theme/
│       ├── index.ts              # imports DefaultTheme + custom.css
│       └── custom.css            # blue brand colors, monospace headings
├── package.json                  # @gitlore/docs, vitepress dev dep, docs:dev/build/preview scripts
├── index.md                      # home page (hero + features layout)
├── guide/
│   ├── introduction.md           # stub
│   └── concepts.md               # stub
├── analyzers/
│   └── index.md                  # stub
├── dashboard/
│   └── index.md                  # stub
└── advanced/
    └── index.md                  # stub
```

### Workspace integration

- `pnpm-workspace.yaml` already includes `apps/*` — no change needed
- Root `package.json` gains two scripts:
  - `"docs:dev": "pnpm --filter @gitlore/docs docs:dev"`
  - `"docs:build": "pnpm --filter @gitlore/docs docs:build"`
- **Not** added to `turbo.json` build pipeline. VitePress has its own caching, and excluding it keeps `pnpm build` fast for the actual application packages. This matches Sickbay's setup exactly.

### Package manifest (`apps/docs/package.json`)

```json
{
  "name": "@gitlore/docs",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "docs:dev": "vitepress dev",
    "docs:build": "vitepress build",
    "docs:preview": "vitepress preview"
  },
  "devDependencies": {
    "vitepress": "^1.6.4"
  }
}
```

## Components

### 1. VitePress config (`.vitepress/config.ts`)

Key settings:

- **`title`**: `'GitLore'`
- **`description`**: `'Git archaeology for your repository — churn, bus factor, hotspots, and cursed files.'`
- **`base`**: `'/gitlore/'` — assumes future GitHub Pages deploy at `nebulord-dev.github.io/gitlore/`. Easy to change later.
- **`appearance`**: `'dark'` — forces dark theme to match GitLore's dashboard aesthetic.
- **`lastUpdated`**: `true`

**Top nav:**
- Changelog → `https://github.com/nebulord-dev/gitlore/blob/main/CHANGELOG.md`
- Contributing → `https://github.com/nebulord-dev/gitlore/blob/main/CONTRIBUTING.md`
- **No** social/GitHub icon link (private repo would 404 for outsiders; flip on when public)

**Sidebar (5 sections, 1 page each):**

```
Getting Started
  └ Introduction         → /guide/introduction
Guide
  └ Core Concepts        → /guide/concepts
Analyzers
  └ Overview             → /analyzers/
Web Dashboard
  └ Overview             → /dashboard/
Advanced
  └ Overview             → /advanced/
```

All sections use `collapsed: false` so they're open by default.

**Search:** Local provider enabled.

**Footer:** `'Released under the MIT License.'` / `'Copyright 2026-present Nebulord'`

**Not included:**
- No `head` script tags (no analytics for private alpha)
- No `editLink`
- No `socialLinks`

### 2. Theme override (`.vitepress/theme/index.ts`)

Standard 3-line wrapper:

```ts
import DefaultTheme from 'vitepress/theme';

import './custom.css';

export default DefaultTheme;
```

### 3. Custom CSS (`.vitepress/theme/custom.css`)

Two visual customizations:

**A. Brand color override** — bright sky blue, slightly more vibrant than GitLore's exact dashboard blue (`#58a6ff`) so it doesn't collide with default link color. Pulled from Tailwind sky palette:

```css
:root {
  --vp-c-brand-1: #38bdf8;  /* sky-400, primary */
  --vp-c-brand-2: #7dd3fc;  /* sky-300, hover */
  --vp-c-brand-3: #0ea5e9;  /* sky-500, active */
  --vp-c-brand-soft: rgba(56, 189, 248, 0.14);
}

.dark {
  --vp-c-brand-1: #38bdf8;
  --vp-c-brand-2: #7dd3fc;
  --vp-c-brand-3: #0ea5e9;
  --vp-c-brand-soft: rgba(56, 189, 248, 0.16);
}
```

**B. Monospace headings** — matches Sickbay's "terminal/git-archaeology" aesthetic. Applied to all heading levels and the hero text:

```css
h1, h2, h3, h4, h5, h6,
.VPHero .name,
.VPHero .text,
.VPHero .tagline {
  font-family:
    'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', ui-monospace, monospace !important;
}
```

**C. Hero name gradient + glow** — bright blue gradient on the home page hero:

```css
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
}

.VPHero .image-bg {
  background-image: linear-gradient(-45deg, #38bdf8 50%, #0ea5e9 50%);
  filter: blur(44px);
  opacity: 0.8;
}
```

### 4. Home page (`index.md`)

VitePress home layout with hero + features:

```md
---
layout: home

hero:
  name: GitLore
  text: Git Archaeology
  tagline: Surface churn patterns, bus factor risks, hotspots, and cursed files from your repo's git history.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/nebulord-dev/gitlore

features:
  - title: 22 Analyzers
    details: Churn, bus factor, hotspots, coupling, cursed files, ghost files, complexity trends, and more — all from pure git history.
  - title: Terminal & Web
    details: Rich Ink-powered terminal UI for quick scans, plus a full web dashboard with hero visualizations and 23 deep-dive tabs.
  - title: Zero Dependencies
    details: Everything comes from `git log` and `git ls-files`. No external tool wrappers, no language-specific assumptions.
  - title: Built on Research
    details: Inspired by Adam Tornhill's "Your Code as a Crime Scene" and "Software Design X-Rays" — proven techniques, applied to your repo.
---
```

The "View on GitHub" button is intentionally kept even though the repo is private — by the time anyone external sees the site, the repo will be public.

### 5. Stub pages (5 files)

Every stub follows the same template:

```md
---
title: <Page Title>
---

# <Page Title>

::: info Coming Soon
This page is part of GitLore's docs skeleton. Detailed content is being written
in upcoming sessions. Check back soon, or [open an issue](https://github.com/nebulord-dev/gitlore/issues)
if you have questions in the meantime.
:::
```

The 5 stub files:

| File | Title |
|---|---|
| `guide/introduction.md` | Introduction |
| `guide/concepts.md` | Core Concepts |
| `analyzers/index.md` | Analyzers |
| `dashboard/index.md` | Web Dashboard |
| `advanced/index.md` | Advanced |

### 6. `.gitignore` (`apps/docs/.gitignore`)

```
node_modules
.vitepress/cache
.vitepress/dist
```

## Data flow

There is no runtime data flow — VitePress is a static site generator. The build pipeline:

1. `pnpm docs:dev` → starts VitePress dev server on `localhost:5173`
2. `pnpm docs:build` → outputs static HTML/CSS/JS to `apps/docs/.vitepress/dist/`
3. Future deploy: dist directory is published to GitHub Pages under `/gitlore/`

## Error handling & edge cases

- **Build cache directory**: `.vitepress/cache/` is gitignored. If a developer hits a stale cache, `rm -rf apps/docs/.vitepress/cache` is the workaround.
- **Base path mismatch**: If/when the deploy target changes (e.g., custom domain instead of GitHub Pages), update `base` in `config.ts`. This is a one-line change.
- **Search index**: VitePress local search builds an index at build time from page content. With only 6 pages and minimal content, the index will be tiny — no concerns.
- **Private repo external links**: Top nav links to Changelog/Contributing on GitHub will 404 for unauthenticated visitors until the repo is made public. Acceptable for alpha.

## Testing

This is a structural skeleton with no logic — there is nothing to unit-test. Verification is manual:

1. `pnpm install` succeeds and pulls in vitepress
2. `pnpm docs:dev` starts the dev server without errors
3. `pnpm docs:build` produces a `dist/` directory
4. `pnpm docs:preview` serves the built site
5. Visual check: home page renders with hero, blue brand color, monospace headings
6. Visual check: all 5 sidebar items click through to their stub pages
7. Visual check: local search dialog opens and finds at least the home page title
8. `pnpm lint` and `pnpm format:check` still pass at repo root

## Files created

```
apps/docs/.gitignore
apps/docs/.vitepress/config.ts
apps/docs/.vitepress/theme/index.ts
apps/docs/.vitepress/theme/custom.css
apps/docs/package.json
apps/docs/index.md
apps/docs/guide/introduction.md
apps/docs/guide/concepts.md
apps/docs/analyzers/index.md
apps/docs/dashboard/index.md
apps/docs/advanced/index.md
```

## Files modified

```
package.json                    # add docs:dev and docs:build root scripts
pnpm-lock.yaml                  # vitepress added to dependencies
```

## Future work (out of scope)

Tracked for future sessions:

- **Content authoring** — fill in all 22 analyzers, dashboard tabs, hero visualizations, CLI reference, configuration, advanced topics
- **CI deployment** — GitHub Actions workflow to build and publish to GitHub Pages on push to main
- **GitHub social link** — re-enable the GitHub icon in nav once the repo is public
- **Logo / brand assets** — add a GitLore logo to the hero and favicon
- **Edit-on-GitHub link** — enable `editLink` in config once the repo is public
- **Versioned docs** — only relevant once GitLore has stable releases worth pinning
