<script lang="ts">
  import { THEMES, type ThemeName } from '@gitrelic/scene';

  let { theme = $bindable() }: { theme: ThemeName } = $props();

  const LABELS: Record<ThemeName, string> = { glow: 'Glow', flat: 'Flat' };
</script>

<div
  role="group"
  aria-label="Visual style"
  class="flex gap-1 rounded-chip border border-control-border p-1"
>
  {#each THEMES as option (option)}
    <button
      type="button"
      aria-pressed={theme === option}
      onclick={() => (theme = option)}
      class={[
        'min-h-9 cursor-pointer rounded-chip px-4 py-1.5 text-[13px] transition-colors',
        theme === option ? 'bg-accent text-accent-ink' : 'text-text',
      ]}
    >
      {LABELS[option]}
    </button>
  {/each}
</div>
