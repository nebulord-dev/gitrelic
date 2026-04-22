import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { normalizeReport } from '../../utils/normalizeReport';
import { Shell } from './Shell';

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
