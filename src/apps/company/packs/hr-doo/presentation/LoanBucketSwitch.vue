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
import { listInWords } from '../../../../../shared/text/listInWords'
import { PACK_ROLES } from '../domain/packRoles'
import { words } from './words'

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
const listed = computed(() => listInWords(loanCategories.value.map((category) => words.loanBucket.inBucket(names.value.category(category.slug), category.bucket))))

/** Writes the bucket of each loan category, as the app read it. */
async function choose(asPay: boolean): Promise<void> {
  const bucket = asPay ? 'owner-pay' : 'financing'
  const stored = loanCategories.value.flatMap((category) => recordWithId(store.state.records?.categories ?? NO_RECORDS, categoryIdOf(category)) ?? [])
  await writes.write(
    asPay ? words.loanBucket.countAsPay : words.loanBucket.countAsFinancing,
    (unit) => stored.forEach(({ record }) => unit.of(CATEGORY_WRITES).change(record, { ...record, bucket })),
    {
      description: words.loanBucket.moved(listInWords(loanCategories.value.map((category) => category.slug)), bucket),
      failedTitle: words.loanBucket.notChanged,
    },
  )
}
</script>

<template>
  <AppCard :title="words.loanBucket.title" :subtitle="words.loanBucket.subtitle" data-testid="loan-bucket">
    <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
      <p v-if="loanCategories.length === 0" class="text-sm text-muted">{{ words.loanBucket.none }}</p>
      <template v-else>
        <USwitch
          :model-value="countsAsPay"
          :loading="writes.busy.value || store.state.writing"
          :disabled="writes.busy.value || store.state.writing"
          :label="words.loanBucket.label"
          :description="countsAsPay ? words.loanBucket.on : words.loanBucket.off"
          @update:model-value="choose($event)"
        />
        <p v-if="mixed" class="mt-3 text-xs text-warning">{{ words.loanBucket.mixed(listed) }}</p>
      </template>
    </div>
  </AppCard>
</template>
