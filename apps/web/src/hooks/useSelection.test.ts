import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSelection } from './useSelection';

describe('useSelection (preset-driven)', () => {
  describe('initial state', () => {
    it('starts on the overview preset with no selection and no overrides', () => {
      const { result } = renderHook(() => useSelection());
      expect(result.current.activePresetId).toBe('overview');
      expect(result.current.heroOverride).toBeNull();
      expect(result.current.bottomTabOverride).toBeNull();
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.selectedContributor).toBeNull();
    });

    it('derives activeHeroViz from the overview preset default', () => {
      const { result } = renderHook(() => useSelection());
      expect(result.current.activeHeroViz).toBe('treemap');
      expect(result.current.activeBottomTab).toBe('hotspots');
    });
  });

  describe('applyPreset', () => {
    it('switches the active preset id', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.applyPreset('risk'));
      expect(result.current.activePresetId).toBe('risk');
    });

    it('changes derived hero and bottom tab to the new preset defaults', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.applyPreset('risk'));
      expect(result.current.activeHeroViz).toBe('risk-heatmap');
      expect(result.current.activeBottomTab).toBe('risk-register');
    });

    it('clears hero and bottom tab overrides', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setHeroOverride('ownership'));
      act(() => result.current.setBottomTabOverride('shame'));
      expect(result.current.heroOverride).toBe('ownership');
      expect(result.current.bottomTabOverride).toBe('shame');
      act(() => result.current.applyPreset('tech-debt'));
      expect(result.current.heroOverride).toBeNull();
      expect(result.current.bottomTabOverride).toBeNull();
    });

    it('preserves selectedFile across preset changes', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectFile('src/runner.ts'));
      act(() => result.current.applyPreset('risk'));
      expect(result.current.selectedFile).toBe('src/runner.ts');
    });

    it('preserves selectedContributor across preset changes', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectContributor('dan@example.com'));
      act(() => result.current.applyPreset('tech-debt'));
      expect(result.current.selectedContributor).toBe('dan@example.com');
    });
  });

  describe('overrides', () => {
    it('setHeroOverride changes derived activeHeroViz', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setHeroOverride('coupling'));
      expect(result.current.activeHeroViz).toBe('coupling');
    });

    it('setBottomTabOverride changes derived activeBottomTab', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setBottomTabOverride('shame'));
      expect(result.current.activeBottomTab).toBe('shame');
    });
  });

  describe('selection', () => {
    it('selectFile clears contributor and sets inspector tab to file', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectContributor('x@y.com'));
      act(() => result.current.selectFile('src/x.ts'));
      expect(result.current.selectedContributor).toBeNull();
      expect(result.current.activeInspectorTab).toBe('file');
    });

    it('selectContributor clears file and sets inspector tab to contributors', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectFile('src/x.ts'));
      act(() => result.current.selectContributor('x@y.com'));
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.activeInspectorTab).toBe('contributors');
    });

    it('clearSelection wipes both', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectFile('src/x.ts'));
      act(() => result.current.clearSelection());
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.selectedContributor).toBeNull();
    });
  });
});
