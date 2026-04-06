import type { GitloreReport } from "@gitlore/core";
import { useSelection } from "../../hooks/useSelection";
import { BottomPanel } from "./BottomPanel";
import { InspectorPanel } from "./InspectorPanel";
import { MetricsStrip } from "./MetricsStrip";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface ShellProps {
  report: GitloreReport;
}

export function Shell({ report }: ShellProps) {
  const selection = useSelection();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--surface-primary)",
      }}
    >
      {/* Top bar */}
      <TopBar report={report} />

      {/* Body: sidebar + center + inspector */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left sidebar */}
        <Sidebar
          report={report}
          activeItem={selection.activeNavItem}
          onNavigate={selection.navigateTo}
        />

        {/* Center area: metrics + hero + bottom */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <MetricsStrip report={report} />

          {/* Hero visualization */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: "var(--space-md)",
              overflow: "auto",
            }}
          >
            <div
              style={{
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                fontSize: 12,
              }}
            >
              Hero visualization (treemap) — Task 18
            </div>
          </div>

          {/* Bottom panel */}
          <BottomPanel
            report={report}
            activeTab={selection.activeBottomTab}
            onTabChange={selection.setActiveBottomTab}
            selectedFile={selection.selectedFile}
            onSelectFile={selection.selectFile}
          />
        </div>

        {/* Right inspector */}
        <InspectorPanel
          report={report}
          selectedFile={selection.selectedFile}
          selectedContributor={selection.selectedContributor}
          activeTab={selection.activeInspectorTab}
          onTabChange={selection.setActiveInspectorTab}
          onSelectFile={selection.selectFile}
          onSelectContributor={selection.selectContributor}
        />
      </div>
    </div>
  );
}
