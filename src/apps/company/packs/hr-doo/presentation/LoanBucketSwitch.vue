<script setup lang="ts">
import { computed } from 'vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import AppCard from '../../../../../shared/ui/AppCard.vue'
import { CATEGORY_WRITES } from '../../../settings/application/namedRecordWrites'
import { NO_RECORDS, recordWithId } from '../../../../../shared/storage/domain/recordsRead'
import { useDisplayNames } from '../../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../../workbook/application/workbookStore'
import { categoryIdOf } from '../../../workbook/domain/workbook'
import { useRecordWrites } from '../../../../../shared/storage/presentation/useRecordWrites'
import { PACK_ROLES } from '../domain/packRoles'

/**
 * Whether loans to the owner and their repayments count as owner pay or as financing. The answer
 * lives on the categories tab, in the bucket of the categories with the two loan roles, so the
 * switch writes those cells and reads them back.
 */
const store = useWorkbook()
const names = useDisplayNames()
const writes = useRecordWrites(store)

const loanCategories = computed(() =>
  (store.state.workbook?.categories ?? []).filter((category) => category.roles.includes(PACK_ROLES.ownerLoanOut) || category.roles.includes(PACK_ROLES.ownerLoanRepaid)),
)
const countsAsPay = computed(() => loanCategories.value.length > 0 && loanCategories.value.every((category) => category.bucket === 'owner-pay'))
const mixed = computed(() => !countsAsPay.value && !loanCategories.value.every((category) => category.bucket === 'financing'))
const listed = computed(() => loanCategories.value.map((category) => `${names.value.category(category.slug)} (${category.bucket})`).join(' and '))

/** Writes the bucket of each loan category, as the app read it. */
async function choose(asPay: boolean): Promise<void> {
  const bucket = asPay ? 'owner-pay' : 'financing'
  const stored = loanCategories.value.flatMap((category) => recordWithId(store.state.records?.categories ?? NO_RECORDS, categoryIdOf(category)) ?? [])
  await writes.write(
    asPay ? 'Loans count as owner pay' : 'Loans count as financing',
    (unit) => stored.forEach(({ record }) => unit.of(CATEGORY_WRITES).change(record, { ...record, bucket })),
    {
      description: `The categories tab now puts ${loanCategories.value.map((category) => category.slug).join(' and ')} in the ${bucket} bucket.`,
      failedTitle: 'Not changed',
    },
  )
}
</script>

<template>
  <AppCard
    title="Loans to the owner"
    subtitle="From the categories tab: the bucket of the categories with the owner-loan-out and owner-loan-repaid roles."
    data-testid="loan-bucket"
  >
    <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
      <p v-if="loanCategories.length === 0" class="text-sm text-muted">No category carries the owner-loan-out or owner-loan-repaid role, so there is nothing to switch.</p>
      <template v-else>
        <USwitch
          :model-value="countsAsPay"
          :loading="writes.busy.value || store.state.writing"
          :disabled="writes.busy.value || store.state.writing"
          label="Loans to the owner count as owner pay"
          :description="
            countsAsPay
              ? 'On: a loan is pay taken early and its repayment pay handed back, so both count in owner pay, costs and net. Off moves both to financing, outside profit and loss.'
              : 'Off: loans and their repayments are financing, outside profit and loss. On moves both into owner pay, where they count in costs and net.'
          "
          @update:model-value="choose($event)"
        />
        <p v-if="mixed" class="mt-3 text-xs text-[var(--tone-warning)]">The loan categories sit in different buckets now: {{ listed }}. Switching puts both in one.</p>
      </template>
    </div>
  </AppCard>
</template>
