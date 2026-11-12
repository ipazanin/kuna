<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { keyOfRecordId } from '../../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { plural } from '../../../../../../shared/text/translation'
import EmptyState from '../../../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../../../shared/ui/PageTabs.vue'
import { useSettings } from '../../../../settings/application/useSettings'
import { useBookedWorkbook } from '../../../../transactions/application/useBookedWorkbook'
import ProblemList from '../../../../workbook-files/presentation/ProblemList.vue'
import { TRIP_RECORDS } from '../../domain/hrDooKinds'
import { hrDooWorkbook } from '../../domain/hrDooPart'
import type { TripFile } from '../../domain/trips/tripReading'
import OwnerPayOff from '../OwnerPayOff.vue'
import { words as packWords } from '../words'
import TripList from './TripList.vue'
import { SETTLEMENT_TAB, TRIPS_ROUTE, TRIP_QUERY, tripLink } from './tripLinks'
import TripOrderDialog from './TripOrderDialog.vue'
import TripOrderPanel from './TripOrderPanel.vue'
import TripSettlementPanel from './TripSettlementPanel.vue'
import { destinationText, travellerName, tripDates, tripWarningTexts } from './tripsView'
import { words } from './words'

/** The travel orders by issue year, and one order's page with its order and its settlement. */
const settings = useSettings()
const booked = useBookedWorkbook()
const route = useRoute()
const router = useRouter()

const workbook = computed(() => (booked.value === null ? null : hrDooWorkbook(booked.value)))
const files = computed(() => workbook.value?.trips ?? [])
const employees = computed(() => workbook.value?.employees ?? [])

const TRIP_TABS = new Set(['trips', 'trip-legs', 'trip-costs'])
const problems = computed(() => (booked.value?.problems ?? []).filter((problem) => TRIP_TABS.has(problem.tab)))

const asked = computed(() => (typeof route.query[TRIP_QUERY] === 'string' ? route.query[TRIP_QUERY] : null))
const file = computed(() => (asked.value === null ? null : (files.value.find((candidate) => keyOfRecordId(TRIP_RECORDS, candidate.trip.id) === asked.value) ?? null)))

const tabs: readonly PageTab[] = [
  { value: 'order', label: words.trip.order, icon: 'i-lucide-file-text' },
  { value: SETTLEMENT_TAB, label: words.trip.settlement, icon: 'i-lucide-calculator' },
]

const warnings = computed(() => (file.value === null ? [] : tripWarningTexts(file.value, employees.value)))

const title = computed(() => (file.value === null ? packWords.screens.trips : words.trip.title(file.value.trip.number)))
const description = computed(() => {
  if (file.value === null) return words.screen.description
  const { trip } = file.value
  return words.trip.description(travellerName(trip.traveller, employees.value), destinationText(trip), tripDates(trip))
})

const orderOpen = ref(false)
const editing = ref<TripFile | null>(null)

function newOrder(): void {
  editing.value = null
  orderOpen.value = true
}

function changeOrder(): void {
  editing.value = file.value
  orderOpen.value = true
}

function openTrip(id: RecordId): void {
  void router.push(tripLink(id))
}

function allOrders(): void {
  void router.push({ path: TRIPS_ROUTE })
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="title" :description="description">
      <template v-if="settings.ownerPayModule && workbook" #actions>
        <UButton v-if="file" :label="words.trip.allOrders" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" data-testid="trips-all" @click="allOrders" />
        <UButton v-else-if="employees.length > 0" :label="words.screen.newOrder" icon="i-lucide-plus" size="sm" data-testid="trips-new" @click="newOrder" />
      </template>
    </PageHeader>
    <OwnerPayOff v-if="!settings.ownerPayModule" />
    <template v-else-if="workbook">
      <div v-if="problems.length > 0" class="flex flex-col gap-3" data-testid="trips-problems">
        <UAlert icon="i-lucide-octagon-x" color="error" variant="subtle" :title="plural(words.screen.unreadable(problems.length), problems.length)" :description="words.screen.unreadableHelp" />
        <ProblemList :problems="problems" />
      </div>

      <template v-if="file">
        <UAlert v-for="warning in warnings" :key="warning" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :description="warning" data-testid="trip-warning" />
        <PageTabs :tabs="tabs" :label="words.trip.tabsLabel" data-testid="trip-tabs">
          <template #order>
            <TripOrderPanel :file="file" :employees="employees" :company="workbook.settings.invoicing" @change="changeOrder" />
          </template>
          <template #settlement>
            <TripSettlementPanel :file="file" :employees="employees" />
          </template>
        </PageTabs>
      </template>
      <template v-else>
        <UAlert v-if="asked !== null" icon="i-lucide-info" color="neutral" variant="subtle" :description="words.screen.notFound" data-testid="trip-not-found" />
        <EmptyState
          v-if="employees.length === 0"
          icon="i-lucide-user-plus"
          :title="words.screen.emptyTitle"
          :description="words.screen.noEmployees"
          :actions="[{ label: words.screen.openEmployees, to: { path: '/company/salaries', hash: '#employee-rows' }, color: 'neutral', variant: 'outline' }]"
        />
        <EmptyState
          v-else-if="files.length === 0"
          icon="i-lucide-plane"
          :title="words.screen.emptyTitle"
          :description="words.screen.emptyDescription"
          :actions="[{ label: words.screen.newOrder, icon: 'i-lucide-plus', onClick: newOrder }]"
          data-testid="trips-empty"
        />
        <TripList v-else :files="files" :employees="employees" />
      </template>

      <TripOrderDialog
        v-model:open="orderOpen"
        :trips="files.map((entry) => entry.trip)"
        :employees="employees"
        :default-traveller="workbook.director?.slug ?? employees[0]?.slug ?? null"
        :editing="editing"
        @saved="openTrip"
        @deleted="allOrders"
      />
    </template>
  </section>
</template>
