<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { writeDryRun } from '../application/statementWrites'
import { statementOfFile, statementRecipesOf } from '../domain/recipeStatement'
import { syncGapOf } from '../domain/sourceDays'
import { statementDryRun } from '../domain/statementDryRun'
import { words as statementWords } from '../domain/words'
import DryRunLines from './DryRunLines.vue'
import { rowCaption, rowTitle, twinCaption } from './rowParts'
import type { RowQuestion } from './rowParts'
import MissingAccountsOffer from './MissingAccountsOffer.vue'
import FileHoldings from './FileHoldings.vue'
import { leftOutLine } from './leftOutLines'
import { addRevolutAccounts, fileNoteLine, refusalLine } from './readingLines'
import { words } from './words'
import AccountDialog from '../../accounts/presentation/AccountDialog.vue'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { loanTargets } from '../../links/application/loanRecords'
import { instalmentLinksOf } from '../../links/domain/instalmentSplit'
import { words as linkWords } from '../../links/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { Account } from '../../workbook/domain/account'
import { EURO } from '../../../../shared/money/currencyCode'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import { TWIN_CHOICES, twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinChoice } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { tableFileCells } from '../../../../shared/recipes/infrastructure/recipeFile'

/** A dropped file's dry run, worked out again as the file changes, so an Undo brings it back. Nothing is written until the button. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const picked = ref<File | null>(null)
const loading = ref(false)
const unreadable = ref<string | null>(null)
// Shallow, so the cells stay plain data.
const loaded = shallowRef<{ readonly name: string; readonly cells: readonly (readonly string[])[] } | null>(null)
/** What the person said of the file's rows that look like rows the AI copied, by the row's key. */
const twinAnswers = ref<Readonly<Record<string, TwinAnswer>>>({})

watch(picked, async (file) => {
  if (file === null) return
  loading.value = true
  unreadable.value = null
  loaded.value = null
  twinAnswers.value = {}
  try {
    loaded.value = { name: file.name, cells: await tableFileCells(file.name, await file.arrayBuffer()) }
  } catch (failure) {
    unreadable.value = words.import.unreadable(failure instanceof Error ? failure.message : String(failure))
  } finally {
    loading.value = false
  }
})

const reading = computed(() => {
  const book = store.state.workbook
  return book === null || loaded.value === null ? null : statementOfFile(statementRecipesOf(book), loaded.value.cells, loaded.value.name, book, statementWords.feeOn)
})
const refusal = computed(() => (reading.value !== null && 'refused' in reading.value ? refusalLine(reading.value.refused, reading.value.missing) : null))
const missing = computed(() => reading.value?.missing ?? [])
const holdings = computed(() => reading.value?.holdings ?? [])
const accounts = computed(() => store.state.workbook?.accounts ?? [])
/** What adding the missing accounts brings in: the whole file when it was refused for them, else the savings rows it leaves out. */
const missingTitle = computed(() => refusal.value ?? addRevolutAccounts(missing.value, 'savings'))
const statement = computed(() => (reading.value !== null && 'statement' in reading.value ? reading.value.statement : null))

/** The days the bank sync left in the file, which the days it brings start from. Null while the sync covers none of its days. */
const gap = computed(() => (store.state.workbook === null || statement.value === null ? null : syncGapOf(store.state.workbook.transactions, statement.value)))
const typedFrom = ref('')
const typedTo = ref('')
watch(
  () => (gap.value === null ? '' : `${gap.value.from} ${gap.value.to}`),
  () => {
    typedFrom.value = gap.value?.from ?? ''
    typedTo.value = gap.value?.to ?? ''
  },
)
/** The file's first and last day, which a cleared field takes once it is left. */
const fileDays = computed((): DateRange | null => {
  const days = (statement.value?.rows ?? []).map((row) => row.date).sort()
  return days.length === 0 ? null : { from: days[0]!, to: days[days.length - 1]! }
})
const backwards = computed(() => {
  const from = parseCivilDate(typedFrom.value)
  const to = parseCivilDate(typedTo.value)
  return from !== null && to !== null && to < from
})
/** The days the dry run takes: the typed ones, or the last ones typed in order while the last day comes before the first. */
const days = ref<DateRange | undefined>(undefined)
watch([typedFrom, typedTo, gap, fileDays], () => {
  if (gap.value === null || fileDays.value === null) {
    days.value = undefined
    return
  }
  const from = parseCivilDate(typedFrom.value)
  const to = parseCivilDate(typedTo.value)
  if (from === null) typedFrom.value = fileDays.value.from
  else if (to === null) typedTo.value = fileDays.value.to
  else if (from <= to) days.value = { from, to }
})

/** The Loans file's records, so a new row that pays an instalment comes in linked to it. While Loans opens, failed or is not set up, none is linked, and a row a rule whose rows pay a loan decides waits. */
const loans = computed(() => loanTargets())
/** Why the import links no row to an instalment while Loans is set up, or null when it reads Loans. */
const loansUnread = computed(() => (typeof loans.value === 'string' && (dryRun.value?.newRows ?? 0) > 0 ? words.import.loansUnread[loans.value] : null))
const dryRun = computed(() => {
  const book = store.state.workbook
  if (book === null || statement.value === null) return null
  return statementDryRun(
    book,
    { ...statement.value, twinAnswers: new Map(Object.entries(twinAnswers.value)), days: days.value },
    today(),
    instalmentLinksOf(loans.value, { language, notes: linkWords.notes }),
  )
})

