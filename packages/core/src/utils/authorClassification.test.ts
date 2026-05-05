import { describe, it, expect } from 'vitest';

import {
  classifyAuthor,
  isAiEmail,
  isBotEmail,
  aiProductName,
} from './authorClassification.js';

describe('authorClassification', () => {
  describe('AI emails', () => {
    it.each([
      ['noreply@anthropic.com', 'Claude'],
      ['copilot[bot]@users.noreply.github.com', 'GitHub Copilot'],
      ['copilot@users.noreply.github.com', 'GitHub Copilot'],
      ['aider@aider.chat', 'Aider'],
      ['devin-ai-integration[bot]@users.noreply.github.com', 'Devin'],
      ['agent@cursor.sh', 'Cursor'],
    ])('classifies %s as AI with productName=%s', (email, productName) => {
      expect(classifyAuthor(email)).toBe('ai');
      expect(isAiEmail(email)).toBe(true);
      expect(aiProductName(email)).toBe(productName);
    });

    it('classifies generic *ai*[bot]@... as AI without product name', () => {
      const email = 'futureai[bot]@users.noreply.github.com';
      expect(classifyAuthor(email)).toBe('ai');
      expect(aiProductName(email)).toBeNull();
    });

    it('AI patterns evaluate before bot patterns (specificity wins)', () => {
      const email = 'dependabot-ai[bot]@users.noreply.github.com';
      expect(classifyAuthor(email)).toBe('ai');
    });
  });

  describe('bot emails', () => {
    it.each([
      'dependabot[bot]@users.noreply.github.com',
      'renovate[bot]@users.noreply.github.com',
      'semantic-release-bot@martynus.net',
      'github-actions[bot]@users.noreply.github.com',
    ])('classifies %s as bot', (email) => {
      expect(classifyAuthor(email)).toBe('bot');
      expect(isBotEmail(email)).toBe(true);
      expect(aiProductName(email)).toBeNull();
    });
  });

  describe('human emails', () => {
    it.each([
      'alice@example.com',
      'bob@protonmail.com',
      'sebastian.silbermann@vercel.com',
    ])('classifies %s as human', (email) => {
      expect(classifyAuthor(email)).toBe('human');
      expect(isAiEmail(email)).toBe(false);
      expect(isBotEmail(email)).toBe(false);
      expect(aiProductName(email)).toBeNull();
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase emails for AI patterns', () => {
      expect(classifyAuthor('NOREPLY@ANTHROPIC.COM')).toBe('ai');
      expect(aiProductName('NOREPLY@ANTHROPIC.COM')).toBe('Claude');
    });
  });
});
