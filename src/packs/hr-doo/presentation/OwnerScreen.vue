<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { yearOf } from '../../../shared/calendar/civilDate'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../shared/ui/PageTabs.vue'
import { useSettings } from '../../../features/settings/application/useSettings'
import { useFilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { useWorkbook } from '../../../features/workbook/application/workbookStore'
import { newestBookingOf } from '../../../features/workbook/domain/workbook'
import LedgerGate from '../../../features/workbook/presentation/LedgerGate.vue'
import { periodRange } from '../../../features/filters/domain/filterState'
import { periodInWords } from '../../../features/filters/domain/periodInWords'
import FilterBar from '../../../features/filters/presentation/FilterBar.vue'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import type { PackRole } from '../domain/packRoles'
import AdvanceDialog from './AdvanceDialog.vue'
import MissingRoles from './MissingRoles.vue'
import OwedPanel from './OwedPanel.vue'
import OwnerPayOff from './OwnerPayOff.vue'
import TakenPanel from './TakenPanel.vue'

const TABS: readonly PageTab[] = [
  { label: 'Taken', value: 'taken', icon: 'i-lucide-hand-coins' },
  { label: 'Who owes whom', value: 'owed', icon: 'i-lucide-arrow-left-right' },
]

const ledger = useFilteredLedger()
const settings = useSettings()
const { state } = useWorkbook()
const addingAdvance = ref(false)

const asOf = computed(() => newestBookingOf(ledger.value?.workbook.transactions ?? []))

/** The pay mixes look a year ahead, so the link opens the year after the newest booking. */
const payMixes = computed(() => ({ path: '/year', query: { tab: 'pay', ...(asOf.value === null ? {} : { year: String(yearOf(asOf.value) + 1) }) } }))

/** The days both tabs show, so a new advance outside them says so. */
const inView = computed(() => {
  const current = ledger.value
  return current === null ? null : { range: periodRange(current.filters.period, current.window), words: periodInWords(current.filters.period, current.window) }
})

/** The roles both tabs read, said once under the header. */
const missing = computed(() => {
  const categories = ledger.value?.workbook.categories ?? []
  const lacks = (role: PackRole) => categoriesWithRole(categories, role).length === 0
  return [
    ...(lacks(PACK_ROLES.ownerLoanOut) ? [{ role: PACK_ROLES.ownerLoanOut, leftOut: 'no loan to the owner is listed' }] : []),
    ...(lacks(PACK_ROLES.ownerLoanRepaid) ? [{ role: PACK_ROLES.ownerLoanRepaid, leftOut: 'no repayment is matched to a loan' }] : []),
    ...(lacks(PACK_ROLES.ownerPayTax) ? [{ role: PACK_ROLES.ownerPayTax, leftOut: 'gross cost is owner pay alone' }] : []),
    ...(lacks(PACK_ROLES.reimbursement) ? [{ role: PACK_ROLES.reimbursement, leftOut: 'no reimbursement repays an advance' }] : []),
  ]
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Owner" description="What the owner took out, and who owes whom between the owner and the company.">
      <template v-if="settings.ownerPayModule" #actions>
        <UButton
          label="Add advance"
          icon="i-lucide-plus"
          size="sm"
          :disabled="ledger === null || state.writing"
          data-testid="open-add-advance"
          @click="addingAdvance = true"
        />
        <UButton label="Compare pay mixes" icon="i-lucide-scale" :to="payMixes" color="neutral" variant="outline" size="sm" data-testid="owner-pay-scenarios" />
      </template>
    </PageHeader>
    <OwnerPayOff v-if="!settings.ownerPayModule" />
    <LedgerGate v-else>
      <template v-if="ledger && asOf">
        <MissingRoles :missing="missing" />
        <PageTabs :tabs="TABS" label="What the owner took and who owes whom">
          <template #above>
            <FilterBar :workbook="ledger.workbook" :window="ledger.window" />
          </template>
          <template #taken>
            <TakenPanel :ledger="ledger" :as-of="asOf" />
          </template>
          <template #owed>
            <OwedPanel :ledger="ledger" :as-of="asOf" />
          </template>
        </PageTabs>
        <AdvanceDialog v-model:open="addingAdvance" :categories="ledger.workbook.categories" :default-date="asOf" :in-view="inView" />
      </template>
    </LedgerGate>
  </section>
</template>
