import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { LocReport, FileLocEntry, LanguageBreakdown } from '../types.js';

const LANG_MAP: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  py: 'Python',
  rb: 'Ruby',
  go: 'Go',
  rs: 'Rust',
  java: 'Java',
  cs: 'C#',
  cpp: 'C++',
  c: 'C',
  php: 'PHP',
  swift: 'Swift',
  kt: 'Kotlin',
  css: 'CSS',
  scss: 'SCSS',
  less: 'LESS',
  html: 'HTML',
  vue: 'Vue',
  json: 'JSON',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
  xml: 'XML',
  md: 'Markdown',
  sh: 'Shell',
  bash: 'Shell',
  zsh: 'Shell',
  sql: 'SQL',
  graphql: 'GraphQL',
  gql: 'GraphQL',
  svelte: 'Svelte',
  astro: 'Astro',
};

function getLanguage(file: string): string {
  const ext = file.split('.').pop()?.toLowerCase() ?? '';
  return LANG_MAP[ext] ?? 'Other';
}

function countLines(content: string): number {
  if (content.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') count++;
  }
  if (content[content.length - 1] !== '\n') count++;
  return count;
}

export async function analyzeLoc(trackedFiles: string[], repoPath: string): Promise<LocReport> {
  const files: FileLocEntry[] = await Promise.all(
    trackedFiles.map(async (file) => {
      let lines = 0;
      try {
        const content = await readFile(path.join(repoPath, file), 'utf-8');
        lines = countLines(content);
      } catch {
        // Unreadable file — skip
      }
      return { file, lines, language: getLanguage(file) };
    }),
  );

  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);

  const langAgg: Record<string, { files: number; lines: number }> = {};
  for (const f of files) {
    const entry = (langAgg[f.language] ??= { files: 0, lines: 0 });
    entry.files++;
    entry.lines += f.lines;
  }

  const languages: LanguageBreakdown[] = Object.entries(langAgg)
    .map(([language, { files: fileCount, lines }]) => ({
      language,
      files: fileCount,
      lines,
      percentage: totalLines > 0 ? Math.round((lines / totalLines) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.lines - a.lines);

  const topLangs = languages
    .slice(0, 2)
    .map((l) => `${Math.round(l.percentage)}% ${l.language}`)
    .join(', ');
  const summary = `${totalLines.toLocaleString()} lines across ${files.length} files (${topLangs})`;

  return { totalFiles: files.length, totalLines, files, languages, summary };
}
