# Analyzer Docs Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `Docs ↗` link to each polished analyzer's bottom-panel tab bar, wired to its VitePress docs page. Backfill the eight already-polished analyzers and update polish-pattern.md so every future polish session sets `docsPath` as part of its DoD.

**Architecture:** Three layers, single PR. (1) `apps/web/src/presets/types.ts` gets a new optional `docsPath?: string` field on `PresetDefinition`; `apps/web/src/presets/registry.ts` sets it on the eight backfilled analyzer presets. (2) `apps/web/src/components/layout/BottomPanel.tsx` accepts a `docsPath?` prop and renders a right-anchored `Docs ↗` external link in the tab bar when set; `apps/web/src/components/layout/Shell.tsx` destructures `activePreset` once and passes `docsPath` through. (3) `docs/polish-pattern.md` gets a new "Docs link" subsection, two new DoD bullets, and a cross-reference in the narrative-KPI anatomy. CI safety net: `registry.test.ts` adds a DoD-enforcement assertion that fails if a polished analyzer's docs page exists on disk but `docsPath` isn't set.

**Tech Stack:** TypeScript 6, Vitest, React 19, `@testing-library/react`. No new runtime deps. No core changes.

**Worktree:** `/Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links` on branch `chore-analyzer-docs-links` (rename to the Linear issue branch if/when a ticket is filed). Spec lives at [`docs/superpowers/specs/2026-05-03-analyzer-docs-links-design.md`](../specs/2026-05-03-analyzer-docs-links-design.md). The spec is the source of truth — when in doubt, the spec wins.

**Test commands (one-shot, agent-friendly):**

```bash
# Web tests
pnpm --filter @gitrelic/web test --run

# Full suite + lint + format + build
pnpm test && pnpm lint && pnpm format:check && pnpm build
```

**Convention reminders:**

- **Every Bash command in this plan starts with `cd <worktree>`** — without it, commits drift to `main` (per `feedback_subagent_cwd_discipline.md` memory).
- Bare-ternary for single conditional render (`{cond && <X />}`), not `cn()`. `cn()` is for multi-condition `className` spread/merge.
- The eight backfilled presets correspond exactly to existing files at `apps/docs/analyzers/<id>.md`. Verify on disk before setting `docsPath`.
- Style assertions against happy-dom serialization use `flex-grow: 1`, NOT `flex: 1` (per `feedback_happy_dom_flex_shorthand.md` memory) — not directly relevant here, just consistent project convention.

**Precondition — RELIC-323 must be merged on `main`:**

This plan's backfill list includes `commit-timing`. The registry tests assert `apps/docs/analyzers/commit-timing.md` exists. If RELIC-323 hasn't merged when starting this work:

1. **Stop and wait** for RELIC-323 to merge (preferred — keeps the backfill atomic).
2. **OR drop `commit-timing` from the backfill list** in Task 2's `BACKFILLED` table, ship this PR with seven analyzers, and add `commit-timing` as a single-line follow-up commit once RELIC-323 merges.

Default to option 1 unless explicitly directed otherwise.

---

## Setup Task: Worktree baseline

**Files:** none (toolchain only)

- [ ] **Step 1: Confirm RELIC-323 has merged on `main`**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic
git checkout main
git pull
ls apps/docs/analyzers/commit-timing.md
```

Expected: file exists. If `ls` fails (file missing), STOP — RELIC-323 has not merged yet. Either wait, or revisit the precondition above.

- [ ] **Step 2: Create worktree from `main`**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic
git worktree add .worktrees/chore-analyzer-docs-links -b chore-analyzer-docs-links
```

Expected: a new worktree at `.worktrees/chore-analyzer-docs-links` on a fresh branch tracking `main`. From now on every command starts with `cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links`.

- [ ] **Step 3: Install dependencies**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm install
```

Expected: pnpm resolves and links the workspace. Warnings acceptable; errors are not.

- [ ] **Step 4: Run baseline tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm test
```

Expected: all pre-existing tests pass. Anything failing on the clean baseline indicates environment drift — stop and investigate.

