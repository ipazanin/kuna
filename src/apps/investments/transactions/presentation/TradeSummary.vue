<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { TradePreview } from '../domain/tradePreview'
import { QUANTITY_PLACES, WORKED_OUT_PRICE_PLACES } from '../../holdings/presentation/holdingText'
import type { Instrument } from '../../workbook/domain/instrument'
import type { Trade } from '../../workbook/domain/trade'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatCurrencyAmount, formatMoney, formatQuantity, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'

/** What a buy or a sale comes to in both currencies, and what the account holds afterwards, with a sale's units past two years. */
const props = defineProps<{
  preview: TradePreview
  trade: Trade
  instrument: Instrument
  account: string
}>()

const facts = computed((): Fact[] => {
  const { preview, instrument } = props
  const { currency } = instrument
  const foreign = props.trade.rate !== null
  const total = formatCurrencyAmount(preview.total, currency)
  const averageCost = (price: TradePreview['averageCostAfter']): string => (price === null ? '' : formatUnitPrice(price, currency, WORKED_OUT_PRICE_PLACES))
  const before = averageCost(preview.averageCostBefore)
  const after = averageCost(preview.averageCostAfter)
  return [
    {
      label: props.trade.side === 'buy' ? words.summary.youPay : words.summary.youReceive,
      value: foreign ? total : formatMoney(preview.euros),
      ...(foreign ? { caption: formatMoney(preview.euros) } : {}),
    },
    { label: words.summary.holdAfter, value: words.lines.units(formatQuantity(preview.unitsAfter, QUANTITY_PLACES)), caption: words.summary.inAccount(props.account) },
    { label: words.summary.cashAfter(currency), value: formatCurrencyAmount(preview.cashAfter, currency), caption: words.summary.inAccount(props.account) },
    ...(after === '' ? [] : [{ label: words.summary.averageCost, value: after, ...(before !== '' && before !== after ? { caption: words.summary.averageCostFrom(before) } : {}) }]),
    ...(preview.taxSplit === null
      ? []
      : [
          {
            label: words.summary.taxFree,
            value: words.summary.taxFreeUnits(formatQuantity(preview.taxSplit.taxFree.quantity, QUANTITY_PLACES), formatQuantity(props.trade.quantity, QUANTITY_PLACES)),
            caption: words.summary.taxFreeCaption,
          },
        ]),
  ]
})
</script>

<template>
  <section class="mt-6 border-t border-default pt-4" :aria-label="words.dialog.summary" data-testid="transaction-summary">
    <p v-if="preview.beyondHeld" class="mb-3 flex items-start gap-2 type-body text-warning" data-testid="transaction-beyond-held">
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" />
      <span>{{ words.summary.beyondHeld(dayLabel(trade.date)) }}</span>
    </p>
    <FactGrid v-else :facts="facts" />
  </section>
</template>
