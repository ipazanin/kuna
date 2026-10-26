<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { useFilters } from '../../../../features/filters/application/filterStore'
import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import { payrollRows, vatReturnRows } from './accountantView'
import PayrollReturnsCard from './PayrollReturnsCard.vue'
import { useAccountantDocuments } from './useAccountantDocuments'
import VatReturnsCard from './VatReturnsCard.vue'

/** The accountant's VAT returns and salary workbooks for the year, as the last sync read them from Drive, with when. */
const props = defineProps<{
  workbook: HrDooWorkbook
  year: number
}>()

const accountant = useAccountantDocuments()
const { drillLocation } = useFilters()
const linkOf = (drill: DrillTarget | null) => (drill === null ? null : drillLocation(drill))

const stamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

const documents = accountant.documents
const vatRows = computed(() => (documents.value === null ? [] : vatReturnRows(props.workbook, documents.value, props.year, linkOf)))
const salaryRows = computed(() => (documents.value === null ? [] : payrollRows(props.workbook, documents.value, props.year, linkOf)))
const folderProblems = computed(() => (documents.value === null ? null : accountant.state.read?.folderProblems) ?? { vatReturns: null, payroll: null })

const status = computed(() => {
  const { read, readHere, reading } = accountant.state
  if (reading) return 'Reading the accountant’s files in Drive…'
  if (read === null) return 'The accountant’s files are not read on this device yet. Sync reads them.'
  const when = stamp.format(new Date(read.readAt))
  return readHere ? `Read from Drive on ${when}.` : `Last read on ${when}, kept on this device.`
})

const empty = computed(() => (documents.value === null ? (accountant.state.reading ? 'Reading Drive…' : 'Nothing read yet.') : ''))
</script>

<template>
  <section v-if="accountant.shows.value" class="flex flex-col gap-4" aria-label="The accountant's returns" data-testid="accountant-returns">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="accountant-read">
      <UIcon :name="accountant.state.reading ? 'i-lucide-loader-circle' : 'i-lucide-folder-open'" class="size-4 shrink-0 text-muted" :class="{ 'animate-spin': accountant.state.reading }" aria-hidden="true" />
      <p class="min-w-0 flex-1 text-sm text-toned" role="status">{{ status }}</p>
    </div>
    <p v-if="accountant.state.problem" class="text-sm text-error" data-testid="accountant-problem">{{ accountant.state.problem }}</p>
    <VatReturnsCard :rows="vatRows" :year="year" :problem="folderProblems.vatReturns" :empty="empty" />
    <PayrollReturnsCard :rows="salaryRows" :year="year" :problem="folderProblems.payroll" :empty="empty" />
  </section>
</template>
