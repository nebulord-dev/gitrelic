---
description: "Create a comprehensive implementation plan for a CodeLore feature before writing any code"
---

# Plan a Feature

## Feature: $ARGUMENTS

## Mission

Transform a feature request into a **comprehensive implementation plan** through systematic codebase analysis and strategic thinking.

**Core Principle**: No code is written in this phase. The goal is a context-rich plan that enables one-pass implementation success.

**Key Philosophy**: Context is King. The plan must contain ALL information needed — patterns, mandatory reading, validation commands, monorepo package order — so the execution agent succeeds on the first attempt.

> If starting a new session, run `/prime` first to load project context before planning.

---

## Planning Process

### Phase 1: Orient to the Kanban

Before anything else:

- Read `.claude/kanban.md` — confirm the feature is in the backlog, check if it's blocked by upstream work
- If the feature is blocked, stop and report why rather than producing a plan for something that can't be built yet
- Note any related tasks already in progress that could conflict or overlap

### Phase 2: Feature Understanding

**Deep Feature Analysis:**

- Extract the core problem being solved
- Identify user value and impact on the CodeLore analysis workflow
- Determine feature type: New Analyzer / Enhancement / Threshold Tuning / Bug Fix / CLI/Web Feature
- Assess complexity: Low / Medium / High
- Identify which packages are affected: `core`, `cli`, `web` (or multiple)

**Create or refine a User Story:**

```
As a <type of user>
I want to <action/goal>
So that <benefit/value>
```

**Clarify ambiguities:**

- If requirements are unclear, ask the user before continuing
- Resolve architectural decisions (e.g. does this touch `types.ts`? does it add a new analyzer to `runner.ts`?) before proceeding

### Phase 3: Codebase Intelligence Gathering

**1. Package Impact Analysis**

CodeLore has strict build order: `core` → `cli` → `web`. For each affected package:

- What files need to change?
- Does `packages/core/src/types.ts` need updating? (If yes, all packages may be affected)
- Does a new analyzer need adding to `runner.ts`?
- Does the CLI need new flags in `apps/cli/src/index.tsx`?
- Does the web dashboard need new components or updated tabs in `Dashboard.tsx`?

**2. Pattern Recognition**

- Search for similar implementations in the codebase
- Identify conventions: naming (camelCase types, kebab-case files), file placement, error handling
- Check `CLAUDE.md` for project-specific rules
- Find the closest existing analyzer to mirror
- Document anti-patterns to avoid

**3. Dependency Analysis**

- Catalog any new npm packages needed (prefer existing deps — check `package.json` first)
- Confirm web-safe imports: `apps/web` must only use `import type` from `@codelore/core`
- Note any tools that need to be bundled as dependencies in `core` (not global installs)

**4. Integration Points**

- Which existing files need updating (e.g. `runner.ts` `runCodelore()` function, `types.ts` exports)
- Which new files need creating and exactly where
- Does the web report shape change? (affects `App.tsx` → `Dashboard.tsx` data flow)

### Phase 4: Strategic Thinking

**Think through:**

- Does this depend on anything not yet built?
- What could go wrong? (Edge cases, type changes that break consumers, git edge cases)
- How will this be tested? Can the analyzer be tested with mock commit data?
- Any performance implications? (Analyzers run sequentially in `runCodelore()`)
- Are there git edge cases? (empty repos, single-commit repos, detached HEAD)

**Design decisions:**

- Choose between alternative approaches with clear rationale
- Consider how threshold changes propagate across analyzers (e.g. age windows affect ghost detection AND cursed file scoring)

### Phase 5: Plan Document Generation

Write the completed plan to `.claude/plans/{kebab-case-feature-name}.md`.
Create `.claude/plans/` if it doesn't exist.

Use the template below:

---

