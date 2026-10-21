import { ratioOf, subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { drillToTransactions } from '../../filters/domain/drillTarget'
import type { DrillTarget } from '../../filters/domain/drillTarget'
import type { Period } from '../../filters/domain/filterState'
import { LINE_BUCKETS } from '../../workbook/domain/bucketTotals'
import type { ProfitAndLoss } from '../../workbook/domain/bucketTotals'

export type EuroSplitPart = 'operating' | 'taxes' | 'ownerPay' | 'kept'

export interface EuroSplitSlice {
  readonly part: EuroSplitPart
  readonly total: Money
  /** The slice over the whole. The slices of one split add up to 1. */
  readonly share: number
  readonly drill: DrillTarget
}

export interface EuroSplit {
  /**
   * `income` when income covers the costs: the costs and what is kept split every euro earned.
   * `cost` in a loss: the three costs split every euro spent.
   */
  readonly basis: 'income' | 'cost'
  readonly whole: Money
  readonly slices: readonly EuroSplitSlice[]
  /** Cost less income, only in a loss. */
  readonly shortfall: Money | null
}

/**
 * Where every euro earned went over a period. A ring of the costs and what is kept only adds up
 * while there is a profit, so a loss switches the basis to cost instead of drawing a negative slice.
 */
export function euroSplit(totals: ProfitAndLoss, period: Period): EuroSplit {
  const inLoss = totals.cost > totals.income
  const whole = inLoss ? totals.cost : totals.income
  const sliceOf = (part: EuroSplitPart, total: Money): EuroSplitSlice => ({
    part,
    total,
    share: ratioOf(total, whole) ?? 0,
    drill: drillToTransactions({ period, buckets: LINE_BUCKETS[part === 'kept' ? 'net' : part] }),
  })
  const costSlices = [sliceOf('operating', totals.operating), sliceOf('taxes', totals.taxes), sliceOf('ownerPay', totals.ownerPay)]
  return {
    basis: inLoss ? 'cost' : 'income',
    whole,
    slices: inLoss ? costSlices : [...costSlices, sliceOf('kept', totals.net)],
    shortfall: inLoss ? subtractMoney(totals.cost, totals.income) : null,
  }
}
