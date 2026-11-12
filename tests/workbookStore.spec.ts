import { BACKUPS_FOLDER } from '../src/shared/storage/infrastructure/driveDocument'
import { words as storageInfrastructureWords } from '../src/shared/storage/infrastructure/words'
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ACCOUNT_WRITES, CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { BooksAlreadyOnDrive } from '../src/shared/storage/application/booksAlreadyOnDrive'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import { words as storageWords } from '../src/shared/storage/application/words'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { createWorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { WorkbookStore, WorkbookStorePorts } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import type { WorkbookChoice } from '../src/shared/storage/application/workbookPorts'
import { deleteBrowserDocument } from '../src/shared/storage/infrastructure/browserDocument'
import { decodeDocument, encodeDocument } from '../src/shared/storage/infrastructure/documentFormat'
import type { DocumentRecord, WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import type { DocumentCopy } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { COMPANY_APP } from '../src/apps/company/workbook/domain/companyApp'
import { COMPANY_DOCUMENT, installedSchema } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { documentStorePorts } from '../src/shared/storage/infrastructure/documentStorePorts'
import type { DriveAccess } from '../src/shared/storage/infrastructure/documentStorePorts'
import type { RedirectResume } from '../src/shared/google/googleRedirect'
import { createDriveDocument } from '../src/shared/storage/infrastructure/driveDocument'
import type { DocumentDrive } from '../src/shared/storage/infrastructure/driveDocument'
import { createFakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import type { FakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import { openWorkbookCache } from '../src/shared/storage/infrastructure/workbookCache'
import { ASSET_WRITES, GRANT_WRITES, YEAR_END_WRITES } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { addRows, editRow } from './fixtures/recordWrites'
import { recordOf } from './fixtures/records'

const used = new Set<string>()

const accountOf = (name: string) => recordOf(ACCOUNT_WRITES.kind, { account: name, iban: '' })

function documentOf(amounts: readonly number[]): WorkbookDocument {
  return newDocument(
    COMPANY_APP,
    installedSchema(),
    {
      'ledger-row': amounts.map((amount, index) => ({ date: `2026-10-${String(10 - index).padStart(2, '0')}`, account: 'main', amount: amount.toFixed(2), balance: '100.00', category: 'revenue' })),
      category: [{ category: 'revenue', family: 'income', bucket: 'income' }],
      account: [{ account: 'main', iban: 'XX00FAKE0001' }],
    },
    '2026-10-15T06:00:00.000Z',
  )
}

/** Drive as the store reaches it, which a test can make fail or race. */
interface DriveSide {
  readonly drive: FakeDrive
  access: DriveAccess
  /** Runs before each request the store sends to Drive, with its name. */
  before: (request: keyof DocumentDrive) => Promise<void>
  pickedFile: string | null
  pickedFolder: string | null
  /** Whether the page's token can read the whole Drive, which the path of a picked folder needs. */
  readsDrive: boolean
  /** What each sign-in would resume after a redirect, in order. */
  readonly signIns: (RedirectResume | null)[]
}

function driveSide(): DriveSide {
  const drive = createFakeDrive()
  const side: DriveSide = {
    drive,
    before: async () => {},
    pickedFile: null,
    pickedFolder: null,
    readsDrive: false,
    signIns: [],
    access: {
      drive: new Proxy(drive, {
        get(target, name) {
          const member = Reflect.get(target, name) as unknown
          return typeof member === 'function'
            ? async (...parameters: unknown[]) => {
                await side.before(name as keyof DocumentDrive)
                return (member as (...given: unknown[]) => unknown).apply(target, parameters)
              }
            : member
        },
      }),
      signIn: async (then) => {
        side.signIns.push(then)
      },
      signedIn: () => true,
      pickFolder: async () => (side.pickedFolder === null ? null : { id: side.pickedFolder, name: drive.file(side.pickedFolder).name }),
      async folderPath(folderId) {
        if (!side.readsDrive) return null
        const names: string[] = []
        for (let current = folderId; current !== 'root'; current = drive.file(current).parents[0]!) names.unshift(drive.file(current).name)
        return names
      },
      pickFile: async () => side.pickedFile,
    },
  }
  return side
}

interface Harness {
  readonly ports: WorkbookStorePorts<CompanyBooks, DocumentCopy, WorkbookDocument>
  readonly chosen: () => WorkbookChoice | null
  readonly side: DriveSide
  /** How long each pause before a retry asked to wait, in order. */
  readonly pauses: number[]
  /** Moves the clock the store reads. */
  readonly setNow: (iso: string) => void
}

function harness(initial: WorkbookChoice | null, side = driveSide()): Harness {
  let remembered = initial
  let now = '2026-10-16T09:00:00.000Z'
  let nextLocal = 0
  const pauses: number[] = []
  const documents = documentStorePorts(
    COMPANY_APP,
    COMPANY_DOCUMENT,
    async () => side.access,
    () => now,
  )
  return {
    chosen: () => remembered,
    side,
    pauses,
    setNow: (iso) => {
      now = iso
    },
    ports: {
      ...documents,
      openCache: (id) => {
        used.add(id)
        return documents.openCache(id)
      },
      loadChoice: () => remembered,
      saveChoice: (choice) => {
        remembered = choice
      },
      prepareSync: () => {},
      hasLiveAccessToken: () => false,
      keptInBrowser: () => {},
      newLocalId: () => {
        nextLocal += 1
        used.add(`local-${nextLocal}`)
        return `local-${nextLocal}`
      },
      now: () => now,
      pause: async (milliseconds) => {
        pauses.push(milliseconds)
      },
      requestPersistentStorage: () => {},
    },
  }
}

/** The books as a file in a folder of the side's Drive, read once on this device, so its copy is in the cache. */
async function onDrive(side: DriveSide, document: WorkbookDocument, extra: Partial<DocumentCopy['meta']> = {}): Promise<WorkbookChoice> {
  const folderId = await side.drive.createFolder('root', 'books')
  const { fileId, document: stored } = await createDriveDocument(side.drive, folderId, COMPANY_APP, encodeDocument(document))
  used.add(fileId)
  const cache = openWorkbookCache(fileId)
  await cache.replace({
    meta: { id: fileId, source: 'drive', title: 'kuna-company.json', syncedAt: '2026-10-15T06:00:00.000Z', lastExportedAt: null, unexportedSince: null, ...extra },
    revision: stored.revision,
    document,
  })
  cache.close()
  side.drive.requests.length = 0
  return { source: 'drive', id: fileId, name: 'kuna-company.json' }
}

/** Another device saves the file with these records added. */
async function savedElsewhere(drive: FakeDrive, fileId: string, kind: string, ...records: DocumentRecord[]): Promise<void> {
  const held = decodeDocument(await drive.download(fileId))
  await drive.upload(fileId, encodeDocument({ ...held, records: { ...held.records, [kind]: [...(held.records[kind] ?? []), ...records] } }))
}

async function storedCopy(id: string): Promise<DocumentCopy | null> {
  const cache = openWorkbookCache(id)
  try {
    return await cache.read()
  } finally {
    cache.close()
  }
}

function storeOf(ports: WorkbookStorePorts<CompanyBooks, DocumentCopy, WorkbookDocument>): WorkbookStore<CompanyBooks, DocumentCopy, WorkbookDocument> {
  return createWorkbookStore(ports)
}

afterEach(async () => {
  for (const id of used) {
    await openWorkbookCache(id).delete()
    await deleteBrowserDocument(id)
  }
  used.clear()
})

describe('workbook store with a Drive file', () => {
  it('shows the cached copy on open, with the time it was read, before any request to Drive', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([7200, -150]))
    side.before = async () => {
      throw new Error('open must not read Drive')
    }
    const store = storeOf(harness(choice, side).ports)

    await store.open()

    expect(store.state.status).toBe('ready')
    expect(store.state.syncedAt).toBe('2026-10-15T06:00:00.000Z')
    expect(store.state.workbook?.transactions.map((transaction) => transaction.amount)).toEqual([720000, -15000])
  })

  it('opens empty when this browser has never chosen a workbook', async () => {
    const store = storeOf(harness(null).ports)

    await store.open()

    expect(store.state).toMatchObject({ status: 'ready', workbook: null, syncedAt: null, choice: null, error: null })
  })

  it('opens once however many screens ask', async () => {
    let reads = 0
    const { ports } = harness(null)
    const store = storeOf({
      ...ports,
      loadChoice: () => {
        reads += 1
        return null
      },
    })

    await Promise.all([store.open(), store.open(), store.open()])

    expect(reads).toBe(1)
  })

  it('downloads nothing on a sync while the file stands at the revision it holds', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([5]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    await store.sync()

    expect(side.drive.requests.filter((request) => request !== 'appPropertyOf')).toEqual(['headRevision'])
    expect(store.state.syncedAt).toBe('2026-10-16T09:00:00.000Z')
  })

  it('replaces the cache and the screen with another device’s save on sync, keeping the export history', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1, 2, 3]), { lastExportedAt: '2026-10-10T12:00:00.000Z' })
    await side.drive.upload(choice.id, encodeDocument(documentOf([9])))
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    await store.sync()

    expect(store.state.workbook?.transactions).toHaveLength(1)
    const stored = await storedCopy(choice.id)
    expect(stored?.document.records['ledger-row']).toHaveLength(1)
    expect(stored?.revision).toBe(side.drive.file(choice.id).headRevisionId)
    expect(stored?.meta.lastExportedAt).toBe('2026-10-10T12:00:00.000Z')
  })

  it('reports a failed sync and keeps the cached copy on screen', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([5]))
    side.before = async () => {
      throw new Error('403 from /drive/v3/files: The caller does not have permission')
    }
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    await store.sync()

    expect(store.state.status).toBe('error')
    expect(store.state.error).toMatch(/^403/)
    expect(store.state.workbook?.transactions).toHaveLength(1)
  })

  it('finds the app’s file by its mark on a second device, and keeps the chosen workbook when the search and the Picker find none', async () => {
    const side = driveSide()
    const { ports, chosen } = harness(null, side)
    const store = storeOf(ports)
    await store.open()

    await store.chooseDriveFile('find')
    expect(store.state).toMatchObject({ status: 'ready', choice: null, workbook: null })

    const folderId = await side.drive.createFolder('root', 'books')
    const { fileId } = await createDriveDocument(side.drive, folderId, COMPANY_APP, encodeDocument(documentOf([1, 2])))
    used.add(fileId)
    await store.chooseDriveFile('find')

    expect(chosen()).toEqual({ source: 'drive', id: fileId, name: 'kuna-company.json' })
    expect(store.state.workbook?.transactions).toHaveLength(2)
  })

  it('refuses a backup or another app’s file picked when the search finds none, and keeps the chosen workbook', async () => {
    const side = driveSide()
    const { ports, chosen } = harness(null, side)
    const store = storeOf(ports)
    await store.open()
    const folderId = await side.drive.createFolder('root', 'backups')
    const backup = await side.drive.createFile(folderId, 'kuna-company-2026-10-24.json', encodeDocument(documentOf([1])))
    const personal = await side.drive.createFile(folderId, 'kuna-personal.json', encodeDocument({ ...documentOf([1]), app: 'personal' }))
    used.add(backup.id)
    used.add(personal.id)

    side.pickedFile = backup.id
    await store.chooseDriveFile('find')
    expect(store.state.error).toMatch(/kuna-company-2026-10-24\.json is a backup/)

    side.pickedFile = personal.id
    await store.chooseDriveFile('find')
    expect(store.state.error).toMatch(/another Kuna app, personal/)
    expect(chosen()).toBeNull()
    expect(store.state.workbook).toBeNull()
  })

  it('opens the file picked when asked to pick, even while Drive holds the file the app marked', async () => {
    const side = driveSide()
    const { ports, chosen } = harness(null, side)
    const store = storeOf(ports)
    await store.open()
    const marked = await onDrive(side, documentOf([1]))
    await store.chooseDriveFile('find')
    expect(chosen()).toEqual(marked)
    const folderId = await side.drive.createFolder('root', 'copies')
    const copy = await side.drive.createFile(folderId, 'kuna-company copy.json', encodeDocument(documentOf([1, 2, 3])))
    used.add(copy.id)

    side.pickedFile = copy.id
    await store.chooseDriveFile('pick')

    expect(chosen()).toEqual({ source: 'drive', id: copy.id, name: 'kuna-company copy.json' })
    expect(store.state.workbook?.transactions).toHaveLength(3)
    expect(side.signIns).toEqual([
      { resume: 'find', app: 'company' },
      { resume: 'pick', app: 'company' },
    ])
  })

  it('refuses a backup, another app’s file or a JSON file that is no Kuna file picked, and keeps the workbook on screen', async () => {
    const side = driveSide()
    const { ports, chosen } = harness(null, side)
    const store = storeOf(ports)
    await store.open()
    const marked = await onDrive(side, documentOf([1]))
    await store.chooseDriveFile('find')
    const folderId = await side.drive.createFolder('root', 'elsewhere')
    const backup = await side.drive.createFile(folderId, 'kuna-company-2026-10-24.json', encodeDocument(documentOf([1, 2])))
    const personal = await side.drive.createFile(folderId, 'kuna-personal.json', encodeDocument({ ...documentOf([1, 2]), app: 'personal' }))
    const settings = await side.drive.createFile(folderId, 'settings.json', JSON.stringify({ theme: 'dark' }))
    used.add(backup.id)
    used.add(personal.id)
    used.add(settings.id)

    side.pickedFile = backup.id
    await store.chooseDriveFile('pick')
    expect(store.state.error).toMatch(/kuna-company-2026-10-24\.json is a backup/)

    side.pickedFile = personal.id
    await store.chooseDriveFile('pick')
    expect(store.state.error).toMatch(/another Kuna app, personal/)

    side.pickedFile = settings.id
    await store.chooseDriveFile('pick')
    expect(store.state.error).toBe('The file is not a Kuna file.')

    expect(chosen()).toEqual(marked)
    expect(store.state.workbook?.transactions).toHaveLength(1)
  })

  it('changes nothing when the Picker is cancelled', async () => {
    const side = driveSide()
    const { ports, chosen } = harness(null, side)
    const store = storeOf(ports)
    await store.open()
    const marked = await onDrive(side, documentOf([1]))
    await store.chooseDriveFile('find')
    const before = store.state.snapshot

    side.pickedFile = null
    await store.chooseDriveFile('pick')

    expect(chosen()).toEqual(marked)
    expect(store.state).toMatchObject({ status: 'ready', error: null, choice: marked })
    expect(store.state.snapshot).toBe(before)
  })

  it('starts a write again from a fresh read when another device saved since the read, and lands both saves', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([5]))
    const { ports, pauses } = harness(choice, side)
    const store = storeOf(ports)
    await store.open()
    let headChecks = 0
    side.before = async (request) => {
      if (request !== 'headRevision') return
      headChecks += 1
      // The second check of the head is the one before the upload.
      if (headChecks === 2) await savedElsewhere(side.drive, choice.id, 'account', { account: 'spare', iban: 'XX00FAKE0002' })
    }

    await editRow(store, CATEGORY_WRITES, 2, { label: 'Sales' })

    expect(pauses).toHaveLength(1)
    expect(pauses[0]).toBeGreaterThanOrEqual(1000)
    const held = decodeDocument(await side.drive.download(choice.id))
    expect(held.records.account?.map((record) => record.account)).toEqual(['main', 'spare'])
    expect(held.records.category?.[0]).toMatchObject({ label: 'Sales' })
    expect(store.state.workbook?.accounts.map((account) => account.slug)).toEqual(['main', 'spare'])
  })

  it('gives up after three fresh reads on a file that keeps moving, and writes nothing', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([5]))
    const { ports, pauses } = harness(choice, side)
    const store = storeOf(ports)
    await store.open()
    let headChecks = 0
    side.before = async (request) => {
      if (request !== 'headRevision') return
      headChecks += 1
      if (headChecks % 2 === 0) await savedElsewhere(side.drive, choice.id, 'account', { account: `spare-${headChecks}`, iban: `XX00FAKE${headChecks}` })
    }

    await expect(editRow(store, CATEGORY_WRITES, 2, { label: 'Sales' })).rejects.toThrow('Another device kept saving the workbook during this change.')

    expect(pauses).toHaveLength(3)
    expect(side.drive.file(choice.id).revisions.filter((revision) => revision.text.includes('Sales'))).toEqual([])
    expect(decodeDocument(await side.drive.download(choice.id)).records.category?.[0]).not.toHaveProperty('label')
    expect(store.state.writes).toEqual([])
  })

  it('tells the folder the file sits in and the day of its newest backup', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([10]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    const folderId = side.drive.file(choice.id).parents[0]!
    expect(await store.driveFilePlace()).toEqual({ folderId, folderName: 'books', lastBackup: null, inKunaFolder: false, moveUnfinished: false })

    const backups = await side.drive.createFolder(folderId, 'backups')
    await side.drive.createFile(backups, 'kuna-company-2026-10-20.json', '')
    await side.drive.createFile(backups, 'kuna-company-2026-10-22.json', '')
    await side.drive.createFile(backups, 'notes.json', '')

    expect(await store.driveFilePlace()).toEqual({ folderId, folderName: 'books', lastBackup: '2026-10-22', inKunaFolder: false, moveUnfinished: false })
  })

  it('asks Drive nothing about the file while no token is kept', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([10]))
    side.access = { ...side.access, signedIn: () => false }
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    expect(await store.driveFilePlace()).toBeNull()
    expect(side.drive.requests).toEqual([])
  })
})

