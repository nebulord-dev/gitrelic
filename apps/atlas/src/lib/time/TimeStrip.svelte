<script lang="ts">
  import { activeWeeks, recentShare, spanLabels } from './activity';
  import ActivityStrip from './ActivityStrip.svelte';
  import type { WeeklyActivity } from '@gitrelic/scene';

  let {
    activity = null,
    selected = false,
    failed = false,
    split = null,
    splitLabel = '',
  }: {
    /** Weekly commits; null while the history loads or if it failed. */
    activity?: WeeklyActivity | null;
    /** Whether `activity.hits` marks a selected entity's weeks. */
    selected?: boolean;
    /** The history couldn't be loaded. */
    failed?: boolean;
    /** The lens's shaded part of each week (`AnalyzerView.strip`). */
    split?: readonly number[] | null;
    /** What that part is, for the caption ("with AI"). */
    splitLabel?: string;
  } = $props();

  let span = $derived(activity ? spanLabels(activity) : ['', '']);
  let total = $derived(activity?.totals.reduce((s, n) => s + n, 0) ?? 0);
  let part = $derived(
    split
      ? ` · ${split.reduce((s, n) => s + n, 0).toLocaleString()} ${splitLabel}`
      : '',
  );
  let caption = $derived.by(() => {
    if (!activity) return '';
    const base = `${total.toLocaleString()} commits over ${activity.totals.length} weeks`;
    if (!selected) return base + part;
    const share = recentShare(activity);
    const weeks = activeWeeks(activity);
    return share
      ? `Selection changed in ${weeks} week${weeks === 1 ? '' : 's'} · ${share}${part}`
      : 'No commits touch this selection';
  });
</script>

<!-- The shared time strip: every view's "when?" (docs/atlas-views.md). -->
<section aria-label="Time strip" class="flex shrink-0 flex-col gap-1.5">
  {#if activity && activity.totals.length > 0}
    <div role="img" aria-label={caption}>
      <ActivityStrip
        {activity}
        height={40}
        highlight={selected}
        maxBars={300}
        {split}
      />
    </div>
    <div class="flex justify-between gap-4 text-[12px] text-muted">
      <span>{span[0]}</span>
      <span class="truncate">{caption}</span>
      <span>{span[1]}</span>
    </div>
  {:else}
    <div class="h-10 border-b border-panel-border"></div>
    <div class="text-[12px] text-muted">
      {failed
        ? 'Commit history unavailable.'
        : activity
          ? 'No commits in this history.'
          : 'Loading history…'}
    </div>
  {/if}
</section>
