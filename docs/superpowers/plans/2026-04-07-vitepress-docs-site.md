# VitePress Docs Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `@gitlore/docs` workspace package that serves a working VitePress docs skeleton with the right brand, navigation, and 5-section structure — no real content yet.

**Architecture:** Mirror Sickbay's `apps/docs/` pattern. New pnpm workspace package in `apps/docs/` with VitePress 1.x as the only dev dependency. Custom CSS theme with bright sky-blue brand and monospace headings. 6 markdown pages total (1 home + 5 stubs). Root `package.json` gains `docs:dev` and `docs:build` scripts. Not added to turbo's build pipeline.

**Tech Stack:** VitePress 1.6.4, pnpm workspaces (no turbo for this package).

**Spec:** `docs/superpowers/specs/2026-04-07-vitepress-docs-site-design.md`

---

## File Structure

**Created files (11):**

```
apps/docs/
├── .gitignore                          # ignores cache/dist/node_modules
├── package.json                        # @gitlore/docs manifest
├── index.md                            # home page (hero + features layout)
├── .vitepress/
│   ├── config.ts                       # VitePress config
│   └── theme/
│       ├── index.ts                    # theme entry
│       └── custom.css                  # blue brand + mono headings
├── guide/
│   ├── introduction.md                 # stub
│   └── concepts.md                     # stub
├── analyzers/
│   └── index.md                        # stub
├── dashboard/
│   └── index.md                        # stub
└── advanced/
    └── index.md                        # stub
```

**Modified files (1):**

- `package.json` (root) — add `docs:dev` and `docs:build` scripts

**Note:** `pnpm-workspace.yaml` already includes `apps/*` so no change is needed there. `turbo.json` is intentionally NOT modified — VitePress is excluded from the build pipeline (matches Sickbay).

---

## Task 1: Scaffold the package

**Files:**
- Create: `apps/docs/package.json`
- Create: `apps/docs/.gitignore`

- [ ] **Step 1: Create the package manifest**

Create `apps/docs/package.json` with this exact content:

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

- [ ] **Step 2: Create the package gitignore**

Create `apps/docs/.gitignore`:

```
node_modules
.vitepress/cache
.vitepress/dist
```

- [ ] **Step 3: Install the package**

Run from repo root:

```bash
pnpm install
```

Expected: pnpm picks up the new workspace package, installs `vitepress` into `apps/docs/node_modules/`, updates `pnpm-lock.yaml`. No errors.

- [ ] **Step 4: Verify VitePress is installed**

Run:

```bash
ls apps/docs/node_modules/.bin/vitepress 2>&1
```

Expected: a file path is printed (not "No such file or directory").

---

## Task 2: VitePress config

**Files:**
- Create: `apps/docs/.vitepress/config.ts`

- [ ] **Step 1: Create the config file**

Create `apps/docs/.vitepress/config.ts` with this exact content:

```ts
import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'GitLore',
  description: 'Git archaeology for your repository — churn, bus factor, hotspots, and cursed files.',
  base: '/gitlore/',
  appearance: 'dark',
  lastUpdated: true,

  themeConfig: {
    nav: [
      {
        text: 'Changelog',
        link: 'https://github.com/nebulord-dev/gitlore/blob/main/CHANGELOG.md',
      },
      {
        text: 'Contributing',
        link: 'https://github.com/nebulord-dev/gitlore/blob/main/CONTRIBUTING.md',
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        collapsed: false,
        items: [{ text: 'Introduction', link: '/guide/introduction' }],
      },
      {
        text: 'Guide',
        collapsed: false,
        items: [{ text: 'Core Concepts', link: '/guide/concepts' }],
      },
      {
        text: 'Analyzers',
        collapsed: false,
        items: [{ text: 'Overview', link: '/analyzers/' }],
      },
      {
        text: 'Web Dashboard',
        collapsed: false,
        items: [{ text: 'Overview', link: '/dashboard/' }],
      },
      {
        text: 'Advanced',
        collapsed: false,
        items: [{ text: 'Overview', link: '/advanced/' }],
      },
    ],

    // No socialLinks — repo is private, would 404 for outsiders
    // Add { icon: 'github', link: '...' } when going public

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2026-present Nebulord',
    },
  },
});
```

