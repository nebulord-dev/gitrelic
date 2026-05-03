import { fireEvent, render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PRESETS } from '../../presets/registry';
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
    // Bottom panel has a resize handle div with cursor-row-resize Tailwind class
    expect(
      container.querySelector('[class*="cursor-row-resize"]'),
    ).not.toBeNull();
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
    expect(container.querySelector('[class*="cursor-row-resize"]')).toBeNull();
  });

  it('⌘⇧, enters fullscreen-table mode with a filled bottom panel', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    // Default: bottom panel uses a fixed height so the hero can take the remaining space
    const defaultPanel = container.querySelector(
      '[class*="cursor-row-resize"]',
    )!.parentElement!;
    expect(defaultPanel.style.height).toBe('320px');

    fireEvent.keyDown(window, { key: ',', metaKey: true, shiftKey: true });

    // In fullscreen-table the hero is hidden; the bottom panel must expand to fill
    // or the viewport ends up with a 320px panel and a tall empty gap below it.
    const fullPanel = container.querySelector(
      '[class*="cursor-row-resize"]',
    )!.parentElement!;
    // fillAvailable=true switches from inline style to Tailwind flex-1 class; no inline height.
    expect(fullPanel.classList.contains('flex-1')).toBe(true);
    expect(fullPanel.style.height).toBe('');
  });
});

describe('HERO_LABELS', () => {
  it('gives every viz id in HERO_LABELS a non-empty label', () => {
    for (const [vizId, label] of Object.entries(HERO_LABELS)) {
      expect(label, `viz id "${vizId}" has empty label`).toBeTruthy();
    }
  });

  it('maps each preset alt-tab to a label unique within that preset', () => {
    // Cross-preset label reuse is fine — two analyzers can both call their histogram
    // view "Distribution" because users only see one preset's pill bar at a time.
    // What breaks UX is two viz ids inside the same preset's altTabs sharing a label,
    // which makes the alt-tab buttons indistinguishable.
    for (const preset of Object.values(PRESETS)) {
      const labels = preset.hero.altTabs.map((vizId) => HERO_LABELS[vizId]);
      const unique = new Set(labels);
      expect(
        unique.size,
        `preset "${preset.id}" has duplicate alt-tab labels: ${labels.join(', ')}`,
      ).toBe(labels.length);
    }
  });
});

describe('Shell sidebar → preset wiring', () => {
  it('clicking Hotspots reshapes the hero to scatter', () => {
    const { container, getByText } = render(
      <Shell report={makeMinimalReport()} />,
    );
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
    const { container, getByText } = render(
      <Shell report={makeMinimalReport()} />,
    );
    const sidebar = container.querySelector('nav')!;
    fireEvent.click(within(sidebar).getByText('Hotspots'));
    // Default hero for hotspots is Scatter. Override to Treemap.
    fireEvent.click(getByText('Treemap'));
    fireEvent.click(within(sidebar).getByText('Contributors'));
    // Contributors preset default is Ownership. Treemap override should be gone.
    expect(getByText('Ownership')).toBeDefined();
  });
});

describe('docs link in bottom panel', () => {
  it('renders Docs ↗ link when active preset has docsPath', () => {
    const { container, getAllByText } = render(
      <Shell report={makeMinimalReport()} />,
    );
    // Click the Churn sidebar item to switch the active preset to one with docsPath.
    // Use getAllByText[0] because "Churn" can appear in both the sidebar and bottom-panel tabs.
    fireEvent.click(getAllByText('Churn')[0]);
    const link = container.querySelector('a[href*="analyzers/churn"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.textContent).toContain('Docs');
  });

  it('does not render Docs link for dashboard-tier presets', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    // Default preset is 'overview' (tier=dashboard, no docsPath).
    const link = container.querySelector(
      'a[href*="nebulord-dev.github.io/gitrelic"]',
    );
    expect(link).toBeNull();
  });
});