describe('workbook store with its Drive file in the bin or gone', () => {
  it('keeps the copy on screen and says the file is in the bin once a sync finds it there, until a sync reads it restored', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([4]))
    await side.drive.trash(choice.id)
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    await store.sync()

    expect(store.state).toMatchObject({ choice, status: 'error', error: storageWords.inBin, missing: true })
    expect(store.state.workbook?.transactions).toHaveLength(1)
    side.drive.file(choice.id).trashed = false
    await store.sync()
    expect(store.state).toMatchObject({ status: 'ready', error: null, missing: false })
  })

  it('says the file is gone once Drive no longer has it', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([4]))
    await side.drive.delete(choice.id)
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    await store.sync()

    expect(store.state).toMatchObject({ choice, status: 'error', error: storageWords.goneFromDrive, missing: true })
  })

  it('refuses a write to a file in the bin, writing nothing to it, and marks the file missing', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([4]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    await side.drive.trash(choice.id)
    const revision = side.drive.file(choice.id).headRevisionId

    await expect(addRows(store, ACCOUNT_WRITES, { account: 'savings', iban: '' })).rejects.toThrow(storageWords.inBin)
    expect(side.drive.file(choice.id).headRevisionId).toBe(revision)
    expect(store.state).toMatchObject({ status: 'error', error: storageWords.inBin, missing: true })
  })

  it('does not call another file missing when only a find fails', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([4]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    side.before = async (request) => {
      if (request === 'findByAppProperty') throw new Error('Drive answered 500.')
    }

    await store.chooseDriveFile('find')

    expect(store.state).toMatchObject({ choice, status: 'error', missing: false })
  })
})

