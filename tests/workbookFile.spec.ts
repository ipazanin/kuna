import * as XLSX from 'xlsx'
import { describe, expect, it, vi } from 'vitest'

import { FOREIGN_WORKBOOK_FILES, foreignWorkbookBytes } from '../scripts/support/foreignWorkbookFiles.mjs'
import { exportFileName, previewImport } from '../src/apps/company/workbook/presentation/workbookFiles'
import { NEWER_FILE, encodeDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { COMPANY_APP, installedSchema } from '../src/apps/company/workbook/infrastructure/documentStorePorts'
import { RULE_COLUMNS } from '../src/apps/company/rules/domain/rule'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import { fakeWorkbookSnapshot } from './fixtures/fakeBooks'
import { readWorkbookFile, workbookGrids, writeWorkbookFile } from '../src/apps/company/workbook/infrastructure/workbookFile'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import type { CellValue, WorkbookSnapshot, WorkbookTabs } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { emptyWorkbookTabs } from '../src/apps/company/workbook/infrastructure/emptyWorkbook'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import type { HrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'

const META = { id: 'file', source: 'browser', title: 'File', syncedAt: '2026-10-16T08:00:00.000Z', lastExportedAt: null, unexportedSince: null } as const

function workbookOf(tabs: WorkbookTabs): HrDooWorkbook {
  return hrDooWorkbook(readSnapshot({ meta: META, ...tabs }).workbook)
}

/** What two reads of the same tabs must agree on. The meta differs by design. */
function contentOf(workbook: HrDooWorkbook) {
  const { transactions, categories, accounts, rules, invoices, clients, billingPlan, ownerAdvances, splits, assets, grants, yearEndLines, planLines, payScenarios, settings, companyFacts, problems } =
    workbook
  return { transactions, categories, accounts, rules, invoices, clients, billingPlan, ownerAdvances, splits, assets, grants, yearEndLines, planLines, payScenarios, settings, companyFacts, problems }
}

function xlsxOf(tabs: Record<string, CellValue[][]>): Uint8Array<ArrayBuffer> {
  const book = XLSX.utils.book_new()
  for (const [name, grid] of Object.entries(tabs)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid), name)
  }
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}

