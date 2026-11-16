<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { labelTotals } from '../domain/labelTotals'
import LabelDialog from './LabelDialog.vue'
import { words } from './words'
import TotalsLines from '../../analytics/presentation/TotalsLines.vue'
import { labelLink } from '../../overview/presentation/spendingLinks'
import { euroRows } from '../../rates/domain/euroRows'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { words as rateWords } from '../../rates/presentation/words'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Label } from '../../workbook/domain/label'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import { negateMoney } from '../../../../shared/money/money'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Every label with what it counts and its split by group, a label no entry carries first, then the newest. Each opens its entries of every month on Entries. */
const { state } = useSpendingBooks()
const rates = useRates()

const loading = computed(() => state.workbook === null && state.status !== 'error')
const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))
const categories = computed(() => state.workbook?.categories ?? [])
const beforeItems = computed(() => state.workbook !== null && isBeforeItems(state.workbook.stored))

const lines = computed(() => {
  const book = state.workbook
  if (book === null) return []
  return labelTotals(euroRows(book, everydayRates(rates.value)), book.categories, book.labels).map((totals) => ({
    totals,
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
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.labels" :description="words.description">
      <template v-if="lines.length > 0" #actions>
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="spending-label-add" @click="openDialog(null)" />
      </template>
    </PageHeader>
    <ItemsMoveNotice />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="1" data-testid="spending-labels-loading" />
    <template v-else-if="state.workbook !== null">
      <EmptyState
        v-if="lines.length === 0"
        icon="i-lucide-tag"
        :title="words.empty.title"
        :description="beforeItems ? words.empty.beforeItems : words.empty.description"
        data-testid="spending-labels-empty"
      >
        <template #actions>
          <UButton :label="words.add" icon="i-lucide-plus" data-testid="spending-label-add" @click="openDialog(null)" />
        </template>
      </EmptyState>
      <AppCard v-else :title="words.list" :subtitle="waiting ? rateWords.loading : undefined" data-testid="spending-labels">
        <ul class="flex flex-col py-2">
          <li v-for="line in lines" :key="line.totals.label.id" class="flex items-start border-t border-default first:border-t-0" data-testid="spending-label-row">
            <ProposalRow :to="labelLink(line.totals.label)" :title="line.totals.label.name" :caption="line.caption" class="min-w-0 flex-1" data-testid="spending-label-open">
              <template v-if="line.totals.rows > 0" #amount>
                <MoneyText :cents="negateMoney(line.totals.spent)" tone="flow" :data-spent="line.totals.spent" />
              </template>
              <template v-if="line.totals.rows > 0" #details>
                <TotalsLines :totals="line.totals" :categories="categories" :rated="!waiting" />
              </template>
            </ProposalRow>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              :aria-label="words.change(line.totals.label.name)"
              class="me-2 mt-2 shrink-0 sm:me-3"
              data-testid="spending-label-change"
              @click="openDialog(line.totals.label)"
            />
          </li>
        </ul>
      </AppCard>
    </template>
    <LabelDialog v-model:open="dialogOpen" :label="editing" />
  </section>
</template>