---

## Task 3: Custom theme

**Files:**
- Create: `apps/docs/.vitepress/theme/index.ts`
- Create: `apps/docs/.vitepress/theme/custom.css`

- [ ] **Step 1: Create the theme entry**

Create `apps/docs/.vitepress/theme/index.ts`:

```ts
import DefaultTheme from 'vitepress/theme';

import './custom.css';

export default DefaultTheme;
```

- [ ] **Step 2: Create the custom CSS**

Create `apps/docs/.vitepress/theme/custom.css`:

```css
/* Bright sky-blue brand — distinct from default link blue */
:root {
  --vp-c-brand-1: #38bdf8;
  --vp-c-brand-2: #7dd3fc;
  --vp-c-brand-3: #0ea5e9;
  --vp-c-brand-soft: rgba(56, 189, 248, 0.14);
}

.dark {
  --vp-c-brand-1: #38bdf8;
  --vp-c-brand-2: #7dd3fc;
  --vp-c-brand-3: #0ea5e9;
  --vp-c-brand-soft: rgba(56, 189, 248, 0.16);
}

/* Monospace headings — terminal/git-archaeology aesthetic */
h1,
h2,
h3,
h4,
h5,
h6,
.VPHero .name,
.VPHero .text,
.VPHero .tagline {
  font-family:
    'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', ui-monospace, monospace !important;
}

/* Hero name gradient — bright blue */
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
}

/* Hero image glow — scoped to hero only */
.VPHero .image-bg {
  background-image: linear-gradient(-45deg, #38bdf8 50%, #0ea5e9 50%);
  filter: blur(44px);
  opacity: 0.8;
}
```

---

## Task 4: Home page

**Files:**
- Create: `apps/docs/index.md`

- [ ] **Step 1: Create the home page**

Create `apps/docs/index.md`:

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

---

## Task 5: Stub pages

**Files:**
- Create: `apps/docs/guide/introduction.md`
- Create: `apps/docs/guide/concepts.md`
- Create: `apps/docs/analyzers/index.md`
- Create: `apps/docs/dashboard/index.md`
- Create: `apps/docs/advanced/index.md`

All five stubs follow the same template — only the title varies.

- [ ] **Step 1: Create `guide/introduction.md`**

```md
---
title: Introduction
---

# Introduction

::: info Coming Soon
This page is part of GitLore's docs skeleton. Detailed content is being written
in upcoming sessions. Check back soon, or [open an issue](https://github.com/nebulord-dev/gitlore/issues)
if you have questions in the meantime.
:::
```

- [ ] **Step 2: Create `guide/concepts.md`**

```md
---
title: Core Concepts
---

# Core Concepts

::: info Coming Soon
This page is part of GitLore's docs skeleton. Detailed content is being written
in upcoming sessions. Check back soon, or [open an issue](https://github.com/nebulord-dev/gitlore/issues)
if you have questions in the meantime.
:::
```

- [ ] **Step 3: Create `analyzers/index.md`**

```md
---
title: Analyzers
---

# Analyzers

::: info Coming Soon
This page is part of GitLore's docs skeleton. Detailed content is being written
in upcoming sessions. Check back soon, or [open an issue](https://github.com/nebulord-dev/gitlore/issues)
if you have questions in the meantime.
:::
```

- [ ] **Step 4: Create `dashboard/index.md`**

```md
---
title: Web Dashboard
---

# Web Dashboard

::: info Coming Soon
This page is part of GitLore's docs skeleton. Detailed content is being written
in upcoming sessions. Check back soon, or [open an issue](https://github.com/nebulord-dev/gitlore/issues)
if you have questions in the meantime.
:::
```

- [ ] **Step 5: Create `advanced/index.md`**

