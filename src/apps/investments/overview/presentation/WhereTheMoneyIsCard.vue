<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { holdingMix } from '../../holdings/domain/holdingMix'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { HOLDINGS_ROUTE } from '../../holdings/presentation/holdingLinks'
import { mixDonut } from '../../holdings/presentation/mixDonut'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { words as holdingsWords } from '../../holdings/presentation/words'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words } from './words'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DonutCard from '../../../../shared/ui/DonutCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'

/** The value by class of instrument, with the cash apart, as on Holdings, which it opens. */
const props = defineProps<{
  figures: PortfolioFigures
  book: InvestmentBook
}>()

const { facts } = usePortfolio()
const donut = computed(() => mixDonut(holdingMix(props.figures, props.book, facts.value, 'class'), props.book, null))
</script>

<template>
  <AppCard v-if="donut.parts.length === 0" :title="words.money.title" :subtitle="words.money.subtitle" data-testid="investments-allocation">
    <EmptyState class="mx-4 mb-4 sm:mx-5" icon="i-lucide-chart-pie" :title="words.money.none" />
  </AppCard>
  <DonutCard
    v-else
    :title="words.money.title"
    :subtitle="words.money.subtitle"
    :description="donut.description"
    :parts="donut.parts"
    :total="donut.total"
    :total-label="donut.totalLabel"
    v-bind="donut.opens === undefined ? {} : { opens: donut.opens }"
    data-testid="investments-allocation"
  >
    <template #below>
      <UButton
        :to="HOLDINGS_ROUTE"
        :label="holdingsWords.allHoldings"
        icon="i-lucide-arrow-right"
        trailing
        color="primary"
        variant="link"
        class="mt-2 px-0"
        data-testid="investments-allocation-holdings"
      />
    </template>
  </DonutCard>
</template>
