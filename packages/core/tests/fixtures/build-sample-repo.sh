#!/usr/bin/env bash
#
# Builds a deterministic git fixture repository for gitlore snapshot tests.
#
# Every author identity, date, and message is pinned so commit hashes and
# analyzer outputs remain stable across runs and machines. The resulting
# repo exercises most analyzers: multi-author ownership, single-author
# hotspots, shame-keyword commits, file renames, coupled changes, and a
# ghost contributor who stops committing mid-timeline.
#
# Usage: build-sample-repo.sh <target-path>

set -euo pipefail

REPO_PATH="${1:-}"
if [[ -z "$REPO_PATH" ]]; then
  echo "usage: $0 <target-path>" >&2
  exit 1
fi

rm -rf "$REPO_PATH"
mkdir -p "$REPO_PATH"
cd "$REPO_PATH"

# Force-initialize a clean, portable repo. --initial-branch keeps the branch
# name stable regardless of the user's global init.defaultBranch setting.
git init --quiet --initial-branch=main
git config commit.gpgsign false
git config tag.gpgsign false
git config core.autocrlf false
# Point core.hooksPath at an empty dir so nothing the user has configured
# (templates, pre-commit hooks) can perturb the fixture.
mkdir -p .git/nohooks
git config core.hooksPath .git/nohooks

# ── Commit helper ────────────────────────────────────────────────────────────
commit() {
  local date="$1"
  local email="$2"
  local name="$3"
  local msg="$4"
  GIT_AUTHOR_DATE="$date" \
  GIT_COMMITTER_DATE="$date" \
  GIT_AUTHOR_EMAIL="$email" \
  GIT_AUTHOR_NAME="$name" \
  GIT_COMMITTER_EMAIL="$email" \
  GIT_COMMITTER_NAME="$name" \
  git commit --quiet -m "$msg"
}

# ── 2026-01-01  Alice: initial structure ─────────────────────────────────────
mkdir -p src
cat > src/index.ts <<'EOF'
import { loadConfig } from './config.js';
import { helpGreet } from './utils.js';

export function main() {
  const config = loadConfig();
  return helpGreet(config.name);
}
EOF

cat > src/utils.ts <<'EOF'
export function helpGreet(name: string): string {
  return `hello, ${name}`;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}
EOF

cat > src/config.ts <<'EOF'
export interface Config {
  name: string;
  version: string;
}

export function loadConfig(): Config {
  return { name: 'sample', version: '0.1.0' };
}
EOF

cat > README.md <<'EOF'
# sample

A deterministic gitlore fixture.
EOF

cat > package.json <<'EOF'
{
  "name": "sample",
  "version": "0.1.0",
  "private": true
}
EOF

git add .
commit "2026-01-01T09:00:00+00:00" "alice@example.com" "Alice" "feat: initial project scaffold"

# ── 2026-01-05  Charlie: adds auth module ────────────────────────────────────
cat > src/auth.ts <<'EOF'
export function verifyToken(token: string): boolean {
  return token.length > 10;
}

export function hashPassword(pw: string): string {
  return `hashed:${pw}`;
}
EOF

git add .
commit "2026-01-05T14:30:00+00:00" "charlie@example.com" "Charlie" "feat: add auth module"

# ── 2026-01-10  Alice: adds api, coupled to config ───────────────────────────
cat > src/api.ts <<'EOF'
import { loadConfig } from './config.js';

export function getVersion() {
  return loadConfig().version;
}
EOF

cat >> src/config.ts <<'EOF'

export const DEFAULT_TIMEOUT = 30;
EOF

git add .
commit "2026-01-10T10:15:00+00:00" "alice@example.com" "Alice" "feat: add api with config dependency"

# ── 2026-01-15  Bob: joins the project ───────────────────────────────────────
cat > src/types.ts <<'EOF'
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
EOF

git add .
commit "2026-01-15T16:45:00+00:00" "bob@example.com" "Bob" "feat: add shared Result type"

# ── 2026-01-20  Alice: fixup on utils ────────────────────────────────────────
cat > src/utils.ts <<'EOF'
export function helpGreet(name: string): string {
  return `hello, ${name}!`;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}

export function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
EOF

git add .
commit "2026-01-20T11:00:00+00:00" "alice@example.com" "Alice" "fix: typo in greeting"

