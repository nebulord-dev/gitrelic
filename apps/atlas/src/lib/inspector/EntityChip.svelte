<script lang="ts">
  import type { EntityId, EntityIndex } from '@gitrelic/scene';

  let {
    id,
    text,
    index,
    onselect,
  }: {
    id: EntityId;
    text: string;
    index: EntityIndex;
    onselect?: (id: EntityId) => void;
  } = $props();

  // Only ids the report knows become clickable; anything else is plain text.
  let known = $derived(index.get(id) !== undefined);
</script>

{#if known}
  <button
    type="button"
    class="cursor-pointer rounded-chip border border-control-border bg-transparent px-1.5 py-px font-[inherit] text-[12px] text-soft hover:text-text"
    onclick={() => onselect?.(id)}>{text}</button
  >
{:else}
  <span>{text}</span>
{/if}
