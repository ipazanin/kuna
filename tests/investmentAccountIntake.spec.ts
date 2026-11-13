import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../src/apps/investments/holdings/application/holdingWrites'
import { writeAccountSources } from '../src/apps/investments/mail/application/mailReaderWrites'
import { words as holdingWords } from '../src/apps/investments/holdings/application/words'
import { accountIntakes, intakeRefusal, mailOwned, proposedMailStart } from '../src/apps/investments/imports/domain/accountIntake'
import { NO_ANSWERS, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import { readPortfolioWorkbook } from '../src/apps/investments/imports/domain/portfolioWorkbook'
import { reportRowKey } from '../src/apps/investments/imports/domain/reportKey'
import { firstUnfiledDay } from '../src/apps/investments/tax/domain/taxDeadlines'
import { writeTransaction } from '../src/apps/investments/transactions/application/transactionWrites'
import { textsOf, transactionDraft } from '../src/apps/investments/transactions/domain/transactionDraft'
import { transactionErrors } from '../src/apps/investments/transactions/presentation/words'
import { BY_HAND } from '../src/apps/investments/workbook/domain/investmentAccount'
import type { AccountIntake } from '../src/apps/investments/workbook/domain/investmentAccount'
import { INVESTMENTS_APP, INVESTMENTS_DOCUMENT, emptyInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import { takesRowByHand } from '../src/shared/app/accountSource'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import { dayLabel } from '../src/shared/calendar/dayLabel'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import type { DocumentRecord } from '../src/shared/storage/infrastructure/documentFormat'
import { account, book, cashMovement, instrument, rateBookOf, trade } from './fixtures/investments'
import { workbookGrid } from './fixtures/investmentsDesk'
import { INVESTMENTS, browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

function day(text: string): CivilDate {
  return parseCivilDate(text)!
}

const START = day('2026-06-01')
const MAILED: AccountIntake = { rowsFrom: 'mail', startsOn: START }
const IBKR = account('ibkr', 'IBKR', MAILED)
const OTHER = account('other', 'Other broker')
const FUND = instrument('fund', { name: 'Example Fund', prices: 'manual', sourceSymbol: '' })
const REPORT_KEY = reportRowKey('ibkr-activity-flex', 'U0000001', 'tx-1')

describe('a row by hand on an account an automated source fills', () => {
  it.each([
    ['by-hand', null, '2026-06-01', true],
    ['mail', '2026-06-01', '2026-05-31', true],
    ['mail', '2026-06-01', '2026-06-01', false],
    ['bank-link', '2026-06-01', '2026-06-02', false],
  ] as const)('%s from %s takes a row of %s by hand: %s', (source, startDay, rowDay, takes) => {
    expect(takesRowByHand(source, startDay === null ? null : day(startDay), day(rowDay))).toBe(takes)
  })
})

describe('the day a tax year counts as filed', () => {
  it.each([
    ['2026-11-13', '2026-01-01'],
    ['2027-01-31', '2026-01-01'],
    // The JOPPD for 2026 is due on Monday 1 March 2027, since the last day of February is a Sunday.
    ['2027-03-01', '2026-01-01'],
    ['2027-03-02', '2027-01-01'],
  ])('on %s the first day not filed is %s', (today, first) => {
    expect(firstUnfiledDay(day(today))).toBe(first)
  })
})

describe('an account that does not say how its rows come in', () => {
  const ONE = '3a1f0c2e-4b5d-4e6f-8a7b-9c0d1e2f3a41'
  const TWO = '3a1f0c2e-4b5d-4e6f-8a7b-9c0d1e2f3a42'
  const READER = { id: 'r1', recipe: 'ibkr-activity-flex', on: true, senders: 'reports@broker.example.com', since: '2026-03-01' }
  const MOVED = (id: string, account: string, key: string | null): DocumentRecord => ({
    id,
    account,
    kind: 'deposit',
    date: '2026-04-01',
    currency: 'EUR',
    amount: '100',
    ...(key === null ? {} : { import_key: key }),
  })

  function booksOf(records: Readonly<Record<string, readonly DocumentRecord[]>>) {
    return INVESTMENTS_DOCUMENT.read({
      meta: { id: 'local', source: 'browser', title: 'kuna-investments.json', syncedAt: '2026-10-30T09:00:00.000Z', lastExportedAt: null, unexportedSince: null },
      revision: '1',
      document: newDocument(INVESTMENTS_APP, { investments: 1 }, records, '2026-10-30T09:00:00.000Z'),
    }).workbook
  }

  it("reads as filled by the mail from its reader's start day when it holds a record of that report, and by hand otherwise", () => {
    const { book: read, problems } = booksOf({
      'investment-account': [
        { id: ONE, name: 'IBKR' },
        { id: TWO, name: 'Other' },
      ],
      'cash-movement': [MOVED('c1', ONE, REPORT_KEY), MOVED('c2', TWO, null)],
      'mail-reader': [READER],
    })
    expect(problems).toEqual([])
    expect(read.accounts.map((held) => held.intake)).toEqual([null, null])
    expect([...accountIntakes(read).values()]).toEqual([{ rowsFrom: 'mail', startsOn: '2026-03-01' }, BY_HAND])
  })

  it('reads as by hand once no reader keeps a start day', () => {
    const { book: read } = booksOf({ 'investment-account': [{ id: ONE, name: 'IBKR' }], 'cash-movement': [MOVED('c1', ONE, REPORT_KEY)] })
    expect([...accountIntakes(read).values()]).toEqual([BY_HAND])
  })

  it("is saved with the others on the first write of an account or of the reader, which drops the reader's shared start day, and one Undo puts both back", async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T10:00:00Z'))
    const older = newDocument(
      INVESTMENTS_APP,
      { investments: 1 },
      {
        'investment-account': [
          { id: ONE, name: 'IBKR' },
          { id: TWO, name: 'Other' },
        ],
        'cash-movement': [MOVED('c1', ONE, REPORT_KEY)],
        'mail-reader': [READER],
      },
      '2026-10-30T09:00:00.000Z',
    )
    const { store } = await browserHarness(used, older, INVESTMENTS)
    const read = store.state.workbook!.book
    const other = read.accounts.find((held) => held.name === 'Other')!
    await store.write('Renamed', (unit) => {
      unit.of(INVESTMENT_ACCOUNT_WRITES).change(other, { ...other, name: 'Other broker', intake: BY_HAND })
      writeAccountSources(unit, read, { account: other.id })
    })
    const saved = store.state.workbook!.book
    expect(saved.accounts.map((held) => [held.name, held.intake])).toEqual([
      ['IBKR', { rowsFrom: 'mail', startsOn: '2026-03-01' }],
      ['Other broker', BY_HAND],
    ])
    expect(saved.mailReaders.map((reader) => reader.since)).toEqual([null])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.book.accounts.map((held) => held.intake)).toEqual([null, null])
    expect(store.state.workbook!.book.mailReaders.map((reader) => reader.since)).toEqual(['2026-03-01'])
    vi.useRealTimers()
  })

  it.each([
    [{ rows_from: 'mail' }, 'rows_from mail needs starts_on'],
    [{ rows_from: 'by-hand', starts_on: '2026-03-01' }, 'starts_on is for an account whose rows come from the mail'],
    [{ starts_on: '2026-03-01' }, 'starts_on is for an account whose rows come from the mail'],
    [{ rows_from: 'bank-link' }, '"bank-link" is not a way its rows come in'],
  ])('refuses %o', (fields, reason) => {
    expect(booksOf({ 'investment-account': [{ id: ONE, name: 'IBKR', ...fields }] }).problems.map((problem) => problem.reason)).toEqual([expect.stringContaining(reason)])
  })
})

describe('a record by hand on a day the mail fills', () => {
  const intakes = accountIntakes(book({ accounts: [IBKR, OTHER] }))

  it.each([
    ['before the start day', '2026-05-31', null, null],
    ['on the start day', '2026-06-01', null, IBKR.id],
    ['from the report', '2026-06-02', REPORT_KEY, null],
    ['imported from the workbook', '2026-06-02', 'row-17', IBKR.id],
  ])('%s', (_label, date, importKey, owner) => {
    expect(mailOwned(intakes, { accounts: [IBKR.id], date: day(date), importKey })?.account ?? null).toBe(owner)
  })

  it('lands on an account kept by hand on any day, and a transfer is held to both of its accounts', () => {
    expect(mailOwned(intakes, { accounts: [OTHER.id], date: day('2026-07-01'), importKey: null })).toBeNull()
    expect(mailOwned(intakes, { accounts: [OTHER.id, IBKR.id], date: day('2026-07-01'), importKey: null })).toEqual({ account: IBKR.id, startsOn: START })
  })

  it("marks the dialog's date field with the account and its start day", () => {
    const deposit = cashMovement('deposit', IBKR, '2026-07-01', '100')
    const texts = textsOf({ kind: 'cash-movement', record: deposit }, { happened: 'deposit', instrument: null, today: START }, book({ accounts: [IBKR] }))
    const draft = transactionDraft(texts, book({ accounts: [IBKR] }), 'new')
    expect(draft.record).toBeNull()
    expect(transactionErrors(draft.faults).date).toContain(dayLabel(START))
    expect(transactionDraft(texts, book({ accounts: [IBKR] }), 'new', REPORT_KEY).record).not.toBeNull()
  })
})

describe('a start day that gives the mail more days', () => {
  const TODAY = day('2026-11-13')
  const typed = [{ accounts: [IBKR.id], date: day('2026-07-01'), importKey: null }]

  it('is refused in a tax year already filed, and taken in the first one not filed', () => {
    expect(intakeRefusal(IBKR.id, null, { rowsFrom: 'mail', startsOn: day('2025-12-31') }, [], TODAY)).toEqual({ kind: 'filed-year', year: 2025, firstOpen: '2026-01-01' })
    expect(intakeRefusal(IBKR.id, null, { rowsFrom: 'mail', startsOn: day('2026-01-01') }, [], TODAY)).toBeNull()
  })

  it('is refused over records by hand on the days it gives the mail', () => {
    expect(intakeRefusal(IBKR.id, BY_HAND, MAILED, typed, TODAY)).toEqual({ kind: 'rows-by-hand', count: 1, startsOn: START })
    expect(intakeRefusal(IBKR.id, BY_HAND, { rowsFrom: 'mail', startsOn: day('2026-07-02') }, typed, TODAY)).toBeNull()
  })

  it('checks nothing for a later start day or a switch to by hand, which bring no report row in', () => {
    const filed: AccountIntake = { rowsFrom: 'mail', startsOn: day('2024-06-01') }
    expect(intakeRefusal(IBKR.id, filed, { rowsFrom: 'mail', startsOn: day('2025-01-01') }, typed, TODAY)).toBeNull()
    expect(intakeRefusal(IBKR.id, filed, BY_HAND, typed, TODAY)).toBeNull()
  })
})

describe('the start day proposed when an account comes to take the report', () => {
  const TODAY = day('2026-11-13')
  const typedOn = (date: string, importKey: string | null = null) => ({ accounts: [IBKR.id], date: day(date), importKey })

  it.each([
    ['today with no row by hand', [], '2026-11-13'],
    ['the day after its last row by hand', [typedOn('2026-07-01'), typedOn('2026-08-31')], '2026-09-01'],
    ['past a row of the report', [typedOn('2026-07-01'), typedOn('2026-10-01', REPORT_KEY)], '2026-07-02'],
    ['the first day not filed, after a last row in a filed year', [typedOn('2025-06-30')], '2026-01-01'],
  ])('is %s', (_label, records, proposed) => {
    expect(proposedMailStart(IBKR.id, records, TODAY)).toBe(proposed)
  })
})

describe('the writes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T10:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function storeOf() {
    const { store } = await browserHarness(used, emptyInvestmentsDocument('2026-10-30T09:00:00.000Z'), INVESTMENTS)
    await store.write('Set up', (unit) => {
      unit.of(INVESTMENT_ACCOUNT_WRITES).add(IBKR)
      unit.of(INSTRUMENT_WRITES).add(FUND)
    })
    return store
  }

  it("refuses a record typed on a day the mail fills the account, in the dialog's words, and keeps one before it", async () => {
    const store = await storeOf()
    const after = cashMovement('deposit', IBKR, '2026-06-01', '100')
    await expect(store.write('Typed', (unit) => writeTransaction(unit, null, { kind: 'cash-movement', record: after }))).rejects.toThrow(
      new WorkbookWriteRefused(holdingWords.mailOwnsDay('IBKR', START, START)),
    )
    await store.write('Typed', (unit) => writeTransaction(unit, null, { kind: 'cash-movement', record: cashMovement('deposit', IBKR, '2026-05-31', '100') }))
    await store.write('Report', (unit) => writeTransaction(unit, null, { kind: 'trade', record: { ...trade('buy', IBKR, FUND, '2026-06-02', '1', '10', null), importKey: REPORT_KEY } }))
    expect(store.state.workbook!.book.cashMovements).toHaveLength(1)
    expect(store.state.workbook!.book.trades).toHaveLength(1)
  })

  it('refuses a start day moved into a filed tax year, and one over records by hand', async () => {
    const store = await storeOf()
    await store.write('Typed', (unit) => writeTransaction(unit, null, { kind: 'cash-movement', record: cashMovement('deposit', IBKR, '2026-05-01', '100') }))
    const earlier = (startsOn: string) => store.write('Moved', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).change(IBKR, { ...IBKR, intake: { rowsFrom: 'mail', startsOn: day(startsOn) } }))
    await expect(earlier('2025-12-01')).rejects.toThrow(new WorkbookWriteRefused(`IBKR: ${holdingWords.startInFiledYear(2025, day('2026-01-01'))}`))
    await expect(earlier('2026-04-01')).rejects.toThrow(new WorkbookWriteRefused(`IBKR: ${holdingWords.startOverHandRows(day('2026-04-01'))}`))
    await earlier('2026-05-02')
    expect(accountIntakes(store.state.workbook!.book).get(IBKR.id)).toEqual({ rowsFrom: 'mail', startsOn: '2026-05-02' })
  })
})

describe('a workbook import', () => {
  it('skips a row on a day the mail fills its account, saying the account and its start day, and keeps the rows before it', () => {
    const read = readPortfolioWorkbook([
      {
        name: 'Transactions',
        grid: workbookGrid([
          ['2026-05-31', { broker: 'IBKR', account: 'U0000001', type: 'DEPOSIT', currency: 'EUR', netCash: 100 }],
          ['2026-06-01', { broker: 'IBKR', account: 'U0000001', type: 'DEPOSIT', currency: 'EUR', netCash: 200 }],
        ]),
      },
    ])
    if (read.kind !== 'read') throw new Error('The workbook was refused.')
    const dryRun = workbookDryRun(read, { book: book({ accounts: [IBKR] }), rates: rateBookOf(new Map()), answers: { ...NO_ANSWERS, accounts: new Map([['U0000001', IBKR]]) } })
    expect(dryRun.entries.map((entry) => entry.rows[0].date)).toEqual(['2026-05-31'])
    expect(dryRun.skipped).toEqual([{ fileRow: 3, reason: { kind: 'mail-owns', account: 'IBKR', startsOn: START } }])
  })
})
