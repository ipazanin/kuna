<script setup lang="ts">
import type { AgainstBar } from './scenariosView'
import { words } from './words'
import AppCard from '../../../../shared/ui/AppCard.vue'

/** How much less each scenario has you pay in all than the base, and how much sooner it is paid off, as short bars with the figure at their end. */
defineProps<{
  subtitle: string
  payLess: readonly AgainstBar[]
  sooner: readonly AgainstBar[]
}>()

/** The longest bar's share of the track, which leaves room for its figure beside it. */
const LONGEST = 0.65
</script>

<template>
  <AppCard :title="words.against.title" :subtitle="subtitle" data-testid="against-base">
    <div class="grid gap-4 px-4 pt-2 pb-4 sm:grid-cols-2 sm:gap-6 sm:px-5">
      <section
        v-for="group in [
          { key: 'pay-less', title: words.against.payLess, bars: payLess },
          { key: 'sooner', title: words.against.sooner, bars: sooner },
        ]"
        :key="group.key"
        :aria-label="group.title"
      >
        <h3 class="mb-2 text-sm font-medium text-highlighted">{{ group.title }}</h3>
        <ul class="flex flex-col gap-2">
          <li v-for="bar in group.bars" :key="bar.key" class="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-2" :data-scenario="bar.key">
            <span class="text-xs font-semibold text-highlighted">{{ bar.letter }}</span>
            <span class="relative h-5">
              <span v-if="bar.share > 0" class="absolute inset-y-0.75 start-0 rounded-e" :style="{ width: `${bar.share * LONGEST * 100}%`, background: `var(${bar.colour})` }" aria-hidden="true" />
              <span
                class="figure absolute inset-y-0 flex items-center text-xs whitespace-nowrap"
                :class="bar.share > 0 ? 'text-default' : 'text-muted'"
                :style="{ insetInlineStart: bar.share > 0 ? `calc(${bar.share * LONGEST * 100}% + 6px)` : '0' }"
              >
                {{ bar.text }}
              </span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </AppCard>
</template>
