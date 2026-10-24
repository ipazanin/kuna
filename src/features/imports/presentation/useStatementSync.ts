import { computed, shallowReactive, shallowReadonly } from 'vue'
import type { ComputedRef } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@nuxt/ui/composables/useToast'

import { currentDriveReadToken, driveReadAccess, requestDriveReadToken } from '../../../shared/google/googleAuth'
import type { DriveReadAccess } from '../../../shared/google/googleAuth'
import { noteDriveReadRefused } from '../../../shared/google/googleRedirect'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { needsReview } from '../../workbook/domain/needsReview'
import { useRecordWrites } from '../../workbook/presentation/useRecordWrites'
import { dryRunFor } from '../application/importStatements'
import { fileNewStatements, stillHeld } from '../application/statementSync'
import type { StatementSyncOutcome, StatementSyncStep } from '../application/statementSync'
import type { StatementFolder } from '../application/statementFolder'
import type { DryRunStatement } from '../domain/importDryRun'
import { googleStatementFolder } from '../infrastructure/googleStatementFolder'
import { loadImportFile } from '../infrastructure/importFiles'

interface StatementSyncState {
  /** What the statements step is doing while it runs, or null. */
  readonly step: StatementSyncStep | null
  /** What the last statements step of this page did, or null before one ran. */
  readonly outcome: StatementSyncOutcome | null
  /** Whether this page can read the statements folder, as it stood at the last look. */
  readonly access: DriveReadAccess
}

const state = shallowReactive<{ -readonly [Field in keyof StatementSyncState]: StatementSyncState[Field] }>({ step: null, outcome: null, access: 'not-asked' })
let running: Promise<void> | null = null

/** Whether the page can read the folder. The fake build never goes to Google and reads its own folder, unless this tab noted a refusal. */
function statementsAccess(): DriveReadAccess {
  const access = driveReadAccess()
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    return access === 'needs-consent' ? access : 'held'
  }
  return access
}

async function openStatementFolder(): Promise<StatementFolder> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeStatementFolder } = await import('../infrastructure/fake/fakeStatementFolder')
    return fakeStatementFolder(new URLSearchParams(window.location.search).get('fake'))
  }
  const token = currentDriveReadToken()
  if (token === null) {
    throw new Error('The Drive read access ran out. Check for new statements again.')
  }
  return googleStatementFolder(token)
}

/** Asks for the Drive read token with Google's consent screen when it needs one. The fake build only forgets the refusal. */
async function askForAccess(): Promise<void> {
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    noteDriveReadRefused(false)
    return
  }
  await requestDriveReadToken()
}

export interface StatementSync {
  readonly state: Readonly<StatementSyncState>
  /** The statements the last sync held, as they stand against the workbook on screen now, or null. */
  readonly held: ComputedRef<readonly DryRunStatement[] | null>
  /** What to say while a sync of the file on Drive cannot read the statements folder, or null. */
  readonly unchecked: ComputedRef<string | null>
  /** Reads the file on Drive, then files the new statements of the folder while the page can read it. A second call while one runs waits on it. */
  sync(): Promise<void>
  /** The Sync button: with no file chosen it finds the file on Drive, otherwise a sync, and when the page cannot read the folder, a toast that offers to check it. */
  syncByHand(): Promise<void>
  /** Asks for the Drive read token, with Google's consent screen when needed, then syncs. Call it first in a click handler. */
  checkForNewStatements(): Promise<void>
}

/** The statements step of a sync, after the file is read, and what it did, shared by the whole page. A workbook kept in this browser has no sync. */
export function useStatementSync(): StatementSync {
  const store = useWorkbook()
  const writes = useRecordWrites()
  const toast = useToast()
  const router = useRouter()
  state.access = statementsAccess()

  const held = computed(() => {
    const workbook = store.state.workbook
    const readings = state.outcome?.held ?? []
    if (workbook === null || readings.length === 0) return null
    return dryRunFor(readings, workbook, new Map()).statements.filter(stillHeld)
  })

  const unchecked = computed(() => {
    if (store.state.choice?.source !== 'drive' || state.step !== null) return null
    switch (state.access) {
      case 'held':
        return null
      case 'needs-consent':
        return 'New statements in Drive wait for your Drive read access'
      case 'not-asked':
        return 'New statements in Drive are not checked yet'
    }
  })

  function announce(outcome: StatementSyncOutcome): void {
    if (outcome.receipt === null) return
    const keys = new Set(outcome.filed.flatMap((statement) => statement.rows.filter((row) => row.verdict !== null).map((row) => `${statement.account}|${row.reference}`)))
    const waiting = (store.state.workbook?.transactions ?? []).filter((row) => keys.has(`${row.account}|${row.reference}`) && needsReview(row)).length
    const heldCount = outcome.held.length
    const description = [
      waiting === 0 ? '' : `${waiting} ${waiting === 1 ? 'row waits' : 'rows wait'} on Review.`,
      ...outcome.filed.flatMap((statement) => statement.notes),
      heldCount === 0 ? '' : `${heldCount === 1 ? '1 statement was' : `${heldCount} statements were`} not filed. Import on Transactions says why.`,
    ]
      .filter((sentence) => sentence !== '')
      .join(' ')
    writes.announce(outcome.receipt, {
      description: description || 'The rules settled every new row.',
      ...(waiting > 0
        ? { follow: { label: 'Open Review', icon: 'i-lucide-inbox', run: () => void router.push('/review') } }
        : heldCount > 0
          ? { follow: { label: 'Open Import', icon: 'i-lucide-file-input', run: () => void router.push({ path: '/transactions', query: { tab: 'import' } }) } }
          : {}),
    })
  }

  async function fileStatements(): Promise<void> {
    if (store.state.choice?.source !== 'drive' || store.state.status !== 'ready' || store.state.workbook === null) return
    state.access = statementsAccess()
    if (state.access !== 'held') return
    state.step = { kind: 'looking' }
    try {
      const outcome = await fileNewStatements({
        store,
        folder: await openStatementFolder(),
        load: loadImportFile,
        step: (step) => {
          state.step = step
        },
      })
      state.outcome = outcome
      announce(outcome)
    } catch (failure) {
      state.outcome = { problem: failure instanceof Error ? failure.message : String(failure), held: [], filed: [], receipt: null }
    } finally {
      state.step = null
    }
  }

  function sync(): Promise<void> {
    running ??= (async () => {
      try {
        await store.sync()
        await fileStatements()
      } finally {
        running = null
      }
    })()
    return running
  }

  async function checkForNewStatements(): Promise<void> {
    try {
      await askForAccess()
    } catch (failure) {
      state.access = statementsAccess()
      toast.add({ title: 'No Drive read access', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
      return
    }
    await sync()
  }

  return {
    state: shallowReadonly(state),
    held,
    unchecked,
    sync,
    async syncByHand() {
      if (store.state.choice === null) {
        await store.chooseDriveFile()
        return
      }
      await sync()
      if (store.state.choice?.source !== 'drive' || store.state.status !== 'ready' || state.access === 'held') return
      toast.add({
        title: 'New statements not checked',
        description: 'Reading the statements folder in Drive needs your Drive read access on this page.',
        icon: 'i-lucide-folder-search',
        color: 'neutral',
        duration: 10_000,
        actions: [{ label: 'Check for new statements', icon: 'i-lucide-folder-search', color: 'neutral', variant: 'outline', onClick: () => void checkForNewStatements() }],
      })
    },
    checkForNewStatements,
  }
}
