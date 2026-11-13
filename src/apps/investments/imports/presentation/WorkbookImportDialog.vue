<script lang="ts">
import type { WorkbookRows } from '../domain/importDryRun'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** A report already read, such as one from mail, in place of a file to pick. */
export interface ReportReview {
  readonly words: { readonly title: string; readonly description: string; readonly accept: string; readonly accepted: string; readonly notAccepted: string }
  readonly fileName: string
  readonly reading: WorkbookRows
  /** Keeps the keys of the rows the person left out for good, none or some, in the same write as Accept. */
  writeLeftOut(unit: UnitOfWork, keys: readonly string[]): void
}
</script>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { writeWorkbookImport } from '../application/workbookImport'
import ImportAccountsStep from './ImportAccountsStep.vue'
import ImportDryRunStep from './ImportDryRunStep.vue'
import ImportFileStep from './ImportFileStep.vue'
import ImportInstrumentsStep from './ImportInstrumentsStep.vue'
import ImportQuestionsStep from './ImportQuestionsStep.vue'
import ImportRatesStatus from './ImportRatesStatus.vue'
import { useWorkbookImport } from './useWorkbookImport'
import { words } from './words'
import type { ImportStep } from './words'
import { fetchAddedInBackground } from '../../prices/presentation/pricesStep'
import PricesProgress from '../../prices/presentation/PricesProgress.vue'
import { usePrices } from '../../prices/presentation/usePrices'
import { transactionCount } from '../../transactions/domain/listedTransactions'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'

/**
 * The portfolio workbook imported in steps: the file, its accounts, its holdings, the questions its rows leave, and the
 * dry run. Nothing is written until Import, which writes it all in one write, so one Undo takes it back. A report
 * already read starts past the file, and asks only for what its rows and Kuna's records do not answer.
 */
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  report?: ReportReview | null
}>()

const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const prices = usePrices()
const workbookImport = useWorkbookImport()
const { settled, ready, splitsLookup, closesLookup, splitVendor } = workbookImport
const step = ref<ImportStep>('file')
const triedQuestions = ref(false)
const triedAccounts = ref(false)

watch(open, (opened) => {
  if (opened) {
    if (props.report) void workbookImport.loadRows(props.report.fileName, props.report.reading)
    else workbookImport.forget()
    step.value = 'file'
    triedQuestions.value = false
    triedAccounts.value = false
  }
})

const steps = computed((): ImportStep[] => {
  const run = settled.value
  if (run === null) return props.report ? ['dry-run'] : ['file', 'accounts', 'instruments', 'questions', 'dry-run']
  const asks =
    run.splits.some((split) => split.listed === null) ||
    run.spinOffs.some((spinOff) => !spinOff.answeredByRow) ||
    (run.dryRun.report?.asked.length ?? 0) > 0 ||
    run.dryRun.questions.lookAlikes.length > 0
  if (props.report) {
    return [
      ...(run.accounts.some(({ question }) => question.known === null) ? ['accounts' as const] : []),
      ...(run.instruments.some(({ question }) => question.known === null && question.offer === null) ? ['instruments' as const] : []),
      ...(asks ? ['questions' as const] : []),
      'dry-run',
    ]
  }
  return ['file', ...(run.accounts.length > 0 ? ['accounts' as const] : []), ...(run.instruments.length > 0 ? ['instruments' as const] : []), ...(asks ? ['questions' as const] : []), 'dry-run']
})
/** A step the answers took away, such as questions answered by picking a holding Kuna has, gives way to the dry run. */
const shown = computed((): ImportStep => (steps.value.includes(step.value) ? step.value : props.report ? (steps.value[0] ?? 'dry-run') : 'dry-run'))
const place = computed(() => steps.value.indexOf(shown.value))

const startFaulted = computed(() => settled.value?.accounts.some((account) => account.choice.kind === 'new' && account.startFault !== null) ?? false)
const parentUnpicked = computed(() => settled.value?.spinOffs.some((spinOff) => !spinOff.answeredByRow && spinOff.parent === null) ?? false)

const top = ref<HTMLElement | null>(null)

