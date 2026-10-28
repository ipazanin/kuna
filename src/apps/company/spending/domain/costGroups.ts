import { ZERO, addMoney, negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Figure } from '../../filters/domain/drillTarget'
import { COST_BUCKETS } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import type { CategoryTotal } from './categoryTotals'

/** A change against the period before: a fraction of the prior amount, or new when there was none. */
export type CostChange = number | 'new'

export interface CostRow {
  readonly category: string
  readonly bucket: Bucket
  /** What the category cost, read positive. In the money-back group, what came back, read positive. */
  readonly current: Figure | null
  readonly prior: Figure | null
  /** Null without a period before, or when neither period holds anything. */
  readonly change: CostChange | null
}

export interface CostGroup {
  /** A cost bucket, or money back for categories where refunds outweighed the costs. */
  readonly key: (typeof COST_BUCKETS)[number] | 'money-back'
  readonly rows: readonly CostRow[]
  readonly total: Money
  /** Null without a period before. */
  readonly priorTotal: Money | null
  readonly change: CostChange | null
}

/**
 * The cost categories of a period under their buckets, each against the period before, largest
 * first. A category that took more back than it cost moves to its own money-back group, read
 * positive, so every bar grows from zero. A category with nothing in either period is left out.
 */
export function costGroups(current: readonly CategoryTotal[], prior: readonly CategoryTotal[] | null): CostGroup[] {
  const costs = (totals: readonly CategoryTotal[]) => totals.filter((total) => total.direction === 'cost')
  const priorBy = new Map(costs(prior ?? []).map((total) => [total.category, total]))
  const currentBy = new Map(costs(current).map((total) => [total.category, total]))
  const categories = [...new Set([...currentBy.keys(), ...priorBy.keys()])]
  const rows = categories.flatMap((category) => {
    const now = currentBy.get(category)
    const before = priorBy.get(category)
    const nowAmount = now?.amount.amount ?? ZERO
    const beforeAmount = before?.amount.amount ?? ZERO
    if (nowAmount === 0 && beforeAmount === 0) {
      return []
    }
    const back = (now === undefined ? beforeAmount : nowAmount) < 0
    const flip = (figure: Figure | undefined): Figure | null =>
      figure === undefined ? null : back ? { ...figure, amount: negateMoney(figure.amount) } : figure
    const shownNow = flip(now?.amount)
    const shownBefore = flip(before?.amount)
    return [
      {
        group: back ? ('money-back' as const) : ((now ?? before)!.bucket as CostGroup['key']),
        row: {
          category,
          bucket: (now ?? before)!.bucket,
          current: shownNow,
          prior: shownBefore,
          change: prior === null ? null : changeOf(shownNow?.amount ?? ZERO, shownBefore?.amount ?? ZERO),
        },
      },
    ]
  })
  const keys: CostGroup['key'][] = [...COST_BUCKETS, 'money-back']
  return keys.flatMap((key) => {
    const members = rows
      .filter((entry) => entry.group === key)
      .map((entry) => entry.row)
      .sort((left, right) => (right.current?.amount ?? 0) - (left.current?.amount ?? 0) || left.category.localeCompare(right.category))
    if (members.length === 0) {
      return []
    }
    const sum = (pick: (row: CostRow) => Figure | null): Money => members.reduce((total, row) => addMoney(total, pick(row)?.amount ?? ZERO), ZERO)
    const total = sum((row) => row.current)
    const priorTotal = prior === null ? null : sum((row) => row.prior)
    return [{ key, rows: members, total, priorTotal, change: priorTotal === null ? null : changeOf(total, priorTotal) }]
  })
}

function changeOf(now: Money, before: Money): CostChange | null {
  if (before === 0) {
    return now === 0 ? null : 'new'
  }
  return (now - before) / before
}
