---
description: Review recent changes and propose documentation updates across READMEs and CLAUDE.md
---

# Sync Docs

## Objective

Review what changed in this session and determine which documentation files need updating. Propose specific changes before writing anything — don't auto-apply.

---

## Process

### Step 1: Gather What Changed

Run these to understand the session's work:

```bash
git log --oneline -20
git diff HEAD~${0:-5}..HEAD --stat
git diff HEAD~${0:-5}..HEAD
```

If $ARGUMENTS specifies a commit range or number of commits, use that. Otherwise default to the last 5 commits.

### Step 2: Categorise the Changes

For each changed file or area, determine what kind of change it is:

| Change type | Triggers doc update in... |
|-------------|--------------------------|
| New analyzer added | `CLAUDE.md` (package breakdown), `README.md` (feature list) |
| Analyzer threshold changed | `README.md` (if scoring is documented) |
| New CLI flag or option | `CLAUDE.md` (testing locally section), `README.md` (usage) |
| `types.ts` changed | `CLAUDE.md` (if type names changed) |
| `runner.ts` changed | `CLAUDE.md` (runner description) |
| New web dashboard tab | `CLAUDE.md` (web section), `README.md` |
| Git primitives changed (`utils/git.ts`) | `CLAUDE.md` (data source section) |
| Ignore list / filter logic added | `CLAUDE.md` (key concepts), `README.md` |
| Build/tooling change | `CLAUDE.md` (build commands), `README.md` |
| New kanban tasks added | No doc update needed — kanban is self-documenting |

### Step 3: Read the Potentially Affected Docs

Read each doc that might need updating. Don't propose changes based on assumptions — read the current content first.

Docs to check (read only the ones relevant to what changed):

- `CLAUDE.md` — AI navigation guide: architecture overview, package breakdown, key concepts, build commands
- `README.md` — root README: features list, usage, what GitLore analyzes
- `.claude/kanban.md` — task board (only update if tasks were completed or new ones discovered)

### Step 4: Evaluate Each Doc

For each potentially affected doc, answer:

1. **Is it out of date?** Does the current content accurately reflect what was just built?
2. **Is the gap meaningful?** Would a contributor or future developer be misled or blocked by the outdated content?
3. **What specifically needs changing?** Line-level — not "update the README" but "the analyzer list in CLAUDE.md is missing the new X analyzer" or "the CLI flags section doesn't mention --since default"

Skip docs where the changes are cosmetic, already covered, or where the gap is so minor it would add noise rather than value.

### Step 5: Present Findings

Present a clear summary before touching anything:

```
## Doc Sync Report

### Changes This Session
- Brief bullet list of what was built/changed

### Docs That Need Updating

#### CLAUDE.md
- **Why**: [specific reason]
- **What**: [exactly what to add/change/remove]

#### README.md
- **Why**: ...
- **What**: ...

### Docs That Look Fine
- `.claude/kanban.md` — already updated during session
- (etc.)

### Proposed Actions
1. Update CLAUDE.md — [one-line description]
2. Update README.md — [one-line description]
```

Ask: **"Should I go ahead and make these updates?"**

### Step 6: Apply Approved Updates

Only after confirmation — make the specific changes identified. Don't refactor, expand, or improve sections beyond what's needed. Edit surgically.

After updating, commit:

```bash
git add <changed doc files>
git commit -m "docs: sync documentation with recent session changes"
```

---

## What This Skill Is NOT

- Not a full doc rewrite — surgical updates only
- Not a style pass — don't reformat things that don't need changing
- Not proactive content generation — only document things that were actually built
- Not a substitute for updating docs during a session when the change is obvious — use this for catching things that slipped through
