import { fireEvent, render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { normalizeReport } from '../../utils/normalizeReport';
import { computeVisibility, HERO_LABELS, Shell } from './Shell';

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
      hero: true,
    });
  });

  it('hides sidebar/inspector in focus-canvas', () => {
    expect(computeVisibility('focus-canvas')).toEqual({
      sidebar: false,
      bottomPanel: true,
      inspector: false,
      metricsStrip: true,
      hero: true,
    });
  });

  it('hides everything but hero in fullscreen-hero', () => {
    expect(computeVisibility('fullscreen-hero')).toEqual({
      sidebar: false,
      bottomPanel: false,
      inspector: false,
      metricsStrip: false,
      hero: true,
    });
  });

  it('shows only bottom panel in fullscreen-table', () => {
    expect(computeVisibility('fullscreen-table')).toEqual({
      sidebar: false,
      bottomPanel: true,
      inspector: false,
      metricsStrip: false,
      hero: false,
    });
  });

  it('shows metrics + hero only in canvas-minimal', () => {
    expect(computeVisibility('canvas-minimal')).toEqual({
      sidebar: false,
      bottomPanel: false,
      inspector: false,
      metricsStrip: true,
      hero: true,
    });
  });
});

describe('Shell keyboard shortcuts', () => {
  it('⌘. enters focus-canvas mode', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    // Sidebar visible initially
    expect(container.querySelector('nav')).not.toBeNull();
    fireEvent.keyDown(window, { key: '.', metaKey: true });
    // Sidebar hidden in focus-canvas
    expect(container.querySelector('nav')).toBeNull();
  });

  it('Esc returns to default mode', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    fireEvent.keyDown(window, { key: '.', metaKey: true });
    expect(container.querySelector('nav')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('nav')).not.toBeNull();
  });

  it('⌘⇧. enters fullscreen-hero mode', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    fireEvent.keyDown(window, { key: '.', metaKey: true, shiftKey: true });
    // Bottom panel hidden
    expect(container.querySelector('[style*="row-resize"]')).toBeNull();
  });

  it('⌘⇧, enters fullscreen-table mode with a filled bottom panel', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    // Default: bottom panel uses a fixed height so the hero can take the remaining space
    const defaultPanel = container.querySelector('[style*="row-resize"]')!.parentElement!;
    expect(defaultPanel.style.height).toBe('320px');

    fireEvent.keyDown(window, { key: ',', metaKey: true, shiftKey: true });

    // In fullscreen-table the hero is hidden; the bottom panel must expand to fill
    // or the viewport ends up with a 320px panel and a tall empty gap below it.
    const fullPanel = container.querySelector('[style*="row-resize"]')!.parentElement!;
    expect(fullPanel.style.flexGrow).toBe('1');
    expect(fullPanel.style.height).toBe('');
  });
});

describe('HERO_LABELS', () => {
  it('maps every HeroViz to a unique display label', () => {
    // A duplicate label (e.g. 'timeline' and 'growth-timeline' both showing 'Timeline')
    // makes hero alt-tab buttons indistinguishable when a preset mixes them.
    const labels = Object.values(HERO_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('Shell sidebar → preset wiring', () => {
  it('clicking Hotspots reshapes the hero to scatter', () => {
    const { container, getByText } = render(<Shell report={makeMinimalReport()} />);
    // Default hero label is "Treemap"
    expect(getByText('Treemap')).toBeDefined();
    // Narrow click to sidebar nav — "Hotspots" also appears as a bottom-panel tab label
    const sidebar = container.querySelector('nav')!;
    fireEvent.click(within(sidebar).getByText('Hotspots'));
    // After applyPreset('hotspots'), the hero alt-tabs become scatter/treemap/risk-heatmap.
    // The active tab should now be "Scatter".
    expect(getByText('Scatter')).toBeDefined();
  });

  it('overrides clear when another preset is clicked', () => {
    const { container, getByText } = render(<Shell report={makeMinimalReport()} />);
    const sidebar = container.querySelector('nav')!;
    fireEvent.click(within(sidebar).getByText('Hotspots'));
    // Default hero for hotspots is Scatter. Override to Treemap.
    fireEvent.click(getByText('Treemap'));
    fireEvent.click(within(sidebar).getByText('Contributors'));
    // Contributors preset default is Ownership. Treemap override should be gone.
    expect(getByText('Ownership')).toBeDefined();
  });
});
