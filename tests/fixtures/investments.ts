import type { CashMovement, CashMovementKind } from '../../src/apps/investments/workbook/domain/cashMovement'
import type { Exchange } from '../../src/apps/investments/workbook/domain/exchange'
import type { Income } from '../../src/apps/investments/workbook/domain/income'
import type { Instrument } from '../../src/apps/investments/workbook/domain/instrument'
import type { InvestmentAccount } from '../../src/apps/investments/workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../src/apps/investments/workbook/domain/investmentBook'
import {
  CASH_MOVEMENT_RECORDS,
  EXCHANGE_RECORDS,
  INCOME_RECORDS,
  INSTRUMENT_RECORDS,
  INVESTMENT_ACCOUNT_RECORDS,
  SPIN_OFF_RECORDS,
  SPLIT_RECORDS,
  TRADE_RECORDS,
  TRANSFER_RECORDS,
} from '../../src/apps/investments/workbook/domain/investmentKinds'
import type { SpinOff } from '../../src/apps/investments/workbook/domain/spinOff'
import type { Split } from '../../src/apps/investments/workbook/domain/split'
import type { Trade, TradeSide } from '../../src/apps/investments/workbook/domain/trade'
import type { Transfer } from '../../src/apps/investments/workbook/domain/transfer'
import type { Close, PriceBook } from '../../src/apps/investments/prices/domain/priceBook'
import type { RateBook } from '../../src/apps/investments/prices/domain/rateBook'
import type { CivilDate } from '../../src/shared/calendar/civilDate'
import { EURO, currencyCodeOf } from '../../src/shared/money/currencyCode'
import type { CurrencyCode } from '../../src/shared/money/currencyCode'
import { decimalOfText } from '../../src/shared/money/decimal'
import type { Decimal } from '../../src/shared/money/decimal'
import { recordIdOf } from '../../src/shared/storage/domain/recordId'
import { civil } from './ledger'

export const USD = currencyCodeOf('USD')!
export const GBP = currencyCodeOf('GBP')!

export function decimal(text: string): Decimal {
  const read = decimalOfText(text)
  if (read === null) {
    throw new Error(`${text} is not decimal text.`)
  }
  return read
}

function rateOf(text: string | null): Decimal | null {
  return text === null ? null : decimal(text)
}

export function account(key: string, name = key): InvestmentAccount {
  return { id: recordIdOf(INVESTMENT_ACCOUNT_RECORDS, key), name, note: '' }
}

export function instrument(key: string, overrides: Partial<Instrument> = {}): Instrument {
  return {
    id: recordIdOf(INSTRUMENT_RECORDS, key),
    name: key,
    class: 'stocks',
    isin: null,
    symbol: key.toUpperCase(),
    exchange: null,
    currency: EURO,
    quoted: { kind: 'unit' },
    prices: 'twelvedata',
    sourceSymbol: key.toUpperCase(),
    note: '',
    ...overrides,
  }
}

/** A trade with its fees and rate as decimal text, a null fee for one not entered and a null rate for euros. */
export function trade(side: TradeSide, held: InvestmentAccount, what: Instrument, date: string, quantity: string, price: string, fees: string | null, rate: string | null = null): Trade {
  return {
    id: recordIdOf(TRADE_RECORDS, `${side}-${held.name}-${what.symbol}-${date}-${quantity}`),
    account: held.id,
    instrument: what.id,
    side,
    date: civil(date),
    quantity: decimal(quantity),
    price: decimal(price),
    fees: fees === null ? null : decimal(fees),
    rate: rateOf(rate),
    accrued: null,
    importKey: null,
    note: '',
  }
}

export function cashMovement(kind: CashMovementKind, held: InvestmentAccount, date: string, amount: string, currency: CurrencyCode = EURO, rate: string | null = null): CashMovement {
  return {
    id: recordIdOf(CASH_MOVEMENT_RECORDS, `${kind}-${date}-${amount}`),
    account: held.id,
    kind,
    date: civil(date),
    currency,
    amount: decimal(amount),
    rate: rateOf(rate),
    importKey: null,
    note: '',
  }
}

export function dividend(held: InvestmentAccount, what: Instrument, date: string, gross: string, withheld: string, rate: string | null = null): Income {
  return {
    id: recordIdOf(INCOME_RECORDS, `dividend-${what.symbol}-${date}`),
    account: held.id,
    kind: 'dividend',
    instrument: what.id,
    date: civil(date),
    currency: what.currency,
    gross: decimal(gross),
    withheld: decimal(withheld),
    rate: rateOf(rate),
    importKey: null,
    note: '',
  }
}

export function exchange(held: InvestmentAccount, date: string, sold: string, soldCurrency: CurrencyCode, bought: string, boughtCurrency: CurrencyCode, fees: Exchange['fees'] = null): Exchange {
  return {
    id: recordIdOf(EXCHANGE_RECORDS, `exchange-${date}-${sold}`),
    account: held.id,
    date: civil(date),
    sold: decimal(sold),
    soldCurrency,
    bought: decimal(bought),
    boughtCurrency,
    fees,
    importKey: null,
    note: '',
  }
}

