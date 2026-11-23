import { accountTotals } from './accountTotals'
import type { CountedRow } from './countedRow'
import { rangeTotals } from './monthTotals'
import type { RangeTotals } from './monthTotals'
import { partTotals } from './partTotals'
import type { PartTotals } from './partTotals'
import { labelTotals } from '../../labels/domain/labelTotals'
import { payeeTotals } from '../../payees/domain/payeeTotals'
import type { Account } from '../../workbook/domain/account'
import type { Category } from '../../workbook/domain/category'
import type { Payee } from '../../workbook/domain/payee'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { rangeContains } from '../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** What Analysis groups a span's money by. */
export type Grouping = 'category' | 'payee' | 'label' | 'account'

/** One group of a span: a category with its children, a payee, a label or an account, with what its parts count. */
export interface BreakdownLine extends PartTotals {
  /** The category's, label's or account's id, or the payee's key. Null for the rows on no account. */
  readonly key: string | null
  /** The category's, label's or account's name, or the payee as their newest row spells it. Blank for the rows on no account. */
  readonly name: string
  /** Under a group of categories, its children with a row in the span. Empty for every other line. */
  readonly children: readonly BreakdownLine[]
}

/** A span's money by one grouping, with the span's own totals. A part with two labels counts on both their lines, so label lines can add up to more than the span. */
export interface SpanBreakdown {
  readonly total: RangeTotals
  /** The groups with a row in the span, the most spent first, then the most received, then by key. */
  readonly lines: readonly BreakdownLine[]
}

function byMoney(one: BreakdownLine, other: BreakdownLine): number {
  return other.spent - one.spent || other.income - one.income || other.saved - one.saved || (one.key ?? '').localeCompare(other.key ?? '')
}

/** Each category of `categories`, with every part filed under it or one of its children, and those children nested. */
function categoryLines(rows: readonly CountedRow[], categories: readonly Category[]): BreakdownLine[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const lineOf = (category: Category, under: ReadonlySet<RecordId>, children: readonly BreakdownLine[]): BreakdownLine => ({
    key: category.id,
    name: category.name,
    children,
    ...partTotals(rows, byId, (_row, part) => part.category !== null && under.has(part.category.id)),
  })
  return categories
    .filter((group) => group.parent === null)
    .map((group) => {
      const children = categories
        .filter((child) => child.parent === group.id)
        .map((child) => lineOf(child, new Set([child.id]), []))
        .filter((line) => line.rows > 0)
        .sort(byMoney)
      return lineOf(group, new Set([group.id, ...categories.filter((child) => child.parent === group.id).map((child) => child.id)]), children)
    })
    .filter((line) => line.rows > 0)
}

/** The span's money grouped one way, every line counted as Spending's month counts it. */
export function spanBreakdown(
  rows: readonly CountedRow[],
  book: { readonly categories: readonly Category[]; readonly labels: readonly Label[]; readonly accounts: readonly Pick<Account, 'id' | 'name'>[]; readonly payees: readonly Payee[] },
  range: DateRange,
  grouping: Grouping,
): SpanBreakdown {
  const inSpan = rows.filter((row) => rangeContains(range, row.day))
  const lines = ((): BreakdownLine[] => {
    switch (grouping) {
      case 'category':
        return categoryLines(inSpan, book.categories)
      case 'payee':
        return payeeTotals(inSpan, book.categories, book).map(({ ibans: _ibans, ...payee }) => ({ ...payee, children: [] }))
      case 'label':
        return labelTotals(inSpan, book.categories, book.labels)
          .filter((label) => label.rows > 0)
          .map(({ label, ...totals }) => ({ ...totals, key: label.id, name: label.name, children: [] }))
      case 'account':
        return accountTotals(inSpan, book.categories).map(({ account, ...totals }) => ({
          ...totals,
          key: account,
          name: book.accounts.find((held) => held.id === account)?.name ?? '',
          children: [],
        }))
    }
  })()
  return { total: rangeTotals(inSpan, book.categories, range), lines: lines.sort(byMoney) }
}

/** The lines that spent the most, at most `shown` of them, and what the other lines that spent anything spent together. */
export interface SpendingRanked {
  readonly top: readonly BreakdownLine[]
  /** Null when no other line spent anything. */
  readonly rest: { readonly spent: Money; readonly lines: number } | null
}

/** The lines that spent anything, the most first, cut after `shown`. */
export function spendingRanked(lines: readonly BreakdownLine[], shown: number): SpendingRanked {
  const spending = lines.filter((line) => line.spent > 0).sort((one, other) => other.spent - one.spent)
  const others = spending.slice(shown)
  return { top: spending.slice(0, shown), rest: others.length === 0 ? null : { spent: sumMoney(others.map((line) => line.spent)), lines: others.length } }
}
