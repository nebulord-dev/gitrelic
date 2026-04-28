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
    // happy-dom can normalize CSS values; assert against the raw style attribute
    // to ensure we round-trip the var() reference faithfully.
    expect(big.getAttribute('style')).toContain('color: var(--severity-warning)');
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
});
