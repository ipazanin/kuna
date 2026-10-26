import { counterpartyIdentity } from '../../../../features/workbook/domain/counterpartyIdentity'
import { drillToTransactions, monthPeriod, rowDrill } from '../../../../features/filters/domain/drillTarget'
import { ledgerWindowOf } from '../../../../features/workbook/domain/workbook'
import type { Transaction } from '../../../../features/workbook/domain/workbook'
import { weekdaysBetween, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, firstDayOf, lastDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { fold, normaliseIban } from '../../../../shared/text/fold'
import { findLocalUnit } from '../../ruleset/localUnits'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { salaryRules } from '../accountant/payrollReconciliation'
import { outsidePayroll } from '../accountant/salaryWorkbook'
import type { SalaryWorkbook } from '../accountant/salaryWorkbook'
import { weekdaysEmployed } from '../employees/employees'
import type { Employee } from '../employees/employees'
import type { HrDooWorkbook } from '../hrDooPart'
import { PACK_ROLES, payrollTaxCategories, taxFreePaymentOf } from '../packRoles'
import { nontaxableUsage } from '../payroll/nontaxableUsage'
import type { NontaxablePaymentMade, NontaxableUsage } from '../payroll/nontaxableUsage'
import { summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { payrollMonth } from '../payroll/payrollMonth'
import type { PayrollMonth, PayrollWarning } from '../payroll/payrollMonth'
import { CONTRIBUTION_ACCOUNTS } from './contributionAccounts'

/** The lines of one employee's pay that the payslip and the engine both state, named as `PayrollMonth` names them. */
export const EMPLOYEE_LINES = [
  'employerCost',
  'health',
  'gross',
  'pensionPillarOne',
  'pensionPillarTwo',
  'income',
  'personalAllowance',
  'taxableIncome',
  'incomeTax',
  'net',
  'nontaxablePayments',
  'paidToEmployee',
] as const satisfies readonly (keyof PayrollMonth)[]

export type EmployeeLine = (typeof EMPLOYEE_LINES)[number]

/** What the payroll of a payday pays beside the employees' own pay, each line to its own payee, for everyone paid that day together. */
export const CONTRIBUTION_LINES = ['pensionPillarOne', 'pensionPillarTwo', 'health', 'incomeTax'] as const satisfies readonly EmployeeLine[]

export type ContributionLine = (typeof CONTRIBUTION_LINES)[number]

/** One line as each source states it. */
export interface LineCheck<Line extends string> {
  readonly line: Line
  /** Null without a payslip read. */
  readonly payslip: Money | null
  /** Null when the engine did not run, or cannot work the line out without the payslip. */
  readonly app: TracedFigure | null
  /** Null for a line the bank does not pay apart, or a payday the ledger has no rows for yet. */
  readonly bank: TracedFigure | null
  /** Whether the sources that state the line say the same to the cent. */
  readonly agrees: boolean
}

export type EngineRun = { readonly kind: 'run'; readonly months: readonly PayrollMonth[] } | { readonly kind: 'not-run'; readonly reason: string }

/** One employee on one payday. */
export interface EmployeePayday {
  readonly employee: Employee
  /** The payslips whose payout date falls in the payday's month, one per worked month. */
  readonly payslips: readonly SalaryWorkbook[]
  readonly engine: EngineRun
  /** The bank column is filled for what was paid to the employee only. */
  readonly lines: readonly LineCheck<EmployeeLine>[]
}

/** Something a person has to resolve, since no source wins over another. */
export type SalaryProblem =
  | { readonly kind: 'line-differs'; readonly employee: Employee | null; readonly check: LineCheck<EmployeeLine> }
  | { readonly kind: 'payslip-not-read'; readonly employee: Employee }
  | { readonly kind: 'payslip-of-no-employee'; readonly payslip: SalaryWorkbook }
  | { readonly kind: 'payslip-facts-differ'; readonly employee: Employee; readonly payslip: SalaryWorkbook; readonly fact: 'residence-city' | 'pension-pillar-2' }
  | { readonly kind: 'engine-not-run'; readonly employee: Employee; readonly reason: string }
  | { readonly kind: 'no-account'; readonly employee: Employee }
  | { readonly kind: 'no-pay-rows'; readonly employee: Employee }
  | { readonly kind: 'pay-to-no-employee'; readonly paid: TracedFigure }
  | { readonly kind: 'over-cap'; readonly employee: Employee; readonly usage: NontaxableUsage }
  | { readonly kind: 'below-minimum-wage'; readonly employee: Employee; readonly warning: PayrollWarning }

/** The month the bank paid a payroll in, with each employee paid then and the contributions of them all. */
export interface SalaryPayday {
  readonly payday: MonthKey
  readonly employees: readonly EmployeePayday[]
  /** The bank column holds the rows to each line's payee, for everyone paid on the payday together. */
  readonly contributions: readonly LineCheck<ContributionLine>[]
  readonly problems: readonly SalaryProblem[]
}

/** One employee's tax-free payments of a year paid in rows of their own, against their caps. */
export interface EmployeeExtras {
  readonly employee: Employee
  readonly year: number
  readonly usage: readonly NontaxableUsage[]
}

export interface SalaryReconciliation {
  /** Oldest first. */
  readonly paydays: readonly SalaryPayday[]
  readonly extras: readonly EmployeeExtras[]
}

/** A bank row that pays an employee, as booked, and the part of it in a pay category. */
interface PayPart {
  readonly part: Transaction
  readonly whole: Transaction
  readonly employee: Employee | null
}

/**
 * The payslips, the payroll engine and the bank, per payday month, employee and line. The bank
 * column comes from the ledger alone: what was paid to an employee is every row to one of their
 * accounts with a part in a `salary` or `tax-free:` category, as booked before any split, and each
 * contribution is the payroll tax rows to its payee, any other payee being the income tax. A
 * payslip belongs to the employee its tab names and to the month its payout date falls in. A month
 * without a payslip runs each employee on the agreed gross of their row, a director at least at the
 * floor, for the month before it, the month salaries are paid in arrears for.
 */
export function salaryReconciliation(workbook: HrDooWorkbook, payslips: readonly SalaryWorkbook[], rules: RuleSource = ruleValue): SalaryReconciliation {
  const window = ledgerWindowOf(workbook.transactions)
  if (window === null) {
    return { paydays: [], extras: [] }
  }
  const { employees, categories } = workbook
  const payCategories = categories.filter((category) => category.roles.includes(PACK_ROLES.salary) || taxFreePaymentOf(category) !== null).map((category) => category.slug)
  const taxCategories = payrollTaxCategories(categories)
  const byIban = new Map(employees.flatMap((employee) => employee.ibans.map((iban) => [iban, employee] as const)))
  const payParts: PayPart[] = workbook.transactions
    .filter((row) => payCategories.includes(row.category))
    .map((part) => {
      const whole = part.split?.whole ?? part
      return { part, whole, employee: byIban.get(normaliseIban(whole.counterpartyIban)) ?? null }
    })
  const taxRows = workbook.transactions.filter((row) => taxCategories.includes(row.category))
  const taxFree = new Map(
    categories.flatMap((category) => {
      const payment = taxFreePaymentOf(category)
      return payment === null ? [] : [[category.slug, payment] as const]
    }),
  )
  const extras = employees.flatMap((employee) => extrasOf(employee, payParts, taxFree, rules))
  const overCaps = extras.flatMap((extra) => extra.usage.filter((usage) => usage.excess.amount > 0).map((usage) => ({ payday: lastPaidMonth(usage), employee: extra.employee, usage })))
  const named = (payslip: SalaryWorkbook) => employees.find((employee) => employee.name !== '' && fold(employee.name) === fold(payslip.employeeName)) ?? null
  const inLedger = (month: MonthKey) => window.firstMonth <= month && month <= window.partMonth
  const expected = (employee: Employee, payday: MonthKey) =>
    window.firstCompleteMonth <= payday && payday <= window.lastCompleteMonth && weekdaysEmployed(employee, addMonths(payday, -1)) !== null

  const paydayMonths = [
    ...new Set([
      ...payParts.map((pay) => monthOf(pay.part.date)),
      ...taxRows.map((row) => monthOf(row.date)),
      ...payslips.map((payslip) => monthOf(payslip.paidOn)),
      ...employees.flatMap((employee) => monthsFrom(window.firstCompleteMonth, window.lastCompleteMonth).filter((payday) => expected(employee, payday))),
    ]),
  ]
    .filter(inLedger)
    .sort()

  const paydays = paydayMonths.map((payday): SalaryPayday => {
    const payslipsOfDay = payslips.filter((payslip) => monthOf(payslip.paidOn) === payday)
    const partsOfDay = payParts.filter((pay) => monthOf(pay.part.date) === payday)
    const people = employees.filter(
      (employee) => expected(employee, payday) || partsOfDay.some((pay) => pay.employee === employee) || payslipsOfDay.some((payslip) => named(payslip) === employee),
    )
    const unpaid = payday === window.partMonth
    const problems: SalaryProblem[] = payslipsOfDay.filter((payslip) => named(payslip) === null).map((payslip) => ({ kind: 'payslip-of-no-employee', payslip }))
    const employeePaydays = people.map((employee): EmployeePayday => {
      const own = payslipsOfDay.filter((payslip) => named(payslip) === employee)
      const engine = engineRun(employee, payday, own, rules)
      const bank = paidTo(employee, partsOfDay.filter((pay) => pay.employee === employee), payCategories, payday)
      if (own.length === 0) problems.push({ kind: 'payslip-not-read', employee })
      problems.push(...own.flatMap((payslip) => factsDiffering(employee, payslip)))
      if (engine.kind === 'not-run') problems.push({ kind: 'engine-not-run', employee, reason: engine.reason })
      else problems.push(...engine.months.flatMap((month) => month.warnings).map((warning): SalaryProblem => ({ kind: 'below-minimum-wage', employee, warning })))
      if (employee.ibans.length === 0) problems.push({ kind: 'no-account', employee })
      else if (bank === null && !unpaid) problems.push({ kind: 'no-pay-rows', employee })
      const lines = EMPLOYEE_LINES.map((line) =>
        lineCheck(
          line,
          own.length === 0 ? null : sumMoney(own.map((payslip) => payslipLine(payslip, line))),
          appLine(engine, line, own.length > 0),
          line === 'paidToEmployee' ? bank : null,
        ),
      )
      problems.push(...lines.filter((check) => !check.agrees).map((check): SalaryProblem => ({ kind: 'line-differs', employee, check })))
      return { employee, payslips: own, engine, lines }
    })
    const taxRowsOfDay = taxRows.filter((row) => monthOf(row.date) === payday)
    const employeeChecks = (line: ContributionLine) => employeePaydays.flatMap((entry) => entry.lines.filter((check) => check.line === line))
    const contributions = CONTRIBUTION_LINES.map((line) => {
      const checks = employeeChecks(line)
      const payslip = everyStated(checks.map((check) => check.payslip))
      const app = everyStated(checks.map((check) => check.app))
      const bank = unpaid && taxRowsOfDay.length === 0 ? null : paidToPayee(line, taxRowsOfDay, taxCategories, payday)
      return lineCheck(line, payslip === null ? null : sumMoney(payslip), app === null ? null : summedFigure(app), bank)
    })
    // A payslip that differs from the engine is the employee's problem already, so the company's line reports a bank that says the same as neither.
    const bankDiffers = (check: LineCheck<ContributionLine>) => !check.agrees && check.bank !== null && check.bank.amount !== check.payslip && check.bank.amount !== check.app?.amount
    problems.push(...contributions.filter(bankDiffers).map((check): SalaryProblem => ({ kind: 'line-differs', employee: null, check })))
    const strays = partsOfDay.filter((pay) => pay.employee === null)
    if (strays.length > 0) problems.push({ kind: 'pay-to-no-employee', paid: paidFigure('Paid to no employee on the employees tab', strays, payCategories, payday) })
    problems.push(...overCaps.filter((over) => over.payday === payday).map(({ employee, usage }): SalaryProblem => ({ kind: 'over-cap', employee, usage })))
    return { payday, employees: employeePaydays, contributions, problems }
  })
  return { paydays, extras }
}

/**
 * The engine on each payslip of the payday, with the payslip's own city, pillar II and payments,
 * or without a payslip on the row's agreed gross for the month before the payday.
 */
function engineRun(employee: Employee, payday: MonthKey, payslips: readonly SalaryWorkbook[], rules: RuleSource): EngineRun {
  if (payslips.length > 0) {
    const months: PayrollMonth[] = []
    for (const payslip of payslips) {
      const run = salaryRules(payslip, employee, weekdaysEmployed(employee, payslip.workedMonth), rules)
      if (run.kind === 'part-month') return { kind: 'not-run', reason: `${payslip.workedMonth} is a part month, which the engine works out only at the director floor with the days the employment dates give` }
      if (run.kind === 'unknown-city') return { kind: 'not-run', reason: `the city in the payslip's tax note: ${run.problem}` }
      months.push(run.payroll)
    }
    return { kind: 'run', months }
  }
  const worked = addMonths(payday, -1)
  const days = weekdaysEmployed(employee, worked)
  if (!employee.director && employee.agreedGross === null) return { kind: 'not-run', reason: 'the employees tab names no agreed_gross for an employee who is not the director' }
  if (employee.residenceCity === '') return { kind: 'not-run', reason: 'the employees tab names no residence_city' }
  if (days === null) return { kind: 'not-run', reason: `the employment does not reach into ${worked}` }
  const month = payrollMonth(
    {
      workedMonth: worked,
      paidOn: lastDayOf(payday),
      agreedMonthlyGross: employee.agreedGross ?? ZERO,
      daysWorked: days,
      workingDaysInMonth: weekdaysBetween(firstDayOf(worked), lastDayOf(worked)),
      nontaxablePayments: [],
      basis: 'assumption',
    },
    employee,
    rules,
  )
  return { kind: 'run', months: [month] }
}

/** The engine's line, null when it did not run, and for what was paid beside the salary when no payslip lists it. */
function appLine(engine: EngineRun, line: EmployeeLine, withPayslip: boolean): TracedFigure | null {
  if (engine.kind === 'not-run' || (!withPayslip && (line === 'nontaxablePayments' || line === 'paidToEmployee'))) {
    return null
  }
  return summedFigure(engine.months.map((month) => month[line]))
}

/** Tax-free payments are the ones the ruleset knows by name. What the employee is paid leaves out rent and refunds of costs, which ride on the same payroll and are not pay. */
function payslipLine(payslip: SalaryWorkbook, line: EmployeeLine): Money {
  switch (line) {
    case 'nontaxablePayments':
      return sumMoney(payslip.besideSalary.flatMap((payment) => (payment.kind === 'nontaxable' ? [payment.amount] : [])))
    case 'paidToEmployee':
      return subtractMoney(payslip.paidToEmployee, outsidePayroll(payslip))
    default:
      return payslip[line]
  }
}

function factsDiffering(employee: Employee, payslip: SalaryWorkbook): SalaryProblem[] {
  const city = findLocalUnit(payslip.residenceCity).unit
  const problems: SalaryProblem[] = []
  if (city === null || city !== findLocalUnit(employee.residenceCity).unit) problems.push({ kind: 'payslip-facts-differ', employee, payslip, fact: 'residence-city' })
  if ((payslip.pensionPillarTwo !== ZERO) !== employee.pensionPillarTwo) problems.push({ kind: 'payslip-facts-differ', employee, payslip, fact: 'pension-pillar-2' })
  return problems
}

/** What the bank paid to the employee, or null when no row reached them. */
function paidTo(employee: Employee, parts: readonly PayPart[], payCategories: readonly string[], payday: MonthKey): TracedFigure | null {
  return parts.length === 0 ? null : paidFigure(`Paid to ${employee.name === '' ? employee.slug : employee.name}`, parts, payCategories, payday)
}

/** The rows as booked, each once however many of its parts are pay. */
function paidFigure(label: string, parts: readonly PayPart[], payCategories: readonly string[], payday: MonthKey): TracedFigure {
  const wholes = [...new Map(parts.map((pay) => [pay.whole.id, pay.whole] as const)).values()]
  const steps = wholes.map((row) => withDrill({ ...tracedFigure('Paid on', negateMoney(row.amount), 'ledger', []), on: row.date }, rowDrill(row)))
  const counterparties = [...new Set(wholes.map((row) => counterpartyIdentity(row).key))]
  return withDrill(summed(label, steps, 'ledger'), drillToTransactions({ period: monthPeriod(payday), categories: [...payCategories], counterparties }))
}

const PAYEE_LINES: readonly (readonly [ContributionLine, string])[] = [
  ['pensionPillarOne', CONTRIBUTION_ACCOUNTS.pensionPillarOne],
  ['pensionPillarTwo', CONTRIBUTION_ACCOUNTS.pensionPillarTwo],
  ['health', CONTRIBUTION_ACCOUNTS.health],
]

const CONTRIBUTION_LABELS: Readonly<Record<ContributionLine, string>> = {
  pensionPillarOne: 'Paid to the state budget, pension pillar I',
  pensionPillarTwo: 'Paid to the pillar II account',
  health: 'Paid to the health insurance fund',
  incomeTax: 'Paid to the other payees, income tax',
}

function contributionLineOf(row: Transaction): ContributionLine {
  const iban = normaliseIban(row.counterpartyIban)
  return PAYEE_LINES.find(([, account]) => account === iban)?.[0] ?? 'incomeTax'
}

function paidToPayee(line: ContributionLine, rows: readonly Transaction[], taxCategories: readonly string[], payday: MonthKey): TracedFigure {
  const own = rows.filter((row) => contributionLineOf(row) === line)
  const steps = own.map((row) => withDrill({ ...tracedFigure('Paid on', negateMoney(row.amount), 'ledger', []), on: row.date }, rowDrill(row)))
  const counterparties = [...new Set(own.map((row) => counterpartyIdentity(row).key))]
  return withDrill(summed(CONTRIBUTION_LABELS[line], steps, 'ledger'), drillToTransactions({ period: monthPeriod(payday), categories: [...taxCategories], counterparties }))
}

/** Every value, or null when any is missing. With no one paid there is none, which sums to nothing. */
function everyStated<Value>(values: readonly (Value | null)[]): Value[] | null {
  const stated = values.flatMap((value) => (value === null ? [] : [value]))
  return stated.length < values.length ? null : stated
}

/** One figure, or the sum of several months' with each month a step. */
function summedFigure(figures: readonly TracedFigure[]): TracedFigure {
  const [only] = figures
  return figures.length === 1 && only !== undefined ? only : summed(only?.label ?? 'Sum', figures, only?.basis ?? 'ledger')
}

function lineCheck<Line extends string>(line: Line, payslip: Money | null, app: TracedFigure | null, bank: TracedFigure | null): LineCheck<Line> {
  const stated = [payslip, app?.amount ?? null, bank?.amount ?? null].filter((amount) => amount !== null)
  return { line, payslip, app, bank, agrees: stated.every((amount) => amount === stated[0]) }
}

/** The employee's rows in `tax-free:` categories, by year, against the caps. A credit, such as a bonus paid back, is not a payment and is left out. */
function extrasOf(employee: Employee, payParts: readonly PayPart[], taxFree: ReadonlyMap<string, string>, rules: RuleSource): EmployeeExtras[] {
  const made: NontaxablePaymentMade[] = payParts.flatMap((pay) => {
    const payment = taxFree.get(pay.part.category)
    return pay.employee === employee && payment !== undefined && pay.part.amount < 0 ? [{ payment, paidOn: pay.part.date, amount: negateMoney(pay.part.amount) }] : []
  })
  const years = [...new Set(made.map((payment) => yearOf(payment.paidOn)))].sort()
  return years.map((year) => ({ employee, year, usage: nontaxableUsage(made, year, 'ledger', rules) }))
}

/** The month of the last payment that a cap's period counts. */
function lastPaidMonth(usage: NontaxableUsage): MonthKey | null {
  const last = usage.paid.steps.reduce<CivilDate | null>((latest, step) => (step.on !== null && (latest === null || step.on > latest) ? step.on : latest), null)
  return last === null ? null : monthOf(last)
}
