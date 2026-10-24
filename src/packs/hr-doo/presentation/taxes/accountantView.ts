import type { RouteLocationRaw } from 'vue-router'

import { yearOfMonth } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { DrillTarget } from '../../../../features/filters/domain/drillTarget'
import { planMonthLink } from '../../../../features/invoicing/presentation/invoicingLinks'
import type { AccountantDocuments, UnreadWorkbook } from '../../application/accountantDocuments'
import type { DocumentRefusal } from '../../domain/accountant/accountantDocument'
import { PAYOUT_WEEK_DAYS, salaryMonthChecks } from '../../domain/accountant/payrollReconciliation'
import type { FigureCheck, SalaryMonthCheck, SalaryRuleLine, SalaryRules } from '../../domain/accountant/payrollReconciliation'
import { vatMonthsOf, vatPeriods } from '../../domain/accountant/vatReconciliation'
import type { SaleProblem, VatPeriod } from '../../domain/accountant/vatReconciliation'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import { dayLabel } from '../../ruleset/presentation/ruleWording'

type LinkOf = (drill: DrillTarget | null) => RouteLocationRaw | null

/** A check of one row: passing, differing with the rows it compared to open, or a note such as a part month. */
interface CheckBadge {
  readonly key: string
  readonly label: string
  readonly tone: 'success' | 'error' | 'neutral'
  readonly to: RouteLocationRaw | null
  /** What a screen reader hears for a badge that opens rows, such as "Sep 2026, carry differs, open the rows". */
  readonly name: string
}

/** A figure the app works out, beside the rows it comes from. */
interface OurFigure {
  readonly cents: Money
  readonly to: RouteLocationRaw | null
}

export interface VatReturnRow {
  readonly key: string
  readonly month: string
  readonly kind: 'filed' | 'not-filed' | 'unread'
  /** What the return states, null unless it was read. */
  readonly sales: Money | null
  readonly inputVat: Money | null
  /** Carried forward, positive while the state owes the company, as ours reads. */
  readonly theirCarry: Money | null
  readonly ourCarry: OurFigure | null
  readonly badges: readonly CheckBadge[]
  /** A sales line that does not close, or why the file could not be read. */
  readonly notes: readonly string[]
}

/** A workbook line the ruleset works out otherwise. */
interface RuleLineView {
  readonly key: string
  readonly label: string
  readonly theirs: Money | null
  readonly ours: Money | null
}

export interface PayrollRow {
  readonly key: string
  readonly month: string
  readonly kind: 'read' | 'unread'
  readonly paidOn: string | null
  readonly gross: Money | null
  readonly stateTheirs: Money | null
  readonly stateOurs: OurFigure | null
  readonly employeeTheirs: Money | null
  readonly employeeOurs: OurFigure | null
  readonly badges: readonly CheckBadge[]
  readonly ruleLines: readonly RuleLineView[]
  readonly notes: readonly string[]
}

const SALE_PROBLEMS: Readonly<Record<NonNullable<SaleProblem>, string>> = {
  'no-invoice': 'is on no invoice of the invoices tab',
  'other-amount': 'differs from the invoice',
  'delivered-in-another-month': 'is an invoice delivered in another month',
}

const RULE_LINE_LABELS: Readonly<Record<SalaryRuleLine, string>> = {
  besideSalary: 'Payments beside the salary',
  employerCost: 'Gross II',
  health: 'Health insurance',
  gross: 'Gross I',
  pensionPillarOne: 'Pension, pillar I',
  pensionPillarTwo: 'Pension, pillar II',
  income: 'Income',
  personalAllowance: 'Personal allowance',
  taxableIncome: 'Taxable income',
  incomeTax: 'Income tax',
  net: 'Net salary',
  stateTake: 'To the state',
  paidToEmployee: 'To the employee',
  totalCompanyCost: 'Total cost',
  statedLowerRate: 'Rate in the tax note',
}

/** "Lokalni U, row 5: the lines do not add up to the total row", with the tab and row when the reader has them. */
function refusalText(refusal: DocumentRefusal): string {
  const where = [refusal.tab, refusal.row === null ? null : `row ${refusal.row}`].filter((part) => part !== null).join(', ')
  return where === '' ? refusal.reason : `${where}: ${refusal.reason}`
}

