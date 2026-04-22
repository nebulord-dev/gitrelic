import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { normalizeReport } from '../../utils/normalizeReport';
import { computeVisibility, Shell } from './Shell';

import type { GitrelicReport } from '@gitrelic/core';

function makeMinimalReport(): GitrelicReport {
  return normalizeReport({});
}

describe('Shell layout mode', () => {
  it('renders sidebar, bottom panel, and inspector by default', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    expect(container.querySelector('nav')).not.toBeNull();
    // Bottom panel has a resize handle div with cursor: row-resize
    expect(container.querySelector('[style*="row-resize"]')).not.toBeNull();
  });
});

describe('computeVisibility', () => {
  it('returns all visible for default mode', () => {
    expect(computeVisibility('default')).toEqual({
      sidebar: true,
      bottomPanel: true,
      inspector: true,
      metricsStrip: true,
    });
  });

  it('hides sidebar/inspector in focus-canvas', () => {
    expect(computeVisibility('focus-canvas')).toEqual({
      sidebar: false,
      bottomPanel: true,
      inspector: false,
      metricsStrip: true,
    });
  });

  it('hides everything but hero in fullscreen-hero', () => {
    expect(computeVisibility('fullscreen-hero')).toEqual({
      sidebar: false,
      bottomPanel: false,
      inspector: false,
      metricsStrip: false,
    });
  });

  it('shows only bottom panel in fullscreen-table', () => {
    expect(computeVisibility('fullscreen-table')).toEqual({
      sidebar: false,
      bottomPanel: true,
      inspector: false,
      metricsStrip: false,
    });
  });

  it('shows metrics + hero only in canvas-minimal', () => {
    expect(computeVisibility('canvas-minimal')).toEqual({
      sidebar: false,
      bottomPanel: false,
      inspector: false,
      metricsStrip: true,
    });
  });
});
