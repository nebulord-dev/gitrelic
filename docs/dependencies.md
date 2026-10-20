# Dependency hygiene

The full guide behind the short rules in the root `CLAUDE.md`.

GitRelic has three dependency surfaces and each is scanned / updated differently:

1. **Per-package `dependencies` / `devDependencies`** in `packages/core`, `apps/cli`, `apps/web`, `apps/docs`
2. **Workspace catalog** in `pnpm-workspace.yaml` (shared `typescript`, `tsdown`, `vitest`, `@types/*`, etc.)
3. **pnpm overrides** in root `package.json` (narrow pins for security / compat — e.g. `vitepress>vite`)

## `pnpm outdated` vs `taze`

They answer different questions — use both.

- **`pnpm -r outdated`** — "Is my **installed** version behind the latest?" Reads the lockfile. Reports nothing if your declared range (e.g. `^9.5.2`) already resolves to the current latest (`9.6.1`). Great for catching real upgrades available without range-bumping.
- **`pnpm dlx taze -r`** — "Is my **declared range** behind the latest?" Reads `package.json`. Flags `^9.5.2` even if the resolved install is already `9.6.1`, because the floor of the range is stale. Also understands catalog entries. Runs with `npx taze -r` too.

Both tools together give the full picture. Taze also has a known parse error on pnpm's range-selector override keys (`picomatch@>=4.0.0 <4.0.4`) — harmless, the report above the error is complete.

## Bumping

```bash
pnpm -r update --latest <pkg>        # rewrites package.json ranges AND lockfile (-L short form)
pnpm -r up -L --interactive          # pick-list — use this for anything majorish
```

- `pnpm update` (no `--latest`) only refreshes within the existing range — it won't raise the declared floor
- `pnpm -r up -L` does NOT touch the workspace catalog; bump `pnpm-workspace.yaml` by hand (or use taze)
- Overrides in root `package.json` are also invisible to `pnpm update` — edit directly

## Bundled-deps mirror discipline

When bumping any runtime dep in `packages/core`, bump the matching entry in `apps/cli/package.json` in the **same commit**. The `install-smoke` CI job (and the same step in `publish.yml`) compares `name@range` pairs, so a missing dep *or* a drifted range fails the build.

`pnpm -r up -L <pkg>` handles this automatically when both packages declare the dep (common case: `execa`).

## Why `vitepress>vite` is pinned to vite 6

That override is **scoped** — it only pins vite **where vitepress depends on it**, not the top-level vite used by `apps/web`. VitePress 1.x was built against vite 6; vite 7+ has breaking changes VitePress 1.x never absorbed. The lockfile happily holds both `vite@6.4.x` (inside vitepress) and `vite@8.x` (for `apps/web`). Taze will flag the top-level vite range even though the override pins a different vite instance to 6 — that's not drift, it's two separate vites in the graph. Drop the override only when moving to VitePress 2.x (which supports vite 7+).

The heading deliberately says "vite 6" rather than a patch version — the pin gets bumped on every vite 6 security patch, and a version in the heading goes stale immediately.

## Security overrides

`package.json` is JSON and can't hold comments, so the advisory backing each security override is recorded here. Without this table nobody can tell whether a boundary is correct, or when a pin becomes safe to drop.

