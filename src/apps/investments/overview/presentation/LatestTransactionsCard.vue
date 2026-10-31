<script setup lang="ts">
import { computed } from 'vue'

import type { PortfolioSources } from '../../holdings/domain/holding'
import { latestRecords } from '../../holdings/domain/latestRecords'
import type { LatestRecord } from '../../holdings/domain/latestRecords'
import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { words as recordWords } from '../../workbook/domain/words'
import { words } from './words'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { dayLabel, shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { formatQuantity } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The five newest records of every kind. A link to all of them waits for the Transactions screen. */
const props = defineProps<{
  sources: PortfolioSources
}>()

const SHOWN = 5

interface Line {
  readonly key: string
  readonly date: string
  readonly kind: string
  readonly subject: string
  /** Null for a record that moved no money. */
  readonly euros: number | null
  /** Whether the euros came into or went out of the accounts, rather than moved between the user's own. */
  readonly flows: boolean
  /** What moved that is not money, such as units. */
  readonly detail: string
}

function lineOf(entry: LatestRecord): Line {
  const { date } = entry.record
  const base = { key: entry.record.id, date: yearOf(date) === yearOf(props.sources.today) ? shortDayLabel(date) : dayLabel(date) }
  switch (entry.kind) {
    case 'trade':
      return { ...base, kind: recordWords.sides[entry.record.side], subject: entry.instrument.name, euros: entry.euros, flows: true, detail: '' }
    case 'income':
      return { ...base, kind: recordWords.incomeKinds[entry.record.kind], subject: entry.instrument?.name ?? entry.account.name, euros: entry.euros, flows: true, detail: '' }
    case 'cash-movement':
      return { ...base, kind: recordWords.movementKinds[entry.record.kind], subject: entry.account.name, euros: entry.euros, flows: true, detail: '' }
    case 'exchange':
      return { ...base, kind: words.latest.exchange, subject: words.latest.exchanged(entry.record.soldCurrency, entry.record.boughtCurrency), euros: entry.euros, flows: false, detail: '' }
    case 'transfer':
      return {
        ...base,
        kind: words.latest.transfer,
        subject: [entry.instrument?.name, words.latest.moved(entry.from.name, entry.to.name)].filter((part) => part !== undefined).join(', '),
        euros: entry.euros,
        flows: false,
        detail: entry.record.moved.kind === 'units' ? words.latest.units(formatQuantity(entry.record.moved.quantity, QUANTITY_PLACES)) : '',
      }
    case 'split':
      return { ...base, kind: words.latest.split, subject: entry.instrument.name, euros: null, flows: false, detail: words.latest.ratio(entry.record.newUnits, entry.record.oldUnits) }
    case 'spin-off':
      return {
        ...base,
        kind: words.latest.spinOff,
        subject: words.latest.spunOff(entry.received.name, entry.instrument.name),
        euros: null,
        flows: false,
        detail: words.latest.units(formatQuantity(entry.record.quantity, QUANTITY_PLACES)),
      }
  }
}

const lines = computed(() => latestRecords(props.sources.book, props.sources.rates, SHOWN).map(lineOf))
</script>

<template>
  <AppCard :title="words.latest.title" :subtitle="words.latest.subtitle" data-testid="investments-latest">
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="words.latest.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.latest.date }}</th>
          <th scope="col" class="text-start">{{ words.latest.what }}</th>
          <th scope="col" class="text-end">{{ words.latest.amount }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in lines" :key="line.key" data-testid="investments-latest-row">
          <th scope="row" class="text-start font-normal text-toned">{{ line.date }}</th>
          <td class="cell-wraps text-start">
            <span class="text-highlighted">{{ line.kind }}</span>
            <span class="block type-caption">{{ line.subject }}</span>
          </td>
          <td class="text-end">
            <MoneyText v-if="line.euros !== null" :cents="line.euros" :sign="line.flows ? 'always' : 'magnitude'" :tone="line.flows ? 'flow' : undefined" />
            <span v-else class="figure text-muted">{{ line.detail }}</span>
            <span v-if="line.euros !== null && line.detail !== ''" class="block type-caption">{{ line.detail }}</span>
          </td>
        </tr>
      </tbody>
    </FigureTable>
  </AppCard>
</template>