```md
---
title: Advanced
---

# Advanced

::: info Coming Soon
This page is part of GitLore's docs skeleton. Detailed content is being written
in upcoming sessions. Check back soon, or [open an issue](https://github.com/nebulord-dev/gitlore/issues)
if you have questions in the meantime.
:::
```

---

## Task 6: Wire root scripts

**Files:**
- Modify: `package.json` (root)

- [ ] **Step 1: Read the current root package.json scripts section**

Use Read on `package.json` and locate the `"scripts"` block. The `lint` script should be present (around line 10-15 from the existing structure).

- [ ] **Step 2: Add docs scripts**

Add two new entries to the `"scripts"` object, placed after the existing `format:check` script:

```json
"docs:dev": "pnpm --filter @gitlore/docs docs:dev",
"docs:build": "pnpm --filter @gitlore/docs docs:build",
```

**Important:** Use the Edit tool. Find the existing line for `format:check` and insert the two new scripts directly after it. Make sure trailing commas are correct (the script before yours needs a trailing comma if it didn't already have one).

---

## Task 7: Smoke verification

No file changes — this is the manual verification step.

- [ ] **Step 1: Build the docs site**

Run from repo root:

```bash
pnpm docs:build
```

Expected: VitePress builds successfully. Output ends with something like `build complete in X.XXs`. A `apps/docs/.vitepress/dist/` directory is created. No TypeScript errors, no broken-link warnings, no missing-page errors.

- [ ] **Step 2: Verify the build output**

Run:

```bash
ls apps/docs/.vitepress/dist/
```

Expected: includes `index.html`, `assets/`, and subdirectories for `guide/`, `analyzers/`, `dashboard/`, `advanced/`.

- [ ] **Step 3: Confirm lint and format are clean**

Run:

```bash
pnpm lint && pnpm format:check
```

Expected: lint produces no new errors (the 8 pre-existing warnings in `CouplingForceGraph.tsx` are fine — they were there before this work). format:check passes.

If `format:check` fails on any new file, run `pnpm format` to fix it before committing.

- [ ] **Step 4: Quick dev-server smoke test (optional but recommended)**

Run in background:

```bash
pnpm docs:dev
```

Expected: server starts on `http://localhost:5173/gitlore/`. Open that URL manually and verify:
- Home page loads with bright sky-blue hero name and gradient
- Monospace headings render
- All 5 sidebar sections appear in the left nav
- Each sidebar item navigates to its stub page
- Local search opens with `/` keyboard shortcut

Stop the server (Ctrl+C in foreground, or kill the background process).

This step is optional because `docs:build` already validates everything VitePress needs. The dev-server check is a nice-to-have for visual confirmation.

---

## Task 8: Commit

- [ ] **Step 1: Stage all the new files and the root package.json change**

Run:

```bash
git add apps/docs/ package.json pnpm-lock.yaml
```

- [ ] **Step 2: Verify what's staged**

Run:

```bash
git status
```

Expected: shows the 11 new files in `apps/docs/`, the modified root `package.json`, and the modified `pnpm-lock.yaml`. Nothing else.

- [ ] **Step 3: Create the commit**

```bash
git commit -m "$(cat <<'EOF'
docs: scaffold @gitlore/docs vitepress site

Adds a new workspace package at apps/docs/ with a VitePress skeleton:
home page, 5 stub sections (Getting Started, Guide, Analyzers, Web
Dashboard, Advanced), bright sky-blue brand theme, and monospace
headings. Wires docs:dev and docs:build into the root package.json.
Content authoring is deferred to future sessions.

Spec: docs/superpowers/specs/2026-04-07-vitepress-docs-site-design.md

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Verify the commit landed cleanly**

```bash
git status && git log --oneline -3
```

Expected: working tree clean, new commit at HEAD with the message above.

---

## Done

After Task 8, the docs site is checked in and ready to be filled with content in future sessions. The structural foundation is locked in — the next session can focus purely on writing markdown.
