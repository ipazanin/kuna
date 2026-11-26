<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import { REVIEW_LINK } from '../../transactions/presentation/transactionsLinks'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { needsReview } from '../../workbook/domain/needsReview'
import { plural } from '../../../../shared/text/translation'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FileDrop from '../../../../shared/ui/FileDrop.vue'
import { importRecipes, importTitle, statementReadings, writeImport } from '../application/importStatements'
import { companyBooksOf } from '../../workbook/domain/readWorkbook'
import { fittingRecipes } from '../domain/tableRecipes'
import { accountNamedIn, fileShapeOf } from '../domain/recipeGuess'
import type { SavedRecipe } from '../../../../shared/recipes/domain/savedRecipe'
import type { TableRecipeDraft } from '../../../../shared/recipes/domain/tableRecipeDraft'
import { loadImportFile } from '../infrastructure/importFiles'
import type { LoadedImportFile } from '../application/importStatements'
import DryRunStatementCard from './DryRunStatementCard.vue'
import MailedStatementsCard from './MailedStatementsCard.vue'
import ProfileMoveNotice from './ProfileMoveNotice.vue'
import TableRecipeDialog from './TableRecipeDialog.vue'
import { useDryRun } from './useDryRun'
import { words } from './words'

const store = useWorkbook()
const writes = useRecordWrites(store)

const pickedFile = ref<File | null>(null)
// Shallow, so the parsed document and the cells stay plain objects.
const loaded = shallowRef<LoadedImportFile | null>(null)
const loading = ref(false)
const loadFailure = ref<string | null>(null)

/** The fake build offers two sample files. The check is written inline, so a production build drops the samples. */
const offersSamples = import.meta.env.VITE_FAKE_WORKBOOK === 'true'

async function load(fileName: string, bytes: () => Promise<ArrayBuffer>): Promise<void> {
  loading.value = true
  loadFailure.value = null
  loaded.value = null
  try {
    takeFile(await loadImportFile(fileName, await bytes()))
  } catch (failure) {
    loadFailure.value = failure instanceof Error ? failure.message : String(failure)
  } finally {
    loading.value = false
  }
}

watch(pickedFile, (file) => {
  if (file !== null) void load(file.name, () => file.arrayBuffer())
})

async function loadSample(kind: 'camt' | 'table'): Promise<void> {
  if (import.meta.env.VITE_FAKE_WORKBOOK !== 'true') return
  const samples = await import('../infrastructure/fake/sampleImportFiles')
  if (kind === 'camt') {
    await load(samples.SAMPLE_CAMT_FILE_NAME, async () => new TextEncoder().encode(samples.sampleCamtXml()).buffer as ArrayBuffer)
  } else {
    await load(samples.SAMPLE_TABLE_FILE_NAME, async () => (await samples.sampleTableFile()).slice().buffer as ArrayBuffer)
  }
}

const workbook = computed(() => store.state.workbook)
const recipes = computed(() => (workbook.value === null ? [] : importRecipes(workbook.value)))
const kept = computed(() => new Set((workbook.value?.recipes ?? []).map((recipe) => String(recipe.id))))

/** The chosen recipe's id, or blank for none. */
const recipeChoice = ref('')
const dialogOpen = ref(false)
/** Whether the dialog changes the chosen recipe, or writes a new one. */
const editsChosen = ref(false)

const shape = computed(() => (loaded.value?.kind === 'table' ? fileShapeOf(loaded.value.cells) : null))
const fitting = computed(() => (loaded.value?.kind === 'table' ? fittingRecipes(loaded.value.cells, recipes.value) : []))
const chosen = computed(() => recipes.value.find((recipe) => String(recipe.saved.id) === recipeChoice.value) ?? null)

/** The rows the last confirmed import wrote, by account and bank reference, which every imported row carries. */
const imported = ref<ReadonlySet<string> | null>(null)
const rowKey = (account: string, reference: string): string => `${account}|${reference}`

/** A newly loaded file starts on the first saved recipe that fits it. */
function takeFile(file: LoadedImportFile): void {
  loaded.value = file
  imported.value = null
  starts.reset()
  const fit = file.kind === 'table' ? fittingRecipes(file.cells, recipes.value)[0] : undefined
  recipeChoice.value = fit === undefined ? '' : String(fit.saved.id)
}

const recipeItems = computed(() =>
  recipes.value.map((recipe) => ({ label: fitting.value.includes(recipe) ? recipe.recipe.name : words.panel.otherColumns(recipe.recipe.name), value: String(recipe.saved.id) })),
)

