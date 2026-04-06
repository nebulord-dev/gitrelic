import type { GitloreReport } from "@gitlore/core";
import type { InspectorTab } from "../../hooks/useSelection";
import { ActivityInspector } from "../inspector/ActivityInspector";
import { ContributorsInspector } from "../inspector/ContributorsInspector";
import { FileInspector } from "../inspector/FileInspector";

interface InspectorPanelProps {
  report: GitloreReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
}

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "file", label: "Inspector" },
  { id: "contributors", label: "Contributors" },
  { id: "activity", label: "Activity" },
];

export function InspectorPanel({
  report,
  selectedFile,
  selectedContributor,
  activeTab,
  onTabChange,
  onSelectFile,
  onSelectContributor,
}: InspectorPanelProps) {
  const hasSelection = selectedFile != null || selectedContributor != null;

  return (
    <div
      style={{
        width: 260,
        minWidth: 260,
        borderLeft: "1px solid var(--border-primary)",
        background: "var(--surface-primary)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-primary)",
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "8px 4px",
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

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        {!hasSelection ? (
          <div
            style={{
              color: "var(--text-tertiary)",
              fontSize: 11,
              textAlign: "center",
              marginTop: 40,
            }}
          >
            Select a file or contributor to inspect
          </div>
        ) : activeTab === "file" && selectedFile ? (
          <FileInspector
            report={report}
            file={selectedFile}
            onSelectContributor={onSelectContributor}
          />
        ) : activeTab === "contributors" ? (
          <ContributorsInspector
            report={report}
            file={selectedFile}
            contributor={selectedContributor}
            onSelectFile={onSelectFile}
          />
        ) : activeTab === "activity" && selectedFile ? (
          <ActivityInspector
            report={report}
            file={selectedFile}
          />
        ) : (
          <div
            style={{
              color: "var(--text-tertiary)",
              fontSize: 11,
              textAlign: "center",
              marginTop: 40,
            }}
          >
            Select a file to view activity
          </div>
        )}
      </div>
    </div>
  );
}
