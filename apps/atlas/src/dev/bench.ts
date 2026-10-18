// The renderer's performance gate (PR 2.2): 5,000 marks and 2,000 curved
// links morphing grid ↔ fan, with a 168-cell arc ring and 300 labels, an
// interrupt button, and live p50/p95 frame times. Dev-only; see bench.html.
//
// Gate: p95 frame interval ≤ 16.7 ms while morphing, in both themes, and an
// interrupt that reverses without a jump — on an M2 MacBook Air with Chrome
// DevTools' 4× CPU slowdown, standing in for a 2020-era Intel laptop.

import '../app.css';
import {
  emptyScene,
  ids,
  type Link,
  type Mark,
  type Scene,
} from '@gitrelic/scene';

import { AtlasStage } from '../lib/engine/atlasStage';
import { PixiStage } from '../lib/engine/pixiStage';
import { prefersReducedMotion } from '../lib/engine/reducedMotion';
import { paletteFromDocument } from '../lib/engine/themeBridge';

const MARKS = 5000;
const LINKS = 2000;
const LABELS = 300;
const WORLD = { width: 2400, height: 1600 };
const RISK = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;

function dot(i: number, x: number, y: number): Mark {
  return {
    id: ids.file(`bench/${i}.ts`),
    shape: i % 9 === 0 ? 'ring' : 'dot',
    paint: RISK[i % 4],
    x,
    y,
    r: 3 + (i % 3),
    w: 0,
    h: 0,
    a0: 0,
    a1: 0,
    alpha: 1,
    label: i < LABELS ? `src/bench/file-${i}.ts` : undefined,
    labelPriority: LABELS - i,
  };
}

/** The Commit Timing clock's 7 × 24 cells, identical in both layouts. */
function ring(): Mark[] {
  const cells: Mark[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      const a0 = (hour / 24) * Math.PI * 2;
      cells.push({
        id: ids.cell(dow, hour),
        shape: 'arc',
        paint: {
          mix: ['--cell-base', '--accent'],
          t: ((dow * 24 + hour) % 13) / 12,
        },
        x: WORLD.width - 260,
        y: 260,
        r: 80 + dow * 22,
        w: 0,
        h: 18,
        a0,
        a1: a0 + (Math.PI * 2) / 24 - 0.02,
        alpha: 1,
      });
    }
  }
  return cells;
}

function links(): Link[] {
  return Array.from({ length: LINKS }, (_, i) => ({
    id: `bench-link-${i}`,
    source: ids.file(`bench/${i}.ts`),
    target: ids.file(`bench/${(i * 7919 + 13) % MARKS}.ts`),
    curve: 'arc' as const,
    width: 1,
    paint: i % 20 === 0 ? ('--link-hot' as const) : ('--link' as const),
    alpha: 1,
  }));
}

function gridScene(): Scene {
  const cols = 100;
  const marks = Array.from({ length: MARKS }, (_, i) =>
    dot(i, 60 + (i % cols) * 18, 60 + Math.floor(i / cols) * 18),
  );
  return { ...emptyScene(WORLD), marks: [...marks, ...ring()], links: links() };
}

function fanScene(): Scene {
  const marks = Array.from({ length: MARKS }, (_, i) => {
    const t = i / MARKS;
    const angle = -Math.PI / 2.4 + t * (Math.PI / 1.2);
    const radius = 500 + (i % 50) * 14;
    return dot(
      i,
      200 + Math.cos(angle) * radius,
      800 + Math.sin(angle) * radius,
    );
  });
  return { ...emptyScene(WORLD), marks: [...marks, ...ring()], links: links() };
}

// ── Stats ────────────────────────────────────────────────────────────────────

const intervals: number[] = [];
const cpu: number[] = [];
let lastFrame = 0;

function record(ms: number) {
  const now = performance.now();
  // Only consecutive frames count as an interval; idle gaps aren't jank.
  if (now - lastFrame < 100) intervals.push(now - lastFrame);
  lastFrame = now;
  cpu.push(ms);
  if (intervals.length > 600) intervals.shift();
  if (cpu.length > 600) cpu.shift();
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  ];
}

// ── Page ─────────────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.style.cssText = style;
  if (text) node.textContent = text;
  return node;
}

const host = el('div', 'position:fixed;inset:0');
const labelHost = el(
  'div',
  'position:fixed;inset:0;pointer-events:none;overflow:hidden',
);
const panel = el(
  'div',
  'position:fixed;top:12px;left:12px;display:flex;gap:8px;align-items:center;' +
    'padding:8px;background:var(--panel-bg);border:1px solid var(--panel-border);' +
    'border-radius:6px;font:12px var(--font-body);color:var(--text)',
);
const stats = el(
  'pre',
  'margin:0 0 0 8px;font:11px ui-monospace,monospace;color:var(--soft)',
);
document.body.append(host, labelHost, panel);

const params = new URLSearchParams(location.search);
let reduced = prefersReducedMotion();
let fanned = false;
// ?glow starts in the Glow theme.
let theme: 'flat' | 'glow' = params.has('glow') ? 'glow' : 'flat';
document.documentElement.dataset.theme = theme;

const stage = await AtlasStage.create(
  host,
  labelHost,
  { width: innerWidth, height: innerHeight },
  {
    renderer: new PixiStage(),
    readPalette: () => paletteFromDocument(),
    glow: theme === 'glow',
    reducedMotion: () => reduced,
    onFrame: record,
  },
);

if (!stage) {
  panel.append(el('span', '', 'WebGL is unavailable in this browser.'));
} else {
  const morph = () => {
    fanned = !fanned;
    intervals.length = 0;
    cpu.length = 0;
    stage.show(fanned ? fanScene() : gridScene());
  };
  const button = (text: string, onClick: () => void) => {
    const b = el(
      'button',
      'font:inherit;padding:4px 10px;cursor:pointer',
      text,
    );
    b.addEventListener('click', onClick);
    panel.append(b);
    return b;
  };

  button('Morph', morph);
  button('Interrupt', () => {
    morph();
    setTimeout(morph, 250);
  });
  button('Theme', () => {
    theme = theme === 'flat' ? 'glow' : 'flat';
    document.documentElement.dataset.theme = theme;
    stage.setTheme(paletteFromDocument(), theme === 'glow');
  });
  const motion = button('', () => {
    reduced = !reduced;
    motion.textContent = reduced ? 'Motion: reduced' : 'Motion: full';
  });
  motion.textContent = reduced ? 'Motion: reduced' : 'Motion: full';
  panel.append(stats);

  addEventListener('resize', () =>
    stage.resize({ width: innerWidth, height: innerHeight }),
  );
  stage.show(gridScene());
  // ?morph starts a grid → fan morph after a beat (for screenshots).
  if (params.has('morph')) setTimeout(morph, 500);

  setInterval(() => {
    stats.textContent =
      `${MARKS} marks · ${LINKS} links · 168 arcs\n` +
      `frame interval p50 ${percentile(intervals, 50).toFixed(1)} ms · ` +
      `p95 ${percentile(intervals, 95).toFixed(1)} ms\n` +
      `draw CPU      p50 ${percentile(cpu, 50).toFixed(1)} ms · ` +
      `p95 ${percentile(cpu, 95).toFixed(1)} ms`;
  }, 250);
}
