import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../src/apps/investments/holdings/application/holdingWrites'
import { writeInvestmentAccount } from '../src/apps/investments/holdings/application/accountSourceWrites'
import { writeAccountSources } from '../src/apps/investments/mail/application/mailReaderWrites'
import { words as holdingWords } from '../src/apps/investments/holdings/application/words'
import { accountSources, mailOwned, proposedMailStart, sourcesRefusal } from '../src/apps/investments/imports/domain/accountIntake'
import { NO_ANSWERS, workbookDryRun } from '../src/apps/investments/imports/domain/importDryRun'
import { readPortfolioWorkbook } from '../src/apps/investments/imports/domain/portfolioWorkbook'
import { reportRowKey } from '../src/apps/investments/imports/domain/reportKey'
import { firstUnfiledDay } from '../src/apps/investments/tax/domain/taxDeadlines'
import { writeTransaction } from '../src/apps/investments/transactions/application/transactionWrites'
import { keyOf, textsOf, transactionDraft } from '../src/apps/investments/transactions/domain/transactionDraft'
import { transactionErrors } from '../src/apps/investments/transactions/presentation/words'
import { BY_HAND_SOURCES } from '../src/apps/investments/workbook/domain/investmentAccount'
import type { InvestmentPeriod } from '../src/apps/investments/workbook/domain/investmentAccount'
import { INVESTMENTS_DOCUMENT, emptyInvestmentsDocument } from '../src/apps/investments/workbook/infrastructure/investmentsDocument'
import { INVESTMENTS_APP } from '../src/apps/investments/workbook/domain/investmentsApp'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
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
const MAILED: readonly InvestmentPeriod[] = [{ source: 'mail', from: START }]
const IBKR = account('ibkr', 'IBKR', MAILED)
const OTHER = account('other', 'Other broker')
const FUND = instrument('fund', { name: 'Example Fund', prices: 'manual', sourceSymbol: '' })
const REPORT_KEY = reportRowKey('ibkr-activity-flex', 'U0000001', 'tx-1')
const REPORT_ID = cashMovement('deposit', account('ibkr'), '2026-06-01', '1').id

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
    expect(read.accounts.map((held) => held.sources)).toEqual([null, null])
    expect([...accountSources(read).values()]).toEqual([[{ source: 'mail', from: '2026-03-01' }], BY_HAND_SOURCES])
  })

  it('reads as by hand once no reader keeps a start day', () => {
    const { book: read } = booksOf({ 'investment-account': [{ id: ONE, name: 'IBKR' }], 'cash-movement': [MOVED('c1', ONE, REPORT_KEY)] })
    expect([...accountSources(read).values()]).toEqual([BY_HAND_SOURCES])
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
      unit.of(INVESTMENT_ACCOUNT_WRITES).change(other, { ...other, name: 'Other broker', sources: BY_HAND_SOURCES })
      writeAccountSources(unit, read, { account: other.id })
    })
    const saved = store.state.workbook!.book
    expect(saved.accounts.map((held) => [held.name, held.sources])).toEqual([
      ['IBKR', [{ source: 'mail', from: '2026-03-01' }]],
      ['Other broker', BY_HAND_SOURCES],
    ])
    expect(saved.mailReaders.map((reader) => reader.since)).toEqual([null])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.book.accounts.map((held) => held.sources)).toEqual([null, null])
    expect(store.state.workbook!.book.mailReaders.map((reader) => reader.since)).toEqual(['2026-03-01'])
    vi.useRealTimers()
  })

  it.each([
    [{ rows_from: 'mail' }, 'rows_from mail needs starts_on'],
    [{ rows_from: 'by-hand', starts_on: '2026-03-01' }, 'starts_on and also_from are for an account whose rows come from the mail'],
    [{ starts_on: '2026-03-01' }, 'starts_on and also_from are for an account whose rows come from the mail'],
    [{ rows_from: 'by-hand', also_from: 'provider-file' }, 'starts_on and also_from are for an account whose rows come from the mail'],
    [{ rows_from: 'mail', starts_on: '2026-03-01', also_from: 'typing' }, '"typing" is not a other origin of its rows'],
    [{ rows_from: 'bank-link' }, '"bank-link" is not a way its rows come in'],
  ])('refuses %o', (fields, reason) => {
    expect(booksOf({ 'investment-account': [{ id: ONE, name: 'IBKR', ...fields }] }).problems.map((problem) => problem.reason)).toEqual([expect.stringContaining(reason)])
  })
})

