<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFileUpload from '@nuxt/ui/components/FileUpload.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import { removeSettings, setSettings } from '../../settings/application/settingWrites'
import { heldSettingValue } from '../../settings/domain/settings'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { needsReview } from '../../workbook/domain/needsReview'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import { fittingProfiles, importTitle, statementReadings, writeImport } from '../application/importStatements'
import { profileDraftProblem, profileKey, profileValue } from '../domain/importProfile'
import type { ImportProfile } from '../domain/importProfile'
import { accountNamedIn, fileShapeOf } from '../domain/profileGuess'
import { loadImportFile } from '../infrastructure/importFiles'
import type { LoadedImportFile } from '../application/importStatements'
import DryRunStatementCard from './DryRunStatementCard.vue'
import ProfileEditor from './ProfileEditor.vue'
import StatementFolderCard from './StatementFolderCard.vue'
import { useDryRun } from './useDryRun'

const store = useWorkbook()
const toast = useToast()
const names = useDisplayNames()
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
const savedProfiles = computed(() => workbook.value?.settings.importProfiles ?? [])
const accountItems = computed(() => (workbook.value?.accounts ?? []).map((account) => ({ label: names.value.account(account.slug), value: account.slug })))

/** The choice of a new profile, which no saved name can be, since a name is a slug. */
const NEW_PROFILE = '+new'
const profileChoice = ref<string>(NEW_PROFILE)
const editing = ref(false)
const draft = ref<ImportProfile | null>(null)

const shape = computed(() => (loaded.value?.kind === 'table' ? fileShapeOf(loaded.value.grid) : null))
const fitting = computed(() => (loaded.value?.kind === 'table' ? fittingProfiles(loaded.value.grid, savedProfiles.value) : []))

/** The rows the last confirmed import wrote, by account and bank reference, which every imported row carries. */
const imported = ref<ReadonlySet<string> | null>(null)
const rowKey = (account: string, reference: string): string => `${account}|${reference}`

/** A newly loaded file starts on the first saved profile that fits it, or on a new one guessed from the file. */
function takeFile(file: LoadedImportFile): void {
  loaded.value = file
  imported.value = null
  starts.reset()
  editing.value = false
  const fit = file.kind === 'table' ? fittingProfiles(file.grid, savedProfiles.value)[0] : undefined
  profileChoice.value = fit?.name ?? NEW_PROFILE
  const accounts = workbook.value?.accounts ?? []
  const guess = file.kind === 'table' ? fileShapeOf(file.grid)?.guess : undefined
  draft.value = fit ?? (guess === undefined ? null : { ...guess, account: file.kind === 'table' ? accountNamedIn(file.grid, accounts) : '' })
}

const profileItems = computed(() => [
  ...savedProfiles.value.map((profile) => ({ label: fitting.value.includes(profile) ? profile.name : `${profile.name}, other columns`, value: profile.name })),
  { label: 'New profile', value: NEW_PROFILE },
])

function chooseProfile(name: string): void {
  profileChoice.value = name
  editing.value = false
  const saved = savedProfiles.value.find((profile) => profile.name === name)
  draft.value = saved ?? (shape.value === null ? null : { ...shape.value.guess })
}

function editProfile(): void {
  editing.value = true
  draft.value = savedProfiles.value.find((profile) => profile.name === profileChoice.value) ?? draft.value
}

const showsEditor = computed(() => loaded.value?.kind === 'table' && draft.value !== null && (profileChoice.value === NEW_PROFILE || editing.value))

const activeProfile = computed<ImportProfile | null>(() => {
  if (loaded.value?.kind !== 'table') return null
  if (showsEditor.value) return draft.value !== null && profileDraftProblem(draft.value) === null ? draft.value : null
  return savedProfiles.value.find((profile) => profile.name === profileChoice.value) ?? null
})

