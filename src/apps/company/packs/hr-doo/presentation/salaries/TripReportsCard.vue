<script setup lang="ts">
import { computed } from 'vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'

import { today } from '../../../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { useRates } from '../../../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../../../shared/rates/domain/ratesState'
import { useRecordWrites } from '../../../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { markTripReported } from '../../application/tripRowWrites'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import type { Trip } from '../../domain/trips/trip'
import { tripReportsOfMonth } from '../../domain/trips/tripPayments'
import { ruleValue } from '../../ruleset/ruleset'
import { SETTLEMENT_TAB, tripLink } from '../trips/tripLinks'
import { destinationText, travellerName } from '../trips/tripsView'
import { words } from './words'

/** The trips of a month under JOPPD code 17, each with what it reports and the day the report is due. */
const props = defineProps<{
  workbook: HrDooWorkbook
  month: MonthKey
  /** Null for everyone. */
  employee: string | null
}>()

const rates = useRates()
const said = words.tripReports

const ofMonth = computed(() => tripReportsOfMonth(props.workbook.trips, props.month, props.employee, ruleValue, everydayRates(rates.value)))
const reports = computed(() => ofMonth.value.reports)

const writes = useRecordWrites(useWorkbook())

async function markReported(trip: Trip, reported: boolean): Promise<void> {
  await writes.write(reported ? said.markedReported(trip.number) : said.unmarkedReported(trip.number), (unit) => markTripReported(unit, trip, reported ? today() : null), {
    key: `reported-${trip.id}`,
    failedTitle: said.reportedNotSaved,
  })
}
</script>

<template>
  <AppCard v-if="reports.length > 0" :title="said.title" :subtitle="said.subtitle(monthLabel(month))" data-testid="salaries-trip-reports">
    <FigureTable class="px-1 pb-2 sm:px-2" :label="said.label">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ said.tripColumn }}</th>
          <th scope="col" class="text-end">{{ said.amountColumn }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="report in reports" :key="report.trip.id" data-testid="salaries-trip-report">
          <th scope="row" class="cell-wraps text-start font-normal">
            <DrillLink
              :to="tripLink(report.trip.id, SETTLEMENT_TAB)"
              :label="said.tripLabel(report.trip.number, travellerName(report.trip.traveller, workbook.employees), destinationText(report.trip))"
              >{{
                employee === null && workbook.employees.length > 1
                  ? said.tripWithTraveller(report.trip.number, travellerName(report.trip.traveller, workbook.employees), report.trip.destination)
                  : said.trip(report.trip.number, report.trip.destination)
              }}</DrillLink
            >
            <span v-if="report.trip.reportedOn === null" class="block type-caption">{{ said.due(shortDayLabel(report.dueOn)) }}</span>
            <UCheckbox
              class="mt-1"
              :model-value="report.trip.reportedOn !== null"
              :label="report.trip.reportedOn === null ? said.reported : said.reportedOn(shortDayLabel(report.trip.reportedOn))"
              :aria-label="said.reportedLabel(report.trip.number)"
              :disabled="writes.saving(`reported-${report.trip.id}`)"
              data-testid="salaries-trip-reported"
              @update:model-value="markReported(report.trip, $event === true)"
            />
          </th>
          <td class="align-top text-end">
            <MoneyText v-if="report.amount !== null" :cents="report.amount" />
            <span v-else class="type-caption">{{ said.waitsForRate }}</span>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="reports.length > 1 && ofMonth.total !== null">
        <tr data-testid="salaries-trip-reports-total">
          <th scope="row" class="text-start">{{ said.total(monthLabel(month)) }}</th>
          <td class="text-end"><MoneyText :cents="ofMonth.total" /></td>
        </tr>
      </tfoot>
    </FigureTable>
  </AppCard>
</template>
