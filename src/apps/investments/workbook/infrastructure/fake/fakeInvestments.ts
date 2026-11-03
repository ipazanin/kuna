import { codecOfInvestmentsKind } from '../../application/investmentsCodecs'
import type { CashMovement } from '../../domain/cashMovement'
import type { CheckSetting } from '../../domain/checkSetting'
import type { Exchange } from '../../domain/exchange'
import type { FundMixLine } from '../../domain/fundMix'
import type { HandPrice } from '../../domain/handPrice'
import type { Income } from '../../domain/income'
import type { Instrument } from '../../domain/instrument'
import type { InvestmentAccount } from '../../domain/investmentAccount'
import {
  CASH_MOVEMENT_RECORDS,
  CHECK_RECORDS,
  EXCHANGE_RECORDS,
  FUND_MIX_RECORDS,
  INCOME_RECORDS,
  INSTRUMENT_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  PRICE_RECORDS,
  SPIN_OFF_RECORDS,
  SPLIT_RECORDS,
  TARGET_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from '../../domain/investmentKinds'
import { countryOf } from '../../domain/mixGroup'
import type { ClassGroup, FundMixGroup } from '../../domain/mixGroup'
import type { SpinOff } from '../../domain/spinOff'
import type { Split } from '../../domain/split'
import type { Target } from '../../domain/target'
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
  type: 'share',
  class: 'stocks',
  isin: 'XX000000ABC1',
  symbol: 'ABC',
  exchange: 'XNAS',
  currency: USD,
  quoted: { kind: 'unit' },
  prices: 'twelvedata',
  sourceSymbol: 'ABC',
  benchmark: false,
  sector: 'information-technology',
  country: countryOf('US'),
  ter: null,
  distribution: null,
  note: '',
}
/** Its country comes from its ISIN. */
const SHARE_B: Instrument = {
  ...SHARE_A,
  id: fixedId(INSTRUMENT_RECORDS, 11),
  name: 'Example Dividend Co',
  isin: 'US000000DEF2',
  symbol: 'DEF',
  exchange: 'XNYS',
  sourceSymbol: 'DEF',
  sector: 'consumer-staples',
  country: null,
}
const WORLD_ETF: Instrument = {
  ...SHARE_A,
  id: fixedId(INSTRUMENT_RECORDS, 12),
  name: 'Example World ETF',
  type: 'fund',
  isin: 'IE000000XYZ5',
  symbol: 'XYZ',
  exchange: 'XETR',
  currency: EURO,
  prices: 'alphavantage',
  sourceSymbol: 'XYZ.DEX',
  sector: null,
  country: null,
  ter: decimal('0.2'),
  distribution: 'accumulating',
}
const MONEY_FUND: Instrument = {
  ...SHARE_A,
  id: fixedId(INSTRUMENT_RECORDS, 13),
  name: 'Example Money Fund',
  type: 'fund',
  class: 'money-market',
  isin: null,
  symbol: 'EMF',
  exchange: null,
  currency: EURO,
  prices: 'manual',
  sourceSymbol: '',
  sector: null,
  country: countryOf('europe'),
  ter: null,
  distribution: 'distributing',
  note: 'Priced from its monthly statement',
}
/** Nothing typed of its sector or country. */
const SPIN_CO: Instrument = {
  ...MONEY_FUND,
  id: fixedId(INSTRUMENT_RECORDS, 14),
  name: 'Example Spinco',
  type: 'share',
  class: 'stocks',
  symbol: 'GHI',
  currency: USD,
  country: null,
  distribution: null,
  note: 'Spun off from Example Dividend Co',
}
/** Never bought, only compared with on Performance. */
const INDEX_FUND: Instrument = {
  ...SHARE_A,
  id: fixedId(INSTRUMENT_RECORDS, 15),
  name: 'Example Index Fund',
  type: 'fund',
  isin: null,
  symbol: 'IDX',
  exchange: 'ARCX',
  sourceSymbol: 'IDX',
  benchmark: true,
  sector: null,
  country: null,
}
/** Bought twice, paid a dividend and sold in full, priced by hand. */
const RETIRED_CO: Instrument = {
  ...MONEY_FUND,
  id: fixedId(INSTRUMENT_RECORDS, 16),
  name: 'Example Retired Co',
  type: 'share',
  class: 'stocks',
  isin: 'US000000JKL4',
  symbol: 'JKL',
  exchange: 'XNYS',
  currency: USD,
  sector: 'industrials',
  country: null,
  distribution: null,
  note: '',
}

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