export function unitTransfer(from: InvestmentAccount, to: InvestmentAccount, date: string, what: Instrument, quantity: string): Transfer {
  return {
    id: recordIdOf(TRANSFER_RECORDS, `units-${date}-${quantity}`),
    from: from.id,
    to: to.id,
    date: civil(date),
    moved: { kind: 'units', instrument: what.id, quantity: decimal(quantity) },
    importKey: null,
    note: '',
  }
}

export function cashTransfer(from: InvestmentAccount, to: InvestmentAccount, date: string, currency: CurrencyCode, amount: string): Transfer {
  return {
    id: recordIdOf(TRANSFER_RECORDS, `cash-${date}-${amount}`),
    from: from.id,
    to: to.id,
    date: civil(date),
    moved: { kind: 'cash', currency, amount: decimal(amount) },
    importKey: null,
    note: '',
  }
}

export function split(what: Instrument, date: string, newUnits: number, oldUnits: number): Split {
  return { id: recordIdOf(SPLIT_RECORDS, `split-${what.symbol}-${date}`), instrument: what.id, date: civil(date), newUnits, oldUnits, importKey: null, note: '' }
}

export function spinOff(parent: Instrument, received: Instrument, date: string, quantity: string, costShare: string): SpinOff {
  return {
    id: recordIdOf(SPIN_OFF_RECORDS, `spin-off-${received.symbol}-${date}`),
    instrument: parent.id,
    received: received.id,
    date: civil(date),
    quantity: decimal(quantity),
    costShare: decimal(costShare),
    importKey: null,
    note: '',
  }
}

export function book(records: Partial<InvestmentBook>): InvestmentBook {
  return { accounts: [], instruments: [], trades: [], income: [], cashMovements: [], exchanges: [], transfers: [], splits: [], spinOffs: [], prices: [], ...records }
}

/** One close as `[date, price]`, or `[date, price, 'by hand']`. */
export type CloseRow = readonly [string, string] | readonly [string, string, 'by hand']

/** Closes per instrument, looked up on or before a day. */
export function priceBookOf(closes: ReadonlyMap<Instrument, readonly CloseRow[]>): PriceBook {
  const series = new Map([...closes].map(([what, rows]) => [what.id, rows.map(([date, price, byHand]): Close => ({ date: civil(date), price: decimal(price), byHand: byHand !== undefined }))]))
  return {
    closeOnOrBefore: (what: Instrument, day: CivilDate) =>
      (series.get(what.id) ?? [])
        .filter((close) => close.date <= day)
        .sort((earlier, later) => earlier.date.localeCompare(later.date))
        .at(-1) ?? null,
  }
}

/** ECB rates per currency as `[date, units per euro]`, looked up on or before a day. */
export function rateBookOf(rates: ReadonlyMap<CurrencyCode, readonly (readonly [string, string])[]>): RateBook {
  return {
    unitsPerEuroOnOrBefore: (currency: CurrencyCode, day: CivilDate) =>
      [...(rates.get(currency) ?? [])]
        .filter(([date]) => date <= day)
        .sort(([earlier], [later]) => earlier.localeCompare(later))
        .map(([, rate]) => decimal(rate))
        .at(-1) ?? null,
  }
}

export const BROKER = account('broker', 'Broker')
export const WORLD_ETF = instrument('world-etf', { name: 'World ETF', prices: 'alphavantage' })
export const STOCK_B = instrument('stock-b', { name: 'Stock B', currency: USD })

/** The plan's worked portfolio, every figure made up: a euro ETF, a dollar share, a deposit, an exchange, a dividend and a sale. */
export function workedPortfolio(): InvestmentBook {
  return book({
    accounts: [BROKER],
    instruments: [WORLD_ETF, STOCK_B],
    cashMovements: [cashMovement('deposit', BROKER, '2025-01-02', '3000')],
    trades: [
      trade('buy', BROKER, WORLD_ETF, '2025-01-02', '10', '100', '2'),
      trade('buy', BROKER, STOCK_B, '2025-03-03', '20', '50', '1', '1.05'),
      trade('buy', BROKER, WORLD_ETF, '2025-07-01', '5', '110', '2'),
      trade('sell', BROKER, STOCK_B, '2026-02-02', '5', '60', '1', '1.18'),
    ],
    exchanges: [exchange(BROKER, '2025-03-03', '1000', EURO, '1050', USD)],
    income: [dividend(BROKER, STOCK_B, '2025-09-15', '10', '3', '1.17')],
  })
}

/** The worked portfolio's closes on 29 Oct 2026 and the close before. */
export const WORKED_PRICES = priceBookOf(
  new Map<Instrument, readonly CloseRow[]>([
    [
      WORLD_ETF,
      [
        ['2026-10-28', '124'],
        ['2026-10-29', '125'],
      ],
    ],
    [
      STOCK_B,
      [
        ['2026-10-28', '57.5'],
        ['2026-10-29', '58'],
      ],
    ],
  ]),
)

export const WORKED_RATES = rateBookOf(
  new Map([
    [
      USD,
      [
        ['2025-03-03', '1.05'],
        ['2025-09-15', '1.17'],
        ['2026-02-02', '1.18'],
        ['2026-10-28', '1.115'],
        ['2026-10-29', '1.12'],
      ],
    ],
  ]),
)
