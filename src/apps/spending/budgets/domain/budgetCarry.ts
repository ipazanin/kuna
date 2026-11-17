import type { Budget } from '../../workbook/domain/budget'
import { addMonths, monthCountBetween } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { moneyParts } from '../../../../shared/money/decimal'
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

/**
 * Each unbroken run of a category's limit. A new amount carries the run on, and a budget of zero ends it. A switch between a
 * monthly limit and a yearly cost starts a new run, so a yearly cost's money never mixes with a monthly limit's.
 */
export function limitRuns(budgets: readonly Budget[], category: RecordId): LimitRun[] {
  const runs: LimitRun[] = []
  let from: MonthKey | null = null
  let yearly = false
  for (const budget of budgetsOf(budgets, category)) {
    if (from !== null && (budget.amount === 0 || (budget.due !== undefined) !== yearly)) {
      runs.push({ from, until: budget.from })
      from = null
    }
    if (budget.amount !== 0 && from === null) {
      from = budget.from
      yearly = budget.due !== undefined
    }
  }
  return from === null ? runs : [...runs, { from, until: null }]
}

/** Whether two runs share a month. */
export function runsOverlap(left: LimitRun, right: LimitRun): boolean {
  return (right.until === null || left.from < right.until) && (left.until === null || right.from < left.until)
}

/** The category's budget in the month: its newest from that month or before, or undefined without one. */
export function budgetIn(budgets: readonly Budget[], category: RecordId, month: MonthKey): Budget | undefined {
  return budgetsOf(budgets, category)
    .filter((budget) => budget.from <= month)
    .at(-1)
}

/** The category's limit in the month: the amount of its newest budget from that month or before, and zero without one. */
export function limitIn(budgets: readonly Budget[], category: RecordId, month: MonthKey): Money {
  return budgetIn(budgets, category, month)?.amount ?? ZERO
}

/** The month a yearly cost next falls due, the month itself or later: its due month, or the same month a whole number of years on. */
export function nextDue(due: MonthKey, month: MonthKey): MonthKey {
  if (month <= due) return due
  const years = Math.ceil((monthCountBetween(due, month) - 1) / 12)
  return addMonths(due, 12 * years)
}

/**
 * What a yearly cost sets aside in the month: what the next due month still lacks once the money carried in counts, spread
 * over the months up to it, the month itself and the due month included, so the due month holds the whole amount. Nothing
 * once the carry covers it.
 */
function setAsideIn(cost: Budget & { readonly due: MonthKey }, month: MonthKey, carriedIn: Money): Money {
  const missing = subtractMoney(cost.amount, carriedIn)
  if (missing <= 0) return ZERO
  const months = monthCountBetween(month, nextDue(cost.due, month))
  return moneyParts(
    missing,
    Array.from({ length: months }, () => 1n),
  )[0]!
}

/** A yearly cost of the category in the month, or null for a monthly limit or none. */
function yearlyIn(budgets: readonly Budget[], category: RecordId, month: MonthKey): (Budget & { readonly due: MonthKey }) | null {
  const budget = budgetIn(budgets, category, month)
  return budget?.due === undefined ? null : { ...budget, due: budget.due }
}

/** What the category's limit gives the month: a monthly limit's amount, or what a yearly cost sets aside after what carried in. */
function givenIn(budgets: readonly Budget[], category: RecordId, month: MonthKey, carriedIn: Money): Money {
  const yearly = yearlyIn(budgets, category, month)
  return yearly === null ? limitIn(budgets, category, month) : setAsideIn(yearly, month, carriedIn)
}

/** A yearly cost's facts in a month: the amount due each year and the month it next falls due, this month or later. */
export interface YearlyCost {
  readonly amount: Money
  readonly due: MonthKey
}

/** One limited category in one month. */
export interface BudgetMonth {
  readonly category: RecordId
  /** A monthly limit's amount, or what a yearly cost sets aside this month. */
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
  /** Present on a yearly cost alone, so a monthly limit keeps its shape. */
  readonly yearly?: YearlyCost
}

/** A category's spending in a month, and how many of its rows count as nothing because the rates do not reach them. */
export interface CategoryMonth {
  readonly spent: Money
  readonly unrated: number
}

/**
 * Every category with a limit in the month, with what carried in from the months of its run before it. What a month
 * leaves, its limit and carry less what it spent, carries into the next, and an overspent month lowers the next. A
 * budget of zero ends the run, so nothing carries past it, and a later budget starts a new run from nothing. A yearly cost
 * sets aside each month what `setAsideIn` says in place of a limit, and its payment in the due month spends what was set aside.
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
      carriedIn = subtractMoney(addMoney(carriedIn, givenIn(budgets, category, earlier, carriedIn)), before.spent)
      unratedCarried += before.unrated
    }
    const limit = givenIn(budgets, category, month, carriedIn)
    const available = addMoney(limit, carriedIn)
    const { spent, unrated } = spentIn(category, month)
    const yearly = yearlyIn(budgets, category, month)
    const facts = { category, limit, carriedIn, available, spent, left: subtractMoney(available, spent), unrated, unratedCarried }
    return [yearly === null ? facts : { ...facts, yearly: { amount: yearly.amount, due: nextDue(yearly.due, month) } }]
  })
}

/** What is left to spend of every monthly limit in the month together, which the home card shows. A yearly cost's money is set aside for its due month, not free to spend. */
export function leftToSpend(months: readonly BudgetMonth[]): Money {
  return months.filter((entry) => entry.yearly === undefined).reduce((sum, entry) => addMoney(sum, entry.left), ZERO)
}

/** Whether a monthly limit holds in the month, so there is money left to spend to show. */
export function holdsMonthlyLimit(months: readonly BudgetMonth[]): boolean {
  return months.some((entry) => entry.yearly === undefined)
}

/** What the yearly costs hold set aside at the end of the month together, after what they spent. */
export function setAsideForYearly(months: readonly BudgetMonth[]): Money {
  return months.filter((entry) => entry.yearly !== undefined).reduce((sum, entry) => addMoney(sum, entry.left), ZERO)
}

/** How many rows the limits of the month count as nothing, this month's and those of the months they carry from. A row a receipt split across two limits counts under each. */
export function limitsUnrated(months: readonly BudgetMonth[]): number {
  return months.reduce((sum, entry) => sum + entry.unrated + entry.unratedCarried, 0)
}
