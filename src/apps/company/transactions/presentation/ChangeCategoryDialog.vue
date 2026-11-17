<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { fileRows } from '../application/fileRows'
import { recategorisation } from '../domain/verdictChanges'
import { invoicesRefiledOff } from '../../receivables/domain/invoicePayments'
import { ruleAgainst } from '../../rules/domain/ruleCoverage'
import { categorisationContextOf } from '../../rules/domain/categorisationContext'
import { categoryRuleLink } from '../../rules/presentation/ruleLinks'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { isHumanConfirmed } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import CategoryChip from './CategoryChip.vue'
import CategoryPicker from './CategoryPicker.vue'
import { words } from './words'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import LabelsSelect from '../../../../shared/ui/LabelsSelect.vue'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { relabelItem } from '../../labels/application/labelWrites'
import { useTypedLabels } from '../../labels/presentation/useTypedLabels'
import { storedItemsOfRow, storesItems } from '../../workbook/domain/rowItems'

/**
 * Files a settled ledger row in another category. It writes the row's category and `flagged_by`
 * with the review label, as a confirmation on the To review tab does, and says first when a rule files such
 * rows elsewhere, since the row then shows on Settings, Category rules among the rule's exceptions. A row of one item
 * takes its labels here too, and a change of labels alone leaves who filed it as it is.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  row: Transaction
}>()

const { state } = useWorkbook()
const router = useRouter()
const writes = useRecordWrites(useWorkbook())
const names = useDisplayNames()

const picked = ref<string | undefined>(undefined)
const typed = useTypedLabels()

/** The row's one item on the items tab, which carries its labels, or null for a row of several items or books from before items. */
const item = computed(() => {
  const records = state.records
  if (records === null || !storesItems(records)) return null
  const items = storedItemsOfRow(records.items, props.row)
  return items.length === 1 ? items[0]! : null
})
const labels = ref<readonly RecordId[]>([])

watch(
  open,
  (opened) => {
    if (!opened) return
    picked.value = undefined
    labels.value = item.value?.labels ?? []
    typed.forget()
  },
  { immediate: true },
)

const categories = computed(() => state.workbook?.categories ?? [])
const reviewLabel = computed(() => state.workbook?.settings.reviewLabel ?? '')
const changed = computed(() => picked.value !== undefined && picked.value !== '' && picked.value !== props.row.category)
const relabelled = computed(() => {
  const held = item.value?.labels ?? []
  return held.length !== labels.value.length || held.some((label) => !labels.value.includes(label))
})

const against = computed(() => {
  const workbook = state.workbook
  return workbook === null || !changed.value ? null : ruleAgainst(props.row, picked.value as string, workbook.rules, categorisationContextOf(workbook))
})

async function change(): Promise<void> {
  const { records, workbook } = state
  const category = picked.value
  if (workbook === null || workbook === undefined || records === null || records === undefined) return
  const kept = labels.value
  const carried = new Set(kept)
  const held = item.value
  if (!changed.value || category === undefined) {
    if (held === null || !relabelled.value) return
    const relabelledOnly = await writes.write(
      words.changeDialog.labelsSaved,
      (unit) => {
        typed.addCarried(unit, carried)
        relabelItem(unit, records, held, kept)
      },
      { failedTitle: words.changeDialog.notWritten, description: props.row.counterparty || words.changeDialog.noCounterpartyRow },
    )
    if (relabelledOnly) open.value = false
    return
  }
  const contradicting = against.value
  const verdict = recategorisation(props.row, category, workbook.settings)
  const offInvoices = invoicesRefiledOff(workbook, props.row, category).map((invoice) => invoice.number)
  const work = (unit: Parameters<typeof fileRows>[0]) => {
    typed.addCarried(unit, carried)
    fileRows(unit, { records, workbook }, [verdict], workbook.categories, held === null || !relabelled.value ? new Map() : new Map([[props.row.id, kept]]))
  }
  const written = await writes.write(words.changeDialog.filedAs(names.value.category(category), offInvoices), work, {
    failedTitle: words.changeDialog.notWritten,
    description: props.row.counterparty || words.changeDialog.noCounterpartyRow,
    ...(contradicting === null
      ? {}
      : {
          follow: { label: words.changeDialog.openRule, icon: 'i-lucide-list-ordered', run: () => void router.push(categoryRuleLink(contradicting.ruleId)) },
        }),
  })
  if (written) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    changes
    :title="item === null ? words.changeDialog.title : words.changeDialog.titleWithLabels"
    :description="words.changeDialog.description(row.counterparty, dayLabel(row.date))"
  >
    <div class="flex flex-col gap-4" data-testid="change-category">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span class="flex min-w-0 flex-wrap items-center gap-2">
          <CategoryChip :category="row.category" :bucket="row.bucket" />
          <span v-if="isHumanConfirmed(row)" class="text-xs text-muted"
            >{{ words.changeDialog.confirmedBy }} <span class="identifier">{{ row.flaggedBy }}</span></span
          >
          <span v-else class="text-xs text-muted">{{ words.changeDialog.filedByRule }}</span>
        </span>
        <MoneyText :cents="row.amount" tone="flow" class="font-medium" />
      </div>
      <p v-if="row.description" class="text-sm text-toned">{{ row.description }}</p>
      <UFormField :label="words.changeDialog.category">
        <CategoryPicker v-model="picked" :categories="categories" :placeholder="words.changeDialog.newCategory" class="w-full" data-testid="change-category-picker" />
      </UFormField>
      <UFormField v-if="item !== null" :label="words.changeDialog.labels" :error="typed.refused.value ?? false">
        <LabelsSelect v-model="labels" :labels="typed.choices.value" :name="words.changeDialog.labels" class="w-full" @create="labels = typed.withTyped(labels, $event)" />
      </UFormField>
      <NoteLine v-if="against" size="body" tone="warning" data-testid="rule-against">
        {{ words.changeDialog.ruleAgainst.before }} <span class="identifier">{{ against.ruleId }}</span>
        {{ words.changeDialog.ruleAgainst.after(names.category(against.category), names.category(picked ?? '')) }}
      </NoteLine>
      <p v-if="changed || !relabelled" class="text-xs text-muted">
        {{ words.changeDialog.writes.before }} <span class="identifier">flagged_by</span> {{ words.changeDialog.writes.after(reviewLabel) }}
      </p>
    </div>
    <template #end>
      <UButton :label="words.changeDialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        :label="item === null ? words.changeDialog.change : words.changeDialog.save"
        icon="i-lucide-check"
        :loading="writes.saving('save')"
        :disabled="!(changed || relabelled) || writes.busy.value || writes.refused.value"
        data-testid="change-category-save"
        @click="change"
      />
    </template>
  </AppDialog>
</template>
