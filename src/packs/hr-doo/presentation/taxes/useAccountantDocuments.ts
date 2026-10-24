import { computed, shallowReactive, shallowReadonly, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { currentDriveReadToken } from '../../../../shared/google/googleAuth'
import type { DriveReadAccess } from '../../../../shared/google/googleAuth'
import { keepDriveRead, keptDriveRead } from '../../../../shared/google/driveReads'
import { useStatementSync } from '../../../../features/imports/presentation/useStatementSync'
import { AUTO_SYNC_INTERVAL_MS } from '../../../../features/workbook/application/autoSync'
import { useWorkbook } from '../../../../features/workbook/application/workbookStore'
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
let running: Promise<void> | null = null

async function openFolders(): Promise<AccountantFolders> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeAccountantFolders } = await import('../../infrastructure/fake/fakeAccountantFolders')
    return fakeAccountantFolders()
  }
  const token = currentDriveReadToken()
  if (token === null) {
    throw new Error('The Drive read access ran out. Check for new statements again.')
  }
  return googleAccountantFolders(token)
}

function sameFolders(first: AccountantFolderPaths, second: AccountantFolderPaths): boolean {
  return first.vatReturns.join('/') === second.vatReturns.join('/') && first.payroll.join('/') === second.payroll.join('/')
}

export interface AccountantDocumentsView {
  readonly state: Readonly<AccountantDocumentsState>
  /** The returns and salaries of the last read, or null before any. */
  readonly documents: ComputedRef<AccountantDocuments | null>
  /** Whether the page can read Drive, as the statements step last saw it. */
  readonly access: ComputedRef<DriveReadAccess>
  /** Whether the workbook is a file on Drive, the only kind whose cards read Drive. */
  readonly shows: ComputedRef<boolean>
  /** Reads the folders again, the files whose Drive version is the same taken from the last read. */
  readAgain(): Promise<void>
  /** Asks for the Drive read token as the statements step does, then syncs, after which the cards read. Call it first in a click handler. */
  checkForNewStatements(): Promise<void>
}

/**
 * The accountant's workbooks for Year, Taxes, shared by the page. Opening Taxes shows the read this
 * device kept, then reads Drive while the page holds the Drive read token, at most once every ten
 * minutes as a sync does. A read takes again from Drive only the files whose version changed.
 */
export function useAccountantDocuments(): AccountantDocumentsView {
  const store = useWorkbook()
  const statements = useStatementSync()
  const shows = computed(() => store.state.choice?.source === 'drive' && store.state.workbook !== null)
  const folders = computed((): AccountantFolderPaths | null => {
    const workbook = store.state.workbook
    if (workbook === null) return null
    const { companyFacts } = hrDooWorkbook(workbook)
    return { vatReturns: companyFacts.vatReturnsFolder, payroll: companyFacts.payrollFolder }
  })

  async function read(): Promise<void> {
    const paths = folders.value
    if (paths === null) return
    running ??= (async () => {
      state.reading = true
      try {
        const startedAt = Date.now()
        const read = await readAccountantDocuments(await openFolders(), paths, state.read, new Date(startedAt).toISOString())
        state.read = read
        state.readHere = true
        state.problem = null
        await keepDriveRead(KEPT_READ, read, startedAt)
      } catch (failure) {
        state.problem = failure instanceof Error ? failure.message : String(failure)
      } finally {
        state.reading = false
        running = null
      }
    })()
    await running
  }

  async function readWhenDue(): Promise<void> {
    keptLoaded ??= (async () => {
      const kept = (await keptDriveRead(KEPT_READ)) as AccountantRead | null
      if (state.read === null && kept !== null) state.read = kept
    })()
    await keptLoaded
    const paths = folders.value
    const last = state.readHere ? state.read : null
    const due = paths !== null && (last === null || !sameFolders(last.folders, paths) || Date.now() - Date.parse(last.readAt) >= AUTO_SYNC_INTERVAL_MS)
    if (due && shows.value && statements.state.access === 'held') {
      await read()
    }
  }

  void readWhenDue()
  watch(
    () => [statements.state.access, folders.value] as const,
    () => void readWhenDue(),
  )

  return {
    state: shallowReadonly(state),
    documents: computed(() => {
      const paths = folders.value
      const read = state.read
      return read === null || paths === null || !sameFolders(read.folders, paths) ? null : accountantDocumentsOf(read)
    }),
    access: computed(() => statements.state.access),
    shows,
    readAgain: read,
    checkForNewStatements: statements.checkForNewStatements,
  }
}