describe('workbook store with a workbook kept in this browser', () => {
  it('keeps an imported workbook under its own id and reads it back on the next start', async () => {
    const first = harness(null)
    const store = storeOf(first.ports)
    await store.open()

    await store.replaceLocalWorkbook(documentOf([10, 20]), 'Studio')

    expect(store.state.choice).toEqual({ source: 'browser', id: 'local-1', name: 'Studio' })
    expect(store.state.workbook).toMatchObject({ source: 'browser', id: 'local-1', title: 'Studio' })
    const reopened = storeOf(harness(first.chosen()).ports)
    await reopened.open()
    expect(reopened.state.workbook?.transactions).toHaveLength(2)
    expect(reopened.state.snapshot?.meta).toMatchObject({ source: 'browser', lastExportedAt: null, unexportedSince: null })
  })

  it('tells the app once a workbook kept in this browser replaces a Drive file', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([7200]))
    const { ports } = harness(choice, side)
    let kept = 0
    const store = storeOf({ ...ports, hasLiveAccessToken: () => true, keptInBrowser: () => (kept += 1) })
    await store.open()
    expect(store.canSyncSilently()).toBe(true)

    await store.replaceLocalWorkbook(documentOf([10]), 'Studio')

    expect(kept).toBe(1)
    expect(store.canSyncSilently()).toBe(false)
  })

  it('replaces the workbook it keeps rather than adding a second one', async () => {
    const store = storeOf(harness(null).ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10, 20]), 'Studio')

    await store.replaceLocalWorkbook(documentOf([30]), 'Studio again')

    expect(store.state.workbook?.id).toBe('local-1')
    expect((await storedCopy('local-1'))?.document.records['ledger-row']).toHaveLength(1)
  })

  it('saves record changes, marks them unexported from the first one, and clears that on export', async () => {
    const { ports, setNow } = harness(null)
    const store = storeOf(ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10]), 'Studio')
    setNow('2026-10-17T09:00:00.000Z')
    await editRow(store, CATEGORY_WRITES, 2, { label: 'Sales' })
    setNow('2026-10-18T09:00:00.000Z')
    await addRows(store, ACCOUNT_WRITES, { account: 'savings', iban: '' })

    expect(store.state.workbook?.categories[0]?.label).toBe('Sales')
    expect(store.state.workbook?.accounts.map((account) => account.slug)).toEqual(['main', 'savings'])
    expect(store.state.snapshot?.meta).toMatchObject({ syncedAt: '2026-10-18T09:00:00.000Z', unexportedSince: '2026-10-17T09:00:00.000Z' })

    setNow('2026-10-19T09:00:00.000Z')
    await store.recordExport()

    expect((await storedCopy('local-1'))?.meta).toMatchObject({ lastExportedAt: '2026-10-19T09:00:00.000Z', unexportedSince: null })
  })

  it('adds grants, assets and year-end lines, and keeps them in this browser', async () => {
    const store = storeOf(harness(null).ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10]), 'Studio')

    await addRows(store, GRANT_WRITES, { grant: 'startup', received: 45809, amount: 5000, fixed_part: 2000, variable_part: 3000 })
    await addRows(store, ASSET_WRITES, { asset: 'Laptop', bought: 45809, cost_net: 1519.2, group: 'computers', funded_by: 'startup' })
    await addRows(store, YEAR_END_WRITES, { year: 2025, statement: 'pl', line: 'sales', amount: 46800 })

    expect(hrDooWorkbook(store.state.workbook!).assets.map((asset) => asset.fundedBy)).toEqual(['startup'])
    expect(hrDooWorkbook(store.state.workbook!).grants).toHaveLength(1)
    expect(hrDooWorkbook(store.state.workbook!).yearEndLines).toHaveLength(1)
    expect(store.state.workbook?.problems).toEqual([])
    expect((await storedCopy('local-1'))?.document.records['hr-doo.asset']).toHaveLength(1)
  })

  it('never syncs a workbook kept in this browser with Google', async () => {
    const side = driveSide()
    const store = storeOf(harness(null, side).ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10]), 'Studio')

    await store.sync()

    expect(side.drive.requests).toEqual([])
  })

  it('deletes the local workbook once a Drive file replaces it, and only then', async () => {
    const side = driveSide()
    const store = storeOf(harness(null, side).ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10]), 'Studio')

    await store.chooseDriveFile('find')
    expect(store.state.choice?.source).toBe('browser')
    expect(await storedCopy('local-1')).not.toBeNull()

    const choice = await onDrive(side, documentOf([1]))
    await store.chooseDriveFile('find')

    expect(store.state.choice).toEqual(choice)
    expect(await storedCopy('local-1')).toBeNull()
  })

  it('moves the workbook into a new file in the folder picked, reads it back the same, and then keeps nothing in this browser', async () => {
    const side = driveSide()
    const { ports, chosen } = harness(null, side)
    const store = storeOf(ports)
    await store.open()
    const document = { ...documentOf([10, 20]), records: { ...documentOf([10, 20]).records, 'a-later-kind': [{ kept: 'as it was' }] } }
    await store.replaceLocalWorkbook(document, 'Studio')
    side.pickedFolder = await side.drive.createFolder('root', 'books')

    expect(chosen()?.source).toBe('browser')
    await store.keepOnDrive(side.pickedFolder, document)

    const choice = chosen()!
    used.add(choice.id)
    expect(choice).toMatchObject({ source: 'drive', name: 'kuna-company.json' })
    expect(side.drive.file(choice.id)).toMatchObject({ name: 'kuna-company.json', parents: [side.pickedFolder], appProperties: { kuna: COMPANY_APP } })
    expect(decodeDocument(await side.drive.download(choice.id)).records).toEqual(document.records)
    expect(store.state.workbook?.transactions).toHaveLength(2)
    expect(await storedCopy('local-1')).toBeNull()
  })

  it('keeps an opened file on Drive without keeping it in this browser first', async () => {
    const side = driveSide()
    const { ports, chosen } = harness(null, side)
    const store = storeOf(ports)
    await store.open()
    side.pickedFolder = await side.drive.createFolder('root', 'books')

    await store.keepOnDrive(side.pickedFolder, documentOf([10, 20, 30]))

    const choice = chosen()!
    used.add(choice.id)
    expect(choice).toMatchObject({ source: 'drive', name: 'kuna-company.json' })
    expect(store.state.workbook?.transactions).toHaveLength(3)
    expect(used.has('local-1')).toBe(false)
  })

  it('confirms a picked folder by its path from My Drive with Drive read access, and by its name alone without it, writing nothing', async () => {
    const side = driveSide()
    const store = storeOf(harness(null, side).ports)
    await store.open()
    const work = await side.drive.createFolder('root', 'work')
    side.pickedFolder = await side.drive.createFolder(work, 'books')
    const requests = side.drive.requests.length

    expect(await store.pickDriveFolder('Choose')).toEqual({ id: side.pickedFolder, name: 'books', path: null })
    side.readsDrive = true
    expect(await store.pickDriveFolder('Choose the folder of your bank statements')).toEqual({ id: side.pickedFolder, name: 'books', path: ['work', 'books'] })
    expect(side.drive.requests.slice(requests).filter((request) => !request.startsWith('find'))).toEqual([])
    expect(store.state.choice).toBeNull()
  })

  it('gives no folder when the folder Picker is cancelled, and the workbook stays on screen', async () => {
    const side = driveSide()
    const store = storeOf(harness(null, side).ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10]), 'Studio')

    expect(await store.pickDriveFolder('Choose')).toBeNull()

    expect(store.state.choice).toEqual({ source: 'browser', id: 'local-1', name: 'Studio' })
    expect(store.state.status).toBe('ready')
    expect(await storedCopy('local-1')).not.toBeNull()
  })

  it('makes no second file when Drive holds the app’s file already, refusing before any folder is made and on the make, and keeps the browser’s workbook', async () => {
    const side = driveSide()
    await onDrive(side, documentOf([1]))
    const store = storeOf(harness(null, side).ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10]), 'Studio')
    side.pickedFolder = await side.drive.createFolder('root', 'books')

    await expect(store.driveHomeOfApp(null)).rejects.toThrow(BooksAlreadyOnDrive)
    await expect(store.keepOnDrive(side.pickedFolder, documentOf([10]))).rejects.toThrow(BooksAlreadyOnDrive)

    await expect(store.driveHomeOfApp(null)).rejects.toThrow('Drive already holds kuna-company.json, so the app does not make a second one. Open that file, or trash it in Drive first.')
    expect(store.state).toMatchObject({ status: 'ready', error: null })
    expect(await side.drive.children(side.pickedFolder)).toEqual([])
    expect(store.state.choice?.source).toBe('browser')
    expect(await storedCopy('local-1')).not.toBeNull()
  })
})

