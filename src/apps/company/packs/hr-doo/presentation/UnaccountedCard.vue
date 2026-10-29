<script setup lang="ts">
import { computed, ref } from 'vue'

import { sumMoney } from '../../../../../shared/money/money'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import AppCard from '../../../../../shared/ui/AppCard.vue'
import { useFilteredLedger } from '../../../transactions/application/useFilteredLedger'
import { newestBookingOf } from '../../../workbook/domain/workbook'
import AdvanceDialog from './AdvanceDialog.vue'
import type { AdvancePrefill } from './AdvanceDialog.vue'
import UnaccountedReimbursements from './UnaccountedReimbursements.vue'
import { unaccountedInView } from './unaccountedInView'

/** Review's card of reimbursements to the owner with no cost on file, each with a way to add its cost. */
defineProps<{
  /** True while another write runs. */
  busy: boolean
}>()

const ledger = useFilteredLedger()
const unaccounted = computed(() => (ledger.value === null ? [] : unaccountedInView(ledger.value)))
const summary = computed(() => `${formatMoney(sumMoney(unaccounted.value.map((payment) => payment.amount)))} in all, counted as paid to the owner`)
const newestBooking = computed(() => newestBookingOf(ledger.value?.workbook.transactions ?? []))
const addingCost = ref(false)
const costPrefill = ref<AdvancePrefill | null>(null)

function addCost(prefill: AdvancePrefill): void {
  costPrefill.value = prefill
  addingCost.value = true
}
</script>

<template>
  <AppCard
    v-if="unaccounted.length > 0"
    :title="`${unaccounted.length} ${unaccounted.length === 1 ? 'reimbursement' : 'reimbursements'} with no cost on file`"
    collapse-id="review.unaccounted"
    :summary="summary"
    data-testid="review-unaccounted"
  >
    <template #subtitle> Paid to the owner on a reimbursement category, with no cost on the owner-advances tab to repay. Net owed counts each as paid to the owner until its cost is added. </template>
    <div class="px-4 pt-1 pb-2 sm:px-5">
      <UnaccountedReimbursements :payments="unaccounted" :editable="!busy" @add-cost="addCost" />
    </div>
  </AppCard>
  <AdvanceDialog v-if="ledger && newestBooking" v-model:open="addingCost" :categories="ledger.workbook.categories" :default-date="newestBooking" :prefill="costPrefill" />
</template>
