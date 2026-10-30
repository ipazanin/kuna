import { tradeTotal } from './lots'
import { eurosAtEcbRate } from '../../prices/domain/rateBook'
import type { RateBook } from '../../prices/domain/rateBook'
import type { CashMovementKind } from '../../workbook/domain/cashMovement'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, addDecimal, inEuros, negateDecimal, subtractDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { ZERO, addMoney, negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** An account's cash in one currency. */
export interface CashBalance {
  readonly account: RecordId
  readonly currency: CurrencyCode
  /** Below zero when a deposit or an exchange is missing from the records. */
  readonly balance: Decimal
  /** What the balance came in at: every movement in euros at its own rate. */
  readonly eurosIn: Money
}

export interface AccountCash {
  readonly balances: readonly CashBalance[]
  /** Records with a foreign amount the ECB series has no rate for yet, whose euros are left out of `eurosIn`. */
  readonly unrated: readonly RecordId[]
}

const ADDS: ReadonlySet<CashMovementKind> = new Set(['deposit', 'fee-refund'])

/**
 * Each account's balance per currency from every record that moves cash, apart from the trades the lots refused, which
 * move no units and so no cash either. A trade, income, a cash movement and a foreign exchange with a euro leg carry
 * their euros. A transfer and an exchange between two foreign currencies take the ECB rate of their day, and an
 * exchange gives both legs the same euros.
 */
export function accountCash(book: InvestmentBook, rates: RateBook, refused: ReadonlySet<RecordId>): AccountCash {
  const balances = new Map<string, CashBalance>()
  const unrated: RecordId[] = []
  const move = (account: RecordId, currency: CurrencyCode, amount: Decimal, euros: Money | null, record: RecordId): void => {
    const key = `${account}|${currency}`
    const known = balances.get(key) ?? { account, currency, balance: DECIMAL_ZERO, eurosIn: ZERO }
    balances.set(key, { ...known, balance: addDecimal(known.balance, amount), eurosIn: addMoney(known.eurosIn, euros ?? ZERO) })
    if (euros === null && !unrated.includes(record)) {
      unrated.push(record)
    }
  }
  const instrumentOf = new Map(book.instruments.map((instrument) => [instrument.id, instrument]))

  for (const trade of book.trades) {
    const instrument = instrumentOf.get(trade.instrument)
    if (instrument === undefined || refused.has(trade.id)) {
      continue
    }
    const total = tradeTotal(trade, instrument.quoted)
    const euros = inEuros(total, trade.rate)
    if (trade.side === 'buy') {
      move(trade.account, instrument.currency, negateDecimal(total), negateMoney(euros), trade.id)
    } else {
      move(trade.account, instrument.currency, total, euros, trade.id)
    }
  }
  for (const income of book.income) {
    const received = subtractDecimal(income.gross, income.withheld)
    move(income.account, income.currency, received, inEuros(received, income.rate), income.id)
  }
  for (const movement of book.cashMovements) {
    const euros = inEuros(movement.amount, movement.rate)
    if (ADDS.has(movement.kind)) {
      move(movement.account, movement.currency, movement.amount, euros, movement.id)
    } else {
      move(movement.account, movement.currency, negateDecimal(movement.amount), negateMoney(euros), movement.id)
    }
  }
  for (const exchange of book.exchanges) {
    const euros =
      exchange.soldCurrency === EURO
        ? inEuros(exchange.sold, null)
        : exchange.boughtCurrency === EURO
          ? inEuros(exchange.bought, null)
          : eurosAtEcbRate(exchange.sold, exchange.soldCurrency, exchange.date, rates)
    move(exchange.account, exchange.soldCurrency, negateDecimal(exchange.sold), euros === null ? null : negateMoney(euros), exchange.id)
    move(exchange.account, exchange.boughtCurrency, exchange.bought, euros, exchange.id)
  }
  for (const transfer of book.transfers) {
    if (transfer.moved.kind === 'cash') {
      const { currency, amount } = transfer.moved
      const euros = eurosAtEcbRate(amount, currency, transfer.date, rates)
      move(transfer.from, currency, negateDecimal(amount), euros === null ? null : negateMoney(euros), transfer.id)
      move(transfer.to, currency, amount, euros, transfer.id)
    }
  }
  const accountOrder = new Map(book.accounts.map((account, index) => [account.id, index]))
  const sorted = [...balances.values()].sort(
    (first, second) => (accountOrder.get(first.account) ?? accountOrder.size) - (accountOrder.get(second.account) ?? accountOrder.size) || first.currency.localeCompare(second.currency),
  )
  return { balances: sorted, unrated }
}
