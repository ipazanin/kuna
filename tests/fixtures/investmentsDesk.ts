import { investmentsAcceptance, investmentsProposer } from '../../src/apps/investments/assistant/operations/investmentsOperations'
import { FILE_OPEN } from './browserFile'
import type { InvestmentsPorts } from '../../src/apps/investments/assistant/operations/investmentsOperations'
import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../../src/apps/investments/holdings/application/holdingWrites'
import { TARGET_WRITES, replaceRows } from '../../src/apps/investments/holdings/application/mixWrites'
import type { WorkbookRows } from '../../src/apps/investments/imports/domain/importDryRun'
import { OPTIONAL_COLUMNS, WORKBOOK_COLUMNS, readPortfolioWorkbook } from '../../src/apps/investments/imports/domain/portfolioWorkbook'
import { MAIL_READER_WRITES } from '../../src/apps/investments/mail/application/mailReaderWrites'
import { IBKR_FLEX_RECIPE } from '../../src/apps/investments/mail/domain/ibkrFlexRecipe'
import type { PricesFetchRun } from '../../src/apps/investments/prices/application/pricesUpdate'
import { NO_FETCHED_FACTS, emptyPricesFile } from '../../src/apps/investments/prices/domain/pricesFile'
import type { PricesFile } from '../../src/apps/investments/prices/domain/pricesFile'
import { writeTransaction } from '../../src/apps/investments/transactions/application/transactionWrites'
import type { TransactionRecord } from '../../src/apps/investments/transactions/domain/listedTransactions'
import type { HandPrice } from '../../src/apps/investments/workbook/domain/handPrice'
import type { InvestmentsBooks } from '../../src/apps/investments/workbook/domain/investmentsBooks'
import { MAIL_READER_RECORDS, PRICE_RECORDS } from '../../src/apps/investments/workbook/domain/investmentKinds'
import type { MailReader } from '../../src/apps/investments/workbook/domain/mailReader'
import { emptyInvestmentsDocument } from '../../src/apps/investments/workbook/infrastructure/investmentsDocument'
import type { ChatReads } from '../../src/shared/ai/application/chatReads'
import type { ChatAttachment } from '../../src/shared/ai/domain/chatAttachments'
import { serialFromCivilDate } from '../../src/shared/calendar/civilDate'
import { proposeChanges } from '../../src/shared/ai/application/chatProposals'
import { chatRefs } from '../../src/shared/ai/domain/chatRefs'
import type { CheckedProposal } from '../../src/shared/app/assistantOperations'
import { EURO } from '../../src/shared/money/currencyCode'
import type { RateBook } from '../../src/shared/money/rateBook'
import { newPseudonyms } from '../../src/shared/privacy/domain/pseudonyms'
import type { WorkbookStore } from '../../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'
import type { AskedRow } from '../../src/shared/recipes/domain/runRecipe'
import { profileFact } from './facts'
import { USD, account, cashMovement, cashTransfer, decimal, dividend, exchange, instrument, spinOff, split, trade } from './investments'
import { civil } from './ledger'
import { INVESTMENTS, browserHarness } from './writeBack'

const ONE = account('one', 'Broker One')
const TWO = account('two', 'Broker Two')
const EMPTY = account('empty', 'Old broker')
const SHARE = instrument('share', { name: 'Example Tech', currency: USD })
const FUND = instrument('fund', { name: 'Example Fund', prices: 'manual', sourceSymbol: '' })
const SPUN = instrument('spun', { name: 'Example Spinco', currency: USD, prices: 'manual', sourceSymbol: '' })
const UNHELD = instrument('unheld', { name: 'Example Watchlist', prices: 'manual', sourceSymbol: '' })