# ── 2026-01-25  Charlie: auth bugfix ─────────────────────────────────────────
cat > src/auth.ts <<'EOF'
export function verifyToken(token: string): boolean {
  if (!token) return false;
  return token.length > 10;
}

export function hashPassword(pw: string): string {
  return `hashed:${pw}`;
}
EOF

git add .
commit "2026-01-25T20:30:00+00:00" "charlie@example.com" "Charlie" "fix: auth null token bug"

# ── 2026-02-01  Alice: churn on config + api ─────────────────────────────────
cat > src/config.ts <<'EOF'
export interface Config {
  name: string;
  version: string;
  timeout: number;
}

export function loadConfig(): Config {
  return { name: 'sample', version: '0.2.0', timeout: 30 };
}

export const DEFAULT_TIMEOUT = 30;
EOF

cat > src/api.ts <<'EOF'
import { loadConfig } from './config.js';

export function getVersion() {
  return loadConfig().version;
}

export function getTimeout() {
  return loadConfig().timeout;
}
EOF

git add .
commit "2026-02-01T09:45:00+00:00" "alice@example.com" "Alice" "feat: extend config with timeout"

# ── 2026-02-05  Charlie: LAST COMMIT before becoming a ghost ─────────────────
cat > src/auth.ts <<'EOF'
export function verifyToken(token: string): boolean {
  if (!token) return false;
  if (token.length < 10) return false;
  return true;
}

export function hashPassword(pw: string): string {
  return `hashed:${pw}`;
}

export function generateSalt(): string {
  return 'deadbeef';
}
EOF

git add .
commit "2026-02-05T23:15:00+00:00" "charlie@example.com" "Charlie" "fix: auth race condition workaround"

# ── 2026-02-10  Alice: rename utils -> helpers ───────────────────────────────
git mv src/utils.ts src/helpers.ts
# Update the import in index.ts to use the renamed file.
cat > src/index.ts <<'EOF'
import { loadConfig } from './config.js';
import { helpGreet } from './helpers.js';

export function main() {
  const config = loadConfig();
  return helpGreet(config.name);
}
EOF

git add .
commit "2026-02-10T13:20:00+00:00" "alice@example.com" "Alice" "refactor: rename utils to helpers"

# ── 2026-02-15  Bob: adds test file ──────────────────────────────────────────
mkdir -p src/__tests__
cat > src/__tests__/api.test.ts <<'EOF'
import { getVersion } from '../api.js';

describe('api', () => {
  it('returns a version', () => {
    expect(getVersion()).toBeTruthy();
  });
});
EOF

git add .
commit "2026-02-15T15:00:00+00:00" "bob@example.com" "Bob" "test: add api smoke test"

# ── 2026-02-20  Alice: hack workaround on helpers + config (coupled) ─────────
cat > src/helpers.ts <<'EOF'
export function helpGreet(name: string): string {
  // HACK: temporary fallback for empty names
  return `hello, ${name || 'friend'}!`;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}

export function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
EOF

cat >> src/config.ts <<'EOF'

export const FALLBACK_NAME = 'friend';
EOF

git add .
commit "2026-02-20T08:30:00+00:00" "alice@example.com" "Alice" "hack: workaround for empty names"

# ── 2026-02-25  Alice: revert the workaround ─────────────────────────────────
cat > src/helpers.ts <<'EOF'
export function helpGreet(name: string): string {
  return `hello, ${name}!`;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}

export function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}
EOF

git add .
commit "2026-02-25T17:00:00+00:00" "alice@example.com" "Alice" "revert: remove name fallback hack"

# ── 2026-03-01  Alice: big cleanup touching everything ───────────────────────
cat > src/index.ts <<'EOF'
import { loadConfig } from './config.js';
import { helpGreet, capitalize } from './helpers.js';
import { getVersion } from './api.js';

export function main() {
  const config = loadConfig();
  const greeting = helpGreet(capitalize(config.name));
  return `${greeting} (v${getVersion()})`;
}
EOF

cat > src/api.ts <<'EOF'
import { loadConfig } from './config.js';
import type { Result } from './types.js';

export function getVersion(): string {
  return loadConfig().version;
}

export function getTimeout(): number {
  return loadConfig().timeout;
}

export function describeConfig(): Result<string> {
  const c = loadConfig();
  return { ok: true, value: `${c.name}@${c.version}` };
}
EOF