describe('the template', () => {
  it('has the sixteen tabs, a note on every header, the default categories and settings, and no rows to fill', async () => {
    const tabs = emptyWorkbookTabs()
    const book = XLSX.read(await writeWorkbookFile(tabs, workbookOf(tabs)), { type: 'array' })

    expect(book.SheetNames).toEqual(['ledger', 'categories', 'accounts', 'settings', 'rules', 'invoices', 'clients', 'outgoing-plan', 'owner-advances', 'assets', 'grants', 'year-end', 'plan', 'scenarios', 'employees', 'splits', 'dismissed'])
    for (const name of book.SheetNames) {
      const sheet = book.Sheets[name]!
      const header = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 })[0] ?? []
      expect(header.length, name).toBeGreaterThan(0)
      header.forEach((_, column) => expect(sheet[XLSX.utils.encode_cell({ r: 0, c: column })]?.c?.[0]?.t, `${name} column ${column + 1}`).toBeTruthy())
    }
    expect(XLSX.utils.sheet_to_json<string[]>(book.Sheets.assets!, { header: 1 })[0]).toEqual([
      'asset', 'bought', 'in_use', 'cost_net', 'group', 'doubled', 'disposed', 'funded_by', 'ledger_reference', 'note', 'id',
    ])
    expect(XLSX.utils.sheet_to_json<string[]>(book.Sheets['year-end']!, { header: 1 })[0]).toEqual([
      'year', 'statement', 'line', 'label', 'amount', 'categories', 'aop', 'source', 'note', 'id',
    ])
    expect(XLSX.utils.sheet_to_json<string[]>(book.Sheets['owner-advances']!, { header: 1 })[0]).toEqual(['date', 'amount', 'description', 'category', 'owner_share', 'id'])
    expect(XLSX.utils.sheet_to_json<string[]>(book.Sheets.splits!, { header: 1 })[0]).toEqual(['date', 'account', 'row_amount', 'row_balance', 'amount', 'category', 'note', 'owner_share', 'id'])
    expect(book.Sheets.splits?.D1?.c?.[0]?.t).toMatch(/finds exactly one row/)
    expect(XLSX.utils.sheet_to_json<string[]>(book.Sheets['outgoing-plan']!, { header: 1 })[0]).toEqual(['item', 'date', 'amount', 'client', 'description', 'id'])
    expect(book.Sheets['outgoing-plan']?.B1?.c?.[0]?.t).toMatch(/billable/)
    expect(book.Sheets.invoices?.A1?.c?.[0]?.t).toMatch(/as text/)
    expect(XLSX.utils.sheet_to_json<string[]>(book.Sheets.rules!, { header: 1 })[0]).toEqual([...RULE_COLUMNS])
    expect(book.Sheets.rules?.B1?.c?.[0]?.t).toMatch(/first enabled one/)
    const ledgerHeader = XLSX.utils.sheet_to_json<string[]>(book.Sheets.ledger!, { header: 1 })[0]
    expect(ledgerHeader?.slice(0, 9)).toEqual(['date', 'account', 'statement', 'counterparty', 'counterparty_iban', 'description', 'amount', 'balance', 'category'])
    expect(book.Sheets.ledger?.A1?.c?.[0]?.t).toMatch(/booking date/)
    expect(book.Sheets.categories?.C1?.c?.[0]?.t).toMatch(/owner-pay module/)
    expect(book.Sheets.settings?.A3?.c?.[0]?.t).toMatch(/exported file/)

    const workbook = workbookOf(tabs)
    expect(workbook.problems).toEqual([])
    expect(workbook.transactions).toEqual([])
    expect(workbook.settings).toEqual(DEFAULT_SETTINGS)
    expect(workbook.categories.find((category) => category.roles.includes('owner-benefit'))).toMatchObject({ slug: 'benefits-from-company-costs', bucket: 'owner-pay' })
    expect(new Set(workbook.categories.map((category) => category.bucket))).toEqual(
      new Set(['income', 'operating', 'taxes', 'owner-pay', 'financing', 'neutral']),
    )
    expect(workbook.categories.find((category) => category.slug === 'vat-refund')).toMatchObject({ bucket: 'operating', roles: ['vat-settlement'] })
    expect(workbook.categories.find((category) => category.slug === 'tax-refund')).toMatchObject({ bucket: 'taxes', roles: [] })
  })

  it('reads back as the same empty workbook', async () => {
    const tabs = emptyWorkbookTabs()
    const contents = await readWorkbookFile(await writeWorkbookFile(tabs, workbookOf(tabs)))

    expect(contents.missingTabs).toEqual([])
    expect(contentOf(workbookOf(contents.tabs))).toEqual(contentOf(workbookOf(tabs)))
  })
})

