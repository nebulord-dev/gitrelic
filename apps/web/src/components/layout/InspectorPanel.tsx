import type { GitloreReport } from "@gitlore/core";
import { useState } from "react";
import type { InspectorTab } from "../../hooks/useSelection";
import { ActivityInspector } from "../inspector/ActivityInspector";
import { ContributorsInspector } from "../inspector/ContributorsInspector";
import { FileInspector } from "../inspector/FileInspector";
import { GuidePanel } from "../inspector/GuidePanel";

interface InspectorPanelProps {
  report: GitloreReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
}

const CONTEXT_TABS: { id: InspectorTab; label: string }[] = [
  { id: "file", label: "Inspector" },
  { id: "contributors", label: "Contributors" },
  { id: "activity", label: "Activity" },
];

type UtilityTab = "guide" | "narrative" | "refactor";

const UTILITY_TABS: { id: UtilityTab; label: string }[] = [
  { id: "guide", label: "Guide" },
  { id: "narrative", label: "Narrative" },
  { id: "refactor", label: "Refactor" },
];

const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
  flex: 1,
  textAlign: "center",
  padding: "8px 4px",
  fontSize: 10,
  border: "none",
  background: "none",
  cursor: "pointer",
  color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
  borderBottom: `2px solid ${isActive ? "var(--accent-primary)" : "transparent"}`,
});

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
  const [utilityTab, setUtilityTab] = useState<UtilityTab>("guide");

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
      {/* ─── Top: Context tabs ─── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-primary)",
          flexShrink: 0,
        }}
      >
        {CONTEXT_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={tabButtonStyle(activeTab === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Top content */}
      <div style={{ flex: 1, overflow: "auto", padding: 12, minHeight: 0 }}>
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

      {/* ─── Bottom: Utility tabs ─── */}
      <div
        style={{
          borderTop: "1px solid var(--border-primary)",
          display: "flex",
          flexDirection: "column",
          height: "40%",
          minHeight: 120,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-primary)",
            flexShrink: 0,
          }}
        >
          {UTILITY_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setUtilityTab(tab.id)}
              style={tabButtonStyle(utilityTab === tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
          {utilityTab === "guide" ? (
            <GuidePanel report={report} />
          ) : (
            <div
              style={{
                color: "var(--text-tertiary)",
                fontSize: 11,
                textAlign: "center",
                marginTop: 20,
              }}
            >
              {utilityTab === "narrative" ? "AI Narrative \u2014 coming soon" : "Refactor Brief \u2014 coming soon"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
