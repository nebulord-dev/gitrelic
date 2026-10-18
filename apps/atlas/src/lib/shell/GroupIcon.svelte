<script lang="ts">
  import type { PresetGroup } from '@gitrelic/scene';

  let { group }: { group: PresetGroup } = $props();
</script>

<!-- One 16px stroke icon per analyzer group; colour comes from currentColor. -->
<svg
  viewBox="0 0 16 16"
  width="16"
  height="16"
  fill="none"
  stroke="currentColor"
  stroke-width="1.4"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if group === 'overview'}
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  {:else if group === 'code-health'}
    <path d="M1.5 8h3l2-4.5 3 9 2-4.5h3" />
  {:else if group === 'ownership-risk'}
    <circle cx="6" cy="6" r="3" />
    <path d="M8.2 8.2 14 14M11.5 11.5l1.5-1.5" />
  {:else if group === 'team-activity'}
    <circle cx="5.5" cy="5.5" r="2.2" />
    <circle cx="11" cy="6.5" r="1.8" />
    <path
      d="M1.5 13.5c.6-2.4 2.1-3.6 4-3.6s3.4 1.2 4 3.6M10 10.2c1.8-.2 3.6.8 4.3 3.3"
    />
  {:else}
    <path d="M8 2 14 5 8 8 2 5Z" />
    <path d="M2 8l6 3 6-3M2 11l6 3 6-3" />
  {/if}
</svg>
