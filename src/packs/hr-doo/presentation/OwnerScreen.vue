<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import PageHeader from '../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../shared/ui/PageTabs.vue'
import { useSettings } from '../../../features/settings/application/useSettings'
import { useFilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { useWorkbook } from '../../../features/workbook/application/workbookStore'
import { newestBookingOf } from '../../../features/workbook/domain/workbook'
import LedgerGate from '../../../features/workbook/presentation/LedgerGate.vue'
import { PACK_ROLES, categoriesWithRole } from '../domain/packRoles'
import type { PackRole } from '../domain/packRoles'
import AddAdvanceDialog from './AddAdvanceDialog.vue'
import MissingRoles from './MissingRoles.vue'
import OwedPanel from './OwedPanel.vue'
import OwnerPayOff from './OwnerPayOff.vue'
import TakenPanel from './TakenPanel.vue'

const TABS: readonly PageTab[] = [
  { label: 'Who owes whom', value: 'owed', icon: 'i-lucide-arrow-left-right' },
  { label: 'Taken', value: 'taken', icon: 'i-lucide-hand-coins' },
]

const ledger = useFilteredLedger()
const settings = useSettings()
const { state } = useWorkbook()
const addingAdvance = ref(false)

const asOf = computed(() => newestBookingOf(ledger.value?.workbook.transactions ?? []))

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
    <PageHeader title="Owner" description="Who owes whom between the owner and the company, and what the owner took out.">
      <template v-if="settings.ownerPayModule" #actions>
        <UButton
          label="Add advance"
          icon="i-lucide-plus"
          size="sm"
          :disabled="ledger === null || state.writing"
          data-testid="open-add-advance"
          @click="addingAdvance = true"
        />
        <UButton label="Compare pay mixes" icon="i-lucide-scale" to="/pay-scenarios" color="neutral" variant="outline" size="sm" data-testid="owner-pay-scenarios" />
      </template>
    </PageHeader>
    <OwnerPayOff v-if="!settings.ownerPayModule" />
    <LedgerGate v-else>
      <template v-if="ledger && asOf">
        <MissingRoles :missing="missing" />
        <PageTabs :tabs="TABS" label="Who owes whom and what the owner took">
          <template #owed>
            <OwedPanel :ledger="ledger" :as-of="asOf" />
          </template>
          <template #taken>
            <TakenPanel :ledger="ledger" />
          </template>
        </PageTabs>
        <AddAdvanceDialog v-model:open="addingAdvance" :categories="ledger.workbook.categories" :default-date="asOf" />
      </template>
    </LedgerGate>
  </section>
</template>
