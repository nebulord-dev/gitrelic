import { describe, it, expect } from 'vitest';

import {
  aiProductName,
  classifyAuthor,
  isAiEmail,
  isBotEmail,
  resolveAuthorDisplayName,
} from './authorClassification';
import type { Contributor } from '@gitrelic/core';

function makeContributor(email: string, name: string): Contributor {
  return {
    email,
    name,
    commitCount: 0,
    firstCommit: '',
    lastCommit: '',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 0,
    focusAreas: [],
    isActive: true,
    isGhost: false,
  };
}

describe('classifyAuthor', () => {
  it.each([
    ['noreply@anthropic.com', 'ai'],
    ['copilot[bot]@users.noreply.github.com', 'ai'],
    ['aider@aider.chat', 'ai'],
    ['agent@cursor.sh', 'ai'],
    ['dependabot[bot]@users.noreply.github.com', 'bot'],
    ['semantic-release-bot@martynus.net', 'bot'],
    ['alice@example.com', 'human'],
  ])('classifies %s as %s', (email, klass) => {
    expect(classifyAuthor(email)).toBe(klass);
  });
});

describe('isAiEmail / isBotEmail', () => {
  it('isAiEmail true only for AI', () => {
    expect(isAiEmail('noreply@anthropic.com')).toBe(true);
    expect(isAiEmail('alice@example.com')).toBe(false);
    expect(isAiEmail('dependabot[bot]@users.noreply.github.com')).toBe(false);
  });

  it('isBotEmail true only for bots', () => {
    expect(isBotEmail('semantic-release-bot@martynus.net')).toBe(true);
    expect(isBotEmail('alice@example.com')).toBe(false);
    expect(isBotEmail('noreply@anthropic.com')).toBe(false);
  });
});

describe('aiProductName', () => {
  it.each([
    ['noreply@anthropic.com', 'Claude'],
    ['copilot[bot]@users.noreply.github.com', 'GitHub Copilot'],
    ['aider@aider.chat', 'Aider'],
    ['agent@cursor.sh', 'Cursor'],
  ])('returns the product name for %s', (email, name) => {
    expect(aiProductName(email)).toBe(name);
  });

  it('returns null for human / bot / unknown emails', () => {
    expect(aiProductName('alice@example.com')).toBeNull();
    expect(aiProductName('semantic-release-bot@martynus.net')).toBeNull();
  });
});

describe('resolveAuthorDisplayName', () => {
  it('returns the AI product name for known AI emails', () => {
    expect(resolveAuthorDisplayName('noreply@anthropic.com', [])).toBe(
      'Claude',
    );
  });

  it('AI product name wins even when a contributor entry exists', () => {
    // Defensive — if a repo somehow has a contributor row keyed to an AI email,
    // we still prefer the product name (more honest signal in the UI).
    const contributors = [
      makeContributor('noreply@anthropic.com', 'Should Not Win'),
    ];
    expect(
      resolveAuthorDisplayName('noreply@anthropic.com', contributors),
    ).toBe('Claude');
  });

  it('resolves the human name from the contributors map', () => {
    const contributors = [makeContributor('alice@co.com', 'Alice Smith')];
    expect(resolveAuthorDisplayName('alice@co.com', contributors)).toBe(
      'Alice Smith',
    );
  });

  it('matches contributor email case-insensitively', () => {
    const contributors = [makeContributor('Alice@co.com', 'Alice Smith')];
    expect(resolveAuthorDisplayName('alice@co.com', contributors)).toBe(
      'Alice Smith',
    );
  });

  it('falls back to the email when no contributor or AI match', () => {
    expect(resolveAuthorDisplayName('bob@example.com', [])).toBe(
      'bob@example.com',
    );
  });

  it('falls back to the email when contributor name is empty', () => {
    const contributors = [makeContributor('bob@co.com', '')];
    expect(resolveAuthorDisplayName('bob@co.com', contributors)).toBe(
      'bob@co.com',
    );
  });
});
