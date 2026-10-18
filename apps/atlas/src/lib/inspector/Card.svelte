<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    eyebrow,
    id,
    children,
  }: {
    eyebrow: string;
    /** Anchor for the inspector's section links. */
    id?: string;
    children: Snippet;
  } = $props();
</script>

<section {id} class="card flex scroll-mt-3 flex-col gap-2.5 px-5 py-4.5">
  <h2
    class="m-0 text-[11px] font-normal tracking-[0.16em] text-muted uppercase"
  >
    {eyebrow}
  </h2>
  {@render children()}
</section>
