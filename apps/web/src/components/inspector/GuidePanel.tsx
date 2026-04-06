import type { GitloreReport } from '@gitlore/core';

interface GuidePanelProps {
  report: GitloreReport;
}

interface MetricEntry {
  name: string;
  description: string;
}

interface MetricGroup {
  label: string;
  metrics: MetricEntry[];
}

const METRIC_GROUPS: MetricGroup[] = [
  {
    label: 'Code Health',
    metrics: [
      {
        name: 'Hotspot Score',
        description:
          'Churn frequency \u00d7 file complexity (LOC). High score = frequently changed, complex file.',
      },
      {
        name: 'Cursed Files',
        description:
          'Files flagged across multiple risk dimensions: high churn, concentrated ownership, shame, and age anomalies.',
      },
      {
        name: 'Dead Code',
        description:
          'Tracked files with zero commits in the analysis window. Candidates for removal.',
      },
      {
        name: 'Complexity Trend',
        description:
          'Whether a file is growing or shrinking over time. Growing files accumulate maintenance burden.',
      },
      {
        name: 'Rewrite Ratio',
        description:
          'Balance of insertions vs deletions. High ratio = code being rewritten, not just appended.',
      },
      {
        name: 'Churn Velocity',
        description:
          'Is churn accelerating or decelerating? Accelerating files are emerging problems.',
      },
      {
        name: 'Blast Radius',
        description:
          'How many other files change when this file changes. High blast radius = high coordination cost.',
      },
    ],
  },
  {
    label: 'Ownership & Risk',
    metrics: [
      {
        name: 'Bus Factor',
        description:
          'Ownership concentration. Files where one author has 80%+ of commits are single points of failure.',
      },
      {
        name: 'Coupling',
        description:
          'Files that frequently change together in the same commits. Reveals hidden dependencies.',
      },
      {
        name: 'Ghost Files',
        description:
          'Files owned primarily by contributors who are no longer active. Knowledge may be lost.',
      },
      {
        name: 'Knowledge Silos',
        description:
          'Percentage of files with a single dominant author. High concentration = fragile team.',
      },
    ],
  },
  {
    label: 'Team & Activity',
    metrics: [
      {
        name: 'Contributors',
        description: 'Active and inactive contributors based on recent commit activity.',
      },
      {
        name: 'Co-Authors',
        description: 'Pairs who co-author commits together, based on Co-authored-by trailers.',
      },
      {
        name: 'Commit Timing',
        description:
          'Late-night and weekend commit patterns. High off-hours work can signal stress.',
      },
      {
        name: 'Parallel Dev',
        description:
          'Files edited by multiple authors in the same week. Concurrent work correlates with defects.',
      },
      {
        name: 'Shame Score',
        description:
          'Ratio of fix/hotfix/revert commits. Files with high shame scores have troubled histories.',
      },
    ],
  },
  {
    label: 'Structure',
    metrics: [
      {
        name: 'Age Map',
        description:
          'Time since each file was last modified. Stale files may be stable or abandoned.',
      },
      { name: 'Languages', description: 'Language breakdown by file count and lines of code.' },
      {
        name: 'Test Coverage',
        description:
          'Ratio of test files to source files per directory. Proxy metric \u2014 not runtime coverage.',
      },
      {
        name: 'Renames',
        description:
          'Files that have been renamed over their history. Frequent renames can signal instability.',
      },
    ],
  },
];

export function GuidePanel() {
  return (
    <div>
      {METRIC_GROUPS.map((group) => (
        <div key={group.label} style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--text-tertiary)',
              marginBottom: 6,
            }}
          >
            {group.label}
          </div>
          {group.metrics.map((metric) => (
            <div key={metric.name} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 500 }}>
                {metric.name}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {metric.description}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
