export type AuthorClass = 'human' | 'ai' | 'bot';

interface Pattern {
  match: RegExp;
  productName?: string;
}

const AI_PATTERNS: Pattern[] = [
  // Claude Code's trailer, and the Claude GitHub app when it commits itself.
  { match: /^noreply@anthropic\.com$/i, productName: 'Claude' },
  {
    match: /^(\d+\+)?claude\[bot\]@users\.noreply\.github\.com$/i,
    productName: 'Claude',
  },
  // GitHub app accounts are `<id>+<login>@users.noreply.github.com`; the
  // id prefix is optional in each pattern. Copilot's coding agent commits as
  // `<id>+Copilot@…` or `copilot-swe-agent[bot]`.
  {
    match: /^(\d+\+)?copilot(-swe-agent)?(\[bot\])?@.*\.noreply\.github\.com$/i,
    productName: 'GitHub Copilot',
  },
  { match: /^aider@aider\.chat$/i, productName: 'Aider' },
  {
    match: /^(\d+\+)?devin-ai-integration\[bot\]@.*\.noreply\.github\.com$/i,
    productName: 'Devin',
  },
  // Only Cursor's agent on cursor.com: its staff commit from there too.
  { match: /@cursor\.sh$|^cursoragent@cursor\.com$/i, productName: 'Cursor' },
  { match: /^amp@ampcode\.com$/i, productName: 'Amp' },
  {
    match: /^(\d+\+)?google-labs-jules\[bot\]@users\.noreply\.github\.com$/i,
    productName: 'Jules',
  },
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
