import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { ACCOUNT_WRITES, CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { createWorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { WorkbookStore, WorkbookStorePorts } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import type { WorkbookChoice } from '../src/shared/storage/application/workbookPorts'
import { deleteBrowserDocument } from '../src/shared/storage/infrastructure/browserDocument'
import { decodeDocument, encodeDocument } from '../src/shared/storage/infrastructure/documentFormat'
import type { DocumentRecord, WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import type { DocumentCopy } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { COMPANY_APP, COMPANY_DOCUMENT, installedSchema } from '../src/apps/company/workbook/infrastructure/companyDocument'
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

const used = new Set<string>()

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
  const documents = documentStorePorts(COMPANY_APP, COMPANY_DOCUMENT, async () => side.access, () => now)
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

    expect(side.drive.requests).toEqual(['headRevision'])
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
    expect(side.signIns).toEqual([{ resume: 'find', app: 'company' }, { resume: 'pick', app: 'company' }])
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
    expect(await store.driveFilePlace()).toEqual({ folderId, folderName: 'books', lastBackup: null })

    const backups = await side.drive.createFolder(folderId, 'backups')
    await side.drive.createFile(backups, 'kuna-company-2026-10-20.json', '')
    await side.drive.createFile(backups, 'kuna-company-2026-10-22.json', '')
    await side.drive.createFile(backups, 'notes.json', '')

    expect(await store.driveFilePlace()).toEqual({ folderId, folderName: 'books', lastBackup: '2026-10-22' })
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

    const folder = await store.pickBooksFolder()
    expect(chosen()?.source).toBe('browser')
    await store.keepOnDrive(folder!.id, document, [])

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

    await store.keepOnDrive(side.pickedFolder, documentOf([10, 20, 30]), [])

    const choice = chosen()!
    used.add(choice.id)
    expect(choice).toMatchObject({ source: 'drive', name: 'kuna-company.json' })
    expect(store.state.workbook?.transactions).toHaveLength(3)
    expect(used.has('local-1')).toBe(false)
  })

  it('makes the folders asked for beside the new file, and finds the one it made on an earlier try instead of making a second', async () => {
    const side = driveSide()
    const { ports, chosen } = harness(null, side)
    const store = storeOf(ports)
    await store.open()
    side.pickedFolder = await side.drive.createFolder('root', 'books')
    const madeBefore = await side.drive.createFolder(side.pickedFolder, 'statements')

    await store.keepOnDrive(side.pickedFolder, documentOf([10]), ['statements', 'inbox'])

    used.add(chosen()!.id)
    const inside = await side.drive.children(side.pickedFolder)
    expect(inside.filter((entry) => entry.name === 'statements').map((entry) => entry.id)).toEqual([madeBefore])
    expect(inside.map((entry) => entry.name).sort()).toEqual(['inbox', 'kuna-company.json', 'statements'])
  })

  it('confirms a picked folder by its path from My Drive with Drive read access, and by its name alone without it, writing nothing', async () => {
    const side = driveSide()
    const store = storeOf(harness(null, side).ports)
    await store.open()
    const work = await side.drive.createFolder('root', 'work')
    side.pickedFolder = await side.drive.createFolder(work, 'books')
    const requests = side.drive.requests.length

    expect(await store.pickBooksFolder()).toEqual({ id: side.pickedFolder, name: 'books', path: null })
    side.readsDrive = true
    expect(await store.pickBooksFolder()).toEqual({ id: side.pickedFolder, name: 'books', path: ['work', 'books'] })
    expect(await store.pickDriveFolder('Choose the folder of your bank statements')).toEqual({ id: side.pickedFolder, name: 'books', path: ['work', 'books'] })
    expect(side.drive.requests.slice(requests).filter((request) => !request.startsWith('find'))).toEqual([])
    expect(store.state.choice).toBeNull()
  })

  it('gives no folder when the folder Picker is cancelled, and the workbook stays on screen', async () => {
    const side = driveSide()
    const store = storeOf(harness(null, side).ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10]), 'Studio')

    expect(await store.pickBooksFolder()).toBeNull()

    expect(store.state.choice).toEqual({ source: 'browser', id: 'local-1', name: 'Studio' })
    expect(store.state.status).toBe('ready')
    expect(await storedCopy('local-1')).not.toBeNull()
  })

  it('makes no second file when Drive holds the app’s file already, refusing before the Picker opens, and keeps the browser’s workbook', async () => {
    const side = driveSide()
    await onDrive(side, documentOf([1]))
    const store = storeOf(harness(null, side).ports)
    await store.open()
    await store.replaceLocalWorkbook(documentOf([10]), 'Studio')
    side.pickedFolder = await side.drive.createFolder('root', 'books')

    await expect(store.pickBooksFolder()).rejects.toThrow(/Drive already holds kuna-company.json/)
    await store.keepOnDrive(side.pickedFolder, documentOf([10]), ['statements'])

    expect(store.state.error).toMatch(/Drive already holds kuna-company.json/)
    expect(await side.drive.children(side.pickedFolder)).toEqual([])
    expect(store.state.choice?.source).toBe('browser')
    expect(await storedCopy('local-1')).not.toBeNull()
  })
})
