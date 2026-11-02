<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { portfolioChecks } from '../domain/portfolioChecks'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { holdingMixes } from '../../holdings/domain/holdingMix'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { recentCosts } from '../../income/domain/yearlyCosts'
import { dayValuer } from '../../performance/domain/portfolioPerformance'
import { CHECKS } from '../../workbook/domain/checkSetting'
import type { FactsBook } from '../../prices/domain/factsBook'
import { checkLines } from './checkLines'
import { INVESTMENTS_CHECKS_ROUTE } from './investmentLinks'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'

/** Where the portfolio leans past a threshold, failing checks first, each with an icon and a word beside its colour. */
const props = defineProps<{
  sources: PortfolioSources
  figures: PortfolioFigures
  facts: FactsBook
}>()

const text = words.checks

const lines = computed(() => {
  const { book } = props.sources
  const checks = portfolioChecks(props.figures, holdingMixes(props.figures, book, props.facts), recentCosts(props.sources, dayValuer(props.sources)), book.targets, book.checks)
  return checkLines(checks, book)
})
const none = computed(() => (CHECKS.every((check) => props.sources.book.checks.some((setting) => setting.check === check && setting.off)) ? text.allOff : text.nothingYet))
const overCount = computed(() => lines.value.filter((line) => line.over).length)
const summary = computed(() => (lines.value.length === 0 ? none.value : overCount.value === 0 ? text.allWithin : plural(text.overCount(overCount.value), overCount.value)))
</script>

<template>
  <AppCard :title="text.title" :subtitle="text.subtitle" collapse-id="overview.checks" :summary="summary" data-testid="portfolio-checks">
    <template #actions>
      <UButton :to="INVESTMENTS_CHECKS_ROUTE" :label="text.thresholds" icon="i-lucide-sliders-horizontal" color="neutral" variant="outline" size="sm" data-testid="checks-thresholds" />
    </template>
    <p v-if="lines.length === 0" class="px-4 pt-3 pb-4 type-body sm:px-5" data-testid="checks-none">{{ none }}</p>
    <ul v-else class="grid gap-x-6 px-4 pt-1 pb-3 sm:px-5 lg:grid-cols-2" data-testid="checks-lines">
      <li v-for="line in lines" :key="line.check" class="flex items-start gap-2.5 border-t border-default py-2.5" :data-check="line.check" :data-over="String(line.over)" data-testid="check-line">
        <UIcon :name="line.over ? 'i-lucide-triangle-alert' : 'i-lucide-circle-check'" class="mt-0.5 size-4 shrink-0" :class="line.over ? 'text-warning' : 'text-success'" aria-hidden="true" />
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="flex flex-wrap items-baseline justify-between gap-x-3">
            <span class="type-label text-highlighted">{{ line.label }}</span>
            <span class="type-caption" :class="line.over ? 'text-warning' : 'text-success'">{{ line.over ? text.over : text.within }}</span>
          </span>
          <span class="type-caption">{{ line.sentence }}</span>
        </span>
      </li>
    </ul>
  </AppCard>
</template>
