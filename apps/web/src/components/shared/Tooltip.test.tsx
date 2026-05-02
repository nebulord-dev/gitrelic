import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  afterEach(() => cleanup());

  it('hides tooltip content until the trigger is hovered', () => {
    render(
      <Tooltip content="full path">
        <span>label</span>
      </Tooltip>,
    );
    expect(screen.queryByText('full path')).toBeNull();
  });

  it('shows tooltip content on mouseenter and hides on mouseleave', () => {
    render(
      <Tooltip content="full path">
        <span>label</span>
      </Tooltip>,
    );
    const wrapper = screen.getByText('label').parentElement!;
    fireEvent.mouseEnter(wrapper);
    expect(screen.getByText('full path')).toBeTruthy();
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText('full path')).toBeNull();
  });

  it('applies the default wrapper styling (inline-block + help cursor via Tailwind classes)', () => {
    render(
      <Tooltip content="info">
        <span>label</span>
      </Tooltip>,
    );
    const wrapper = screen.getByText('label').parentElement!;
    const className = wrapper.getAttribute('class') ?? '';
    expect(className).toContain('inline-block');
    expect(className).toContain('cursor-help');
  });

  it('forwards wrapperStyle so callers can override layout props', () => {
    render(
      <Tooltip
        content="info"
        wrapperStyle={{ display: 'block', flex: 1, minWidth: 0, overflow: 'hidden' }}
      >
        <span>label</span>
      </Tooltip>,
    );
    const wrapper = screen.getByText('label').parentElement!;
    const style = wrapper.getAttribute('style') ?? '';
    // additive props applied (happy-dom expands `flex: 1` to its longhands)
    expect(style).toContain('display: block');
    expect(style).toContain('flex-grow: 1');
    expect(style).toContain('min-width: 0');
    expect(style).toContain('overflow: hidden');
  });
});
