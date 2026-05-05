// Web-side mirror of packages/core/src/utils/authorClassification.ts
//
// The web app may only `import type` from @gitrelic/core (CLAUDE.md rule —
// value imports leak Node-only deps like execa into the browser bundle).
// These pure-function variants of the classification logic let the web
// classify emails and resolve display names without crossing that line.
// Keep the AI / bot patterns in sync with the core utility.

import type { AuthorClass, Contributor } from '@gitrelic/core';

interface AiPattern {
  match: RegExp;
  productName: string;
}

const AI_PATTERNS: AiPattern[] = [
  { match: /^noreply@anthropic\.com$/i, productName: 'Claude' },
  {
    match: /^copilot(\[bot\])?@.*\.noreply\.github\.com$/i,
    productName: 'GitHub Copilot',
  },
  { match: /^aider@aider\.chat$/i, productName: 'Aider' },
  {
    match: /^devin-ai-integration\[bot\]@.*\.noreply\.github\.com$/i,
    productName: 'Devin',
  },
  { match: /@cursor\.sh$/i, productName: 'Cursor' },
];

const BOT_PATTERNS: RegExp[] = [
  // Anchored on `@` so a real human (e.g. dependabot.intern@example.com)
  // doesn't silently classify as a bot. Same for renovate / semantic-release.
  /^dependabot(\[bot\])?@/i,
  /^renovate(\[bot\])?@/i,
  /^semantic-release(-bot)?@/i,
  /\[bot\]@.*\.noreply\.github\.com$/i,
  /^github-actions\[bot\]@/i,
];

export function isAiEmail(email: string): boolean {
  return AI_PATTERNS.some((p) => p.match.test(email));
}

export function isBotEmail(email: string): boolean {
  return BOT_PATTERNS.some((p) => p.test(email));
}

export function classifyAuthor(email: string): AuthorClass {
  if (isAiEmail(email)) return 'ai';
  if (isBotEmail(email)) return 'bot';
  return 'human';
}

export function aiProductName(email: string): string | null {
  for (const pattern of AI_PATTERNS) {
    if (pattern.match.test(email)) return pattern.productName;
  }
  return null;
}

// Resolution order: AI product name → contributors map → email fallback.
// Empty email returns `(unknown)` so blank labels never reach the UI.
export function resolveAuthorDisplayName(
  email: string,
  contributors: Contributor[],
): string {
  if (!email) return '(unknown)';
  const product = aiProductName(email);
  if (product) return product;

  const match = contributors.find(
    (c) => c.email.toLowerCase() === email.toLowerCase(),
  );
  if (match && match.name) return match.name;

  return email;
}