- [ ] **Step 5: Confirm dev tools work**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm lint && pnpm format:check && pnpm build
```

Expected: clean lint, clean format, full build succeeds.

---

## Task 1: Add `docsPath?` field to `PresetDefinition`

**Files:**
- Modify: `apps/web/src/presets/types.ts` (add one field to `PresetDefinition`)

The field exists ahead of any consumer so subsequent tasks compile cleanly. Spec → `docs/superpowers/specs/2026-05-03-analyzer-docs-links-design.md` § "Field shape".

- [ ] **Step 1: Add `docsPath?` to `PresetDefinition`**

In `apps/web/src/presets/types.ts`, modify the `PresetDefinition` interface (currently lines 103–118). Add `docsPath?: string` as the last field:

```ts
export interface PresetDefinition {
  id: PresetId;
  tier: PresetTier;
  label: string;
  group: SidebarGroupLabel;
  heroLabel?: string;
  hero: {
    defaultViz: HeroViz;
    altTabs: HeroViz[];
  };
  bottomPanel: {
    defaultTab: BottomTab;
    altTabs: BottomTab[];
  };
  metrics: (report: GitrelicReport) => Metric[];
  /**
   * Path segment under the docs site (e.g. 'analyzers/churn'). When set,
   * BottomPanel renders a "Docs ↗" link in the tab bar. Resolved against
   * https://nebulord-dev.github.io/gitrelic/.
   */
  docsPath?: string;
}
```

- [ ] **Step 2: Verify the type-check passes**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm --filter @gitrelic/web build
```

Expected: web builds cleanly. The field is optional, so no existing preset definition needs to change yet.

- [ ] **Step 3: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
git add apps/web/src/presets/types.ts
git commit -m "feat(web): add optional docsPath to PresetDefinition

Opt-in field for analyzer presets to declare their VitePress docs
page. Consumed by BottomPanel in a follow-up commit."
```

---

## Task 2: Set `docsPath` on the eight analyzer presets + registry tests

**Files:**
- Modify: `apps/web/src/presets/registry.ts` (set `docsPath` on 8 analyzer-tier presets)
- Modify: `apps/web/src/presets/registry.test.ts` (add three assertions)

TDD-flavor: write the tests first, watch them fail, set `docsPath`, watch them pass. Spec → § "Backfill list" + § "Testing".

- [ ] **Step 1: Add the three new test assertions to `registry.test.ts`**

In `apps/web/src/presets/registry.test.ts`, add this `describe` block at the bottom of the file (after the existing tests):

```ts
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DOCS_DIR = join(__dirname, '../../../docs/analyzers');

const BACKFILLED: Array<{ id: PresetId; docsPath: string }> = [
  { id: 'age-map', docsPath: 'analyzers/age-map' },
  { id: 'blast-radius', docsPath: 'analyzers/blast-radius' },
  { id: 'bus-factor', docsPath: 'analyzers/bus-factor' },
  { id: 'churn', docsPath: 'analyzers/churn' },
  { id: 'commit-timing', docsPath: 'analyzers/commit-timing' },
  { id: 'parallel-dev', docsPath: 'analyzers/parallel-dev' },
  { id: 'rewrite-ratio', docsPath: 'analyzers/rewrite-ratio' },
  { id: 'shame', docsPath: 'analyzers/shame' },
];

