import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSelection } from './useSelection';

describe('useSelection', () => {
  it('starts with no selection', () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.selectedContributor).toBeNull();
    expect(result.current.activeNavItem).toBe('dashboard');
    expect(result.current.activeBottomTab).toBe('hotspots');
  });

  it('selectFile updates selectedFile and clears contributor', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.selectFile('src/runner.ts'));
    expect(result.current.selectedFile).toBe('src/runner.ts');
    expect(result.current.selectedContributor).toBeNull();
  });

  it('selectContributor updates contributor and clears file', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.selectFile('src/runner.ts'));
    act(() => result.current.selectContributor('dan@example.com'));
    expect(result.current.selectedContributor).toBe('dan@example.com');
    expect(result.current.selectedFile).toBeNull();
  });

  it('navigateTo updates nav item and bottom tab', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.navigateTo('coupling'));
    expect(result.current.activeNavItem).toBe('coupling');
    expect(result.current.activeBottomTab).toBe('coupling');
  });

  it('setActiveBottomTab changes tab without changing nav', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.setActiveBottomTab('shame'));
    expect(result.current.activeBottomTab).toBe('shame');
    expect(result.current.activeNavItem).toBe('dashboard');
  });

  it('clearSelection resets file and contributor', () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.selectFile('src/runner.ts'));
    act(() => result.current.clearSelection());
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.selectedContributor).toBeNull();
  });
});
