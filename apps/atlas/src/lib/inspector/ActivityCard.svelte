<script lang="ts">
  import { recentShare, spanLabels } from '../time/activity';
  import ActivityStrip from '../time/ActivityStrip.svelte';
  import Card from './Card.svelte';
  import type { FixPoint, WeeklyActivity } from '@gitrelic/scene';

  let {
    activity = null,
    failed = false,
    id,
    fixes = null,
    windowDays = 30,
  }: {
    /** Weekly commits with the entity's marked; null while history loads. */
    activity?: WeeklyActivity | null;
    /** The history couldn't be loaded. */
    failed?: boolean;
    id?: string;
    /** A rated file's fix rate: its fixes are listed under the strip. */
    fixes?: FixPoint | null;
    windowDays?: number;
  } = $props();

  let span = $derived(activity ? spanLabels(activity) : null);
  let share = $derived(activity ? recentShare(activity) : null);
</script>

<Card eyebrow="Activity" {id}>
  {#if activity && span}
    <ActivityStrip {activity} height={32} highlight maxBars={120} />
    <div class="flex justify-between text-[11px] text-muted">
      <span>{span[0]}</span><span>{span[1]}</span>
    </div>
    <p class="m-0 text-[13px] text-soft">
      {share ?? 'No commits touch this selection.'}
    </p>
  {:else}
    <p class="m-0 text-[13px] text-muted">
      {failed ? 'Commit history unavailable.' : 'Loading history…'}
    </p>
  {/if}
  {#if fixes}
    <p class="m-0 text-[13px] text-soft">
      {fixes.fixedAfter} of {fixes.changes} changes needed a fix within {windowDays}
      days{fixes.aboveChance ? ', more than chance explains' : ''}.
    </p>
    {#if fixes.fixes.length > 0}
      <ul class="m-0 flex list-none flex-col gap-1 p-0 text-[13px]">
        {#each fixes.fixes as fix (fix.hash)}
          <li class="flex items-baseline gap-2">
            <span class="shrink-0 text-[11px] text-muted"
              >{fix.date.slice(0, 10)}</span
            >
            <span class="[overflow-wrap:anywhere]"
              >{#if fix.revert}<span class="text-accent">{'Revert · '}</span
                >{/if}{fix.message}</span
            >
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</Card>
