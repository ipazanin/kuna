import { eurosAtRate } from '../../../../shared/money/rateBook'
import type { RateBook } from '../../../../shared/money/rateBook'
import type { CashMovement } from '../../workbook/domain/cashMovement'
import type { Exchange } from '../../workbook/domain/exchange'
import type { Trade } from '../../workbook/domain/trade'
import { DECIMAL_ZERO, inEuros } from '../../../../shared/money/decimal'
import { negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** An exchange's fees in euros. */
export interface ExchangeFee {
  readonly exchange: Exchange
  /** At the ECB rate of the exchange's day. Null when the series has no rate for it yet. */
  readonly euros: Money | null
}

/** A trade's fees in euros at the trade's rate, zero when it names none. */
export function tradeFeesInEuros(trade: Trade): Money {
  return inEuros(trade.fees ?? DECIMAL_ZERO, trade.rate)
}

/** The fees of each exchange that names any. */
export function exchangeFeesInEuros(exchanges: readonly Exchange[], rates: RateBook): ExchangeFee[] {
  return exchanges.flatMap((exchange) => (exchange.fees === null ? [] : [{ exchange, euros: eurosAtRate(exchange.fees.amount, exchange.fees.currency, exchange.date, rates) }]))
}

/** The account fees less their refunds, in euros at each movement's rate. Deposits and withdrawals count nothing. */
export function accountFeesInEuros(movements: readonly CashMovement[]): Money {
  return sumMoney(
    movements.flatMap((movement) => {
      if (movement.kind === 'fee') {
        return [inEuros(movement.amount, movement.rate)]
      }
      return movement.kind === 'fee-refund' ? [negateMoney(inEuros(movement.amount, movement.rate))] : []
    }),
  )
}
