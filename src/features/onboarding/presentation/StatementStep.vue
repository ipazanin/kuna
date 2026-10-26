<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFileUpload from '@nuxt/ui/components/FileUpload.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { folderTrail } from '../../../shared/text/folderPath'
import { importTitle, statementReadings, writeImport } from '../../imports/application/importStatements'
import type { LoadedImportFile } from '../../imports/application/importStatements'
import { loadImportFile } from '../../imports/infrastructure/importFiles'
import DryRunStatementCard from '../../imports/presentation/DryRunStatementCard.vue'
import { useDryRun } from '../../imports/presentation/useDryRun'
import { setSettings } from '../../settings/application/settingWrites'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { NO_RECORDS } from '../../workbook/domain/recordsRead'
import { useRecordWrites } from '../../workbook/presentation/useRecordWrites'
import StepCard from './StepCard.vue'
import { useOnboarding } from './useOnboarding'

/**
 * The first statement: a camt.053 file, whose IBAN, currency and opening balance make the account
 * the person names, as Import's dry run offers. A bank export needs its columns named, which Import
 * does, so it waits for there. With statements from a Drive folder, the folder is chosen here.
 */
const onboarding = useOnboarding()
const store = useWorkbook()
const writes = useRecordWrites()

/** The fake build offers its sample statement. The check is written inline, so a production build drops the sample. */
const offersSample = import.meta.env.VITE_FAKE_WORKBOOK === 'true'

const workbook = computed(() => store.state.workbook)
const fromFolder = computed(() => workbook.value?.settings.statementsSync === true)
const folder = computed(() => workbook.value?.settings.statementsFolder ?? [])

const picked = ref<File | null>(null)
// Shallow, so the parsed document stays a plain object.
const loaded = shallowRef<LoadedImportFile | null>(null)
const loadFailure = ref<string | null>(null)
const choosing = ref(false)
const folderFailure = ref<string | null>(null)

async function load(fileName: string, bytes: Promise<ArrayBuffer>): Promise<void> {
  loadFailure.value = null
  loaded.value = null
  starts.reset()
  try {
    loaded.value = await loadImportFile(fileName, await bytes)
  } catch (failure) {
    loadFailure.value = failure instanceof Error ? failure.message : String(failure)
  }
}

watch(picked, (file) => {
  if (file !== null) void load(file.name, file.arrayBuffer())
})

async function loadSample(): Promise<void> {
  if (import.meta.env.VITE_FAKE_WORKBOOK !== 'true') return
  const samples = await import('../../imports/infrastructure/fake/sampleImportFiles')
  await load(samples.SAMPLE_CAMT_FILE_NAME, Promise.resolve(new TextEncoder().encode(samples.sampleCamtXml()).buffer as ArrayBuffer))
}

const readings = computed(() => (loaded.value?.kind === 'camt' && workbook.value !== null ? statementReadings(loaded.value, workbook.value, null) : []))
const starts = useDryRun(readings)
const { dryRun, started, typedOpenings, accountNames, accountNameProblems } = starts

async function chooseFolder(): Promise<void> {
  choosing.value = true
  folderFailure.value = null
  try {
    const chosen = await store.pickDriveFolder('Choose the folder of your bank statements')
    if (chosen !== null && chosen.path === null) {
      folderFailure.value = 'The app may not read your Drive, so it cannot name the folder’s path. Allow access in the sync control, then choose it on Settings, General.'
    } else if (chosen?.path) {
      const path = chosen.path
      await store.write('Settings saved', (unit) => setSettings(unit, store.state.records?.settings ?? NO_RECORDS, [{ key: 'statements_folder', value: path.join('/') }]))
    }
  } catch (failure) {
    folderFailure.value = failure instanceof Error ? failure.message : String(failure)
  } finally {
    choosing.value = false
  }
}

async function importNow(): Promise<void> {
  const run = dryRun.value
  if (run === null || run.newRows === 0) return
  if (await writes.write(importTitle(run), (unit) => writeImport(unit, run), { failedTitle: 'Not imported' })) {
    await onboarding.finish()
  }
}
</script>

<template>
  <StepCard title="Your first statement" subtitle="Nothing is written until you import it. You can skip this and import later.">
    <div v-if="fromFolder" class="flex flex-wrap items-center justify-between gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="onboarding-statements-folder">
      <div class="min-w-0">
        <p class="text-sm text-highlighted">Statements folder</p>
        <p class="identifier text-xs break-words text-muted">{{ folder.length ? folderTrail(folder) : 'Not chosen yet. Each sync files the statements it holds.' }}</p>
      </div>
      <UButton label="Choose folder" icon="i-lucide-folder-search" color="neutral" variant="outline" size="sm" :loading="choosing" @click="chooseFolder" />
    </div>
    <UAlert v-if="folderFailure" icon="i-lucide-triangle-alert" color="error" variant="subtle" title="No folder was chosen" :description="folderFailure" />

    <UFileUpload
      v-model="picked"
      accept=".xml,.xlsx,.xls,.ods,.csv,.txt"
      :preview="false"
      reset
      icon="i-lucide-file-up"
      label="Drop a camt.053 file or a bank export"
      description="or click to choose one"
      color="neutral"
      class="w-full"
      :ui="{ base: 'min-h-28 border-dashed bg-elevated/40' }"
      data-testid="onboarding-statement-file"
    />
    <UButton v-if="offersSample" label="The made-up company's camt.053 statement" icon="i-lucide-file-code" color="neutral" variant="link" size="sm" class="self-start" data-testid="sample-camt" @click="loadSample" />
    <UAlert v-if="loadFailure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="loadFailure" />
    <p v-if="loaded" class="flex items-center gap-2 text-sm text-toned">
      <UIcon :name="loaded.kind === 'camt' ? 'i-lucide-file-code' : 'i-lucide-file-spreadsheet'" class="size-4 shrink-0" aria-hidden="true" />
      <span class="min-w-0 break-words">{{ loaded.fileName }}</span>
    </p>
    <UAlert
      v-if="loaded?.kind === 'table'"
      icon="i-lucide-columns-3"
      color="neutral"
      variant="subtle"
      title="A bank export needs its columns named first"
      description="Transactions, Import reads its columns with you once Settings, Accounts names the account. Finish here and import it there."
      data-testid="onboarding-statement-table"
    />
    <template v-if="dryRun">
      <DryRunStatementCard
        v-for="(statement, index) in dryRun.statements"
        :key="`${statement.fileName}-${statement.label}`"
        :statement="statement"
        :collapse-id="`onboarding.statement-${index + 1}`"
        :started="started[statement.account] === true"
        :typed-opening="typedOpenings[statement.account] ?? ''"
        :account-name="statement.newAccount ? accountNames[statement.newAccount.iban] : undefined"
        :account-name-problem="statement.newAccount ? accountNameProblems[statement.newAccount.iban] : undefined"
        @update:started="starts.start(statement.account, $event)"
        @update:typed-opening="starts.typeOpening(statement.account, $event)"
        @update:account-name="statement.newAccount && starts.nameAccount(statement.newAccount.iban, $event)"
      />
    </template>

    <template #actions>
      <UButton label="Skip for now" color="neutral" variant="outline" data-testid="onboarding-skip" @click="onboarding.finish()" />
      <UButton
        v-if="dryRun && dryRun.newRows > 0"
        :label="dryRun.accounts.length ? 'Add and import' : 'Import'"
        icon="i-lucide-file-input"
        :loading="writes.busy.value"
        data-testid="onboarding-import"
        @click="importNow"
      />
    </template>
  </StepCard>
</template>
