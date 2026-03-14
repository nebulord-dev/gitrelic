import React, { useState, useEffect } from 'react';
import { Box, Text, Newline } from 'ink';
import Spinner from 'ink-spinner';
import type { CodeloreReport } from '@codelore/core';

interface Props {
  report: CodeloreReport | null;
  progress: string;
  error: string | null;
  showShame: boolean;
}

export function App({ report, progress, error, showShame }: Props) {
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
      <HotspotPanel report={report} />
      <Newline />
      <CouplingPanel report={report} />
      <Newline />
      <CursedFilesPanel report={report} />
      <Newline />
      <ContributorPanel report={report} />
      <Newline />
      <BusFactorPanel report={report} />
      {showShame && (
        <>
          <Newline />
          <ShamePanel report={report} />
        </>
      )}
    </Box>
  );
}

function Banner({ repoName }: { repoName: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="magenta" bold>{`
 ██████╗ ██████╗ ██████╗ ███████╗██╗      ██████╗ ██████╗ ███████╗
██╔════╝██╔═══██╗██╔══██╗██╔════╝██║     ██╔═══██╗██╔══██╗██╔════╝
██║     ██║   ██║██║  ██║█████╗  ██║     ██║   ██║██████╔╝█████╗
██║     ██║   ██║██║  ██║██╔══╝  ██║     ██║   ██║██╔══██╗██╔══╝
╚██████╗╚██████╔╝██████╔╝███████╗███████╗╚██████╔╝██║  ██║███████╗
 ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝`}</Text>
      <Text color="gray">  git archaeology for <Text color="white" bold>{repoName}</Text></Text>
    </Box>
  );
}

function MetaPanel({ report }: { report: CodeloreReport }) {
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

function ChurnPanel({ report }: { report: CodeloreReport }) {
  const { churn } = report;
  return (
    <Box flexDirection="column">
      <Text color="yellow" bold>── Churn ({churn.hotspotCount} hot files) ────────────────────────────</Text>
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

function CursedFilesPanel({ report }: { report: CodeloreReport }) {
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

function ContributorPanel({ report }: { report: CodeloreReport }) {
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

function BusFactorPanel({ report }: { report: CodeloreReport }) {
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

function HotspotPanel({ report }: { report: CodeloreReport }) {
  const { hotspots } = report;
  if (hotspots.files.length === 0) return null;
  return (
    <Box flexDirection="column">
      <Text color="red" bold>
        {'── Hotspots (churn × complexity) ───────────────────────────'}
      </Text>
      <Text color="gray" dimColor>{hotspots.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {hotspots.topHotspots.slice(0, 10).map(f => (
          <Box key={f.file} gap={2}>
            <Text color={getHotspotColor(f.category)}>{churnBar(f.hotspotScore)}</Text>
            <Text color="gray">{truncatePath(f.file, 45)}</Text>
            <Text color="gray" dimColor>{f.loc} LOC</Text>
            <Text color={getHotspotColor(f.category)}>{f.category}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function CouplingPanel({ report }: { report: CodeloreReport }) {
  const { coupling } = report;
  if (coupling.pairs.length === 0) return null;
  return (
    <Box flexDirection="column">
      <Text color="blue" bold>
        {`── File Coupling (${coupling.pairs.length} pairs) ────────────────────────────`}
      </Text>
      <Text color="gray" dimColor>{coupling.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {coupling.topPairs.slice(0, 10).map(p => (
          <Box key={`${p.fileA}-${p.fileB}`} gap={2}>
            <Text color="blue">{String(p.couplingStrength).padStart(3)}%</Text>
            <Text color="white">{truncatePath(p.fileA, 25)}</Text>
            <Text color="gray">↔</Text>
            <Text color="white">{truncatePath(p.fileB, 25)}</Text>
            <Text color="gray" dimColor>{p.coCommits} commits</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function ShamePanel({ report }: { report: CodeloreReport }) {
  const { forensics } = report;
  if (forensics.shameLeaderboard.length === 0) {
    return (
      <Box>
        <Text color="green">✓ No commit message red flags detected</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      <Text color="magenta" bold>
        {`── Shame Leaderboard (${forensics.totalShameCommits} flagged commits) ───────────────────`}
      </Text>
      <Text color="gray" dimColor>{forensics.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {forensics.shameLeaderboard.slice(0, 8).map(f => (
          <Box key={f.file} flexDirection="column" marginBottom={1}>
            <Box gap={2}>
              <Text color="magenta">⚑</Text>
              <Text color="white">{truncatePath(f.file, 50)}</Text>
              <Text color="magenta">[{f.shameScore}/100]</Text>
              <Text color="gray" dimColor>{f.shameCommitCount} shame commits</Text>
            </Box>
            {f.topShameCommits.slice(0, 1).map(c => (
              <Text key={c.hash} color="gray" dimColor>  "{c.message}"</Text>
            ))}
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

function getHotspotColor(category: string): string {
  switch (category) {
    case 'critical': return 'red';
    case 'warning': return 'yellow';
    case 'moderate': return 'cyan';
    default: return 'gray';
  }
}
