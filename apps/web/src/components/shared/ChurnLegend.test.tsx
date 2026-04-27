import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ChurnLegend } from './ChurnLegend';

describe('ChurnLegend', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all four churn category labels', () => {
    render(<ChurnLegend />);
    expect(screen.getByText(/hot/)).toBeTruthy();
    expect(screen.getByText(/warm/)).toBeTruthy();
    expect(screen.getByText(/cold/)).toBeTruthy();
    expect(screen.getByText(/frozen/)).toBeTruthy();
  });

  it('renders threshold strings next to labels', () => {
    render(<ChurnLegend />);
    expect(screen.getByText(/76\+/)).toBeTruthy();
    expect(screen.getByText(/41–75/)).toBeTruthy();
    expect(screen.getByText(/11–40/)).toBeTruthy();
    expect(screen.getByText(/≤10/)).toBeTruthy();
  });
});
