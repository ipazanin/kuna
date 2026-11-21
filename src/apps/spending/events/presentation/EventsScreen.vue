<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { eventTotals } from '../domain/eventTotals'
import { eventStage } from '../domain/eventsShown'
import EventDialog from './EventDialog.vue'
import { words } from './words'
import TotalsLines from '../../analytics/presentation/TotalsLines.vue'
import { eventLink } from '../../overview/presentation/spendingLinks'
import { countedRows } from '../../analytics/domain/countedRow'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { words as rateWords } from '../../rates/presentation/words'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SpendingEvent } from '../../workbook/domain/event'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel, dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import { negateMoney } from '../../../../shared/money/money'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Every event with its days, what it counts and its split by group, newest first. Each opens its entries of every month on Entries. */
const { state } = useSpendingBooks()
const rates = useRates()

const loading = computed(() => state.workbook === null && state.status !== 'error')
const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))
const categories = computed(() => state.workbook?.categories ?? [])

const lines = computed(() => {
  const book = state.workbook
  if (book === null) return []
  const day = today()
  return eventTotals(countedRows(book, everydayRates(rates.value)), book.categories, book.events).map((totals) => {
    const stage = eventStage(totals.event, day)
    const when = stage.kind === 'ahead' ? words.starts(dayLabel(totals.event.days.from)) : stage.kind === 'running' ? words.dayOf(stage.day, stage.days) : null
    const count = totals.rows === 0 ? words.noEntries : plural(words.entries(totals.rows), totals.rows)
    return { totals, caption: [dayRangeLabel(totals.event.days), when, count].filter((part) => part !== null).join(' · ') }
  })
})

const editing = ref<SpendingEvent | null>(null)
const dialogOpen = ref(false)

function openDialog(event: SpendingEvent | null): void {
  editing.value = event
  dialogOpen.value = true
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.events" :description="words.description">
      <template v-if="lines.length > 0" #actions>
        <UButton :label="words.add" icon="i-lucide-plus" data-testid="spending-event-add" @click="openDialog(null)" />
      </template>
    </PageHeader>
    <ItemsMoveNotice />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="1" data-testid="spending-events-loading" />
    <template v-else-if="state.workbook !== null">
      <EmptyState v-if="lines.length === 0" icon="i-lucide-calendar-range" :title="words.empty.title" :description="words.empty.description" data-testid="spending-events-empty">
        <template #actions>
          <UButton :label="words.add" icon="i-lucide-plus" data-testid="spending-event-add" @click="openDialog(null)" />
        </template>
      </EmptyState>
      <AppCard v-else :title="words.list" :subtitle="waiting ? rateWords.loading : undefined" data-testid="spending-events">
        <ul class="flex flex-col py-2">
          <li v-for="line in lines" :key="line.totals.event.id" class="flex items-start border-t border-default first:border-t-0" data-testid="spending-event-row">
            <ListRow :to="eventLink(line.totals.event)" :title="line.totals.event.name" :caption="line.caption" class="min-w-0 flex-1" data-testid="spending-event-open">
              <template v-if="line.totals.rows > 0" #amount>
                <MoneyText :cents="negateMoney(line.totals.spent)" tone="flow" :data-spent="line.totals.spent" />
              </template>
              <template v-if="line.totals.rows > 0" #details>
                <TotalsLines :totals="line.totals" :categories="categories" :rated="!waiting" />
              </template>
            </ListRow>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              :aria-label="words.change(line.totals.event.name)"
              class="me-2 mt-2 shrink-0 sm:me-3"
              data-testid="spending-event-change"
              @click="openDialog(line.totals.event)"
            />
          </li>
        </ul>
      </AppCard>
    </template>
    <EventDialog v-model:open="dialogOpen" :event="editing" />
  </section>
</template>
