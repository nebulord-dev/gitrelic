<script lang="ts">
  import {
    rankEntities,
    type EntityEntry,
    type EntityIndex,
  } from '@gitrelic/scene';
  import { tick } from 'svelte';

  import { opensPalette } from './shortcut';

  let {
    index,
    open = $bindable(false),
    onpick,
  }: {
    index: EntityIndex;
    open?: boolean;
    onpick: (entry: EntityEntry) => void;
  } = $props();

  const KIND_LABEL = {
    analyzer: 'Analyzer',
    person: 'Person',
    dir: 'Directory',
    file: 'File',
  } as const;
  const KIND_CLASS = {
    analyzer: 'text-accent',
    person: 'text-person',
    dir: 'text-dir',
    file: 'text-file',
  } as const;

  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement>();
  let returnFocus: HTMLElement | null = null;

  // An empty query lists the analyzers: the palette doubles as navigation.
  let results = $derived(
    query.trim()
      ? rankEntities(query, index.entries, 12).map((r) => r.entry)
      : index.entries.filter((e) => e.kind === 'analyzer'),
  );

  // A new query highlights its best match, not whatever row was highlighted.
  // Clamped at 0 even with no results, so Enter never reads results[-1].
  function onQueryInput() {
    active = 0;
  }

  // Set up on every open, however it was opened: the shortcut, or a parent
  // setting `open` (TopBar's Search button).
  let wasOpen = false;
  $effect(() => {
    if (open && !wasOpen) {
      returnFocus = document.activeElement as HTMLElement | null;
      query = '';
      active = 0;
      void tick().then(() => input?.focus());
    }
    wasOpen = open;
  });

  function close() {
    open = false;
    returnFocus?.focus?.();
    returnFocus = null;
  }

  function pick(entry: EntityEntry | undefined) {
    if (!entry) return;
    close();
    onpick(entry);
  }

  // Escape closes the palette wherever focus is. Capture phase, so it runs
  // before the inspector's window listener, which sees it already handled
  // and leaves the selection behind the palette alone.
  function onWindowKeyCapture(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }

  function onWindowKey(e: KeyboardEvent) {
    if (opensPalette(e)) {
      e.preventDefault();
      if (open) close();
      else open = true;
    }
  }

  function onInputKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.max(0, Math.min(results.length - 1, active + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, active - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active]);
    } else if (e.key === 'Tab') {
      // The input is the dialog's only control: keep focus in the modal.
      e.preventDefault();
    }
  }
</script>

<svelte:window onkeydown={onWindowKey} onkeydowncapture={onWindowKeyCapture} />

{#if open}
  <!-- Backdrop: a click outside the dialog closes it. -->
  <div
    class="fixed inset-0 z-40 bg-[rgb(0_0_0/0.45)]"
    role="presentation"
    onclick={close}
  ></div>
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Search"
    tabindex="-1"
    onmousedown={(e) => {
      // Clicks on the padding or empty list keep focus in the input.
      if (open && e.target !== input) {
        e.preventDefault();
        input?.focus();
      }
    }}
    class="modal fixed top-[14vh] rounded-[var(--card-radius)] left-1/2 z-50 flex max-h-[70vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden"
  >
    <input
      bind:this={input}
      bind:value={query}
      oninput={onQueryInput}
      onkeydown={onInputKey}
      type="text"
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-results"
      aria-activedescendant={results[active] ? `palette-${active}` : undefined}
      aria-label="Find a file, person or analyzer"
      placeholder="Find a file, person or analyzer…"
      autocomplete="off"
      spellcheck="false"
      class="border-0 border-b border-panel-border bg-transparent px-4 py-3 font-[inherit] text-[15px] text-text outline-none"
    />
    <ul
      id="palette-results"
      role="listbox"
      class="m-0 list-none overflow-y-auto p-1.5"
    >
      {#each results as entry, i (entry.id)}
        <li
          id={`palette-${i}`}
          role="option"
          aria-selected={i === active}
          class={[
            'flex cursor-pointer items-baseline gap-3 rounded-chip px-3 py-2 text-[13px]',
            i === active ? 'bg-[var(--card-border)]' : '',
          ]}
          onmousemove={() => (active = i)}
          onmousedown={(e) => {
            e.preventDefault();
            pick(entry);
          }}
        >
          <span class={['w-18 shrink-0 text-[11px]', KIND_CLASS[entry.kind]]}>
            {KIND_LABEL[entry.kind]}
          </span>
          <span class="truncate text-text">{entry.label}</span>
          <span class="ml-auto truncate text-[12px] text-muted"
            >{entry.detail}</span
          >
        </li>
      {:else}
        <li class="px-3 py-2 text-[13px] text-muted">No matches.</li>
      {/each}
    </ul>
  </div>
{/if}
