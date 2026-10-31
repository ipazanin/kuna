<script setup lang="ts">
import { computed, ref } from 'vue'

import type { HoldingFigures } from '../domain/holding'
import type { LatestRecord } from '../domain/latestRecords'
import { tradeTotal } from '../domain/lots'
import { words as recordWords } from '../../workbook/domain/words'
import { QUANTITY_PLACES } from './holdingText'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { formatCurrencyAmount, formatQuantity, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** A holding's trades, the transfers that moved its units, its splits and its spin-offs, newest first, with what each moved. */
const props = defineProps<{
  holding: HoldingFigures
  /** The holding's records newest first. Its income has a card of its own. */
  records: readonly LatestRecord[]
}>()

type HoldingRecord = Extract<LatestRecord, { readonly kind: 'trade' | 'transfer' | 'split' | 'spin-off' }>

interface Line {
  readonly key: string
  readonly date: string
  readonly kind: string
  /** Each on a line of its own, so a narrow card wraps between them rather than inside one. */
  readonly details: readonly string[]
  /** Signed as it moved the account's cash, null for a record that moved none. */
  readonly euros: number | null
  /** The amount in the quote currency and the rate it was converted at, for a trade in another currency. */
  readonly foreign: readonly string[]
}

function isHoldingRecord(entry: LatestRecord): entry is HoldingRecord {
  return entry.kind === 'trade' || entry.kind === 'transfer' || entry.kind === 'split' || entry.kind === 'spin-off'
}

function lineOf(entry: HoldingRecord): Line {
  const { instrument } = props.holding
  const base = { key: entry.record.id, date: dayLabel(entry.record.date), euros: null, foreign: [] }
  switch (entry.kind) {
    case 'trade': {
      const trade = entry.record
      const units = words.units(formatQuantity(trade.quantity, QUANTITY_PLACES))
      const fee = trade.fees === null || trade.fees === DECIMAL_ZERO ? [] : [words.transactions.fee(formatCurrencyAmount(trade.fees, instrument.currency))]
      return {
        ...base,
        kind: recordWords.sides[trade.side],
        details: [[words.unitsAtPrice(units, formatUnitPrice(trade.price, instrument.currency)), ...fee].join(', '), entry.account.name],
        euros: entry.euros,
        foreign: trade.rate === null ? [] : [formatCurrencyAmount(tradeTotal(trade, instrument.quoted), instrument.currency), words.transactions.atRate(formatQuantity(trade.rate, QUANTITY_PLACES))],
      }
    }
    case 'transfer':
      return {
        ...base,
        kind: words.transactions.transfer,
        details: [
          entry.record.moved.kind === 'units' ? words.units(formatQuantity(entry.record.moved.quantity, QUANTITY_PLACES)) : '',
          words.transactions.moved(entry.from.name, entry.to.name),
        ].filter((part) => part !== ''),
      }
    case 'split':
      return { ...base, kind: words.transactions.split, details: [words.transactions.ratio(entry.record.newUnits, entry.record.oldUnits)] }
    case 'spin-off': {
      const quantity = words.units(formatQuantity(entry.record.quantity, QUANTITY_PLACES))
      const received = entry.record.received === instrument.id
      return { ...base, kind: words.transactions.spinOff, details: [quantity, received ? words.transactions.received(entry.instrument.name) : words.transactions.gave(entry.received.name)] }
    }
  }
}

const lines = computed(() => props.records.filter(isHoldingRecord).map(lineOf))
const showAll = ref(false)
const shown = computed(() => (showAll.value ? lines.value : lines.value.slice(0, FIRST_SHOWN)))
</script>

<template>
  <AppCard :title="words.transactions.title" :subtitle="plural(words.transactions.count(lines.length), lines.length)" data-testid="holding-records">
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="words.transactions.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.transactions.date }}</th>
          <th scope="col" class="text-start">{{ words.transactions.what }}</th>
          <th scope="col" class="text-end">{{ words.transactions.amount }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in shown" :key="line.key" data-testid="holding-record">
          <th scope="row" class="text-start align-top font-normal text-toned">{{ line.date }}</th>
          <td class="cell-wraps text-start">
            <span class="text-highlighted">{{ line.kind }}</span>
            <span v-for="detail in line.details" :key="detail" class="block type-caption">{{ detail }}</span>
          </td>
          <td class="cell-wraps text-end align-top">
            <MoneyText v-if="line.euros !== null" :cents="line.euros" sign="always" tone="flow" />
            <span v-for="part in line.foreign" :key="part" class="block type-caption">{{ part }}</span>
          </td>
        </tr>
      </tbody>
    </FigureTable>
    <div v-if="lines.length > FIRST_SHOWN" class="px-4 pb-4 sm:px-5">
      <ShowAllButton v-model:expanded="showAll" :total="lines.length" />
    </div>
  </AppCard>
</template>
