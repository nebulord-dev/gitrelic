import { useCallback, useState } from "react";

export type NavItem =
  | "dashboard"
  | "health-score"
  | "hotspots"
  | "cursed-files"
  | "dead-code"
  | "complexity"
  | "rewrites"
  | "bus-factor"
  | "ghost-files"
  | "knowledge"
  | "coupling"
  | "contributors"
  | "co-authors"
  | "timing"
  | "parallel-dev"
  | "shame"
  | "age-map"
  | "languages"
  | "test-coverage"
  | "renames";

export type BottomTab =
  | "hotspots"
  | "cursed-files"
  | "bus-factor"
  | "coupling"
  | "contributors"
  | "parallel-dev"
  | "shame"
  | "age-map";

const navToTab: Partial<Record<NavItem, BottomTab>> = {
  dashboard: "hotspots",
  hotspots: "hotspots",
  "cursed-files": "cursed-files",
  "bus-factor": "bus-factor",
  "ghost-files": "bus-factor",
  knowledge: "bus-factor",
  coupling: "coupling",
  contributors: "contributors",
  "co-authors": "contributors",
  timing: "contributors",
  "parallel-dev": "parallel-dev",
  shame: "shame",
  "age-map": "age-map",
};

export type InspectorTab = "file" | "contributors" | "activity";

export interface SelectionState {
  selectedFile: string | null;
  selectedContributor: string | null;
  activeNavItem: NavItem;
  activeBottomTab: BottomTab;
  activeInspectorTab: InspectorTab;
  selectFile: (file: string) => void;
  selectContributor: (email: string) => void;
  clearSelection: () => void;
  navigateTo: (item: NavItem) => void;
  setActiveBottomTab: (tab: BottomTab) => void;
  setActiveInspectorTab: (tab: InspectorTab) => void;
}

export function useSelection(): SelectionState {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [activeNavItem, setActiveNavItem] = useState<NavItem>("dashboard");
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("hotspots");
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("file");

  const selectFile = useCallback((file: string) => {
    setSelectedFile(file);
    setSelectedContributor(null);
    setActiveInspectorTab("file");
  }, []);

  const selectContributor = useCallback((email: string) => {
    setSelectedContributor(email);
    setSelectedFile(null);
    setActiveInspectorTab("contributors");
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setSelectedContributor(null);
  }, []);

  const navigateTo = useCallback((item: NavItem) => {
    setActiveNavItem(item);
    const tab = navToTab[item];
    if (tab) setActiveBottomTab(tab);
  }, []);

  return {
    selectedFile,
    selectedContributor,
    activeNavItem,
    activeBottomTab,
    activeInspectorTab,
    selectFile,
    selectContributor,
    clearSelection,
    navigateTo,
    setActiveBottomTab,
    setActiveInspectorTab,
  };
}
