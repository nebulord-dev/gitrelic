<script lang="ts">
  import { catalogEntry, classicUrl } from '@gitrelic/scene';

  import Card from './Card.svelte';

  let {
    presets,
    onopen,
  }: {
    /** Preset ids, in display order. */
    presets: readonly string[];
    onopen?: (id: string) => void;
  } = $props();

  let entries = $derived(
    presets.map((id) => catalogEntry(id)).filter((e) => e !== undefined),
  );
</script>

{#if entries.length > 0}
  <Card eyebrow="Flagged by">
    <ul class="m-0 flex list-none flex-wrap gap-1.5 p-0">
      {#each entries as entry (entry.id)}
        <li>
          {#if entry.atlas}
            <button
              type="button"
              class="cursor-pointer rounded-chip border border-control-border px-2 py-0.5 text-[12px] text-soft hover:text-text"
              onclick={() => onopen?.(entry.id)}>{entry.label}</button
            >
          {:else}
            <a
              class="inline-block rounded-chip border border-control-border px-2 py-0.5 text-[12px] text-soft no-underline hover:text-text"
              href={classicUrl(entry.id)}>{entry.label} ↗</a
            >
          {/if}
        </li>
      {/each}
    </ul>
  </Card>
{/if}
