import React from "react";
import GanttChart from "react-modern-gantt";
import { basicDemoData } from "./data";

const DemoTooltipPortal: React.FC<{ darkMode: boolean }> = ({ darkMode }) => {
  return (
    <div>
      <p style={{ marginBottom: "12px" }}>
        Hover task bars inside the nested scroll areas below. The tooltip is
        rendered in a portal, so it stays above the clipping containers instead
        of being cut off by overflow rules.
      </p>

      <div
        style={{
          maxWidth: "760px",
          maxHeight: "320px",
          overflow: "auto",
          padding: "24px",
          border: "1px solid #d1d5db",
          borderRadius: "12px",
          background: darkMode ? "#111827" : "#f9fafb",
        }}
      >
        <div
          style={{
            width: "1100px",
            overflow: "hidden",
            padding: "24px",
            borderRadius: "12px",
            background: darkMode ? "#1f2937" : "#ffffff",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.08)",
          }}
        >
          <GanttChart
            tasks={basicDemoData}
            title="Tooltip Portal Demo"
            darkMode={darkMode}
            showProgress
            maxHeight={220}
          />
        </div>
      </div>
    </div>
  );
};

export default DemoTooltipPortal;