describe('reading an xlsx file', () => {
  it('reads tabs in any letter case, numbers rows as the sheet does, and lists the tabs it lacks', async () => {
    const contents = await readWorkbookFile(
      xlsxOf({
        Ledger: [
          ['date', 'account', 'amount', 'balance', 'category', 'note'],
          [46300, 'main', -12.5, 87.5, 'software', 'kept'],
          [],
          [46299, 'main', 100, 100, 'revenue'],
        ],
        dashboard: [['ignored']],
      }),
    )

    expect(contents.missingTabs).toEqual(['categories', 'accounts', 'settings', 'rules', 'invoices', 'clients', 'outgoing-plan', 'owner-advances', 'assets', 'grants', 'year-end', 'plan', 'scenarios', 'employees', 'splits', 'dismissed'])
    expect(contents.tabs.ledger.map((row) => row.sheetRow)).toEqual([2, 4])
    expect(contents.tabs.ledger[0]?.cells.note).toBe('kept')
  })

  it('summarises an import before anything is replaced, and refuses a file with no ledger', async () => {
    const file = new File(
      [
        xlsxOf({
          ledger: [
            ['date', 'account', 'amount', 'balance', 'category'],
            [46300, 'main', -12.5, 87.5, 'software'],
            [46299, 'side', 100, 100, 'revenue'],
            ['yesterday', 'main', 1, 1],
          ],
          settings: [['key', 'value'], ['company_name', 'Example Studio'], ['colour', 'teal']],
        }),
      ],
      'books.xlsx',
    )

    const preview = await previewImport(file)
    const refused = await previewImport(new File([xlsxOf({ Sheet1: [['a']] })], 'other.xlsx'))

    expect(preview.title).toBe('Example Studio')
    expect(preview.summary).toMatchObject({
      transactionCount: 2,
      accounts: ['main', 'side'],
      dateRange: { from: '2026-10-04', to: '2026-10-05' },
      categoryCount: 0,
      defaultedTabs: ['categories', 'accounts', 'rules', 'invoices', 'clients', 'outgoing-plan', 'owner-advances', 'assets', 'grants', 'year-end', 'plan', 'scenarios', 'employees', 'splits', 'dismissed'],
      refusal: null,
    })
    expect(preview.summary.problems.map((problem) => [problem.tab, problem.label])).toEqual([
      ['settings', 'colour'],
      ['ledger', 'yesterday, 1, balance 1'],
    ])
    expect(refused.summary.refusal).toMatch(/no tab called "ledger"/)
    expect(preview.counts).toEqual([
      { name: 'ledger', count: 3 },
      { name: 'settings', count: 2 },
    ])
    expect(preview.recordCount).toBe(5)
  })

  it('opens a ledgerboard file such as a backup, and refuses one a newer app saved or another app keeps', async () => {
    const document = newDocument(
      COMPANY_APP,
      installedSchema(),
      {
        'ledger-row': [{ id: 'row-1', date: '2026-10-05', account: 'main', amount: '-12.50', balance: '87.50', category: 'software', flagged_by: 'rule' }],
        setting: [{ key: 'company_name', value: 'Example Studio' }],
        'a-later-kind': [{ kept: 'as it was' }],
      },
      '2026-10-16T08:00:00.000Z',
    )
    const backup = new File([encodeDocument(document)], 'ledgerboard-company-2026-10-16.json')

    const preview = await previewImport(backup)
    const newer = await previewImport(new File([encodeDocument({ ...document, schema: { ...document.schema, core: 99 } })], 'newer.json'))
    const otherApp = await previewImport(new File([encodeDocument({ ...document, app: 'household' })], 'ledgerboard-household.json')).catch((error: unknown) => error)

    expect(preview.document).toEqual(document)
    expect(preview.title).toBe('Example Studio')
    expect(preview.summary).toMatchObject({ transactionCount: 1, defaultedTabs: [], refusal: null })
    expect(preview.counts).toEqual([
      { name: 'ledger', count: 1 },
      { name: 'settings', count: 1 },
      { name: 'a-later-kind', count: 1 },
    ])
    expect(newer.summary.refusal).toBe(NEWER_FILE)
    expect((otherApp as Error).message).toMatch(/holds the books of another ledgerboard app, household/)
  })

  it('says plainly when a file is not a workbook at all, and keeps the reason it failed', async () => {
    const truncatedZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00])
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    const failure = await previewImport(new File([truncatedZip], 'broken.xlsx')).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toMatch(/could not be read as an Excel workbook/)
    expect((failure as Error).cause).toBeInstanceOf(Error)
    expect(logged).toHaveBeenCalledWith('Reading broken.xlsx failed', (failure as Error).cause)
    logged.mockRestore()
    expect((await previewImport(new File(['not a spreadsheet'], 'notes.txt'))).summary.refusal).toMatch(/not a Ledgerboard workbook/)
  })

  it.each(FOREIGN_WORKBOOK_FILES)('reads $name, which another program wrote', async (foreignFile) => {
    const preview = await previewImport(new File([foreignWorkbookBytes(foreignFile)], foreignFile.name))

    if ('refusal' in foreignFile.expected) {
      expect(preview.summary.refusal).toBe(foreignFile.expected.refusal)
      return
    }
    expect(preview.summary).toMatchObject({
      transactionCount: foreignFile.expected.transactions,
      accounts: foreignFile.expected.accounts,
      categoryCount: foreignFile.expected.categories,
      refusal: null,
    })
    expect(preview.summary.problems).toHaveLength(foreignFile.expected.problems)
  })
})

