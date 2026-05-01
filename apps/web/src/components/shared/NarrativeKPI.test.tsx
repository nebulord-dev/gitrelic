import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NarrativeKPI, type SeeAlsoLink } from './NarrativeKPI';

const seeAlso: [SeeAlsoLink, SeeAlsoLink] = [
  { label: 'Bus Factor', presetId: 'bus-factor' },
  { label: 'Ghost Files', presetId: 'ghost-files' },
];

const baseProps = {
  bigNumber: '67%',
  tier: { variant: 'warning' as const, label: 'Moderate Risk' },
  metric: 'Concentration Index',
  finding: <>1,870 of 2,792 files have a single dominant author</>,
  seeAlso,
};

describe('NarrativeKPI', () => {
  afterEach(() => cleanup());

  it('renders big number, tier badge, and metric label', () => {
    render(<NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('Moderate Risk')).toBeTruthy();
    expect(screen.getByText('Concentration Index')).toBeTruthy();
  });

  it('applies severity color from tier.variant to the big number', () => {
    render(<NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />);
    const big = screen.getByText('67%');
    // Tailwind class is the contract now; happy-dom won't compute the
    // resolved color, but the className is enough to verify wiring.
    expect(big.className).toContain('text-severity-warning');
  });

  it('renders subline when provided and omits it when absent', () => {
    const { rerender } = render(
      <NarrativeKPI
        {...baseProps}
        subline="67% of files are single-author dominant (1870/2792)"
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/single-author dominant/)).toBeTruthy();
    rerender(<NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />);
    expect(screen.queryByText(/single-author dominant/)).toBeNull();
  });

  it('renders ReactNode finding (e.g. with <strong>)', () => {
    render(
      <NarrativeKPI
        {...baseProps}
        finding={
          <>
            <strong>1,870</strong> of 2,792 files
          </>
        }
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('1,870').tagName).toBe('STRONG');
  });

  it('invokes onApplyPreset with the correct presetId on each footer click', () => {
    const onApplyPreset = vi.fn();
    render(<NarrativeKPI {...baseProps} onApplyPreset={onApplyPreset} />);
    screen.getByText('Bus Factor').click();
    expect(onApplyPreset).toHaveBeenLastCalledWith('bus-factor');
    screen.getByText('Ghost Files').click();
    expect(onApplyPreset).toHaveBeenLastCalledWith('ghost-files');
    expect(onApplyPreset).toHaveBeenCalledTimes(2);
  });

  // Layout-shape assertions for the responsive side-by-side layout (RELIC-334).
  // Container queries don't compute under happy-dom, so we verify the wiring is
  // present (container-defining body, stack wrapper, extras slot class) and rely
  // on a manual / Playwright smoke for the actual layout flip.
  describe('responsive layout wiring', () => {
    it('marks the body as a container-query root', () => {
      const { container } = render(<NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />);
      const body = container.querySelector('.narrative-kpi-body');
      expect(body).toBeTruthy();
    });

    it('wraps kpi-row in a responsive stack', () => {
      const { container } = render(<NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />);
      const stack = container.querySelector('.narrative-kpi-stack');
      expect(stack).toBeTruthy();
      expect(stack?.querySelector('.narrative-kpi-row')).toBeTruthy();
    });

    it('renders the extras slot only when extras prop is provided', () => {
      const { container, rerender } = render(
        <NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />,
      );
      expect(container.querySelector('.narrative-kpi-extras')).toBeNull();

      rerender(
        <NarrativeKPI
          {...baseProps}
          extras={<div>directory rollup</div>}
          onApplyPreset={vi.fn()}
        />,
      );
      const extras = container.querySelector('.narrative-kpi-extras');
      expect(extras).toBeTruthy();
      expect(extras?.textContent).toBe('directory rollup');
    });
  });
});
