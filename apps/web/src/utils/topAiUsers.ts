import { resolveAuthorDisplayName } from './authorClassification';
import type { AiAuthorStat, Contributor } from '@gitrelic/core';

export function topAiUsers(
  aiAuthors: AiAuthorStat[],
  contributors: Contributor[],
  n: number,
): AiAuthorStat[] {
  return aiAuthors.slice(0, n).map((a) => ({
    ...a,
    displayName: resolveAuthorDisplayName(a.author, contributors),
  }));
}
