<script lang="ts">
  import type { GitrelicReport } from '@gitrelic/core';

  let { report }: { report: GitrelicReport } = $props();

  let facts = $derived([
    ['Commits', report.meta.totalCommits.toLocaleString()],
    ['Files', report.meta.totalFiles.toLocaleString()],
    ['Authors', report.meta.totalAuthors.toLocaleString()],
    ['Language', report.meta.primaryLanguage || '—'],
  ]);
</script>

<!-- Docked from 1200px; the narrow-screen drawer comes with the inspector cards (PR 3.1). -->
<aside
  aria-label="Inspector"
  class="card hidden w-80 shrink-0 flex-col gap-3 px-5 py-4.5 min-[1200px]:flex min-[1600px]:w-95"
>
  <div class="text-[11px] tracking-[0.16em] text-muted">REPOSITORY</div>
  <div class="text-lg font-semibold">{report.repoName}</div>
  <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
    {#each facts as [label, value] (label)}
      <dt class="text-muted">{label}</dt>
      <dd class="m-0 text-right">{value}</dd>
    {/each}
  </dl>
</aside>
