<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { words } from './words'
import { chooseEvent } from '../../events/application/eventWrites'
import { eventsNewestFirst } from '../../events/domain/events'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { BY_DAYS, OUT_OF_EVENTS } from '../../workbook/domain/event'
import type { EventChoice } from '../../workbook/domain/event'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'

/**
 * Puts the picked entries in an event by hand, takes them out of every event, or puts them back on their days, each in one
 * write with Undo. An event needs its days, so it is made on Events, not here.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  rows: readonly Transaction[]
}>()

const emit = defineEmits<{ done: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const count = computed(() => props.rows.length)
const entries = computed(() => plural(words.filters.entries(count.value), count.value))

/** The event choice of every part of the picked entries. */
const choices = computed((): readonly EventChoice[] => {
  const book = store.state.workbook
  if (book === null) return []
  const itemsOf = rowItemsOf(book)
  return props.rows.flatMap((row) => itemsOf(row).map((item) => item.event))
})

/** Each event of the file, newest first, and whether every picked part is already in it by hand. */
const events = computed(() =>
  eventsNewestFirst(store.state.workbook?.events ?? []).map((event) => ({ event, allIn: choices.value.length > 0 && choices.value.every((choice) => choice === event.id) })),
)
const byHand = computed(() => choices.value.some((choice) => choice !== BY_DAYS))
const allOut = computed(() => choices.value.length > 0 && choices.value.every((choice) => choice === OUT_OF_EVENTS))

async function choose(choice: EventChoice, title: string): Promise<void> {
  const records = store.state.records
  if (records === null) return
  if (await writes.write(title, (unit) => chooseEvent(unit, records, props.rows, choice), { key: choice, failedTitle: spendingWords.form.notSaved })) done()
}

function done(): void {
  open.value = false
  emit('done')
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="words.inEvent.title(entries)" :description="words.inEvent.description">
    <div class="flex flex-col gap-4" data-testid="spending-event-picker">
      <ul class="flex flex-col">
        <ListRow
          v-for="choice in events"
          :key="choice.event.id"
          :title="choice.event.name"
          :caption="dayRangeLabel(choice.event.days)"
          flush
          class="border-t border-default first:border-t-0"
          data-testid="spending-event-choice"
        >
          <div class="flex">
            <UButton
              :label="choice.allIn ? words.inEvent.allIn : words.inEvent.putIn"
              :icon="choice.allIn ? 'i-lucide-check' : 'i-lucide-calendar-plus'"
              size="sm"
              color="neutral"
              variant="outline"
              :loading="writes.saving(choice.event.id)"
              :disabled="choice.allIn || writes.busy.value || writes.refused.value"
              data-testid="spending-event-put-in"
              @click="choose(choice.event.id, words.inEvent.put(choice.event.name, entries))"
            />
          </div>
        </ListRow>
      </ul>
      <div class="flex flex-col gap-3 border-t border-default pt-4">
        <div v-if="byHand" class="flex flex-col items-start gap-1.5">
          <UButton
            :label="words.inEvent.backOnDays"
            icon="i-lucide-calendar-sync"
            size="sm"
            color="neutral"
            variant="outline"
            :loading="writes.saving(BY_DAYS)"
            :disabled="writes.busy.value || writes.refused.value"
            data-testid="spending-event-back-on-days"
            @click="choose(BY_DAYS, words.inEvent.back(entries))"
          />
          <p class="type-caption">{{ words.inEvent.backOnDaysHelp }}</p>
        </div>
        <div class="flex flex-col items-start gap-1.5">
          <UButton
            :label="words.inEvent.takeOut"
            icon="i-lucide-calendar-x"
            size="sm"
            color="neutral"
            variant="outline"
            :loading="writes.saving(OUT_OF_EVENTS)"
            :disabled="allOut || writes.busy.value || writes.refused.value"
            data-testid="spending-event-take-out"
            @click="choose(OUT_OF_EVENTS, words.inEvent.takenOut(entries))"
          />
          <p class="type-caption">{{ words.inEvent.takeOutHelp }}</p>
        </div>
      </div>
    </div>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
    </template>
  </AppDialog>
</template>
