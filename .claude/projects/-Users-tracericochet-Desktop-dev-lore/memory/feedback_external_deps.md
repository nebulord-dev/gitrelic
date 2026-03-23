---
name: external-deps-ok
description: User is open to external tool dependencies (cloc, madge, etc.) — don't limit to "pure git" principle from early days
type: feedback
---

The original "no external tool dependencies — pure git" principle was a starting constraint, not a permanent rule. The project has matured and the user is open to wrapping proven tools (cloc, madge, git-sizer, etc.) rather than reinventing them.

**Why:** Avoiding wheel reinvention. Tools like cloc solve hard problems (250+ language comment parsing) that aren't worth rebuilding. Limiting to pure git was appropriate at the start but shouldn't constrain growth.

**How to apply:** When proposing new analyzers, prefer wrapping established tools over building from scratch. Still keep graceful fallbacks if a tool isn't installed, but don't treat external deps as a design smell.
