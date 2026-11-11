<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { writeDryRun } from '../application/statementWrites'
import { addRevolutAccounts, revolutStatement } from '../domain/revolutStatement'
import { statementDryRun, syncGapOf } from '../domain/statementDryRun'
import DryRunLines from './DryRunLines.vue'
import { rowNamed, twinCaption } from './rowParts'
import type { RowQuestion } from './rowParts'
import MissingAccountsOffer from './MissingAccountsOffer.vue'
import { words } from './words'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { EURO } from '../../../../shared/money/currencyCode'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import { TWIN_CHOICES, twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinChoice } from '../../../../shared/ai/presentation/copiedRowsWords'
import type { TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
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

const dryRun = computed(() => {
  const book = store.state.workbook
  if (book === null || statement.value === null) return null
  return statementDryRun(book, { ...statement.value, twinAnswers: new Map(Object.entries(twinAnswers.value)), days: days.value }, today())
})

const twinItems = computed(() => {
  const accounts = new Map((store.state.workbook?.accounts ?? []).map((account) => [account.id, account]))
  return (dryRun.value?.questions ?? []).map((question): RowQuestion<TwinChoice> => {
    const account = accounts.get(question.row.account)
    return {
      key: question.key,
      row: rowNamed(question.row, account),
      caption: twinCaption(question.booked, account),
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
        <section v-if="days !== undefined && fileDays !== null" class="flex flex-col gap-1" data-testid="spending-import-days">
          <h3 class="type-card-title">{{ words.import.days.title }}</h3>
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
        >
          <template #amount="{ item }">
            <AccountMoneyText :cents="item.amount" :currency="item.currency" sign="always" tone="flow" class="shrink-0 text-sm" />
          </template>
        </QuestionList>
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
