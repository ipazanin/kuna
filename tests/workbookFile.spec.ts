import * as XLSX from 'xlsx'
import { describe, expect, it, vi } from 'vitest'

import { FOREIGN_WORKBOOK_FILES, foreignWorkbookBytes } from '../scripts/support/foreignWorkbookFiles.mjs'
import { exportFileName, previewImport } from '../src/features/excel/application/workbookFiles'
import { RULE_COLUMNS } from '../src/features/rules/domain/rule'
import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import type { Workbook } from '../src/features/workbook/domain/workbook'
import { fakeWorkbookSnapshot } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { readWorkbookFile, workbookGrids, writeWorkbookFile } from '../src/features/workbook/infrastructure/workbookFile'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'
import type { CellValue, WorkbookSnapshot, WorkbookTabs } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { emptyWorkbookTabs } from '../src/features/workbook/infrastructure/workbookTemplate'

const META = { id: 'file', source: 'excel', title: 'File', syncedAt: '2026-10-16T08:00:00.000Z', ledgerSheetId: null, lastExportedAt: null, unexportedSince: null, missingTabs: [] } as const

function workbookOf(tabs: WorkbookTabs): Workbook {
  return readWorkbook({ meta: META, ...tabs })
}

/** What two reads of the same tabs must agree on. The meta differs by design. */
function contentOf(workbook: Workbook) {
  const { transactions, categories, accounts, rules, invoices, clients, ownerAdvances, settings, problems } = workbook
  return { transactions, categories, accounts, rules, invoices, clients, ownerAdvances, settings, problems }
}

function xlsxOf(tabs: Record<string, CellValue[][]>): Uint8Array<ArrayBuffer> {
  const book = XLSX.utils.book_new()
  for (const [name, grid] of Object.entries(tabs)) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid), name)
  }
  return new Uint8Array(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer)
}

describe('the template', () => {
  it('has the eight tabs, a note on every header, the default categories and settings, and no rows to fill', async () => {
    const tabs = emptyWorkbookTabs()
    const book = XLSX.read(await writeWorkbookFile(tabs, workbookOf(tabs)), { type: 'array' })

    expect(book.SheetNames).toEqual(['ledger', 'categories', 'accounts', 'settings', 'rules', 'invoices', 'clients', 'owner-advances'])
    expect(XLSX.utils.sheet_to_json<string[]>(book.Sheets['owner-advances']!, { header: 1 })[0]).toEqual(['date', 'amount', 'description', 'category'])
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
    expect(new Set(workbook.categories.map((category) => category.bucket))).toEqual(
      new Set(['income', 'operating', 'taxes', 'owner-pay', 'financing', 'neutral']),
    )
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

    expect(contents.missingTabs).toEqual(['categories', 'accounts', 'settings', 'rules', 'invoices', 'clients', 'owner-advances'])
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
      defaultedTabs: ['categories', 'accounts', 'rules', 'invoices', 'clients', 'owner-advances'],
      refusal: null,
    })
    expect(preview.summary.problems.map((problem) => [problem.tab, problem.sheetRow])).toEqual([
      ['settings', 3],
      ['ledger', 4],
    ])
    expect(refused.summary.refusal).toMatch(/no tab called "ledger"/)
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
    const original = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'excel')
    const withExtra: WorkbookSnapshot = {
      ...original,
      ledger: original.ledger.map((row, index) => (index === 3 ? { ...row, cells: { ...row.cells, receipt: 'R-17' } } : row)),
    }
    const workbook = readWorkbook(withExtra)

    const imported = await readWorkbookFile(await writeWorkbookFile(withExtra, workbook))
    const reimported = await readWorkbookFile(await writeWorkbookFile(imported.tabs, workbookOf(imported.tabs)))

    expect(contentOf(workbookOf(imported.tabs))).toEqual(contentOf(workbook))
    expect(workbook.invoices.length).toBeGreaterThan(10)
    expect(workbook.clients).toHaveLength(2)
    expect(workbook.ownerAdvances).toHaveLength(4)
    expect(imported.tabs.invoices.every((row) => typeof row.cells.number === 'string')).toBe(true)
    expect(imported.tabs.ledger[3]?.cells.receipt).toBe('R-17')
    expect(reimported.tabs).toEqual(imported.tabs)
  })

  it('round-trips the rules tab and the camt signal columns', async () => {
    const original = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z', 'excel')
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
    const workbook = readWorkbook(withRules)

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

  it('keeps the Sheet’s column order, fills family, bucket and month in, and writes dates as dates', () => {
    const snapshot = fakeWorkbookSnapshot('2026-10-16T08:00:00.000Z')
    const grids = workbookGrids(snapshot, readWorkbook(snapshot))
    const header = grids.ledger.header

    expect(header.slice(0, 21)).toEqual([
      'date', 'account', 'statement', 'counterparty', 'counterparty_iban', 'description', 'amount', 'balance',
      'category', 'family', 'bucket', 'month', 'flagged_by', 'reference',
      'purpose', 'tx_domain', 'tx_family', 'tx_sub_family', 'creditor_reference', 'instructed_currency', 'review_reasons',
    ])
    const first = grids.ledger.rows[0] ?? []
    expect(typeof first[header.indexOf('date')]).toBe('number')
    expect(first[header.indexOf('month')]).toBe('2026-10')
  })

  it('names the file after the company, or else the workbook, and the day', () => {
    const day = new Date(2026, 9, 16)

    expect(exportFileName({ title: 'Books', settings: { ...DEFAULT_SETTINGS, companyName: 'Đurić & Co.' } }, day)).toBe('ledgerboard-duric-co-2026-10-16.xlsx')
    expect(exportFileName({ title: 'Shadow accounting', settings: DEFAULT_SETTINGS }, day)).toBe('ledgerboard-shadow-accounting-2026-10-16.xlsx')
  })
})
