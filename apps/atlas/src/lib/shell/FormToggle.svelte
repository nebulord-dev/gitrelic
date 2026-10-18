<script lang="ts">
  let {
    forms,
    form,
    onform,
  }: {
    forms: readonly { id: string; label: string }[];
    form?: string;
    onform?: (id: string) => void;
  } = $props();
</script>

<!-- The form toggle (docs/atlas-views.md › The forms pattern): a corner
     switch over the stage, never a tab row. -->
<div
  role="group"
  aria-label="Form"
  class="absolute top-3 right-3 flex gap-1 rounded-chip border border-control-border bg-bg p-1"
>
  {#each forms as f (f.id)}
    <button
      type="button"
      aria-pressed={f.id === form}
      onclick={() => f.id !== form && onform?.(f.id)}
      class={[
        'cursor-pointer rounded-chip border-0 px-2.5 py-1 font-[inherit] text-[12px]',
        f.id === form
          ? 'bg-control-border text-text'
          : 'bg-transparent text-muted hover:text-text',
      ]}>{f.label}</button
    >
  {/each}
</div>
