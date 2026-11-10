import type { RouteLocationRaw } from 'vue-router'

import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import type { BridgeBar } from '../../../../../../shared/charts/bridgeChart'
import { absMoney, negateMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import type { DonutPart } from '../../../../../../shared/ui/DonutCard.vue'
import type { DrillTarget } from '../../../../filters/domain/drillTarget'
import type { Employee } from '../../domain/employees/employees'
import { PAY_PARTS, differenceFromBank, lastPaidOn, lineVerdict, peoplePay, problemEmployee, salaryMonthFigures } from '../../domain/salaries/salaryFigures'
import type { PayFigures, PayPart, PersonPay } from '../../domain/salaries/salaryFigures'
import type { EmployeeLine, EmployeePayday, LineCheck, SalaryPayday, SalaryProblem } from '../../domain/salaries/salaryReconciliation'
import { figureDetail } from '../tracedFigureView'
import type { AskableDetail } from '../tracedFigureView'
import { words } from './words'

type LinkOf = (drill: DrillTarget | null) => RouteLocationRaw | null

export const PAY_PART_LABELS: Readonly<Record<PayPart, string>> = words.parts

export const PAY_PART_COLOURS: Readonly<Record<PayPart, string>> = {
  employee: '--pay-employee',
  pensionSavings: '--pay-pension-savings',
  pension: '--pay-pension',
  incomeTax: '--pay-income-tax',
  health: '--pay-health',
}

const LINE_LABELS: Readonly<Record<EmployeeLine, string>> = words.lines

/** What a page shows: the newest payday the ledger has every row of, unless asked for another. */
export interface SalaryChoice {
  readonly payday: MonthKey
  /** The slug of one employee, or null for everyone paid on the payday. */
  readonly employee: string | null
}

export function employeeName(employee: Employee): string {
  return employee.name === '' ? employee.slug : employee.name
}

/** "Bank 0.12 more", or null when the bank says the same or has not paid it. */
function bankDifference(statedAmount: Money, bank: Money | null): string | null {
  const difference = differenceFromBank(statedAmount, bank)
  return difference === null ? null : words.bankDifference(formatMoney(absMoney(difference)), difference > 0)
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
  readonly app: AskableDetail | null
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
  readonly detail: AskableDetail | null
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
  readonly netDetail: AskableDetail | null
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
  readonly bridge: readonly BridgeBar<DrillTarget>[]
  /** Set when the view is one person's month. */
  readonly strip: PersonStrip | null
  readonly sections: readonly ReconciliationSection[]
  /** The lines both sources state. */
  readonly compared: number
  readonly agreeing: number
  readonly problems: readonly ProblemView[]
}

const DEFINITIONS = words.definitions

/** The month of one payday, for everyone paid on it or for one of them. */
export function salaryMonthView(payday: SalaryPayday, choice: SalaryChoice, partMonth: MonthKey, problemsLink: RouteLocationRaw, linkOf: LinkOf): SalaryMonthView {
  const label = monthLabel(payday.payday)
  const month = salaryMonthFigures(payday, choice.employee)
  const { figures, complete, bank, drills } = month
  const problems = month.problems.map((problem, index) => problemView(problem, index, label, linkOf))
  const single = month.people.length === 1 ? month.people[0] : undefined
  const paidWord = single === undefined ? words.tiles.paidToEmployees : words.tiles.paidToEmployee

  const tiles: TileView[] = [
    {
      label: words.tiles.companyCost,
      value: formatMoney(figures.cost),
      to: linkOf(bank.cost.drill),
      caption: bankDifference(figures.cost, bank.cost.total) ?? (complete ? words.tiles.costCaption(formatMoney(figures.employerCost), formatMoney(figures.beside)) : words.tiles.noSource),
      definition: DEFINITIONS.cost,
    },
    {
      label: paidWord,
      value: formatMoney(figures.paid),
      to: linkOf(bank.paid.drill),
      caption: bankDifference(figures.paid, bank.paid.total) ?? (complete ? words.tiles.paidCaption(formatMoney(figures.net), formatMoney(figures.beside)) : words.tiles.asBankPaid),
      definition: DEFINITIONS.paid,
    },
    {
      label: words.tiles.pensionSavings,
      value: formatMoney(figures.pensionPillarTwo),
      to: linkOf(bank.savings.drill),
      caption: bankDifference(figures.pensionPillarTwo, bank.savings.total) ?? words.tiles.ownFund,
      definition: DEFINITIONS.savings,
    },
    {
      label: words.tiles.toState,
      value: formatMoney(figures.toState),
      to: linkOf(bank.toState.drill),
      caption: bankDifference(figures.toState, bank.toState.total) ?? words.tiles.stateCaption,
      definition: DEFINITIONS.state,
    },
    {
      label: words.tiles.problems,
      value: String(problems.length),
      to: problems.length === 0 ? null : problemsLink,
      caption: problems.length === 0 ? words.tiles.agree : problems.length === 1 ? words.tiles.oneToResolve : words.tiles.toResolve,
      definition: DEFINITIONS.problems,
    },
  ]

  const parts = PAY_PARTS.map((part): DonutPart => ({ key: part, label: PAY_PART_LABELS[part], value: month.parts[part], colour: PAY_PART_COLOURS[part], to: linkOf(drills[part]) }))

  const sections: ReconciliationSection[] = [
    ...month.people.map((person) => {
      const name = employeeName(person.payday.employee)
      return {
        key: person.payday.employee.slug,
        title: name,
        lines: person.lines.map((check) => lineRow(check, words.sections.lineOf(name, LINE_LABELS[check.line], label), [name, label], linkOf)),
      }
    }),
    ...(month.contributions === null
      ? []
      : [
          {
            key: 'contributions',
            title: words.sections.contributions,
            lines: month.contributions.map((check) => lineRow(check, words.sections.contributionOf(LINE_LABELS[check.line], label), [label], linkOf)),
          },
        ]),
  ]

  return {
    payday: payday.payday,
    label,
    unpaid: payday.payday === partMonth,
    tiles,
    ring: {
      parts,
      total: figures.cost,
      description: words.ringDescription(formatMoney(figures.cost), label, parts.map((part) => `${part.label} ${formatMoney(part.value)}`).join(', ')),
      split: complete ? { net: figures.net, beside: figures.beside } : null,
    },
    bridge: bridgeBars(figures, drills),
    strip: single === undefined ? null : personStrip(single.payday, figures, label, linkOf),
    sections,
    compared: month.compared,
    agreeing: month.agreeing,
    problems,
  }
}

function lineRow<Line extends EmployeeLine>(check: LineCheck<Line>, subject: string, tellsApart: readonly string[], linkOf: LinkOf): LineRow {
  return {
    key: check.line,
    label: LINE_LABELS[check.line],
    app: check.app === null ? null : figureDetail(check.app, words.byApp(subject), tellsApart, linkOf, true),
    bank: check.bank === null ? null : { cents: check.bank.amount, to: linkOf(check.bank.drill) },
    verdict: lineVerdict(check),
  }
}

/** Gross II down to net, then up to what was paid. Each step that leaves the pay is paid to a payee whose rows a bar opens. */
function bridgeBars(figures: PayFigures, drills: Readonly<Record<PayPart, DrillTarget | null>>): BridgeBar<DrillTarget>[] {
  const leaves = (label: string, amount: Money, part: PayPart): BridgeBar<DrillTarget> => ({ label, kind: 'step', amount: negateMoney(amount), drill: drills[part] })
  return [
    { label: words.bridge.grossTwo, kind: 'total', amount: figures.employerCost, drill: null },
    leaves(words.bridge.health, figures.health, 'health'),
    { label: words.bridge.grossOne, kind: 'total', amount: figures.gross, drill: null },
    leaves(words.bridge.pillarOne, figures.pensionPillarOne, 'pension'),
    leaves(words.bridge.pillarTwo, figures.pensionPillarTwo, 'pensionSavings'),
    leaves(words.bridge.incomeTax, figures.incomeTax, 'incomeTax'),
    { label: words.bridge.net, kind: 'total', amount: figures.net, drill: null },
    { label: words.bridge.beside, kind: 'step', amount: figures.beside, drill: null },
    { label: words.bridge.paid, kind: 'total', amount: figures.paid, drill: drills.employee },
  ]
}

function personStrip(entry: EmployeePayday, figures: PayFigures, label: string, linkOf: LinkOf): PersonStrip {
  const paidOn = lastPaidOn(entry)
  const net = entry.lines.find((check) => check.line === 'net')?.app ?? null
  return {
    name: employeeName(entry.employee),
    gross: figures.gross,
    net: figures.net,
    paidOn: paidOn === null ? null : dayLabel(paidOn),
    netDetail: net === null ? null : figureDetail(net, words.grossToNetOf(employeeName(entry.employee), label), [employeeName(entry.employee), label], linkOf, true),
  }
}

function amountsText(check: LineCheck<string>): string {
  return [check.app === null ? null : words.amounts.app(formatMoney(check.app.amount)), check.bank === null ? null : words.amounts.bank(formatMoney(check.bank.amount))]
    .filter((part) => part !== null)
    .join(', ')
}

function problemView(problem: SalaryProblem, index: number, month: string, linkOf: LinkOf): ProblemView {
  const key = `${problem.kind}-${index}`
  const plain = { key, detail: null, rows: null, fact: false }
  const who = problemEmployee(problem)
  const name = who === null ? '' : employeeName(who)
  switch (problem.kind) {
    case 'line-differs': {
      const line = LINE_LABELS[problem.check.line]
      const subject = who === null ? words.problems.lineForEveryone(line, month) : words.problems.lineOf(name, line, month)
      return {
        ...plain,
        text: who === null ? words.problems.differsForEveryone(line, amountsText(problem.check)) : words.problems.differs(name, line, amountsText(problem.check)),
        detail: problem.check.app === null ? null : figureDetail(problem.check.app, words.problems.asApp(subject), who === null ? [month] : [name, month], linkOf, true),
        rows: linkOf(problem.check.bank?.drill ?? null),
      }
    }
    case 'engine-not-run':
      return { ...plain, text: words.problems.engineNotRun(name, problem.reason), fact: true }
    case 'no-account':
      return { ...plain, text: words.problems.noAccount(name), fact: true }
    case 'no-pay-rows':
      return { ...plain, text: words.problems.noPayRows(name, month) }
    case 'pay-to-no-employee':
      return { ...plain, text: words.problems.payToNoEmployee(formatMoney(problem.paid.amount)), rows: linkOf(problem.paid.drill), fact: true }
    case 'below-minimum-wage':
      return {
        ...plain,
        text: words.problems.belowMinimum(name, formatMoney(problem.warning.agreed.amount), formatMoney(problem.warning.minimum.amount)),
        detail: figureDetail(problem.warning.minimum, words.problems.minimumIn(name, month), [name, month], linkOf, true),
        fact: true,
      }
    case 'over-cap':
      return {
        ...plain,
        text: words.problems.overCap(name, problem.usage.payment, problem.usage.periodKey, formatMoney(problem.usage.excess.amount)),
        detail: figureDetail(problem.usage.paid, words.problems.againstCap(name, problem.usage.payment, problem.usage.periodKey), [name, problem.usage.periodKey], linkOf, true),
        rows: linkOf(problem.usage.paid.drill),
      }
    case 'needs-units':
      return {
        ...plain,
        text:
          problem.unit === 'event'
            ? words.problems.needsEvents(name, problem.payment, formatMoney(problem.paid.amount))
            : words.problems.needsTrip(name, problem.payment, formatMoney(problem.paid.amount)),
        rows: linkOf(problem.paid.drill),
      }
  }
}

/** One employee's row of the People tab. */
export interface PersonRow extends PersonPay {
  readonly slug: string
  readonly name: string
}

/** Everyone paid on the payday, then their total. */
export function peopleRows(payday: SalaryPayday): { readonly people: PersonRow[]; readonly total: PersonRow } {
  const { people, total } = peoplePay(payday)
  return {
    people: people.map(({ employee, pay }) => ({ ...pay, slug: employee.slug, name: employeeName(employee) })),
    total: { ...total, slug: 'total', name: words.everyone },
  }
}