describe('analyzer docsPath', () => {
  it.each(BACKFILLED)(
    'preset $id has docsPath $docsPath',
    ({ id, docsPath }) => {
      expect(PRESETS[id].docsPath).toBe(docsPath);
    },
  );

  it('every docsPath value resolves to a real docs file', () => {
    for (const preset of Object.values(PRESETS)) {
      if (preset.docsPath === undefined) continue;
      const slug = preset.docsPath.replace(/^analyzers\//, '');
      const filePath = join(DOCS_DIR, `${slug}.md`);
      expect(
        existsSync(filePath),
        `missing docs file: ${filePath} (referenced by preset ${preset.id})`,
      ).toBe(true);
    }
  });

  it('every analyzer-tier preset whose <id>.md exists must set docsPath', () => {
    for (const preset of Object.values(PRESETS)) {
      if (preset.tier !== 'analyzer') continue;
      const expectedDocPath = join(DOCS_DIR, `${preset.id}.md`);
      if (existsSync(expectedDocPath)) {
        expect(
          preset.docsPath,
          `preset ${preset.id} has a docs page on disk but no docsPath set — see polish-pattern.md`,
        ).toBeDefined();
      }
    }
  });
});
```

Hoist the two top-of-file imports (`existsSync`, `join`) to the existing import block at the top of the file rather than declaring them inside the `describe`.

- [ ] **Step 2: Run the tests — expect them to fail**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm --filter @gitrelic/web test --run registry.test
```

Expected: the eight `it.each` cases fail (`PRESETS[id].docsPath` is `undefined`). The third assertion also fails for any analyzer-tier preset with a docs page on disk.

- [ ] **Step 3: Set `docsPath` on the eight analyzer presets in `registry.ts`**

In `apps/web/src/presets/registry.ts`, locate each of the eight preset definitions (they're separate `const` exports or entries in the `PRESETS` object — the file structure is established; follow it). For each, add `docsPath: 'analyzers/<id>'` adjacent to the `metrics:` field:

| Preset ID         | Add line                                |
|---                |---                                      |
| `age-map`         | `docsPath: 'analyzers/age-map',`        |
| `blast-radius`    | `docsPath: 'analyzers/blast-radius',`   |
| `bus-factor`      | `docsPath: 'analyzers/bus-factor',`     |
| `churn`           | `docsPath: 'analyzers/churn',`          |
| `commit-timing`   | `docsPath: 'analyzers/commit-timing',`  |
| `parallel-dev`    | `docsPath: 'analyzers/parallel-dev',`   |
| `rewrite-ratio`   | `docsPath: 'analyzers/rewrite-ratio',`  |
| `shame`           | `docsPath: 'analyzers/shame',`          |

Do **NOT** set `docsPath` on the dashboard-tier presets (`overview`, `risk`, `tech-debt`) — they intentionally stay unset.

- [ ] **Step 4: Run the registry tests — expect green**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm --filter @gitrelic/web test --run registry.test
```

Expected: all assertions pass — the eight `it.each` cases, the filesystem assertion, and the DoD-enforcement assertion.

- [ ] **Step 5: Run the full web suite to make sure nothing else broke**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm --filter @gitrelic/web test --run
```

Expected: all web tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
git add apps/web/src/presets/registry.ts apps/web/src/presets/registry.test.ts
git commit -m "feat(web): set docsPath on the 8 polished analyzer presets

Backfill: age-map, blast-radius, bus-factor, churn, commit-timing,
parallel-dev, rewrite-ratio, shame. Adds three registry assertions:
backfill correctness, filesystem existence, and a DoD-enforcement
assertion that catches 'shipped a docs page but forgot to wire the
in-app link' on CI."
```

---

## Task 3: BottomPanel renders the `Docs ↗` link

**Files:**
- Modify: `apps/web/src/components/layout/BottomPanel.tsx` (add `DOCS_BASE_URL`, accept `docsPath` prop, render link)
- Modify: `apps/web/src/components/layout/Shell.tsx` (destructure `activePreset`, pass `docsPath` to `BottomPanel`)
- Modify: `apps/web/src/components/layout/Shell.test.tsx` (two render-assertion cases)

Spec → § "Rendering placement" + § "Plumbing".

- [ ] **Step 1: Write the failing Shell tests for docs-link rendering**

In `apps/web/src/components/layout/Shell.test.tsx`, add this `describe` block after the existing ones:

```ts
describe('docs link in bottom panel', () => {
  it('renders Docs ↗ link when active preset has docsPath', () => {
    const { container, getByText } = render(<Shell report={makeMinimalReport()} />);
    // Click the Churn sidebar item to switch the active preset to one with docsPath.
    fireEvent.click(getByText('Churn'));
    const link = container.querySelector('a[href*="analyzers/churn"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.textContent).toContain('Docs');
  });

  it('does not render Docs link for dashboard-tier presets', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    // Default preset is 'overview' (tier=dashboard, no docsPath).
    const link = container.querySelector('a[href*="nebulord-dev.github.io/gitrelic"]');
    expect(link).toBeNull();
  });
});
```

If `Churn` isn't the right sidebar label or the click pattern doesn't work, swap to whichever analyzer preset is in the sidebar group structure; the assertion is what matters. The `fireEvent` import is already present at the top of the file.

- [ ] **Step 2: Run the tests — expect them to fail**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm --filter @gitrelic/web test --run Shell.test
```

Expected: the first new case fails (no link element rendered). The second passes incidentally (no link rendered for any preset yet).

- [ ] **Step 3: Modify `BottomPanel.tsx` to accept `docsPath` and render the link**

In `apps/web/src/components/layout/BottomPanel.tsx`:

a. **Add the constant at the top of the file** (after imports, before `TAB_LABELS`):

```ts
const DOCS_BASE_URL = 'https://nebulord-dev.github.io/gitrelic';
```

b. **Add `docsPath?: string` to `BottomPanelProps`** (currently lines 31–42):

```ts
interface BottomPanelProps {
  report: GitrelicReport;
  activeTab: BottomTab;
  altTabs: BottomTab[];
  onTabChange: (tab: BottomTab) => void;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  onApplyPreset: (id: PresetId) => void;
  fillAvailable?: boolean;
  /**
   * When set, renders a "Docs ↗" link in the tab bar pointing at
   * the analyzer's docs page on the deployed VitePress site.
   */
  docsPath?: string;
}
```

c. **Destructure `docsPath` in the component signature** (line 157–166 area):

```ts
export function BottomPanel({
  report,
  activeTab,
  altTabs,
  onTabChange,
  selectedFile,
  onSelectFile,
  onApplyPreset,
  fillAvailable = false,
  docsPath,
}: BottomPanelProps) {
```

d. **Modify the tab bar (currently lines 218–233)** to wrap the tab buttons in a flex container with `justify-between` and add the link. Replace:

```tsx
{/* Tab bar */}
<div className="flex border-b border-border-primary px-4 shrink-0">
  {altTabs.map((tabId) => (
    <button
      key={tabId}
      onClick={() => onTabChange(tabId)}
      className={cn(
        'px-3.5 py-2 text-[10px] border-none bg-transparent cursor-pointer',
        activeTab === tabId
          ? 'text-text-primary border-b-2 border-b-accent-primary'
          : 'text-text-tertiary border-b-2 border-b-transparent',
      )}
    >
      {TAB_LABELS[tabId]}
    </button>
  ))}
</div>
```

with:

```tsx
{/* Tab bar */}
<div className="flex items-center justify-between border-b border-border-primary px-4 shrink-0">
  <div className="flex">
    {altTabs.map((tabId) => (
      <button
        key={tabId}
        onClick={() => onTabChange(tabId)}
        className={cn(
          'px-3.5 py-2 text-[10px] border-none bg-transparent cursor-pointer',
          activeTab === tabId
            ? 'text-text-primary border-b-2 border-b-accent-primary'
            : 'text-text-tertiary border-b-2 border-b-transparent',
        )}
      >
        {TAB_LABELS[tabId]}
      </button>
    ))}
  </div>
  {docsPath && (
    <a
      href={`${DOCS_BASE_URL}/${docsPath}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] text-text-tertiary hover:text-text-primary px-3.5 py-2 no-underline"
    >
      Docs ↗
    </a>
  )}