| Override | Advisories | Drop when |
| --- | --- | --- |
| `ws@>=8.0.0 <8.21.0` | GHSA-96hv-2xvq-fx4p, GHSA-58qx-3vcg-4xpx | `ink` ships a release resolving ws ≥ 8.21.0 |
| `undici@>=6.0.0 <6.28.1` | GHSA-8xcm-r25x-g524, GHSA-m8rv-5g2x-5cg5, GHSA-v3r7-h72x-cjcm, GHSA-35p6-xmwp-9g52, GHSA-g8m3-5g58-fq7m, GHSA-p88m-4jfj-68fv, GHSA-3wwx-pv8p-q78v, GHSA-r53p-7pc4-xj5r, GHSA-rfgv-xxqx-mfg5 | `semantic-release` → `@actions/core` drops undici 6 |
| `undici@>=7.0.0 <7.29.1` | GHSA-4cwx-7wf7-3272, GHSA-jr45-8vmc-qm54, GHSA-hm92-r4w5-c3mj, GHSA-vmh5-mc38-953g, GHSA-pr7r-676h-xcf6, GHSA-3wwx-pv8p-q78v, GHSA-pmjh-fq2x-6v4x, GHSA-r53p-7pc4-xj5r, GHSA-rfgv-xxqx-mfg5, GHSA-3xpg-4rpp-hhhm, GHSA-2jfj-6hjv-fm6j, GHSA-2gqq-gqf2-x968, GHSA-w293-vg96-wgc3, GHSA-8436-99hf-9mmv, GHSA-rx4f-c7p8-82vq | `@semantic-release/github` requires undici ≥ 7.29.1 |
| `js-yaml@>=4.0.0 <4.3.2` | GHSA-5p4m-2wfm-xmqj, GHSA-52cp-r559-cp3m, GHSA-h67p-54hq-rp68, GHSA-2883-xcg3-v3hh | `cosmiconfig` requires js-yaml ≥ 4.3.2 |
| `postcss@>=8.0.0 <8.5.23` | GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 | vitepress/vue toolchain resolves postcss ≥ 8.5.23 |
| `dompurify@>=3.0.0 <3.4.16` | GHSA-55q2-fjhq-7xh7, GHSA-c2j3-45gr-mqc4, GHSA-p98j-92pf-mc4p, GHSA-6688-9rhm-gjv2 | `mermaid` requires dompurify ≥ 3.4.16 |
| `esbuild@>=0.27.3 <0.28.1` | GHSA-g7r4-m6w7-qqqr | nothing in the tree can match the selector (see below) |
| `vitepress>vite` | GHSA-fx2h-pf6j-xcff, GHSA-v6wh-96g9-6wx3 | moving to VitePress 2.x |

## Ignored advisories

`pnpm.auditConfig.ignoreGhsas` in `package.json` silences advisories that have no usable fix and no reachable attack path. Each one needs a row here, and drops out the moment its condition clears. Don't add to the list just to make `pnpm audit` quiet.

| Advisory | Package / path | Why ignored | Revisit when |
| --- | --- | --- | --- |
| GHSA-vfj7-8cjw-p6xm (high) | `braces` ≤ 3.0.3 via `@semantic-release/git` → `micromatch` | No patched release exists. The DoS needs attacker-controlled glob patterns; the only patterns are the two hardcoded `assets` in `.releaserc.json`, run in CI. | `braces` ships a fix, or `@semantic-release/git` drops micromatch |
| GHSA-238p-pmpm-9mq7 (low) | `katex` < 0.18.2 via `apps/docs` → `mermaid` | Fix is katex 0.18, but mermaid 11 pins `^0.16` — overriding would force a breaking line on it. Docs-site only, needs pre-existing prototype pollution, and we author every diagram. | `mermaid` 11.x widens to katex ≥ 0.18.2, or docs move to mermaid 12 |

**Always bound the lower end at the major.** Write `ws@>=8.0.0 <8.21.0`, never `ws@<8.21.0`. A bare `<X` selector also matches every earlier major, so the override would silently force a major upgrade on any future transitive that pulls an older line — a breaking change disguised as a security pin. Nothing in the tree triggers it today, which is exactly why it would be missed. The `postcss` and `dompurify` entries are narrowed to the 8.x / 3.x lines for this reason even though their advisories nominally cover everything below the patched version.

**The `esbuild` override is a tripwire, not an upgrade.** esbuild is an *optional* `peerDependency` of vite 8, and vite 8 bundles rolldown as its actual bundler — it never calls esbuild. Narrowing the peer range caused pnpm to **drop** esbuild and its 26 `@esbuild/*` platform packages from the vite 8 subtree rather than install 0.28.1. That's the desired outcome (the vulnerable copy is gone, builds verified green), but it means no esbuild in the tree matches the selector anymore. Leave it in place as a guard against a future dep reintroducing a 0.27.x. The separate `esbuild@<0.25.0` floor and the surviving `esbuild@0.25.12` under vite 6 are unrelated and not vulnerable — GHSA-g7r4-m6w7-qqqr starts at 0.27.3.

Regenerate this table from the live feed with:

```bash
gh api repos/nebulord-dev/gitrelic/dependabot/alerts --paginate \
  -q '.[] | select(.state=="open") | "\(.dependency.package.name)\t\(.security_advisory.ghsa_id)\t\(.security_vulnerability.vulnerable_version_range)"' | sort -u
```