describe('a record by hand on an account the mail fills', () => {
  const sources = accountSources(book({ accounts: [IBKR, OTHER] }))

  it.each([
    ['before the start day', '2026-05-31', null, IBKR.id],
    ['on the start day', '2026-06-01', null, IBKR.id],
    ['from the report', '2026-06-02', REPORT_KEY, null],
    ['imported from the workbook', '2026-06-02', 'row-17', IBKR.id],
  ])('%s', (_label, date, importKey, owner) => {
    expect(mailOwned(sources, { id: REPORT_ID, accounts: [IBKR.id], date: day(date), importKeys: importKey === null ? [] : [importKey] })).toBe(owner)
  })

  it('lands on an account kept by hand on any day, and a transfer is held to both of its accounts', () => {
    expect(mailOwned(sources, { id: REPORT_ID, accounts: [OTHER.id], date: day('2026-07-01'), importKeys: [] })).toBeNull()
    expect(mailOwned(sources, { id: REPORT_ID, accounts: [OTHER.id, IBKR.id], date: day('2026-07-01'), importKeys: [] })).toBe(IBKR.id)
  })

  it("marks the dialog's account field with the account, and lets a record already on it keep its account and day", () => {
    const deposit = cashMovement('deposit', IBKR, '2026-05-01', '100')
    const texts = textsOf({ kind: 'cash-movement', record: deposit }, { happened: 'deposit', instrument: null, today: START }, book({ accounts: [IBKR] }))
    const draft = transactionDraft(texts, book({ accounts: [IBKR] }), 'new')
    expect(draft.record).toBeNull()
    expect(transactionErrors(draft.faults).account).toContain('IBKR')
    expect(transactionDraft(texts, book({ accounts: [IBKR] }), 'new', [REPORT_KEY]).record).not.toBeNull()
    const kept = book({ accounts: [IBKR], cashMovements: [deposit] })
    const fixed = textsOf({ kind: 'cash-movement', record: deposit }, { happened: 'deposit', instrument: null, today: START }, kept)
    expect(transactionDraft({ ...fixed, note: 'Fixed note' }, kept, keyOf({ kind: 'cash-movement', record: deposit })).record).not.toBeNull()
  })
})

describe('periods that give the mail more days', () => {
  const FIRST_OPEN = firstUnfiledDay(day('2026-11-13'))
  const typed = { kept: [{ id: REPORT_ID, accounts: [IBKR.id], date: day('2026-07-01'), importKeys: [] }], back: [] }

  it('are refused in a tax year already filed, and taken in the first one not filed', () => {
    expect(sourcesRefusal(IBKR.id, BY_HAND_SOURCES, [{ source: 'mail', from: day('2025-12-31') }], { kept: [], back: [] }, FIRST_OPEN)).toEqual({
      kind: 'filed',
      firstOpen: '2026-01-01',
      day: '2025-12-31',
    })
    expect(sourcesRefusal(IBKR.id, BY_HAND_SOURCES, [{ source: 'mail', from: day('2026-01-01') }], { kept: [], back: [] }, FIRST_OPEN)).toBeNull()
  })

  it('are refused over records by hand left on the days they give the mail, and keep the records by hand before them', () => {
    expect(sourcesRefusal(IBKR.id, BY_HAND_SOURCES, MAILED, typed, FIRST_OPEN)).toEqual({ kind: 'rows-of-another-source', count: 1 })
    expect(sourcesRefusal(IBKR.id, BY_HAND_SOURCES, [{ source: 'mail', from: day('2026-07-02') }], typed, FIRST_OPEN)).toBeNull()
  })

  it('refuse an Undo once the mail brought a record on the days it was given, and take one before', () => {
    const fromReport = { id: REPORT_ID, accounts: [IBKR.id], date: day('2026-07-01'), importKeys: [REPORT_KEY] }
    // The Undo puts back the periods by hand and the typed record the handover took out.
    expect(sourcesRefusal(IBKR.id, MAILED, BY_HAND_SOURCES, { kept: [fromReport], back: typed.kept }, null)).toEqual({ kind: 'rows-of-another-source', count: 1 })
    expect(sourcesRefusal(IBKR.id, MAILED, BY_HAND_SOURCES, { kept: [], back: typed.kept }, null)).toBeNull()
  })

  it('check nothing for a later start day, which brings no report row in', () => {
    const filed: readonly InvestmentPeriod[] = [{ source: 'mail', from: day('2024-06-01') }]
    expect(sourcesRefusal(IBKR.id, filed, [{ source: 'mail', from: day('2025-01-01') }], typed, FIRST_OPEN)).toBeNull()
  })
})

