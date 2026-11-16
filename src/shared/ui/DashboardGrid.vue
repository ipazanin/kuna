<script setup lang="ts">
/**
 * How a dashboard screen's tiles and cards rearrange as the room for the screen grows, the same on every app's screens.
 * The shell's content area is the container, so the chat's dock counts. The parts of a row share it, so a card with no
 * partner in its row spans the row and no row leaves an empty half. A card that should take more of its row says so
 * itself, such as `@max-8xl:basis-full` to run across the row until three fit.
 */
withDefaults(
  defineProps<{
    /**
     * `tiles`: two to a row, an odd last one across the row, then one row from @4xl. Three take one row from @2xl.
     * Five or six take three to a row from @3xl, the last two sharing their row, and one row from @8xl.
     * `cards`: one to a row, two from @4xl, and three from @8xl, a last card or two sharing its row. As the second part of a pair, one to a row again from @8xl, beside the first part.
     * `pair`: two cards, or a long card and a column of cards, side by side from @8xl. Below it the parts
     * stack in the screen's own column.
     */
    layout?: 'tiles' | 'cards' | 'pair'
  }>(),
  { layout: 'cards' },
)

// The parts' widths sit in :where, so a card's own width class, such as `@max-8xl:basis-full`, wins over them.
const LAYOUTS = {
  tiles: [
    'flex flex-wrap gap-3 [:where(&>*)]:min-w-0 [:where(&>*)]:grow [:where(&>*)]:basis-2/5',
    '@2xl:has-[>:nth-child(3):last-child]:[:where(&>*)]:basis-0',
    '@3xl:has-[>:nth-child(5)]:[:where(&>*)]:basis-3/10',
    '@4xl:not-has-[>:nth-child(5)]:[:where(&>*)]:basis-0',
    '@8xl:[:where(&>*)]:basis-0',
  ],
  cards: ['flex flex-wrap gap-4 [:where(&>*)]:min-w-0 [:where(&>*)]:grow [:where(&>*)]:basis-full @4xl:[:where(&>*)]:basis-2/5 @8xl:[:where(&>*)]:basis-3/10'],
  pair: [
    'contents @8xl:flex @8xl:gap-4 [:where(&>*)]:min-w-0 @8xl:[:where(&>*)]:grow @8xl:[:where(&>*)]:basis-0',
    '@8xl:[&>[data-layout=cards]]:content-start @8xl:[&>[data-layout=cards]>*]:basis-full',
  ],
} as const
</script>

<template>
  <div :class="LAYOUTS[layout]" :data-layout="layout">
    <slot />
  </div>
</template>
