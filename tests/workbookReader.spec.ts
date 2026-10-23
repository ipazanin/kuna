import { describe, expect, it } from 'vitest'

import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import { readSnapshot } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { EMPTY_TABS, sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue, WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { NO_CLIENT_INVOICING } from '../src/features/workbook/domain/workbook'
import { recordIdOf } from '../src/features/workbook/domain/recordId'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, LEDGER_RECORDS } from '../src/features/workbook/domain/recordKind'
import { OWNER_ADVANCE_RECORDS } from '../src/packs/hr-doo/domain/hrDooKinds'
import { withIds } from './fixtures/rowIds'

const CATEGORIES: CellValue[][] = [
  ['category', 'family', 'bucket', 'colour'],
  ['revenue', 'income', 'income', '#d7f0e5'],
  ['Software', 'Operating', 'Operating', '#dce9f9'],
  ['half-filled', 'operating'],
  ['odd-bucket', 'operating', 'expenses'],
]

function snapshotWith(ledger: CellValue[][], categories: CellValue[][] = CATEGORIES, settings: CellValue[][] = []): WorkbookSnapshot {
  return {
    meta: { id: 'sheet', source: 'google', title: 'Books', syncedAt: '2026-10-16T08:00:00.000Z', lastExportedAt: null, unexportedSince: null, missingTabs: [] },
    ...EMPTY_TABS,
    ledger: sheetRowsFromValues(ledger),
    categories: sheetRowsFromValues(categories),
    accounts: sheetRowsFromValues([
      ['iban', 'account'],
      ['hr12 3456 7890 1234 5678 9', 'Main'],
    ]),
    settings: sheetRowsFromValues(settings),
  }
}