```markdown
# Feature: <feature-name>

> **Blocked by**: [upstream task, or "nothing"]

Validate patterns and imports against the codebase before implementing. Pay close attention
to existing type names, analyzer signatures, and runner integration patterns.

## Feature Description

<Detailed description, purpose, and user value>

## User Story

As a <type of user>
I want to <action/goal>
So that <benefit/value>

## Problem Statement

<The specific problem this solves>

## Solution Statement

<The proposed approach and why it fits the existing architecture>

## Feature Metadata

**Feature Type**: [New Analyzer / Enhancement / Threshold Tuning / Bug Fix / CLI Feature / Web Feature]
**Estimated Complexity**: [Low / Medium / High]
**Packages Affected**: [core / cli / web — list all, in build order]
**New npm Dependencies**: [list, or "none"]
**Touches `types.ts`**: [Yes / No — if yes, all packages may be affected]

---

## CONTEXT REFERENCES

### Files to Read Before Implementing

<List with relevance — be specific about what to look for>

- `packages/core/src/types.ts` (lines X–Y) — type interfaces to extend or mirror
- `packages/core/src/analyzers/churn.ts` — analyzer pattern to follow
- `packages/core/src/runner.ts` (lines X–Y) — where to call the new analyzer
- `apps/cli/src/components/App.tsx` — Ink component pattern
- `apps/web/src/components/Dashboard.tsx` — web dashboard tab pattern

### New Files to Create

- `packages/core/src/analyzers/<name>.ts` — new analyzer implementation
- `apps/web/src/components/<Name>.tsx` — new dashboard component (if needed)

### Patterns to Follow

**Analyzer structure:**
\`\`\`typescript
// Mirror this pattern from churn.ts or bus-factor.ts
import type { RawCommit } from '../utils/git.js';
import type { MyReport } from '../types.js';

export function analyzeMyThing(commits: RawCommit[], trackedFiles: string[]): MyReport {
  // ... analysis logic
  return { files, summary };
}
\`\`\`

**Runner integration:**
\`\`\`typescript
// In runner.ts — call the analyzer and include in CodeloreReport
onProgress?.('Running my analysis...');
const myReport = analyzeMyThing(commits, trackedFiles);
// Add to return object
\`\`\`

**Web-safe imports:**
\`\`\`typescript
// In apps/web — always import type, never value imports from core
import type { CodeloreReport } from '@codelore/core';
\`\`\`

**Naming conventions:** <observed from codebase>

**Error handling:** <observed from codebase>

---

## IMPLEMENTATION PLAN

### Phase 1: Types and Foundation

<Changes to `types.ts` or other shared interfaces — do this first so consumers can build>

**Tasks:**
- Update `packages/core/src/types.ts` with new fields/interfaces
- Add any new type exports to `packages/core/src/index.ts`

### Phase 2: Core Implementation

<The main logic — new analyzer, threshold changes, filter logic, etc.>

**Tasks:**
- Implement analyzer in `packages/core/src/analyzers/<name>.ts`
- Call from `packages/core/src/runner.ts` `runCodelore()` function
- Include result in `CodeloreReport` return value

### Phase 3: CLI Integration

<Terminal UI changes — new flags, updated components>

**Tasks:**
- Add flag to `apps/cli/src/index.tsx` (if new CLI option)
- Update Ink components in `apps/cli/src/components/`

### Phase 4: Web Integration

<Dashboard changes — new tabs, updated data display>

**Tasks:**
- Add/update component in `apps/web/src/components/`
- Update `apps/web/src/components/Dashboard.tsx` if layout changes
- Only use `import type` from `@codelore/core`

---

## STEP-BY-STEP TASKS

Execute in order. Each task is atomic and independently testable.

### Task keywords
- **CREATE**: New file
- **UPDATE**: Modify existing file
- **ADD**: Insert into existing code
- **REMOVE**: Delete code
- **MIRROR**: Copy pattern from a specific file:line

---

### {ACTION} `{file-path}`

- **IMPLEMENT**: {specific detail}
- **PATTERN**: {reference file:line to mirror}
- **IMPORTS**: {required imports}
- **GOTCHA**: {known constraint or trap}
- **VALIDATE**: `{executable command}`

<continue for all tasks in dependency order>

---

## VALIDATION COMMANDS

Run all of these before considering the feature complete.

### Level 1: Type checking
\`\`\`bash
pnpm --filter @codelore/core build          # catches type errors in core
pnpm --filter @codelore/cli build           # catches type errors in cli
pnpm --filter @codelore/web build           # catches type errors in web
\`\`\`

### Level 2: Full build
\`\`\`bash
pnpm build                               # full turbo build in dependency order
\`\`\`

### Level 3: Manual validation
\`\`\`bash
node apps/cli/dist/index.js --path ~/path/to/small-repo
node apps/cli/dist/index.js --path ~/path/to/small-repo --web
node apps/cli/dist/index.js --path ~/path/to/small-repo --json
\`\`\`

### Level 4: Manual spot checks
<Feature-specific things to verify — terminal output, web dashboard, JSON output, etc.>

---

## ACCEPTANCE CRITERIA

- [ ] Feature implements all specified functionality
- [ ] All type checks pass (`pnpm build`)
- [ ] No regressions in existing analyzers or UI
- [ ] New analyzer called from `runCodelore()` (if applicable)
- [ ] Result included in `CodeloreReport` (if applicable)
- [ ] Web package uses only `import type` from core (if applicable)
- [ ] CLI renders new data correctly in Ink (if applicable)
- [ ] Web dashboard displays new data correctly (if applicable)

---

## NOTES

<Design decisions, trade-offs, anything the implementer should know>
```

---

## Output

**Save to**: `.claude/plans/{kebab-case-feature-name}.md`
**Create the directory** if it doesn't exist.

## Report

After writing the plan file, provide:

- Summary of feature and approach
- Which packages are affected and in what order
- Full path to the created plan file
- Complexity assessment
- Any blocked dependencies
- Confidence score (1–10) for one-pass implementation success
