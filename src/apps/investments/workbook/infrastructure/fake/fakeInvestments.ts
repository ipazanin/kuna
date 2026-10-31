import { codecOfInvestmentsKind } from '../../application/investmentsCodecs'
import type { CashMovement } from '../../domain/cashMovement'
import type { Exchange } from '../../domain/exchange'
import type { HandPrice } from '../../domain/handPrice'
import type { Income } from '../../domain/income'
import type { Instrument } from '../../domain/instrument'
import type { InvestmentAccount } from '../../domain/investmentAccount'
import {
  CASH_MOVEMENT_RECORDS,
  EXCHANGE_RECORDS,
  INCOME_RECORDS,
  INSTRUMENT_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  PRICE_RECORDS,
  SPIN_OFF_RECORDS,
  SPLIT_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from '../../domain/investmentKinds'
import type { SpinOff } from '../../domain/spinOff'
import type { Split } from '../../domain/split'
import type { Trade, TradeSide } from '../../domain/trade'
import type { Transfer } from '../../domain/transfer'
import { emptyInvestmentsDocument } from '../investmentsDocument'
import { pricesDay } from '../../../prices/application/pricesUpdate'
import { FAKE_SERIES, fakeClose, isWeekday } from '../../../prices/infrastructure/fake/fakePrices'
import { addDays, parseCivilDate } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../../shared/calendar/monthKey'
import { EURO, currencyCodeOf } from '../../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalOfText } from '../../../../../shared/money/decimal'
import type { Decimal } from '../../../../../shared/money/decimal'
import { recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../../shared/storage/domain/recordKind'
import type { WorkbookDocument } from '../../../../../shared/storage/infrastructure/documentFormat'

function day(text: string): CivilDate {
  const parsed = parseCivilDate(text)
  if (parsed === null) throw new Error(`${text} is not a day.`)
  return parsed
}

function decimal(text: string): Decimal {
  const parsed = decimalOfText(text)
  if (parsed === null) throw new Error(`${text} is not decimal text.`)
  return parsed
}

const USD = currencyCodeOf('USD') as CurrencyCode

/** A fixed id per record, so every load of the sample holds the same records. */
function fixedId(kind: RecordKind, place: number): RecordId {
  return recordIdOf(kind, `fa4e1000-0000-4000-8000-${String(place).padStart(12, '0')}`)
}

/** Carries the marker the production build looks for, so the made-up portfolio cannot ship unseen. */
const FAKE_INVESTMENTS_NOTE = 'Made up for the fake build. FAKE-WORKBOOK-ONLY-DO-NOT-SHIP-INVESTMENTS'

const BROKER_ONE: InvestmentAccount = { id: fixedId(INVESTMENT_ACCOUNT_RECORDS, 1), name: 'Broker One', note: FAKE_INVESTMENTS_NOTE }
const BROKER_TWO: InvestmentAccount = { id: fixedId(INVESTMENT_ACCOUNT_RECORDS, 2), name: 'Broker Two', note: '' }

/** Made-up instruments, the three priced ones on the made-up series of the fake prices file. */
const SHARE_A: Instrument = {
  id: fixedId(INSTRUMENT_RECORDS, 10),
  name: 'Example Tech',
  class: 'stocks',
  isin: 'XX000000ABC1',
  symbol: 'ABC',
  exchange: 'XNAS',
  currency: USD,
  quoted: { kind: 'unit' },
  prices: 'twelvedata',
  sourceSymbol: 'ABC',
  benchmark: false,
  note: '',
}
const SHARE_B: Instrument = { ...SHARE_A, id: fixedId(INSTRUMENT_RECORDS, 11), name: 'Example Dividend Co', isin: null, symbol: 'DEF', exchange: 'XNYS', sourceSymbol: 'DEF' }
const WORLD_ETF: Instrument = {
  ...SHARE_A,
  id: fixedId(INSTRUMENT_RECORDS, 12),
  name: 'Example World ETF',
  isin: 'XX000000XYZ5',
  symbol: 'XYZ',
  exchange: 'XETR',
  currency: EURO,
  prices: 'alphavantage',
  sourceSymbol: 'XYZ.DEX',
}
const MONEY_FUND: Instrument = {
  ...SHARE_A,
  id: fixedId(INSTRUMENT_RECORDS, 13),
  name: 'Example Money Fund',
  class: 'money-market',
  isin: null,
  symbol: 'EMF',
  exchange: null,
  currency: EURO,
  prices: 'manual',
  sourceSymbol: '',
  note: 'Priced from its monthly statement',
}
const SPIN_CO: Instrument = { ...MONEY_FUND, id: fixedId(INSTRUMENT_RECORDS, 14), name: 'Example Spinco', class: 'stocks', symbol: 'GHI', currency: USD, note: 'Spun off from Example Dividend Co' }
/** Never bought, only compared with on Performance. */
const INDEX_FUND: Instrument = { ...SHARE_A, id: fixedId(INSTRUMENT_RECORDS, 15), name: 'Example Index Fund', isin: null, symbol: 'IDX', exchange: 'ARCX', sourceSymbol: 'IDX', benchmark: true }

let place = 100
function nextId(kind: RecordKind): RecordId {
  place += 1
  return fixedId(kind, place)
}

function trade(side: TradeSide, held: InvestmentAccount, what: Instrument, date: string, quantity: string, price: string, fees: string, rate: string | null): Trade {
  return {
    id: nextId(TRADE_RECORDS),
    account: held.id,
    instrument: what.id,
    side,
    date: day(date),
    quantity: decimal(quantity),
    price: decimal(price),
    fees: decimal(fees),
    rate: rate === null ? null : decimal(rate),
    accrued: null,
    importKey: null,
    note: '',
  }
}

function cash(kind: CashMovement['kind'], held: InvestmentAccount, date: string, amount: string, note = ''): CashMovement {
  return { id: nextId(CASH_MOVEMENT_RECORDS), account: held.id, kind, date: day(date), currency: EURO, amount: decimal(amount), rate: null, importKey: null, note }
}

function dividend(date: string, gross: string, withheld: string, rate: string): Income {
  return {
    id: nextId(INCOME_RECORDS),
    account: BROKER_ONE.id,
    kind: 'dividend',
    instrument: SHARE_B.id,
    date: day(date),
    currency: USD,
    gross: decimal(gross),
    withheld: decimal(withheld),
    rate: decimal(rate),
    importKey: null,
    note: '',
  }
}

const TRADES: readonly Trade[] = [
  trade('buy', BROKER_ONE, SHARE_A, '2023-01-09', '20', '142.80', '1.00', '1.0861'),
  trade('buy', BROKER_ONE, SHARE_B, '2023-02-01', '40', '48.20', '1.00', '1.0851'),
  trade('buy', BROKER_ONE, WORLD_ETF, '2023-02-02', '30', '98.90', '2.00', null),
  trade('buy', BROKER_ONE, MONEY_FUND, '2023-03-01', '150.5', '10.00', '0', null),
  trade('buy', BROKER_TWO, WORLD_ETF, '2024-05-03', '25', '101.40', '2.00', null),
  trade('sell', BROKER_ONE, SHARE_A, '2025-02-14', '10', '151.20', '1.00', '1.0846'),
  trade('buy', BROKER_ONE, SHARE_A, '2026-09-15', '5', '158.00', '1.00', '1.0853'),
]

const INCOME: readonly Income[] = [
  dividend('2023-06-15', '12.00', '1.80', '1.0842'),
  dividend('2023-12-15', '12.40', '1.86', '1.0857'),
  {
    id: nextId(INCOME_RECORDS),
    account: BROKER_ONE.id,
    kind: 'interest',
    instrument: null,
    date: day('2025-03-03'),
    currency: EURO,
    gross: decimal('3.15'),
    withheld: DECIMAL_ZERO,
    rate: null,
    importKey: null,
    note: 'Interest on cash',
  },
  dividend('2026-01-15', '13.10', '1.97', '1.0849'),
]

const CASH_MOVEMENTS: readonly CashMovement[] = [
  cash('deposit', BROKER_ONE, '2023-01-05', '12000.00'),
  cash('fee', BROKER_ONE, '2024-03-01', '5.00', 'Yearly custody fee'),
  cash('deposit', BROKER_TWO, '2024-05-02', '3000.00'),
  cash('withdrawal', BROKER_ONE, '2025-11-20', '500.00'),
  cash('fee-refund', BROKER_ONE, '2026-10-01', '5.00'),
]

const EXCHANGES: readonly Exchange[] = [
  {
    id: nextId(EXCHANGE_RECORDS),
    account: BROKER_ONE.id,
    date: day('2023-01-06'),
    sold: decimal('5000.00'),
    soldCurrency: EURO,
    bought: decimal('5410.00'),
    boughtCurrency: USD,
    fees: { amount: decimal('4.00'), currency: EURO },
    importKey: null,
    note: '',
  },
]

const TRANSFERS: readonly Transfer[] = [
  {
    id: nextId(TRANSFER_RECORDS),
    from: BROKER_ONE.id,
    to: BROKER_TWO.id,
    date: day('2024-06-03'),
    moved: { kind: 'units', instrument: WORLD_ETF.id, quantity: decimal('10') },
    importKey: null,
    note: '',
  },
  { id: nextId(TRANSFER_RECORDS), from: BROKER_ONE.id, to: BROKER_TWO.id, date: day('2026-03-02'), moved: { kind: 'cash', currency: EURO, amount: decimal('200.00') }, importKey: null, note: '' },
]

const SPIN_OFFS: readonly SpinOff[] = [
  { id: nextId(SPIN_OFF_RECORDS), instrument: SHARE_B.id, received: SPIN_CO.id, date: day('2024-09-20'), quantity: decimal('8'), costShare: decimal('0.08'), importKey: null, note: '' },
]

const SPLITS: readonly Split[] = [{ id: nextId(SPLIT_RECORDS), instrument: SPIN_CO.id, date: day('2025-06-02'), newUnits: 2, oldUnits: 1, importKey: null, note: '' }]

const HAND_PRICES: readonly HandPrice[] = [
  { id: nextId(PRICE_RECORDS), instrument: MONEY_FUND.id, date: day('2026-06-30'), price: decimal('10.42'), note: 'Statement of 30 Jun' },
  { id: nextId(PRICE_RECORDS), instrument: MONEY_FUND.id, date: day('2026-09-30'), price: decimal('10.51'), note: 'Statement of 30 Sep' },
  { id: nextId(PRICE_RECORDS), instrument: SPIN_CO.id, date: day('2024-12-31'), price: decimal('21.40'), note: '' },
  { id: nextId(PRICE_RECORDS), instrument: SPIN_CO.id, date: day('2026-09-30'), price: decimal('11.20'), note: '' },
  { id: nextId(PRICE_RECORDS), instrument: MONEY_FUND.id, date: day('2023-03-31'), price: decimal('10.02'), note: 'Statement of 31 Mar 2023' },
  { id: nextId(PRICE_RECORDS), instrument: MONEY_FUND.id, date: day('2024-12-31'), price: decimal('10.24'), note: 'Statement of 31 Dec 2024' },
  { id: nextId(PRICE_RECORDS), instrument: SPIN_CO.id, date: day('2024-09-30'), price: decimal('23.10'), note: '' },
  { id: nextId(PRICE_RECORDS), instrument: MONEY_FUND.id, date: day('2023-03-01'), price: decimal('10.00'), note: 'Bought at 10.00' },
]

function stored<R>(kind: RecordKind<R>, records: readonly R[]): WorkbookDocument['records'] {
  const codec = codecOfInvestmentsKind(kind)
  return { [kind.name]: records.map((record) => codec.fieldsOf(record)) }
}

/**
 * `sample` is the whole made-up file, `cash-below-zero` leaves out the second account's deposit, so its euros fall below
 * zero, and `young` is a file whose first deposit is seven months old, with no benchmark chosen.
 */
export type FakeInvestmentsVariant = 'sample' | 'cash-below-zero' | 'young'

/** The weekday on or before the day. */
function weekdayBefore(date: CivilDate): CivilDate {
  let found = date
  while (!isWeekday(found)) {
    found = addDays(found, -1)
  }
  return found
}

/** Two deposits into the World ETF, seven and three months before the fake build's day, each spent at that day's close, with ids of their own so every load holds the same records. */
function youngRecords(today: CivilDate): WorkbookDocument['records'] {
  const first = weekdayBefore(dayMonthsLater(today, -7))
  const second = weekdayBefore(dayMonthsLater(today, -3))
  return {
    ...stored(INVESTMENT_ACCOUNT_RECORDS, [BROKER_ONE]),
    ...stored(INSTRUMENT_RECORDS, [WORLD_ETF]),
    ...stored(TRADE_RECORDS, [
      { ...trade('buy', BROKER_ONE, WORLD_ETF, first, '40', fakeClose(FAKE_SERIES.worldEtf, first), '2.00', null), id: fixedId(TRADE_RECORDS, 901) },
      { ...trade('buy', BROKER_ONE, WORLD_ETF, second, '12', fakeClose(FAKE_SERIES.worldEtf, second), '2.00', null), id: fixedId(TRADE_RECORDS, 902) },
    ]),
    ...stored(CASH_MOVEMENT_RECORDS, [
      { ...cash('deposit', BROKER_ONE, first, '5000.00'), id: fixedId(CASH_MOVEMENT_RECORDS, 903) },
      { ...cash('deposit', BROKER_ONE, second, '1500.00'), id: fixedId(CASH_MOVEMENT_RECORDS, 904) },
    ]),
  }
}

/**
 * The fake build's made-up Investments file: two accounts at made-up brokers, euros changed into dollars, buys and a
 * sale of US shares, a Xetra ETF and a money market fund priced by hand, dividends with tax withheld, interest, an
 * account fee and its refund, a transfer of units and one of cash, a spin-off and a split of what it gave, and a US
 * index fund it compares with. Every figure in it is made up.
 */
export function fakeInvestmentsDocument(savedAt: string, variant: FakeInvestmentsVariant = 'sample'): WorkbookDocument {
  if (variant === 'young') {
    return { ...emptyInvestmentsDocument(savedAt), records: youngRecords(pricesDay(savedAt)) }
  }
  const movements = variant === 'sample' ? CASH_MOVEMENTS : CASH_MOVEMENTS.filter((movement) => !(movement.account === BROKER_TWO.id && movement.kind === 'deposit'))
  return {
    ...emptyInvestmentsDocument(savedAt),
    records: {
      ...stored(INVESTMENT_ACCOUNT_RECORDS, [BROKER_ONE, BROKER_TWO]),
      ...stored(INSTRUMENT_RECORDS, [SHARE_A, SHARE_B, WORLD_ETF, MONEY_FUND, SPIN_CO, INDEX_FUND]),
      ...stored(TRADE_RECORDS, TRADES),
      ...stored(INCOME_RECORDS, INCOME),
      ...stored(CASH_MOVEMENT_RECORDS, movements),
      ...stored(EXCHANGE_RECORDS, EXCHANGES),
      ...stored(TRANSFER_RECORDS, TRANSFERS),
      ...stored(SPLIT_RECORDS, SPLITS),
      ...stored(SPIN_OFF_RECORDS, SPIN_OFFS),
      ...stored(PRICE_RECORDS, HAND_PRICES),
    },
  }
}
