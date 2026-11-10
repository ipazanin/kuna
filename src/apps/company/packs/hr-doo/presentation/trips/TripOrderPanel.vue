<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import { countryName } from '../../../../../../shared/text/countryName'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import FactGrid from '../../../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../../../shared/ui/FactGrid.vue'
import type { Employee } from '../../domain/employees/employees'
import type { InvoicingTerms } from '../../../../settings/domain/settings'
import type { TripFile } from '../../domain/trips/tripReading'
import TripDownloads from './TripDownloads.vue'
import { travellerName } from './tripsView'
import { words } from './words'

/** The travel order as it was approved, with its downloads and Change. */
const props = defineProps<{
  file: TripFile
  employees: readonly Employee[]
  /** The company as its invoices print it, which heads the downloads. */
  company: InvoicingTerms
}>()

defineEmits<{
  change: []
}>()

const facts = computed((): Fact[] => {
  const { trip } = props.file
  const none = words.order.none
  return [
    { label: words.order.issued, value: dayLabel(trip.issued) },
    { label: words.order.traveller, value: travellerName(trip.traveller, props.employees) },
    { label: words.order.role, value: trip.role || none },
    { label: words.order.destination, value: trip.destination },
    { label: words.order.country, value: countryName(trip.country) },
    { label: words.order.departs, value: dayLabel(trip.departs) },
    { label: words.order.days, value: String(trip.days) },
    { label: words.order.transport, value: words.transports[trip.transport] },
    ...(trip.car === null
      ? []
      : [
          { label: words.order.car, value: trip.car.make },
          { label: words.order.plate, value: trip.car.plate },
          { label: words.order.kmRate, value: formatMoney(trip.car.kmRate) },
        ]),
    { label: words.order.advance, value: trip.advance === null ? none : formatMoney(trip.advance) },
    { label: words.order.settleBy, value: trip.settleBy === null ? none : dayLabel(trip.settleBy) },
  ]
})

/** What the order says in sentences, below the figures. */
const notes = computed(() =>
  [
    { label: words.order.task, text: props.file.trip.task },
    { label: words.order.note, text: props.file.trip.note },
  ].filter((note) => note.text !== ''),
)
</script>

<template>
  <AppCard :title="words.order.title" data-testid="trip-order">
    <template #actions>
      <UButton :label="words.order.change" icon="i-lucide-pencil" color="neutral" variant="outline" size="sm" data-testid="trip-order-change" @click="$emit('change')" />
    </template>
    <div class="flex flex-col gap-4 px-4 pt-1 pb-4 sm:px-5">
      <FactGrid :facts="facts" />
      <dl v-if="notes.length > 0" class="flex flex-col gap-3">
        <div v-for="note in notes" :key="note.label">
          <dt class="type-caption">{{ note.label }}</dt>
          <dd class="mt-0.5 type-body">{{ note.text }}</dd>
        </div>
      </dl>
      <div class="flex flex-wrap items-center gap-2 border-t border-default pt-4" data-testid="trip-downloads">
        <TripDownloads :file="file" :employees="employees" :company="company" />
      </div>
    </div>
  </AppCard>
</template>
