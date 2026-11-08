import { investmentsAcceptance, investmentsProposer } from '../../src/apps/investments/assistant/operations/investmentsOperations'
import type { InvestmentsPorts } from '../../src/apps/investments/assistant/operations/investmentsOperations'
import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../../src/apps/investments/holdings/application/holdingWrites'
import { writeTransaction } from '../../src/apps/investments/transactions/application/transactionWrites'
import type { TransactionRecord } from '../../src/apps/investments/transactions/domain/listedTransactions'
import type { HandPrice } from '../../src/apps/investments/workbook/domain/handPrice'
import type { InvestmentsBooks } from '../../src/apps/investments/workbook/domain/investmentsBooks'
import { PRICE_RECORDS } from '../../src/apps/investments/workbook/domain/investmentKinds'
import { emptyInvestmentsDocument } from '../../src/apps/investments/workbook/infrastructure/investmentsDocument'
import type { ChatReads } from '../../src/shared/ai/application/chatReads'
import { proposeChanges } from '../../src/shared/ai/application/chatProposals'
import { chatRefs } from '../../src/shared/ai/domain/chatRefs'
import type { CheckedProposal } from '../../src/shared/app/assistantOperations'
import { EURO } from '../../src/shared/money/currencyCode'
import type { RateBook } from '../../src/shared/money/rateBook'
import { newPseudonyms } from '../../src/shared/privacy/domain/pseudonyms'
import type { WorkbookStore } from '../../src/shared/storage/application/createWorkbookStore'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'
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

/** An Investments file where every operation's example has what it needs, with the chat's refs, the cards it was shown and the fetches Accept started. */
export interface InvestmentsDesk {
  readonly store: WorkbookStore<InvestmentsBooks>
  readonly reads: ChatReads
  readonly cards: CheckedProposal[]
  readonly fetches: { count: number }
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
  })
  const typed = store as unknown as WorkbookStore<InvestmentsBooks>
  const fetches = { count: 0 }
  const ports: InvestmentsPorts = { rates: () => rates, fetchAddedPrices: () => (fetches.count += 1) }
  const reads: ChatReads = { readers: new Map(), pseudonyms: newPseudonyms(), refs: chatRefs(), anonymising: () => true, persons: () => [], mayRead: async () => true }
  const cards: CheckedProposal[] = []
  const proposers = new Map([['investments', investmentsProposer(typed, ports)]])
  return {
    store: typed,
    reads,
    cards,
    fetches,
    ref: (kind, id) => reads.refs.recordRef({ app: 'investments', kind, id }),
    propose: (steps) =>
      proposeChanges(
        { app: 'investments', title: 'A title', steps: steps.map((step) => ({ op: step.op, input: JSON.stringify(step.input), as: step.as ?? null })) },
        proposers,
        reads,
        [],
        (_app, card) => cards.push(card),
      ),
    accept: (at = cards.length - 1) => investmentsAcceptance(typed, ports).accept(cards[at]!),
  }
}
