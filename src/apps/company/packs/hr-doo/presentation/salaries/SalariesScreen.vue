<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import { monthLabel, shortMonthName } from '../../../../../../shared/calendar/monthLabel'
import PageHeader from '../../../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../../../shared/ui/PageTabs.vue'
import { useFilters } from '../../../../filters/application/filterStore'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import { useSettings } from '../../../../settings/application/useSettings'
import FactTabCard from '../../../../settings/presentation/FactTabCard.vue'
import { useWorkbook } from '../../../../workbook/application/workbookStore'
import { ledgerWindowOf } from '../../../../workbook/domain/workbook'
import LedgerGate from '../../../../workbook/presentation/LedgerGate.vue'
import { employeeOfFields, readEmployees } from '../../domain/employees/employeesReading'
import { hrDooWorkbook } from '../../domain/hrDooPart'
import { EMPLOYEE_WRITES } from '../../domain/hrDooWrites'
import { salaryReconciliation } from '../../domain/salaries/salaryReconciliation'
import { EMPLOYEE_COLUMNS } from '../editorColumns'
import OwnerPayOff from '../OwnerPayOff.vue'
import SalaryMonthPanel from './SalaryMonthPanel.vue'
import SalaryOverTimePanel from './SalaryOverTimePanel.vue'
import SalaryPeoplePanel from './SalaryPeoplePanel.vue'
import { chosenPayday, employeeName, paydayYears, peopleRows, salaryMonthView, salaryYearRows } from './salariesView'

/** Each payday's pay split into where the money goes, the app and the bank set against each other, and the people the company pays. */
const settings = useSettings()
const { state } = useWorkbook()
const { drillLocation } = useFilters()
const route = useRoute()
const router = useRouter()

const workbook = computed(() => (state.workbook === null ? null : hrDooWorkbook(state.workbook)))
const ledgerWindow = computed(() => (workbook.value === null ? null : ledgerWindowOf(workbook.value.transactions)))
const reconciliation = computed(() => (workbook.value === null ? null : salaryReconciliation(workbook.value)))

const text = (key: string): string | null => (typeof route.query[key] === 'string' && route.query[key] !== '' ? route.query[key] : null)

const payday = computed(() => {
  const current = reconciliation.value
  const ledger = ledgerWindow.value
  if (current === null || ledger === null) return null
  const year = text('year')
  return chosenPayday(current, { year: year === null ? null : Number(year), payday: text('month') }, ledger.partMonth)
})

const year = computed(() => (payday.value === null ? null : yearOfMonth(payday.value.payday)))
const years = computed(() => (reconciliation.value === null ? [] : paydayYears(reconciliation.value)))
const monthsOfYear = computed(() => reconciliation.value?.paydays.filter((entry) => yearOfMonth(entry.payday) === year.value).map((entry) => entry.payday) ?? [])

const employees = computed(() => workbook.value?.employees ?? [])
const employee = computed(() => {
  const asked = text('employee')
  return employees.value.some((candidate) => candidate.slug === asked) ? asked : null
})
const EVERYONE = 'everyone'
const employeeItems = computed(() => [{ label: 'Everyone', value: EVERYONE }, ...employees.value.map((candidate) => ({ label: employeeName(candidate), value: candidate.slug }))])

const tabs = computed((): PageTab[] => [
  { value: 'month', label: 'Month', icon: 'i-lucide-calendar-days' },
  { value: 'over-time', label: 'Over time', icon: 'i-lucide-chart-column' },
  ...(employees.value.length >= 2 ? [{ value: 'people', label: 'People', icon: 'i-lucide-users', count: employees.value.length }] : []),
])

const link = (drill: DrillTarget | null) => (drill === null ? null : drillLocation(drill))

function choose(changes: Readonly<Record<string, string | null>>): void {
  const query = { ...route.query }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) delete query[key]
    else query[key] = value
  }
  void router.replace({ query })
}

const month = computed(() => {
  const ledger = ledgerWindow.value
  const shown = payday.value
  if (ledger === null || shown === null) return null
  return salaryMonthView(shown, { payday: shown.payday, employee: employee.value }, ledger.partMonth, { query: route.query, hash: '#salary-problems' }, link)
})

