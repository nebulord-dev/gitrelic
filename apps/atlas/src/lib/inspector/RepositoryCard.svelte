<script lang="ts">
  import Card from './Card.svelte';
  import FactRows from './FactRows.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let { report }: { report: GitrelicReport } = $props();

  let rows = $derived([
    { label: 'Commits', value: report.meta.totalCommits.toLocaleString() },
    { label: 'Files', value: report.meta.totalFiles.toLocaleString() },
    { label: 'Authors', value: report.meta.totalAuthors.toLocaleString() },
    { label: 'Language', value: report.meta.primaryLanguage || '—' },
  ]);
</script>

<Card eyebrow="Repository">
  <div class="text-lg font-semibold">{report.repoName}</div>
  <FactRows {rows} />
</Card>
