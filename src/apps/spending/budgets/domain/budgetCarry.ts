import type { Budget } from '../../workbook/domain/budget'
import { addMonths } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The months one limit holds without a break: from its first month to the month a budget of zero ends it, or on. */
export interface LimitRun {
  readonly from: MonthKey
  /** The first month without the limit, or null while it runs on. */
  readonly until: MonthKey | null
}

/** The budgets of one category, oldest first. */
function budgetsOf(budgets: readonly Budget[], category: RecordId): Budget[] {
  return budgets.filter((budget) => budget.category === category).sort((earlier, later) => earlier.from.localeCompare(later.from))
}

/** Each unbroken run of a category's limit. A new amount carries the run on, and only a budget of zero ends it. */
export function limitRuns(budgets: readonly Budget[], category: RecordId): LimitRun[] {
  const runs: LimitRun[] = []
  let from: MonthKey | null = null
  for (const budget of budgetsOf(budgets, category)) {
    if (budget.amount === 0 && from !== null) {
      runs.push({ from, until: budget.from })
      from = null
    } else if (budget.amount !== 0 && from === null) {
      from = budget.from
    }
  }
  return from === null ? runs : [...runs, { from, until: null }]
}

/** Whether two runs share a month. */
export function runsOverlap(left: LimitRun, right: LimitRun): boolean {
  return (right.until === null || left.from < right.until) && (left.until === null || right.from < left.until)
}

/** The category's limit in the month: the amount of its newest budget from that month or before, and zero without one. */
export function limitIn(budgets: readonly Budget[], category: RecordId, month: MonthKey): Money {
  return (
    budgetsOf(budgets, category)
      .filter((budget) => budget.from <= month)
      .at(-1)?.amount ?? ZERO
  )
}

/** One limited category in one month. */
export interface BudgetMonth {
  readonly category: RecordId
  readonly limit: Money
  /** What the months before left over, below zero after an overspent month. */
  readonly carriedIn: Money
  /** The limit and what carried in. Below zero reads as over by. */
  readonly available: Money
  /** The category's spending in euros, refunds taken off, with its children's for a group. */
  readonly spent: Money
  /** Available less spent, which carries into the next month once this one ends. */
  readonly left: Money
  /** Rows of the category in this month that the rates do not reach, so they count as nothing. */
  readonly unrated: number
  /** The same rows in the months before it whose carry reaches it. */
  readonly unratedCarried: number
}

/** A category's spending in a month, and how many of its rows count as nothing because the rates do not reach them. */
export interface CategoryMonth {
  readonly spent: Money
  readonly unrated: number
}

/**
 * Every category with a limit in the month, with what carried in from the months of its run before it. What a month
 * leaves, its limit and carry less what it spent, carries into the next, and an overspent month lowers the next. A
 * budget of zero ends the run, so nothing carries past it, and a later budget starts a new run from nothing.
 * `spentIn` gives a category's spending in a month, its children's included.
 */
export function budgetMonths(budgets: readonly Budget[], spentIn: (category: RecordId, month: MonthKey) => CategoryMonth, month: MonthKey): BudgetMonth[] {
  const categories = [...new Set(budgets.map((budget) => budget.category))]
  return categories.flatMap((category) => {
    const run = limitRuns(budgets, category).find((candidate) => candidate.from <= month && (candidate.until === null || month < candidate.until))
    if (run === undefined) return []
    let carriedIn = ZERO
    let unratedCarried = 0
    for (let earlier = run.from; earlier < month; earlier = addMonths(earlier, 1)) {
      const before = spentIn(category, earlier)
      carriedIn = subtractMoney(addMoney(carriedIn, limitIn(budgets, category, earlier)), before.spent)
      unratedCarried += before.unrated
    }
    const limit = limitIn(budgets, category, month)
    const available = addMoney(limit, carriedIn)
    const { spent, unrated } = spentIn(category, month)
    return [{ category, limit, carriedIn, available, spent, left: subtractMoney(available, spent), unrated, unratedCarried }]
  })
}

/** What is left to spend of every limit in the month together, which the home card shows. */
export function leftToSpend(months: readonly BudgetMonth[]): Money {
  return months.reduce((sum, entry) => addMoney(sum, entry.left), ZERO)
}

/** How many rows the limits of the month count as nothing, this month's and those of the months they carry from. A row a receipt split across two limits counts under each. */
export function limitsUnrated(months: readonly BudgetMonth[]): number {
  return months.reduce((sum, entry) => sum + entry.unrated + entry.unratedCarried, 0)
}
