<script lang="ts">
  import EntityChip from './EntityChip.svelte';
  import type { EntityId, EntityIndex, Finding } from '@gitrelic/scene';

  let {
    finding,
    index,
    onselect,
  }: {
    finding: Finding;
    index: EntityIndex;
    onselect?: (id: EntityId) => void;
  } = $props();

  const TONE = {
    neutral: 'border-l-control-border',
    notable: 'border-l-accent',
    warning: 'border-l-risk-3',
  } as const;
</script>

<!-- Findings are text and entity chips, never markup: views build them from report data. -->
<p
  class={[
    'm-0 border-l-2 pl-3 text-[13px] leading-relaxed text-soft',
    TONE[finding.tone],
  ]}
>
  {#each finding.segments as segment, i (i)}
    {#if typeof segment === 'string'}{segment}{:else}<EntityChip
        id={segment.ref}
        text={segment.text}
        {index}
        {onselect}
      />{/if}
  {/each}
</p>
