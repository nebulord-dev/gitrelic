import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useRef, useState } from 'react';

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom';
  /**
   * Override the default `display: inline-block` wrapper styling. Use when the
   * trigger needs to participate in flex sizing or own its own truncation
   * styles (e.g. an ellipsizing cell that should still surface its full value
   * on hover).
   */
  wrapperStyle?: CSSProperties;
}

export function Tooltip({ content, children, position = 'top', wrapperStyle }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: position === 'top' ? rect.top : rect.bottom });
    }
    setVisible(true);
  }, [position]);

  return (
    <div
      ref={wrapRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
      className="inline-block cursor-help"
      style={wrapperStyle}
    >
      {children}
      {visible && (
        <div
          className="fixed bg-tooltip-bg text-tooltip-text px-2 py-1 rounded text-[10px] whitespace-nowrap pointer-events-none z-[1000] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
          style={{
            left: coords.x,
            top: position === 'top' ? coords.y - 8 : coords.y + 8,
            transform: position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