const EMPTY_DRAFT: TableRecipeDraft = { name: '', date: { column: '', format: 'dd.MM.yyyy' }, amount: { column: '' }, mark: 'comma', columns: {}, kinds: [{ kind: 'entry', test: null }] }

/** What a new recipe starts from: the draft the file's look suggests, and the bank and currency of the account the file names. */
const start = computed(() => {
  const named = loaded.value?.kind === 'table' ? accountNamedIn(loaded.value.cells, workbook.value?.accounts ?? []) : null
  const currency = workbook.value?.settings.currency ?? ''
  return { draft: shape.value?.guess ?? EMPTY_DRAFT, bank: named?.bank ?? '', currency: named?.currency || currency }
})

function writeRecipe(): void {
  editsChosen.value = false
  dialogOpen.value = true
}

function editRecipe(): void {
  editsChosen.value = true
  dialogOpen.value = true
}

function recipeSaved(recipe: SavedRecipe): void {
  recipeChoice.value = String(recipe.id)
}

function recipeDeleted(): void {
  recipeChoice.value = fitting.value[0] === undefined ? '' : String(fitting.value[0].saved.id)
}

const readings = computed(() => (loaded.value === null || workbook.value === null ? [] : statementReadings(loaded.value, workbook.value, chosen.value?.saved ?? null)))

const starts = useDryRun(readings)
const { dryRun, started, typedOpenings, accountNames, accountNameProblems } = starts

const refused = computed(() => dryRun.value?.statements.filter((statement) => statement.refusal !== null).length ?? 0)
const waitingStart = computed(() => dryRun.value?.statements.filter((statement) => statement.start !== null && !statement.rows.some((row) => row.verdict !== null)).length ?? 0)
const waitingName = computed(() => dryRun.value?.statements.filter((statement) => statement.newAccount !== null && !statement.rows.some((row) => row.verdict !== null)).length ?? 0)

async function confirm(): Promise<void> {
  const run = dryRun.value
  if (run === null || run.newRows === 0) return
  const written = await writes.write(importTitle(run), (unit) => writeImport(unit, run, companyBooksOf(store.state)), {
    failedTitle: words.panel.notImported,
    key: 'import',
  })
  if (written) imported.value = new Set(run.added.map((entry) => rowKey(entry.account, entry.reference)))
}

/** How the imported rows stand on the ledger now. Once Undo took them out again, there is nothing to say. */
const importedRows = computed(() => {
  const keys = imported.value
  if (keys === null || workbook.value === null) return null
  const rows = workbook.value.transactions.filter((transaction) => keys.has(rowKey(transaction.account, transaction.reference)))
  return rows.length === 0 ? null : { count: rows.length, waiting: rows.filter(needsReview).length }
})