async function saveProfile(): Promise<void> {
  const profile = draft.value
  if (profile === null) return
  const key = profileKey(profile.name)
  const held = heldSettingValue(store.state.records?.settings ?? NO_RECORDS, key)
  if (!editing.value && (held !== null || savedProfiles.value.some((saved) => saved.name === profile.name))) {
    toast.add({ title: 'Not saved', description: `A profile called ${profile.name} is saved already. Pick it, or give this one another name.`, icon: 'i-lucide-triangle-alert', color: 'error' })
    return
  }
  const saved = await writes.write('Profile saved', (unit) => setSettings(unit, store.state.records?.settings ?? NO_RECORDS, [{ key, value: profileValue(profile) }]), {
    description: `${profile.name} is on the settings tab now.`,
    failedTitle: 'Not saved',
  })
  if (saved) {
    profileChoice.value = profile.name
    editing.value = false
  }
}

/** Takes the chosen profile off the settings tab, so no file is offered it again. Settings keep no Undo. */
async function deleteProfile(): Promise<void> {
  const name = profileChoice.value
  const removed = await writes.write('Profile deleted', (unit) => removeSettings(unit, store.state.records?.settings ?? NO_RECORDS, [profileKey(name)]), {
    description: `${name} is off the settings tab. Settings keep no Undo, so save it again to bring it back.`,
    failedTitle: 'Not deleted',
  })
  if (removed) chooseProfile(NEW_PROFILE)
}

const readings = computed(() => (loaded.value === null || workbook.value === null ? [] : statementReadings(loaded.value, workbook.value, activeProfile.value)))

const starts = useDryRun(readings)
const { dryRun, started, typedOpenings, accountNames, accountNameProblems } = starts

const refused = computed(() => dryRun.value?.statements.filter((statement) => statement.refusal !== null).length ?? 0)
const waitingStart = computed(() => dryRun.value?.statements.filter((statement) => statement.start !== null && !statement.rows.some((row) => row.verdict !== null)).length ?? 0)
const waitingName = computed(() => dryRun.value?.statements.filter((statement) => statement.newAccount !== null && !statement.rows.some((row) => row.verdict !== null)).length ?? 0)