const overTime = computed(() => {
  const current = reconciliation.value
  const ledger = ledgerWindow.value
  return current === null || ledger === null || year.value === null ? null : salaryYearRows(current, year.value, employee.value, ledger.partMonth)
})

const people = computed(() => (payday.value === null ? null : peopleRows(payday.value)))

/** The Month tab on a payday, for one employee or everyone. */
function monthLink(paydayMonth: string, slug: string | null = employee.value) {
  const { tab: _tab, employee: _employee, ...others } = route.query
  return { query: { ...others, year: paydayMonth.slice(0, 4), month: paydayMonth, ...(slug === null ? {} : { employee: slug }) } }
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Salaries" description="Where each payday’s money went, and whether the app and the bank agree on it." />
    <OwnerPayOff v-if="!settings.ownerPayModule" />
    <LedgerGate v-else>
      <template v-if="workbook">
        <UAlert
          v-if="workbook.director === null"
          icon="i-lucide-user-plus"
          color="neutral"
          variant="subtle"
          title="No row is the director's yet"
          description="The pay scenarios, the forecast's owner pay and the payroll on this page work out the owner's pay on the director's row: where they live, pillar II, dependants, the year of birth and the day the employment started. Add yours with Director ticked."
          data-testid="no-director"
        />

        <PageTabs v-if="employees.length > 0 && payday && month" :tabs="tabs" label="Parts of the salaries" data-testid="salaries-tabs">
          <template #above>
            <div class="flex flex-col gap-3" data-testid="salaries-choice">
              <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Year">
                <UButton
                  v-for="option in years"
                  :key="option"
                  :label="String(option)"
                  size="sm"
                  color="neutral"
                  :variant="option === year ? 'solid' : 'outline'"
                  :aria-pressed="option === year"
                  @click="choose({ year: String(option), month: null })"
                />
              </div>
              <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Payday" data-testid="salaries-paydays">
                <UButton
                  v-for="option in monthsOfYear"
                  :key="option"
                  :label="shortMonthName(option)"
                  :aria-label="`Paid in ${monthLabel(option)}`"
                  size="sm"
                  color="neutral"
                  :variant="option === payday.payday ? 'subtle' : 'ghost'"
                  :aria-pressed="option === payday.payday"
                  :data-payday="option"
                  @click="choose({ year: option.slice(0, 4), month: option })"
                />
              </div>
              <USelect
                v-if="employees.length >= 2"
                :model-value="employee ?? EVERYONE"
                :items="employeeItems"
                aria-label="Employee"
                class="w-full sm:w-56"
                data-testid="salaries-employee"
                @update:model-value="(picked: string) => choose({ employee: picked === EVERYONE ? null : picked })"
              />
            </div>
          </template>
          <template #month>
            <SalaryMonthPanel :view="month" />
          </template>
          <template #over-time>
            <SalaryOverTimePanel v-if="overTime && year !== null" :rows="overTime" :year="year" :month-link="monthLink" />
          </template>
          <template #people>
            <SalaryPeoplePanel v-if="people" :rows="people" :label="month.label" :payday="month.payday" :month-link="monthLink" />
          </template>
        </PageTabs>
        <p v-else-if="employees.length > 0" class="text-sm text-toned" data-testid="salaries-no-payday">
          No payday yet. A month shows here once the ledger holds a row in a category with the <span class="identifier">salary</span> role or a payroll tax paid in it.
        </p>

        <FactTabCard
          id="employee-rows"
          :rules="EMPLOYEE_WRITES"
          title="Employees"
          description="One row per person the company pays a salary. A month the employment starts or ends in counts its working days from the row's dates."
          collapse-id="salaries.employees"
          :columns="EMPLOYEE_COLUMNS"
          :read="readEmployees"
          :make="employeeOfFields"
          :new-row="() => ({ pension_pillar_2: 'TRUE' })"
          row-noun="employee"
          tab-noun="employees"
          saved-title="Employees saved"
          :start-collapsed="employees.length > 0 && month !== null"
          :reveal="route.hash === '#employee-rows'"
        />
      </template>
    </LedgerGate>
  </section>
</template>
