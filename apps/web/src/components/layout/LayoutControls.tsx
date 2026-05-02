import { cn } from '../../utils/cn';

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
    <div className="flex items-center gap-2">
      <button
        aria-label="Hide sidebars"
        title="Hide sidebars (⌘.)"
        aria-pressed={mode === 'focus-canvas'}
        onClick={() => onModeChange(mode === 'focus-canvas' ? 'default' : 'focus-canvas')}
        className={iconButtonClass(mode === 'focus-canvas')}
      >
        ◧
      </button>
      <button
        aria-label="Fullscreen hero"
        title="Fullscreen hero (⌘⇧.)"
        aria-pressed={mode === 'fullscreen-hero'}
        onClick={() => onModeChange(mode === 'fullscreen-hero' ? 'default' : 'fullscreen-hero')}
        className={iconButtonClass(mode === 'fullscreen-hero')}
      >
        ⬒
      </button>
      <button
        aria-label="Fullscreen table"
        title="Fullscreen table (⌘⇧,)"
        aria-pressed={mode === 'fullscreen-table'}
        onClick={() => onModeChange(mode === 'fullscreen-table' ? 'default' : 'fullscreen-table')}
        className={iconButtonClass(mode === 'fullscreen-table')}
      >
        ⬓
      </button>
      <select
        aria-label="Layout mode"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as LayoutMode)}
        className="text-[11px] px-1.5 py-0.5 bg-surface-tertiary text-text-primary border border-border-primary rounded"
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

function iconButtonClass(active: boolean): string {
  return cn(
    'px-2 py-1 text-sm leading-none border border-border-primary rounded text-text-secondary cursor-pointer',
    active ? 'bg-surface-elevated' : 'bg-transparent',
  );
}