describe('workbook store moving its file into the Kuna folder', () => {
  it('reads the file first, so what goes along comes from the settings as another device left them', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    used.add(choice.id)
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    await store.sync()
    const parent = side.drive.file(choice.id).parents[0]!
    await side.drive.createFolder(parent, 'statements')
    await side.drive.upload(choice.id, encodeDocument(documentOf([1, 2])))

    const seen: number[] = []
    const beside = () => {
      seen.push(store.state.workbook?.transactions.length ?? 0)
      return { files: [], folders: [{ name: 'statements', mailSource: null }], stays: [] }
    }
    await store.moveIntoKuna(beside, null)

    expect(seen).toEqual([2])
  })

  it('counts the move as over only once what it changes in the settings is written', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    used.add(choice.id)
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    const nothing = () => ({ files: [], folders: [], stays: [] })

    await expect(store.moveIntoKuna(nothing, null, async () => Promise.reject(new Error('not saved')))).rejects.toThrow('not saved')
    expect(side.drive.file(choice.id).appProperties.movedFrom).toBeDefined()

    await store.moveIntoKuna(nothing, null, async () => {})
    expect(side.drive.file(choice.id).appProperties.movedFrom).toBeUndefined()
  })

  it('moves nothing when that read fails', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    used.add(choice.id)
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    const parent = side.drive.file(choice.id).parents[0]!
    await side.drive.trash(choice.id)

    await expect(store.moveIntoKuna(() => ({ files: [], folders: [], stays: [] }), null)).rejects.toThrow()

    expect(side.drive.file(choice.id).parents).toEqual([parent])
  })
})

