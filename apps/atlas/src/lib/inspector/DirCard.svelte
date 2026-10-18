<script lang="ts">
  import { dirFacts, type WeeklyActivity } from '@gitrelic/scene';

  import ActivityCard from './ActivityCard.svelte';
  import Card from './Card.svelte';
  import FactRows from './FactRows.svelte';
  import PathText from './PathText.svelte';
  import type { GitrelicReport } from '@gitrelic/core';

  let {
    dir,
    report,
    activity = null,
  }: {
    dir: string;
    report: GitrelicReport;
    activity?: WeeklyActivity | null;
  } = $props();

  let rows = $derived(dirFacts(dir, report));
</script>

<Card eyebrow="Directory">
  <div class="text-[13px] leading-relaxed text-dir">
    <PathText path={`${dir}/`} />
  </div>
  <FactRows {rows} />
</Card>

<ActivityCard {activity} />
