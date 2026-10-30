<script setup lang="ts">
/**
 * How a dashboard screen's tiles and cards rearrange as the content area grows, the same on every app's
 * screens. A card that should run across both columns below 3xl says so itself, such as `xl:col-span-2 3xl:col-span-1`.
 */
withDefaults(
  defineProps<{
    /**
     * `tiles`: two to a row, an odd last one across both, then one row from lg. Five or six take three
     * to a row from lg and one row from 3xl.
     * `cards`: one column, two from xl, and three from 3xl when there are three or more. As the second part of a pair, one column again from 3xl, beside the first part.
     * `pair`: two cards, or a long card and a column of cards, side by side from 3xl. Below it the parts
     * stack in the screen's own column.
     * `row`: up to four cards of figures, one column on a phone, two to a row from sm and all in one row from xl.
     */
    layout?: 'tiles' | 'cards' | 'pair' | 'row'
  }>(),
  { layout: 'cards' },
)

const LAYOUTS = {
  tiles: [
    'grid grid-cols-2 gap-3 lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none',
    '[&>:last-child:nth-child(odd)]:col-span-2 lg:[&>:last-child:nth-child(odd)]:col-span-1',
    'lg:has-[>:nth-child(5)]:grid-flow-row lg:has-[>:nth-child(5)]:grid-cols-3 3xl:has-[>:nth-child(5)]:grid-flow-col 3xl:has-[>:nth-child(5)]:grid-cols-none',
  ],
  cards: ['grid gap-4 xl:grid-cols-2 3xl:has-[>:nth-child(3)]:grid-cols-3'],
  row: ['grid gap-3 sm:grid-cols-2 xl:auto-cols-fr xl:grid-flow-col xl:grid-cols-none'],
  pair: ['contents 3xl:grid 3xl:grid-cols-2 3xl:gap-4', '[&>:only-child]:col-span-full', '3xl:[&>[data-layout=cards]]:grid-cols-1 3xl:[&>[data-layout=cards]]:content-start'],
} as const
</script>

<template>
  <div :class="LAYOUTS[layout]" :data-layout="layout">
    <slot />
  </div>
</template>