describe('workbook store marking a file the person opened', () => {
  async function unmarked(side: DriveSide): Promise<string> {
    const folder = await side.drive.createFolder('root', 'books')
    const { id } = await side.drive.createFile(folder, 'my-books.json', encodeDocument(documentOf([1])))
    used.add(id)
    return id
  }

  it('marks a picked file on open with one private property, with no new revision and no change to its content', async () => {
    const side = driveSide()
    const fileId = await unmarked(side)
    const [revision, text] = [await side.drive.headRevision(fileId), await side.drive.download(fileId)]
    side.pickedFile = fileId
    const store = storeOf(harness(null, side).ports)
    await store.open()

    await store.chooseDriveFile('pick')

    expect(side.drive.file(fileId).appProperties).toEqual({ kuna: COMPANY_APP })
    expect(await side.drive.headRevision(fileId)).toBe(revision)
    expect(await side.drive.download(fileId)).toBe(text)
    expect(await side.drive.findByAppProperty('kuna', COMPANY_APP)).toEqual([fileId])
  })

  it('marks a file this device already chose, as a person’s older file is, once a page', async () => {
    const side = driveSide()
    const fileId = await unmarked(side)
    const store = storeOf(harness({ source: 'drive', id: fileId, name: 'my-books.json' }, side).ports)
    await store.open()

    await store.sync()
    await store.sync()

    expect(side.drive.file(fileId).appProperties).toEqual({ kuna: COMPANY_APP })
    expect(side.drive.requests.filter((request) => request === 'setAppProperty')).toHaveLength(1)
  })

  it('leaves it unmarked when another file holds the mark, since a search must find one', async () => {
    const side = driveSide()
    await onDrive(side, documentOf([9]))
    const fileId = await unmarked(side)
    side.pickedFile = fileId
    const store = storeOf(harness(null, side).ports)
    await store.open()

    await store.chooseDriveFile('pick')

    expect(side.drive.file(fileId).appProperties).toEqual({})
    expect(store.state.choice?.id).toBe(fileId)
  })

  it('still opens the file when the mark fails', async () => {
    const side = driveSide()
    const fileId = await unmarked(side)
    side.pickedFile = fileId
    side.before = async (request) => {
      if (request === 'setAppProperty') throw new Error('403')
    }
    const store = storeOf(harness(null, side).ports)
    await store.open()

    await store.chooseDriveFile('pick')

    expect(store.state.choice?.id).toBe(fileId)
    expect(store.state.status).toBe('ready')
  })
})

