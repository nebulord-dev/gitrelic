import type { AiAuthorStat, Contributor } from '@gitrelic/core';

function resolveDisplayName(
  email: string,
  contributors: Contributor[],
): string {
  const match = contributors.find(
    (c) => c.email.toLowerCase() === email.toLowerCase(),
  );
  if (match && match.name) return match.name;
  return email;
}

export function topAiUsers(
  aiAuthors: AiAuthorStat[],
  contributors: Contributor[],
  n: number,
): AiAuthorStat[] {
  return aiAuthors.slice(0, n).map((a) => ({
    ...a,
    displayName: resolveDisplayName(a.author, contributors),
  }));
}