const DEPOSIT = cashMovement('deposit', ONE, '2026-01-05', '5000')
const SHARE_BUY = trade('buy', ONE, SHARE, '2026-01-10', '10', '100', '1', '1.08')
const FUND_BUY = trade('buy', ONE, FUND, '2026-01-12', '3', '10', null)
const DIVIDEND = dividend(ONE, SHARE, '2026-03-15', '3.2', '0.48', '1.08')
const EXCHANGE = exchange(ONE, '2026-02-01', '100', EURO, '108', USD)
const TRANSFER = cashTransfer(ONE, TWO, '2026-02-02', EURO, '50')
const SPLIT = split(FUND, '2026-04-01', 2, 1)
const SPIN_OFF = spinOff(SHARE, SPUN, '2026-05-01', '1', '0.1')
const PRICE: HandPrice = { id: recordIdOf(PRICE_RECORDS, 'fund-2026-06-30'), instrument: FUND.id, date: civil('2026-06-30'), price: decimal('10.4'), note: '' }
const READER: MailReader = {
  id: recordIdOf(MAIL_READER_RECORDS, 'ibkr'),
  recipe: IBKR_FLEX_RECIPE.id,
  on: true,
  senders: ['reports@example.com'],
  subject: '',
  contents: '',
  since: civil('2026-01-01'),
  leftOut: [],
}

const WORKBOOK_HEADERS = { ...WORKBOOK_COLUMNS, ...OPTIONAL_COLUMNS }

type WorkbookCells = Partial<Record<keyof typeof WORKBOOK_HEADERS, string | number>>

/** A workbook's Transactions tab with the rows given, under the headers the reader looks for, the optional ones too. */
export function workbookGrid(rows: readonly (readonly [string, WorkbookCells])[]): (string | number)[][] {
  const columns = Object.keys(WORKBOOK_HEADERS) as (keyof typeof WORKBOOK_HEADERS)[]
  return [columns.map((column) => WORKBOOK_HEADERS[column]), ...rows.map(([date, cells]) => columns.map((column) => (column === 'date' ? serialFromCivilDate(civil(date)) : (cells[column] ?? ''))))]
}

/** What a sync read from mail: one deposit at a new account, and one row the report asks about. */
export function mailedReport(): WorkbookRows {
  const read = readPortfolioWorkbook([
    { name: 'Transactions', grid: workbookGrid([['2026-03-03', { broker: 'IBKR', account: 'U0000008', sourceFile: 'flex.xml', type: 'DEPOSIT', currency: 'EUR', netCash: 250 }]]) },
  ])
  if (read.kind !== 'read') throw new Error('The mailed report was refused.')
  const asked: AskedRow = { key: 'asked-1', section: 'Trades', shown: [['Symbol', 'XYZ']], dates: {}, why: { kind: 'no-kind' } }
  return { ...read, report: { asked: [asked], beforeStart: 0 } }
}

/** The prices file with a profile vendor's refusal for the share, so its page asks again. */
const PRICES_FILE: PricesFile = {
  ...emptyPricesFile(),
  facts: { ...NO_FETCHED_FACTS, profiles: { 'finnhub:SHARE': profileFact('2026-10-29', { failed: 'not-on-free-key' }) }, types: { 'twelvedata:SHARE': { asked: '2026-10-29', type: 'Common Stock' } } },
}

/** The record each operation's example names, by the name it gives it. */
export const EXAMPLE_RECORDS: Readonly<Record<string, string>> = {
  account: ONE.id,
  'account-other': TWO.id,
  'account-empty': EMPTY.id,
  instrument: SHARE.id,
  'instrument-fund': FUND.id,
  'instrument-spun': SPUN.id,
  'instrument-unheld': UNHELD.id,
  trade: FUND_BUY.id,
  income: DIVIDEND.id,
  'cash-movement': DEPOSIT.id,
  exchange: EXCHANGE.id,
  transfer: TRANSFER.id,
  split: SPLIT.id,
  'spin-off': SPIN_OFF.id,
  price: PRICE.id,
}

export const DESK = { ONE, TWO, EMPTY, SHARE, FUND, SPUN, UNHELD, SHARE_BUY, FUND_BUY, DIVIDEND }

const SET_UP: readonly TransactionRecord[] = [
  { kind: 'cash-movement', record: DEPOSIT },
  { kind: 'trade', record: SHARE_BUY },
  { kind: 'trade', record: FUND_BUY },
  { kind: 'income', record: DIVIDEND },
  { kind: 'exchange', record: EXCHANGE },
  { kind: 'transfer', record: TRANSFER },
  { kind: 'split', record: SPLIT },
  { kind: 'spin-off', record: SPIN_OFF },
  { kind: 'price', record: PRICE },
]

