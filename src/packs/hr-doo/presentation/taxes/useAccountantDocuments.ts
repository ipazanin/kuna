import { computed, shallowReactive, shallowReadonly } from 'vue'
import type { ComputedRef } from 'vue'

import { currentDriveReadToken } from '../../../../shared/google/googleAuth'
import { keepDriveRead, keptDriveRead } from '../../../../shared/google/driveReads'
import { counted } from '../../../../features/overview/presentation/waitingForYou'
import type { StepResult } from '../../../../features/sync/domain/syncRun'
import { useWorkbook } from '../../../../features/workbook/application/workbookStore'
import type { Workbook } from '../../../../features/workbook/domain/workbook'
import { accountantDocumentsOf, readAccountantDocuments } from '../../application/accountantDocuments'
import type { AccountantDocuments, AccountantFolderPaths, AccountantFolders, AccountantRead } from '../../application/accountantDocuments'
import { hrDooWorkbook } from '../../domain/hrDooPart'
import { googleAccountantFolders } from '../../infrastructure/googleAccountantFolders'

/** The name the last read is kept under on this device. A change to `AccountantRead` changes the number, so an older read is never taken for the new shape. */
const KEPT_READ = 'hr-doo.accountant.1'

interface AccountantDocumentsState {
  /** The last read of the folders the settings name: this page's, or the one this device kept. Null before any. */
  readonly read: AccountantRead | null
  /** Whether `read` came from Drive on this page, rather than from this device. */
  readonly readHere: boolean
  readonly reading: boolean
  /** Why the last read on this page failed, or null. */
  readonly problem: string | null
}

const state = shallowReactive<{ -readonly [Field in keyof AccountantDocumentsState]: AccountantDocumentsState[Field] }>({ read: null, readHere: false, reading: false, problem: null })
let keptLoaded: Promise<void> | null = null

function loadKeptRead(): Promise<void> {
  keptLoaded ??= (async () => {
    const kept = (await keptDriveRead(KEPT_READ)) as AccountantRead | null
    if (state.read === null && kept !== null) state.read = kept
  })()
  return keptLoaded
}

async function openFolders(): Promise<AccountantFolders> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeAccountantFolders } = await import('../../infrastructure/fake/fakeAccountantFolders')
    return fakeAccountantFolders()
  }
  const token = currentDriveReadToken()
  if (token === null) {
    throw new Error('The Drive read access ran out. Sync again.')
  }
  return googleAccountantFolders(token)
}

function sameFolders(first: AccountantFolderPaths, second: AccountantFolderPaths): boolean {
  return first.vatReturns.join('/') === second.vatReturns.join('/') && first.payroll.join('/') === second.payroll.join('/')
}

function foldersOf(workbook: Workbook): AccountantFolderPaths {
  const { companyFacts } = hrDooWorkbook(workbook)
  return { vatReturns: companyFacts.vatReturnsFolder, payroll: companyFacts.payrollFolder }
}

/**
 * The accountant step of a sync: reads the two folders the settings name, the files whose Drive
 * version is the same taken from the last read, and keeps the read on this device. A folder that
 * could not be listed waits for you, with Year, Taxes to see it.
 */
export async function readAccountantFiles(): Promise<StepResult> {
  const workbook = useWorkbook().state.workbook
  if (workbook === null) {
    return { kind: 'done', line: 'Nothing to read before the books are read', writeId: null, link: null }
  }
  await loadKeptRead()
  state.reading = true
  try {
    const startedAt = Date.now()
    const read = await readAccountantDocuments(await openFolders(), foldersOf(workbook), state.read, new Date(startedAt).toISOString())
    state.read = read
    state.readHere = true
    state.problem = null
    await keepDriveRead(KEPT_READ, read, startedAt)
    const line = `Read ${counted(read.files.length, '1 workbook', 'workbooks')}.`
    const problems = [read.folderProblems.vatReturns, read.folderProblems.payroll].filter((problem) => problem !== null)
    return problems.length === 0
      ? { kind: 'done', line, writeId: null, link: null }
      : { kind: 'waits', line: [line, ...problems].join(' '), writeId: null, link: { label: 'Year, Taxes', to: '/year?tab=taxes' } }
  } catch (failure) {
    state.problem = failure instanceof Error ? failure.message : String(failure)
    throw failure
  } finally {
    state.reading = false
  }
}

export interface AccountantDocumentsView {
  readonly state: Readonly<AccountantDocumentsState>
  /** The returns and salaries of the last read, or null before any. */
  readonly documents: ComputedRef<AccountantDocuments | null>
  /** Whether the workbook is a file on Drive, the only kind whose cards read Drive. */
  readonly shows: ComputedRef<boolean>
}

/**
 * The accountant's workbooks for Year, Taxes, shared by the page: the read of the last sync, or
 * until one the read this device kept.
 */
export function useAccountantDocuments(): AccountantDocumentsView {
  const store = useWorkbook()
  void loadKeptRead()
  return {
    state: shallowReadonly(state),
    documents: computed(() => {
      const workbook = store.state.workbook
      const read = state.read
      return read === null || workbook === null || !sameFolders(read.folders, foldersOf(workbook)) ? null : accountantDocumentsOf(read)
    }),
    shows: computed(() => store.state.choice?.source === 'drive' && store.state.workbook !== null),
  }
}
