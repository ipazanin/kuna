import { tradeTotal } from './lots'
import { eurosAtEcbRate } from '../../prices/domain/rateBook'
import type { RateBook } from '../../prices/domain/rateBook'
import { addsCash } from '../../workbook/domain/cashMovement'
import type { CashMovement } from '../../workbook/domain/cashMovement'
import type { Exchange } from '../../workbook/domain/exchange'
import type { Income } from '../../workbook/domain/income'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { SpinOff } from '../../workbook/domain/spinOff'
import type { Split } from '../../workbook/domain/split'
import type { Trade } from '../../workbook/domain/trade'
import type { Transfer } from '../../workbook/domain/transfer'
import { EURO } from '../../../../shared/money/currencyCode'
import { inEuros, subtractDecimal } from '../../../../shared/money/decimal'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * A record as a list of records shows it, with what it names and its euros where it moved money. A trade's, an income's
 * and a cash movement's euros carry the sign they move the account's cash by, so a buy, a withdrawal and a fee are
 * below zero.
 */
export type LatestRecord =
  | { readonly kind: 'trade'; readonly record: Trade; readonly instrument: Instrument; readonly account: InvestmentAccount; readonly euros: Money }
  | { readonly kind: 'income'; readonly record: Income; readonly instrument: Instrument | null; readonly account: InvestmentAccount; readonly euros: Money }
  | { readonly kind: 'cash-movement'; readonly record: CashMovement; readonly account: InvestmentAccount; readonly euros: Money }
  /** The euro leg, or for two foreign currencies what was sold at the ECB rate of the day, null before the series has one. Never below zero. */
  | { readonly kind: 'exchange'; readonly record: Exchange; readonly account: InvestmentAccount; readonly euros: Money | null }
  /** Units carry their instrument and no euros. Cash carries its euros at the ECB rate of the day, never below zero. */
  | {
      readonly kind: 'transfer'
      readonly record: Transfer
      readonly from: InvestmentAccount
      readonly to: InvestmentAccount
      readonly instrument: Instrument | null
      readonly euros: Money | null
    }
  | { readonly kind: 'split'; readonly record: Split; readonly instrument: Instrument }
  | { readonly kind: 'spin-off'; readonly record: SpinOff; readonly instrument: Instrument; readonly received: Instrument }

/** The newest records of every kind, newest first, all of them without a count. Records of one day keep the kinds in the order below, the last one first. */
export function latestRecords(book: InvestmentBook, rates: RateBook, count?: number): LatestRecord[] {
  const instrumentOf = byId(book.instruments)
  const accountOf = byId(book.accounts)
  const listed: LatestRecord[] = []
  const add = (entry: LatestRecord | null): void => {
    if (entry !== null) listed.push(entry)
  }

  for (const trade of book.trades) {
    const instrument = instrumentOf(trade.instrument)
    const account = accountOf(trade.account)
    if (instrument === null || account === null) {
      continue
    }
    const total = inEuros(tradeTotal(trade, instrument.quoted), trade.rate)
    add({ kind: 'trade', record: trade, instrument, account, euros: trade.side === 'buy' ? negateMoney(total) : total })
  }
  for (const income of book.income) {
    const account = accountOf(income.account)
    const euros = inEuros(subtractDecimal(income.gross, income.withheld), income.rate)
    add(account === null ? null : { kind: 'income', record: income, instrument: income.instrument === null ? null : instrumentOf(income.instrument), account, euros })
  }
  for (const movement of book.cashMovements) {
    const account = accountOf(movement.account)
    const euros = inEuros(movement.amount, movement.rate)
    add(account === null ? null : { kind: 'cash-movement', record: movement, account, euros: addsCash(movement.kind) ? euros : negateMoney(euros) })
  }
  for (const exchange of book.exchanges) {
    const account = accountOf(exchange.account)
    const euros =
      exchange.soldCurrency === EURO
        ? inEuros(exchange.sold, null)
        : exchange.boughtCurrency === EURO
          ? inEuros(exchange.bought, null)
          : eurosAtEcbRate(exchange.sold, exchange.soldCurrency, exchange.date, rates)
    add(account === null ? null : { kind: 'exchange', record: exchange, account, euros })
  }
  for (const transfer of book.transfers) {
    const from = accountOf(transfer.from)
    const to = accountOf(transfer.to)
    const { moved } = transfer
    const instrument = moved.kind === 'units' ? instrumentOf(moved.instrument) : null
    const euros = moved.kind === 'cash' ? eurosAtEcbRate(moved.amount, moved.currency, transfer.date, rates) : null
    add(from === null || to === null || (moved.kind === 'units' && instrument === null) ? null : { kind: 'transfer', record: transfer, from, to, instrument, euros })
  }
  for (const split of book.splits) {
    const instrument = instrumentOf(split.instrument)
    add(instrument === null ? null : { kind: 'split', record: split, instrument })
  }
  for (const spinOff of book.spinOffs) {
    const instrument = instrumentOf(spinOff.instrument)
    const received = instrumentOf(spinOff.received)
    add(instrument === null || received === null ? null : { kind: 'spin-off', record: spinOff, instrument, received })
  }

  return listed
    .map((entry, place) => ({ entry, place }))
    .sort((first, second) => second.entry.record.date.localeCompare(first.entry.record.date) || second.place - first.place)
    .slice(0, count)
    .map(({ entry }) => entry)
}

function byId<Named extends { readonly id: RecordId }>(records: readonly Named[]): (id: RecordId) => Named | null {
  const found = new Map(records.map((record) => [record.id, record]))
  return (id) => found.get(id) ?? null
}
