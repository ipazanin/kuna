<script setup lang="ts">
import { computed } from 'vue'

import type { EntryFilters } from './useEntryFilters'
import { words } from './words'
import { countedRows } from '../../analytics/domain/countedRow'
import { partTotals } from '../../analytics/domain/partTotals'
import type { PartTotals } from '../../analytics/domain/partTotals'
import TotalsLines from '../../analytics/presentation/TotalsLines.vue'
import { partsInEvent } from '../../events/domain/eventMembership'
import { dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import { labelTotals } from '../../labels/domain/labelTotals'
import { payeeTotals } from '../../payees/domain/payeeTotals'
import { words as payeeWords } from '../../payees/presentation/words'
import { payeePageLink, payeePeriodShowing } from '../../overview/presentation/spendingLinks'
import { today } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { plural } from '../../../../shared/text/translation'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/**
 * What the picked event, label and payee count, with the split by group, from the same totals as the Events, Labels and Payees
 * screens, never from the rows listed under the other filters. A label and an event count every month, or the span the address
 * names, and a payee the months shown.
 */
const props = defineProps<{
  filters: EntryFilters
}>()

const { state } = useSpendingBooks()
const rates = useRates()

const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))
const categories = computed(() => state.workbook?.categories ?? [])

/** What was spent, as money out, or what came in for a group that only received, such as a payee who only pays you. */
function shownAmount(totals: PartTotals): Money {
  return totals.spent === 0 && totals.income !== 0 ? totals.income : negateMoney(totals.spent)
}

/** The Payees period of the months the list shows, which the payee's page opens on. */
const period = computed(() => payeePeriodShowing(props.filters.month === 'span' ? null : props.filters.month, monthOf(today())))

const lines = computed(() => {
  const book = state.workbook
  const event = props.filters.pickedEvent
  const label = props.filters.pickedLabel
  const payee = props.filters.pickedPayee
  if (book === null || (event === null && label === null && payee === null)) return []
  const rows = countedRows(book, everydayRates(rates.value))
  const inMonths = props.filters.inMonths
  const grouped = props.filters.span === null ? rows : rows.filter((row) => inMonths(row.day))
  const entries = (count: number): string => plural(words.filters.entries(count), count)
  const byId = new Map(book.categories.map((category) => [category.id, category]))
  return [
    ...(event === null
      ? []
      : [partTotals(grouped, byId, partsInEvent(book.events, event.id))].map((totals) => ({
          key: event.id,
          heading: `${event.name} · ${dayRangeLabel(event.days)} · ${entries(totals.rows)}`,
          payee: null,
          totals,
        }))),
    ...(label === null ? [] : labelTotals(grouped, book.categories, [label]).map((totals) => ({ key: label.id, heading: `${label.name} · ${entries(totals.rows)}`, payee: null, totals }))),
    ...(payee === null
      ? []
      : payeeTotals(
          rows.filter((row) => inMonths(row.day)),
          book.categories,
          book,
        )
          .filter((totals) => totals.key === payee.key)
          .map((totals) => ({ key: totals.key, heading: ` · ${entries(totals.rows)}`, payee: { name: payee.name, link: payeePageLink(payee.key, period.value) }, totals }))),
  ]
})
</script>

<template>
  <div v-if="lines.length > 0" class="flex flex-col gap-4" data-testid="spending-filter-totals">
    <div v-for="line in lines" :key="line.key" class="flex flex-col gap-1.5" data-testid="spending-filter-total">
      <div class="flex items-baseline justify-between gap-3">
        <h3 class="min-w-0 type-label wrap-anywhere">
          <DrillLink v-if="line.payee !== null" :to="line.payee.link" :label="payeeWords.page.open(line.payee.name)" in-prose data-testid="spending-filter-payee-page">{{ line.payee.name }}</DrillLink
          >{{ line.heading }}
        </h3>
        <MoneyText v-if="line.totals.rows > 0" :cents="shownAmount(line.totals)" tone="flow" :data-spent="line.totals.spent" class="shrink-0 type-figure-secondary" />
      </div>
      <TotalsLines v-if="line.totals.rows > 0" :totals="line.totals" :categories="categories" :rated="!waiting" />
    </div>
  </div>
</template>
