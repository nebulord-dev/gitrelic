<script lang="ts">
  import { dirFacts } from '@gitrelic/scene';

  import Card from './Card.svelte';
  import FactRows from './FactRows.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let { dir, report }: { dir: string; report: GitrelicReport } = $props();

  let rows = $derived(dirFacts(dir, report));
</script>

<Card eyebrow="Directory">
  <div class="font-mono text-[13px] break-all text-dir">{dir}/</div>
  <FactRows {rows} />
</Card>
