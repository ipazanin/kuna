import { drillToTransactions, rowDrill } from '../../../../features/filters/domain/drillTarget'
import type { Transaction } from '../../../../features/workbook/domain/workbook'
import { addDays, daysBetween, weekdaysBetween } from '../../../../shared/calendar/civilDate'
import { firstDayOf, lastDayOf } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { findLocalUnit } from '../../ruleset/localUnits'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { withDrill } from '../accrual/accrualAdjustment'
import { weekdaysEmployed } from '../employees/employees'
import type { HrDooWorkbook } from '../hrDooPart'
import { categoriesInBucket, payrollTaxCategories } from '../packRoles'
import { localRates } from '../payroll/incomeTax'
import type { EmployeeFacts } from '../payroll/incomeTax'
import { tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { payrollMonth } from '../payroll/payrollMonth'
import type { PayrollMonth } from '../payroll/payrollMonth'
import { outsidePayroll } from './salaryWorkbook'
import type { SalaryWorkbook } from './salaryWorkbook'

/** How many days either side of the payout date the salary's bank rows are looked for. */
export const PAYOUT_WEEK_DAYS = 5

/** A workbook figure against ours, and whether they are the same to the cent. */
export interface FigureCheck {
  readonly theirs: Money
  readonly ours: TracedFigure
  readonly holds: boolean
}

/** The workbook lines the ruleset checks, each named by the field it reads. */
export type SalaryRuleLine = keyof Pick<
  SalaryWorkbook,
  | 'besideSalary'
  | 'employerCost'
  | 'health'
  | 'gross'
  | 'pensionPillarOne'
  | 'pensionPillarTwo'
  | 'income'
  | 'personalAllowance'
  | 'taxableIncome'
  | 'incomeTax'
  | 'net'
  | 'stateTake'
  | 'paidToEmployee'
  | 'totalCompanyCost'
  | 'statedLowerRate'
>

/**
 * `total-adds-gross-one` is the one correction the accountant's workbooks are known to need: the
 * total adds gross I instead of gross II, while its two shares add up to our total.
 */
type SalaryRuleVerdict = 'pass' | 'fail' | 'total-adds-gross-one'

interface SalaryRuleCheck {
  readonly line: SalaryRuleLine
  readonly verdict: SalaryRuleVerdict
  /** The workbook's amount and the engine's, or null for a line that is not one amount. */
  readonly theirs: Money | null
  readonly ours: Money | null
}

/**
 * The workbook run through the payroll engine. A part month runs only at the director floor with
 * its days worked from the director's row, since the workbook holds neither the days nor an agreed
 * full-month gross. A city the ruleset has no rates for cannot run either.
 */
export type SalaryRules =
  | { readonly kind: 'checked'; readonly payroll: PayrollMonth; readonly lines: readonly SalaryRuleCheck[] }
  | { readonly kind: 'part-month' }
  | { readonly kind: 'unknown-city'; readonly problem: string }

export interface SalaryMonthCheck {
  readonly salary: SalaryWorkbook
  /** `- Država` against the taxes caused by owner pay in the payout week, dividend tax left out. */
  readonly stateTake: FigureCheck
  /** The employee's share less rent and refunds against the one owner-pay bank row of that amount in the payout week, as booked before any split. */
  readonly payout: FigureCheck
  readonly rules: SalaryRules
}

/** The lines the engine computes under the same name. */
const RULE_LINES: readonly (keyof PayrollMonth & SalaryRuleLine)[] = [
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
  'stateTake',
]

/**
 * Each salary workbook against the bank and against the ruleset. Rent and net salary share a
 * bucket and roles, so the payout is found by its amount, not its category. A dividend tax row is
 * also a tax caused by owner pay and can land in the same week, so the state's share leaves it out.
 * The payslips are the director's, so the dependants and a part month's days come from the
 * director's row.
 */
export function salaryMonthChecks(workbook: HrDooWorkbook, salaries: readonly SalaryWorkbook[], rules: RuleSource = ruleValue): SalaryMonthCheck[] {
  const { director } = workbook
  const stateCategories = payrollTaxCategories(workbook.categories)
  const ownerPayCategories = categoriesInBucket(workbook.categories, 'owner-pay')
  const wholeRows = [...new Map(workbook.transactions.map((row) => row.split?.whole ?? row).map((row) => [row.id, row] as const)).values()]
  return salaries.map((salary) => {
    const inWeek = (row: Transaction) => Math.abs(daysBetween(salary.paidOn, row.date)) <= PAYOUT_WEEK_DAYS
    const week = { preset: 'custom' as const, range: { from: addDays(salary.paidOn, -PAYOUT_WEEK_DAYS), to: addDays(salary.paidOn, PAYOUT_WEEK_DAYS) } }

    const stateRows = workbook.transactions.filter((row) => stateCategories.includes(row.category) && inWeek(row))
    const paidToState = withDrill(
      tracedFigure('Taxes and contributions paid in the payout week', negateMoney(sumMoney(stateRows.map((row) => row.amount))), 'ledger', []),
      drillToTransactions({ period: week, categories: stateCategories }),
    )

    const expected = subtractMoney(salary.paidToEmployee, outsidePayroll(salary))
    const payoutRow = wholeRows.find((row) => ownerPayCategories.includes(row.category) && inWeek(row) && row.amount === negateMoney(expected)) ?? null
    const paidOut =
      payoutRow === null
        ? withDrill(tracedFigure('No owner pay row of that amount in the payout week', ZERO, 'ledger', []), drillToTransactions({ period: week, categories: ownerPayCategories }))
        : withDrill({ ...tracedFigure('Paid to the employee on', negateMoney(payoutRow.amount), 'ledger', []), on: payoutRow.date }, rowDrill(payoutRow))

    return {
      salary,
      stateTake: { theirs: salary.stateTake, ours: paidToState, holds: paidToState.amount === salary.stateTake },
      payout: { theirs: expected, ours: paidOut, holds: payoutRow !== null },
      rules: salaryRules(
        salary,
        { dependants: director?.dependants ?? 0, director: true },
        director === null ? null : weekdaysEmployed(director, salary.workedMonth),
        rules,
      ),
    }
  })
}

/**
 * Every line of a salary workbook against the payroll engine, to the cent. The city comes from the
 * note on the tax line and pillar II from its own line. A salary noted as the director's minimum
 * base runs as an agreed gross of nothing, so the engine pays the floor. Rent and refunds are not
 * pay, so they count only in the total and in what the employee is paid.
 */
export function salaryRules(salary: SalaryWorkbook, person: Pick<EmployeeFacts, 'dependants' | 'director'>, daysWorked: number | null, rules: RuleSource = ruleValue): SalaryRules {
  const workingDaysInMonth = weekdaysBetween(firstDayOf(salary.workedMonth), lastDayOf(salary.workedMonth))
  const days = salary.partMonth ? daysWorked : workingDaysInMonth
  if (days === null || (salary.partMonth && !salary.directorMinimum)) {
    return { kind: 'part-month' }
  }
  const { unit, problem } = findLocalUnit(salary.residenceCity)
  if (unit === null) {
    return { kind: 'unknown-city', problem }
  }
  const facts = { residenceCity: salary.residenceCity, pensionPillarTwo: salary.pensionPillarTwo !== ZERO, director: person.director, dependants: person.dependants, birthYear: null }
  const payroll = payrollMonth(
    {
      workedMonth: salary.workedMonth,
      paidOn: salary.paidOn,
      agreedMonthlyGross: salary.directorMinimum ? ZERO : salary.gross,
      daysWorked: days,
      workingDaysInMonth,
      nontaxablePayments: salary.besideSalary.flatMap((payment) => (payment.kind === 'nontaxable' ? [{ payment: payment.payment, amount: payment.amount }] : [])),
      basis: 'accountant',
    },
    facts,
    rules,
  )
  const outside = outsidePayroll(salary)
  const verdict = (holds: boolean): SalaryRuleVerdict => (holds ? 'pass' : 'fail')
  const amounts = (line: SalaryRuleLine, theirs: Money, ours: Money): SalaryRuleCheck => ({ line, verdict: verdict(theirs === ours), theirs, ours })
  const engineTotal = addMoney(payroll.totalCompanyCost.amount, outside)
  const totalWithoutHealth = addMoney(addMoney(payroll.gross.amount, payroll.nontaxablePayments.amount), outside)
  const totalVerdict: SalaryRuleVerdict =
    salary.totalCompanyCost === engineTotal
      ? 'pass'
      : addMoney(salary.stateTake, salary.paidToEmployee) === engineTotal && salary.totalCompanyCost === totalWithoutHealth
        ? 'total-adds-gross-one'
        : 'fail'
  const lines: SalaryRuleCheck[] = [
    { line: 'besideSalary', verdict: verdict(salary.besideSalary.every((payment) => payment.kind !== 'unknown')), theirs: null, ours: null },
    ...RULE_LINES.map((line) => amounts(line, salary[line], payroll[line].amount)),
    amounts('paidToEmployee', salary.paidToEmployee, addMoney(payroll.paidToEmployee.amount, outside)),
    { line: 'totalCompanyCost', verdict: totalVerdict, theirs: salary.totalCompanyCost, ours: engineTotal },
    { line: 'statedLowerRate', verdict: verdict(localRates(salary.residenceCity, salary.paidOn, rules).lowerRate === salary.statedLowerRate), theirs: null, ours: null },
  ]
  return { kind: 'checked', payroll, lines }
}