describe('readWorkbook', () => {
  it('finds every column by header name, wherever it sits', () => {
    const workbook = readSnapshot(
      snapshotWith([
        ['reference', 'amount', 'date', 'account', 'balance', 'category', 'counterparty', 'counterparty_iban', 'flagged_by'],
        ['FAKE-1', -39.9, 46300, 'Main', 1000.1, 'Software', ' Cloud Co ', 'xx00 fake 0001', 'Rule'],
      ]),
    ).workbook

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
        id: recordIdOf(LEDGER_RECORDS, JSON.stringify(['main', 'FAKE-1'])),
      }),
    ])
    expect(workbook.accounts).toEqual([{ slug: 'main', label: '', iban: 'HR1234567890123456789', currency: '' }])
  })

  it('reads the optional label of a category, keeping its slug as the identity', () => {
    const workbook = readSnapshot(
      snapshotWith(
        [['date', 'account', 'amount', 'balance']],
        [
          ['category', 'label', 'family', 'bucket'],
          ['ai-services', ' AI tools ', 'operating', 'operating'],
        ],
      ),
    ).workbook

    expect(workbook.categories).toEqual([expect.objectContaining({ slug: 'ai-services', label: 'AI tools' })])
  })

  it('reads a numeric reference as text, since the column mixes both', () => {
    const workbook = readSnapshot(
      snapshotWith([
        ['date', 'account', 'amount', 'balance', 'reference'],
        [46310, 'main', -87.36, 10, 11573920468],
        [46309, 'main', -31.84, 97.36, '2026-208813590-11502274931'],
      ]),
    ).workbook

    expect(workbook.transactions.map((transaction) => transaction.reference)).toEqual(['11573920468', '2026-208813590-11502274931'])
  })

  it('numbers the sequence from the balance chain, wherever the rows sit on the tab', () => {
    const workbook = readSnapshot(
      snapshotWith([
        ['date', 'account', 'amount', 'balance'],
        [46307, 'main', -1000, 1000],
        [46300, 'main', 2000, 2000],
        [46307, 'main', -250, 750],
      ]),
    ).workbook

    expect(workbook.transactions.map((transaction) => [transaction.amount, transaction.sequence])).toEqual([
      [-100000, 2],
      [200000, 1],
      [-25000, 3],
    ])
    expect(workbook.problems.filter((problem) => problem.tab === 'ledger')).toEqual([])
  })

  it('counts ledger rows that share their key, and reports each by a label that tells them apart', () => {
    const workbook = readSnapshot(
      snapshotWith([
        ['date', 'account', 'amount', 'balance', 'reference'],
        [46300, 'main', -20, 980, 'DUP'],
        [46299, 'main', 1000, 1000, 'DUP'],
      ]),
    ).workbook

    const clash = 'another ledger row has the same account and reference DUP, so the app cannot tell the two apart'
    expect(workbook.transactions).toHaveLength(2)
    expect(workbook.problems.filter((problem) => problem.tab === 'ledger').map((problem) => [problem.label, problem.reason])).toEqual([
      ['2026-10-05, -20, balance 980', clash],
      ['2026-10-04, 1000, balance 1000', clash],
    ])
  })

  it('reports a day whose balances do not chain on the row its guessed order closes with', () => {
    const workbook = readSnapshot(
      snapshotWith([
        ['date', 'account', 'amount', 'balance', 'reference'],
        [46307, 'main', -250, 700, 'B'],
        [46307, 'main', -1000, 1000, 'A'],
        [46300, 'main', 2000, 2000, 'C'],
      ]),
    ).workbook

    expect(workbook.transactions.map((transaction) => transaction.reference)).toEqual(['B', 'A', 'C'])
    expect(workbook.problems.filter((problem) => problem.tab === 'ledger')).toEqual([
      {
        tab: 'ledger',
        id: recordIdOf(LEDGER_RECORDS, JSON.stringify(['main', 'B'])),
        label: '2026-10-12, -250, balance 700',
        reason: 'the balances of the main rows of 2026-10-12 do not follow from one another, so they are ordered by reference and this row\'s balance closing the day is a guess',
      },
    ])
  })

  it('takes family and bucket from categories, case-insensitively, and ignores the ledger’s own columns', () => {
    const workbook = readSnapshot(
      snapshotWith([
        ['date', 'account', 'amount', 'balance', 'category', 'family', 'bucket', 'month'],
        [46300, 'main', 100, 100, 'REVENUE', 'operating', 'neutral', '1999-01'],
      ]),
    ).workbook

    expect(workbook.transactions[0]).toMatchObject({ category: 'revenue', family: 'income', bucket: 'income' })
  })

  it('reads a category missing from the tab, or only half defined there, as unclassified', () => {
    const workbook = readSnapshot(
      snapshotWith([
        ['date', 'account', 'amount', 'balance', 'category'],
        [46300, 'main', -87.36, 1, 'zzz-test'],
        [46299, 'main', -1, 2, 'half-filled'],
        [46298, 'main', -1, 3, 'odd-bucket'],
        [46297, 'main', -1, 4],
      ]),
    ).workbook

    expect(workbook.transactions.map((transaction) => [transaction.category, transaction.family, transaction.bucket])).toEqual([
      ['zzz-test', 'unclassified', 'unclassified'],
      ['half-filled', 'unclassified', 'unclassified'],
      ['odd-bucket', 'unclassified', 'unclassified'],
      ['', 'unclassified', 'unclassified'],
    ])
  })

  it('reports the rows it could not use as categories, and defines a category on two rows by neither', () => {
    const workbook = readSnapshot(snapshotWith([['date']], [...CATEGORIES, ['revenue', 'neutral', 'neutral']])).workbook

    expect(workbook.categories.map((category) => [category.slug, category.bucket])).toEqual([['software', 'operating']])
    expect(workbook.problems).toEqual([
      { tab: 'categories', id: recordIdOf(CATEGORY_RECORDS, 'half-filled'), label: 'half-filled', reason: 'category, family and bucket are not all filled' },
      { tab: 'categories', id: recordIdOf(CATEGORY_RECORDS, 'odd-bucket'), label: 'odd-bucket', reason: '"expenses" is not a bucket' },
      { tab: 'categories', id: recordIdOf(CATEGORY_RECORDS, 'revenue'), label: 'revenue', reason: '"revenue" is defined on more than one row, so none of them counts' },
      { tab: 'categories', id: recordIdOf(CATEGORY_RECORDS, 'revenue'), label: 'revenue', reason: '"revenue" is defined on more than one row, so none of them counts' },
    ])
  })

  it('reads an account named on two rows from neither', () => {
    const workbook = readSnapshot({
      ...snapshotWith([['date']]),
      accounts: sheetRowsFromValues([
        ['account', 'iban'],
        ['main', 'XX00FAKE0001'],
        ['Main', 'XX00FAKE0002'],
        ['travel', ''],
      ]),
    }).workbook

    expect(workbook.accounts.map((account) => account.slug)).toEqual(['travel'])
    expect(workbook.problems.filter((problem) => problem.tab === 'accounts').map((problem) => [problem.tab, problem.label, problem.reason])).toEqual([
      ['accounts', 'main', 'main is named on more than one row, so none of them counts'],
      ['accounts', 'Main', 'main is named on more than one row, so none of them counts'],
    ])
  })

  it('leaves out a ledger row it cannot read and says why', () => {
    const workbook = readSnapshot(
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
    ).workbook

    expect(workbook.transactions).toHaveLength(1)
    expect(workbook.problems.map((problem) => [problem.label, problem.reason])).toEqual([
      ['2026-10-06, -1, balance 1', 'the date "2026-10-06" is not a date cell'],
      ['2026-10-05, -1,00, balance 1', 'the amount "-1,00" is not a number'],
      ['2026-10-05, -1, balance 1', 'no account'],
      ['2026-10-05, -1', 'no balance'],
      ['a note', 'no date'],
    ])
  })

  it('reads the settings tab, and uses the defaults without one', () => {
    const configured = readSnapshot(
      snapshotWith([['date']], CATEGORIES, [
        ['key', 'value'],
        ['currency', 'usd'],
        ['owner_pay_module', false],
        ['label_operating', 'Running costs'],
      ]),
    ).workbook
    const unconfigured = readSnapshot(snapshotWith([['date']])).workbook

    expect(configured.settings).toMatchObject({
      currency: 'USD',
      ownerPayModule: false,
      bucketLabels: expect.objectContaining({ operating: 'Running costs', income: 'Income' }),
    })
    expect(unconfigured.settings).toEqual(DEFAULT_SETTINGS)
    expect(unconfigured.problems.filter((problem) => problem.tab === 'settings')).toEqual([])
  })

  it('reports a setting it cannot use on the settings tab, by its key', () => {
    const workbook = readSnapshot(snapshotWith([['date']], CATEGORIES, [['key', 'value'], ['currency', 'EURO'], ['colour_scheme', 'blue']])).workbook

    expect(workbook.settings.currency).toBe('EUR')
    expect(workbook.problems.filter((problem) => problem.tab === 'settings').map((problem) => problem.label)).toEqual(['currency', 'colour_scheme'])
  })

  it('reads roles as a list and an account currency, reporting one the workbook does not count in', () => {
    const workbook = readSnapshot({
      ...snapshotWith([['date']], [['category', 'family', 'bucket', 'roles'], ['revenue', 'income', 'income', 'Revenue, watched']]),
      accounts: sheetRowsFromValues([
        ['account', 'iban', 'currency'],
        ['main', '', 'eur'],
        ['travel', '', 'GBP'],
      ]),
    }).workbook

    expect(workbook.categories[0]?.roles).toEqual(['revenue', 'watched'])
    expect(workbook.accounts.map((account) => account.currency)).toEqual(['EUR', 'GBP'])
    expect(workbook.problems).toEqual([
      { tab: 'accounts', id: recordIdOf(ACCOUNT_RECORDS, 'travel'), label: 'travel', reason: 'travel is in GBP but the workbook counts in EUR, so its amounts read as EUR' },
    ])
  })

  it('reads invoices and clients, keeping a number as text and leaving out every row of an IBAN or a number given twice', () => {
    const workbook = readSnapshot({
      ...snapshotWith([['date']]),
      clients: sheetRowsFromValues([
        ['client', 'name', 'iban'],
        ['North', 'North Ltd', 'xx00 fake 0101'],
        ['north', '', 'XX00FAKE0102'],
        ['south', 'South GmbH', 'XX00FAKE0101'],
        ['', 'Nobody', 'XX00FAKE0999'],
      ]),
      invoices: sheetRowsFromValues([
        ['number', 'client', 'item', 'amount', 'issued', 'due'],
        ['1-1-26', 'north', 'Work', 1200.5, 46050, 46081],
        ['2-1-26', 'north', '', 300, 46080, ''],
        ['1-1-26', 'North', 'Again', 10, 46090],
        ['3-1-26', 'east', '', 100, 46090],
        ['4-1-26', 'north', '', 'lots', 46090],
        ['5-1-26', 'north', '', 50, '2026-02-01'],
      ]),
    }).workbook

    expect(workbook.clients).toEqual([{ slug: 'north', name: '', ibans: ['XX00FAKE0102'], invoicing: NO_CLIENT_INVOICING }])
    expect(workbook.invoices.map((invoice) => [invoice.number, invoice.client, invoice.amount, invoice.issued, invoice.due])).toEqual([
      ['2-1-26', 'north', 30000, '2026-02-27', null],
      ['3-1-26', 'east', 10000, '2026-03-09', null],
    ])
    expect(workbook.problems.filter((problem) => problem.tab !== 'categories').map((problem) => [problem.tab, problem.label])).toEqual([
      ['clients', 'XX00FAKE0999'],
      ['clients', 'North, xx00 fake 0101'],
      ['clients', 'south, XX00FAKE0101'],
      ['invoices', '4-1-26'],
      ['invoices', '5-1-26'],
      ['invoices', '1-1-26'],
      ['invoices', '1-1-26'],
      ['invoices', '3-1-26'],
    ])
    expect(workbook.problems.find((problem) => problem.tab === 'clients' && problem.label === 'south, XX00FAKE0101')?.reason).toBe('XX00FAKE0101 is on more than one row, so none of them counts')
    expect(workbook.problems.find((problem) => problem.tab === 'invoices' && problem.label === '1-1-26')?.reason).toBe('invoice 1-1-26 for north is listed on more than one row, so none of them counts')
    expect(workbook.problems.find((problem) => problem.tab === 'invoices' && problem.label === '3-1-26')?.reason).toMatch(/east is not on the clients tab/)
  })

  it('reads a name or invoice detail a client’s rows give differently as blank, and reports it on each of its rows', () => {
    const workbook = readSnapshot({
      ...snapshotWith([['date']]),
      clients: sheetRowsFromValues([
        ['client', 'name', 'iban', 'address', 'reverse_charge'],
        ['north', 'North Ltd', 'XX00FAKE0101', '1 Road', true],
        ['north', 'North Limited', 'XX00FAKE0102', '', false],
        ['north', '', 'XX00FAKE0103', '1 Road', ''],
      ]),
    }).workbook

    expect(workbook.clients).toEqual([
      { slug: 'north', name: '', ibans: ['XX00FAKE0101', 'XX00FAKE0102', 'XX00FAKE0103'], invoicing: { ...NO_CLIENT_INVOICING, address: '1 Road' } },
    ])
    expect(workbook.problems.filter((problem) => problem.tab === 'clients').map((problem) => [problem.label, problem.reason])).toEqual([
      ['north, XX00FAKE0101', 'the rows of north give name, reverse_charge differently, so they read blank'],
      ['north, XX00FAKE0102', 'the rows of north give name, reverse_charge differently, so they read blank'],
      ['north, XX00FAKE0103', 'the rows of north give name, reverse_charge differently, so they read blank'],
    ])
  })

  it('reads an advance as a cost the owner paid, and leaves out a negative one, a zero, a text amount and a category outside the operating and taxes buckets', () => {
    const workbook = readSnapshot({
      ...snapshotWith([['date']]),
      'owner-advances': sheetRowsFromValues(
        withIds('advance', [
          ['date', 'amount', 'description', 'category'],
          [46300, 89, 'Design tool', 'Software'],
          [46301, -5, 'Private share of a software order', 'software'],
          [46301, 0, 'Nothing', 'software'],
          [46301, 'twelve', 'Typed in words', 'software'],
          [46302, 20, 'Sold a chair', 'revenue'],
          [46303, 15, 'Lunch', 'snacks'],
        ]),
      ),
    }).workbook

    expect(workbook.ownerAdvances).toEqual([
      { date: '2026-10-05', amount: 8900, description: 'Design tool', category: 'software', family: 'operating', bucket: 'operating', id: recordIdOf(OWNER_ADVANCE_RECORDS, 'advance-2') },
    ])
    expect(workbook.problems.filter((problem) => problem.tab === 'owner-advances').map((problem) => problem.reason)).toEqual([
      'a negative amount is the owner’s private share of a company payment, which belongs on the splits tab. Press "Split" on its bank row on Transactions instead',
      'the amount is zero',
      'the amount "twelve" is not a number',
      '"revenue" is in the income bucket, and an advance counts as an operating cost or a tax',
      '"snacks" is not on the categories tab',
    ])
  })
})
