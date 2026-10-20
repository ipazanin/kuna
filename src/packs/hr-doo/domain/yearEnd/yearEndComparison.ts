import { drillToTransactions } from '../../../../features/filters/domain/drillTarget'
import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import { displayName } from '../../../../features/workbook/domain/displayName'
import type { Workbook } from '../../../../features/workbook/domain/workbook'
import { YEAR_END_LINES } from '../../../../features/workbook/domain/yearEnd'
import type { YearEndLine, YearEndStatement } from '../../../../features/workbook/domain/yearEnd'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { ZERO, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { AccrualAdjustment } from '../accrual/accrualAdjustment'
import { withDrill } from '../accrual/accrualAdjustment'
import type { AccrualBooking } from '../accrual/accrualBookings'
import type { AccrualLine } from '../accrual/accrualLines'
import { accrualLine } from '../accrual/accrualYear'
import type { AccrualYear } from '../accrual/accrualYear'
import { kontoGroups } from '../accrual/closedYear'
import { COST_LINES, costLineOf } from '../accrual/costLines'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import { summed, tracedFigure } from '../payroll/payrollArithmetic'

/**
 * How one of the accountant's lines stands against ours. `matched` agrees with no adjustment
 * between the cash and the accrual view. `explained` agrees once the adjustments are made.
 * `judgement` agrees because it rests on an accountant's choice the ledger cannot show. `open`
 * leaves a residual, or the engine does not compute the line.
 */
export type LineStatus = 'matched' | 'explained' | 'judgement' | 'open'

export type ComparedStatement = Extract<YearEndStatement, 'pl' | 'balance' | 'tax' | 'grant'>

export interface ComparedLine {
  readonly statement: ComparedStatement
  readonly line: string
  readonly accountant: YearEndLine
  /** Null when the accrual engine does not compute the line. */
  readonly ours: AccrualLine | null
  /** The cash view's figure for the line, null where the cash view has none, such as most of the balance sheet. */
  readonly cash: TracedFigure | null
  /** The accountant's figure less the cash figure. */
  readonly difference: Money | null
  /** The adjustments that lead from the cash figure to ours on this line, and the judgements ours rests on. */
  readonly explainedBy: readonly AccrualAdjustment[]
  /** The accountant's figure less ours. Null for a rate or a count, which only agree or differ. */
  readonly residual: Money | null
  readonly status: LineStatus
}

/** What the ledger says about a date or a decision on the year-end tab. */
export interface LedgerCheck {
  readonly holds: boolean
  readonly finding: string
  readonly drill: DrillTarget | null
}

/** A date or a decision the ledger cannot give, with a check where the ledger can test it. */
export interface RecordedLine {
  readonly accountant: YearEndLine
  readonly check: LedgerCheck | null
}

export interface DistributionCheck {
  /** What the decision shares out: kept, paid out and put to reserves. */
  readonly shared: Money
  readonly profitAfterTax: Money
  readonly residual: Money
}

/** Konto lines that share a category, beside our accrual figure for those categories. */
export interface KontoComparison {
  readonly konto: readonly YearEndLine[]
  /**
   * Each category's accrual figure, a cost as a positive amount as the konto prints it, and after
   * it the small inventory its payments bought and the year wrote off.
   */
  readonly categories: readonly TracedFigure[]
  readonly accountant: Money
  readonly ours: Money
  /** The accountant's figure less ours. */
  readonly difference: Money
}

export interface YearEndComparison {
  readonly year: number
  /** In the order the package prints them. */
  readonly lines: readonly ComparedLine[]
  readonly recorded: readonly RecordedLine[]
  /** Null when the year-end tab holds no distribution amounts. */
  readonly distribution: DistributionCheck | null
  readonly konto: readonly KontoComparison[]
  /** Konto lines that name no category, so nothing of ours sits beside them. */
  readonly unnamedKonto: readonly YearEndLine[]
}

/**
 * The accountant's lines for the accrual year beside ours and beside the cash view. Dates and the
 * distribution decision are recorded, with a ledger check where one is possible. Konto lines are
 * grouped by the categories they share, since one category can sit on several of them.
 */
export function compareYearEnd(workbook: Workbook, accrual: AccrualYear): YearEndComparison {
  const { year } = accrual
  const accountant = workbook.yearEndLines.filter((line) => line.year === year)
  const order = (line: YearEndLine) => YEAR_END_LINES.findIndex((definition) => definition.statement === line.statement && definition.line === line.line)
  const ordered = accountant.filter((line) => line.statement !== 'konto').sort((left, right) => order(left) - order(right))
  const cash = cashFigures(workbook, accrual)

  const lines = ordered.flatMap((line): ComparedLine[] => {
    if (line.statement === 'konto' || line.statement === 'distribution' || line.figure.kind === 'date') {
      return []
    }
    return [compareLine(line, line.statement, accrual, cash.get(`${line.statement}:${line.line}`) ?? null)]
  })

  return {
    year,
    lines,
    recorded: ordered.filter((line) => line.statement === 'distribution' || line.figure.kind === 'date').map((line) => recordedLine(line, workbook, accrual)),
    distribution: distributionCheck(accountant, accrual),
    konto: kontoComparisons(accountant, workbook, accrual),
    unnamedKonto: accountant.filter((line) => line.statement === 'konto' && line.categories.length === 0),
  }
}

function compareLine(accountant: YearEndLine, statement: ComparedStatement, accrual: AccrualYear, cash: TracedFigure | null): ComparedLine {
  const ours = accrualLine(accrual, statement, accountant.line)
  const theirs = accountant.figure.kind === 'money' ? accountant.figure.amount : null
  const residual = theirs !== null && ours?.kind === 'money' ? subtractMoney(theirs, ours.figure.amount) : null
  const difference = theirs !== null && cash !== null ? subtractMoney(theirs, cash.amount) : null
  return {
    statement,
    line: accountant.line,
    accountant,
    ours,
    cash,
    difference,
    explainedBy: explainedBy(statement, accountant.line, ours, cash, accrual),
    residual,
    status: statusOf(accountant, ours, cash),
  }
}

function statusOf(accountant: YearEndLine, ours: AccrualLine | null, cash: TracedFigure | null): LineStatus {
  if (ours === null || !agrees(accountant, ours)) {
    return 'open'
  }
  if (ours.judgements.length > 0) {
    return 'judgement'
  }
  return cash !== null && accountant.figure.kind === 'money' && cash.amount !== accountant.figure.amount ? 'explained' : 'matched'
}

function agrees(accountant: YearEndLine, ours: AccrualLine): boolean {
  const { figure } = accountant
  return (
    (figure.kind === 'money' && ours.kind === 'money' && figure.amount === ours.figure.amount) ||
    (figure.kind === 'rate' && ours.kind === 'rate' && figure.basisPoints === ours.rate.basisPoints) ||
    (figure.kind === 'count' && ours.kind === 'count' && figure.count === ours.count)
  )
}

const PROFIT_LINES = new Set(['pl:profit-before-tax', 'pl:profit-after-tax', 'balance:profit-of-year'])
const AFTER_TAX_LINES = new Set(['pl:profit-after-tax', 'balance:profit-of-year'])

/**
 * The adjustments that name the line, those ours rests on as a judgement, and on a profit and
 * loss line with a cash figure the bridge steps over the categories counted there. A profit line
 * is explained by the whole bridge.
 */
function explainedBy(statement: ComparedStatement, line: string, ours: AccrualLine | null, cash: TracedFigure | null, accrual: AccrualYear): AccrualAdjustment[] {
  const key = `${statement}:${line}`
  const judgements = new Set(ours?.judgements ?? [])
  const bridge = new Set<AccrualAdjustment>([...accrual.bridge.steps, ...(AFTER_TAX_LINES.has(key) ? [accrual.bridge.corporateIncomeTax] : [])])
  const counted = new Set([...categoriesOf(cash), ...(ours?.kind === 'money' ? ours.figure.steps.flatMap(categoriesOf) : [])])
  return accrual.adjustments.filter((adjustment) => {
    if (adjustment.lines.some((ref) => ref.statement === statement && ref.line === line) || judgements.has(adjustment.id)) {
      return true
    }
    if (!bridge.has(adjustment)) {
      return false
    }
    return PROFIT_LINES.has(key) || (statement === 'pl' && cash !== null && categoriesOf(adjustment.figure).some((slug) => counted.has(slug)))
  })
}

function categoriesOf(figure: TracedFigure | null): readonly string[] {
  return figure?.drill?.filters.categories ?? []
}

/**
 * The cash view laid out on the year-end lines: every booking of the year on the line its
 * category counts on, costs as positive amounts, so the profit and loss lines add up to the
 * cash net. The balance sheet has only cash.
 */
function cashFigures(workbook: Workbook, accrual: AccrualYear): ReadonlyMap<string, TracedFigure> {
  const { year } = accrual
  const paidInYear = accrual.bookings.filter((entry) => yearOf(entry.booking.date) === year)
  const income = paidInYear.filter((entry) => entry.category.bucket === 'income')
  const costs = paidInYear.filter((entry) => entry.category.bucket !== 'income')
  const byCategory = (label: string, entries: readonly AccrualBooking[], sign: 1 | -1): TracedFigure => {
    const slugs = [...new Set(entries.map((entry) => entry.category.slug))]
    const steps = slugs.map((slug) => {
      const own = entries.filter((entry) => entry.category.slug === slug)
      const total = sumMoney(own.map((entry) => entry.booking.amount))
      const category = own[0]?.category
      return withDrill(tracedFigure(displayName(slug, category?.label ?? ''), sign === 1 ? total : negateMoney(total), 'ledger', []), yearDrill(year, [slug]))
    })
    return withDrill(summed(label, steps, 'ledger'), slugs.length === 0 ? null : yearDrill(year, slugs))
  }
  const nothing = tracedFigure('Nothing in the cash view', ZERO, 'ledger', [])
  const grantSlugs = categoriesWithRole(workbook.categories, PACK_ROLES.grant)
  const figures: [string, TracedFigure][] = [
    ['pl:sales', byCategory('Client payments received', income.filter((entry) => entry.treatment === 'revenue'), 1)],
    ['pl:own-use', nothing],
    ['pl:other-operating-income', byCategory('Other income received', income.filter((entry) => entry.treatment !== 'revenue'), 1)],
    ['pl:financial-income', nothing],
    ...COST_LINES.map((line): [string, TracedFigure] => [
      `pl:${line}`,
      byCategory('Paid in the year', costs.filter((entry) => costLineOf(entry.category, year, workbook.yearEndLines) === line), -1),
    ]),
    ['pl:profit-before-tax', accrual.bridge.cashNet],
    ['pl:profit-after-tax', accrual.bridge.cashNet],
    ['grant:released-in-year', byCategory('Grant received', income.filter((entry) => grantSlugs.includes(entry.category.slug)), 1)],
  ]
  const cash = accrualLine(accrual, 'balance', 'cash')
  if (cash?.kind === 'money') {
    figures.push(['balance:cash', cash.figure])
  }
  return new Map(figures)
}

function recordedLine(line: YearEndLine, workbook: Workbook, accrual: AccrualYear): RecordedLine {
  if (line.statement === 'tax' && line.line === 'paid-on' && line.figure.kind === 'date') {
    const day = line.figure.date
    const due = accrualLine(accrual, 'tax', 'balance-due')
    const slugs = categoriesWithRole(workbook.categories, PACK_ROLES.corporateIncomeTax)
    const paid = due?.kind === 'money' && workbook.transactions.some((row) => row.date === day && slugs.includes(row.category) && row.amount === negateMoney(due.figure.amount))
    return {
      accountant: line,
      check: {
        holds: paid,
        finding: paid ? 'The ledger pays our balance due on that day' : 'No corporate tax payment of our balance due on that day',
        drill: drillToTransactions({ period: { preset: 'custom', range: { from: day, to: day } }, categories: slugs }),
      },
    }
  }
  return { accountant: line, check: null }
}

function distributionCheck(accountant: readonly YearEndLine[], accrual: AccrualYear): DistributionCheck | null {
  const amounts = accountant.flatMap((line) => (line.statement === 'distribution' && line.figure.kind === 'money' ? [line.figure.amount] : []))
  const profit = accrualLine(accrual, 'pl', 'profit-after-tax')
  if (amounts.length === 0 || profit?.kind !== 'money') {
    return null
  }
  const shared = sumMoney(amounts)
  return { shared, profitAfterTax: profit.figure.amount, residual: subtractMoney(shared, profit.figure.amount) }
}

function kontoComparisons(accountant: readonly YearEndLine[], workbook: Workbook, accrual: AccrualYear): KontoComparison[] {
  const totals = new Map(accrual.categoryTotals.map((entry) => [entry.category.slug, entry]))
  const categories = new Map(workbook.categories.map((category) => [category.slug, category]))
  const konto = accountant.filter((line) => line.statement === 'konto')
  return kontoGroups(konto).map((group) => {
    const figures = group.categories.flatMap((slug) => {
      const total = totals.get(slug)
      const category = categories.get(slug)
      const name = displayName(slug, category?.label ?? '')
      const drill = total?.figure.drill ?? yearDrill(accrual.year, [slug])
      const amount = total === undefined ? ZERO : category?.bucket === 'income' ? total.figure.amount : negateMoney(total.figure.amount)
      const writtenOff = accrual.smallInventory.filter((entry) => entry.category === slug).map((entry) => entry.figure)
      return [
        withDrill(tracedFigure(name, amount, 'ledger', total?.figure.rules ?? []), drill),
        ...(writtenOff.length === 0 ? [] : [withDrill(summed(`${name}, small inventory written off`, writtenOff, 'assets'), drill)]),
      ]
    })
    const ours = sumMoney(figures.map((figure) => figure.amount))
    return {
      konto: group.konto.flatMap((id) => konto.filter((line) => line.line === id)),
      categories: figures,
      accountant: group.amount,
      ours,
      difference: subtractMoney(group.amount, ours),
    }
  })
}

function yearDrill(year: number, categories: readonly string[]): DrillTarget {
  return drillToTransactions({ period: { preset: 'year', year }, categories })
}
