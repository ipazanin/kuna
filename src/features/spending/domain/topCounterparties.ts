import { monthsOfRange } from '../../../shared/calendar/dateRange'
import type { LedgerWindow } from '../../../shared/calendar/ledgerWindow'
import { monthOf, monthsFrom } from '../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../shared/calendar/monthKey'
import { ZERO, moneyFromCents, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import type { Figure } from '../../filters/domain/drillTarget'
import { periodRange, transactionsInPeriod } from '../../filters/domain/filterState'
import type { Period } from '../../filters/domain/filterState'
import type { Bucket } from '../../workbook/domain/bucket'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import type { Transaction } from '../../workbook/domain/workbook'

export interface CounterpartyTotal {
  readonly key: string
  /** The alphabetically first folded spelling the group's rows carry, so it stays put as rows arrive. */
  readonly label: string
  /** What left the company, read positive. */
  readonly total: Figure
  readonly transactionCount: number
  /** One amount per month of the period, for a sparkline. */
  readonly monthly: readonly { readonly month: MonthKey; readonly amount: Money }[]
}

/**
 * Every bucket but neutral and financing. Those two move money between the company's own pockets
 * or settle a cost already ranked under its own payee. Unclassified rows stay in: they are money
 * that left, whatever it turns out to have been.
 */
const PAYING_BUCKETS: readonly Bucket[] = ['income', 'operating', 'taxes', 'owner-pay', 'unclassified']

/** A debit of one cent, the bound a drill uses to say "debits only". */
const LARGEST_DEBIT = moneyFromCents(-1)

/** Who the company paid most over a period, grouped by counterparty identity. */
export function topCounterparties(
  transactions: readonly Transaction[],
  period: Period,
  window: LedgerWindow,
  limit = 15,
): CounterpartyTotal[] {
  const range = periodRange(period, window)
  const months = range === null ? monthsFrom(window.firstMonth, window.partMonth) : monthsOfRange(range)
  const groups = new Map<string, { readonly names: Set<string>; total: Money; count: number; readonly byMonth: Map<MonthKey, Money> }>()
  for (const transaction of transactionsInPeriod(transactions, period, window)) {
    if (transaction.amount >= 0 || !PAYING_BUCKETS.includes(transaction.bucket)) {
      continue
    }
    const identity = counterpartyIdentity(transaction)
    const group = groups.get(identity.key) ?? { names: new Set<string>(), total: ZERO, count: 0, byMonth: new Map() }
    const month = monthOf(transaction.date)
    group.names.add(identity.foldedName)
    group.total = subtractMoney(group.total, transaction.amount)
    group.count += 1
    group.byMonth.set(month, subtractMoney(group.byMonth.get(month) ?? ZERO, transaction.amount))
    groups.set(identity.key, group)
  }
  return [...groups]
    .map(([key, group]): CounterpartyTotal => ({
      key,
      label: [...group.names].sort()[0] ?? '',
      total: {
        amount: group.total,
        drill: drillToTransactions({ period, counterparties: [key], buckets: PAYING_BUCKETS, amount: { min: null, max: LARGEST_DEBIT } }),
      },
      transactionCount: group.count,
      monthly: months.map((month) => ({ month, amount: group.byMonth.get(month) ?? ZERO })),
    }))
    .sort((left, right) => right.total.amount - left.total.amount || left.label.localeCompare(right.label))
    .slice(0, limit)
}
