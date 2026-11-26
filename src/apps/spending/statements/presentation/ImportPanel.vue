<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { importGivingDays } from '../application/statementWrites'
import { statementOfFile, statementRecipesOf } from '../domain/recipeStatement'
import { bookWithGivenDays, givenDays } from '../domain/givenDays'
import type { GivenDays } from '../domain/givenDays'
import { statementDryRun } from '../domain/statementDryRun'
import { words as statementWords } from '../domain/words'
import DryRunLines from './DryRunLines.vue'
import { rowCaption, rowTitle, twinCaption } from './rowParts'
import type { RowQuestion } from './rowParts'
import MissingAccountsOffer from './MissingAccountsOffer.vue'
import FileHoldings from './FileHoldings.vue'
import RecipeMisfitActions from './RecipeMisfitActions.vue'
import { leftOutLine } from './leftOutLines'
import { addMissingAccounts, fileNoteLine, refusalLine } from './readingLines'
import { words } from './words'
import AccountDialog from '../../accounts/presentation/AccountDialog.vue'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { loanTargets } from '../../links/application/loanRecords'
import { ruleLinksOf } from '../../links/domain/linkFiling'
import { ruleAssets } from '../../links/application/assetTargets'
import { words as linkWords } from '../../links/presentation/words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { today } from '../../../../shared/calendar/civilDate'
import { dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import type { Account } from '../../workbook/domain/account'
import type { LeftOut } from '../domain/leftOut'
import type { TableCells } from '../../../../shared/recipes/domain/tableRows'
import { EURO } from '../../../../shared/money/currencyCode'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import { TWIN_CHOICES, twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinChoice } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { language } from '../../../../shared/text/language'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import { fileEndingsOf, tableFileCells } from '../../../../shared/recipes/infrastructure/recipeFile'

/** A dropped file's dry run, worked out again as the file changes, so an Undo brings it back. Nothing is written until the button. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const picked = ref<File | null>(null)
const loading = ref(false)
const unreadable = ref<string | null>(null)
// Shallow, so the cells stay plain data.
const loaded = shallowRef<{ readonly name: string; readonly cells: TableCells } | null>(null)
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
const missingTitle = computed(() => refusal.value ?? addMissingAccounts(missing.value, 'savings'))
const statement = computed(() => (reading.value !== null && 'statement' in reading.value ? reading.value.statement : null))

/** The accounts whose days the person gives to the statement file with this import, by id. */
const giving = ref<ReadonlySet<string>>(new Set())
watch(statement, () => {
  giving.value = new Set()
})

/** The Loans file's records, so a new row that pays an instalment comes in linked to it. While Loans opens, failed or is not set up, none is linked, and a row a rule whose rows pay a loan decides waits. */
const loans = computed(() => loanTargets())
/** Why the import links no row to an instalment while Loans is set up, or null when it reads Loans. */
const loansUnread = computed(() => (typeof loans.value === 'string' && (dryRun.value?.newRows ?? 0) > 0 ? words.import.loansUnread[loans.value] : null))
/** The dry run as the file stands, whose left-out rows offer their days to the statement file. */
const firstRun = computed(() => {
  const book = store.state.workbook
  if (book === null || statement.value === null) return null
  return statementDryRun(book, { ...statement.value, twinAnswers: new Map(Object.entries(twinAnswers.value)) }, today(), ruleLinksOf(loans.value, { language, notes: linkWords.notes }, ruleAssets()))
})
/** The days the person gives to the statement file, each with the rows that go from the source that had them. */
const given = computed((): readonly GivenDays[] => {
  const book = store.state.workbook
  if (book === null || firstRun.value === null) return []
  const offered = firstRun.value.leftOut.flatMap((left) => (left.kind === 'not-taken' && left.offer !== null && giving.value.has(left.account) ? [left] : []))
  // An account gives the days of its first offer, since a second would change the periods the first was worked out from.
  return offered.filter((left, place) => offered.findIndex((other) => other.account === left.account) === place).flatMap((left) => givenDays(book, left) ?? [])
})
/** The dry run with those days given, which the import writes. */
const dryRun = computed(() => {
  const book = store.state.workbook
  if (book === null || statement.value === null || given.value.length === 0) return firstRun.value
  return statementDryRun(
    bookWithGivenDays(book, given.value),
    { ...statement.value, twinAnswers: new Map(Object.entries(twinAnswers.value)) },
    today(),
    ruleLinksOf(loans.value, { language, notes: linkWords.notes }, ruleAssets()),
  )
})

/** The account whose dialog a left-out line opens, so it can start earlier. */
const allowing = ref<Account | null>(null)
const allowingOpen = computed({
  get: () => allowing.value !== null,
  set: (open: boolean) => {
    if (!open) allowing.value = null
  },
})
/** A line of what the file and the dry run left out, with what its action does: give the days to the statement file, keep them, or open the account to start it earlier. */
interface DryRunNote {
  readonly line: string
  readonly action: { readonly label: string; readonly icon: string; readonly run: () => void; readonly test: string } | null
}

function giveDays(account: string, give: boolean): void {
  const next = new Set(giving.value)
  if (give) next.add(account)
  else next.delete(account)
  giving.value = next
}

function leftOutNote(left: LeftOut): DryRunNote {
  const account = accounts.value.find((one) => one.id === ('account' in left ? left.account : null)) ?? null
  if (left.kind === 'before-opening' && account !== null)
    return {
      line: leftOutLine(left, accounts.value),
      action: {
        label: words.import.startEarlier(account.name),
        icon: 'i-lucide-calendar',
        run: () => {
          allowing.value = account
        },
        test: 'spending-dry-run-start-earlier',
      },
    }
  if (left.kind !== 'not-taken' || left.offer === null || account === null) return { line: leftOutLine(left, accounts.value), action: null }
  return {
    line: leftOutLine(left, accounts.value),
    action: { label: words.import.giveToFile(dayRangeLabel(left.days)), icon: 'i-lucide-file-down', run: () => giveDays(left.account, true), test: 'spending-dry-run-give-days' },
  }
}

/** The days given, each with the way back, in place of the left-out line it answered. */
function givenNote(one: GivenDays): DryRunNote {
  const left = firstRun.value?.leftOut.find((each) => each.kind === 'not-taken' && each.account === one.account.id)
  const days = left?.kind === 'not-taken' ? dayRangeLabel(left.days) : ''
  return {
    line: words.import.givenToFile(one.account.name, days),
    action: { label: words.import.keepSource, icon: 'i-lucide-undo-2', run: () => giveDays(one.account.id, false), test: 'spending-dry-run-keep-days' },
  }
}

const notes = computed((): readonly DryRunNote[] => {
  const run = dryRun.value
  if (run === null) return []
  const plain = (line: string): DryRunNote => ({ line, action: null })
  return [...run.fileNotes.map((note) => plain(fileNoteLine(note))), ...given.value.map(givenNote), ...run.leftOut.map(leftOutNote), ...run.notes.map(plain)]
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
const changes = computed(() => (dryRun.value === null ? 0 : dryRun.value.added.length + dryRun.value.changed.length + (dryRun.value.pending?.gone.length ?? 0) + given.value.length))

async function confirm(): Promise<void> {
  const run = dryRun.value
  const records = store.state.records
  if (run !== null && records !== null) await writes.write(words.import.imported, (unit) => importGivingDays(unit, records, given.value, run), { key: 'import', failedTitle: words.import.notImported })
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <AppCard :title="words.import.title" :subtitle="words.import.subtitle">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5" data-testid="spending-import-file">
        <FileDrop v-model="picked" :accept="fileEndingsOf('table')" :label="words.import.drop" :description="words.import.orChoose" />
        <p v-if="loading" class="flex items-center gap-2 type-aside">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
          {{ words.import.reading }}
        </p>
        <FileHoldings v-if="holdings.length > 0" :holdings="holdings" :accounts="accounts" />
        <MissingAccountsOffer v-if="missing.length > 0" :title="missingTitle" :missing="missing" />
        <UAlert v-else-if="unreadable !== null || refusal !== null" icon="i-lucide-file-x" color="error" variant="subtle" :title="unreadable ?? refusal ?? ''" data-testid="spending-import-refused" />
        <RecipeMisfitActions
          v-if="missing.length === 0 && refusal !== null && picked !== null && loaded !== null && reading !== null && 'refused' in reading"
          :file="picked"
          :cells="loaded.cells"
          :refusal="reading.refused"
          :said="refusal"
        />
      </div>
    </AppCard>
    <AppCard v-if="dryRun !== null && loaded !== null" :title="loaded.name" data-testid="spending-dry-run">
      <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
        <p class="type-row-title" data-testid="spending-dry-run-summary">{{ words.import.summary(dryRun.newRows, dryRun.alreadyIn, dryRun.filled) }}</p>
        <ul v-if="notes.length > 0 || loansUnread !== null" class="flex flex-col gap-1 type-aside" data-testid="spending-dry-run-notes">
          <li v-for="note in notes" :key="note.line" class="flex flex-col items-start gap-1">
            {{ note.line }}
            <UButton v-if="note.action !== null" :label="note.action.label" variant="link" :icon="note.action.icon" class="p-0" :data-testid="note.action.test" @click="note.action.run()" />
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