function unreadNote(unread: UnreadWorkbook): string {
  return `Could not read ${unread.name}. ${capitalised(refusalText(unread.refusal))}.`
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function badge(key: string, month: string, holds: boolean, words: readonly [string, string], to: RouteLocationRaw | null): CheckBadge {
  const label = holds ? words[0] : words[1]
  return { key, label, tone: holds ? 'success' : 'error', to: holds ? null : to, name: holds ? `${month}, ${label.toLowerCase()}` : `${month}, ${label.toLowerCase()}, open the rows` }
}

/**
 * The year's VAT returns, newest first: each filed period with its badges, each month between the
 * first and the last return without one, and each file that could not be read.
 */
export function vatReturnRows(workbook: HrDooWorkbook, documents: AccountantDocuments, year: number, linkOf: LinkOf): VatReturnRow[] {
  const months = vatMonthsOf(documents.filedVatPeriods, documents.vatReturns).filter((month) => yearOfMonth(month) === year)
  const rows = vatPeriods(workbook, documents.vatReturns, months).map((period) => vatRow(period, linkOf))
  const unread = documents.unread
    .filter((entry) => entry.kind === 'vat-return' && yearOfMonth(entry.period) === year)
    .map(
      (entry): VatReturnRow => ({
        key: entry.period,
        month: monthLabel(entry.period),
        kind: 'unread',
        sales: null,
        inputVat: null,
        theirCarry: null,
        ourCarry: null,
        badges: [{ key: 'unread', label: 'Could not read', tone: 'error', to: null, name: `${monthLabel(entry.period)}, could not read` }],
        notes: [unreadNote(entry)],
      }),
    )
  return [...rows, ...unread].sort((earlier, later) => later.key.localeCompare(earlier.key))
}

function vatRow(period: VatPeriod, linkOf: LinkOf): VatReturnRow {
  const month = monthLabel(period.period)
  if (period.kind === 'not-filed') {
    return { key: period.period, month, kind: 'not-filed', sales: null, inputVat: null, theirCarry: null, ourCarry: null, badges: [], notes: [] }
  }
  const { vatReturn } = period
  const carryTo = linkOf(period.ourCarry.drill)
  return {
    key: period.period,
    month,
    kind: 'filed',
    sales: sumMoney(vatReturn.salesOutsideEu.map((sale) => sale.amount)),
    inputVat: vatReturn.inputVat,
    theirCarry: period.theirCarry,
    ourCarry: { cents: period.ourCarry.amount, to: carryTo },
    badges: [
      badge('carry', month, period.carryHolds, ['Carry ok', 'Carry differs'], carryTo),
      badge('sales', month, period.salesHold, ['Sales ok', 'Sales differ'], planMonthLink(period.period)),
    ],
    notes: period.sales.flatMap((check) =>
      check.problem === null
        ? []
        : [
            `Sale ${check.sale.invoiceNumber}, ${formatMoney(check.sale.amount)} on the return, ${SALE_PROBLEMS[check.problem]}${check.invoice === null || check.problem !== 'other-amount' ? '' : `, which says ${formatMoney(check.invoice.amount)}`}.`,
          ],
    ),
  }
}

/** The year's salary workbooks by worked month, newest first, each against the bank and the ruleset, and each file that could not be read. */
export function payrollRows(workbook: HrDooWorkbook, documents: AccountantDocuments, year: number, linkOf: LinkOf): PayrollRow[] {
  const salaries = documents.salaries.filter((salary) => yearOfMonth(salary.workedMonth) === year)
  const rows = salaryMonthChecks(workbook, salaries).map((check) => payrollRow(check, linkOf))
  const unread = documents.unread
    .filter((entry) => entry.kind === 'salary' && yearOfMonth(entry.period) === year)
    .map(
      (entry): PayrollRow => ({
        key: entry.period,
        month: monthLabel(entry.period),
        kind: 'unread',
        paidOn: null,
        gross: null,
        stateTheirs: null,
        stateOurs: null,
        employeeTheirs: null,
        employeeOurs: null,
        badges: [{ key: 'unread', label: 'Could not read', tone: 'error', to: null, name: `${monthLabel(entry.period)}, could not read` }],
        ruleLines: [],
        notes: [unreadNote(entry)],
      }),
    )
  return [...rows, ...unread].sort((earlier, later) => later.key.localeCompare(earlier.key))
}

function payrollRow(check: SalaryMonthCheck, linkOf: LinkOf): PayrollRow {
  const { salary } = check
  const month = monthLabel(salary.workedMonth)
  const ours = (figure: FigureCheck): OurFigure => ({ cents: figure.ours.amount, to: linkOf(figure.ours.drill) })
  const state = ours(check.stateTake)
  const employee = ours(check.payout)
  const bankHolds = check.stateTake.holds && check.payout.holds
  const ruleLines = check.rules.kind === 'checked' ? check.rules.lines.filter((line) => line.verdict === 'fail') : []
  const corrected = check.rules.kind === 'checked' && check.rules.lines.some((line) => line.verdict === 'total-adds-gross-one')
  return {
    key: salary.workedMonth,
    month,
    kind: 'read',
    paidOn: dayLabel(salary.paidOn),
    gross: salary.gross,
    stateTheirs: check.stateTake.theirs,
    stateOurs: state,
    employeeTheirs: check.payout.theirs,
    employeeOurs: employee,
    badges: [badge('bank', month, bankHolds, ['Bank ok', 'Bank differs'], check.stateTake.holds ? employee.to : state.to), rulesBadge(month, check.rules)],
    ruleLines: ruleLines.map((line) => ({ key: line.line, label: RULE_LINE_LABELS[line.line], theirs: line.theirs, ours: line.ours })),
    notes: [
      ...(check.rules.kind === 'unknown-city' ? [`The city in the tax note: ${check.rules.problem}`] : []),
      ...(corrected ? ['The total adds gross I instead of gross II, and its two shares add up to ours.'] : []),
    ],
  }
}

function rulesBadge(month: string, rules: SalaryRules): CheckBadge {
  const label =
    rules.kind === 'part-month'
      ? 'Part month'
      : rules.kind === 'unknown-city'
        ? 'Rules not run'
        : rules.lines.some((line) => line.verdict === 'fail')
          ? 'Rules differ'
          : 'Rules ok'
  const tone = label === 'Rules ok' ? 'success' : label === 'Rules differ' ? 'error' : 'neutral'
  return { key: 'rules', label, tone, to: null, name: `${month}, ${label.toLowerCase()}` }
}

/** What the bank badge compares, for the card's subtitle. */
export const PAYOUT_WEEK = `within ${PAYOUT_WEEK_DAYS} days of the payout date`
