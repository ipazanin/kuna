<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UBadge from '@nuxt/ui/components/Badge.vue'

import { useRates } from '../../../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../../../shared/rates/domain/ratesState'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChoiceButtons from '../../../../../../shared/ui/ChoiceButtons.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import type { Employee } from '../../domain/employees/employees'
import type { TripFile } from '../../domain/trips/tripReading'
import { tripRows, tripYears } from './tripsView'
import { words } from './words'

/** The travel orders of one issue year, picked above the list, each with its status and payout. */
const props = defineProps<{
  files: readonly TripFile[]
  employees: readonly Employee[]
}>()

const route = useRoute()
const rates = useRates()
const router = useRouter()

const years = computed(() => tripYears(props.files))
const shownYear = computed(() => {
  const asked = Number(route.query.year)
  return years.value.includes(asked) ? asked : (years.value[0] ?? null)
})

/** The year in view, kept in `?year=` unless it is the newest. */
const year = computed({
  get: () => shownYear.value ?? 0,
  set: (picked: number) => {
    void router.replace({ query: { ...route.query, year: picked === years.value[0] ? undefined : String(picked) } })
  },
})
const yearOptions = computed(() => years.value.map((option) => ({ value: option, label: String(option) })))
const rows = computed(() => (shownYear.value === null ? [] : tripRows(props.files, shownYear.value, props.employees, everydayRates(rates.value))))
</script>

<template>
  <div v-if="shownYear !== null" class="flex flex-col gap-3">
    <ChoiceButtons v-if="years.length > 1" v-model="year" :options="yearOptions" :label="words.screen.year" data-testid="trips-years" />
    <AppCard :title="words.screen.listTitle(year)" data-testid="trips-list">
      <FigureTable class="px-1 pb-2 sm:px-2" :label="words.screen.listLabel(year)">
        <thead>
          <tr>
            <th scope="col" class="text-start">{{ words.columns.number }}</th>
            <th scope="col" class="text-start">{{ words.columns.destination }}</th>
            <th scope="col" class="hidden text-start @3xl:table-cell">{{ words.columns.dates }}</th>
            <th scope="col" class="hidden text-start @xl:table-cell">{{ words.columns.status }}</th>
            <th scope="col" class="text-end">{{ words.columns.payout }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" data-testid="trip-row" :data-trip="row.number">
            <th scope="row" class="text-start font-normal">
              <DrillLink :to="row.to" :label="words.trip.title(row.number)" class="font-medium text-highlighted">{{ row.number }}</DrillLink>
            </th>
            <td class="cell-wraps">
              <span class="text-highlighted">{{ row.destination }}</span>
              <span class="block type-caption"
                >{{ row.traveller }}<span class="@3xl:hidden">, {{ row.dates }}</span></span
              >
              <UBadge :label="row.status.label" :icon="row.status.icon" :color="row.status.color" variant="subtle" size="sm" class="mt-1 @xl:hidden" />
            </td>
            <td class="hidden text-toned @3xl:table-cell">{{ row.dates }}</td>
            <td class="hidden @xl:table-cell">
              <UBadge :label="row.status.label" :icon="row.status.icon" :color="row.status.color" variant="subtle" size="sm" />
            </td>
            <td class="text-end">
              <template v-if="row.payout !== null">
                <MoneyText :cents="row.payout" />
                <span v-if="row.paysBack" class="block type-caption">{{ words.settlementFigures.toReturn }}</span>
              </template>
              <span v-else class="text-muted">{{ words.order.none }}</span>
            </td>
          </tr>
        </tbody>
      </FigureTable>
    </AppCard>
  </div>
</template>
