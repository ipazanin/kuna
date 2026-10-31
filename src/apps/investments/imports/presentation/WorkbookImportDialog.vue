<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { writeWorkbookImport } from '../application/workbookImport'
import ImportAccountsStep from './ImportAccountsStep.vue'
import ImportDryRunStep from './ImportDryRunStep.vue'
import ImportFileStep from './ImportFileStep.vue'
import ImportInstrumentsStep from './ImportInstrumentsStep.vue'
import ImportQuestionsStep from './ImportQuestionsStep.vue'
import { useWorkbookImport } from './useWorkbookImport'
import { words } from './words'
import type { ImportStep } from './words'
import { transactionCount } from '../../transactions/domain/listedTransactions'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'

/**
 * The portfolio workbook imported in steps: the file, its accounts, its holdings, the questions its rows leave, and the
 * dry run. Nothing is written until Import, which writes it all in one write, so one Undo takes it back.
 */
const open = defineModel<boolean>('open', { required: true })

const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const workbookImport = useWorkbookImport()
const { settled, reading } = workbookImport
const step = ref<ImportStep>('file')

watch(open, (opened) => {
  if (opened) {
    workbookImport.forget()
    step.value = 'file'
  }
})

const steps = computed((): ImportStep[] => {
  const run = settled.value
  if (run === null) return ['file', 'accounts', 'instruments', 'questions', 'dry-run']
  const asks = run.splits.length + run.spinOffs.length + run.netDividends.length > 0
  return ['file', ...(run.accounts.length > 0 ? ['accounts' as const] : []), ...(run.instruments.length > 0 ? ['instruments' as const] : []), ...(asks ? ['questions' as const] : []), 'dry-run']
})
/** A step the answers took away, such as questions answered by picking a holding Kuna has, gives way to the dry run. */
const shown = computed((): ImportStep => (steps.value.includes(step.value) ? step.value : 'dry-run'))
const place = computed(() => steps.value.indexOf(shown.value))

const top = ref<HTMLElement | null>(null)

/** Each step starts at its top, however far down the step before it was read. */
async function move(by: number): Promise<void> {
  step.value = steps.value[place.value + by] ?? shown.value
  await nextTick()
  top.value?.scrollIntoView({ block: 'start' })
}

const toDelete = computed(() => settled.value?.dryRun.gone.filter((gone) => workbookImport.deleting.value.has(gone.record.id)) ?? [])
const writesSomething = computed(() => {
  const added = settled.value?.dryRun.added
  return added !== undefined && (transactionCount(added) > 0 || added.accounts.length > 0 || added.instruments.length > 0 || toDelete.value.length > 0)
})

async function importWorkbook(): Promise<void> {
  const run = settled.value
  if (run === null || !writesSomething.value) return
  const deleting = toDelete.value
  if (await writes.write(words.imported, (unit) => writeWorkbookImport(unit, run.dryRun.added, deleting), { failedTitle: words.notImported })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="words.title" :description="words.description" width="3xl" :dismissible="!writes.busy.value">
    <div ref="top" class="flex flex-col gap-5" data-testid="workbook-import" :data-step="shown">
      <p class="type-label" aria-live="polite" data-testid="workbook-import-step">{{ words.stepOf(place + 1, steps.length, words.steps[shown]) }}</p>
      <ImportFileStep v-if="shown === 'file'" :workbook-import="workbookImport" />
      <ImportAccountsStep v-else-if="shown === 'accounts' && settled" :workbook-import="workbookImport" :settled="settled" />
      <ImportInstrumentsStep v-else-if="shown === 'instruments' && settled" :workbook-import="workbookImport" :settled="settled" />
      <ImportQuestionsStep v-else-if="shown === 'questions' && settled" :workbook-import="workbookImport" :settled="settled" />
      <ImportDryRunStep v-else-if="settled" :workbook-import="workbookImport" :settled="settled" :deleting="toDelete.length" />
    </div>
    <template #end>
      <UButton v-if="place > 0" :label="words.back" icon="i-lucide-arrow-left" color="neutral" variant="ghost" :disabled="writes.busy.value" data-testid="workbook-import-back" @click="move(-1)" />
      <UButton :label="words.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton v-if="shown !== 'dry-run'" :label="words.next" trailing-icon="i-lucide-arrow-right" :disabled="reading === null" data-testid="workbook-import-next" @click="move(1)" />
      <UButton
        v-else
        :label="words.import"
        icon="i-lucide-file-input"
        :loading="writes.busy.value"
        :disabled="!writesSomething || writes.busy.value"
        data-testid="workbook-import-confirm"
        @click="importWorkbook"
      />
    </template>
  </AppDialog>
</template>
