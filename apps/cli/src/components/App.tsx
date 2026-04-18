import { Box, Text, Newline } from 'ink';
import Spinner from 'ink-spinner';

import type { GitrelicReport } from '@gitrelic/core';

interface Props {
  report: GitrelicReport | null;
  progress: string;
  error: string | null;
  showShame?: boolean;
  showParallel?: boolean;
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
          <Spinner type="dots" /> <Text>{progress || 'Starting analysis...'}</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Banner repoName={report.repoName} branch={report.meta.analyzedBranch} />
      <MetaPanel report={report} />
      <Newline />
      {/* <ChurnPanel report={report} />
      <Newline />
      <HotspotPanel report={report} /> */}
      {/* <Newline /> */}
      {/* <ClusteringPanel report={report} />
      <Newline />
      <CouplingPanel report={report} />
      <Newline />
      <CursedFilesPanel report={report} />
      <Newline /> */}
      <ContributorPanel report={report} />
      {/* <Newline /> */}
      {/* <BusFactorPanel report={report} />
      <Newline />
      <VelocityPanel report={report} />
      <Newline />
      <RewritePanel report={report} />
      <Newline />
      <BlastRadiusPanel report={report} />
      <Newline />
      <DeadCodePanel report={report} />
      <Newline /> */}
      {/* <TestCoveragePanel report={report} />
      <Newline /> */}
      {/* <GhostFilesPanel report={report} />
      <Newline /> */}
      {/* <KnowledgePanel report={report} />
      <Newline /> */}
      {/* <CoAuthorPanel report={report} />
      {showShame && (
        <>
          <Newline />
          <ShamePanel report={report} />
        </>
      )}
      {showParallel && (
        <>
          <Newline />
          <ParallelPanel report={report} />
        </>
      )} */}
      <LaunchPanel />
    </Box>
  );
}

function Banner({ repoName, branch }: { repoName: string; branch: string }) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="magenta" bold>{`
 ██████╗ ██╗████████╗██╗      ██████╗ ██████╗ ███████╗
██╔════╝ ██║╚══██╔══╝██║     ██╔═══██╗██╔══██╗██╔════╝
██║  ███╗██║   ██║   ██║     ██║   ██║██████╔╝█████╗
██║   ██║██║   ██║   ██║     ██║   ██║██╔══██╗██╔══╝
╚██████╔╝██║   ██║   ███████╗╚██████╔╝██║  ██║███████╗
 ╚═════╝ ╚═╝   ╚═╝   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝`}</Text>
      <Text>
        <Text color="gray"> git archaeology for </Text>
        <Text color="white" bold>
          {repoName}
        </Text>
        {branch ? (
          <>
            <Text color="gray"> on </Text>
            <Text color="cyan">{branch}</Text>
          </>
        ) : null}
      </Text>
    </Box>
  );
}