describe('exporting', () => {
  it('round-trips: importing an export gives the same workbook, extra columns included', async () => {
    const original = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'browser')
    const withExtra: WorkbookSnapshot = {
      ...original,
      ledger: original.ledger.map((row, index) => (index === 3 ? { ...row, cells: { ...row.cells, receipt: 'R-17' } } : row)),
    }
    const workbook = hrDooWorkbook(readSnapshot(withExtra).workbook)

    const imported = await readWorkbookFile(await writeWorkbookFile(withExtra, workbook))
    const reimported = await readWorkbookFile(await writeWorkbookFile(imported.tabs, workbookOf(imported.tabs)))

    expect(contentOf(workbookOf(imported.tabs))).toEqual(contentOf(workbook))
    expect(workbook.invoices.length).toBeGreaterThan(10)
    expect(workbook.clients).toHaveLength(2)
    expect(workbook.ownerAdvances).toHaveLength(3)
    expect(workbook.splits).toHaveLength(4)
    expect(imported.tabs.splits.every((row) => typeof row.cells.date === 'number' && typeof row.cells.row_balance === 'number')).toBe(true)
    expect(workbook.assets).toHaveLength(2)
    expect(workbook.yearEndLines.length).toBeGreaterThan(40)
    expect(workbook.payScenarios).toHaveLength(4)
    expect(workbook.billingPlan.length).toBeGreaterThan(15)
    expect(imported.tabs['outgoing-plan'].find((row) => row.cells.date !== undefined)?.cells.date).toEqual(expect.any(Number))
    expect(imported.tabs.invoices.every((row) => typeof row.cells.number === 'string')).toBe(true)
    expect(imported.tabs.ledger[3]?.cells.receipt).toBe('R-17')
    expect(reimported.tabs).toEqual(imported.tabs)
  })

  it('round-trips the rules tab and the camt signal columns', async () => {
    const original = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'browser')
    const withRules: WorkbookSnapshot = {
      ...original,
      ledger: original.ledger.map((row, index) =>
        index === 0
          ? {
              ...row,
              cells: {
                ...row.cells,
                purpose: 'GOVT',
                tx_domain: 'PMNT',
                tx_family: 'ICDT',
                tx_sub_family: 'NTAV',
                creditor_reference: 'HR68 1651-FAKE',
                instructed_currency: 'EUR',
                review_reasons: 'reversal | batched entry',
              },
            }
          : row,
      ),
      rules: [
        { sheetRow: 2, cells: { rule: 'own-account', order: 100, enabled: true, counterparty_is_own: true, category: 'internal-transfer', confidence: 'rule', note: 'Ours.' } },
        { sheetRow: 3, cells: { rule: 'tax-code', order: 200, enabled: true, direction: 'debit', revenue_code: '0651', category: 'corporate-income-tax', confidence: 'rule' } },
        { sheetRow: 4, cells: { rule: 'parked', order: 300, enabled: false, has_counterparty_iban: false, is_card: true, confidence: 'review' } },
      ],
    }
    const workbook = hrDooWorkbook(readSnapshot(withRules).workbook)

    const imported = await readWorkbookFile(await writeWorkbookFile(withRules, workbook))

    expect(workbook.problems).toEqual([])
    expect(workbook.rules.map((rule) => [rule.id, rule.enabled, rule.conditions.length])).toEqual([
      ['own-account', true, 1],
      ['tax-code', true, 2],
      ['parked', false, 2],
    ])
    expect(workbook.transactions[0]?.reviewReasons).toEqual(['reversal', 'batched entry'])
    expect(imported.tabs.rules).toEqual(withRules.rules)
    expect(contentOf(workbookOf(imported.tabs))).toEqual(contentOf(workbook))
  })

  it('keeps the Sheet’s column order, A to R, then the owner share and the id, and writes dates as dates', () => {
    const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z')
    const grids = workbookGrids(snapshot, readSnapshot(snapshot).workbook)
    const header = grids.ledger.header

    expect(header).toEqual([
      'date', 'account', 'statement', 'counterparty', 'counterparty_iban', 'description', 'amount', 'balance',
      'category', 'flagged_by', 'reference',
      'purpose', 'tx_domain', 'tx_family', 'tx_sub_family', 'creditor_reference', 'instructed_currency', 'review_reasons',
      'owner_share', 'id',
    ])
    expect(typeof grids.ledger.rows[0]?.[header.indexOf('date')]).toBe('number')
  })

  it('reads an older file that still has family, bucket and month, and exports them as it found them, after the template’s columns', async () => {
    const older = xlsxOf({
      ledger: [
        ['date', 'account', 'statement', 'counterparty', 'counterparty_iban', 'description', 'amount', 'balance', 'category', 'family', 'bucket', 'month', 'flagged_by', 'reference'],
        [46300, 'main', 's-1', 'Client', '', 'Invoice 1', 500, 500, 'revenue', 'operating', 'neutral', '1999-01', 'rule', 'REF-1'],
      ],
      categories: [
        ['category', 'family', 'bucket'],
        ['revenue', 'income', 'income'],
      ],
      accounts: [
        ['account', 'iban'],
        ['main', 'XX00FAKE0000000001'],
      ],
    })

    const imported = await readWorkbookFile(older)
    const workbook = workbookOf(imported.tabs)
    const grids = workbookGrids(imported.tabs, workbook)
    const reimported = await readWorkbookFile(await writeWorkbookFile(imported.tabs, workbook))

    expect(workbook.problems).toEqual([])
    expect(workbook.transactions[0]).toMatchObject({ category: 'revenue', flaggedBy: 'rule', reference: 'REF-1', family: 'income', bucket: 'income' })
    expect(grids.ledger.header.slice(20)).toEqual(['family', 'bucket', 'month'])
    expect(grids.ledger.rows[0]?.slice(20)).toEqual(['operating', 'neutral', '1999-01'])
    expect(contentOf(workbookOf(reimported.tabs))).toEqual(contentOf(workbook))
  })

  it('writes the year-end amount as a date, a rate or an amount by its line, and the planning dates as dates', async () => {
    const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'browser')
    const book = XLSX.read(await writeWorkbookFile(snapshot, readSnapshot(snapshot).workbook), { type: 'array' })
    const yearEnd = XLSX.utils.sheet_to_json<Record<string, CellValue>>(book.Sheets['year-end']!, { raw: false })

    expect(yearEnd.find((row) => row.line === 'rate')?.amount).toBe('10.00%')
    expect(yearEnd.find((row) => row.line === 'filed-on')?.amount).toBe('2026-04-27')
    expect(yearEnd.find((row) => row.line === 'sales')?.amount).toBe('57,147.33')
    expect(yearEnd.find((row) => row.line === 'months-of-operation')?.amount).toBe('8')
    expect(XLSX.utils.sheet_to_json<Record<string, CellValue>>(book.Sheets.assets!, { raw: false })[0]?.in_use).toBe('2025-06-01')
    expect(XLSX.utils.sheet_to_json<Record<string, CellValue>>(book.Sheets.invoices!, { raw: false })[0]?.period_from).toBe('2025-05-01')
  })

  it('names the file after the company, or else the workbook, and the day', () => {
    const day = new Date(2026, 9, 16)

    expect(exportFileName({ title: 'Books', settings: { ...DEFAULT_SETTINGS, companyName: 'Đurić & Co.' } }, day)).toBe('ledgerboard-duric-co-2026-10-16.xlsx')
    expect(exportFileName({ title: 'Shadow accounting', settings: DEFAULT_SETTINGS }, day)).toBe('ledgerboard-shadow-accounting-2026-10-16.xlsx')
  })
})
