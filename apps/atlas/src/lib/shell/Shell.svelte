<script lang="ts">
  import Inspector from './Inspector.svelte';
  import Rail from './Rail.svelte';
  import Stage from './Stage.svelte';
  import TopBar from './TopBar.svelte';
  import type { GitrelicReport } from '@gitrelic/core';
  import type { ThemeName } from '@gitrelic/scene';

  let {
    report,
    theme = $bindable(),
  }: { report: GitrelicReport; theme: ThemeName } = $props();
</script>

<div class="flex h-screen flex-col gap-4 p-4">
  <TopBar {report} bind:theme />
  <div class="flex min-h-0 flex-1 gap-4">
    <Rail />
    <Stage {theme} />
    <Inspector {report} />
  </div>
</div>
