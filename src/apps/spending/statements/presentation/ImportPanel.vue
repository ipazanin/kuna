<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { writeDryRun } from '../application/statementWrites'
import { addRevolutAccounts, revolutStatement } from '../domain/revolutStatement'
import { statementDryRun } from '../domain/statementDryRun'
import DryRunLines from './DryRunLines.vue'
import { rowParts, twinCaption } from './rowParts'
import MissingAccountsOffer from './MissingAccountsOffer.vue'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { today } from '../../../../shared/calendar/civilDate'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import type { QuestionItem } from '../../../../shared/ui/QuestionList.vue'
import { TWIN_CHOICES, twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinChoice } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import { readFirstSheet } from '../../../../shared/xlsx/sheetGrids'

/** A dropped file's dry run, worked out again as the file changes, so an Undo brings it back. Nothing is written until the button. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const picked = ref<File | null>(null)
const loading = ref(false)
const unreadable = ref<string | null>(null)
// Shallow, so the cells stay plain data.
const loaded = shallowRef<{ readonly name: string; readonly grid: Awaited<ReturnType<typeof readFirstSheet>> } | null>(null)
/** What the person said of the file's rows that look like rows the AI copied, by the row's key. */
const twinAnswers = ref<Readonly<Record<string, TwinAnswer>>>({})

watch(picked, async (file) => {
  if (file === null) return
  loading.value = true
  unreadable.value = null
  loaded.value = null
  twinAnswers.value = {}
  try {
    // A csv stays text, so its cells stay as written.
    const grid = await readFirstSheet(file.name.toLowerCase().endsWith('.csv') ? await file.text() : await file.arrayBuffer())
    loaded.value = { name: file.name, grid }
  } catch (failure) {
    unreadable.value = words.import.unreadable(failure instanceof Error ? failure.message : String(failure))
  } finally {
    loading.value = false
  }
})

const reading = computed(() => {
  const book = store.state.workbook
  return book === null || loaded.value === null ? null : revolutStatement(loaded.value.grid, loaded.value.name, book)
})
const refusal = computed(() => (reading.value !== null && 'refusal' in reading.value ? reading.value.refusal : null))
const missing = computed(() => reading.value?.missing ?? [])
const dryRun = computed(() => {
  const book = store.state.workbook
  if (book === null || reading.value === null || !('statement' in reading.value)) return null
  return statementDryRun(book, { ...reading.value.statement, twinAnswers: new Map(Object.entries(twinAnswers.value)) }, today())
})

const twinItems = computed(() => {
  const accounts = new Map((store.state.workbook?.accounts ?? []).map((account) => [account.id, account]))
  return (dryRun.value?.questions ?? []).map((question): QuestionItem<TwinChoice> => {
    const account = accounts.get(question.row.account)
    const row = [...rowParts(question.row, account), account?.name ?? ''].filter((part) => part !== '').join(' · ')
    return { key: question.key, row, caption: twinCaption(question.booked, account), choice: question.keep ?? 'later' }
  })
})

function answerTwin(key: string, choice: TwinChoice): void {
  const question = dryRun.value?.questions.find((asked) => asked.key === key)
  if (question === undefined) return
  const { [key]: _answered, ...others } = twinAnswers.value
  twinAnswers.value = choice === 'later' ? others : { ...others, [key]: { booked: question.booked.id, keep: choice } }
}
const changes = computed(() => (dryRun.value === null ? 0 : dryRun.value.added.length + dryRun.value.changed.length))

async function confirm(): Promise<void> {
  const run = dryRun.value
  if (run !== null) await writes.write(words.import.imported, (unit) => writeDryRun(unit, run), { key: 'import', failedTitle: words.import.notImported })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <AppCard :title="words.import.title" :subtitle="words.import.subtitle">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5" data-testid="spending-import-file">
        <FileDrop v-model="picked" accept=".xlsx,.csv" :label="words.import.drop" :description="words.import.orChoose" />
        <p v-if="loading" class="flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
          {{ words.import.reading }}
        </p>
        <MissingAccountsOffer v-if="refusal !== null && missing.length > 0" :title="refusal" :missing="missing" />
        <UAlert v-else-if="unreadable !== null || refusal !== null" icon="i-lucide-file-x" color="error" variant="subtle" :title="unreadable ?? refusal ?? ''" data-testid="spending-import-refused" />
      </div>
    </AppCard>
    <AppCard v-if="dryRun !== null && loaded !== null" :title="loaded.name" data-testid="spending-dry-run">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
        <p class="text-sm text-highlighted" data-testid="spending-dry-run-summary">{{ words.import.summary(dryRun.newRows, dryRun.alreadyIn, dryRun.filled) }}</p>
        <ul v-if="dryRun.notes.length > 0" class="flex flex-col gap-1 text-sm text-muted" data-testid="spending-dry-run-notes">
          <li v-for="note in dryRun.notes" :key="note">{{ note }}</li>
        </ul>
        <MissingAccountsOffer v-if="missing.length > 0" :title="addRevolutAccounts(missing, 'savings')" :missing="missing" />
        <QuestionList
          v-if="twinItems.length > 0"
          :items="twinItems"
          :options="TWIN_CHOICES.file"
          :label="twinWords.choice"
          :heading="twinWords.title"
          :intro="twinWords.intro.file"
          @answer="answerTwin"
        />
        <DryRunLines :lines="dryRun.lines" />
        <UButton
          v-if="changes > 0"
          class="self-start"
          :label="plural(words.import.confirm(changes), changes)"
          icon="i-lucide-file-down"
          :loading="writes.saving('import')"
          data-testid="spending-import-confirm"
          @click="confirm"
        />
        <p v-else class="text-sm text-muted" data-testid="spending-import-nothing">{{ words.import.nothing }}</p>
      </div>
    </AppCard>
  </div>
</template>
