import { useRoute } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { onMounted, watch } from 'vue';

import './custom.css';

// Vanilla DOM: click any mermaid diagram or content image to open it in a
// fullscreen overlay. Works for SVG (mermaid) and IMG (future screenshots)
// without depending on a third-party zoom library — medium-zoom's SVG
// support is unreliable, and this stays self-contained.

const ZOOMABLE_SELECTOR = '.mermaid, .vp-doc img';
const OVERLAY_CLASS = 'gr-zoom-overlay';

function openOverlay(source: Element) {
  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Zoomed view — click anywhere or press Escape to close');
  overlay.tabIndex = -1;

  const clone = source.cloneNode(true) as HTMLElement;
  // Strip mermaid's inline sizing — its SVG ships with width="100%" which
  // collapses to 0 inside our flex-auto-sized overlay child. Replace with
  // viewport-relative dimensions so the diagram fills available space.
  clone.removeAttribute('style');
  clone.querySelectorAll('svg').forEach((s) => {
    s.removeAttribute('style');
    s.setAttribute('width', '90vw');
    s.setAttribute('height', '85vh');
  });
  overlay.appendChild(clone);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  overlay.focus();
}

function bindZoom() {
  document.querySelectorAll(ZOOMABLE_SELECTOR).forEach((el) => {
    if ((el as HTMLElement).dataset.zoomable === 'true') return;
    (el as HTMLElement).dataset.zoomable = 'true';
    el.addEventListener('click', () => openOverlay(el));
  });
}

export default {
  ...DefaultTheme,
  setup() {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Vue setup, not React
    const route = useRoute();

    // Mermaid renders asynchronously after mount, so re-bind on a short delay
    // and on every route change to catch newly-rendered diagrams.
    const bindWithRetry = () => {
      bindZoom();
      setTimeout(bindZoom, 300);
    };

    onMounted(bindWithRetry);
    watch(() => route.path, bindWithRetry);
  },
};
