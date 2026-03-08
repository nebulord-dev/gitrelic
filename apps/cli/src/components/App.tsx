import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import Spinner from 'ink-spinner';
import type { LoreReport } from '@lore/core';

interface Props {
  report: LoreReport | null;
  progress: string;
  error: string | null;
}

export function App({ report, progress, error }: Props) {
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">✗ {error}</Text>
      </Box>
    );
  }

  if (!report) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan">
          <Spinner type="dots" />
          {' '}
          <Text>{progress || 'Starting analysis...'}</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Banner repoName={report.repoName} />
      <MetaPanel report={report} />
      <Newline />
      <ChurnPanel report={report} />
      <Newline />
      <CursedFilesPanel report={report} />
      <Newline />
      <ContributorPanel report={report} />
      <Newline />
      <BusFactorPanel report={report} />
    </Box>
  );
}

function Banner({ repoName }: { repoName: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="magenta" bold>
        {'██╗      ██████╗ ██████╗ ███████╗'}
      </Text>
      <Text color="magenta" bold>
        {'██║     ██╔═══██╗██╔══██╗██╔════╝'}
      </Text>
      <Text color="magenta" bold>
        {'██║     ██║   ██║██████╔╝█████╗  '}
      </Text>
      <Text color="magenta" bold>
        {'██║     ██║   ██║██╔══██╗██╔══╝  '}
      </Text>
      <Text color="magenta" bold>
        {'███████╗╚██████╔╝██║  ██║███████╗'}
      </Text>
      <Text color="magenta" bold>
        {'╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝'}
      </Text>
      <Text color="gray">  git archaeology for <Text color="white" bold>{repoName}</Text></Text>
    </Box>
  );
}

function MetaPanel({ report }: { report: LoreReport }) {
  const { meta } = report;
  const years = (meta.ageInDays / 365).toFixed(1);
  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>── Repository Overview ──────────────────────────────────</Text>
      <Box gap={4} marginTop={1}>
        <Box flexDirection="column">
          <Text color="gray">Commits</Text>
          <Text color="white" bold>{meta.totalCommits.toLocaleString()}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">Files</Text>
          <Text color="white" bold>{meta.totalFiles.toLocaleString()}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">Authors</Text>
          <Text color="white" bold>{meta.totalAuthors}</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">Age</Text>
          <Text color="white" bold>{years}y</Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">Language</Text>
          <Text color="white" bold>{meta.primaryLanguage}</Text>
        </Box>
      </Box>
    </Box>
  );
}

function ChurnPanel({ report }: { report: LoreReport }) {
  const { churn } = report;
  return (
    <Box flexDirection="column">
      <Text color="yellow" bold>── Hotspots ({churn.hotspotCount} hot files) ────────────────────────────</Text>
      <Text color="gray" dimColor>{churn.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {churn.topFiles.slice(0, 10).map(f => (
          <Box key={f.file} gap={2}>
            <Text color={getChurnColor(f.category)}>{churnBar(f.churnScore)}</Text>
            <Text color="gray">{truncatePath(f.file, 50)}</Text>
            <Text color="gray" dimColor>{f.commitCount} commits</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function CursedFilesPanel({ report }: { report: LoreReport }) {
  if (report.cursedFiles.length === 0) return null;
  return (
    <Box flexDirection="column">
      <Text color="red" bold>── Cursed Files ─────────────────────────────────────────</Text>
      {report.cursedFiles.slice(0, 5).map(f => (
        <Box key={f.file} flexDirection="column" marginTop={1}>
          <Box gap={2}>
            <Text color="red" bold>☠</Text>
            <Text color="white">{truncatePath(f.file, 55)}</Text>
            <Text color="red">[{f.curseScore}/100]</Text>
          </Box>
          <Text color="gray" dimColor>  {f.narrative}</Text>
        </Box>
      ))}
    </Box>
  );
}

function ContributorPanel({ report }: { report: LoreReport }) {
  const { contributors } = report;
  return (
    <Box flexDirection="column">
      <Text color="green" bold>── Contributors ({contributors.activeContributors.length} active) ──────────────────────────</Text>
      <Text color="gray" dimColor>{contributors.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {contributors.contributors.slice(0, 8).map(c => (
          <Box key={c.email} gap={2}>
            <Text color={c.isActive ? 'green' : 'gray'}>{c.isActive ? '●' : '○'}</Text>
            <Text color="white">{c.name.slice(0, 20).padEnd(20)}</Text>
            <Text color="gray">{String(c.commitCount).padStart(4)} commits</Text>
            <Text color="gray" dimColor>{c.focusAreas[0] ?? '-'}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function BusFactorPanel({ report }: { report: LoreReport }) {
  const { busFactors } = report;
  if (busFactors.criticalFiles.length === 0) return (
    <Box>
      <Text color="green">✓ Bus factor looks healthy — no single-author files in hotspots</Text>
    </Box>
  );
  return (
    <Box flexDirection="column">
      <Text color="red" bold>── Bus Factor Risk ({busFactors.criticalFiles.length} critical) ──────────────────────</Text>
      <Text color="gray" dimColor>{busFactors.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {busFactors.criticalFiles.slice(0, 6).map(f => (
          <Box key={f.file} gap={2}>
            <Text color="red">⚠</Text>
            <Text color="white">{truncatePath(f.file, 50)}</Text>
            <Text color="gray" dimColor>{f.dominantAuthorPercent}% one author</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function churnBar(score: number): string {
  const filled = Math.round(score / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function getChurnColor(category: string): string {
  switch (category) {
    case 'hot': return 'red';
    case 'warm': return 'yellow';
    case 'cold': return 'cyan';
    default: return 'gray';
  }
}

function truncatePath(file: string, max: number): string {
  if (file.length <= max) return file;
  return '...' + file.slice(-(max - 3));
}
