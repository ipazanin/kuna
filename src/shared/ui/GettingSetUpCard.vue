<script setup lang="ts">
import type { SetUpLine } from '../app/appContribution'
import AppCard from './AppCard.vue'
import DrillLink from './DrillLink.vue'
import { words } from './words'

/** What an app still lacks, with the screen that does each line. The card goes once nothing is left. A line's action slot holds what settles it where it stands. */
defineProps<{
  lines: readonly SetUpLine[]
}>()
</script>

<template>
  <AppCard v-if="lines.length > 0" :title="words.setUp.title" :subtitle="words.setUp.subtitle" data-testid="getting-set-up">
    <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
      <li v-for="line in lines" :key="line.key" class="flex min-h-10 flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-default py-1 first:border-t-0" :data-line="line.key">
        <span class="size-2.5 flex-none rounded-full border-2 border-primary" aria-hidden="true" />
        <span class="min-w-0 flex-1 basis-48 text-sm text-toned">{{ line.text }}</span>
        <slot name="action" :line="line" />
        <DrillLink v-if="line.link" :to="line.link.to" :label="words.setUp.open(line.text, line.link.label)" class="shrink-0 text-sm font-medium text-highlighted">{{ line.link.label }}</DrillLink>
      </li>
    </ul>
  </AppCard>
</template>
