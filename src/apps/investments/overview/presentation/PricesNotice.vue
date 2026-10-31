<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import { noticeIsEmpty, pricesNotice } from '../domain/overviewFigures'
import type { HoldingFigures } from '../../holdings/domain/holding'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCurrencyAmount } from '../../../../shared/money/moneyFormat'

/** The holdings valued at a late price or one entered by hand, those with no price, and cash below zero, one line each. */
const props = defineProps<{
  book: InvestmentBook
  figures: PortfolioFigures
}>()

const notice = computed(() => pricesNotice(props.figures))

function named(instrument: Instrument): string {
  return words.notice.holding(instrument.name, instrument.symbol)
}

function closeDay(holding: HoldingFigures): string {
  return holding.valuation === null ? '' : dayLabel(holding.valuation.close.date)
}

const problems = computed(() => [
  ...notice.value.late.map((holding) =>
    holding.valuation?.close.byHand === true ? words.notice.lateByHand(named(holding.instrument), closeDay(holding)) : words.notice.lateClose(named(holding.instrument), closeDay(holding)),
  ),
  ...notice.value.unpriced.map((instrument) => words.notice.unpriced(named(instrument))),
  ...notice.value.cashBelowZero.map((balance) =>
    words.notice.cashBelowZero(props.book.accounts.find((account) => account.id === balance.account)?.name ?? '', formatCurrencyAmount(balance.balance, balance.currency)),
  ),
])
const byHand = computed(() => notice.value.byHand.map((holding) => words.notice.byHand(named(holding.instrument), closeDay(holding))))
</script>

<template>
  <UAlert
    v-if="!noticeIsEmpty(notice)"
    :icon="problems.length > 0 ? 'i-lucide-triangle-alert' : 'i-lucide-hand'"
    :color="problems.length > 0 ? 'warning' : 'neutral'"
    variant="subtle"
    :title="problems.length > 0 ? words.notice.toCheck : words.notice.byHandOnly"
    data-testid="investments-notice"
  >
    <template #description>
      <ul class="flex flex-col gap-0.5">
        <li v-for="line in [...problems, ...byHand]" :key="line">{{ line }}</li>
      </ul>
    </template>
  </UAlert>
</template>
