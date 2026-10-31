<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { noticeIsEmpty, pricesNotice } from '../domain/overviewFigures'
import type { HoldingFigures } from '../../holdings/domain/holding'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { failureLines, needsThePerson } from '../../prices/presentation/failureLines'
import { usePrices } from '../../prices/presentation/usePrices'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { seriesKey } from '../../prices/domain/pricesFile'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCurrencyAmount } from '../../../../shared/money/moneyFormat'

/**
 * The holdings valued at a late price or one entered by hand, those with no price, and cash below zero, one line each.
 * A holding with no price whose fetch failed for a reason only the person can fix says what to do, with a link. One a
 * fetch under way may still price is left to the header's line.
 */
const props = defineProps<{
  book: InvestmentBook
  figures: PortfolioFigures
}>()

const notice = computed(() => pricesNotice(props.figures))
const prices = usePrices()

interface NoticeLine {
  readonly text: string
  readonly link: { readonly label: string; readonly to: RouteLocationRaw } | null
}

function named(instrument: Instrument): string {
  return words.notice.holding(instrument.name, instrument.symbol)
}

function closeDay(holding: HoldingFigures): string {
  return holding.valuation === null ? '' : dayLabel(holding.valuation.close.date)
}

function unpricedLine(instrument: Instrument): NoticeLine | null {
  const listed = instrument.prices !== 'manual'
  if (listed && prices.state.fetching !== null) {
    return null
  }
  const failure = listed ? prices.state.copy?.file.failures.find((failed) => failed.series === seriesKey(instrument.prices, instrument.sourceSymbol) && needsThePerson(failed)) : undefined
  if (failure === undefined) {
    return { text: words.notice.unpriced(named(instrument)), link: null }
  }
  const [line] = failureLines([failure], props.book, PRICE_VENDORS)
  return { text: words.notice.unpricedBecause(named(instrument), line!.why, line!.advice), link: line!.link }
}

const plain = (text: string): NoticeLine => ({ text, link: null })

const problems = computed((): NoticeLine[] => [
  ...notice.value.late.map((holding) =>
    plain(holding.valuation?.close.byHand === true ? words.notice.lateByHand(named(holding.instrument), closeDay(holding)) : words.notice.lateClose(named(holding.instrument), closeDay(holding))),
  ),
  ...notice.value.unpriced.flatMap((instrument) => unpricedLine(instrument) ?? []),
  ...notice.value.cashBelowZero.map((balance) =>
    plain(words.notice.cashBelowZero(props.book.accounts.find((account) => account.id === balance.account)?.name ?? '', formatCurrencyAmount(balance.balance, balance.currency))),
  ),
])
const byHand = computed(() => notice.value.byHand.map((holding) => plain(words.notice.byHand(named(holding.instrument), closeDay(holding)))))
const shownEmpty = computed(() => problems.value.length === 0 && byHand.value.length === 0)
</script>

<template>
  <UAlert
    v-if="!noticeIsEmpty(notice) && !shownEmpty"
    :icon="problems.length > 0 ? 'i-lucide-triangle-alert' : 'i-lucide-hand'"
    :color="problems.length > 0 ? 'warning' : 'neutral'"
    variant="subtle"
    :title="problems.length > 0 ? words.notice.toCheck : words.notice.byHandOnly"
    data-testid="investments-notice"
  >
    <template #description>
      <ul class="flex flex-col gap-0.5">
        <li v-for="line in [...problems, ...byHand]" :key="line.text">
          {{ line.text }}
          <UButton v-if="line.link !== null" :to="line.link.to" :label="line.link.label" color="neutral" variant="link" size="sm" class="inline-target px-0" data-testid="investments-notice-link" />
        </li>
      </ul>
    </template>
  </UAlert>
</template>