/** What the prices cards asked of the page's prices update. */
export interface PricesRuns {
  readonly asked: string[]
  /** What each run answers. */
  answer: PricesFetchRun
}

/** An Investments file where every operation's example has what it needs, with the chat's refs, the cards it was shown, the fetches Accept started, the prices runs, and the history answer and request counts of this device. */
export interface InvestmentsDesk {
  readonly store: WorkbookStore<InvestmentsBooks>
  readonly reads: ChatReads
  readonly cards: CheckedProposal[]
  readonly fetches: { count: number }
  readonly runs: PricesRuns
  /** This device's answer, and the id of the file on screen it belongs to. */
  readonly history: { complete: boolean; file: string | null }
  /** This browser's requests to each price vendor today, Twelve Data's at 7. */
  readonly requests: Map<string, number>
  /** The files attached to the chat: a1 a workbook, a2 closes of the share and a3 a Flex report of a day in October. */
  readonly attachments: ChatAttachment[]
  ref(kind: string, id: string): string
  propose(steps: readonly { readonly op: string; readonly input: unknown; readonly as?: string }[]): ReturnType<typeof proposeChanges>
  accept(at?: number): ReturnType<ReturnType<typeof investmentsAcceptance>['accept']>
}

export async function investmentsDesk(used: Set<string>, rates: RateBook | null = null): Promise<InvestmentsDesk> {
  const { store } = await browserHarness(used, emptyInvestmentsDocument('2026-10-30T09:00:00.000Z'), INVESTMENTS)
  await store.write('Set up', (unit) => {
    ;[ONE, TWO, EMPTY].forEach((added) => unit.of(INVESTMENT_ACCOUNT_WRITES).add(added))
    ;[SHARE, FUND, SPUN, UNHELD].forEach((added) => unit.of(INSTRUMENT_WRITES).add(added))
    SET_UP.forEach((record) => writeTransaction(unit, null, record))
    replaceRows(
      unit,
      TARGET_WRITES,
      [],
      [
        { slice: { mix: 'class', group: 'stocks' }, percent: decimal('70') },
        { slice: { mix: 'class', group: 'cash' }, percent: decimal('30') },
      ],
    )
    unit.of(MAIL_READER_WRITES).add(READER)
  })
  const typed = store as unknown as WorkbookStore<InvestmentsBooks>
  const fetches = { count: 0 }
  const runs: PricesRuns = { asked: [], answer: { kind: 'written', file: PRICES_FILE } }
  const history = { complete: false, file: 'investments-file' as string | null }
  const requests = new Map([['twelvedata', 7]])
  const run = (asked: string) => {
    runs.asked.push(asked)
    return Promise.resolve(runs.answer)
  }
  const ports: InvestmentsPorts = {
    rates: () => rates,
    fetchAddedPrices: () => (fetches.count += 1),
    pricesFile: () => PRICES_FILE,
    prices: {
      fetchNow: () => run('now'),
      askFactsAgain: (instrument) => run(`facts of ${instrument}`),
    },
    mailReport: () => mailedReport(),
    history: { file: () => history.file, given: () => history.complete, give: () => (history.complete = true), takeBack: () => (history.complete = false) },
    requestCounts: { today: (vendorId) => requests.get(vendorId) ?? 0, set: (vendorId, count) => requests.set(vendorId, count) },
  }
  const attachments: ChatAttachment[] = []
  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: () => true }
  const cards: CheckedProposal[] = []
  const proposers = new Map([['investments', investmentsProposer(typed, ports, FILE_OPEN)]])
  return {
    store: typed,
    reads,
    cards,
    fetches,
    runs,
    history,
    requests,
    attachments,
    ref: (kind, id) => reads.refs.recordRef({ app: 'investments', kind, id }),
    propose: (steps) =>
      proposeChanges(
        { app: 'investments', title: 'A title', steps: steps.map((step) => ({ op: step.op, input: JSON.stringify(step.input), as: step.as ?? null })), next: false },
        proposers,
        reads,
        attachments,
        (_app, card) => cards.push(card),
      ),
    accept: (at = cards.length - 1) => investmentsAcceptance(typed, ports, FILE_OPEN).accept(cards[at]!),
  }
}
