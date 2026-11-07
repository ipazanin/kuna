<script setup lang="ts">
/**
 * How a dashboard screen's tiles and cards rearrange as the room for the screen grows, the same on every app's screens.
 * The shell's content area is the container, so the chat's dock counts. A card that should run across both columns says
 * so itself, such as `@4xl:col-span-2 @8xl:col-span-1`.
 */
withDefaults(
  defineProps<{
    /**
     * `tiles`: two to a row, an odd last one across both, then one row from @4xl. Three take one row from @2xl.
     * Five or six take three to a row from @3xl and one row from @8xl.
     * `cards`: one column, two from @4xl, and three from @8xl when there are three or more. As the second part of a pair, one column again from @8xl, beside the first part.
     * `pair`: two cards, or a long card and a column of cards, side by side from @8xl. Below it the parts
     * stack in the screen's own column.
     */
    layout?: 'tiles' | 'cards' | 'pair'
  }>(),
  { layout: 'cards' },
)

const LAYOUTS = {
  tiles: [
    'grid grid-cols-2 gap-3 @4xl:auto-cols-fr @4xl:grid-flow-col @4xl:grid-cols-none',
    '[&>:last-child:nth-child(odd)]:col-span-2 @4xl:[&>:last-child:nth-child(odd)]:col-span-1 @3xl:has-[>:nth-child(5)]:[&>:last-child:nth-child(odd)]:col-span-1',
    '@3xl:has-[>:nth-child(5)]:grid-cols-3 @4xl:has-[>:nth-child(5)]:grid-flow-row @8xl:has-[>:nth-child(5)]:grid-flow-col @8xl:has-[>:nth-child(5)]:grid-cols-none',
    '@2xl:has-[>:nth-child(3):last-child]:grid-cols-3 @2xl:has-[>:nth-child(3):last-child]:[&>:last-child]:col-span-1',
  ],
  cards: ['grid gap-4 @4xl:grid-cols-2 @8xl:has-[>:nth-child(3)]:grid-cols-3'],
  pair: ['contents @8xl:grid @8xl:grid-cols-2 @8xl:gap-4', '[&>:only-child]:col-span-full', '@8xl:[&>[data-layout=cards]]:grid-cols-1 @8xl:[&>[data-layout=cards]]:content-start'],
} as const
</script>

<template>
  <div :class="LAYOUTS[layout]" :data-layout="layout">
    <slot />
  </div>
</template>