const summary = computed(() => {
  const run = dryRun.value
  if (run === null) return ''
  return [
    run.accounts.length > 0 ? words.panel.addsAccounts(run.accounts.map((account) => account.slug)) : '',
    run.newRows > 0 ? plural(words.panel.addsRows(run.newRows), run.newRows) : words.panel.writesNothing,
    run.inLedger > 0 ? plural(words.panel.inLedger(run.inLedger), run.inLedger) : '',
    refused.value > 0 ? plural(words.panel.refused(refused.value), refused.value) : '',
    waitingStart.value > 0 ? plural(words.panel.waitStart(waitingStart.value), waitingStart.value) : '',
    waitingName.value > 0 ? plural(words.panel.waitName(waitingName.value), waitingName.value) : '',
  ]
    .filter((sentence) => sentence !== '')
    .join(' ')
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <EmptyState v-if="workbook === null" icon="i-lucide-book-open" :title="words.panel.noWorkbook" :description="words.panel.noWorkbookDescription" />

    <template v-else>
      <p class="max-w-prose type-aside">{{ words.panel.intro }}</p>

      <MailedStatementsCard />

      <ProfileMoveNotice />

      <AppCard :title="words.panel.file" :subtitle="words.panel.fileSubtitle">
        <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5" data-testid="import-file">
          <FileDrop v-model="pickedFile" accept=".xml,.xlsx,.xls,.ods,.csv,.txt" :label="words.panel.drop" :description="words.panel.orChoose" />
          <div v-if="offersSamples" class="flex flex-wrap items-center gap-2 type-aside">
            <span>{{ words.panel.samples }}</span>
            <UButton :label="words.panel.sampleCamt" icon="i-lucide-file-code" color="neutral" variant="link" size="sm" data-testid="sample-camt" @click="loadSample('camt')" />
            <UButton :label="words.panel.sampleTable" icon="i-lucide-file-spreadsheet" color="neutral" variant="link" size="sm" data-testid="sample-table" @click="loadSample('table')" />
          </div>
          <p v-if="loading" class="flex items-center gap-2 type-aside">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
            {{ words.panel.reading }}
          </p>
          <UAlert v-if="loadFailure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="loadFailure" data-testid="import-failure" />
          <p v-if="loaded" class="flex items-center gap-2 type-body" data-testid="import-loaded">
            <UIcon :name="loaded.kind === 'camt' ? 'i-lucide-file-code' : 'i-lucide-file-spreadsheet'" class="size-4 shrink-0" aria-hidden="true" />
            <span class="min-w-0 break-words">{{ words.panel.loaded(loaded.fileName, loaded.kind === 'camt') }}</span>
          </p>
        </div>
      </AppCard>

      <AppCard v-if="loaded?.kind === 'table'" :title="words.panel.recipe" :subtitle="fitting.length ? words.panel.recipeFits : words.panel.recipeMissing">
        <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5" data-testid="import-recipe">
          <UAlert v-if="shape === null" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="words.panel.noHeader" />
          <div class="flex flex-wrap items-end gap-2">
            <UFormField v-if="recipes.length" :label="words.panel.savedRecipe" class="w-full sm:w-auto sm:min-w-56 sm:flex-1">
              <USelect v-model="recipeChoice" :items="recipeItems" :placeholder="words.panel.pickRecipe" class="w-full" data-testid="recipe-choice" />
            </UFormField>
            <UButton v-if="chosen" :label="words.panel.editRecipe" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="recipe-edit" @click="editRecipe" />
            <UButton :label="words.panel.writeRecipe" icon="i-lucide-plus" color="neutral" variant="outline" data-testid="recipe-write" @click="writeRecipe" />
          </div>
          <p v-if="chosen" class="type-aside" data-testid="recipe-reads-into">{{ words.panel.readsInto(chosen.saved.bank, chosen.saved.currency ?? workbook.settings.currency) }}</p>
          <TableRecipeDialog
            v-model:open="dialogOpen"
            :recipe="editsChosen ? (chosen?.saved ?? null) : null"
            :kept="editsChosen && chosen !== null && kept.has(String(chosen.saved.id))"
            :start="start"
            :columns="shape?.headers ?? null"
            @saved="recipeSaved"
            @deleted="recipeDeleted"
          />
        </div>
      </AppCard>

      <template v-if="dryRun">
        <DryRunStatementCard
          v-for="(statement, index) in dryRun.statements"
          :key="`${statement.fileName}-${statement.label}`"
          :statement="statement"
          :collapse-id="`import.statement-${index + 1}`"
          :started="started[statement.account] === true"
          :typed-opening="typedOpenings[statement.account] ?? ''"
          :account-name="statement.newAccount ? accountNames[statement.newAccount.iban] : undefined"
          :account-name-problem="statement.newAccount ? accountNameProblems[statement.newAccount.iban] : undefined"
          @update:started="starts.start(statement.account, $event)"
          @update:typed-opening="starts.typeOpening(statement.account, $event)"
          @update:account-name="statement.newAccount && starts.nameAccount(statement.newAccount.iban, $event)"
          @answer="starts.answerTwin"
        />

        <AppCard :title="words.panel.dryRun" data-testid="dry-run">
          <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
            <p class="type-body" data-testid="dry-run-summary">{{ summary }}</p>
            <div v-if="importedRows" class="flex flex-wrap items-center gap-x-3 gap-y-1 type-body" role="status" data-testid="import-waiting">
              <p class="flex items-start gap-2">
                <UIcon name="i-lucide-inbox" class="mt-0.5 size-4 shrink-0" :class="importedRows.waiting > 0 ? 'text-warning' : 'text-muted'" aria-hidden="true" />
                <span v-if="importedRows.waiting > 0">{{ plural(words.panel.waitingOnReview(importedRows.waiting), importedRows.waiting) }}</span>
                <span v-else>{{ words.panel.noneWaits }}</span>
              </p>
              <DrillLink v-if="importedRows.waiting > 0" :to="REVIEW_LINK" class="font-medium text-highlighted">{{ words.panel.openReview }}</DrillLink>
            </div>
            <div class="flex justify-end">
              <UButton
                :label="words.panel.confirm"
                icon="i-lucide-file-input"
                :loading="writes.saving('import')"
                :disabled="dryRun.newRows === 0 || writes.busy.value || writes.refused.value"
                data-testid="import-confirm"
                @click="confirm"
              />
            </div>
          </div>
        </AppCard>
      </template>

      <EmptyState v-else-if="loaded?.kind === 'table' && !chosen" icon="i-lucide-columns-3" :title="words.panel.pickRecipe" :description="words.panel.pickRecipeDescription" />
    </template>
  </div>
</template>
