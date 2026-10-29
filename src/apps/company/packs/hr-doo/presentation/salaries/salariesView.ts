import type { RouteLocationRaw } from 'vue-router'

import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import { yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { ZERO, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import type { DonutPart } from '../../../../../../shared/ui/DonutCard.vue'
import { drillToTransactions } from '../../../../filters/domain/drillTarget'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import type { Employee } from '../../domain/employees/employees'
import type { ContributionLine, EmployeeLine, EmployeePayday, LineCheck, SalaryPayday, SalaryProblem, SalaryReconciliation } from '../../domain/salaries/salaryReconciliation'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { BridgeBar } from '../bridgeChart'
import { figureDetail } from '../tracedFigureView'
import type { FigureDetail } from '../tracedFigureView'

type LinkOf = (drill: DrillTarget | null) => RouteLocationRaw | null

/** The five places a salary's cost goes, in the order the ring and the bars set them. */
export const PAY_PARTS = ['employee', 'pensionSavings', 'pension', 'incomeTax', 'health'] as const

export type PayPart = (typeof PAY_PARTS)[number]

export const PAY_PART_LABELS: Readonly<Record<PayPart, string>> = {
  employee: 'To the employee',
  pensionSavings: 'Pension savings, pillar II',
  pension: 'Pension insurance, pillar I',
  incomeTax: 'Income tax',
  health: 'Health insurance',
}

export const PAY_PART_COLOURS: Readonly<Record<PayPart, string>> = {
  employee: '--pay-employee',
  pensionSavings: '--pay-pension-savings',
  pension: '--pay-pension',
  incomeTax: '--pay-income-tax',
  health: '--pay-health',
}

const LINE_LABELS: Readonly<Record<EmployeeLine, string>> = {
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
  paidToEmployee: 'Paid to the employee',
}

/** The contribution line each part is paid on, for the parts the bank pays to a payee of their own. */
const PART_LINES: Readonly<Partial<Record<PayPart, ContributionLine>>> = {
  pensionSavings: 'pensionPillarTwo',
  pension: 'pensionPillarOne',
  incomeTax: 'incomeTax',
  health: 'health',
}

/** What a page shows: the newest payday the ledger has every row of, unless asked for another. */
export interface SalaryChoice {
  readonly payday: MonthKey
  /** The slug of one employee, or null for everyone paid on the payday. */
  readonly employee: string | null
}

export function employeeName(employee: Employee): string {
  return employee.name === '' ? employee.slug : employee.name
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

/** One employee's month as the page states it, every line from the engine, else the bank. */
interface PersonFigures {
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

/** A line no source states counts as nothing, and what was paid falls back on the net, so the parts still add up to the cost. */
function figuresOf(lines: readonly LineCheck<EmployeeLine>[]): PersonFigures {
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

function summedFigures(people: readonly PersonFigures[]): PersonFigures {
  const total = (field: keyof PersonFigures) => sumMoney(people.map((person) => person[field]))
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

function partValue(figures: PersonFigures, part: PayPart): Money {
  switch (part) {
    case 'employee':
      return figures.paid
    case 'pensionSavings':
      return figures.pensionPillarTwo
    case 'pension':
      return figures.pensionPillarOne
    case 'incomeTax':
      return figures.incomeTax
    case 'health':
      return figures.health
  }
}

/** "Bank 0.12 more", or null when the bank says the same or has not paid it. */
function bankDifference(statedAmount: Money, bank: Money | null): string | null {
  if (bank === null || bank === statedAmount) return null
  const difference = subtractMoney(bank, statedAmount)
  return `Bank ${formatMoney(Math.abs(difference))} ${difference > 0 ? 'more' : 'less'}`
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

/** The contribution lines whose bank column the view can set beside its figures: everyone's, or one employee's when no one else was paid. */
function contributionsIn(payday: SalaryPayday, employee: string | null): readonly LineCheck<ContributionLine>[] | null {
  return employee === null || payday.employees.length === 1 ? payday.contributions : null
}

export interface TileView {
  readonly label: string
  readonly value: string
  readonly to: RouteLocationRaw | null
  readonly caption: string
  readonly definition: string
}

export interface LineRow {
  readonly key: string
  readonly label: string
  readonly app: FigureDetail | null
  readonly bank: { readonly cents: Money; readonly to: RouteLocationRaw | null } | null
  /** Null for a line only one source states, which nothing compares. */
  readonly verdict: 'agrees' | 'differs' | null
}

export interface ReconciliationSection {
  readonly key: string
  readonly title: string
  readonly lines: readonly LineRow[]
}

export interface ProblemView {
  readonly key: string
  readonly text: string
  /** How the engine works the line out, when the problem is a line it states. */
  readonly detail: FigureDetail | null
  /** The bank rows behind it, when there are any. */
  readonly rows: RouteLocationRaw | null
  /** The fact to put right on the employees tab, when that is the fix. */
  readonly fact: boolean
}

export interface PersonStrip {
  readonly name: string
  readonly gross: Money
  readonly net: Money
  readonly paidOn: string | null
  readonly netDetail: FigureDetail | null
}

export interface SalaryMonthView {
  readonly payday: MonthKey
  readonly label: string
  /** The month still running, whose payroll may not be paid yet. */
  readonly unpaid: boolean
  readonly tiles: readonly TileView[]
  readonly ring: {
    readonly parts: readonly DonutPart[]
    readonly total: Money
    readonly description: string
    /** What reached the employees split into the net and what was paid beside it, or null while no source works a net out. */
    readonly split: { readonly net: Money; readonly beside: Money } | null
  }
  readonly bridge: readonly BridgeBar[]
  /** Set when the view is one person's month. */
  readonly strip: PersonStrip | null
  readonly sections: readonly ReconciliationSection[]
  /** The lines both sources state. */
  readonly compared: number
  readonly agreeing: number
  readonly problems: readonly ProblemView[]
}

const DEFINITIONS = {
  cost: 'Gross II, which is the gross salary with the health insurance the company pays on top of it, and every payment beside the salary such as a meal allowance.',
  paid: 'What reached the employee: the net salary and the tax-free payments beside it. Each figure is the app’s, or without it the bank’s, and the caption says when the bank paid otherwise.',
  savings: 'Pension pillar II, paid to the employee’s own pension fund. It is withheld from the gross salary, but it stays the employee’s money, so it is not counted as the state’s.',
  state: 'Pension pillar I, the income tax and the health insurance. Pillar II goes to the employee’s own fund and is left out.',
  problems: 'Every line on which the app and the bank do not say the same, and every source missing for a month that should have it. Neither source wins over the other.',
} as const

/** The month of one payday, for everyone paid on it or for one of them. */
export function salaryMonthView(payday: SalaryPayday, choice: SalaryChoice, partMonth: MonthKey, problemsLink: RouteLocationRaw, linkOf: LinkOf): SalaryMonthView {
  const label = monthLabel(payday.payday)
  const people = peopleIn(payday, choice.employee)
  const linesOf = new Map(people.map((entry) => [entry, linesWithBank(entry, payday)] as const))
  const each = people.map((entry) => figuresOf(linesOf.get(entry) ?? entry.lines))
  const figures = summedFigures(each)
  const complete = people.every((entry) => netStated(linesOf.get(entry) ?? entry.lines))
  const contributions = contributionsIn(payday, choice.employee)
  const bankOf = (line: ContributionLine): TracedFigure | null => contributions?.find((check) => check.line === line)?.bank ?? null
  const paidBank = people.map((entry) => entry.lines.find((check) => check.line === 'paidToEmployee')?.bank ?? null)
  const paidBankTotal = paidBank.every((bank) => bank === null) ? null : sumMoney(paidBank.map((bank) => bank?.amount ?? ZERO))
  const stateLines: readonly ContributionLine[] = ['pensionPillarOne', 'incomeTax', 'health']
  const stateBank = stateLines.map(bankOf)
  const stateBankTotal = stateBank.some((bank) => bank === null) ? null : sumMoney(stateBank.map((bank) => bank?.amount ?? ZERO))
  const savingsBank = bankOf('pensionPillarTwo')
  const costBankTotal = paidBankTotal === null || stateBankTotal === null || savingsBank === null ? null : sumMoney([paidBankTotal, stateBankTotal, savingsBank.amount])
  const problems = payday.problems.filter((problem) => inView(problem, choice.employee)).map((problem, index) => problemView(problem, index, label, linkOf))
  const single = people.length === 1 ? people[0] : undefined
  const paidWord = single === undefined ? 'Paid to the employees' : 'Paid to the employee'

  const tiles: TileView[] = [
    {
      label: 'Company cost',
      value: formatMoney(figures.cost),
      to: linkOf(drillOfAll([...paidBank, ...stateBank, savingsBank])),
      caption:
        bankDifference(figures.cost, costBankTotal) ??
        (complete ? `Gross II ${formatMoney(figures.employerCost)} and ${formatMoney(figures.beside)} beside the salary` : 'A salary no source works out is left out'),
      definition: DEFINITIONS.cost,
    },
    {
      label: paidWord,
      value: formatMoney(figures.paid),
      to: linkOf(drillOfAll(paidBank)),
      caption:
        bankDifference(figures.paid, paidBankTotal) ??
        (complete ? `Net ${formatMoney(figures.net)} and ${formatMoney(figures.beside)} beside it` : 'As the bank paid it where no source works the net out'),
      definition: DEFINITIONS.paid,
    },
    {
      label: 'Pension savings',
      value: formatMoney(figures.pensionPillarTwo),
      to: linkOf(savingsBank?.drill ?? null),
      caption: bankDifference(figures.pensionPillarTwo, savingsBank?.amount ?? null) ?? 'Pillar II, the employee’s own fund',
      definition: DEFINITIONS.savings,
    },
    {
      label: 'To the state',
      value: formatMoney(figures.toState),
      to: linkOf(drillOfAll(stateBank)),
      caption: bankDifference(figures.toState, stateBankTotal) ?? 'Pillar I, income tax and health',
      definition: DEFINITIONS.state,
    },
    {
      label: 'Problems',
      value: String(problems.length),
      to: problems.length === 0 ? null : problemsLink,
      caption: problems.length === 0 ? 'App and bank agree' : problems.length === 1 ? 'One to resolve, below' : 'To resolve, below',
      definition: DEFINITIONS.problems,
    },
  ]

  const parts = PAY_PARTS.map((part): DonutPart => {
    const line = PART_LINES[part]
    const drill = part === 'employee' ? drillOfAll(paidBank) : line === undefined ? null : (bankOf(line)?.drill ?? null)
    return { key: part, label: PAY_PART_LABELS[part], value: partValue(figures, part), colour: PAY_PART_COLOURS[part], to: linkOf(drill) }
  })

  const sections: ReconciliationSection[] = [
    ...people.map((entry) => ({
      key: entry.employee.slug,
      title: employeeName(entry.employee),
      lines: (linesOf.get(entry) ?? entry.lines).map((check) => lineRow(check, `${employeeName(entry.employee)}, ${LINE_LABELS[check.line].toLowerCase()} in ${label}`, linkOf)),
    })),
    ...(choice.employee === null && payday.employees.length > 1
      ? [
          {
            key: 'contributions',
            title: 'Contributions and tax, for everyone paid',
            lines: payday.contributions.map((check) => lineRow(check, `${LINE_LABELS[check.line]} for everyone paid in ${label}`, linkOf)),
          },
        ]
      : []),
  ]
  const rows = sections.flatMap((section) => section.lines)

  return {
    payday: payday.payday,
    label,
    unpaid: payday.payday === partMonth,
    tiles,
    ring: {
      parts,
      total: figures.cost,
      description: `Where the cost to the company of ${formatMoney(figures.cost)} went in ${label}: ` + parts.map((part) => `${part.label} ${formatMoney(part.value)}`).join(', ') + '.',
      split: complete ? { net: figures.net, beside: figures.beside } : null,
    },
    bridge: bridgeBars(figures, drillOfAll(paidBank), bankOf),
    strip: single === undefined ? null : personStrip(single, figures, label, linkOf),
    sections,
    compared: rows.filter((row) => row.verdict !== null).length,
    agreeing: rows.filter((row) => row.verdict === 'agrees').length,
    problems,
  }
}

function lineRow<Line extends EmployeeLine>(check: LineCheck<Line>, subject: string, linkOf: LinkOf): LineRow {
  return {
    key: check.line,
    label: LINE_LABELS[check.line],
    app: check.app === null ? null : figureDetail(check.app, `${subject}, as the app works it out from the employees tab and the ruleset.`, linkOf),
    bank: check.bank === null ? null : { cents: check.bank.amount, to: linkOf(check.bank.drill) },
    verdict: check.app === null || check.bank === null ? null : check.agrees ? 'agrees' : 'differs',
  }
}

/** Gross II down to net, then up to what was paid. Each step that leaves the pay is paid to a payee whose rows a bar opens. */
function bridgeBars(figures: PersonFigures, paidDrill: DrillTarget | null, bankOf: (line: ContributionLine) => TracedFigure | null): BridgeBar[] {
  const leaves = (label: string, amount: Money, line: ContributionLine): BridgeBar => ({ label, kind: 'step', amount: -amount, drill: bankOf(line)?.drill ?? null })
  return [
    { label: 'Gross II', kind: 'total', amount: figures.employerCost, drill: null },
    leaves('Health insurance', figures.health, 'health'),
    { label: 'Gross I', kind: 'total', amount: figures.gross, drill: null },
    leaves('Pension, pillar I', figures.pensionPillarOne, 'pensionPillarOne'),
    leaves('Pension, pillar II', figures.pensionPillarTwo, 'pensionPillarTwo'),
    leaves('Income tax', figures.incomeTax, 'incomeTax'),
    { label: 'Net salary', kind: 'total', amount: figures.net, drill: null },
    { label: 'Beside the salary', kind: 'step', amount: figures.beside, drill: null },
    { label: 'Paid', kind: 'total', amount: figures.paid, drill: paidDrill },
  ]
}

function personStrip(entry: EmployeePayday, figures: PersonFigures, label: string, linkOf: LinkOf): PersonStrip {
  const paid = entry.lines.find((check) => check.line === 'paidToEmployee')?.bank ?? null
  const paidOn = paid?.steps.reduce<CivilDate | null>((latest, step) => (step.on !== null && (latest === null || step.on > latest) ? step.on : latest), null) ?? null
  const net = entry.lines.find((check) => check.line === 'net')?.app ?? null
  return {
    name: employeeName(entry.employee),
    gross: figures.gross,
    net: figures.net,
    paidOn: paidOn === null ? null : dayLabel(paidOn),
    netDetail: net === null ? null : figureDetail(net, `${employeeName(entry.employee)} in ${label}, gross to net as the app works it out.`, linkOf),
  }
}

function problemEmployee(problem: SalaryProblem): Employee | null {
  return 'employee' in problem ? problem.employee : null
}

/** A company's problem shows for everyone, an employee's for everyone and for that employee. */
function inView(problem: SalaryProblem, employee: string | null): boolean {
  return employee === null || problemEmployee(problem)?.slug === employee
}

function amountsText(check: LineCheck<string>): string {
  return [check.app === null ? null : `app ${formatMoney(check.app.amount)}`, check.bank === null ? null : `bank ${formatMoney(check.bank.amount)}`].filter((part) => part !== null).join(', ')
}

function problemView(problem: SalaryProblem, index: number, month: string, linkOf: LinkOf): ProblemView {
  const key = `${problem.kind}-${index}`
  const plain = { key, detail: null, rows: null, fact: false }
  const who = problemEmployee(problem)
  const name = who === null ? '' : employeeName(who)
  switch (problem.kind) {
    case 'line-differs': {
      const line = LINE_LABELS[problem.check.line]
      const subject = who === null ? `${line} for everyone paid in ${month}` : `${name}, ${line.toLowerCase()} in ${month}`
      return {
        ...plain,
        text: `${who === null ? `${line}, everyone paid` : `${name}, ${line.toLowerCase()}`}: ${amountsText(problem.check)}.`,
        detail: problem.check.app === null ? null : figureDetail(problem.check.app, `${subject}, as the app works it out.`, linkOf),
        rows: linkOf(problem.check.bank?.drill ?? null),
      }
    }
    case 'engine-not-run':
      return { ...plain, text: `${name}: the app did not work the pay out, since ${problem.reason}.`, fact: true }
    case 'no-account':
      return { ...plain, text: `${name} has no account on the employees tab, so which bank rows paid them is not known.`, fact: true }
    case 'no-pay-rows':
      return { ...plain, text: `${name}: no row in a salary category paid their account in ${month}.` }
    case 'pay-to-no-employee':
      return { ...plain, text: `${formatMoney(problem.paid.amount)} in a salary category went to an account no employee names.`, rows: linkOf(problem.paid.drill), fact: true }
    case 'below-minimum-wage':
      return {
        ...plain,
        text: `${name}: the agreed gross ${formatMoney(problem.warning.agreed.amount)} is under the minimum wage of ${formatMoney(problem.warning.minimum.amount)} for a full month.`,
        detail: figureDetail(problem.warning.minimum, `${name}, the minimum wage in ${month}.`, linkOf),
        fact: true,
      }
    case 'over-cap':
      return {
        ...plain,
        text: `${name}: ${problem.usage.payment} paid in ${problem.usage.periodKey} is ${formatMoney(problem.usage.excess.amount)} over its tax-free cap, which is taxed as salary.`,
        detail: figureDetail(problem.usage.paid, `${name}, ${problem.usage.payment} in ${problem.usage.periodKey}, against its cap.`, linkOf),
        rows: linkOf(problem.usage.paid.drill),
      }
  }
}

/** One payday of a year for the chart and its table. */
export interface SalaryMonthRow {
  readonly payday: MonthKey
  readonly label: string
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
      const contributions = contributionsIn(payday, employee)
      const bankOf = (line: ContributionLine) => contributions?.find((check) => check.line === line)?.bank ?? null
      const paidDrill = drillOfAll(people.map((entry) => entry.lines.find((check) => check.line === 'paidToEmployee')?.bank ?? null))
      const parts = Object.fromEntries(PAY_PARTS.map((part) => [part, partValue(figures, part)])) as Record<PayPart, Money>
      const drills = Object.fromEntries(
        PAY_PARTS.map((part) => {
          const line = PART_LINES[part]
          return [part, part === 'employee' ? paidDrill : line === undefined ? null : (bankOf(line)?.drill ?? null)]
        }),
      ) as Record<PayPart, DrillTarget | null>
      return {
        payday: payday.payday,
        label: monthLabel(payday.payday),
        unpaid: payday.payday === partMonth,
        parts,
        cost: figures.cost,
        toState: figures.toState,
        problems: payday.problems.filter((problem) => inView(problem, employee)).length,
        drills,
      }
    })
}

/** One employee's row of the People tab. */
export interface PersonRow {
  readonly slug: string
  readonly name: string
  readonly gross: Money
  readonly net: Money
  readonly pensionSavings: Money
  readonly toState: Money
  readonly cost: Money
  readonly problems: number
}

/** Everyone paid on the payday, then their total. */
export function peopleRows(payday: SalaryPayday): { readonly people: PersonRow[]; readonly total: PersonRow } {
  const rowOf = (slug: string, name: string, figures: PersonFigures, problems: number): PersonRow => ({
    slug,
    name,
    gross: figures.gross,
    net: figures.net,
    pensionSavings: figures.pensionPillarTwo,
    toState: figures.toState,
    cost: figures.cost,
    problems,
  })
  const each = payday.employees.map((entry) => ({ entry, figures: figuresOf(linesWithBank(entry, payday)) }))
  return {
    people: each.map(({ entry, figures }) =>
      rowOf(entry.employee.slug, employeeName(entry.employee), figures, payday.problems.filter((problem) => problemEmployee(problem) === entry.employee).length),
    ),
    total: rowOf('total', 'Everyone', summedFigures(each.map(({ figures }) => figures)), payday.problems.length),
  }
}
