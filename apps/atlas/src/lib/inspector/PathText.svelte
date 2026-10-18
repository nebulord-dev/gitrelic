<script lang="ts">
  let { path }: { path: string } = $props();

  // A folder path may break only after a slash, so no segment is split.
  let parts = $derived(
    path.split('/').map((p, i, all) => (i < all.length - 1 ? `${p}/` : p)),
  );
</script>

<span class="font-mono"
  >{#each parts as part, i (i)}{part}<wbr />{/each}</span
>