/** The account whose settings a left-out line opens, so it can take the bank's statement file. */
const allowing = ref<Account | null>(null)
const allowingOpen = computed({
  get: () => allowing.value !== null,
  set: (open: boolean) => {
    if (!open) allowing.value = null
  },
})
/** Each line of what the file and the dry run left out, with the account a line's action opens, or null for a line with none. */
const notes = computed(() => {
  const run = dryRun.value
  if (run === null) return []
  const plain = (line: string) => ({ line, account: null })
  return [
    ...run.fileNotes.map((note) => plain(fileNoteLine(note))),
    ...run.leftOut.map((left) => ({ line: leftOutLine(left, accounts.value), account: left.kind === 'not-taken' ? (accounts.value.find((account) => account.id === left.account) ?? null) : null })),
    ...run.notes.map(plain),
  ]
})

const twinItems = computed(() => {
  const accounts = new Map((store.state.workbook?.accounts ?? []).map((account) => [account.id, account]))
  return (dryRun.value?.questions ?? []).map((question): RowQuestion<TwinChoice> => {
    const account = accounts.get(question.row.account)
    return {
      key: question.key,
      row: rowTitle(question.row),
      caption: rowCaption(question.row, account),
      note: twinCaption(question.booked, account),
      choice: question.keep ?? 'later',
      amount: question.row.amount,
      currency: account?.currency ?? EURO,
    }
  })
})

function answerTwin(key: string, choice: TwinChoice): void {
  const question = dryRun.value?.questions.find((asked) => asked.key === key)
  if (question === undefined) return
  const { [key]: _answered, ...others } = twinAnswers.value
  twinAnswers.value = choice === 'later' ? others : { ...others, [key]: { booked: question.booked.id, keep: choice } }
}
const changes = computed(() => (dryRun.value === null ? 0 : dryRun.value.added.length + dryRun.value.changed.length + (dryRun.value.pending?.gone.length ?? 0)))

async function confirm(): Promise<void> {
  const run = dryRun.value
  const records = store.state.records
  if (run !== null && records !== null) await writes.write(words.import.imported, (unit) => writeDryRun(unit, records, run), { key: 'import', failedTitle: words.import.notImported })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <AppCard :title="words.import.title" :subtitle="words.import.subtitle">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5" data-testid="spending-import-file">
        <FileDrop v-model="picked" accept=".xlsx,.csv" :label="words.import.drop" :description="words.import.orChoose" />
        <p v-if="loading" class="flex items-center gap-2 type-aside">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
          {{ words.import.reading }}
        </p>
        <FileHoldings v-if="holdings.length > 0" :holdings="holdings" :accounts="accounts" />
        <MissingAccountsOffer v-if="missing.length > 0" :title="missingTitle" :missing="missing" />
        <UAlert v-else-if="unreadable !== null || refusal !== null" icon="i-lucide-file-x" color="error" variant="subtle" :title="unreadable ?? refusal ?? ''" data-testid="spending-import-refused" />
      </div>
    </AppCard>
    <AppCard v-if="dryRun !== null && loaded !== null" :title="loaded.name" data-testid="spending-dry-run">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
        <section v-if="days !== undefined && fileDays !== null" class="flex flex-col gap-1" data-testid="spending-import-days">
          <h3 class="type-label">{{ words.import.days.title }}</h3>
          <p class="type-caption">{{ words.import.days.intro }}</p>
          <FormGrid class="mt-2">
            <UFormField :label="words.import.days.from">
              <DayField v-model="typedFrom" :min="fileDays.from" :max="fileDays.to" class="w-full" data-testid="spending-import-days-from" />
            </UFormField>
            <UFormField :label="words.import.days.to" :error="backwards ? words.import.days.backwards : false">
              <DayField v-model="typedTo" :min="fileDays.from" :max="fileDays.to" class="w-full" data-testid="spending-import-days-to" />
            </UFormField>
          </FormGrid>
        </section>
        <p class="type-row-title" data-testid="spending-dry-run-summary">{{ words.import.summary(dryRun.newRows, dryRun.alreadyIn, dryRun.filled) }}</p>
        <ul v-if="notes.length > 0 || loansUnread !== null" class="flex flex-col gap-1 type-aside" data-testid="spending-dry-run-notes">
          <li v-for="note in notes" :key="note.line" class="flex flex-col items-start gap-1">
            {{ note.line }}
            <UButton
              v-if="note.account !== null"
              :label="words.import.letFilesFill(note.account.name)"
              variant="link"
              icon="i-lucide-settings"
              class="p-0"
              data-testid="spending-dry-run-allow-files"
              @click="allowing = note.account"
            />
          </li>
          <li v-if="loansUnread !== null" data-testid="spending-dry-run-loans-unread">{{ loansUnread }}</li>
        </ul>
        <QuestionList
          v-if="twinItems.length > 0"
          :items="twinItems"
          :options="TWIN_CHOICES.file"
          :label="twinWords.choice"
          :heading="twinWords.title"
          :intro="twinWords.intro.file"
          @answer="answerTwin"
        >
          <template #amount="{ item }">
            <AccountMoneyText :cents="item.amount" :currency="item.currency" tone="flow" />
          </template>
        </QuestionList>
        <DryRunLines :lines="dryRun.lines" :added="dryRun.categories" :below-questions="twinItems.length > 0" />
        <UButton
          v-if="changes > 0"
          class="self-start"
          :label="plural(words.import.confirm(changes), changes)"
          icon="i-lucide-file-down"
          :loading="writes.saving('import')"
          data-testid="spending-import-confirm"
          @click="confirm"
        />
        <p v-else class="type-aside" data-testid="spending-import-nothing">{{ words.import.nothing }}</p>
      </div>
    </AppCard>
    <AccountDialog v-model:open="allowingOpen" :account="allowing" />
  </div>
</template>