function dividend(date: string, gross: string, withheld: string, rate: string, payer: Instrument = SHARE_B): Income {
  return {
    id: nextId(INCOME_RECORDS),
    account: BROKER_ONE.id,
    kind: 'dividend',
    instrument: payer.id,
    date: day(date),
    currency: USD,
    gross: decimal(gross),
    withheld: decimal(withheld),
    rate: decimal(rate),
    importKey: null,
    note: '',
  }
}

function interest(held: InvestmentAccount, date: string, gross: string): Income {
  return {
    id: nextId(INCOME_RECORDS),
    account: held.id,
    kind: 'interest',
    instrument: null,
    date: day(date),
    currency: EURO,
    gross: decimal(gross),
    withheld: DECIMAL_ZERO,
    rate: null,
    importKey: null,
    note: 'Interest on cash',
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
  interest(BROKER_ONE, '2025-03-03', '3.15'),
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

function handPrice(what: Instrument, date: string, price: string, note = ''): HandPrice {
  return { id: nextId(PRICE_RECORDS), instrument: what.id, date: day(date), price: decimal(price), note }
}

const HAND_PRICES: readonly HandPrice[] = [
  handPrice(MONEY_FUND, '2026-06-30', '10.42', 'Statement of 30 Jun'),
  handPrice(MONEY_FUND, '2026-09-30', '10.51', 'Statement of 30 Sep'),
  handPrice(SPIN_CO, '2024-12-31', '21.40'),
  handPrice(SPIN_CO, '2026-09-30', '11.20'),
  handPrice(MONEY_FUND, '2023-03-31', '10.02', 'Statement of 31 Mar 2023'),
  handPrice(MONEY_FUND, '2024-12-31', '10.24', 'Statement of 31 Dec 2024'),
  handPrice(SPIN_CO, '2024-09-30', '23.10'),
  handPrice(MONEY_FUND, '2023-03-01', '10.00', 'Bought at 10.00'),
]

// The records below are made after every record above, so the ids above stay as they were.

/** Example Retired Co's whole life, two more buys of Example Tech beside its September buy, and €200 a month into the second account. */
const LATER_TRADES: readonly Trade[] = [
  trade('buy', BROKER_ONE, RETIRED_CO, '2023-04-03', '10', '30.00', '1.00', '1.0889'),
  trade('buy', BROKER_ONE, RETIRED_CO, '2023-10-02', '5', '32.00', '1.00', '1.0563'),
  trade('sell', BROKER_ONE, RETIRED_CO, '2025-08-01', '15', '38.00', '1.00', '1.1412'),
  trade('buy', BROKER_ONE, SHARE_A, '2026-09-08', '3', '155.40', '1.00', '1.0839'),
  trade('buy', BROKER_ONE, SHARE_A, '2026-09-22', '2', '160.10', '1.00', '1.0871'),
]

/** A dividend of the retired share, a half-yearly dividend in July, interest in two more months and a dividend of the Irish fund with nothing withheld. */
const LATER_INCOME: readonly Income[] = [
  dividend('2024-06-14', '4.50', '0.68', '1.0721', RETIRED_CO),
  interest(BROKER_ONE, '2026-04-01', '2.40'),
  dividend('2026-07-15', '13.30', '2.00', '1.0862'),
  interest(BROKER_ONE, '2026-07-01', '2.60'),
  {
    id: nextId(INCOME_RECORDS),
    account: BROKER_TWO.id,
    kind: 'dividend',
    instrument: WORLD_ETF.id,
    date: day('2025-12-10'),
    currency: EURO,
    gross: decimal('21.00'),
    withheld: DECIMAL_ZERO,
    rate: null,
    importKey: null,
    note: '',
  },
]

const LATER_CASH_MOVEMENTS: readonly CashMovement[] = ['2026-06-01', '2026-07-01', '2026-08-03', '2026-09-01'].map((date) => cash('deposit', BROKER_TWO, date, '200.00'))

/** The retired share at each buy, a year end and its sale, and the spin-off's latest price, below what its units cost. */
const LATER_HAND_PRICES: readonly HandPrice[] = [
  handPrice(RETIRED_CO, '2023-04-03', '30.00'),
  handPrice(RETIRED_CO, '2023-10-02', '32.00'),
  handPrice(RETIRED_CO, '2024-12-31', '35.20'),
  handPrice(RETIRED_CO, '2025-08-01', '38.00'),
  handPrice(SPIN_CO, '2026-10-15', '8.95'),
]

function fundMix(what: Instrument, mix: FundMixGroup['mix'], percents: readonly (readonly [string, string])[]): FundMixLine[] {
  return percents.map(([group, percent]) => ({ id: nextId(FUND_MIX_RECORDS), instrument: what.id, slice: { mix, group } as FundMixGroup, percent: decimal(percent) }))
}

/** The World ETF's own mix by sector and by country, as its factsheet might give it. */
const FUND_MIXES: readonly FundMixLine[] = [
  ...fundMix(WORLD_ETF, 'sector', [
    ['information-technology', '25'],
    ['financials', '16'],
    ['health-care', '11'],
    ['industrials', '11'],
    ['consumer-discretionary', '10'],
    ['communication-services', '8'],
    ['consumer-staples', '6'],
    ['energy', '4'],
    ['materials', '4'],
    ['utilities', '3'],
    ['real-estate', '2'],
  ]),
  ...fundMix(WORLD_ETF, 'country', [
    ['US', '70'],
    ['JP', '6'],
    ['GB', '4'],
    ['CA', '3'],
    ['FR', '3'],
    ['CH', '3'],
    ['DE', '3'],
    ['europe', '8'],
  ]),
]

/** Class targets of 70% stocks, 20% money market and 10% cash. */
const TARGETS: readonly Target[] = [
  ['stocks', '70'],
  ['money-market', '20'],
  ['cash', '10'],
].map(([group, percent]) => ({ id: nextId(TARGET_RECORDS), slice: { mix: 'class', group: group as ClassGroup }, percent: decimal(percent!) }))

/** The cash check raised from 10% to 15%. */
const CHECKS: readonly CheckSetting[] = [{ id: nextId(CHECK_RECORDS), check: 'cash', threshold: decimal('15'), off: false }]

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
 * The fake build's made-up Investments file: two accounts at made-up brokers, euros changed into dollars, buys and
 * sales of US shares, one of them sold in full, a Xetra ETF with its own mix and a money market fund priced by hand,
 * dividends with tax withheld, interest, an account fee and its refund, a transfer of units and one of cash, a
 * spin-off and a split of what it gave, a US index fund it compares with, class targets and one changed check. Every
 * figure in it is made up.
 */
export function fakeInvestmentsDocument(savedAt: string, variant: FakeInvestmentsVariant = 'sample'): WorkbookDocument {
  if (variant === 'young') {
    return { ...emptyInvestmentsDocument(savedAt), records: youngRecords(pricesDay(savedAt)) }
  }
  const allMovements = [...CASH_MOVEMENTS, ...LATER_CASH_MOVEMENTS]
  const movements = variant === 'sample' ? allMovements : allMovements.filter((movement) => !(movement.account === BROKER_TWO.id && movement.kind === 'deposit'))
  return {
    ...emptyInvestmentsDocument(savedAt),
    records: {
      ...stored(INVESTMENT_ACCOUNT_RECORDS, [BROKER_ONE, BROKER_TWO]),
      ...stored(INSTRUMENT_RECORDS, [SHARE_A, SHARE_B, WORLD_ETF, MONEY_FUND, SPIN_CO, INDEX_FUND, RETIRED_CO]),
      ...stored(TRADE_RECORDS, [...TRADES, ...LATER_TRADES]),
      ...stored(INCOME_RECORDS, [...INCOME, ...LATER_INCOME]),
      ...stored(CASH_MOVEMENT_RECORDS, movements),
      ...stored(EXCHANGE_RECORDS, EXCHANGES),
      ...stored(TRANSFER_RECORDS, TRANSFERS),
      ...stored(SPLIT_RECORDS, SPLITS),
      ...stored(SPIN_OFF_RECORDS, SPIN_OFFS),
      ...stored(PRICE_RECORDS, [...HAND_PRICES, ...LATER_HAND_PRICES]),
      ...stored(FUND_MIX_RECORDS, FUND_MIXES),
      ...stored(TARGET_RECORDS, TARGETS),
      ...stored(CHECK_RECORDS, CHECKS),
    },
  }
}
