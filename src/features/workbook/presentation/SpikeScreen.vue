<script setup lang="ts">
import { onMounted, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCard from '@nuxt/ui/components/Card.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { exportAsXlsx, getFile, listChildren } from '../infrastructure/driveClient'
import { GoogleApiError } from '../infrastructure/googleApi'
import { currentAccessToken, prepareGoogleIdentity, requestToken } from '../infrastructure/googleAuth'
import type { AccessToken } from '../infrastructure/googleAuth'
import { pickFromDrive, preparePicker } from '../infrastructure/picker'
import type { PickedDocument } from '../infrastructure/picker'
import { loadSelectedWorkbook, saveSelectedWorkbook } from '../infrastructure/selectedWorkbook'
import type { SelectedWorkbook } from '../infrastructure/selectedWorkbook'
import { batchGetValues, batchUpdateValues, getSpreadsheetSummary } from '../infrastructure/sheetsClient'

type Note = (line: string) => void

const LEDGER_HEAD_RANGE = 'ledger!1:6'
const LEDGER_DATE_COLUMN = 'ledger!A:A'

const lines = ref<string[]>([])
const running = ref<number | null>(null)
const stored = ref(loadSelectedWorkbook())
const writeRange = ref('ledger!I2')
const writeValue = ref('')

function note(step: number, line: string): void {
  const stamped = `${new Date().toISOString()} step ${step}: ${line}`
  lines.value.push(stamped)
  console.log('[spike]', stamped)
}

function describeFailure(failure: unknown): string {
  if (failure instanceof GoogleApiError) {
    return `HTTP ${failure.status}: ${failure.body}`
  }
  return failure instanceof Error ? failure.message : String(failure)
}

async function runStep(step: number, action: (stepNote: Note) => Promise<void>): Promise<void> {
  running.value = step
  try {
    await action((line) => note(step, line))
  } catch (failure) {
    note(step, `FAILED ${describeFailure(failure)}`)
  } finally {
    running.value = null
  }
}

function requireToken(): AccessToken {
  const token = currentAccessToken()
  if (token === null) {
    throw new Error('No valid token in memory. Run step 1 first.')
  }
  return token
}

function requireStored(): SelectedWorkbook {
  if (stored.value === null) {
    throw new Error('No stored spreadsheet. Run step 2 first.')
  }
  return stored.value
}

async function pickOne(kind: 'spreadsheet' | 'folder', token: AccessToken, stepNote: Note): Promise<PickedDocument | null> {
  const picked = await pickFromDrive(kind, token.value)
  const [first] = picked
  if (first === undefined) {
    stepNote('picker cancelled')
    return null
  }
  stepNote(`picked ${first.name} (${first.id}, ${first.mimeType})`)
  return first
}

function signIn(): Promise<void> {
  return runStep(1, async (stepNote) => {
    const token = await requestToken('select_account')
    stepNote(`granted scope "${token.grantedScope}", expires_in ${token.expiresInSeconds} s`)
  })
}

function pickAndReadLedger(): Promise<void> {
  return runStep(2, async (stepNote) => {
    const token = requireToken()
    const spreadsheet = await pickOne('spreadsheet', token, stepNote)
    if (spreadsheet === null) {
      return
    }
    saveSelectedWorkbook({ id: spreadsheet.id, name: spreadsheet.name })
    stored.value = loadSelectedWorkbook()
    stepNote('stored the id and name in localStorage')

    const summary = await getSpreadsheetSummary(token.value, spreadsheet.id)
    stepNote(`spreadsheets.get: "${summary.title}" with tabs ${JSON.stringify(summary.sheetTitles)}`)

    const [head, dates] = await batchGetValues(token.value, spreadsheet.id, [LEDGER_HEAD_RANGE, LEDGER_DATE_COLUMN])
    const [header = [], ...firstRows] = head?.values ?? []
    stepNote(`header: ${JSON.stringify(header)}`)
    firstRows.forEach((row, index) => stepNote(`row ${index + 2}: ${JSON.stringify(row)}`))
    stepNote(`total data rows (non-empty column A): ${Math.max((dates?.values.length ?? 0) - 1, 0)}`)
  })
}

function rereadStoredWithoutPicker(): Promise<void> {
  return runStep(3, async (stepNote) => {
    const token = requireToken()
    const spreadsheet = requireStored()
    stepNote(`stored id ${spreadsheet.id}`)
    try {
      const file = await getFile(token.value, spreadsheet.id)
      stepNote(`files.get ok: ${file.name} (${file.mimeType})`)
    } catch (failure) {
      stepNote(`files.get FAILED ${describeFailure(failure)}`)
    }
    try {
      const [header] = await batchGetValues(token.value, spreadsheet.id, ['ledger!1:1'])
      stepNote(`values.get ok: ${JSON.stringify(header?.values[0] ?? [])}`)
    } catch (failure) {
      stepNote(`values.get FAILED ${describeFailure(failure)}`)
    }
  })
}

function writeAndReadBack(): Promise<void> {
  return runStep(4, async (stepNote) => {
    const token = requireToken()
    const range = writeRange.value.trim()
    if (range === '') {
      throw new Error('Type a range first, for example ledger!I2.')
    }
    const spreadsheet = await pickOne('spreadsheet', token, stepNote)
    if (spreadsheet === null) {
      return
    }
    const result = await batchUpdateValues(token.value, spreadsheet.id, [{ range, values: [[writeValue.value]] }])
    stepNote(`batchUpdate wrote ${result.totalUpdatedCells} cell(s) to ${range}`)
    const [readBack] = await batchGetValues(token.value, spreadsheet.id, [range])
    stepNote(`read back ${readBack?.range ?? range}: ${JSON.stringify(readBack?.values ?? [])}`)
  })
}

function pickFolderAndListChildren(): Promise<void> {
  return runStep(5, async (stepNote) => {
    const token = requireToken()
    const folder = await pickOne('folder', token, stepNote)
    if (folder === null) {
      return
    }
    const children = await listChildren(token.value, folder.id)
    stepNote(`files.list returned ${children.length} child(ren)`)
    children.slice(0, 10).forEach((child) => stepNote(`  ${child.name} (${child.id}, ${child.mimeType})`))
    for (const child of children.slice(0, 3)) {
      try {
        const file = await getFile(token.value, child.id)
        stepNote(`files.get ${child.id} ok: ${file.name}`)
      } catch (failure) {
        stepNote(`files.get ${child.id} FAILED ${describeFailure(failure)}`)
      }
    }
  })
}

function exportStoredAsXlsx(): Promise<void> {
  return runStep(6, async (stepNote) => {
    const token = requireToken()
    const spreadsheet = requireStored()
    const workbook = await exportAsXlsx(token.value, spreadsheet.id)
    stepNote(`files.export returned ${workbook.size} bytes (${workbook.type})`)
    const url = URL.createObjectURL(workbook)
    const link = document.createElement('a')
    link.href = url
    link.download = 'ledgerboard-export.xlsx'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    stepNote('download triggered as ledgerboard-export.xlsx')
  })
}

function renewSilently(): Promise<void> {
  return runStep(7, async (stepNote) => {
    const startedAt = performance.now()
    const token = await requestToken('')
    const elapsed = Math.round(performance.now() - startedAt)
    stepNote(`token returned after ${elapsed} ms, expires_in ${token.expiresInSeconds} s. Did a popup show?`)
  })
}

onMounted(() => {
  prepareGoogleIdentity().catch((failure: unknown) => note(0, `GIS load FAILED ${describeFailure(failure)}`))
  preparePicker().catch((failure: unknown) => note(0, `Picker load FAILED ${describeFailure(failure)}`))
})
</script>

<template>
  <section class="space-y-6">
    <div>
      <h1 data-testid="screen-title" class="text-2xl font-semibold text-highlighted">Spike</h1>
      <p class="mt-2 text-muted">
        Development only. Each button runs one step against Google and appends what it saw below.
      </p>
      <p class="mt-1 text-sm text-muted">
        Stored spreadsheet: <span class="text-highlighted">{{ stored === null ? 'none' : `${stored.name} (${stored.id})` }}</span>
      </p>
    </div>

    <UCard>
      <ol class="space-y-3">
        <li class="flex flex-wrap items-center gap-3">
          <UButton :disabled="running !== null" @click="signIn">1. Sign in</UButton>
          <span class="text-sm text-muted">Shows the granted scope and expires_in.</span>
        </li>
        <li class="flex flex-wrap items-center gap-3">
          <UButton :disabled="running !== null" @click="pickAndReadLedger">2. Pick and read ledger</UButton>
          <span class="text-sm text-muted">Stores the id, reads the header, five rows and the row count.</span>
        </li>
        <li class="flex flex-wrap items-center gap-3">
          <UButton :disabled="running !== null" @click="rereadStoredWithoutPicker">3. Re-read stored id</UButton>
          <span class="text-sm text-muted">files.get and the header row, without the Picker.</span>
        </li>
        <li class="flex flex-wrap items-center gap-3">
          <UInput v-model="writeRange" aria-label="Range to write" placeholder="ledger!I2" class="w-40" />
          <UInput v-model="writeValue" aria-label="Value to write" placeholder="value" class="w-40" />
          <UButton :disabled="running !== null" @click="writeAndReadBack">4. Pick a copy, write, read back</UButton>
        </li>
        <li class="flex flex-wrap items-center gap-3">
          <UButton :disabled="running !== null" @click="pickFolderAndListChildren">5. Pick folder, list children</UButton>
          <span class="text-sm text-muted">files.list, then files.get on the first three.</span>
        </li>
        <li class="flex flex-wrap items-center gap-3">
          <UButton :disabled="running !== null" @click="exportStoredAsXlsx">6. Export stored as xlsx</UButton>
          <span class="text-sm text-muted">Downloads ledgerboard-export.xlsx.</span>
        </li>
        <li class="flex flex-wrap items-center gap-3">
          <UButton :disabled="running !== null" @click="renewSilently">7. Silent renew</UButton>
          <span class="text-sm text-muted">requestToken with prompt ''. Watch for a popup.</span>
        </li>
      </ol>
    </UCard>

    <UCard>
      <template #header>
        <h2 class="font-medium text-highlighted">Results</h2>
      </template>
      <p v-if="lines.length === 0" class="text-sm text-muted">Nothing run yet.</p>
      <ul v-else class="space-y-1 font-mono text-xs break-all">
        <li v-for="(line, index) in lines" :key="index">{{ line }}</li>
      </ul>
    </UCard>
  </section>
</template>
