import type { GitloreReport } from "@gitlore/core";
import type { BottomTab } from "../../hooks/useSelection";
import { AgeMapTab } from "../tabs/AgeMapTab";
import { BusFactorTab } from "../tabs/BusFactorTab";
import { ContributorsTab } from "../tabs/ContributorsTab";
import { CouplingTab } from "../tabs/CouplingTab";
import { CursedFilesTab } from "../tabs/CursedFilesTab";
import { HotspotsTab } from "../tabs/HotspotsTab";
import { ParallelDevTab } from "../tabs/ParallelDevTab";
import { ShameTab } from "../tabs/ShameTab";

interface BottomPanelProps {
  report: GitloreReport;
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const TABS: { id: BottomTab; label: string }[] = [
  { id: "hotspots", label: "Hotspots" },
  { id: "cursed-files", label: "Cursed Files" },
  { id: "bus-factor", label: "Bus Factor" },
  { id: "coupling", label: "Coupling" },
  { id: "contributors", label: "Contributors" },
  { id: "parallel-dev", label: "Parallel Dev" },
  { id: "shame", label: "Shame" },
  { id: "age-map", label: "Age Map" },
];

function TabContent({
  tab,
  report,
  selectedFile,
  onSelectFile,
}: {
  tab: BottomTab;
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}) {
  switch (tab) {
    case "hotspots":
      return (
        <HotspotsTab
          report={report}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      );
    case "cursed-files":
      return <CursedFilesTab report={report} onSelectFile={onSelectFile} />;
    case "bus-factor":
      return <BusFactorTab report={report} onSelectFile={onSelectFile} />;
    case "coupling":
      return <CouplingTab report={report} onSelectFile={onSelectFile} />;
    case "contributors":
      return <ContributorsTab report={report} />;
    case "parallel-dev":
      return <ParallelDevTab report={report} onSelectFile={onSelectFile} />;
    case "shame":
      return <ShameTab report={report} onSelectFile={onSelectFile} />;
    case "age-map":
      return <AgeMapTab report={report} onSelectFile={onSelectFile} />;
  }
}

export function BottomPanel({
  report,
  activeTab,
  onTabChange,
  selectedFile,
  onSelectFile,
}: BottomPanelProps) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--border-primary)",
        height: 220,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-primary)",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border-primary)",
          padding: "0 16px",
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: "8px 14px",
              fontSize: 10,
              border: "none",
              background: "none",
              cursor: "pointer",
              color:
                activeTab === tab.id
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              borderBottom: `2px solid ${
                activeTab === tab.id ? "var(--accent-primary)" : "transparent"
              }`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 16px" }}>
        <TabContent
          tab={activeTab}
          report={report}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      </div>
    </div>
  );
}