/** Each step starts at its top, however far down the step before it was read. The first Next past a new account's start day Kuna cannot keep, or past a spin-off with no parent, stays and shows what is missing, and the second goes on and leaves it waiting. */
async function move(by: number): Promise<void> {
  if (by > 0 && shown.value === 'accounts' && startFaulted.value && !triedAccounts.value) {
    triedAccounts.value = true
    return
  }
  if (by > 0 && shown.value === 'questions' && parentUnpicked.value && !triedQuestions.value) {
    triedQuestions.value = true
    return
  }
  step.value = steps.value[place.value + by] ?? shown.value
  await nextTick()
  top.value?.scrollIntoView({ block: 'start' })
}

const toDelete = computed(() => settled.value?.dryRun.gone.filter((gone) => workbookImport.deleting.value.has(gone.record.id)) ?? [])
const leftOut = computed(() => Object.entries(workbookImport.choices.value.asked).flatMap(([key, choice]) => (choice === 'leave-out' ? [key] : [])))
const writesSomething = computed(() => {
  const added = settled.value?.dryRun.added
  const matched = settled.value?.dryRun.matched.length ?? 0
  return added !== undefined && (transactionCount(added) > 0 || added.accounts.length > 0 || added.instruments.length > 0 || matched > 0 || toDelete.value.length > 0 || leftOut.value.length > 0)
})

async function importWorkbook(): Promise<void> {
  const run = settled.value
  if (run === null || !writesSomething.value) return
  const deleting = toDelete.value
  const leaving = leftOut.value
  const { report } = props
  const written = await writes.write(
    report?.words.accepted ?? words.imported,
    (unit) => {
      writeWorkbookImport(unit, run.dryRun.added, run.dryRun.matched, deleting)
      if (report) report.writeLeftOut(unit, leaving)
    },
    { failedTitle: report?.words.notAccepted ?? words.notImported },
  )
  if (!written) return
  open.value = false
  fetchAddedInBackground(prices)
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="report?.words.title ?? words.title" :description="report?.words.description ?? words.description" width="3xl" :dismissible="!writes.busy.value">
    <div ref="top" class="flex flex-col gap-5" data-testid="workbook-import" :data-step="shown">
      <p class="type-label" aria-live="polite" data-testid="workbook-import-step">{{ words.stepOf(place + 1, steps.length, words.steps[shown]) }}</p>
      <div v-if="splitsLookup" class="flex flex-col gap-2" data-testid="import-splits-lookup">
        <p class="type-body">{{ words.questions.lookingUp(splitVendor) }}</p>
        <PricesProgress :fetching="splitsLookup" />
      </div>
      <div v-if="closesLookup" class="flex flex-col gap-2" data-testid="import-closes-lookup">
        <p class="type-body">{{ words.questions.lookingUpCloses }}</p>
        <PricesProgress :fetching="closesLookup" />
      </div>
      <ImportRatesStatus v-if="report" :workbook-import="workbookImport" />
      <ImportFileStep v-if="shown === 'file'" :workbook-import="workbookImport" />
      <ImportAccountsStep v-else-if="shown === 'accounts' && settled" :workbook-import="workbookImport" :settled="settled" :tried="triedAccounts" />
      <ImportInstrumentsStep v-else-if="shown === 'instruments' && settled" :workbook-import="workbookImport" :settled="settled" />
      <ImportQuestionsStep v-else-if="shown === 'questions' && settled" :workbook-import="workbookImport" :settled="settled" :tried="triedQuestions" />
      <ImportDryRunStep v-else-if="settled" :workbook-import="workbookImport" :settled="settled" :deleting="toDelete.length" />
    </div>
    <template #end>
      <UButton v-if="place > 0" :label="words.back" icon="i-lucide-arrow-left" color="neutral" variant="ghost" data-testid="workbook-import-back" @click="move(-1)" />
      <UButton :label="words.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton v-if="shown !== 'dry-run'" :label="words.next" trailing-icon="i-lucide-arrow-right" :disabled="!ready" data-testid="workbook-import-next" @click="move(1)" />
      <UButton
        v-else
        :label="report?.words.accept ?? words.import"
        icon="i-lucide-file-input"
        :loading="writes.saving('save')"
        :disabled="!writesSomething || writes.busy.value || writes.refused.value"
        data-testid="workbook-import-confirm"
        @click="importWorkbook"
      />
    </template>
  </AppDialog>
</template>
