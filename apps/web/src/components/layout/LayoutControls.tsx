import type { LayoutMode } from './Shell';

interface LayoutControlsProps {
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
}

const MODE_LABELS: Record<LayoutMode, string> = {
  default: 'Default',
  'focus-canvas': 'Focus Canvas',
  'fullscreen-hero': 'Fullscreen Hero',
  'fullscreen-table': 'Fullscreen Table',
  'canvas-minimal': 'Canvas Minimal',
};

export function LayoutControls({ mode, onModeChange }: LayoutControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        aria-label="Toggle sidebar"
        onClick={() => onModeChange(mode === 'focus-canvas' ? 'default' : 'focus-canvas')}
        style={iconButtonStyle(mode !== 'default' && mode !== 'canvas-minimal')}
      >
        ◧
      </button>
      <button
        aria-label="Toggle bottom panel"
        onClick={() => onModeChange(mode === 'fullscreen-hero' ? 'default' : 'fullscreen-hero')}
        style={iconButtonStyle(mode === 'fullscreen-hero' || mode === 'canvas-minimal')}
      >
        ⬓
      </button>
      <button
        aria-label="Toggle inspector"
        onClick={() => onModeChange(mode === 'default' ? 'focus-canvas' : 'default')}
        style={iconButtonStyle(mode !== 'default')}
      >
        ◨
      </button>
      <select
        aria-label="Layout mode"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as LayoutMode)}
        style={{
          fontSize: 11,
          padding: '2px 6px',
          background: 'var(--surface-tertiary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 4,
        }}
      >
        {(Object.keys(MODE_LABELS) as LayoutMode[]).map((m) => (
          <option key={m} value={m}>
            {MODE_LABELS[m]}
          </option>
        ))}
      </select>
    </div>
  );
}

function iconButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 8px',
    fontSize: 14,
    lineHeight: 1,
    border: '1px solid var(--border-primary)',
    borderRadius: 4,
    background: active ? 'var(--surface-elevated)' : 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  };
}
