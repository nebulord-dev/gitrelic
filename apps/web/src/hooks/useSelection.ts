import { useCallback, useState } from 'react';

import { PRESETS } from '../presets/registry';

import type { BottomTab, HeroViz, Metric, PresetId } from '../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

export type InspectorTab = 'file' | 'contributors' | 'activity';

export interface SelectionState {
  // Preset state
  activePresetId: PresetId;
  heroOverride: HeroViz | null;
  bottomTabOverride: BottomTab | null;

  // Derived
  activeHeroViz: HeroViz;
  activeBottomTab: BottomTab;
  heroAltTabs: HeroViz[];
  bottomAltTabs: BottomTab[];
  metrics: (report: GitrelicReport) => Metric[];

  // Selection
  selectedFile: string | null;
  selectedContributor: string | null;
  activeInspectorTab: InspectorTab;

  // Actions
  applyPreset: (id: PresetId) => void;
  setHeroOverride: (viz: HeroViz) => void;
  setBottomTabOverride: (tab: BottomTab) => void;
  selectFile: (file: string) => void;
  selectContributor: (email: string) => void;
  clearSelection: () => void;
  setActiveInspectorTab: (tab: InspectorTab) => void;
}

export function useSelection(): SelectionState {
  const [activePresetId, setActivePresetId] = useState<PresetId>('overview');
  const [heroOverride, setHeroOverrideState] = useState<HeroViz | null>(null);
  const [bottomTabOverride, setBottomTabOverrideState] =
    useState<BottomTab | null>(null);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(
    null,
  );
  const [activeInspectorTab, setActiveInspectorTab] =
    useState<InspectorTab>('file');

  const preset = PRESETS[activePresetId];

  const applyPreset = useCallback((id: PresetId) => {
    setActivePresetId(id);
    setHeroOverrideState(null);
    setBottomTabOverrideState(null);
  }, []);

  const setHeroOverride = useCallback((viz: HeroViz) => {
    setHeroOverrideState(viz);
  }, []);

  const setBottomTabOverride = useCallback((tab: BottomTab) => {
    setBottomTabOverrideState(tab);
  }, []);

  const selectFile = useCallback((file: string) => {
    setSelectedFile(file);
    setSelectedContributor(null);
    setActiveInspectorTab('file');
  }, []);

  const selectContributor = useCallback((email: string) => {
    setSelectedContributor(email);
    setSelectedFile(null);
    setActiveInspectorTab('contributors');
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setSelectedContributor(null);
  }, []);

  return {
    activePresetId,
    heroOverride,
    bottomTabOverride,
    activeHeroViz: heroOverride ?? preset.hero.defaultViz,
    activeBottomTab: bottomTabOverride ?? preset.bottomPanel.defaultTab,
    heroAltTabs: preset.hero.altTabs,
    bottomAltTabs: preset.bottomPanel.altTabs,
    metrics: preset.metrics,
    selectedFile,
    selectedContributor,
    activeInspectorTab,
    applyPreset,
    setHeroOverride,
    setBottomTabOverride,
    selectFile,
    selectContributor,
    clearSelection,
    setActiveInspectorTab,
  };
}
