<script lang="ts">
  import { recentShare, spanLabels } from '../time/activity';
  import ActivityStrip from '../time/ActivityStrip.svelte';
  import Card from './Card.svelte';
  import type { WeeklyActivity } from '@gitrelic/scene';

  let {
    activity = null,
    failed = false,
    id,
  }: {
    /** Weekly commits with the entity's marked; null while history loads. */
    activity?: WeeklyActivity | null;
    /** The history couldn't be loaded. */
    failed?: boolean;
    id?: string;
  } = $props();

  let span = $derived(activity ? spanLabels(activity) : null);
  let share = $derived(activity ? recentShare(activity) : null);
</script>

<Card eyebrow="Activity" {id}>
  {#if activity && span}
    <ActivityStrip {activity} height={32} highlight />
    <div class="flex justify-between text-[11px] text-muted">
      <span>{span[0]}</span><span>{span[1]}</span>
    </div>
    <p class="m-0 text-[13px] text-soft">
      {share ?? 'No commits in the window.'}
    </p>
  {:else}
    <p class="m-0 text-[13px] text-muted">
      {failed ? 'Commit history unavailable.' : 'Loading history…'}
    </p>
  {/if}
</Card>