</div>
```

The `no-underline` class neutralizes the default `<a>` underline so the link reads as part of the tab-bar chrome rather than as body-copy.

- [ ] **Step 4: Modify `Shell.tsx` — destructure `activePreset`, pass `docsPath`**

In `apps/web/src/components/layout/Shell.tsx`:

a. **Find the existing `PRESETS[selection.activePresetId].heroLabel` read at line 222** and lift it to a single destructure near the top of the component body. Search for the start of the JSX render (around line 200–210, just before the `<div>` that starts the layout). Add this line before the JSX returns:

```ts
const activePreset = PRESETS[selection.activePresetId];
```

b. **Replace the `PRESETS[selection.activePresetId].heroLabel` read at line 222** with `activePreset.heroLabel`.

c. **Pass `docsPath` to `<BottomPanel>` at line 437** — add `docsPath={activePreset.docsPath}` to the existing prop spread:

```tsx
<BottomPanel
  report={report}
  activeTab={selection.activeBottomTab}
  altTabs={selection.bottomAltTabs}
  onTabChange={selection.setBottomTabOverride}
  selectedFile={selection.selectedFile}
  onSelectFile={selection.selectFile}
  onApplyPreset={selection.applyPreset}
  docsPath={activePreset.docsPath}
  fillAvailable={!visibility.hero}