cat > src/helpers.ts <<'EOF'
export function helpGreet(name: string): string {
  return `hello, ${name}!`;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-');
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}
EOF

git add .
commit "2026-03-01T10:00:00+00:00" "alice@example.com" "Alice" "refactor: cross-module cleanup"

# ── 2026-03-05  Bob: docs ────────────────────────────────────────────────────
mkdir -p docs
cat > docs/USAGE.md <<'EOF'
# Usage

Import the main function and call it.
EOF

git add .
commit "2026-03-05T14:00:00+00:00" "bob@example.com" "Bob" "docs: add usage notes"

# ── 2026-03-10  Alice: churn on helpers + index (coupled) ────────────────────
cat > src/helpers.ts <<'EOF'
export function helpGreet(name: string): string {
  return `hello, ${name || 'friend'}!`;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
EOF

cat > src/index.ts <<'EOF'
import { loadConfig } from './config.js';
import { helpGreet, capitalize, truncate } from './helpers.js';
import { getVersion } from './api.js';

export function main() {
  const config = loadConfig();
  const greeting = helpGreet(capitalize(config.name));
  return truncate(`${greeting} (v${getVersion()})`, 80);
}
EOF

git add .
commit "2026-03-10T09:30:00+00:00" "alice@example.com" "Alice" "feat: add truncate helper"

# ── 2026-03-15  Alice: hotfix on helpers ─────────────────────────────────────
cat > src/helpers.ts <<'EOF'
export function helpGreet(name: string): string {
  return `hello, ${name || 'friend'}!`;
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

export function truncate(s: string, n: number): string {
  if (n <= 0) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}
EOF

git add .
commit "2026-03-15T16:45:00+00:00" "alice@example.com" "Alice" "hotfix: truncate handles zero length"

# ── 2026-03-20  Alice: types expand ──────────────────────────────────────────
cat > src/types.ts <<'EOF'
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type Maybe<T> = T | null | undefined;

export interface Named {
  name: string;
}
EOF

git add .
commit "2026-03-20T11:15:00+00:00" "alice@example.com" "Alice" "feat: extend shared types"

# ── 2026-03-25  Bob: more tests ──────────────────────────────────────────────
cat > src/__tests__/api.test.ts <<'EOF'
import { getVersion, describeConfig } from '../api.js';

describe('api', () => {
  it('returns a version', () => {
    expect(getVersion()).toBeTruthy();
  });

  it('describes config', () => {
    const r = describeConfig();
    expect(r.ok).toBe(true);
  });
});
EOF

git add .
commit "2026-03-25T13:00:00+00:00" "bob@example.com" "Bob" "test: cover describeConfig"

# ── 2026-04-01  Alice: final churn on helpers ────────────────────────────────
cat > src/helpers.ts <<'EOF'
export function helpGreet(name: string): string {
  return `hello, ${name || 'friend'}!`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function capitalize(s: string): string {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

export function truncate(s: string, n: number): string {
  if (n <= 0) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function repeat(s: string, n: number): string {
  return n <= 0 ? '' : s.repeat(n);
}
EOF

git add .
commit "2026-04-01T08:00:00+00:00" "alice@example.com" "Alice" "feat: add repeat helper"

# ── 2026-04-05  Alice: touches index and api together (coupling) ─────────────
cat > src/index.ts <<'EOF'
import { loadConfig } from './config.js';
import { helpGreet, capitalize, truncate } from './helpers.js';
import { getVersion, describeConfig } from './api.js';

export function main(): string {
  const config = loadConfig();
  const greeting = helpGreet(capitalize(config.name));
  const desc = describeConfig();
  const label = desc.ok ? desc.value : 'unknown';
  return truncate(`${greeting} — ${label} (v${getVersion()})`, 120);
}
EOF

cat > src/api.ts <<'EOF'
import { loadConfig } from './config.js';
import type { Result } from './types.js';

export function getVersion(): string {
  return loadConfig().version;
}

export function getTimeout(): number {
  return loadConfig().timeout;
}

export function describeConfig(): Result<string> {
  const c = loadConfig();
  if (!c.name) return { ok: false, error: 'no name' };
  return { ok: true, value: `${c.name}@${c.version}` };
}
EOF

git add .
commit "2026-04-05T15:30:00+00:00" "alice@example.com" "Alice" "refactor: enrich main output"
