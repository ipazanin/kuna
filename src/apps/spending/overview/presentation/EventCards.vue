<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { eventLink } from './spendingLinks'
import { words } from './words'
import TotalsLines from '../../analytics/presentation/TotalsLines.vue'
import { eventTotals } from '../../events/domain/eventTotals'
import { eventStage, eventsShown } from '../../events/domain/eventsShown'
import { eventDays } from '../../events/presentation/eventDays'
import { words as eventWords } from '../../events/presentation/words'
import { euroRows } from '../../rates/domain/euroRows'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RateBook } from '../../../../shared/money/rateBook'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** A card for each event that runs on the day or ended at most a week before, shortest first: what it spent so far, by group, with a link to its entries. */
const props = defineProps<{
  book: SpendingBook
  rates: RateBook
  /** Whether the rates are in, so rows they do not reach are worth a line. */
  rated: boolean
  day: CivilDate
}>()

const cards = computed(() => {
  const shown = eventsShown(props.book.events, props.day)
  if (shown.length === 0) return []
  const totals = new Map(eventTotals(euroRows(props.book, props.rates), props.book.categories, props.book.events).map((counted) => [counted.event.id, counted]))
  return shown.flatMap((event) => {
    const counted = totals.get(event.id)
    if (counted === undefined) return []
    const stage = eventStage(event, props.day)
    const when =
      stage.kind === 'running'
        ? eventWords.dayOf(stage.day, stage.days)
        : stage.kind === 'ahead'
          ? null
          : stage.daysSince === 1
            ? eventWords.endedYesterday
            : plural(eventWords.ended(stage.daysSince), stage.daysSince)
    return [{ totals: counted, subtitle: [eventDays(event), when].filter((part) => part !== null).join(' · ') }]
  })
})
</script>

<template>
  <DashboardGrid v-if="cards.length > 0" data-testid="spending-event-cards">
    <AppCard v-for="card in cards" :key="card.totals.event.id" :title="card.totals.event.name" :subtitle="card.subtitle" data-testid="spending-event-card">
      <div class="flex flex-col gap-3 px-4 pb-4 sm:px-5">
        <div>
          <MoneyText :cents="card.totals.spent" class="block text-figure-lg font-semibold text-highlighted" :data-spent="card.totals.spent" />
          <p class="type-caption">{{ words.event.spent }}</p>
        </div>
        <TotalsLines :totals="card.totals" :categories="book.categories" :rated="rated" />
        <UButton
          :to="eventLink(card.totals.event)"
          :label="words.event.allEntries"
          trailing-icon="i-lucide-arrow-right"
          color="neutral"
          variant="link"
          class="self-start px-0"
          data-testid="spending-event-card-all"
        />
      </div>
    </AppCard>
  </DashboardGrid>
</template>
