import type { MonthTotals } from '../../analytics/domain/monthTotals'
import { categoryTree } from '../../categories/domain/categoryTree'
import type { Category } from '../../workbook/domain/category'
import { overviewGroupLink, transactionsLink } from './spendingLinks'
import { words } from './words'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { ZERO, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { DonutPart } from '../../../../shared/ui/DonutCard.vue'

/** The most parts a ring shows before the smallest fold into one grey part. */
const MOST_PARTS = 6

export interface SpendingRing {
  /** The group the ring is opened on, or null for every group. */
  readonly group: Category | null
  readonly parts: readonly DonutPart[]
  /** What the parts come to, for the middle of the ring. */
  readonly total: Money
  readonly description: string
  /** What a part's link opens, for a screen reader. */
  readonly opens: string
}

interface Slice {
  readonly category: Category
  readonly amount: Money
  readonly to: DonutPart['to']
}

/**
 * The month's spending as ring parts: each spending group, which opens its children on the ring, or, opened on a group,
 * the rows filed on the group itself and each child, which open their entries. Only parts above zero count, and past
 * six the smallest fold into one grey part that opens nothing.
 */
export function spendingRing(totals: MonthTotals, categories: readonly Category[], colourOf: (category: Category) => string, month: MonthKey, opened: Category | null): SpendingRing {
  const tree = categoryTree(categories, ['spending'])
  const branch = opened === null ? undefined : tree.find((entry) => entry.group.id === opened.id)
  const slices: Slice[] =
    branch === undefined
      ? tree.map((entry) => ({
          category: entry.group,
          amount: totals.byGroup.get(entry.group.id) ?? ZERO,
          to: entry.children.length === 0 ? transactionsLink(month, entry.group) : overviewGroupLink(entry.group),
        }))
      : [branch.group, ...branch.children].map((category) => ({ category, amount: totals.byCategory.get(category.id) ?? ZERO, to: transactionsLink(month, category) }))
  const counted = slices.filter((slice) => slice.amount > 0).sort((larger, smaller) => smaller.amount - larger.amount)
  const kept = counted.length > MOST_PARTS ? counted.slice(0, MOST_PARTS - 1) : counted
  const folded = counted.slice(kept.length)
  const parts: DonutPart[] = [
    ...kept.map((slice) => ({ key: slice.category.id, label: slice.category.name, value: slice.amount, colour: colourOf(slice.category), to: slice.to })),
    ...(folded.length === 0
      ? []
      : [
          {
            key: 'other',
            label: branch === undefined ? words.donut.otherGroups : words.donut.otherCategories,
            value: sumMoney(folded.map((slice) => slice.amount)),
            colour: '--chart-deemphasis',
            to: null,
          },
        ]),
  ]
  const total = sumMoney(counted.map((slice) => slice.amount))
  return {
    group: branch?.group ?? null,
    parts,
    total,
    description: words.donut.description(monthLabel(month), formatMoney(total), parts.map((part) => words.donut.part(part.label, formatMoney(part.value))).join(', ')),
    opens: branch === undefined ? words.donut.opensChildren : words.donut.opensEntries,
  }
}
