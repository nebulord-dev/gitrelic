import { useCallback, useState } from 'react';

export type NavItem =
  | 'dashboard'
  | 'health-score'
  | 'hotspots'
  | 'cursed-files'
  | 'dead-code'
  | 'complexity'
  | 'rewrites'
  | 'bus-factor'
  | 'ghost-files'
  | 'knowledge'
  | 'coupling'
  | 'contributors'
  | 'co-authors'
  | 'timing'
  | 'parallel-dev'
  | 'shame'
  | 'age-map'
  | 'languages'
  | 'test-coverage'
  | 'renames';

export type BottomTab =
  | 'hotspots'
  | 'cursed-files'
  | 'bus-factor'
  | 'coupling'
  | 'contributors'
  | 'parallel-dev'
  | 'shame'
  | 'age-map'
  | 'dead-code'
  | 'complexity-trend'
  | 'rewrite-ratio'
  | 'churn-velocity'
  | 'blast-radius'
  | 'ghost-files'
  | 'knowledge-silos'
  | 'co-authors'
  | 'commit-timing'
  | 'languages'
  | 'test-coverage'
  | 'renames';

export type SidebarGroup =
  | 'overview'
  | 'code-health'
  | 'ownership-risk'
  | 'team-activity'
  | 'structure';

export const GROUP_TABS: Record<SidebarGroup, BottomTab[]> = {
  overview: ['hotspots', 'cursed-files', 'bus-factor', 'churn-velocity', 'ghost-files'],
  'code-health': [
    'hotspots',
    'cursed-files',
    'dead-code',
    'complexity-trend',
    'rewrite-ratio',
    'churn-velocity',
    'blast-radius',
  ],
  'ownership-risk': ['bus-factor', 'coupling', 'ghost-files', 'knowledge-silos'],
  'team-activity': ['contributors', 'co-authors', 'commit-timing', 'parallel-dev', 'shame'],
  structure: ['age-map', 'languages', 'test-coverage', 'renames'],
};

const navToGroupTab: Record<NavItem, { group: SidebarGroup; tab: BottomTab }> = {
  dashboard: { group: 'overview', tab: 'hotspots' },
  'health-score': { group: 'overview', tab: 'hotspots' },
  hotspots: { group: 'code-health', tab: 'hotspots' },
  'cursed-files': { group: 'code-health', tab: 'cursed-files' },
  'dead-code': { group: 'code-health', tab: 'dead-code' },
  complexity: { group: 'code-health', tab: 'complexity-trend' },
  rewrites: { group: 'code-health', tab: 'rewrite-ratio' },
  'bus-factor': { group: 'ownership-risk', tab: 'bus-factor' },
  coupling: { group: 'ownership-risk', tab: 'coupling' },
  'ghost-files': { group: 'ownership-risk', tab: 'ghost-files' },
  knowledge: { group: 'ownership-risk', tab: 'knowledge-silos' },
  contributors: { group: 'team-activity', tab: 'contributors' },
  'co-authors': { group: 'team-activity', tab: 'co-authors' },
  timing: { group: 'team-activity', tab: 'commit-timing' },
  'parallel-dev': { group: 'team-activity', tab: 'parallel-dev' },
  shame: { group: 'team-activity', tab: 'shame' },
  'age-map': { group: 'structure', tab: 'age-map' },
  languages: { group: 'structure', tab: 'languages' },
  'test-coverage': { group: 'structure', tab: 'test-coverage' },
  renames: { group: 'structure', tab: 'renames' },
};

export type InspectorTab = 'file' | 'contributors' | 'activity';

export type HeroViz =
  | 'treemap'
  | 'ownership'
  | 'coupling'
  | 'commit-graph'
  | 'scatter'
  | 'timeline'
  | 'swimlanes';

export interface SelectionState {
  selectedFile: string | null;
  selectedContributor: string | null;
  activeNavItem: NavItem;
  activeGroup: SidebarGroup;
  activeBottomTab: BottomTab;
  activeInspectorTab: InspectorTab;
  activeHeroViz: HeroViz;
  selectFile: (file: string) => void;
  selectContributor: (email: string) => void;
  clearSelection: () => void;
  navigateTo: (item: NavItem) => void;
  setActiveBottomTab: (tab: BottomTab) => void;
  setActiveInspectorTab: (tab: InspectorTab) => void;
  setActiveHeroViz: (viz: HeroViz) => void;
}

export function useSelection(): SelectionState {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [activeNavItem, setActiveNavItem] = useState<NavItem>('dashboard');
  const [activeGroup, setActiveGroup] = useState<SidebarGroup>('overview');
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('hotspots');
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('file');
  const [activeHeroViz, setActiveHeroViz] = useState<HeroViz>('treemap');

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

  const navigateTo = useCallback((item: NavItem) => {
    setActiveNavItem(item);
    const { group, tab } = navToGroupTab[item];
    setActiveGroup(group);
    setActiveBottomTab(tab);
  }, []);

  return {
    selectedFile,
    selectedContributor,
    activeNavItem,
    activeGroup,
    activeBottomTab,
    activeInspectorTab,
    selectFile,
    selectContributor,
    clearSelection,
    navigateTo,
    setActiveBottomTab,
    setActiveInspectorTab,
    activeHeroViz,
    setActiveHeroViz,
  };
}
