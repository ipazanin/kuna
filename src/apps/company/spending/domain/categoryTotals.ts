import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { ZERO, addMoney, negateMoney, ratioOf } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import type { Figure } from '../../filters/domain/drillTarget'
import { transactionsInPeriod } from '../../filters/domain/filterState'
import type { Period } from '../../filters/domain/filterState'
import { bucketTotals } from '../../workbook/domain/bucketTotals'
import { directionOf } from '../../workbook/domain/bucket'
import type { Bucket, Direction } from '../../workbook/domain/bucket'
import type { Booking } from '../../workbook/domain/workbook'

export interface CategoryTotal {
  readonly category: string
  readonly family: string
  readonly bucket: Bucket
  readonly direction: Direction
  /** Income signed as booked and cost negated, so both read positive in the usual case. */
  readonly amount: Figure
  /** The amount over the total of its own direction, or null when that total is zero. */
  readonly share: number | null
}

/**
 * Each category of the profit and loss over a period, largest first within its direction, income
 * before cost. Financing and neutral rows move money without either party being better off, and
 * unclassified rows have no bucket yet, so none of them are listed.
 */
export function categoryTotals(bookings: readonly Booking[], period: Period, window: LedgerWindow): CategoryTotal[] {
  const inPeriod = transactionsInPeriod(bookings, period, window)
  const totals = bucketTotals(inPeriod)
  const sums = new Map<string, { readonly family: string; readonly bucket: Bucket; readonly direction: Direction; signed: Money }>()
  for (const booking of inPeriod) {
    const direction = directionOf(booking.bucket)
    if (direction === null) {
      continue
    }
    const sum = sums.get(booking.category) ?? { family: booking.family, bucket: booking.bucket, direction, signed: ZERO }
    sum.signed = addMoney(sum.signed, booking.amount)
    sums.set(booking.category, sum)
  }
  return [...sums]
    .map(([category, sum]): CategoryTotal => {
      const amount = sum.direction === 'income' ? sum.signed : negateMoney(sum.signed)
      return {
        category,
        family: sum.family,
        bucket: sum.bucket,
        direction: sum.direction,
        amount: { amount, drill: drillToTransactions({ period, categories: [category] }) },
        share: ratioOf(amount, sum.direction === 'income' ? totals.income : totals.cost),
      }
    })
    .sort((left, right) => Number(left.direction === 'cost') - Number(right.direction === 'cost') || right.amount.amount - left.amount.amount || left.category.localeCompare(right.category))
}

export interface OutsideProfitAndLossTotal {
  readonly category: string
  readonly family: string
  /** Signed as booked: positive when money came into the company. */
  readonly amount: Figure
}

/**
 * Each financing category over a period, such as reimbursements between the owner and the
 * company. They settle costs already counted elsewhere, so they are listed beside the profit and
 * loss rather than in it, and have no share of either direction. Largest movement first.
 */
export function outsideProfitAndLossTotals(bookings: readonly Booking[], period: Period, window: LedgerWindow): OutsideProfitAndLossTotal[] {
  const sums = new Map<string, { readonly family: string; signed: Money }>()
  for (const booking of transactionsInPeriod(bookings, period, window)) {
    if (booking.bucket !== 'financing') {
      continue
    }
    const sum = sums.get(booking.category) ?? { family: booking.family, signed: ZERO }
    sum.signed = addMoney(sum.signed, booking.amount)
    sums.set(booking.category, sum)
  }
  return [...sums]
    .map(([category, sum]): OutsideProfitAndLossTotal => ({
      category,
      family: sum.family,
      amount: { amount: sum.signed, drill: drillToTransactions({ period, categories: [category] }) },
    }))
    .sort((left, right) => Math.abs(right.amount.amount) - Math.abs(left.amount.amount) || left.category.localeCompare(right.category))
}
