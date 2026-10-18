<script lang="ts">
  import {
    catalogEntry,
    classicUrl,
    docsUrl,
    lensesOf,
    PRESET_GROUPS,
    type CatalogEntry,
  } from '@gitrelic/scene';
  import { tick } from 'svelte';

  import { modalOpen, pressed } from './shortcut';

  let {
    open = $bindable(false),
    lens = null,
    onopen,
  }: {
    open?: boolean;
    /** The open lens, pinned at the top. */
    lens?: string | null;
    /** Opens a lens that has an Atlas view. */
    onopen?: (lens: string) => void;
  } = $props();

  let query = $state('');
  let input = $state<HTMLInputElement>();
  let returnFocus: HTMLElement | null = null;

  let pinned = $derived(lens ? catalogEntry(lens) : undefined);
  let groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const matches = (e: CatalogEntry) =>
      !q ||
      e.label.toLowerCase().includes(q) ||
      e.explain.toLowerCase().includes(q);
    return PRESET_GROUPS.map((g) => ({
      ...g,
      entries: lensesOf(g.id).filter((e) => e.id !== pinned?.id && matches(e)),
    })).filter((g) => g.entries.length > 0);
  });

  // Set up on every open, however it was opened (the ? key or a button).
  let wasOpen = false;
  $effect(() => {
    if (open && !wasOpen) {
      returnFocus = document.activeElement as HTMLElement | null;
      query = '';
      void tick().then(() => input?.focus());
    }
    wasOpen = open;
  });

  function close() {
    open = false;
    returnFocus?.focus?.();
    returnFocus = null;
  }

  // aria-modal promises focus stays inside: Tab and Shift+Tab wrap around
  // the sheet's controls instead of reaching the page behind it.
  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const sheet = e.currentTarget as HTMLElement;
    const focusable = [
      ...sheet.querySelectorAll<HTMLElement>('a[href], button, input'),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function onWindowKey(e: KeyboardEvent) {
    // Not over another modal (the palette): one dialog at a time.
    if (!open && !modalOpen() && pressed(e, '?')) {
      e.preventDefault();
      open = true;
    }
  }

  // Capture phase, like the palette: Escape closes the sheet before the
  // inspector sees it, so the selection behind stays.
  function onWindowKeyCapture(e: KeyboardEvent) {
    if (open && e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  }
</script>

<svelte:window onkeydown={onWindowKey} onkeydowncapture={onWindowKeyCapture} />

{#snippet links(entry: CatalogEntry)}
  {@const docs = docsUrl(entry)}
  <span class="flex shrink-0 gap-3 text-[12px]">
    {#if entry.atlas}
      <button
        type="button"
        class="cursor-pointer bg-transparent p-0 font-[inherit] text-accent"
        onclick={() => {
          close();
          onopen?.(entry.id);
        }}>Open</button
      >
    {:else}
      <a
        class="text-muted no-underline hover:text-soft"
        href={classicUrl(entry.id)}>Classic ↗</a
      >
    {/if}
    {#if docs}
      <a
        class="text-muted no-underline hover:text-soft"
        href={docs}
        target="_blank"
        rel="noopener noreferrer">Docs ↗</a
      >
    {/if}
  </span>
{/snippet}

{#if open}
  <div
    class="fixed inset-0 z-40 bg-[rgb(0_0_0/0.45)]"
    role="presentation"
    onclick={close}
  ></div>
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Guide"
    tabindex="-1"
    onkeydown={trapFocus}
    class="panel fixed top-0 right-0 bottom-0 z-50 flex w-[min(480px,100vw)] flex-col"
  >
    <div class="flex flex-col gap-3.5 border-b border-panel-border p-6 pb-4">
      <div class="flex items-center justify-between">
        <h2 class="m-0 text-[22px] font-semibold">Guide</h2>
        <button
          type="button"
          onclick={close}
          class="cursor-pointer rounded-chip border border-control-border bg-transparent px-2.5 py-1 font-[inherit] text-[13px] text-muted hover:text-text"
          >Close · Esc</button
        >
      </div>
      <input
        bind:this={input}
        bind:value={query}
        type="search"
        aria-label="Find a term"
        placeholder="Find a term — churn, ghost, blast…"
        autocomplete="off"
        spellcheck="false"
        class="h-10 rounded-chip border border-control-border bg-bg px-3 font-[inherit] text-[14px] text-text outline-none"
      />
    </div>

    <div class="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
      {#if pinned && !query.trim()}
        <article
          class="flex flex-col gap-2 rounded-chip border border-accent bg-control-border p-4"
        >
          <span class="text-[11px] tracking-[0.16em] text-accent uppercase"
            >You're here</span
          >
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-lg font-semibold">{pinned.label}</span>
            {@render links(pinned)}
          </div>
          <p class="m-0 text-[14px] leading-relaxed">{pinned.explain}</p>
        </article>
      {/if}

      {#each groups as group (group.id)}
        <section aria-label={group.label} class="flex flex-col">
          <h3
            class="m-0 mb-1.5 text-[11px] font-normal tracking-[0.16em] text-muted uppercase"
          >
            {group.label}
          </h3>
          {#each group.entries as entry (entry.id)}
            <div class="flex flex-col gap-1 border-t border-panel-border py-2">
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-[15px]">{entry.label}</span>
                {@render links(entry)}
              </div>
              <p class="m-0 text-[13px] leading-snug text-soft">
                {entry.explain}
              </p>
            </div>
          {/each}
        </section>
      {:else}
        <p class="m-0 text-[13px] text-muted">Nothing matches.</p>
      {/each}
    </div>
  </div>
{/if}
