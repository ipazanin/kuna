import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { writeCheck } from '../src/apps/investments/overview/application/checkWrites'
import { emptyInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import type { InvestmentsBooks } from '../src/apps/investments/workbook/domain/investmentsBooks'
import { ACCOUNT_WRITES, CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { CATEGORY_WRITES as SPENDING_CATEGORY_WRITES } from '../src/apps/spending/categories/application/categoryWrites'
import { categoryTree } from '../src/apps/spending/categories/domain/categoryTree'
import { swappedPlaces } from '../src/apps/spending/categories/presentation/categoryPlaces'
import { starterSpendingDocument } from '../src/apps/spending/workbook/presentation/spendingFile'
import type { SpendingBooks } from '../src/apps/spending/workbook/domain/spendingBooks'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import { words } from '../src/shared/storage/application/words'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { decodeDocument, encodeDocument } from '../src/shared/storage/infrastructure/documentFormat'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import type { DocumentCopy } from '../src/shared/storage/infrastructure/documentRecordStorage'
import type { FakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import { openWorkbookCache } from '../src/shared/storage/infrastructure/workbookCache'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { decimal } from './fixtures/investments'
import { INVESTMENTS, SPENDING, driveHarness, forgetCaches } from './fixtures/writeBack'
import { recordOf } from './fixtures/records'

const used = new Set<string>()

afterEach(async () => {
  vi.restoreAllMocks()
  await forgetCaches(used)
})

type CompanyStore = WorkbookStore<CompanyBooks, DocumentCopy, WorkbookDocument>

/** Holds the next upload until the test lets it go, or fails it then. */
function holdNextUpload(drive: FakeDrive) {
  const upload = drive.upload.bind(drive)
  let letGo: (failure: Error | null) => void = () => {}
  const started = vi.fn()
  vi.spyOn(drive, 'upload').mockImplementationOnce(async (...request) => {
    started()
    const failure = await new Promise<Error | null>((resolve) => (letGo = resolve))
    if (failure !== null) throw failure
    return upload(...request)
  })
  return {
    uploading: () => vi.waitFor(() => expect(started).toHaveBeenCalled()),
    land: () => letGo(null),
    fail: (failure = new Error('Drive answered 500.')) => letGo(failure),
  }
}

async function companyOnDrive() {
  const harness = await driveHarness(used)
  return { ...harness, drive: harness.drive! }
}

const categoryNamed = (store: CompanyStore, slug: string) => store.state.records!.categories.records.find(({ record }) => record.slug === slug)!.record
const labelOf = (store: CompanyStore, slug: string) => store.state.workbook!.categories.find((category) => category.slug === slug)?.label
const heldLabelOf = (document: WorkbookDocument, slug: string) => document.records.category?.find((record) => record.category === slug)?.label

function relabel(store: CompanyStore, slug: string, label: string, key = slug) {
  const before = categoryNamed(store, slug)
  return store.write(`Label ${label}`, (unit: UnitOfWork) => unit.of(CATEGORY_WRITES).change(before, { ...before, label }), { key, shownAtOnce: true })
}

describe('a write shown at once', () => {
  it('shows from the tap, spins by its key, and lands', async () => {
    const { store, drive, held } = await companyOnDrive()
    const upload = holdNextUpload(drive)

    const written = relabel(store, 'revenue', 'Sales')
    await upload.uploading()

    expect(labelOf(store, 'revenue')).toBe('Sales')
    expect(heldLabelOf(store.state.snapshot!.document, 'revenue')).toBeUndefined()
    expect(store.state.waiting.map((queued) => queued.key)).toEqual(['revenue'])

    upload.land()
    await written
    expect(store.state.waiting).toEqual([])
    expect(labelOf(store, 'revenue')).toBe('Sales')
    expect(heldLabelOf(await held(), 'revenue')).toBe('Sales')
  })

  it('leaves the screen alone for a dialog or a form Save until it lands', async () => {
    const { store, drive } = await companyOnDrive()
    const upload = holdNextUpload(drive)
    const before = categoryNamed(store, 'revenue')

    const written = store.write('Saved', (unit) => unit.of(CATEGORY_WRITES).change(before, { ...before, label: 'Sales' }))
    await upload.uploading()
    expect(labelOf(store, 'revenue')).not.toBe('Sales')

    upload.land()
    await written
    expect(labelOf(store, 'revenue')).toBe('Sales')
  })

  it('lands a check’s switch and then its threshold on one record, both tapped before either landed', async () => {
    const harness = await driveHarness<InvestmentsBooks>(used, emptyInvestmentsDocument('2026-10-17T09:00:00.000Z'), INVESTMENTS)
    const { store } = harness
    const drive = harness.drive!
    const upload = holdNextUpload(drive)
    const checkOf = () => store.state.workbook?.book.checks.find((setting) => setting.check === 'holding') ?? null
    const threshold = decimal('25')

    const switched = store.write('Off', (unit) => writeCheck(unit, checkOf(), 'holding', decimal('10'), false), { key: 'on-holding', shownAtOnce: true })
    await upload.uploading()
    expect(checkOf()?.off).toBe(true)

    const changed = store.write('Threshold', (unit) => writeCheck(unit, checkOf(), 'holding', threshold, checkOf()?.off !== true), { key: 'holding', shownAtOnce: true })
    await vi.waitFor(() => expect(store.state.waiting).toHaveLength(2))
    expect(checkOf()).toMatchObject({ off: true, threshold })

    upload.land()
    await Promise.all([switched, changed])

    const stored = (await harness.held()).records.check ?? []
    expect(stored).toHaveLength(1)
    expect(checkOf()).toMatchObject({ off: true, threshold })
    expect(store.state.writes).toHaveLength(2)
  })

  it('makes the arrows tapped twice end two places up', async () => {
    const harness = await driveHarness<SpendingBooks>(used, starterSpendingDocument('2026-10-17T09:00:00.000Z'), SPENDING)
    const { store } = harness
    const upload = holdNextUpload(harness.drive!)
    const groups = () => categoryTree(store.state.workbook!.categories, ['spending']).map((entry) => entry.group)
    const third = groups()[2]!
    const moveUp = (place: number) => {
      const changes = swappedPlaces(groups(), place, -1)
      return store.write('Moved', (unit) => changes.forEach(([before, after]) => unit.of(SPENDING_CATEGORY_WRITES).change(before, after)), { key: `up-${third.id}-${place}`, shownAtOnce: true })
    }

    const first = moveUp(2)
    await upload.uploading()
    expect(groups()[1]?.id).toBe(third.id)
    const second = moveUp(1)
    await vi.waitFor(() => expect(groups()[0]?.id).toBe(third.id))

    upload.land()
    await Promise.all([first, second])
    expect(groups()[0]?.id).toBe(third.id)
    expect(store.state.writes).toHaveLength(2)
  })

  it('refuses at the tap what the rules refuse, so it never reaches the screen or the queue', async () => {
    const { store, drive } = await companyOnDrive()
    const seen: unknown[] = []
    const accounts = () => store.state.workbook!.accounts.map((account) => account.slug)
    const before = accounts()

    await expect(store.write('Bad', (unit) => unit.of(ACCOUNT_WRITES).add(recordOf(ACCOUNT_WRITES.kind, { account: 'bad', iban: 'not an iban' })), { shownAtOnce: true })).rejects.toBeInstanceOf(
      WorkbookWriteRefused,
    )
    seen.push(accounts(), store.state.waiting.length)

    expect(seen).toEqual([before, 0])
    expect(drive.requests).not.toContain('upload')
  })

  it('never lets the cache hold a queued change, so a reload cannot show it as saved', async () => {
    const { store, drive } = await companyOnDrive()
    const upload = holdNextUpload(drive)

    const written = relabel(store, 'revenue', 'Sales')
    await upload.uploading()

    const cache = openWorkbookCache(store.state.choice!.id)
    const cached = await cache.read()
    cache.close()
    expect(heldLabelOf(cached!.document, 'revenue')).toBeUndefined()

    upload.land()
    await written
  })

  it('leaves a queued change out of what an export writes', async () => {
    const { store, drive } = await companyOnDrive()
    const upload = holdNextUpload(drive)

    const written = relabel(store, 'revenue', 'Sales')
    await upload.uploading()

    expect(encodeDocument(store.state.snapshot!.document)).not.toContain('Sales')

    upload.land()
    await written
    expect(encodeDocument(store.state.snapshot!.document)).toContain('Sales')
  })
})

describe('a failed write in the middle of a queue', () => {
  it('flips its control back and leaves the rest going, and one made on top of it is refused alone and says why', async () => {
    const { store, drive, held } = await companyOnDrive()
    const upload = holdNextUpload(drive)

    const first = relabel(store, 'revenue', 'A')
    await upload.uploading()
    const other = relabel(store, 'ai-services', 'B')
    const onTop = relabel(store, 'revenue', 'C', 'revenue-again')
    const after = relabel(store, 'equipment', 'D')
    await vi.waitFor(() => expect(store.state.waiting).toHaveLength(4))
    expect(labelOf(store, 'revenue')).toBe('C')

    upload.fail()
    const outcomes = await Promise.allSettled([first, other, onTop, after])

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['rejected', 'fulfilled', 'rejected', 'fulfilled'])
    expect((outcomes[2] as PromiseRejectedResult).reason).toEqual(new WorkbookWriteRefused(words.nothingWritten(words.madeOnFailedWrite)))
    expect(store.state.waiting).toEqual([])
    expect(labelOf(store, 'revenue')).not.toBe('A')
    expect(labelOf(store, 'revenue')).not.toBe('C')
    expect(labelOf(store, 'ai-services')).toBe('B')
    expect(labelOf(store, 'equipment')).toBe('D')
    const document = await held()
    expect(heldLabelOf(document, 'revenue')).toBeUndefined()
    expect(heldLabelOf(document, 'ai-services')).toBe('B')
  })

  it('flips back at once when the failed write is a refusal, and a later tap works from what is shown', async () => {
    const { store, drive } = await companyOnDrive()
    const upload = holdNextUpload(drive)
    const first = relabel(store, 'revenue', 'A')
    await upload.uploading()

    upload.fail()
    await expect(first).rejects.toThrow('Drive answered 500.')
    expect(labelOf(store, 'revenue')).not.toBe('A')

    await relabel(store, 'revenue', 'B')
    expect(labelOf(store, 'revenue')).toBe('B')
  })

  it('stays where it is when the failed upload did reach the file', async () => {
    const { store, drive, held } = await companyOnDrive()
    const upload = drive.upload.bind(drive)
    vi.spyOn(drive, 'upload').mockImplementationOnce(async (...request) => {
      await upload(...request)
      throw new Error('The connection dropped after the upload.')
    })

    await expect(relabel(store, 'revenue', 'A')).rejects.toThrow('The connection dropped after the upload.')

    expect(labelOf(store, 'revenue')).toBe('A')
    expect(heldLabelOf(store.state.snapshot!.document, 'revenue')).toBe('A')
    expect(heldLabelOf(await held(), 'revenue')).toBe('A')
  })
})

describe('a queued write meeting a sync', () => {
  /** Another device saves the file with these labels set. */
  async function savedElsewhere(drive: FakeDrive, fileId: string, slug: string, label: string): Promise<void> {
    const document = decodeDocument(await drive.download(fileId))
    const categories = (document.records.category ?? []).map((record) => (record.category === slug ? { ...record, label } : record))
    await drive.upload(fileId, encodeDocument({ ...document, records: { ...document.records, category: categories } }))
  }

  /** Holds the store's next read of the file's head until the test lets it go. */
  function holdNextRead(drive: FakeDrive) {
    const headRevision = drive.headRevision.bind(drive)
    let letGo: () => void = () => {}
    const started = vi.fn()
    vi.spyOn(drive, 'headRevision').mockImplementationOnce(async (fileId) => {
      started()
      await new Promise<void>((resolve) => (letGo = resolve))
      return headRevision(fileId)
    })
    return { reading: () => vi.waitFor(() => expect(started).toHaveBeenCalled()), go: () => letGo() }
  }

  it('keeps the change on top of what the read brought, and lands both', async () => {
    const { store, drive, held } = await companyOnDrive()
    const fileId = store.state.choice!.id
    const read = holdNextRead(drive)
    const syncing = store.sync()
    await read.reading()
    const written = relabel(store, 'revenue', 'Mine')
    await vi.waitFor(() => expect(store.state.waiting).toHaveLength(1))
    await savedElsewhere(drive, fileId, 'ai-services', 'Theirs')

    read.go()
    await syncing
    expect(labelOf(store, 'ai-services')).toBe('Theirs')
    expect(labelOf(store, 'revenue')).toBe('Mine')

    await written
    const document = await held()
    expect(heldLabelOf(document, 'ai-services')).toBe('Theirs')
    expect(heldLabelOf(document, 'revenue')).toBe('Mine')
  })

  it('takes a change another device overtook off the screen, and its turn refuses it alone with the usual reason', async () => {
    const { store, drive, held } = await companyOnDrive()
    const fileId = store.state.choice!.id
    const read = holdNextRead(drive)
    const syncing = store.sync()
    await read.reading()
    const written = relabel(store, 'revenue', 'Mine')
    const other = relabel(store, 'ai-services', 'Also mine')
    await vi.waitFor(() => expect(store.state.waiting).toHaveLength(2))
    await savedElsewhere(drive, fileId, 'revenue', 'Theirs')

    read.go()
    await syncing
    expect(labelOf(store, 'revenue')).toBe('Theirs')

    await expect(written).rejects.toThrow(/changed since the app read it/)
    await other
    const document = await held()
    expect(heldLabelOf(document, 'revenue')).toBe('Theirs')
    expect(heldLabelOf(document, 'ai-services')).toBe('Also mine')
  })
})

describe('Undo in the queue', () => {
  it('shows at once and queues like any write, and it lands', async () => {
    const { store, drive } = await companyOnDrive()
    await relabel(store, 'revenue', 'Sales')
    const upload = holdNextUpload(drive)

    const undoing = store.undo(store.state.writes[0]!)
    await upload.uploading()
    expect(labelOf(store, 'revenue')).not.toBe('Sales')
    expect(store.state.waiting[0]?.key).toBe(`undo-${store.state.writes[0]!.id}`)

    upload.land()
    await undoing
    expect(store.state.writes[0]?.undid).not.toBeNull()
  })

  it('refuses at the tap to undo a write a queued change sits on', async () => {
    const { store, drive } = await companyOnDrive()
    await relabel(store, 'revenue', 'Sales')
    const landed = store.state.writes[0]!
    const upload = holdNextUpload(drive)
    const onTop = relabel(store, 'revenue', 'Income')
    await upload.uploading()

    await expect(store.undo(landed)).rejects.toThrow(/changed since the app read it/)
    expect(labelOf(store, 'revenue')).toBe('Income')
    expect(store.state.waiting).toHaveLength(1)

    upload.land()
    await onTop
  })

  it('answers a second tap on the same Undo that it cannot be undone while the first waits', async () => {
    const { store, drive } = await companyOnDrive()
    await relabel(store, 'revenue', 'Sales')
    const landed = store.state.writes[0]!
    const upload = holdNextUpload(drive)
    const undoing = store.undo(landed)
    await upload.uploading()

    await expect(store.undo(landed)).rejects.toThrow(words.notUndoable)

    upload.land()
    await undoing
  })
})