/>
```

- [ ] **Step 5: Run the Shell tests — expect green**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm --filter @gitrelic/web test --run Shell.test
```

Expected: both new docs-link cases pass. All existing Shell tests still pass.

- [ ] **Step 6: Run the full web suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm --filter @gitrelic/web test --run
```

Expected: all web tests pass.

- [ ] **Step 7: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
git add apps/web/src/components/layout/BottomPanel.tsx \
        apps/web/src/components/layout/Shell.tsx \
        apps/web/src/components/layout/Shell.test.tsx
git commit -m "feat(web): render Docs ↗ link in bottom-panel tab bar

Right-anchored external link in the tab bar, conditional on the
active preset's docsPath. Shell.tsx destructures activePreset once
to avoid two reads of PRESETS[activePresetId]."
```

---

## Task 4: Update `polish-pattern.md`

**Files:**
- Modify: `docs/polish-pattern.md` (new "Docs link" subsection, two new DoD bullets, narrative-KPI anatomy cross-reference)

Spec → § "`polish-pattern.md` updates".

- [ ] **Step 1: Add the new "Docs link" subsection**

In `docs/polish-pattern.md`, add this section *immediately after* the "Footer pattern (sticky 'See also')" section (which currently ends around line 82, just before "Existing data, currently unused"):

```markdown
## Docs link

Each polished analyzer has a docs page at `apps/docs/analyzers/<slug>.md`. The dashboard surfaces a link to it from the bottom-panel tab bar — right-anchored, plain `Docs ↗` text link, conditional on the analyzer's preset declaring a `docsPath`.

Wiring (two-step):

1. **Author the docs page** at `apps/docs/analyzers/<slug>.md` following the established analyzer-page structure (see existing pages: `churn.md`, `bus-factor.md`, `parallel-dev.md`).
2. **Set `docsPath` on the analyzer's preset** in `apps/web/src/presets/registry.ts`:

   ```ts
   docsPath: 'analyzers/<slug>',
   ```

The link renders automatically once both are in place. The `registry.test.ts` DoD-enforcement assertion fails on CI if a docs page exists on disk but `docsPath` isn't set — so forgetting to wire the link breaks the build.

Dashboard-tier presets (`overview`, `risk`, `tech-debt`) intentionally do **not** set `docsPath` — they compose multiple analyzers and don't have a 1:1 docs page.
```

- [ ] **Step 2: Add the cross-reference to the narrative-KPI anatomy list**

The narrative-KPI anatomy is currently a 6-item numbered list (lines 67–75). Add a 7th item immediately after the existing item 6 ("Sticky 'See also' footer"):

```markdown
7. **Docs link in tab bar** — when the analyzer's preset declares `docsPath`, a right-anchored `Docs ↗` link appears in the bottom-panel tab bar pointing at the analyzer's docs page. See "Docs link" section below.
```

- [ ] **Step 3: Update the DoD checklist**

The "What this changes for polish tickets" section (currently lines 240–247) lists DoD bullets. Add two new bullets to that list (place them immediately after "Sticky 'See also' footer" and before "Backend additions where noted"):

```markdown
- Docs page at `apps/docs/analyzers/<slug>.md` (per "Docs link" section above)
- `docsPath` set on the analyzer's preset in `apps/web/src/presets/registry.ts`
```

