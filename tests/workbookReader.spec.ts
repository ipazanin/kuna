import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'
import { sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue, WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'

const CATEGORIES: CellValue[][] = [
  ['category', 'family', 'bucket', 'colour'],
  ['revenue', 'income', 'income', '#d7f0e5'],
  ['Software', 'Operating', 'Operating', '#dce9f9'],
  ['half-filled', 'operating'],
  ['odd-bucket', 'operating', 'expenses'],
  ['revenue', 'neutral', 'neutral'],
]

function snapshotWith(ledger: CellValue[][], categories: CellValue[][] = CATEGORIES, settings: CellValue[][] = []): WorkbookSnapshot {
  return {
    meta: { id: 'sheet', source: 'google', title: 'Books', syncedAt: '2026-10-16T08:00:00.000Z', ledgerSheetId: 0, lastExportedAt: null, unexportedSince: null },
    ledger: sheetRowsFromValues(ledger),
    categories: sheetRowsFromValues(categories),
    accounts: sheetRowsFromValues([
      ['iban', 'account'],
      ['hr12 3456 7890 1234 5678 9', 'Main'],
    ]),
    settings: sheetRowsFromValues(settings),
    rules: [],
  }
}

describe('readWorkbook', () => {
  it('finds every column by header name, wherever it sits', () => {
    const workbook = readWorkbook(
      snapshotWith([
        ['reference', 'amount', 'date', 'account', 'balance', 'category', 'counterparty', 'counterparty_iban', 'flagged_by'],
        ['FAKE-1', -39.9, 46300, 'Main', 1000.1, 'Software', ' Cloud Co ', 'xx00 fake 0001', 'Rule'],
      ]),
    )

    expect(workbook.transactions).toEqual([
      expect.objectContaining({
        account: 'main',
        date: '2026-10-05',
        amount: -3990,
        balance: 100010,
        category: 'software',
        counterparty: 'Cloud Co',
        counterpartyIban: 'XX00FAKE0001',
        flaggedBy: 'rule',
        reference: 'FAKE-1',
        sheetRow: 2,
      }),
    ])
    expect(workbook.accounts).toEqual([{ slug: 'main', label: '', iban: 'HR1234567890123456789', currency: '' }])
  })

  it('reads the optional label of a category, keeping its slug as the identity', () => {
    const workbook = readWorkbook(
      snapshotWith(
        [['date', 'account', 'amount', 'balance']],
        [
          ['category', 'label', 'family', 'bucket'],
          ['ai-services', ' AI tools ', 'operating', 'operating'],
        ],
      ),
    )

    expect(workbook.categories).toEqual([expect.objectContaining({ slug: 'ai-services', label: 'AI tools' })])
  })

  it('reads a numeric reference as text, since the column mixes both', () => {
    const workbook = readWorkbook(
      snapshotWith([
        ['date', 'account', 'amount', 'balance', 'reference'],
        [46310, 'main', -95.49, 10, 11699714971],
        [46309, 'main', -23.91, 105.49, '2026-104257476-11686413376'],
      ]),
    )

    expect(workbook.transactions.map((transaction) => transaction.reference)).toEqual(['11699714971', '2026-104257476-11686413376'])
  })

  it('numbers the sequence from the tab position, so the top row is the newest booking', () => {
    const workbook = readWorkbook(
      snapshotWith([
        ['date', 'account', 'amount', 'balance'],
        [46307, 'main', -300, 700],
        [46307, 'main', -1000, 1000],
        [46300, 'main', 2000, 2000],
      ]),
    )

    expect(workbook.transactions.map((transaction) => [transaction.sheetRow, transaction.sequence])).toEqual([
      [2, 3],
      [3, 2],
      [4, 1],
    ])
  })

  it('takes family and bucket from categories, case-insensitively, and ignores the ledger’s own columns', () => {
    const workbook = readWorkbook(
      snapshotWith([
        ['date', 'account', 'amount', 'balance', 'category', 'family', 'bucket', 'month'],
        [46300, 'main', 100, 100, 'REVENUE', 'operating', 'neutral', '1999-01'],
      ]),
    )

    expect(workbook.transactions[0]).toMatchObject({ category: 'revenue', family: 'income', bucket: 'income' })
  })

  it('reads a category missing from the tab, or only half defined there, as unclassified', () => {
    const workbook = readWorkbook(
      snapshotWith([
        ['date', 'account', 'amount', 'balance', 'category'],
        [46300, 'main', -95.49, 1, 'zzz-test'],
        [46299, 'main', -1, 2, 'half-filled'],
        [46298, 'main', -1, 3, 'odd-bucket'],
        [46297, 'main', -1, 4],
      ]),
    )

    expect(workbook.transactions.map((transaction) => [transaction.category, transaction.family, transaction.bucket])).toEqual([
      ['zzz-test', 'unclassified', 'unclassified'],
      ['half-filled', 'unclassified', 'unclassified'],
      ['odd-bucket', 'unclassified', 'unclassified'],
      ['', 'unclassified', 'unclassified'],
    ])
  })

  it('keeps the first definition of a category and reports the rows it could not use', () => {
    const workbook = readWorkbook(snapshotWith([['date']]))

    expect(workbook.categories.map((category) => [category.slug, category.bucket])).toEqual([
      ['revenue', 'income'],
      ['software', 'operating'],
    ])
    expect(workbook.problems).toEqual([
      { tab: 'categories', sheetRow: 4, reason: 'category, family and bucket are not all filled' },
      { tab: 'categories', sheetRow: 5, reason: '"expenses" is not a bucket' },
      { tab: 'categories', sheetRow: 6, reason: '"revenue" is already defined above' },
    ])
  })

  it('leaves out a ledger row it cannot read and says why', () => {
    const workbook = readWorkbook(
      snapshotWith(
        [
          ['date', 'account', 'amount', 'balance', 'description'],
          ['2026-10-06', 'main', -1, 1],
          [46300, 'main', '-1,00', 1],
          [46300, '', -1, 1],
          [46300, 'main', -1],
          ['', '', '', '', 'a note'],
          [46300, 'main', -1, 1],
        ],
        [['category', 'family', 'bucket']],
      ),
    )

    expect(workbook.transactions.map((transaction) => transaction.sheetRow)).toEqual([7])
    expect(workbook.problems.map((problem) => [problem.sheetRow, problem.reason])).toEqual([
      [2, 'the date "2026-10-06" is not a date cell'],
      [3, 'the amount "-1,00" is not a number'],
      [4, 'no account'],
      [5, 'no balance'],
      [6, 'no date'],
    ])
  })

  it('reads the settings tab, and uses the defaults without one', () => {
    const configured = readWorkbook(
      snapshotWith([['date']], CATEGORIES, [
        ['key', 'value'],
        ['currency', 'usd'],
        ['owner_pay_module', false],
        ['label_operating', 'Running costs'],
      ]),
    )
    const unconfigured = readWorkbook(snapshotWith([['date']]))

    expect(configured.settings).toMatchObject({
      currency: 'USD',
      ownerPayModule: false,
      bucketLabels: expect.objectContaining({ operating: 'Running costs', income: 'Income' }),
    })
    expect(unconfigured.settings).toEqual(DEFAULT_SETTINGS)
    expect(unconfigured.problems.filter((problem) => problem.tab === 'settings')).toEqual([])
  })

  it('reports a setting it cannot use on the settings tab, with its row', () => {
    const workbook = readWorkbook(snapshotWith([['date']], CATEGORIES, [['key', 'value'], ['currency', 'EURO'], ['colour_scheme', 'blue']]))

    expect(workbook.settings.currency).toBe('EUR')
    expect(workbook.problems.filter((problem) => problem.tab === 'settings').map((problem) => problem.sheetRow)).toEqual([2, 3])
  })

  it('reads roles as a list and an account currency, reporting one the workbook does not count in', () => {
    const workbook = readWorkbook({
      ...snapshotWith([['date']], [['category', 'family', 'bucket', 'roles'], ['revenue', 'income', 'income', 'Revenue, watched']]),
      accounts: sheetRowsFromValues([
        ['account', 'iban', 'currency'],
        ['main', '', 'eur'],
        ['travel', '', 'GBP'],
      ]),
    })

    expect(workbook.categories[0]?.roles).toEqual(['revenue', 'watched'])
    expect(workbook.accounts.map((account) => account.currency)).toEqual(['EUR', 'GBP'])
    expect(workbook.problems).toEqual([
      { tab: 'accounts', sheetRow: 3, reason: 'travel is in GBP but the workbook counts in EUR, so its amounts read as EUR' },
    ])
  })
})
