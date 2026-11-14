<script setup lang="ts">
import { computed, ref } from 'vue'

import { sumMoney } from '../../../../../shared/money/money'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import { plural } from '../../../../../shared/text/translation'
import AppCard from '../../../../../shared/ui/AppCard.vue'
import { useFilteredLedger } from '../../../transactions/application/useFilteredLedger'
import { newestBookingOf } from '../../../workbook/domain/workbook'
import { hrDooWorkbook } from '../domain/hrDooPart'
import AdvanceDialog from './AdvanceDialog.vue'
import type { AdvancePrefill } from './AdvanceDialog.vue'
import UnaccountedReimbursements from './UnaccountedReimbursements.vue'
import { unaccountedInView } from '../domain/ownerAdvances'
import { words } from './words'

/** The To review tab's card of reimbursements to the owner with no cost on file, each with a way to add its cost. */
const ledger = useFilteredLedger()
const unaccounted = computed(() => (ledger.value === null ? [] : unaccountedInView(hrDooWorkbook(ledger.value.booked), ledger.value.filters)))
const summary = computed(() => words.unaccounted.summary(formatMoney(sumMoney(unaccounted.value.map((payment) => payment.amount)))))
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
    :title="plural(words.unaccounted.title(unaccounted.length), unaccounted.length)"
    collapse-id="review.unaccounted"
    :summary="summary"
    data-testid="review-unaccounted"
  >
    <template #subtitle>{{ words.unaccounted.subtitle }}</template>
    <div class="px-4 pt-1 pb-2 sm:px-5">
      <UnaccountedReimbursements :payments="unaccounted" @add-cost="addCost" />
    </div>
  </AppCard>
  <AdvanceDialog v-if="ledger && newestBooking" v-model:open="addingCost" :categories="ledger.workbook.categories" :default-date="newestBooking" :prefill="costPrefill" />
</template>
