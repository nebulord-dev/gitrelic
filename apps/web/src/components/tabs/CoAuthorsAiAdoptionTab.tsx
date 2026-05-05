import { topAiUsers } from '../../utils/topAiUsers';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { fmt } from '../theme';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { AdoptionTier, GitrelicReport } from '@gitrelic/core';

interface CoAuthorsAiAdoptionTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

type Scenario = 'no-trailers' | 'no-ai' | 'standard';

function detectScenario(report: GitrelicReport): Scenario {
  const ca = report.coAuthors;
  if (ca.totalCoAuthoredCommits === 0) return 'no-trailers';
  if (ca.aiAssistedCommits === 0) return 'no-ai';
  return 'standard';
}

function tierBadge(
  tier: AdoptionTier,
  scenario: Scenario,
): { variant: BadgeVariant; label: string } {
  if (scenario === 'no-trailers')
    return { variant: 'stale', label: 'No Co-Author Data' };
  switch (tier) {
    case 'none':
      return { variant: 'stale', label: 'No Adoption Yet' };
    case 'low':
      return { variant: 'coupling', label: 'Low Adoption' };
    case 'moderate':
      return { variant: 'coupling', label: 'Moderate Adoption' };
    case 'high':
      return { variant: 'coupling', label: 'High Adoption' };
  }
}

function NoTrailersFinding() {
  return (
    <p className="max-w-md text-sm text-text-secondary">
      This codebase doesn&apos;t use Co-Authored-By trailers. The analyzer
      surfaces explicit pair-programming and AI-assistance attribution — when
      present. Common in projects using GitHub-style PR workflows or AI tools
      like Claude Code.
    </p>
  );
}

function NoAiFinding({ report }: { report: GitrelicReport }) {
  const ca = report.coAuthors;
  return (
    <p className="max-w-md text-sm text-text-secondary">
      <span className="font-mono text-text-primary">
        {ca.totalCoAuthoredCommits}
      </span>{' '}
      co-authored commits across{' '}
      <span className="font-mono text-text-primary">
        {ca.humanPairs.length}
      </span>{' '}
      pairs, none AI-assisted. This codebase uses co-author trailers for human
      collaboration only.
    </p>
  );
}

function TopAiUsersList({ users }: { users: ReturnType<typeof topAiUsers> }) {
  if (users.length === 0)
    return <p className="text-sm text-text-tertiary">No AI users yet.</p>;
  return (
    <ul className="space-y-1">
      {users.map((u) => (
        <li key={u.author} className="text-sm">
          <span className="font-medium text-text-primary">{u.displayName}</span>
          <span className="ml-2 font-mono text-text-secondary">
            {fmt(u.aiCommits)} AI commits
          </span>
          <span className="ml-2 text-xs text-text-tertiary">
            ({u.personalRatio}%)
          </span>
        </li>
      ))}
    </ul>
  );
}

function StandardSubline({ report }: { report: GitrelicReport }) {
  const ca = report.coAuthors;
  const totalReportCommits = ca.humanAuthoredCommits + ca.filteredBotCommits;
  const broaderRatio =
    totalReportCommits > 0
      ? Math.round((ca.aiAssistedCommits / totalReportCommits) * 100)
      : 0;
  return (
    <span>
      <span className="font-mono text-text-primary">
        {fmt(ca.aiAssistedCommits)}
      </span>{' '}
      AI-assisted commits ·{' '}
      <span className="font-mono">{ca.aiAdoptionPercent}%</span> of human work ·{' '}
      <span className="font-mono">{broaderRatio}%</span> of all repo activity
      {ca.filteredBotCommits > 0 ? ' (incl. bots)' : ''}
    </span>
  );
}

function NoAiSubline({ report }: { report: GitrelicReport }) {
  const ca = report.coAuthors;
  const collaborators = new Set<string>();
  for (const p of ca.humanPairs) {
    collaborators.add(p.authorA);
    collaborators.add(p.authorB);
  }
  return (
    <span>
      <span className="font-mono">0</span> AI-assisted commits ·{' '}
      <span className="font-mono">{fmt(ca.totalCoAuthoredCommits)}</span> human
      pair-commits · <span className="font-mono">{collaborators.size}</span>{' '}
      collaborators
    </span>
  );
}

function NoTrailersSubline({ report }: { report: GitrelicReport }) {
  return (
    <span className="text-text-tertiary">
      0 co-authored commits across{' '}
      <span className="font-mono">
        {fmt(report.coAuthors.humanAuthoredCommits)}
      </span>{' '}
      total commits in window
    </span>
  );
}

function BotFilterFootnote({ count }: { count: number }) {
  return (
    <p className="mt-2 text-xs text-text-tertiary">
      <span className="font-mono">{count}</span> bot-authored commits filtered
      (semantic-release, dependabot, etc.)
    </p>
  );
}

export function CoAuthorsAiAdoptionTab({
  report,
  onApplyPreset,
}: CoAuthorsAiAdoptionTabProps) {
  const ca = report.coAuthors;
  const scenario = detectScenario(report);
  const badge = tierBadge(ca.aiAdoptionTier, scenario);
  const top = topAiUsers(ca.aiAuthors, report.contributors.contributors, 3);

  const finding =
    scenario === 'no-trailers' ? (
      <NoTrailersFinding />
    ) : scenario === 'no-ai' ? (
      <NoAiFinding report={report} />
    ) : (
      <TopAiUsersList users={top} />
    );

  const subline =
    scenario === 'no-trailers' ? (
      <NoTrailersSubline report={report} />
    ) : scenario === 'no-ai' ? (
      <NoAiSubline report={report} />
    ) : (
      <StandardSubline report={report} />
    );

  return (
    <NarrativeKPI
      bigNumber={scenario === 'no-trailers' ? '—' : `${ca.aiAdoptionPercent}%`}
      tier={badge}
      metric="AI ADOPTION"
      finding={finding}
      subline={subline}
      extras={
        ca.filteredBotCommits > 0 ? (
          <BotFilterFootnote count={ca.filteredBotCommits} />
        ) : undefined
      }
      seeAlso={[
        { label: 'Contributors', presetId: 'contributors' },
        { label: 'Parallel Dev', presetId: 'parallel-dev' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