describe('the start day proposed when an account comes to take the report', () => {
  const TODAY = day('2026-11-13')
  const typedOn = (date: string, importKey: string | null = null) => ({ id: REPORT_ID, accounts: [IBKR.id], date: day(date), importKeys: importKey === null ? [] : [importKey] })

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

  it("refuses a record typed on an account the mail fills on any day, in the dialog's words, and takes the report's", async () => {
    const store = await storeOf()
    for (const date of ['2026-05-31', '2026-06-01']) {
      const typed = cashMovement('deposit', IBKR, date, '100')
      await expect(store.write('Typed', (unit) => writeTransaction(unit, null, { kind: 'cash-movement', record: typed }))).rejects.toThrow(
        new WorkbookWriteRefused(holdingWords.mailOwnsAccount('IBKR')),
      )
    }
    await store.write('Report', (unit) => writeTransaction(unit, null, { kind: 'trade', record: { ...trade('buy', IBKR, FUND, '2026-06-02', '1', '10', null), importKeys: [REPORT_KEY] } }))
    expect(store.state.workbook!.book.cashMovements).toEqual([])
    expect(store.state.workbook!.book.trades).toHaveLength(1)
  })

  it('keeps a record by hand that was there before the mail came, takes a fix of its note, and refuses moving it to another day', async () => {
    const store = await storeOf()
    const kept = cashMovement('deposit', IBKR, '2026-05-01', '100')
    await store.write('Before the mail', (unit) => {
      unit.of(INVESTMENT_ACCOUNT_WRITES).change(IBKR, { ...IBKR, sources: BY_HAND_SOURCES })
      writeTransaction(unit, null, { kind: 'cash-movement', record: kept })
    })
    await store.write('Mail', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).change({ ...IBKR, sources: BY_HAND_SOURCES }, IBKR))
    await store.write('Note', (unit) => writeTransaction(unit, { kind: 'cash-movement', record: kept }, { kind: 'cash-movement', record: { ...kept, note: 'Fixed' } }))
    expect(store.state.workbook!.book.cashMovements.map((movement) => movement.note)).toEqual(['Fixed'])
    const moved = { ...kept, note: 'Fixed', date: day('2026-05-02') }
    await expect(store.write('Moved', (unit) => writeTransaction(unit, { kind: 'cash-movement', record: { ...kept, note: 'Fixed' } }, { kind: 'cash-movement', record: moved }))).rejects.toThrow(
      new WorkbookWriteRefused(holdingWords.mailOwnsAccount('IBKR')),
    )
  })

  it('refuses a start day moved into a filed tax year, and one over records by hand', async () => {
    const store = await storeOf()
    const byHand = { ...IBKR, sources: BY_HAND_SOURCES }
    await store.write('By hand', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).change(IBKR, byHand))
    await store.write('Typed', (unit) => writeTransaction(unit, null, { kind: 'cash-movement', record: cashMovement('deposit', IBKR, '2026-05-01', '100') }))
    const earlier = (startsOn: string) => store.write('Moved', (unit) => unit.of(INVESTMENT_ACCOUNT_WRITES).change(byHand, { ...IBKR, sources: [{ source: 'mail', from: day(startsOn) }] }))
    await expect(earlier('2025-12-01')).rejects.toThrow(new WorkbookWriteRefused(`IBKR: ${holdingWords.startInFiledYear(2025, day('2026-01-01'))}`))
    await expect(earlier('2026-04-01')).rejects.toThrow(new WorkbookWriteRefused(`IBKR: ${holdingWords.rowsOfAnotherSource(1)}`))
    await earlier('2026-05-02')
    expect(accountSources(store.state.workbook!.book).get(IBKR.id)).toEqual([{ source: 'mail', from: '2026-05-02' }])
  })
})

describe("periods that give an account's days to another source", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T10:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('take out the records by hand on the days given to the mail in the same write, which Undo puts back until the mail brings one', async () => {
    const { store } = await browserHarness(used, emptyInvestmentsDocument('2026-10-30T09:00:00.000Z'), INVESTMENTS)
    await store.write('Set up', (unit) => {
      unit.of(INVESTMENT_ACCOUNT_WRITES).add(OTHER)
      unit.of(INSTRUMENT_WRITES).add(FUND)
      writeTransaction(unit, null, { kind: 'cash-movement', record: cashMovement('deposit', OTHER, '2026-07-01', '100') })
      writeTransaction(unit, null, { kind: 'cash-movement', record: cashMovement('deposit', OTHER, '2026-05-01', '50') })
    })
    const mailed = {
      ...OTHER,
      sources: [
        { source: 'by-hand' as const, from: null },
        { source: 'mail' as const, from: START },
      ],
    }
    const before = store.state.workbook!.book
    await store.write('Mail', (unit) => writeInvestmentAccount(unit, before, OTHER, mailed))
    expect(store.state.workbook!.book.cashMovements.map((movement) => movement.date)).toEqual(['2026-05-01'])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook!.book.cashMovements.map((movement) => movement.date).sort()).toEqual(['2026-05-01', '2026-07-01'])
  })
})

describe('a workbook import', () => {
  it('skips every row of an account the mail fills, saying the account', () => {
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
    expect(dryRun.entries).toEqual([])
    expect(dryRun.skipped).toEqual([
      { fileRow: 2, reason: { kind: 'mail-owns', account: 'IBKR' } },
      { fileRow: 3, reason: { kind: 'mail-owns', account: 'IBKR' } },
    ])
  })
})