function MetaPanel({ report }: { report: GitrelicReport }) {
  const { meta } = report;
  const years = (meta.ageInDays / 365).toFixed(1);
  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        ── Repository Overview ──────────────────────────────────
      </Text>
      <Box gap={4} marginTop={1}>
        <Box flexDirection="column">
          <Text color="gray">Commits</Text>
          <Text color="white" bold>
            {meta.totalCommits.toLocaleString()}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">Files</Text>
          <Text color="white" bold>
            {meta.totalFiles.toLocaleString()}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">Authors</Text>
          <Text color="white" bold>
            {meta.totalAuthors}
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">Age</Text>
          <Text color="white" bold>
            {years}y
          </Text>
        </Box>
        <Box flexDirection="column">
          <Text color="gray">Language</Text>
          <Text color="white" bold>
            {meta.primaryLanguage}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

// function ChurnPanel({ report }: { report: GitrelicReport }) {
//   const { churn } = report;
//   return (
//     <Box flexDirection="column">
//       <Text color="yellow" bold>
//         ── Churn ({churn.hotspotCount} hot files) ────────────────────────────
//       </Text>
//       <Text color="gray" dimColor>
//         {churn.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {churn.topFiles.slice(0, 10).map((f) => (
//           <Box key={f.file} gap={2}>
//             <Text color={getChurnColor(f.category)}>{churnBar(f.churnScore)}</Text>
//             <Text color="gray">{truncatePath(f.file, 50)}</Text>
//             <Text color="gray" dimColor>
//               {f.commitCount} commits
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function CursedFilesPanel({ report }: { report: GitrelicReport }) {
//   if (report.cursedFiles.length === 0) return null;
//   return (
//     <Box flexDirection="column">
//       <Text color="red" bold>
//         ── Cursed Files ─────────────────────────────────────────
//       </Text>
//       {report.cursedFiles.slice(0, 5).map((f) => (
//         <Box key={f.file} flexDirection="column" marginTop={1}>
//           <Box gap={2}>
//             <Text color="red" bold>
//               ☠
//             </Text>
//             <Text color="white">{truncatePath(f.file, 55)}</Text>
//             <Text color="red">[{f.curseScore}/100]</Text>
//           </Box>
//           <Text color="gray" dimColor>
//             {' '}
//             {f.narrative}
//           </Text>
//         </Box>
//       ))}
//     </Box>
//   );
// }

function ContributorPanel({ report }: { report: GitrelicReport }) {
  const { contributors } = report;
  return (
    <Box flexDirection="column">
      <Text color="green" bold>
        ── Contributors ({contributors.activeContributors.length} active) ──────────────────────────
      </Text>
      <Text color="gray" dimColor>
        {contributors.summary}
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {contributors.contributors.slice(0, 8).map((c) => (
          <Box key={c.email} gap={2}>
            <Text color={c.isActive ? 'green' : 'gray'}>{c.isActive ? '●' : '○'}</Text>
            <Text color="white">{c.name.slice(0, 20).padEnd(20)}</Text>
            <Text color="gray">{String(c.commitCount).padStart(4)} commits</Text>
            <Text color="gray" dimColor>
              {c.focusAreas[0] ?? '-'}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function LaunchPanel() {
  return (
    <Box marginTop={1}>
      <>
        <Text color="green">✓ Dashboard running at </Text>
        <Text color="cyan">http://localhost:7777</Text>
        <Text dimColor> (Ctrl+C to stop)</Text>
      </>
    </Box>
  );
}

// function BusFactorPanel({ report }: { report: GitrelicReport }) {
//   const { busFactors } = report;
//   if (busFactors.criticalFiles.length === 0)
//     return (
//       <Box>
//         <Text color="green">✓ Bus factor looks healthy — no single-author files in hotspots</Text>
//       </Box>
//     );
//   return (
//     <Box flexDirection="column">
//       <Text color="red" bold>
//         ── Bus Factor Risk ({busFactors.criticalFiles.length} critical) ──────────────────────
//       </Text>
//       <Text color="gray" dimColor>
//         {busFactors.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {busFactors.criticalFiles.slice(0, 6).map((f) => (
//           <Box key={f.file} gap={2}>
//             <Text color="red">⚠</Text>
//             <Text color="white">{truncatePath(f.file, 50)}</Text>
//             <Text color="gray" dimColor>
//               {f.dominantAuthorPercent}% one author
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function HotspotPanel({ report }: { report: GitrelicReport }) {
//   const { hotspots } = report;
//   if (hotspots.files.length === 0) return null;

//   const criticalCount = hotspots.topHotspots.filter((f) => f.category === 'critical').length;
//   const warningCount = hotspots.topHotspots.filter((f) => f.category === 'warning').length;
//   const hasConcerning = criticalCount > 0 || warningCount > 0;

//   let verdictText: string;
//   let verdictColor: string;
//   if (criticalCount >= 4) {
//     verdictText = `Complexity is concentrating where you work most — ${criticalCount} of your top hotspots are critical.`;
//     verdictColor = 'red';
//   } else if (criticalCount >= 1 || warningCount >= 3) {
//     verdictText =
//       'A few hotspots show high churn combined with high complexity — worth investigating.';
//     verdictColor = 'yellow';
//   } else {
//     verdictText =
//       'Your most-changed files have manageable complexity — active code is well-structured.';
//     verdictColor = 'green';
//   }

//   return (
//     <Box flexDirection="column">
//       <Text color="red" bold>
//         {'── Hotspots (churn × complexity) ───────────────────────────'}
//       </Text>
//       <Text color="gray" dimColor>
//         {hotspots.summary}
//       </Text>
//       {hasConcerning ? (
//         <>
//           <Text color={verdictColor}>{verdictText}</Text>
//           <Box flexDirection="column" marginTop={1}>
//             {hotspots.topHotspots.slice(0, 10).map((f) => (
//               <Box key={f.file} gap={2}>
//                 <Text color={getHotspotColor(f.category)}>{churnBar(f.hotspotScore)}</Text>
//                 <Text color="gray">{truncatePath(f.file, 45)}</Text>
//                 <Text color="gray" dimColor>
//                   {f.loc} LOC
//                 </Text>
//                 <Text color={getHotspotColor(f.category)}>{f.category}</Text>
//               </Box>
//             ))}
//           </Box>
//         </>
//       ) : (
//         <Text color="green">✓ No concerning hotspots — your active code is well-structured</Text>
//       )}
//     </Box>
//   );
// }

// function ClusteringPanel({ report }: { report: GitrelicReport }) {
//   const { hotspotClusters } = report;
//   if (hotspotClusters.clusters.length === 0) return null;

//   const dimensionColor: Record<string, string> = {
//     structural: 'green',
//     ownership: 'blue',
//     temporal: 'yellow',
//     'coupling-hub': 'red',
//   };

//   return (
//     <Box flexDirection="column">
//       <Text color="magenta" bold>
//         {`── Root Causes (${hotspotClusters.clusters.length} cluster${hotspotClusters.clusters.length !== 1 ? 's' : ''}) ──────────────────────────────`}
//       </Text>
//       <Text color="gray" dimColor>
//         {hotspotClusters.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {hotspotClusters.clusters.slice(0, 3).map((c) => (
//           <Box key={`${c.dimension}-${c.sharedTrait}`} flexDirection="column" marginBottom={1}>
//             <Box gap={2}>
//               <Text color={dimensionColor[c.dimension] ?? 'gray'}>[{c.dimension}]</Text>
//               <Text color="white">{c.label}</Text>
//               <Text color="gray" dimColor>
//                 — {c.members.length} hotspots
//               </Text>
//             </Box>
//             <Text color="gray" dimColor>
//               {' '}
//               "{c.narrative.split('. ')[0]}."
//             </Text>
//           </Box>
//         ))}
//         {hotspotClusters.multiSignalFiles.length > 0 && (
//           <Box gap={2}>
//             <Text color="red">⚑</Text>
//             <Text color="white">{hotspotClusters.multiSignalFiles[0].file}</Text>
//             <Text color="gray" dimColor>
//               appears in {hotspotClusters.multiSignalFiles[0].clusterCount} clusters
//             </Text>
//           </Box>
//         )}
//       </Box>
//     </Box>
//   );
// }

// function CouplingPanel({ report }: { report: GitrelicReport }) {
//   const { coupling } = report;
//   if (coupling.pairs.length === 0) return null;
//   return (
//     <Box flexDirection="column">
//       <Text color="blue" bold>
//         {`── File Coupling (${coupling.pairs.length} pairs) ────────────────────────────`}
//       </Text>
//       <Text color="gray" dimColor>
//         {coupling.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {coupling.topPairs.slice(0, 10).map((p) => (
//           <Box key={`${p.fileA}-${p.fileB}`} gap={2}>
//             <Text color="blue">{String(p.couplingStrength).padStart(3)}%</Text>
//             <Text color="white">{truncatePath(p.fileA, 25)}</Text>
//             <Text color="gray">↔</Text>
//             <Text color="white">{truncatePath(p.fileB, 25)}</Text>
//             <Text color="gray" dimColor>
//               {p.coCommits} commits
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function VelocityPanel({ report }: { report: GitrelicReport }) {
//   const { churnVelocity } = report;
//   if (churnVelocity.acceleratingFiles.length === 0) return null;
//   return (
//     <Box flexDirection="column">
//       <Text color="yellow" bold>
//         {'── Churn Velocity ──────────────────────────────────────────'}
//       </Text>
//       <Text color="gray" dimColor>
//         {churnVelocity.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {churnVelocity.acceleratingFiles.slice(0, 8).map((f) => (
//           <Box key={f.file} gap={2}>
//             <Text color="red">▲</Text>
//             <Text color="white">{truncatePath(f.file, 45)}</Text>
//             <Text color="gray" dimColor>
//               {f.recentCommits} recent / {f.olderCommits} older
//             </Text>
//             <Text color="red">{f.velocityScore}%</Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function RewritePanel({ report }: { report: GitrelicReport }) {
//   const { rewriteRatio } = report;
//   if (rewriteRatio.topRewriters.length === 0) return null;
//   return (
//     <Box flexDirection="column">
//       <Text color="magenta" bold>
//         {"── Rewrite Ratio (code that doesn't stick) ──────────────────"}
//       </Text>
//       <Text color="gray" dimColor>
//         {rewriteRatio.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {rewriteRatio.topRewriters.slice(0, 8).map((f) => (
//           <Box key={f.file} gap={2}>
//             <Text color="magenta">{churnBar(f.rewriteScore)}</Text>
//             <Text color="white">{truncatePath(f.file, 40)}</Text>
//             <Text color="gray" dimColor>
//               +{f.totalInsertions} -{f.totalDeletions}
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function BlastRadiusPanel({ report }: { report: GitrelicReport }) {
//   const { blastRadius } = report;
//   if (blastRadius.topBlasters.length === 0) return null;
//   return (
//     <Box flexDirection="column">
//       <Text color="red" bold>
//         {'── Blast Radius (architectural load-bearers) ────────────────'}
//       </Text>
//       <Text color="gray" dimColor>
//         {blastRadius.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {blastRadius.topBlasters.slice(0, 8).map((f) => (
//           <Box key={f.file} gap={2}>
//             <Text color="red">{churnBar(f.blastScore)}</Text>
//             <Text color="white">{truncatePath(f.file, 40)}</Text>
//             <Text color="gray" dimColor>
//               avg {f.avgCoChangedFiles} files, peak {f.maxCoChangedFiles}
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function DeadCodePanel({ report }: { report: GitrelicReport }) {
//   const { deadCode } = report;
//   if (deadCode.candidates.length === 0) return null;
//   return (
//     <Box flexDirection="column">
//       <Text color="gray" bold>
//         {`── Dead Code Candidates (${deadCode.totalDeadFiles} files, ${deadCode.totalDeadLines.toLocaleString()} lines) ─────`}
//       </Text>
//       <Text color="gray" dimColor>
//         {deadCode.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {deadCode.candidates.slice(0, 8).map((f) => (
//           <Box key={f.file} gap={2}>
//             <Text color="gray">◌</Text>
//             <Text color="white">{truncatePath(f.file, 45)}</Text>
//             <Text color="gray" dimColor>
//               {f.loc} LOC
//             </Text>
//             <Text color="gray" dimColor>
//               {f.ageInDays}d untouched
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function TestCoveragePanel({ report }: { report: GitrelicReport }) {
//   const { testCoverage } = report;
//   if (testCoverage.uncoveredDirectories.length === 0) {
//     return (
//       <Box>
//         <Text color="green">✓ All directories with source files have tests</Text>
//       </Box>
//     );
//   }
//   return (
//     <Box flexDirection="column">
//       <Text color="yellow" bold>
//         {`── Test Coverage Gaps (${testCoverage.uncoveredDirectories.length} uncovered) ──────────────`}
//       </Text>
//       <Text color="gray" dimColor>
//         {testCoverage.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {testCoverage.uncoveredDirectories.slice(0, 8).map((d) => (
//           <Box key={d.directory} gap={2}>
//             <Text color="yellow">⚠</Text>
//             <Text color="white">{d.directory}</Text>
//             <Text color="gray" dimColor>
//               {d.sourceFiles} source files, 0 tests
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function GhostFilesPanel({ report }: { report: GitrelicReport }) {
//   const { ghostFiles } = report;
//   if (ghostFiles.files.length === 0) return null;
//   return (
//     <Box flexDirection="column">
//       <Text color="red" bold>
//         {`── Ghost Files (${ghostFiles.totalGhostFiles} files) ──────────────────────────`}
//       </Text>
//       <Text color="gray" dimColor>
//         {ghostFiles.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {ghostFiles.files.slice(0, 8).map((f) => (
//           <Box key={f.file} gap={2}>
//             <Text color="red">👻</Text>
//             <Text color="white">{truncatePath(f.file, 40)}</Text>
//             <Text color="gray" dimColor>
//               {f.dominantAuthorPercent}% by {f.dominantAuthor.split('@')[0]}
//             </Text>
//             <Text color="gray" dimColor>
//               {f.authorInactiveDays}d inactive
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function KnowledgePanel({ report }: { report: GitrelicReport }) {
//   const { knowledgeConcentration } = report;
//   return (
//     <Box flexDirection="column">
//       <Text color="cyan" bold>
//         ── Knowledge Concentration ─────────────────────────────
//       </Text>
//       <Text color="gray" dimColor>
//         {knowledgeConcentration.summary}
//       </Text>
//       <Box marginTop={1}>
//         <Text
//           color={
//             knowledgeConcentration.concentrationIndex > 70
//               ? 'red'
//               : knowledgeConcentration.concentrationIndex > 40
//                 ? 'yellow'
//                 : 'green'
//           }
//         >
//           {knowledgeConcentration.concentrationIndex}% of files are single-author dominant
//         </Text>
//       </Box>
//     </Box>
//   );
// }

// function CoAuthorPanel({ report }: { report: GitrelicReport }) {
//   const { coAuthors } = report;
//   if (coAuthors.totalCoAuthoredCommits === 0) return null;
//   return (
//     <Box flexDirection="column">
//       <Text color="green" bold>
//         {`── Co-Authorship (${coAuthors.totalCoAuthoredCommits} commits) ──────────────────────`}
//       </Text>
//       <Text color="gray" dimColor>
//         {coAuthors.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {coAuthors.pairs.slice(0, 6).map((p) => (
//           <Box key={`${p.authorA}-${p.authorB}`} gap={2}>
//             <Text color="green">♦</Text>
//             <Text color="white">{p.authorA.split('@')[0]}</Text>
//             <Text color="gray">↔</Text>
//             <Text color="white">{p.authorB.split('@')[0]}</Text>
//             <Text color="gray" dimColor>
//               {p.coAuthoredCommits} commits, {p.files.length} files
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function ShamePanel({ report }: { report: GitrelicReport }) {
//   const { forensics } = report;
//   if (forensics.shameLeaderboard.length === 0) {
//     return (
//       <Box>
//         <Text color="green">✓ No commit message red flags detected</Text>
//       </Box>
//     );
//   }
//   return (
//     <Box flexDirection="column">
//       <Text color="magenta" bold>
//         {`── Shame Leaderboard (${forensics.totalShameCommits} flagged commits) ───────────────────`}
//       </Text>
//       <Text color="gray" dimColor>
//         {forensics.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {forensics.shameLeaderboard.slice(0, 8).map((f) => (
//           <Box key={f.file} flexDirection="column" marginBottom={1}>
//             <Box gap={2}>
//               <Text color="magenta">⚑</Text>
//               <Text color="white">{truncatePath(f.file, 50)}</Text>
//               <Text color="magenta">[{f.shameScore}/100]</Text>
//               <Text color="gray" dimColor>
//                 {f.shameCommitCount} shame commits
//               </Text>
//             </Box>
//             {f.topShameCommits.slice(0, 1).map((c) => (
//               <Text key={c.hash} color="gray" dimColor>
//                 {' '}
//                 "{c.message}"
//               </Text>
//             ))}
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// function ParallelPanel({ report }: { report: GitrelicReport }) {
//   const { parallelDev } = report;
//   if (parallelDev.hotFiles.length === 0) {
//     return (
//       <Box>
//         <Text color="green">
//           ✓ No parallel development detected — files have single-author timelines
//         </Text>
//       </Box>
//     );
//   }
//   return (
//     <Box flexDirection="column">
//       <Text color="yellow" bold>
//         {`── Parallel Development (${parallelDev.totalParallelFiles} contested files) ──────────────`}
//       </Text>
//       <Text color="gray" dimColor>
//         {parallelDev.summary}
//       </Text>
//       <Box flexDirection="column" marginTop={1}>
//         {parallelDev.hotFiles.slice(0, 10).map((f) => (
//           <Box key={f.file} flexDirection="column" marginBottom={1}>
//             <Box gap={2}>
//               <Text color="yellow">{churnBar(f.parallelScore)}</Text>
//               <Text color="white">{truncatePath(f.file, 40)}</Text>
//               <Text color="yellow">[{f.parallelScore}/100]</Text>
//               <Text color="gray" dimColor>
//                 peak {f.peakAuthors} authors
//               </Text>
//             </Box>
//             <Text color="gray" dimColor>
//               {' '}
//               {f.narrative.split('. ')[0]}.
//             </Text>
//           </Box>
//         ))}
//       </Box>
//     </Box>
//   );
// }

// ─── Helpers ──────────────────────────────────────────────────────────────────

// function churnBar(score: number): string {
//   const filled = Math.round(score / 10);
//   return '█'.repeat(filled) + '░'.repeat(10 - filled);
// }

// function getChurnColor(category: string): string {
//   switch (category) {
//     case 'hot':
//       return 'red';
//     case 'warm':
//       return 'yellow';
//     case 'cold':
//       return 'cyan';
//     default:
//       return 'gray';
//   }
// }

// function truncatePath(file: string, max: number): string {
//   if (file.length <= max) return file;
//   return '...' + file.slice(-(max - 3));
// }

// function getHotspotColor(category: string): string {
//   switch (category) {
//     case 'critical':
//       return 'red';
//     case 'warning':
//       return 'yellow';
//     case 'moderate':
//       return 'green';
//     default:
//       return 'green';
//   }
// }
