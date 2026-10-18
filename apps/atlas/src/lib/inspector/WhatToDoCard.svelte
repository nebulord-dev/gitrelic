<script lang="ts">
  import Card from './Card.svelte';
  import { ADVICE_ANCHOR, scrollToSection } from './fileSections';
  import type { Advice } from '@gitrelic/scene';

  let {
    advice,
    sections,
  }: {
    advice: readonly Advice[];
    /** The anchors the inspector renders: evidence links only go to those. */
    sections: ReadonlySet<string>;
  } = $props();

  const SECTION_LABEL: Record<Advice['section'], string> = {
    people: 'People',
    activity: 'Activity',
    'changes-with': 'Changes with',
    'flagged-by': 'Flagged by',
  };
</script>

<Card eyebrow="What to do" id="insp-todo">
  <ol class="m-0 flex list-none flex-col gap-3.5 p-0">
    {#each advice as item (item.id)}
      {@const anchor = ADVICE_ANCHOR[item.section]}
      <li class="flex flex-col gap-1">
        <span class="text-[14px] leading-snug font-semibold text-text"
          >{item.action}</span
        >
        {#if item.why}
          <span class="text-[13px] leading-relaxed text-soft">{item.why}</span>
        {/if}
        <span
          class="text-[13px] leading-relaxed text-muted [overflow-wrap:anywhere]"
        >
          {item.evidence}
          {#if sections.has(anchor)}
            <button
              type="button"
              onclick={() => scrollToSection(anchor)}
              class="cursor-pointer bg-transparent p-0 font-[inherit] text-[13px] text-accent hover:text-text"
              >{SECTION_LABEL[item.section]} ›</button
            >
          {/if}
        </span>
      </li>
    {/each}
  </ol>
</Card>
