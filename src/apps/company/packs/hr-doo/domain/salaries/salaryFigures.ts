import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { ZERO, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { drillToTransactions } from '../../../../filters/domain/drillTarget'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import type { Employee } from '../employees/employees'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { ContributionLine, EmployeeLine, EmployeePayday, LineCheck, SalaryPayday, SalaryProblem, SalaryReconciliation } from './salaryReconciliation'

/** The five places a salary's cost goes, in the order the ring and the bars set them. */
export const PAY_PARTS = ['employee', 'pensionSavings', 'pension', 'incomeTax', 'health'] as const

export type PayPart = (typeof PAY_PARTS)[number]

/** One employee's month, or several together, every line from the engine, else the bank. */
export interface PayFigures {
  readonly employerCost: Money
  readonly health: Money
  readonly gross: Money
  readonly pensionPillarOne: Money
  readonly pensionPillarTwo: Money
  readonly incomeTax: Money
  readonly net: Money
  readonly paid: Money
  /** Paid beside the net salary, such as tax-free payments. Nothing while no source states the net. */
  readonly beside: Money
  /** What was paid to the employee, the pension pillars, the income tax and health, which is Gross II and what was paid beside the salary. */
  readonly cost: Money
  /** Pension pillar I, income tax and health, the state's share. Pillar II is the employee's savings. */
  readonly toState: Money
}

/** The years with a payday, newest first. */
export function paydayYears(reconciliation: SalaryReconciliation): number[] {
  return [...new Set(reconciliation.paydays.map((payday) => yearOfMonth(payday.payday)))].sort((earlier, later) => later - earlier)
}

/**
 * The payday a page opens on: the one asked for, or else the newest of the year asked for, and
 * without a year the newest that is not the month still running, since its rows may not all be in.
 */
export function chosenPayday(reconciliation: SalaryReconciliation, asked: { readonly year: number | null; readonly payday: string | null }, partMonth: MonthKey): SalaryPayday | null {
  const { paydays } = reconciliation
  const exact = paydays.find((payday) => payday.payday === asked.payday)
  if (exact !== undefined) return exact
  const inYear = asked.year === null ? paydays : paydays.filter((payday) => yearOfMonth(payday.payday) === asked.year)
  const settled = inYear.filter((payday) => payday.payday !== partMonth)
  return settled[settled.length - 1] ?? inYear[inYear.length - 1] ?? null
}

/** A line as the page states it: the engine's, else the bank's, or null when neither states it. */
function stated(check: LineCheck<string> | undefined): Money | null {
  return check?.app?.amount ?? check?.bank?.amount ?? null
}

/** Whether some source states the salary down to the net, which the cost and what was paid beside it rest on. */
function netStated(lines: readonly LineCheck<EmployeeLine>[]): boolean {
  return stated(lines.find((check) => check.line === 'net')) !== null && stated(lines.find((check) => check.line === 'employerCost')) !== null
}

/**
 * An employee's lines with the bank column of the contributions too, when they were the only one
 * paid that day, since the payees' rows are then theirs alone.
 */
function linesWithBank(entry: EmployeePayday, payday: SalaryPayday): readonly LineCheck<EmployeeLine>[] {
  if (payday.employees.length !== 1) return entry.lines
  return entry.lines.map((check) => {
    const company = payday.contributions.find((contribution) => contribution.line === check.line)
    return company === undefined ? check : { ...check, bank: company.bank, agrees: company.agrees }
  })
}

/** A line no source states counts as nothing, and what was paid falls back on the net, so the parts still add up to the cost. */
function figuresOf(lines: readonly LineCheck<EmployeeLine>[]): PayFigures {
  const line = (name: EmployeeLine) => stated(lines.find((check) => check.line === name))
  const health = line('health') ?? ZERO
  const pensionPillarOne = line('pensionPillarOne') ?? ZERO
  const pensionPillarTwo = line('pensionPillarTwo') ?? ZERO
  const incomeTax = line('incomeTax') ?? ZERO
  const net = line('net')
  const paid = line('paidToEmployee') ?? net ?? ZERO
  return {
    employerCost: line('employerCost') ?? ZERO,
    health,
    gross: line('gross') ?? ZERO,
    pensionPillarOne,
    pensionPillarTwo,
    incomeTax,
    net: net ?? ZERO,
    paid,
    beside: net === null ? ZERO : subtractMoney(paid, net),
    cost: sumMoney([paid, pensionPillarTwo, pensionPillarOne, incomeTax, health]),
    toState: sumMoney([pensionPillarOne, incomeTax, health]),
  }
}

function summedFigures(people: readonly PayFigures[]): PayFigures {
  const total = (field: keyof PayFigures) => sumMoney(people.map((person) => person[field]))
  return {
    employerCost: total('employerCost'),
    health: total('health'),
    gross: total('gross'),
    pensionPillarOne: total('pensionPillarOne'),
    pensionPillarTwo: total('pensionPillarTwo'),
    incomeTax: total('incomeTax'),
    net: total('net'),
    paid: total('paid'),
    beside: total('beside'),
    cost: total('cost'),
    toState: total('toState'),
  }
}

function partsOf(figures: PayFigures): Readonly<Record<PayPart, Money>> {
  return {
    employee: figures.paid,
    pensionSavings: figures.pensionPillarTwo,
    pension: figures.pensionPillarOne,
    incomeTax: figures.incomeTax,
    health: figures.health,
  }
}

/** Every bank figure's rows together, or null when none has rows. */
function drillOfAll(figures: readonly (TracedFigure | null)[]): DrillTarget | null {
  const drills = figures.flatMap((figure) => (figure?.drill ? [figure.drill] : []))
  const [first] = drills
  if (first === undefined) return null
  if (drills.length === 1) return first
  const listed = (key: 'categories' | 'counterparties') => [...new Set(drills.flatMap((drill) => drill.filters[key] ?? []))]
  return drillToTransactions({ ...first.filters, categories: listed('categories'), counterparties: listed('counterparties') })
}

/** The employees a view covers on its payday. */
function peopleIn(payday: SalaryPayday, employee: string | null): EmployeePayday[] {
  return payday.employees.filter((entry) => employee === null || entry.employee.slug === employee)
}

/** The contribution line's bank figure a view can set beside its figures: everyone's, or one employee's when no one else was paid. */
function bankOfContributions(payday: SalaryPayday, employee: string | null): (line: ContributionLine) => TracedFigure | null {
  const contributions = employee === null || payday.employees.length === 1 ? payday.contributions : null
  return (line) => contributions?.find((check) => check.line === line)?.bank ?? null
}

function paidByBank(people: readonly EmployeePayday[]): (TracedFigure | null)[] {
  return people.map((entry) => entry.lines.find((check) => check.line === 'paidToEmployee')?.bank ?? null)
}

/** The bank rows of each part, for the parts the bank pays to a payee of their own and what reached the employees. */
function partDrills(paid: readonly (TracedFigure | null)[], bankOf: (line: ContributionLine) => TracedFigure | null): Readonly<Record<PayPart, DrillTarget | null>> {
  return {
    employee: drillOfAll(paid),
    pensionSavings: bankOf('pensionPillarTwo')?.drill ?? null,
    pension: bankOf('pensionPillarOne')?.drill ?? null,
    incomeTax: bankOf('incomeTax')?.drill ?? null,
    health: bankOf('health')?.drill ?? null,
  }
}

export function problemEmployee(problem: SalaryProblem): Employee | null {
  return 'employee' in problem ? problem.employee : null
}

/** A company's problem shows for everyone, an employee's for everyone and for that employee. */
function inView(problem: SalaryProblem, employee: string | null): boolean {
  return employee === null || problemEmployee(problem)?.slug === employee
}

/** Null for a line only one source states, which nothing compares. */
export function lineVerdict(check: LineCheck<string>): 'agrees' | 'differs' | null {
  if (check.app === null || check.bank === null) return null
  return check.agrees ? 'agrees' : 'differs'
}

/** How much more the bank says than the stated amount, or null when it says the same or has not paid it. */
export function differenceFromBank(statedAmount: Money, bank: Money | null): Money | null {
  return bank === null || bank === statedAmount ? null : subtractMoney(bank, statedAmount)
}

/** The bank's side of one figure: its total, or null when the bank doesn't state all of it, and its rows. */
export interface BankFigure {
  readonly total: Money | null
  readonly drill: DrillTarget | null
}

/** One employee's lines as a month of pay shows them. */
export interface PersonLines {
  readonly payday: EmployeePayday
  readonly lines: readonly LineCheck<EmployeeLine>[]
}

/** The figures of one payday, for everyone paid on it or for one of them. */
export interface SalaryMonthFigures {
  readonly people: readonly PersonLines[]
  /** The contribution lines that stand apart from the people's own, or null when each person's lines hold them. */
  readonly contributions: readonly LineCheck<ContributionLine>[] | null
  readonly figures: PayFigures
  readonly parts: Readonly<Record<PayPart, Money>>
  /** The bank rows of each part. */
  readonly drills: Readonly<Record<PayPart, DrillTarget | null>>
  /** Whether a source states every person's salary down to the net. */
  readonly complete: boolean
  readonly bank: {
    readonly cost: BankFigure
    readonly paid: BankFigure
    readonly savings: BankFigure
    readonly toState: BankFigure
  }
  readonly problems: readonly SalaryProblem[]
  /** The lines both sources state. */
  readonly compared: number
  readonly agreeing: number
}

export function salaryMonthFigures(payday: SalaryPayday, employee: string | null): SalaryMonthFigures {
  const people = peopleIn(payday, employee).map((entry): PersonLines => ({ payday: entry, lines: linesWithBank(entry, payday) }))
  const figures = summedFigures(people.map((person) => figuresOf(person.lines)))
  const bankOf = bankOfContributions(payday, employee)
  const paidBank = paidByBank(people.map((person) => person.payday))
  const paidTotal = paidBank.every((bank) => bank === null) ? null : sumMoney(paidBank.map((bank) => bank?.amount ?? ZERO))
  const stateBank = (['pensionPillarOne', 'incomeTax', 'health'] as const).map(bankOf)
  const stateTotal = stateBank.some((bank) => bank === null) ? null : sumMoney(stateBank.map((bank) => bank?.amount ?? ZERO))
  const savingsBank = bankOf('pensionPillarTwo')
  const contributions = employee === null && payday.employees.length > 1 ? payday.contributions : null
  const shownLines: readonly LineCheck<string>[] = [...people.flatMap((person) => person.lines), ...(contributions ?? [])]
  return {
    people,
    contributions,
    figures,
    parts: partsOf(figures),
    drills: partDrills(paidBank, bankOf),
    complete: people.every((person) => netStated(person.lines)),
    bank: {
      cost: {
        total: paidTotal === null || stateTotal === null || savingsBank === null ? null : sumMoney([paidTotal, stateTotal, savingsBank.amount]),
        drill: drillOfAll([...paidBank, ...stateBank, savingsBank]),
      },
      paid: { total: paidTotal, drill: drillOfAll(paidBank) },
      savings: { total: savingsBank?.amount ?? null, drill: savingsBank?.drill ?? null },
      toState: { total: stateTotal, drill: drillOfAll(stateBank) },
    },
    problems: payday.problems.filter((problem) => inView(problem, employee)),
    compared: shownLines.filter((check) => lineVerdict(check) !== null).length,
    agreeing: shownLines.filter((check) => lineVerdict(check) === 'agrees').length,
  }
}

/** The latest day the bank paid the employee, or null before it has. */
export function lastPaidOn(entry: EmployeePayday): CivilDate | null {
  const paid = entry.lines.find((check) => check.line === 'paidToEmployee')?.bank ?? null
  return paid?.steps.reduce<CivilDate | null>((latest, step) => (step.on !== null && (latest === null || step.on > latest) ? step.on : latest), null) ?? null
}

/** One payday of a year for the chart and its table. */
export interface SalaryMonthRow {
  readonly payday: MonthKey
  readonly unpaid: boolean
  readonly parts: Readonly<Record<PayPart, Money>>
  readonly cost: Money
  readonly toState: Money
  readonly problems: number
  /** The bank rows of each part, for a bar of the chart. */
  readonly drills: Readonly<Record<PayPart, DrillTarget | null>>
}

/** Each payday of the year, for everyone or one employee. */
export function salaryYearRows(reconciliation: SalaryReconciliation, year: number, employee: string | null, partMonth: MonthKey): SalaryMonthRow[] {
  return reconciliation.paydays
    .filter((payday) => yearOfMonth(payday.payday) === year)
    .map((payday) => {
      const people = peopleIn(payday, employee)
      const figures = summedFigures(people.map((entry) => figuresOf(linesWithBank(entry, payday))))
      return {
        payday: payday.payday,
        unpaid: payday.payday === partMonth,
        parts: partsOf(figures),
        cost: figures.cost,
        toState: figures.toState,
        problems: payday.problems.filter((problem) => inView(problem, employee)).length,
        drills: partDrills(paidByBank(people), bankOfContributions(payday, employee)),
      }
    })
}

/** One employee's figures on a payday, or everyone's total. */
export interface PersonPay {
  readonly gross: Money
  readonly net: Money
  readonly pensionSavings: Money
  readonly toState: Money
  readonly cost: Money
  readonly problems: number
}

/** Everyone paid on the payday, then their total. */
export function peoplePay(payday: SalaryPayday): { readonly people: readonly { readonly employee: Employee; readonly pay: PersonPay }[]; readonly total: PersonPay } {
  const payOf = (figures: PayFigures, problems: number): PersonPay => ({
    gross: figures.gross,
    net: figures.net,
    pensionSavings: figures.pensionPillarTwo,
    toState: figures.toState,
    cost: figures.cost,
    problems,
  })
  const each = payday.employees.map((entry) => ({ entry, figures: figuresOf(linesWithBank(entry, payday)) }))
  return {
    people: each.map(({ entry, figures }) => ({
      employee: entry.employee,
      pay: payOf(figures, payday.problems.filter((problem) => problemEmployee(problem) === entry.employee).length),
    })),
    total: payOf(summedFigures(each.map(({ figures }) => figures)), payday.problems.length),
  }
}
