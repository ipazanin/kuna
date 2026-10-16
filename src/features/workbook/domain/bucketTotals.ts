import { monthOf } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { ZERO, addMoney, divideMoney, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { Bucket } from './bucket'
import type { Transaction } from './workbook'

/**
 * The profit and loss over some set of transactions. Income is signed as booked. The three costs
 * read positive. Net and owner earns are signed.
 */
export interface ProfitAndLoss {
  readonly income: Money
  readonly operating: Money
  readonly taxes: Money
  readonly ownerPay: Money
  /** Operating, taxes and owner pay together. */
  readonly cost: Money
  /** Income less cost. */
  readonly net: Money
  /** Owner pay plus net, which is income less operating and taxes. */
  readonly ownerEarns: Money
}

export type ProfitAndLossLine = keyof ProfitAndLoss

/** The lines in reading order. */
export const PROFIT_AND_LOSS_LINES: readonly ProfitAndLossLine[] = [
  'income',
  'operating',
  'taxes',
  'ownerPay',
  'cost',
  'net',
  'ownerEarns',
]

/** One value per line, such as each line's figure with its drill. */
export function forEachLine<Value>(valueOf: (line: ProfitAndLossLine) => Value): Record<ProfitAndLossLine, Value> {
  return Object.fromEntries(PROFIT_AND_LOSS_LINES.map((line) => [line, valueOf(line)])) as Record<ProfitAndLossLine, Value>
}

/** The buckets whose rows make up each line, which is what a drill into that line filters on. */
export const LINE_BUCKETS: Readonly<Record<ProfitAndLossLine, readonly Bucket[]>> = {
  income: ['income'],
  operating: ['operating'],
  taxes: ['taxes'],
  ownerPay: ['owner-pay'],
  cost: ['operating', 'taxes', 'owner-pay'],
  net: ['income', 'operating', 'taxes', 'owner-pay'],
  ownerEarns: ['income', 'operating', 'taxes'],
}

export const EMPTY_PROFIT_AND_LOSS = profitAndLossFrom(ZERO, ZERO, ZERO, ZERO)

/** Sums the four profit and loss buckets. Financing, neutral and unclassified rows are left out. */
export function bucketTotals(transactions: Iterable<Transaction>): ProfitAndLoss {
  let income = ZERO
  let operating = ZERO
  let taxes = ZERO
  let ownerPay = ZERO
  for (const transaction of transactions) {
    switch (transaction.bucket) {
      case 'income':
        income = addMoney(income, transaction.amount)
        break
      case 'operating':
        operating = subtractMoney(operating, transaction.amount)
        break
      case 'taxes':
        taxes = subtractMoney(taxes, transaction.amount)
        break
      case 'owner-pay':
        ownerPay = subtractMoney(ownerPay, transaction.amount)
        break
      default:
        break
    }
  }
  return profitAndLossFrom(income, operating, taxes, ownerPay)
}

/** One profit and loss per month asked for. A month with no rows reads as zero. */
export function monthlyBucketTotals(
  transactions: Iterable<Transaction>,
  months: readonly MonthKey[],
): ReadonlyMap<MonthKey, ProfitAndLoss> {
  const rowsByMonth = new Map<MonthKey, Transaction[]>(months.map((month) => [month, []]))
  for (const transaction of transactions) {
    rowsByMonth.get(monthOf(transaction.date))?.push(transaction)
  }
  return new Map([...rowsByMonth].map(([month, rows]) => [month, bucketTotals(rows)]))
}

/** Each line divided by a month count, rounded to the cent line by line. */
export function averagePerMonth(totals: ProfitAndLoss, monthCount: number): ProfitAndLoss {
  return {
    income: divideMoney(totals.income, monthCount),
    operating: divideMoney(totals.operating, monthCount),
    taxes: divideMoney(totals.taxes, monthCount),
    ownerPay: divideMoney(totals.ownerPay, monthCount),
    cost: divideMoney(totals.cost, monthCount),
    net: divideMoney(totals.net, monthCount),
    ownerEarns: divideMoney(totals.ownerEarns, monthCount),
  }
}

function profitAndLossFrom(income: Money, operating: Money, taxes: Money, ownerPay: Money): ProfitAndLoss {
  const cost = addMoney(addMoney(operating, taxes), ownerPay)
  return {
    income,
    operating,
    taxes,
    ownerPay,
    cost,
    net: subtractMoney(income, cost),
    ownerEarns: addMoney(subtractMoney(income, cost), ownerPay),
  }
}
