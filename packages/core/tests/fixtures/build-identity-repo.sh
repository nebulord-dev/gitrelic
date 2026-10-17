#!/usr/bin/env bash
#
# Builds a deterministic git fixture for author-identity merging tests.
#
# Each person below commits under split identities that a naive email-keyed
# analysis would count as separate contributors:
#   - Dana Park:  renamed via .mailmap (old@corp.com "Old Name" → dana@corp.com)
#   - Josh Story: work email + GitHub noreply address (login "joshstory")
#   - Sam Lee:    same full name from a work and a personal email
#   - Alex ×2:    two *different* people sharing a single-word name (must NOT merge)
#   - dependabot: bot identity (must never merge by name)
#
# Usage: build-identity-repo.sh <target-path>

set -euo pipefail

REPO_PATH="${1:-}"
if [[ -z "$REPO_PATH" ]]; then
  echo "usage: $0 <target-path>" >&2
  exit 1
fi

rm -rf "$REPO_PATH"
mkdir -p "$REPO_PATH"
cd "$REPO_PATH"

git init --quiet --initial-branch=main
git config commit.gpgsign false
git config tag.gpgsign false
git config core.autocrlf false
mkdir -p .git/nohooks
git config core.hooksPath .git/nohooks

# commit <date> <email> <name> <file> <message>
commit() {
  local date="$1" email="$2" name="$3" file="$4" msg="$5"
  mkdir -p "$(dirname "$file")"
  echo "$msg" >> "$file"
  git add -A
  GIT_AUTHOR_DATE="$date" \
  GIT_COMMITTER_DATE="$date" \
  GIT_AUTHOR_EMAIL="$email" \
  GIT_AUTHOR_NAME="$name" \
  GIT_COMMITTER_EMAIL="$email" \
  GIT_COMMITTER_NAME="$name" \
  git commit --quiet -m "$msg"
}

cat > .mailmap <<'EOF'
Dana Park <dana@corp.com> Old Name <old@corp.com>
EOF

commit "2026-01-02T10:00:00+00:00" "old@corp.com" "Old Name" "src/core.ts" "feat: core scaffold"
commit "2026-01-05T10:00:00+00:00" "dana@corp.com" "Dana Park" "src/core.ts" "feat: core loop"
commit "2026-01-08T10:00:00+00:00" "dana@corp.com" "Dana Park" "src/core.ts" "fix: core edge"

commit "2026-01-10T11:00:00+00:00" "josh@corp.com" "Josh Story" "src/api.ts" "feat: api"
commit "2026-01-12T11:00:00+00:00" "josh@corp.com" "Josh Story" "src/api.ts" "feat: api routes"
commit "2026-01-13T11:00:00+00:00" "josh@corp.com" "Josh Story" "src/api.ts" "feat: api auth"
commit "2026-01-14T23:30:00+00:00" "12345+joshstory@users.noreply.github.com" "joshstory" "src/api.ts" "fix: api late-night patch"
commit "2026-01-15T11:00:00+00:00" "12345+joshstory@users.noreply.github.com" "joshstory" "src/api.ts" "fix: api retry"

commit "2026-01-16T09:00:00+00:00" "sam@work.com" "Sam Lee" "src/ui.ts" "feat: ui"
commit "2026-01-18T09:00:00+00:00" "sam@home.net" "Sam Lee" "src/ui.ts" "feat: ui theme"

commit "2026-01-20T09:00:00+00:00" "alex@a.com" "Alex" "docs/a.md" "docs: alex a"
commit "2026-01-21T09:00:00+00:00" "alex@b.com" "Alex" "docs/b.md" "docs: alex b"

commit "2026-01-22T09:00:00+00:00" "49699333+dependabot[bot]@users.noreply.github.com" "dependabot[bot]" "package.json" "chore(deps): bump"

# Sam co-authors with Josh's noreply identity — the trailer must be remapped too.
echo "pair" >> src/ui.ts
git add -A
GIT_AUTHOR_DATE="2026-01-24T09:00:00+00:00" \
GIT_COMMITTER_DATE="2026-01-24T09:00:00+00:00" \
GIT_AUTHOR_EMAIL="sam@work.com" \
GIT_AUTHOR_NAME="Sam Lee" \
GIT_COMMITTER_EMAIL="sam@work.com" \
GIT_COMMITTER_NAME="Sam Lee" \
git commit --quiet -m "feat: paired ui work

Co-authored-by: joshstory <12345+joshstory@users.noreply.github.com>"

# Sam credits Dana under her pre-.mailmap identity. git applies .mailmap to
# authors but not to trailers, so this must be mapped explicitly.
echo "review" >> src/ui.ts
git add -A
GIT_AUTHOR_DATE="2026-01-26T09:00:00+00:00" \
GIT_COMMITTER_DATE="2026-01-26T09:00:00+00:00" \
GIT_AUTHOR_EMAIL="sam@work.com" \
GIT_AUTHOR_NAME="Sam Lee" \
GIT_COMMITTER_EMAIL="sam@work.com" \
GIT_COMMITTER_NAME="Sam Lee" \
git commit --quiet -m "fix: review follow-ups

Co-authored-by: Old Name <old@corp.com>"
