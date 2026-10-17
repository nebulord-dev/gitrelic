<script lang="ts">
  import ThemeSwitch from './ThemeSwitch.svelte';
  import type { GitrelicReport } from '@gitrelic/core';
  import type { ThemeName } from '@gitrelic/scene';

  let {
    report,
    theme = $bindable(),
  }: { report: GitrelicReport; theme: ThemeName } = $props();

  // Empty for the blank dates normalizeReport backfills, or unparseable ones.
  const day = (iso: string) => {
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? '' : new Date(ms).toLocaleDateString();
  };
  let span = $derived.by(() => {
    const from = day(report.meta.firstCommit);
    const to = day(report.meta.lastCommit);
    return [
      `${report.meta.totalCommits.toLocaleString()} commits`,
      `${report.meta.totalAuthors.toLocaleString()} authors`,
      from && to ? `${from} – ${to}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
  });
</script>

<header class="flex flex-wrap items-center justify-between gap-3">
  <div class="flex flex-wrap items-baseline gap-3.5">
    <span class="text-[15px] font-semibold tracking-[0.18em]">GITRELIC</span>
    <span class="text-accent">{report.repoName}</span>
    <span>{report.meta.analyzedBranch}</span>
    <span class="text-[13px] text-muted">{span}</span>
  </div>
  <ThemeSwitch bind:theme />
</header>
