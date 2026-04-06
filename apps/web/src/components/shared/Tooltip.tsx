import type { CSSProperties, ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom";
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: position === "top" ? rect.top : rect.bottom });
    }
    setVisible(true);
  }, [position]);

  const tooltipStyle: CSSProperties = {
    position: "fixed",
    left: coords.x,
    top: position === "top" ? coords.y - 8 : coords.y + 8,
    transform: position === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
    background: "var(--tooltip-bg)",
    color: "var(--tooltip-text)",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 10,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    zIndex: 1000,
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  };

  return (
    <div ref={wrapRef} onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)} style={{ display: "inline-block" }}>
      {children}
      {visible && <div style={tooltipStyle}>{content}</div>}
    </div>
  );
}
