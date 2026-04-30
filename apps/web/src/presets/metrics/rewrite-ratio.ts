import { MODERATE_THRESHOLD } from '../../components/tabs/RewriteRatioTab';
import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function rewriteRatioMetrics(report: GitrelicReport): Metric[] {
  const { files, topRewriters } = report.rewriteRatio;
  const topScore = topRewriters[0]?.rewriteScore ?? 0;
  const avgRatio = files.length > 0 ? files.reduce((sum, f) => sum + f.ratio, 0) / files.length : 0;

  return [
    {
      label: 'Top Rewriter Score',
      value: topRewriters.length > 0 ? String(Math.round(topScore)) : '—',
      color:
        topRewriters.length === 0
          ? 'var(--severity-healthy)'
          : topScore >= 70
            ? 'var(--severity-critical)'
            : topScore >= 30
              ? 'var(--severity-warning)'
              : 'var(--severity-healthy)',
    },
    {
      label: 'Files ≥70',
      value: fmt(report.rewriteRatio.highRewrite),
      color:
        report.rewriteRatio.highRewrite >= MODERATE_THRESHOLD
          ? 'var(--severity-critical)'
          : report.rewriteRatio.highRewrite > 0
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Avg Ratio',
      value: files.length > 0 ? avgRatio.toFixed(2) : '—',
      color: 'var(--accent-primary)',
    },
    {
      label: 'Files Analyzed',
      value: fmt(files.length),
      color: 'var(--text-primary)',
    },
  ];
}
