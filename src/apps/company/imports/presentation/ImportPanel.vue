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
import { plural } from '../../../../shared/text/translation'
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
import { words } from './words'

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
  ...savedProfiles.value.map((profile) => ({ label: fitting.value.includes(profile) ? profile.name : words.panel.otherColumns(profile.name), value: profile.name })),
  { label: words.panel.newProfile, value: NEW_PROFILE },
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
    toast.add({ title: words.panel.notSaved, description: words.panel.profileTaken(profile.name), icon: 'i-lucide-triangle-alert', color: 'error' })
    return
  }
  const saved = await writes.write(words.panel.profileSaved, (unit) => setSettings(unit, store.state.records?.settings ?? NO_RECORDS, [{ key, value: profileValue(profile) }]), {
    description: words.panel.profileOnSettings(profile.name),
    failedTitle: words.panel.notSaved,
  })
  if (saved) {
    profileChoice.value = profile.name
    editing.value = false
  }
}

/** Takes the chosen profile off the settings tab, so no file is offered it again. Settings keep no Undo. */
async function deleteProfile(): Promise<void> {
  const name = profileChoice.value
  const removed = await writes.write(words.panel.profileDeleted, (unit) => removeSettings(unit, store.state.records?.settings ?? NO_RECORDS, [profileKey(name)]), {
    description: words.panel.profileOffSettings(name),
    failedTitle: words.panel.notDeleted,
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
    failedTitle: words.panel.notImported,
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
      <p class="max-w-[65ch] text-sm text-muted">{{ words.panel.intro }}</p>

      <StatementFolderCard />

      <AppCard :title="words.panel.file" :subtitle="words.panel.fileSubtitle">
        <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5" data-testid="import-file">
          <UFileUpload
            v-model="pickedFile"
            accept=".xml,.xlsx,.xls,.ods,.csv,.txt"
            :preview="false"
            reset
            icon="i-lucide-file-up"
            :label="words.panel.drop"
            :description="words.panel.orChoose"
            color="neutral"
            class="w-full"
            :ui="{ base: 'min-h-28 border-dashed bg-elevated/40' }"
          />
          <div v-if="offersSamples" class="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{{ words.panel.samples }}</span>
            <UButton :label="words.panel.sampleCamt" icon="i-lucide-file-code" color="neutral" variant="link" size="sm" data-testid="sample-camt" @click="loadSample('camt')" />
            <UButton :label="words.panel.sampleTable" icon="i-lucide-file-spreadsheet" color="neutral" variant="link" size="sm" data-testid="sample-table" @click="loadSample('table')" />
          </div>
          <p v-if="loading" class="flex items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
            {{ words.panel.reading }}
          </p>
          <UAlert v-if="loadFailure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="loadFailure" data-testid="import-failure" />
          <p v-if="loaded" class="flex items-center gap-2 text-sm text-toned" data-testid="import-loaded">
            <UIcon :name="loaded.kind === 'camt' ? 'i-lucide-file-code' : 'i-lucide-file-spreadsheet'" class="size-4 shrink-0" aria-hidden="true" />
            <span class="min-w-0 break-words">{{ words.panel.loaded(loaded.fileName, loaded.kind === 'camt') }}</span>
          </p>
        </div>
      </AppCard>

      <AppCard v-if="loaded?.kind === 'table'" :title="words.panel.profile" :subtitle="fitting.length ? words.panel.profileFits : words.panel.profileGuessed">
        <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5" data-testid="import-profile">
          <UAlert v-if="shape === null" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="words.panel.noHeader" />
          <div v-if="savedProfiles.length" class="flex flex-wrap items-end gap-2">
            <UFormField :label="words.panel.savedProfile" class="min-w-56 flex-1">
              <USelect :model-value="profileChoice" :items="profileItems" class="w-full" data-testid="profile-choice" @update:model-value="chooseProfile(String($event))" />
            </UFormField>
            <template v-if="profileChoice !== NEW_PROFILE && !editing">
              <UButton :label="words.panel.edit" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="profile-edit" @click="editProfile" />
              <UButton
                :label="words.panel.delete"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                :disabled="writes.busy.value || store.state.writing"
                :aria-label="words.panel.deleteProfile(profileChoice)"
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

        <AppCard :title="words.panel.dryRun" data-testid="dry-run">
          <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5">
            <p class="text-sm text-toned" data-testid="dry-run-summary">{{ summary }}</p>
            <div v-if="importedRows" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-toned" role="status" data-testid="import-waiting">
              <p class="flex items-start gap-2">
                <UIcon name="i-lucide-inbox" class="mt-0.5 size-4 shrink-0" :class="importedRows.waiting > 0 ? 'text-warning' : 'text-muted'" aria-hidden="true" />
                <span v-if="importedRows.waiting > 0">{{ plural(words.panel.waitingOnReview(importedRows.waiting), importedRows.waiting) }}</span>
                <span v-else>{{ words.panel.noneWaits }}</span>
              </p>
              <DrillLink v-if="importedRows.waiting > 0" to="/company/review" class="font-medium text-highlighted">{{ words.panel.openReview }}</DrillLink>
            </div>
            <div class="flex justify-end">
              <UButton
                :label="words.panel.confirm"
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

      <EmptyState v-else-if="loaded?.kind === 'table' && !activeProfile" icon="i-lucide-columns-3" :title="words.panel.pickProfile" :description="words.panel.pickProfileDescription" />
    </template>
  </div>
</template>
