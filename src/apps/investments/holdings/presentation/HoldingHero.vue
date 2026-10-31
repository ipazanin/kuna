<script setup lang="ts">
import { computed } from 'vue'

import { holdingReturn } from '../domain/holding'
import type { FirstAcquired, HoldingFigures } from '../domain/holding'
import { taxFreeUnits } from '../domain/lots'
import { QUANTITY_PLACES, WORKED_OUT_PRICE_PLACES } from './holdingText'
import PriceMarkNote from './PriceMarkNote.vue'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { EURO } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { formatCurrencyAmount, formatMoney, formatPercent, formatPercentChange, formatQuantity, formatShare, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import InfoPopover from '../../../../shared/ui/InfoPopover.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** What a holding's page leads with: its value at the last close beside its total return and the parts it comes from, then its facts. */
const props = defineProps<{
  holding: HoldingFigures
  today: CivilDate
}>()

const held = computed(() => props.holding.quantity > DECIMAL_ZERO)
const currency = computed(() => props.holding.instrument.currency)
const foreign = computed(() => currency.value !== EURO)
const units = computed(() => words.units(formatQuantity(props.holding.quantity, QUANTITY_PLACES)))
const returns = computed(() => holdingReturn(props.holding))

/** Why nothing is valued: no price yet, every unit sold, or nothing bought yet. */
const unvalued = computed(() =>
  held.value
    ? { title: words.hero.noPrice, caption: words.hero.noPriceCaption }
    : props.holding.firstAcquired === null
      ? { title: words.hero.notBought, caption: words.hero.notBoughtCaption }
      : { title: words.hero.noneHeld, caption: words.hero.noneHeldCaption },
)

function acquiredCaption(first: FirstAcquired): string {
  return first.by === 'spin-off' ? words.facts.fromSpinOff(dayLabel(first.date)) : words.facts.firstBought(dayLabel(first.date))
}

const closeLines = computed((): string[] => {
  const { valuation } = props.holding
  if (valuation === null) return []
  const price = formatUnitPrice(valuation.price, currency.value)
  const day = dayLabel(valuation.close.date)
  if (valuation.rate === null) return [words.hero.euroLine(units.value, price, day)]
  return [
    words.hero.foreignLine(formatCurrencyAmount(valuation.foreignValue, currency.value), units.value, price, day),
    words.hero.rate(formatQuantity(valuation.rate, QUANTITY_PLACES), currency.value),
  ]
})

interface ReturnPart {
  readonly key: string
  readonly label: string
  readonly caption: string
  readonly amount: number
}

const parts = computed((): ReturnPart[] => {
  const { holding } = props
  const { price, currency: rate, realised, income } = returns.value
  const close = holding.valuation === null ? '' : formatUnitPrice(holding.valuation.price, currency.value)
  const averageCost = holding.averageCost === null ? '' : formatUnitPrice(holding.averageCost, currency.value, WORKED_OUT_PRICE_PLACES)
  return [
    ...(price === null ? [] : [{ key: 'price', label: words.hero.price, caption: words.hero.priceCaption(averageCost, close), amount: price }]),
    ...(rate === null || !foreign.value ? [] : [{ key: 'currency', label: words.hero.currency, caption: words.hero.currencyCaption, amount: rate }]),
    ...(holding.sales.length === 0 ? [] : [{ key: 'realised', label: words.hero.realised, caption: '', amount: realised }]),
    ...(income === 0 ? [] : [{ key: 'income', label: words.hero.income, caption: '', amount: income }]),
  ]
})

const facts = computed((): Fact[] => {
  const { holding, today } = props
  const taxFree = taxFreeUnits(holding.lots, today)
  const heldFacts: Fact[] = held.value
    ? [
        {
          label: words.facts.cost,
          value: formatMoney(holding.cost),
          ...(foreign.value ? { caption: words.facts.costCaption(formatCurrencyAmount(holding.costInCurrency, currency.value)) } : {}),
        },
        {
          label: words.facts.averageCost,
          value: holding.averageCost === null ? words.facts.none : formatUnitPrice(holding.averageCost, currency.value, WORKED_OUT_PRICE_PLACES),
          caption: words.facts.averageCostCaption,
        },
        {
          label: words.facts.units,
          value: formatQuantity(holding.quantity, QUANTITY_PLACES),
          ...(holding.firstAcquired === null ? {} : { caption: acquiredCaption(holding.firstAcquired) }),
        },
        { label: words.facts.weight, value: holding.weight === null ? words.facts.none : formatShare(holding.weight), caption: words.facts.weightCaption },
        {
          label: words.facts.lastDay,
          value: holding.lastDay === null || holding.lastDay.share === null ? words.facts.none : formatPercentChange(holding.lastDay.share),
          ...(holding.lastDay === null ? {} : { caption: formatMoney(holding.lastDay.change, 'always') }),
        },
        ...(holding.income === 0
          ? []
          : [{ label: words.facts.dividendYield, value: holding.dividendYield === null ? words.facts.none : formatPercent(holding.dividendYield), caption: words.facts.dividendYieldCaption }]),
      ]
    : []
  return [
    ...heldFacts,
    { label: words.facts.feesPaid, value: formatMoney(holding.feesPaid), caption: holding.feesMissing ? words.facts.feesMissing : words.facts.feesPaidCaption },
    ...(held.value
      ? [
          {
            label: words.facts.taxFree,
            value: words.facts.taxFreeUnits(formatQuantity(taxFree.taxFree, QUANTITY_PLACES), formatQuantity(taxFree.held, QUANTITY_PLACES)),
            caption: taxFree.next === null ? words.facts.allTaxFree : words.facts.nextTaxFree(dayLabel(taxFree.next)),
          },
        ]
      : []),
  ]
})
</script>

<template>
  <AppCard as="article" class="gap-5 p-4 sm:p-5" data-testid="holding-hero">
    <div class="flex flex-col gap-5 sm:flex-row sm:gap-0">
      <div class="flex min-w-0 flex-col gap-2 sm:flex-1 sm:pe-6">
        <p class="text-sm text-muted">{{ words.hero.value }}</p>
        <template v-if="holding.valuation !== null">
          <MoneyText :cents="holding.valuation.value" class="block text-figure-lg font-semibold text-highlighted sm:text-figure-xl" data-testid="holding-value" />
          <p v-for="line in closeLines" :key="line" class="type-caption">{{ line }}</p>
          <PriceMarkNote :holding="holding" class="type-caption" />
        </template>
        <template v-else>
          <p class="text-figure-lg font-semibold text-highlighted">{{ unvalued.title }}</p>
          <p class="type-caption">{{ unvalued.caption }}</p>
        </template>
      </div>
      <div class="flex min-w-0 flex-col gap-2 border-t border-default pt-5 sm:flex-1 sm:border-t-0 sm:border-s sm:ps-6 sm:pt-0">
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm text-muted">{{ words.hero.totalReturn }}</p>
          <div class="-my-1 -me-1.5">
            <InfoPopover :subject="words.hero.totalReturn" :definition="words.hero.totalReturnDefinition" />
          </div>
        </div>
        <p v-if="returns.total !== null" class="flex flex-wrap items-baseline gap-x-2" data-testid="holding-return">
          <MoneyText :cents="returns.total" sign="always" tone="outcome" class="text-figure-lg font-semibold" />
          <span v-if="returns.share !== null" class="figure text-sm font-medium text-toned">{{ formatPercent(returns.share, 'always') }}</span>
        </p>
        <p v-else class="text-figure-lg font-semibold text-highlighted">{{ words.hero.waitsForPrice }}</p>
        <dl v-if="parts.length > 0" class="mt-1 flex flex-col gap-2">
          <div v-for="part in parts" :key="part.key" class="flex items-baseline justify-between gap-3" :data-part="part.key">
            <dt class="min-w-0 text-sm text-toned">
              {{ part.label }}
              <span v-if="part.caption !== ''" class="block type-caption">{{ part.caption }}</span>
            </dt>
            <dd><MoneyText :cents="part.amount" sign="always" tone="outcome" class="text-sm font-medium" /></dd>
          </div>
        </dl>
      </div>
    </div>
    <FactGrid :facts="facts" class="border-t border-default pt-5" data-testid="holding-facts" />
  </AppCard>
</template>