async function confirm(): Promise<void> {
  const run = dryRun.value
  if (run === null || run.newRows === 0) return
  const written = await writes.write(importTitle(run), (unit) => writeImport(unit, run), {
    failedTitle: 'Not imported',
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

function rowsInWords(count: number): string {
  return count === 1 ? '1 row' : `${count} rows`
}

const summary = computed(() => {
  const run = dryRun.value
  if (run === null) return ''
  return [
    run.accounts.length > 0 ? `Confirming adds the account ${run.accounts.map((account) => account.slug).join(' and the account ')} to Settings, Accounts.` : '',
    run.newRows > 0 ? `Confirming adds ${rowsInWords(run.newRows)} to the ledger, each statement where its dates belong.` : 'Confirming would write nothing.',
    run.inLedger > 0 ? `${rowsInWords(run.inLedger)} ${run.inLedger === 1 ? 'is' : 'are'} on the ledger already, found by account and bank reference.` : '',
    refused.value > 0 ? `${refused.value === 1 ? 'One statement is' : `${refused.value} statements are`} refused and not written.` : '',
    waitingStart.value > 0 ? `${waitingStart.value === 1 ? 'One statement waits' : `${waitingStart.value} statements wait`} for you to start its account.` : '',
    waitingName.value > 0 ? `${waitingName.value === 1 ? 'One statement waits' : `${waitingName.value} statements wait`} for you to name its new account.` : '',
  ]
    .filter((sentence) => sentence !== '')
    .join(' ')
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <EmptyState
      v-if="workbook === null"
      icon="i-lucide-book-open"
      title="Open a workbook first"
      description="Statements go into the ledger of the workbook on screen. Choose one on Settings, Books file."
    />

    <template v-else>
      <p class="max-w-[65ch] text-sm text-muted">Add a bank statement to the ledger: a camt.053 file, or a bank's spreadsheet export read by a saved profile. Nothing is written until you confirm.</p>

      <StatementFolderCard />

      <AppCard title="Statement file" subtitle="A camt.053 statement (.xml), or an export as .xlsx, .xls, .ods or .csv.">
        <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5" data-testid="import-file">
          <UFileUpload
            v-model="pickedFile"
            accept=".xml,.xlsx,.xls,.ods,.csv,.txt"
            :preview="false"
            reset
            icon="i-lucide-file-up"
            label="Drop a statement file here"
            description="or click to choose one"
            color="neutral"
            class="w-full"
            :ui="{ base: 'min-h-28 border-dashed bg-elevated/40' }"
          />
          <div v-if="offersSamples" class="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Sample files of the made-up company:</span>
            <UButton label="camt.053 statement" icon="i-lucide-file-code" color="neutral" variant="link" size="sm" data-testid="sample-camt" @click="loadSample('camt')" />
            <UButton label="Bank export" icon="i-lucide-file-spreadsheet" color="neutral" variant="link" size="sm" data-testid="sample-table" @click="loadSample('table')" />
          </div>
          <p v-if="loading" class="flex items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
            Reading the file
          </p>
          <UAlert v-if="loadFailure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="loadFailure" data-testid="import-failure" />
          <p v-if="loaded" class="flex items-center gap-2 text-sm text-toned" data-testid="import-loaded">
            <UIcon :name="loaded.kind === 'camt' ? 'i-lucide-file-code' : 'i-lucide-file-spreadsheet'" class="size-4 shrink-0" aria-hidden="true" />
            <span class="min-w-0 break-words">{{ loaded.fileName }}, {{ loaded.kind === 'camt' ? 'a camt.053 statement' : 'a spreadsheet export' }}</span>
          </p>
        </div>
      </AppCard>

      <AppCard
        v-if="loaded?.kind === 'table'"
        title="Profile"
        :subtitle="fitting.length ? 'How this bank\'s export reads. A saved profile fits the file.' : 'No saved profile fits this file, so a new one starts from what the file looks like.'"
      >
        <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5" data-testid="import-profile">
          <UAlert v-if="shape === null" icon="i-lucide-triangle-alert" color="warning" variant="subtle" title="No header row was found in the file's first rows, so there are no columns to pick." />
          <div v-if="savedProfiles.length" class="flex flex-wrap items-end gap-2">
            <UFormField label="Saved profile" class="min-w-56 flex-1">
              <USelect :model-value="profileChoice" :items="profileItems" class="w-full" data-testid="profile-choice" @update:model-value="chooseProfile(String($event))" />
            </UFormField>
            <template v-if="profileChoice !== NEW_PROFILE && !editing">
              <UButton label="Edit" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="profile-edit" @click="editProfile" />
              <UButton
                label="Delete"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                :disabled="writes.busy.value || store.state.writing"
                :aria-label="`Delete the profile ${profileChoice}`"
                data-testid="profile-delete"
                @click="deleteProfile"
              />
            </template>
          </div>
          <ProfileEditor v-if="showsEditor && draft && shape" v-model="draft" :headers="shape.headers" :accounts="accountItems" :editing="editing" :saving="writes.busy.value" @save="saveProfile" />
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
        />

        <AppCard title="Dry run" data-testid="dry-run">
          <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
            <p class="text-sm text-toned" data-testid="dry-run-summary">{{ summary }}</p>
            <div v-if="importedRows" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-toned" role="status" data-testid="import-waiting">
              <p class="flex items-start gap-2">
                <UIcon name="i-lucide-inbox" class="mt-0.5 size-4 shrink-0" :class="importedRows.waiting > 0 ? 'text-warning' : 'text-muted'" aria-hidden="true" />
                <span v-if="importedRows.waiting > 0">{{ importedRows.waiting }} new {{ importedRows.waiting === 1 ? 'row waits' : 'rows wait' }} on Review.</span>
                <span v-else>The rules settled every new row, so none waits on Review.</span>
              </p>
              <DrillLink v-if="importedRows.waiting > 0" to="/company/review" class="font-medium text-highlighted">Open Review</DrillLink>
            </div>
            <div class="flex justify-end">
              <UButton
                label="Confirm import"
                icon="i-lucide-file-input"
                :loading="writes.busy.value"
                :disabled="dryRun.newRows === 0 || writes.busy.value"
                data-testid="import-confirm"
                @click="confirm"
              />
            </div>
          </div>
        </AppCard>
      </template>

      <EmptyState
        v-else-if="loaded?.kind === 'table' && !activeProfile"
        icon="i-lucide-columns-3"
        title="Pick or make a profile"
        description="The dry run shows once a profile says which column holds what."
      />
    </template>
  </div>
</template>