describe('workbook store dropping the workbook a first run made', () => {
  it('trashes the Drive file, forgets its copy and chooses none, so a new file can be made in its place', async () => {
    const side = driveSide()
    const { ports, chosen } = harness(null, side)
    const store = storeOf(ports)
    await store.open()
    side.pickedFolder = await side.drive.createFolder('root', 'books')
    await store.keepOnDrive(side.pickedFolder, documentOf([10]))
    const made = chosen()!
    used.add(made.id)

    await store.dropWorkbook(made.id)

    expect(side.drive.file(made.id).trashed).toBe(true)
    expect(chosen()).toBeNull()
    expect(store.state).toMatchObject({ choice: null, workbook: null, records: null, snapshot: null, status: 'ready', error: null })
    expect(await storedCopy(made.id)).toBeNull()
    expect(await side.drive.findByAppProperty('kuna', COMPANY_APP)).toEqual([])
  })

  it('deletes the workbook kept in this browser and chooses none', async () => {
    const { ports, chosen } = harness(null)
    const store = storeOf(ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10]), 'New books')

    await store.dropWorkbook('local-1')

    expect(chosen()).toBeNull()
    expect(store.state).toMatchObject({ choice: null, workbook: null, status: 'ready' })
    expect(await storedCopy('local-1')).toBeNull()
    const reopened = storeOf(harness(null).ports)
    await reopened.open()
    expect(reopened.state.choice).toBeNull()
  })

  it('drops nothing but the workbook chosen', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    await store.dropWorkbook('file-99')

    expect(store.state.choice).toEqual(choice)
    expect(side.drive.file(choice.id).trashed).toBe(false)
    expect(side.drive.requests).toEqual([])
  })

  it('runs the step it is given first, while no sync starts, then trashes the file', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    const seen: string[] = []

    const dropped = await store.dropWorkbook(choice.id, {
      first: async () => {
        seen.push(`trashed ${side.drive.file(choice.id).trashed}`)
        void store.sync()
      },
    })

    expect(dropped).toBe(true)
    expect(seen).toEqual(['trashed false'])
    expect(side.drive.requests).toEqual(['trash'])
    expect(store.state).toMatchObject({ choice: null, waiting: [] })
  })

  it('drops nothing when the step it runs first fails, and passes the failure on', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    await expect(
      store.dropWorkbook(choice.id, {
        first: async () => {
          throw new Error('The keys file was not deleted.')
        },
      }),
    ).rejects.toThrow('The keys file was not deleted.')

    expect(side.drive.file(choice.id).trashed).toBe(false)
    expect(store.state).toMatchObject({ choice, status: 'ready', error: null, waiting: [] })
    expect(await storedCopy(choice.id)).not.toBeNull()
  })

  it('refuses to drop the workbook while a sync runs', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    let release: () => void = () => {}
    side.before = (request) => (request === 'headRevision' ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve())
    const syncing = store.sync()

    await expect(store.dropWorkbook(choice.id)).rejects.toBeInstanceOf(WorkbookWriteRefused)
    release()
    await syncing
    expect(side.drive.file(choice.id).trashed).toBe(false)
  })

  it('keeps the workbook chosen when Drive fails to trash it', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    side.before = async (request) => {
      if (request === 'trash') throw new Error('Drive answered 500.')
    }

    await expect(store.dropWorkbook(choice.id)).rejects.toThrow('Drive answered 500.')

    expect(store.state).toMatchObject({ choice, status: 'ready', error: null, missing: false })
    expect(store.state.workbook).not.toBeNull()
    expect(await storedCopy(choice.id)).not.toBeNull()
  })

  it('says a shared file cannot be binned, and keeps it chosen and its copy', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    side.drive.file(choice.id).ownedByMe = false
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    await expect(store.dropWorkbook(choice.id)).rejects.toThrow(storageInfrastructureWords.trashRefused)

    expect(side.drive.file(choice.id).trashed).toBe(false)
    expect(store.state).toMatchObject({ choice, status: 'ready', missing: false })
    expect(await storedCopy(choice.id)).not.toBeNull()
  })

  /** A file with two backups Kuna made, a file a person put among them, and a look-alike Kuna did not make, plus one beside the file and not in the folder. */
  async function withBackups() {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const home = side.drive.file(choice.id).parents[0]!
    const folder = await side.drive.createFolder(home, BACKUPS_FOLDER)
    const first = await side.drive.createFile(folder, `kuna-${COMPANY_APP}-2026-10-01.json`, '{}')
    const second = await side.drive.createFile(folder, `kuna-${COMPANY_APP}-2026-10-02.json`, '{}')
    const notes = await side.drive.createFile(folder, 'my-notes.json', '{}')
    const lookAlike = await side.drive.createFile(folder, `kuna-${COMPANY_APP}-2026-10-03.json`, '{}')
    side.drive.file(lookAlike.id).isAppAuthorized = false
    const otherApp = await side.drive.createFile(folder, 'kuna-loans-2026-10-04.json', '{}')
    const beside = await side.drive.createFile(home, `kuna-${COMPANY_APP}-2026-10-05.json`, '{}')
    return { side, choice, folder, first, second, notes, lookAlike, otherApp, beside }
  }

  it('counts and bins only the backups Kuna made of this file, and the file and everything else stay', async () => {
    const { side, choice, folder, first, second, notes, lookAlike, otherApp, beside } = await withBackups()
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    expect(await store.backupsOnDrive()).toBe(2)
    await store.trashBackups(choice.id)

    expect([first, second].map(({ id }) => side.drive.file(id).trashed)).toEqual([true, true])
    expect([notes, lookAlike, otherApp, beside].map(({ id }) => side.drive.file(id).trashed)).toEqual([false, false, false, false])
    expect(side.drive.file(folder).trashed).toBe(false)
    expect(side.drive.file(choice.id).trashed).toBe(false)
    expect(store.state.choice).toEqual(choice)
  })

  it('tries every backup and names the ones Drive refused', async () => {
    const { side, choice, first, second } = await withBackups()
    side.drive.file(first.id).ownedByMe = false
    const store = storeOf(harness(choice, side).ports)
    await store.open()

    await expect(store.trashBackups(choice.id)).rejects.toThrow(`kuna-${COMPANY_APP}-2026-10-01.json`)

    expect(side.drive.file(second.id).trashed).toBe(true)
    expect(store.state).toMatchObject({ choice, status: 'ready' })
  })

  it('counts no backups for a file with no backups folder, and none for a file kept in this browser', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    expect(await store.backupsOnDrive()).toBe(0)

    const browser = storeOf(harness(null).ports)
    await browser.open()
    await browser.replaceLocalWorkbook(documentOf([1]), 'New books')
    expect(await browser.backupsOnDrive()).toBeNull()
  })

  it('refuses to bin the backups while a save waits', async () => {
    const { side, choice, first } = await withBackups()
    const store = storeOf(harness(choice, side).ports)
    await store.open()
    let release: () => void = () => {}
    side.before = (request) => (request === 'headRevision' ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve())
    const syncing = store.sync()

    await expect(store.trashBackups(choice.id)).rejects.toThrow(storageWords.busy)
    release()
    await syncing
    expect(side.drive.file(first.id).trashed).toBe(false)
  })

  it('leaves the Drive file where it is when only this browser forgets it, so a later find opens it again', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const { ports, chosen } = harness(choice, side)
    const store = storeOf(ports)
    await store.open()

    expect(await store.dropWorkbook(choice.id, { keepDriveFile: true })).toBe(true)

    expect(side.drive.file(choice.id).trashed).toBe(false)
    expect(side.drive.requests).not.toContain('trash')
    expect(chosen()).toBeNull()
    expect(store.state).toMatchObject({ choice: null, workbook: null, status: 'ready' })
    expect(await storedCopy(choice.id)).toBeNull()
  })

  it('shows none once another tab forgot the workbook, after a job already running here', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const { ports, chosen } = harness(choice, side)
    const store = storeOf(ports)
    await store.open()

    await store.forgottenElsewhere()

    expect(chosen()).toBeNull()
    expect(store.state).toMatchObject({ choice: null, workbook: null, records: null, snapshot: null, status: 'ready', missing: false })
    expect(side.drive.file(choice.id).trashed).toBe(false)
    await expect(store.write('Late', () => {})).rejects.toThrow(storageWords.noBooks)
  })
})

