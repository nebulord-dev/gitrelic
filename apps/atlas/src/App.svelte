<script lang="ts">
  import { onMount } from 'svelte';

  import { loadReport } from './lib/data/loadReport';
  import Shell from './lib/shell/Shell.svelte';
  import { initialTheme, rememberTheme } from './lib/state/theme';
  import type { GitrelicReport } from '@gitrelic/core';

  let report = $state<GitrelicReport | null>(null);
  let error = $state<string | null>(null);
  let theme = $state(initialTheme());

  $effect(() => {
    document.documentElement.dataset.theme = theme;
    rememberTheme(theme);
  });

  onMount(() => {
    loadReport().then(
      (loaded) => (report = loaded),
      (err: Error) => (error = err.message),
    );
  });
</script>

{#if error}
  <div
    class="grid h-screen place-content-center gap-3 text-center text-muted"
    role="alert"
  >
    <div class="text-3xl" aria-hidden="true">☠</div>
    <div>{error}</div>
  </div>
{:else if report}
  <Shell {report} bind:theme />
{:else}
  <div
    class="grid h-screen place-content-center text-sm text-muted"
    aria-live="polite"
  >
    Excavating git history…
  </div>
{/if}
