<script lang="ts">
  import type { FactTier, FileFact } from '@gitrelic/scene';

  let { rows }: { rows: readonly FileFact[] } = $props();

  // Tiers map onto the theme's risk ramp, so both themes colour them.
  const TIER_CLASS: Record<FactTier, string> = {
    critical: 'text-risk-3',
    warning: 'text-risk-2',
    moderate: 'text-risk-1',
    healthy: 'text-soft',
  };
</script>

<dl class="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
  {#each rows as row (row.label)}
    <dt class="text-muted">{row.label}</dt>
    <dd
      class={['m-0 text-right', row.tier ? TIER_CLASS[row.tier] : 'text-text']}
    >
      {row.value}
    </dd>
  {/each}
</dl>