describe('another tab choosing a file', () => {
  it('shows the file set up there, from the copy this browser holds', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const elsewhere = storeOf(harness(choice, side).ports)
    await elsewhere.open()
    await elsewhere.sync()
    const { ports } = harness(null, side)
    const store = storeOf(ports)
    await store.open()
    expect(store.state.workbook).toBeNull()

    ports.saveChoice(choice)
    await store.chosenElsewhere()

    expect(store.state.choice).toEqual(choice)
    expect(store.state.workbook).not.toBeNull()
    expect(store.state.status).toBe('ready')
  })

  it('leaves the file it already shows alone, and does nothing once the choice is gone again', async () => {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const { ports } = harness(choice, side)
    const store = storeOf(ports)
    await store.open()
    const shown = store.state.snapshot

    await store.chosenElsewhere()

    expect(store.state.snapshot).toBe(shown)
    const none = storeOf(harness(null, side).ports)
    await none.open()
    await none.chosenElsewhere()
    expect(none.state.choice).toBeNull()
  })
})

describe('workbook store queueing what happens to its file', () => {
  /** The store over a Drive file with the transactions and an account to edit, and a way to hold the next upload until the test lets it go. */
  async function queueHarness() {
    const side = driveSide()
    const choice = await onDrive(side, documentOf([1]))
    const held = harness(choice, side)
    const store = storeOf(held.ports)
    await store.open()
    let holding = false
    let release: () => void = () => {}
    const before = side.before
    side.before = async (request) => {
      await before(request)
      if (request === 'upload' && holding) {
        holding = false
        await new Promise<void>((resolve) => (release = resolve))
      }
    }
    return {
      ...held,
      side,
      choice,
      store,
      holdNextUpload: () => {
        holding = true
      },
      letUploadGo: () => release(),
      uploading: () => vi.waitFor(() => expect(holding).toBe(false)),
    }
  }

  const addAccount = (name: string) => (unit: UnitOfWork) => unit.of(ACCOUNT_WRITES).add(accountOf(name))
  const accountsOnDrive = async (drive: FakeDrive, fileId: string) => decodeDocument(await drive.download(fileId)).records['account']?.map((record) => record['account'])

  it('lands writes in the order they were tapped, the second waiting for the first', async () => {
    const { store, side, choice, holdNextUpload, letUploadGo, uploading } = await queueHarness()
    holdNextUpload()

    const first = store.write('First', addAccount('first'), { key: 'one' })
    const second = store.write('Second', addAccount('second'), { key: 'two' })
    await uploading()

    expect(store.state.waiting.map((queued) => queued.keys)).toEqual([['one'], ['two']])
    letUploadGo()
    await Promise.all([first, second])

    expect(await accountsOnDrive(side.drive, choice.id)).toEqual(['main', 'first', 'second'])
    expect(store.state.waiting).toEqual([])
    expect(store.state.writes.map((written) => written.receipt.title)).toEqual(['Second', 'First'])
  })

  it('makes a write during a sync wait for it, and it goes on what the sync read', async () => {
    const { store, side, choice } = await queueHarness()
    let readDone: () => void = () => {}
    const before = side.before
    side.before = async (request) => {
      await before(request)
      if (request === 'headRevision') {
        side.before = before
        await new Promise<void>((resolve) => (readDone = resolve))
      }
    }
    const syncing = store.sync()
    await vi.waitFor(() => expect(store.state.status).toBe('syncing'))
    const written = store.write('During a sync', addAccount('during'))
    await savedElsewhere(side.drive, choice.id, 'account', { account: 'spare', iban: 'XX00FAKE0002' })

    readDone()
    await Promise.all([syncing, written])

    expect(await accountsOnDrive(side.drive, choice.id)).toEqual(['main', 'spare', 'during'])
    expect(store.state.status).toBe('ready')
  })

  it('makes a sync during writes wait behind them and read what they left, and a second sync share it', async () => {
    const { store, side, holdNextUpload, letUploadGo, uploading } = await queueHarness()
    holdNextUpload()
    const written = store.write('First', addAccount('first'))
    await uploading()
    const syncing = store.sync()
    const again = store.sync()

    expect(again).toBe(syncing)
    expect(store.state.status).toBe('ready')
    side.drive.requests.length = 0
    letUploadGo()
    await Promise.all([written, syncing])

    expect(store.state.status).toBe('ready')
    expect(store.state.workbook?.accounts.map((account) => account.slug)).toEqual(['main', 'first'])
    expect(side.drive.requests.filter((request) => request === 'download')).toEqual([])
  })

  it('lets the next write go on after one is refused', async () => {
    const { store, side, choice, holdNextUpload, letUploadGo, uploading } = await queueHarness()
    holdNextUpload()
    const first = store.write('First', addAccount('first'))
    await uploading()
    const refused = store.write('Same name, other IBAN', (unit: UnitOfWork) => unit.of(ACCOUNT_WRITES).add({ ...accountOf('first'), iban: 'HR1210010051863000160' }))
    const after = store.write('After', addAccount('after'))
    letUploadGo()

    await first
    await expect(refused).rejects.toBeInstanceOf(WorkbookWriteRefused)
    await after

    expect(await accountsOnDrive(side.drive, choice.id)).toEqual(['main', 'first', 'after'])
    expect(store.state.waiting).toEqual([])
  })

  it('refuses a move and a drop while anything is queued', async () => {
    const { store, side, choice, holdNextUpload, letUploadGo, uploading } = await queueHarness()
    holdNextUpload()
    const written = store.write('First', addAccount('first'))
    await uploading()

    await expect(store.moveIntoKuna(() => ({ files: [], folders: [], stays: [] }), null)).rejects.toThrow(storageWords.busy)
    await expect(store.dropWorkbook(choice.id)).rejects.toThrow(storageWords.busy)

    letUploadGo()
    await written
    expect(side.drive.file(choice.id).trashed).toBe(false)
  })

  it('makes a write tapped during a move wait for the move', async () => {
    const { ports, side } = await queueHarness()
    const order: string[] = []
    let moved: () => void = () => {}
    const before = side.before
    side.before = async (request) => {
      await before(request)
      if (request === 'upload') order.push('upload')
    }
    const moving = storeOf({
      ...ports,
      moveIntoKuna: async () => {
        order.push('move starts')
        await new Promise<void>((resolve) => (moved = resolve))
        order.push('move ends')
        return []
      },
    })
    await moving.open()
    const move = moving.moveIntoKuna(() => ({ files: [], folders: [], stays: [] }), null)
    await vi.waitFor(() => expect(order).toEqual(['move starts']))
    const written = moving.write('During the move', addAccount('during'))
    moved()
    await Promise.all([move, written])

    expect(order).toEqual(['move starts', 'move ends', 'upload'])
  })

  it('holds the queue through the retries on a file another device keeps saving, then lets it go', async () => {
    const { store, side, choice, pauses } = await queueHarness()
    let headChecks = 0
    const before = side.before
    side.before = async (request) => {
      await before(request)
      if (request !== 'headRevision') return
      headChecks += 1
      if (pauses.length < 4 && headChecks % 2 === 0) await savedElsewhere(side.drive, choice.id, 'account', { account: `spare-${headChecks}`, iban: `XX00FAKE${headChecks}` })
    }
    const retried = store.write('Retried', addAccount('retried'))
    const next = store.write('Next', addAccount('next'))
    let nextDone = false
    void next.finally(() => {
      nextDone = true
    })

    await expect(retried).rejects.toThrow(storageWords.savedElsewhere)
    expect(pauses).toHaveLength(3)
    expect(nextDone).toBe(false)
    side.before = before
    await next
    expect(await accountsOnDrive(side.drive, choice.id)).toContain('next')
  })

  it('refuses a queued write when another workbook was chosen before its turn', async () => {
    const { store, side, holdNextUpload, letUploadGo, uploading } = await queueHarness()
    holdNextUpload()
    const first = store.write('First', addAccount('first'))
    await uploading()
    const replacing = store.replaceLocalWorkbook(documentOf([5]), 'Other')
    const second = store.write('Second', addAccount('second'))
    letUploadGo()

    await first
    await expect(second).rejects.toThrow(storageWords.noBooks)
    await replacing
    expect(store.state.choice?.source).toBe('browser')
    expect(side.drive.requests.filter((request) => request === 'upload')).toHaveLength(1)
    await deleteBrowserDocument(store.state.choice!.id)
  })

  it('refuses to choose another file or keep one on Drive while the lane is busy, since the Picker needs the tap', async () => {
    const { store, side, holdNextUpload, letUploadGo, uploading } = await queueHarness()
    holdNextUpload()
    const written = store.write('First', addAccount('first'))
    await uploading()
    await expect(store.chooseDriveFile('pick')).rejects.toThrow(storageWords.busy)
    await expect(store.keepOnDrive('root', documentOf([1]))).rejects.toThrow(storageWords.busy)
    expect(side.signIns).not.toContainEqual({ resume: 'pick', app: 'company' })
    letUploadGo()
    await written
  })

  it('asks Google once during the tap, even for two taps while the ask is open', async () => {
    const { store, side, holdNextUpload, letUploadGo, uploading } = await queueHarness()
    let granted: () => void = () => {}
    const signIn = side.access.signIn
    side.access = {
      ...side.access,
      signIn: async (then) => {
        await signIn(then)
        await new Promise<void>((resolve) => (granted = resolve))
        side.access = { ...side.access, signIn }
      },
    }
    holdNextUpload()
    const first = store.write('First', addAccount('first'))
    const second = store.write('Second', addAccount('second'))
    await vi.waitFor(() => expect(side.signIns).toEqual([null]))
    granted()
    await uploading()
    letUploadGo()
    await Promise.all([first, second])
  })

  it('settles once nothing of the file is queued or running', async () => {
    const { store, holdNextUpload, letUploadGo, uploading } = await queueHarness()
    holdNextUpload()
    const first = store.write('First', addAccount('first'))
    const second = store.write('Second', addAccount('second'))
    let settled = false
    const settling = store.settled().then(() => {
      settled = true
    })
    await uploading()
    expect(settled).toBe(false)
    letUploadGo()
    await Promise.all([first, second, settling])
    expect(settled).toBe(true)
    expect(store.state.waiting).toEqual([])
  })

  it('keeps a save that landed after an export counted as not exported', async () => {
    const side = driveSide()
    const id = 'local-queue-export'
    used.add(id)
    const { ports } = harness({ source: 'browser', id, name: 'Books' }, side)
    const store = storeOf(ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([1]), 'Books')
    const browserId = store.state.choice!.id
    await store.write('Before', addAccount('before'))
    const written = store.write('During', addAccount('during'))
    await store.recordExport()
    await written

    expect(store.state.snapshot?.meta.unexportedSince).not.toBeNull()
    await store.recordExport()
    expect(store.state.snapshot?.meta.unexportedSince).toBeNull()
    await deleteBrowserDocument(browserId)
  })
})
