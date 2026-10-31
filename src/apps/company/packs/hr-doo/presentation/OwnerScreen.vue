<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { yearOf } from '../../../../../shared/calendar/civilDate'
import PageHeader from '../../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../../shared/ui/PageTabs.vue'
import { useSettings } from '../../../settings/application/useSettings'
import { useFilteredLedger } from '../../../transactions/application/useFilteredLedger'
import { useWorkbook } from '../../../workbook/application/workbookStore'
import { newestBookingOf } from '../../../workbook/domain/workbook'
import LedgerGate from '../../../workbook/presentation/LedgerGate.vue'
import { periodRange } from '../../../filters/domain/filterState'
import { periodInWords } from '../../../filters/domain/periodInWords'
import FilterBar from '../../../filters/presentation/FilterBar.vue'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import type { PackRole } from '../domain/packRoles'
import AdvanceDialog from './AdvanceDialog.vue'
import MissingRoles from './MissingRoles.vue'
import OwedPanel from './OwedPanel.vue'
import OwnerPayOff from './OwnerPayOff.vue'
import TakenPanel from './TakenPanel.vue'
import { words } from './words'

const TABS: readonly PageTab[] = [
  { label: words.owner.tabs.taken, value: 'taken', icon: 'i-lucide-hand-coins' },
  { label: words.owner.tabs.owed, value: 'owed', icon: 'i-lucide-arrow-left-right' },
]

const ledger = useFilteredLedger()
const settings = useSettings()
const { state } = useWorkbook()
const addingAdvance = ref(false)

const asOf = computed(() => newestBookingOf(ledger.value?.workbook.transactions ?? []))

/** The pay mixes look a year ahead, so the link opens the year after the newest booking. */
const payMixes = computed(() => ({ path: '/company/year', query: { tab: 'pay', ...(asOf.value === null ? {} : { year: String(yearOf(asOf.value) + 1) }) } }))

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
    ...(lacks(PACK_ROLES.ownerLoanOut) ? [{ role: PACK_ROLES.ownerLoanOut, leftOut: words.owner.leftOut.loanOut }] : []),
    ...(lacks(PACK_ROLES.ownerLoanRepaid) ? [{ role: PACK_ROLES.ownerLoanRepaid, leftOut: words.owner.leftOut.loanRepaid }] : []),
    ...(lacks(PACK_ROLES.ownerPayTax) ? [{ role: PACK_ROLES.ownerPayTax, leftOut: words.owner.leftOut.payTax }] : []),
    ...(lacks(PACK_ROLES.reimbursement) ? [{ role: PACK_ROLES.reimbursement, leftOut: words.owner.leftOut.reimbursement }] : []),
  ]
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.screens.owner" :description="words.owner.description">
      <template v-if="settings.ownerPayModule" #actions>
        <UButton :label="words.owner.addAdvance" icon="i-lucide-plus" size="sm" :disabled="ledger === null || state.writing" data-testid="open-add-advance" @click="addingAdvance = true" />
        <UButton :label="words.owner.comparePayMixes" icon="i-lucide-scale" :to="payMixes" color="neutral" variant="outline" size="sm" data-testid="owner-pay-scenarios" />
      </template>
    </PageHeader>
    <OwnerPayOff v-if="!settings.ownerPayModule" />
    <LedgerGate v-else>
      <template v-if="ledger && asOf">
        <MissingRoles :missing="missing" />
        <PageTabs :tabs="TABS" :label="words.owner.tabs.label">
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