- [ ] **Step 4: Verify the doc renders cleanly**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
cat docs/polish-pattern.md | head -260 | tail -40
```

Expected: the new subsection, anatomy item 7, and DoD bullets all read cleanly. No broken markdown.

- [ ] **Step 5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
git add docs/polish-pattern.md
git commit -m "docs: polish-pattern.md — analyzer docs-link conventions

New 'Docs link' subsection, narrative-KPI anatomy cross-reference,
and two new DoD bullets so every future polish session ships the
docs page + docsPath wiring as part of its definition of done."
```

---

## Task 5: Verification — full suite, lint, format, build, manual smoke

**Files:** none (validation only)

Spec → § "Risks and mitigations" + § "Testing".

- [ ] **Step 1: Run the complete test suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm test
```

Expected: all core (231+) and web (29+) tests pass — the new tests bring the count up.

- [ ] **Step 2: Lint**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm lint
```

Expected: clean.

- [ ] **Step 3: Format check**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm format:check
```

Expected: clean. If it fails, run `pnpm format` and commit the formatting fix.

- [ ] **Step 4: Build**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
pnpm build
```

Expected: `core`, `web`, `cli` all build cleanly. (Docs build is excluded from `pnpm build`.)

- [ ] **Step 5: Manual smoke against the React repo**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

Open the dashboard URL printed in the terminal. Verify:

1. **Overview / Risk / Tech Debt tabs** — no `Docs ↗` link in the tab bar (dashboard-tier).
2. **Each of the 8 polished analyzers** (Age Map, Blast Radius, Bus Factor, Churn, Commit Timing, Parallel Dev, Rewrite Ratio, Shame) — `Docs ↗` link visible in the bottom-panel tab bar, right-anchored, vertically aligned with the tab buttons.
3. **Click `Docs ↗` on at least three analyzers** (Churn, Bus Factor, Commit Timing) — opens the correct docs page in a new tab, no 404.
4. **Unpolished analyzers** (e.g., Hotspots, Coupling, Languages) — no docs link visible. Confirms the conditional render.
5. **Visual rhythm pass** — the link sits cleanly at the right edge of the tab bar without reading as a misaligned tab. Compare against tab-button vertical alignment. Take a screenshot and attach to the PR.

If any analyzer's docs link 404s, double-check the `docsPath` value in `registry.ts` matches the actual filename in `apps/docs/analyzers/`.

- [ ] **Step 6: Push the branch**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/chore-analyzer-docs-links
git push -u origin chore-analyzer-docs-links
```

Expected: branch pushes; PR creation prompt appears.

- [ ] **Step 7: Open the PR**

Use the standard `gh pr create` flow (per CLAUDE.md). Title: `feat(web): per-analyzer docs links in bottom-panel tab bar`. Body should include:

- Goal one-liner
- Backfill list (8 analyzers)
- Screenshot of the rendered link on a polished analyzer
- Link to spec doc
- Test plan checkboxes (the manual smoke items above)

If a Linear ticket has been filed for this work, reference it in the title and body. If not, mention "Filed under no Linear ticket — chore PR per spec deviation noted in [spec]" so the PR review knows the context.

- [ ] **Step 8: Wait for PR Claude review**

Per project memory `reference_pr_claude_review.md`, expect an automated bot review. Plan headroom for 1–2 follow-up commits. If the bot flags real issues (not style nits), fix and push a follow-up commit. Don't amend the existing commits — create new ones.

---

## Out of scope (deferred to follow-ups)

- **Docs site nav changes.** The VitePress sidebar in `apps/docs/.vitepress/config.ts` already lists each analyzer page; no changes needed.
- **Future polish sessions.** Once this PR merges, every polish session inherits the new DoD bullets — they set `docsPath` as a one-line addition. No standing infra debt.
- **Docs site URL changes.** `DOCS_BASE_URL` is a single constant in `BottomPanel.tsx`. If the deployment URL ever moves, one edit.
- **Per-page deep links.** Linking to a specific section of an analyzer's docs page (e.g., `analyzers/churn#tier-thresholds`) is not in scope — `docsPath` is page-level only. A future need for section-level links would extend `docsPath` to include an optional fragment.
