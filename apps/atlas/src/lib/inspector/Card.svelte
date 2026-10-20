<script lang="ts">
  import { scrollParent } from './fileSections';
  import type { Snippet } from 'svelte';

  let {
    eyebrow,
    id,
    sticky = false,
    children,
  }: {
    eyebrow: string;
    /** Anchor for the inspector's section links. */
    id?: string;
    /**
     * Stays at the top of the inspector while the rest scrolls under it, on
     * a solid surface (Glow's card is translucent).
     */
    sticky?: boolean;
    children: Snippet;
  } = $props();

  // A sticky card casts a shadow once its scroll box has moved, so the cards
  // sliding under it read as underneath.
  let el = $state<HTMLElement>();
  let stuck = $state(false);
  $effect(() => {
    const box = sticky && el ? scrollParent(el) : null;
    if (!box) return;
    const update = () => (stuck = box.scrollTop > 0);
    update();
    box.addEventListener('scroll', update, { passive: true });
    return () => box.removeEventListener('scroll', update);
  });
</script>

<section
  bind:this={el}
  {id}
  data-sticky={sticky || undefined}
  data-stuck={stuck || undefined}
  class={[
    'flex scroll-mt-3 flex-col gap-2.5 px-5 py-4.5',
    sticky ? 'modal sticky top-0 z-10 rounded-[var(--card-radius)]' : 'card',
  ]}
>
  <h2
    class="m-0 text-[11px] font-normal tracking-[0.16em] text-muted uppercase"
  >
    {eyebrow}
  </h2>
  {@render children()}
</section>
