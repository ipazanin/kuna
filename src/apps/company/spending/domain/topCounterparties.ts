import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { addMonths, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, moneyFromCents, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import type { Figure } from '../../filters/domain/drillTarget'
import { periodRange, transactionsInPeriod } from '../../filters/domain/filterState'
import type { Period } from '../../filters/domain/filterState'
import type { Bucket } from '../../workbook/domain/bucket'
import { counterpartyIdentity } from '../../workbook/domain/counterpartyIdentity'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Transaction } from '../../workbook/domain/workbook'

/** What one counterparty was paid under one category. */
export interface CounterpartyCategory {
  /** Empty for rows with no category. */
  readonly category: string
  readonly bucket: Bucket
  /** What left the company under this category, read positive. */
  readonly amount: Figure
  /** Bank rows, so the parts of a split row count as one. */
  readonly transactionCount: number
}

/** How a payee is paid: in most months, or a single time in the period. Anything else has no tag. */
export type PaymentRhythm = 'monthly' | 'one-off' | null

export interface CounterpartyTotal {
  readonly key: string
  /** The spelling the rows use most, as written, so a payee reads as the bank wrote it. */
  readonly label: string
  /** What left the company in the period, read positive. */
  readonly total: Figure
  /** Bank rows, so the parts of a split row count as one. */
  readonly transactionCount: number
  /**
   * What left the company in each of the 12 months up to the period's last month, whatever the
   * period's length, so every payee is drawn over the same months.
   */
  readonly strip: readonly { readonly month: MonthKey; readonly amount: Money }[]
  readonly rhythm: PaymentRhythm
  /** Every category the payments came under, largest first. Together they make up the total. */
  readonly categories: readonly CounterpartyCategory[]
}

/**
 * Every bucket but neutral and financing. Those two move money between the company's own pockets
 * or settle a cost already ranked under its own payee. Unclassified rows stay in: they are money
 * that left, whatever it turns out to have been.
 */
const PAYING_BUCKETS: readonly Bucket[] = ['income', 'operating', 'taxes', 'owner-pay', 'unclassified']

/** A debit of one cent, the bound a drill uses to say "debits only". */
const LARGEST_DEBIT = moneyFromCents(-1)

const STRIP_MONTHS = 12

/** A payee paid in at least this share of the strip months the ledger covers, and in at least three, is paid monthly. */
const MONTHLY_SHARE = 0.75

/** Who the company paid most over a period, grouped by counterparty identity. */
export function topCounterparties(transactions: readonly Transaction[], period: Period, window: LedgerWindow, limit = 15): CounterpartyTotal[] {
  const range = periodRange(period, window)
  const lastMonth = range === null || monthOf(range.to) > window.partMonth ? window.partMonth : monthOf(range.to)
  const stripMonths = monthsFrom(addMonths(lastMonth, 1 - STRIP_MONTHS), lastMonth)
  const coveredStripMonths = stripMonths.filter((month) => month >= window.firstMonth).length
  const paidByMonth = paymentsByMonth(transactions)
  const groups = new Map<
    string,
    {
      readonly spellings: Map<string, number>
      total: Money
      readonly payments: Set<RecordId>
      readonly byCategory: Map<string, { readonly bucket: Bucket; paid: Money; readonly payments: Set<RecordId> }>
    }
  >()
  for (const transaction of transactionsInPeriod(transactions, period, window)) {
    if (!isPayment(transaction)) {
      continue
    }
    const identity = counterpartyIdentity(transaction)
    const group = groups.get(identity.key) ?? { spellings: new Map<string, number>(), total: ZERO, payments: new Set<RecordId>(), byCategory: new Map() }
    group.spellings.set(identity.writtenName, (group.spellings.get(identity.writtenName) ?? 0) + 1)
    group.total = subtractMoney(group.total, transaction.amount)
    group.payments.add(transaction.id)
    const underCategory = group.byCategory.get(transaction.category) ?? { bucket: transaction.bucket, paid: ZERO, payments: new Set<RecordId>() }
    underCategory.paid = subtractMoney(underCategory.paid, transaction.amount)
    underCategory.payments.add(transaction.id)
    group.byCategory.set(transaction.category, underCategory)
    groups.set(identity.key, group)
  }
  return [...groups]
    .map(([key, group]): CounterpartyTotal => {
      const strip = stripMonths.map((month) => ({ month, amount: paidByMonth.get(`${key}|${month}`) ?? ZERO }))
      const paidMonths = strip.filter((cell) => cell.amount > 0).length
      return {
        key,
        label: mostUsed(group.spellings),
        total: {
          amount: group.total,
          drill: drillToTransactions({ period, counterparties: [key], buckets: PAYING_BUCKETS, amount: { min: null, max: LARGEST_DEBIT } }),
        },
        transactionCount: group.payments.size,
        strip,
        rhythm: paidMonths >= 3 && paidMonths >= coveredStripMonths * MONTHLY_SHARE ? 'monthly' : group.payments.size === 1 ? 'one-off' : null,
        categories: [...group.byCategory]
          .map(([category, paid]): CounterpartyCategory => ({
            category,
            bucket: paid.bucket,
            amount: {
              amount: paid.paid,
              drill: drillToTransactions({ period, counterparties: [key], categories: [category], amount: { min: null, max: LARGEST_DEBIT } }),
            },
            transactionCount: paid.payments.size,
          }))
          .sort((left, right) => right.amount.amount - left.amount.amount || left.category.localeCompare(right.category)),
      }
    })
    .sort((left, right) => right.total.amount - left.total.amount || left.label.localeCompare(right.label))
    .slice(0, limit)
}

function isPayment(transaction: Transaction): boolean {
  return transaction.amount < 0 && PAYING_BUCKETS.includes(transaction.bucket)
}

/** What left the company per counterparty and month, over every row given, keyed "counterparty|month". */
function paymentsByMonth(transactions: readonly Transaction[]): Map<string, Money> {
  const paid = new Map<string, Money>()
  for (const transaction of transactions) {
    if (isPayment(transaction)) {
      const key = `${counterpartyIdentity(transaction).key}|${monthOf(transaction.date)}`
      paid.set(key, subtractMoney(paid.get(key) ?? ZERO, transaction.amount))
    }
  }
  return paid
}

/** The spelling used most, and of equals the alphabetically first, so the label does not flicker. */
function mostUsed(spellings: ReadonlyMap<string, number>): string {
  return [...spellings].sort(([leftName, leftCount], [rightName, rightCount]) => rightCount - leftCount || leftName.localeCompare(rightName))[0]?.[0] ?? ''
}
