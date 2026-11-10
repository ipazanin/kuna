<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFileUpload from '@nuxt/ui/components/FileUpload.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { importTitle, statementReadings, writeImport } from '../../imports/application/importStatements'
import type { LoadedImportFile } from '../../imports/application/importStatements'
import { loadImportFile } from '../../imports/infrastructure/importFiles'
import DryRunStatementCard from '../../imports/presentation/DryRunStatementCard.vue'
import { useDryRun } from '../../imports/presentation/useDryRun'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { useOnboarding } from './useOnboarding'
import { words } from './words'
import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import StepCard from '../../../../shared/ui/StepCard.vue'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
/**
 * The first statement: a camt.053 file, whose IBAN, currency and opening balance make the account
 * the person names, as Import's dry run offers. A bank export needs its columns named, which Import
 * does, so it waits for there. How later statements arrive is offered once this one is in.
 */
const onboarding = useOnboarding()
const store = useWorkbook()
const writes = useRecordWrites(store)

/** The fake build offers its sample statement. The check is written inline, so a production build drops the sample. */
const offersSample = import.meta.env.VITE_FAKE_WORKBOOK === 'true'

const workbook = computed(() => store.state.workbook)
const inBrowser = computed(() => onboarding.place.value.home === 'browser')

const picked = ref<File | null>(null)
// Shallow, so the parsed document stays a plain object.
const loaded = shallowRef<LoadedImportFile | null>(null)
const loadFailure = ref<string | null>(null)

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

async function importNow(): Promise<void> {
  const run = dryRun.value
  if (run === null || run.newRows === 0) return
  loadFailure.value = null
  let imported = false
  try {
    imported = await withGoogleAccess(inBrowser.value ? [] : ['drive.file'], () =>
      writes.write(importTitle(run), (unit) => writeImport(unit, run, store.state.records?.ledger ?? NO_RECORDS), { failedTitle: words.statement.notImported }),
    )
  } catch (refused) {
    loadFailure.value = refused instanceof Error ? refused.message : String(refused)
  }
  if (imported) {
    await onboarding.finish()
  }
}
</script>

<template>
  <StepCard :title="words.statement.title" :subtitle="words.statement.subtitle">
    <p v-if="inBrowser" class="text-sm text-muted" data-testid="onboarding-statements-by-hand">{{ words.statement.byHand }}</p>

    <UFileUpload
      v-model="picked"
      accept=".xml,.xlsx,.xls,.ods,.csv,.txt"
      :preview="false"
      reset
      icon="i-lucide-file-up"
      :label="words.statement.drop"
      :description="words.statement.dropNote"
      color="neutral"
      class="w-full"
      :ui="{ base: 'min-h-28 border-dashed bg-elevated/40' }"
      data-testid="onboarding-statement-file"
    />
    <UButton v-if="offersSample" :label="words.statement.sample" icon="i-lucide-file-code" color="neutral" variant="link" size="sm" class="self-start" data-testid="sample-camt" @click="loadSample" />
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
      :title="words.statement.table"
      :description="words.statement.tableNote"
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
      <UButton :label="words.statement.skip" color="neutral" variant="outline" data-testid="onboarding-skip" @click="onboarding.finish()" />
      <UButton
        v-if="dryRun && dryRun.newRows > 0"
        :label="dryRun.accounts.length ? words.statement.addAndImport : words.statement.import"
        icon="i-lucide-file-input"
        :loading="writes.busy.value"
        data-testid="onboarding-import"
        @click="importNow"
      />
    </template>
  </StepCard>
</template>
