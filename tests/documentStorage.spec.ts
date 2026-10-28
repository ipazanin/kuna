import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { SETTING_WRITES } from '../src/apps/company/settings/application/settingWrites'
import type { WorkbookStore } from '../src/apps/company/workbook/application/createWorkbookStore'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { NEWER_FILE, decodeDocument, encodeDocument } from '../src/shared/storage/infrastructure/documentFormat'
import type { WorkbookDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import type { DocumentCopy } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { COMPANY_APP, installedSchema, readDocument } from '../src/apps/company/workbook/infrastructure/documentStorePorts'
import { documentOfTabs, tabsOfDocument } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument'
import { EMPTY_TABS, sheetRowsFromValues } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import type { UploadInFlight } from '../src/apps/company/workbook/infrastructure/fake/fakeDrive'
import { browserHarness, driveHarness, forgetCaches, secondDevice } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const SAVED_AT = '2026-10-16T09:00:00.000Z'

function books(records: WorkbookDocument['records'], schema?: WorkbookDocument['schema']): WorkbookDocument {
  const document = newDocument(COMPANY_APP, installedSchema(), records, SAVED_AT)
  return schema === undefined ? document : { ...document, schema }
}

const CATEGORIES = [
  { category: 'revenue', family: 'income', bucket: 'income' },
  { category: 'software', family: 'operating', bucket: 'operating', my_own_note: 'Kept by hand', my_own_number: 7 },
]

function category(store: WorkbookStore<DocumentCopy>, slug: string) {
  return recordsOf(store.state.records!.categories).find((record) => record.slug === slug)!
}

function label(store: WorkbookStore<DocumentCopy>, slug: string, text: string) {
  const before = category(store, slug)
  return store.write('Categories saved', (unit) => unit.of(CATEGORY_WRITES).change(before, { ...before, label: text }))
}

describe('the document as the file holds it', () => {
  it('writes one record per line, and reads back what it wrote', () => {
    const document = books({ category: CATEGORIES, 'ledger-row': [], setting: [{ key: 'hr_company_registered', value: '2025-05-12' }] })

    const text = encodeDocument(document)

    expect(text.split('\n')).toEqual([
      '{',
      '  "format": "kuna",',
      '  "app": "company",',
      '  "schema": {"core":1,"hr-doo":1},',
      `  "savedAt": "${SAVED_AT}",`,
      '  "records": {',
      '    "category": [',
      '      {"category":"revenue","family":"income","bucket":"income"},',
      '      {"category":"software","family":"operating","bucket":"operating","my_own_note":"Kept by hand","my_own_number":7}',
      '    ],',
      '    "ledger-row": [],',
      '    "setting": [',
      '      {"key":"hr_company_registered","value":"2025-05-12"}',
      '    ]',
      '  }',
      '}',
      '',
    ])
    expect(decodeDocument(text)).toEqual(document)
  })

  it('refuses a file that is not a Kuna document', () => {
    expect(() => decodeDocument('{"format":"something else","records":{}}')).toThrow('The file is not a Kuna file.')
    expect(() => decodeDocument('not json')).toThrow('does not read as JSON')
  })
})

describe('opening an xlsx file as the document', () => {
  const ledger = [
    ['date', 'account', 'amount', 'balance', 'reference', 'id'],
    [46300, 'main', -12.5, 987.5, 'REF-1', ''],
    [46301, 'main', -1, 986.5, 'REF-2', 'kept-id'],
    ['yesterday', 'main', -3, 983.5, 'REF-3', ''],
  ]

  it('moves every row as stored, gives each ledger row the factory reads an id, keeps one it has, and moves a refused row without one', () => {
    const document = documentOfTabs(COMPANY_APP, { ...EMPTY_TABS, ledger: sheetRowsFromValues(ledger) }, SAVED_AT)
    const [first, second, refused] = document.records['ledger-row']!

    expect(first).toEqual({ date: '2026-10-05', account: 'main', amount: '-12.5', balance: '987.5', reference: 'REF-1', id: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    expect(second).toMatchObject({ id: 'kept-id' })
    expect(refused).toEqual({ date: 'yesterday', account: 'main', amount: '-3', balance: '983.5', reference: 'REF-3' })
  })

  it('keeps the hr_company_registered date, which the xlsx holds as a date cell, as the day it names', () => {
    const settings = [
      ['key', 'value'],
      ['hr_company_registered', 45789],
      ['company_name', 'Example Studio'],
    ]

    const document = documentOfTabs(COMPANY_APP, { ...EMPTY_TABS, settings: sheetRowsFromValues(settings) }, SAVED_AT)
    const workbook = hrDooWorkbook(readDocument({ id: 'moved', source: 'browser', title: 'Moved', syncedAt: SAVED_AT }, document).workbook)

    expect(document.records.setting).toContainEqual({ key: 'hr_company_registered', value: '2025-05-12' })
    expect(workbook.companyFacts.companyRegistered).toBe('2025-05-12')
    expect(tabsOfDocument(document).settings.find((row) => row.cells.key === 'hr_company_registered')?.cells.value).toBe(45789)
  })
})

describe.each([
  ['a file on Drive', driveHarness],
  ['the document kept in this browser', browserHarness],
] as const)('the document in %s', (_name, harnessOf: (used: Set<string>, seed: WorkbookDocument) => Promise<WriteBackHarness>) => {
  it('keeps the fields and the kinds it does not know through a save', async () => {
    const later = [{ planned: true, nested: { kept: ['as', 'it', 'was'] } }]
    const { store, held } = await harnessOf(used, books({ category: CATEGORIES, 'a-later-kind': later }))

    await label(store, 'software', 'Software')

    const saved = await held()
    expect(saved.records.category).toEqual([CATEGORIES[0], { ...CATEGORIES[1], label: 'Software' }])
    expect(saved.records['a-later-kind']).toEqual(later)
  })

  it('keeps the hr_company_registered date through a save of the settings', async () => {
    const { store, held } = await harnessOf(used, books({ setting: [{ key: 'hr_company_registered', value: '2025-05-12' }] }))

    await store.write('Settings saved', (unit) => unit.of(SETTING_WRITES).add({ key: 'company_name', value: 'Example Studio' }))

    expect((await held()).records.setting).toEqual([
      { key: 'hr_company_registered', value: '2025-05-12' },
      { key: 'company_name', value: 'Example Studio' },
    ])
    expect(hrDooWorkbook(store.state.workbook!).companyFacts.companyRegistered).toBe('2025-05-12')
  })

  it('reads a file a newer app saved, and never writes it', async () => {
    const harness = await harnessOf(used, books({ category: CATEGORIES }, { core: 2, 'hr-doo': 1 }))
    const before = await harness.held()

    expect(harness.store.state.workbook?.categories.map((held) => held.slug)).toEqual(['revenue', 'software'])
    await expect(label(harness.store, 'software', 'Software')).rejects.toThrow(new WorkbookWriteRefused(NEWER_FILE))

    expect(await harness.held()).toEqual(before)
    expect(harness.drive?.requests.filter((request) => request === 'upload') ?? []).toEqual([])
  })

  it('treats a file with a contributor this app lacks as saved by a newer app', async () => {
    const { store } = await harnessOf(used, books({ category: CATEGORIES }, { core: 1, 'hr-doo': 1, 'hr-obrt': 1 }))

    await expect(label(store, 'software', 'Software')).rejects.toThrow(NEWER_FILE)
  })
})

describe('two devices saving the file on Drive at the same moment', () => {
  it.each([
    ['in the order they arrived', (uploads: readonly UploadInFlight[]) => [...uploads]],
    ['the other way round', (uploads: readonly UploadInFlight[]) => [...uploads].reverse()],
  ])('keeps both saves when each device changes another record and the uploads land %s', async (_order, landing) => {
    const harness = await driveHarness(used, books({ category: CATEGORIES }))
    const drive = harness.drive!
    const fileId = harness.store.state.choice!.id
    const other = await secondDevice(used, drive, fileId)

    drive.holdUploads()
    const mine = label(harness.store, 'software', 'Software')
    const theirs = label(other, 'revenue', 'Sales')
    drive.land(landing(await drive.uploadsInFlight(2)))
    await Promise.all([mine, theirs])

    const head = decodeDocument(await drive.download(fileId))
    expect(head.records.category?.map((record) => record.label)).toEqual(['Sales', 'Software'])
  })

  it('puts the other device’s save back and refuses the second one when both change the same field', async () => {
    const harness = await driveHarness(used, books({ category: CATEGORIES }))
    const drive = harness.drive!
    const fileId = harness.store.state.choice!.id
    const other = await secondDevice(used, drive, fileId)

    drive.holdUploads()
    const mine = label(harness.store, 'software', 'Software').then(
      () => 'saved',
      (failure: Error) => failure.message,
    )
    const theirs = label(other, 'software', 'Tools').then(
      () => 'saved',
      (failure: Error) => failure.message,
    )
    const uploads = await drive.uploadsInFlight(2)
    const mineFirst = uploads.find((upload) => upload.text.includes('"label":"Software"'))!
    drive.land([mineFirst, uploads.find((upload) => upload !== mineFirst)!])

    expect(await mine).toBe('saved')
    expect(await theirs).toMatch(/changed since the app read it/)
    expect(decodeDocument(await drive.download(fileId)).records.category?.[1]).toMatchObject({ label: 'Software' })
  })
})
