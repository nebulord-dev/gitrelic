import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HeroCaption } from './HeroCaption';

describe('HeroCaption', () => {
  it('renders the primary line', () => {
    render(<HeroCaption primary="One row per critical file" />);
    // getByText throws if not found, so the call itself asserts presence.
    expect(screen.getByText('One row per critical file')).toBeTruthy();
  });

  it('renders the subtitle when provided', () => {
    render(<HeroCaption primary="Primary" subtitle="Hover for details" />);
    expect(screen.getByText('Hover for details')).toBeTruthy();
  });

  it('omits subtitle when not provided', () => {
    render(<HeroCaption primary="Solo" />);
    expect(screen.queryByText(/Hover/)).toBeNull();
  });
});
