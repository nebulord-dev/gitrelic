<script lang="ts">
  import { classicUrl, docsUrl, type CatalogEntry } from '@gitrelic/scene';

  import Card from './Card.svelte';

  let { entry }: { entry: CatalogEntry } = $props();

  let docs = $derived(docsUrl(entry));
</script>

<Card eyebrow="About">
  <div class="text-lg font-semibold">{entry.label}</div>
  <p class="m-0 text-[13px] leading-relaxed text-soft">{entry.explain}</p>
  <div class="flex gap-4 text-[13px]">
    {#if !entry.atlas}
      <a class="text-accent" href={classicUrl(entry.id)}>Open in classic ↗</a>
    {/if}
    {#if docs}
      <a
        class="text-accent"
        href={docs}
        target="_blank"
        rel="noopener noreferrer">Docs ↗</a
      >
    {/if}
  </div>
</Card>
