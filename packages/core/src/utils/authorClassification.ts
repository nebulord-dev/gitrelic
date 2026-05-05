export type AuthorClass = 'human' | 'ai' | 'bot';

interface Pattern {
  match: RegExp;
  productName?: string;
}

const AI_PATTERNS: Pattern[] = [
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

const BOT_PATTERNS: Pattern[] = [
  // Anchored on `@` so a real human (e.g. dependabot.intern@example.com)
  // doesn't silently classify as a bot. Same for renovate / semantic-release.
  { match: /^dependabot(\[bot\])?@/i },
  { match: /^renovate(\[bot\])?@/i },
  { match: /^semantic-release(-bot)?@/i },
  // Catch-all: any [bot] account on GitHub's noreply domain that survived AI patterns
  { match: /\[bot\]@.*\.noreply\.github\.com$/i },
  // github-actions on a non-noreply domain (rare but possible)
  { match: /^github-actions\[bot\]@/i },
];

export function classifyAuthor(email: string): AuthorClass {
  if (isAiEmail(email)) return 'ai';
  if (isBotEmail(email)) return 'bot';
  return 'human';
}

export function isAiEmail(email: string): boolean {
  return AI_PATTERNS.some((p) => p.match.test(email));
}

export function isBotEmail(email: string): boolean {
  return BOT_PATTERNS.some((p) => p.match.test(email));
}

export function aiProductName(email: string): string | null {
  for (const pattern of AI_PATTERNS) {
    if (pattern.match.test(email)) return pattern.productName ?? null;
  }
  return null;
}
