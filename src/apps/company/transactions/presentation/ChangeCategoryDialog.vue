<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { fileRows } from '../../review/application/fileRows'
import { recategorisation } from '../../review/domain/verdictChanges'
import { ruleAgainst } from '../../rules/domain/ruleCoverage'
import { categorisationContextOf } from '../../rules/domain/transactionFacts'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import CategoryChip from './CategoryChip.vue'
import CategoryPicker from './CategoryPicker.vue'

/**
 * Files a settled ledger row in another category. It writes the row's category and `flagged_by`
 * with the review label, as a confirmation on Review does, and says first when a rule files such
 * rows elsewhere, since the row then shows on Review's Rules tab among the rule's exceptions.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  row: Transaction
}>()

const { state } = useWorkbook()
const router = useRouter()
const writes = useRecordWrites(useWorkbook())
const names = useDisplayNames()
const phone = usePhoneLayout()

const picked = ref<string | undefined>(undefined)
watch(open, (opened) => {
  if (opened) picked.value = undefined
})

const categories = computed(() => state.workbook?.categories ?? [])
const reviewLabel = computed(() => state.workbook?.settings.reviewLabel ?? '')
const changed = computed(() => picked.value !== undefined && picked.value !== '' && picked.value !== props.row.category)

const against = computed(() => {
  const workbook = state.workbook
  return workbook === null || !changed.value ? null : ruleAgainst(props.row, picked.value as string, workbook.rules, categorisationContextOf(workbook))
})

const settledBy = computed(() => (isHumanConfirmed(props.row) ? `Confirmed by ${props.row.flaggedBy}` : 'Filed by a rule'))

async function change(): Promise<void> {
  const workbook = state.workbook
  const category = picked.value
  if (workbook === null || category === undefined || !changed.value) return
  const contradicting = against.value
  const verdict = recategorisation(props.row, category, workbook.settings)
  const written = await writes.write(`Filed as ${names.value.category(category)}`, (unit) => fileRows(unit, state.records?.ledger ?? NO_RECORDS, [verdict], workbook.categories), {
    failedTitle: 'Not written',
    description: props.row.counterparty || 'A row with no counterparty',
    ...(contradicting === null
      ? {}
      : { follow: { label: 'Open the rule', icon: 'i-lucide-list-ordered', run: () => void router.push({ path: '/company/review', query: { tab: 'rules', rule: contradicting.ruleId } }) } }),
  })
  if (written) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Change the category"
    :description="`${row.counterparty || 'No counterparty'}, ${dayLabel(row.date)}`"
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="change-category">
        <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span class="flex min-w-0 flex-wrap items-center gap-2">
            <CategoryChip :category="row.category" :bucket="row.bucket" />
            <span class="text-xs text-muted">{{ settledBy }}</span>
          </span>
          <MoneyText :cents="row.amount" tone="flow" class="font-medium" />
        </div>
        <p v-if="row.description" class="text-sm text-toned">{{ row.description }}</p>
        <CategoryPicker v-model="picked" :categories="categories" placeholder="Choose the new category" class="w-full" data-testid="change-category-picker" />
        <p v-if="against" class="flex items-start gap-2 text-sm text-toned" data-testid="rule-against">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
          <span>
            The rule <span class="identifier">{{ against.ruleId }}</span> files rows like this one as {{ names.category(against.category) }}. Once this row says
            {{ names.category(picked ?? '') }}, Review lists it on its Rules tab among the rows the rule files differently.
          </span>
        </p>
        <p class="text-xs text-muted">
          Writes the new category and <span class="identifier">flagged_by</span> {{ reviewLabel }} on the row, with Undo in the toast.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          label="Change category"
          icon="i-lucide-check"
          :loading="writes.busy.value"
          :disabled="!changed || writes.busy.value || state.writing"
          data-testid="change-category-save"
          @click="change"
        />
      </div>
    </template>
  </UModal>
</template>
