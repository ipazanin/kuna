<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { labelTotals } from '../domain/labelTotals'
import LabelDialog from './LabelDialog.vue'
import { words } from './words'
import { labelLink, rulesOfLabelLink, SORTING_CARDS } from '../../overview/presentation/spendingLinks'
import { countedRows } from '../../analytics/domain/countedRow'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { words as rateWords } from '../../rates/presentation/words'
import { ruleCounts } from '../../../../shared/categorising/domain/rulesFiling'
import { rulesCountLink } from '../../statements/presentation/rulesCountLink'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { labelFigure } from '../../../../shared/categorising/domain/labels'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import CountLink from '../../../../shared/ui/CountLink.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/**
 * Every label with one figure: what it spent, in ink, or its result, income less spending, once it has income. A label no entry
 * carries comes first, then the newest. Each opens its entries of every month on Entries, which split the figure by group.
 */
const { state } = useSpendingBooks()
const rates = useRates()
const route = useRoute()

const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))
const beforeItems = computed(() => state.workbook !== null && isBeforeItems(state.workbook.stored))
const rulesOn = computed(() => ruleCounts(state.workbook?.rules ?? [], (rule) => rule))

const lines = computed(() => {
  const book = state.workbook
  if (book === null) return []
  return labelTotals(countedRows(book, everydayRates(rates.value)), book.categories, book.labels).map((totals) => ({
    totals,
    figure: labelFigure(totals.income, totals.spent),
    caption: totals.latest === null ? words.noEntries : `${plural(words.entries(totals.rows), totals.rows)} · ${words.newest(dayLabel(totals.latest))}`,
  }))
})

const editing = ref<Label | null>(null)
const dialogOpen = ref(false)

function openDialog(label: Label | null): void {
  editing.value = label
  dialogOpen.value = true
}
</script>

<template>
  <div v-if="state.workbook !== null">
    <EmptyState
      v-if="lines.length === 0"
      :id="SORTING_CARDS.labels"
      icon="i-lucide-tag"
      :title="words.empty.title"
      :description="beforeItems ? words.empty.beforeItems : words.empty.description"
      data-testid="spending-labels-empty"
    >
      <template #actions>
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="spending-label-add" @click="openDialog(null)" />
      </template>
    </EmptyState>
    <AppCard
      v-else
      :id="SORTING_CARDS.labels"
      :title="words.title"
      :subtitle="waiting ? rateWords.loading : words.subtitle"
      collapse-id="spending-sorting.labels"
      :summary="plural(words.count(lines.length), lines.length)"
      :reveal="route.hash === `#${SORTING_CARDS.labels}`"
      data-testid="spending-labels"
    >
      <template #actions>
        <UButton :label="words.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="spending-label-add" @click="openDialog(null)" />
      </template>
      <ul class="near-figures flex flex-col py-2">
        <li v-for="line in lines" :key="line.totals.label.id" class="flex flex-col border-t border-default first:border-t-0" data-testid="spending-label-row">
          <div class="flex items-start">
            <ListRow :to="labelLink(line.totals.label)" :title="line.totals.label.name" :caption="line.caption" class="min-w-0 flex-1" data-testid="spending-label-open">
              <template v-if="line.totals.rows > 0" #amount>
                <MoneyText v-if="line.figure.counts === 'result'" :cents="line.figure.amount" tone="outcome" />
                <MoneyText v-else :cents="line.figure.amount" />
              </template>
            </ListRow>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              :aria-label="words.change(line.totals.label.name)"
              class="me-2 mt-2 shrink-0 sm:me-3"
              data-testid="spending-label-change"
              @click="openDialog(line.totals.label)"
            />
          </div>
          <CountLink v-bind="rulesCountLink(rulesOn.get(line.totals.label.id) ?? 0, line.totals.label.name)" :to="rulesOfLabelLink(line.totals.label)" class="-mt-3 mb-2 ms-4 self-start sm:ms-5" />
        </li>
      </ul>
    </AppCard>
    <LabelDialog v-model:open="dialogOpen" :label="editing" />
  </div>
</template>
