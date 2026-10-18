<script lang="ts">
  import type { Snippet } from 'svelte';

  let { eyebrow, children }: { eyebrow: string; children: Snippet } = $props();
</script>

<section
  class="flex flex-col gap-2.5 border-t border-panel-border pt-4 first:border-t-0 first:pt-0"
>
  <h2
    class="m-0 text-[11px] font-normal tracking-[0.16em] text-muted uppercase"
  >
    {eyebrow}
  </h2>
  {@render children()}
</section>
