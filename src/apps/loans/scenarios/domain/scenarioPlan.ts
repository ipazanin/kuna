import { NO_COSTS, changeDate } from './loanScenario'
import type { LoanChange, LoanCosts, LoanScenario, OfferTerms } from './loanScenario'
import { dueDateOf, loanPlan } from '../../bankLoans/domain/loanPlan'
import type { PlanRow } from '../../bankLoans/domain/loanPlan'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { ExtraPayment } from '../../workbook/domain/extraPayment'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, RATE_PERIOD_RECORDS } from '../../workbook/domain/loanKinds'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import type { Money } from '../../../../shared/money/money'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'

/** What a scenario changes: a bank loan with its rate periods and extra payments, and what it costs beside its instalments. */
export interface ScenarioBase {
  readonly loan: BankLoan
  readonly ratePeriods: readonly RatePeriod[]
  readonly extraPayments: readonly ExtraPayment[]
  readonly costs: LoanCosts
}

/** A cost paid on a day, never borrowed. */
export interface DatedCost {
  readonly date: CivilDate
  readonly amount: Money
}

/** A scenario worked out: its rows oldest first, old loan then new after a move, and its costs. */
export interface ScenarioPlan {
  /** The loan the scenario starts from, whose subsidy and drawdown it keeps. */
  readonly loan: BankLoan
  readonly rows: readonly PlanRow[]
  readonly costs: readonly DatedCost[]
  /** The rate periods each part was worked out at, so a row's period says whether it is an estimate. */
  readonly periods: readonly RatePeriod[]
  /** The due date after whose instalment the scenario moves to another bank, or null. */
  readonly move: CivilDate | null
  /** The changes dated on or before today, which count from the first due date after it. */
  readonly passed: readonly LoanChange[]
  /** The earliest day the scenario's own extra payments or move repay principal early, or null. */
  readonly firstEarlyRepayment: CivilDate | null
}

/** Why a scenario cannot be worked out. */
export type ScenarioRefusal =
  | { readonly refused: 'not-a-due-date'; readonly date: CivilDate; readonly loan: string }
  | { readonly refused: 'rate-shares-day'; readonly date: CivilDate }
  | { readonly refused: 'no-first-rate'; readonly firstInstalment: CivilDate }
  | { readonly refused: 'move-not-before-payoff'; readonly on: CivilDate }
  | { readonly refused: 'two-moves' }

/** The loan as it stands, from its book, without working its plan out again. Null while the plan cannot be worked out. */
export function asItStands(book: BankLoanBook): ScenarioPlan | null {
  if (book.plan === null) return null
  return { loan: book.loan, rows: book.plan, costs: [], periods: book.ratePeriods, move: null, passed: [], firstEarlyRepayment: null }
}

/** An offer's terms as a bank loan named after its scenario, with no rate periods of its own, since its rate changes give them. */
export function offerBase(name: string, terms: OfferTerms): ScenarioBase {
  const { lender, principal, drawdown, firstInstalment, instalments, interimInterest, subsidy } = terms
  return {
    loan: { id: recordIdOf(BANK_LOAN_RECORDS, 'offer'), name, lender, principal, drawdown, firstInstalment, instalments, interimInterest, subsidy, note: '' },
    ratePeriods: [],
    extraPayments: [],
    costs: terms.costs,
  }
}

/** What a kept scenario starts from: its bank loan as the file has it, or its offer's terms. Null when the book has no such loan. */
export function scenarioBaseOf(scenario: LoanScenario, bankLoans: readonly BankLoanBook[]): ScenarioBase | null {
  const { start } = scenario
  if (start.kind === 'offer') return offerBase(scenario.name, start.terms)
  const book = bankLoans.find((candidate) => candidate.loan.id === start.loan)
  return book === undefined ? null : { ...book, costs: NO_COSTS }
}

/** The due date of each instalment of the loan as signed, counted from `anchor` as `dueDateOf` does. */
function dueDatesOf(loan: BankLoan, anchor: CivilDate = loan.firstInstalment): CivilDate[] {
  return Array.from({ length: loan.instalments }, (_, offset) => dueDateOf(loan, offset + 1, anchor))
}

/** The change moved to a later day. */
function movedTo(change: LoanChange, day: CivilDate): LoanChange {
  switch (change.kind) {
    case 'extra-payment':
      return { ...change, date: day }
    case 'regular-extra-payment':
    case 'rate-change':
      return { ...change, from: day }
    case 'move':
      return { ...change, on: day }
  }
}

/** The loan's periods with the rate changes laid over them: one on the day of a period replaces it. */
function withRateChanges(
  loan: BankLoan,
  dueDates: readonly CivilDate[],
  periods: readonly RatePeriod[],
  changes: readonly Extract<LoanChange, { kind: 'rate-change' }>[],
): RatePeriod[] | ScenarioRefusal {
  const dues = new Set(dueDates)
  const changed = new Set<CivilDate>()
  for (const change of changes) {
    if (!dues.has(change.from)) return { refused: 'not-a-due-date', date: change.from, loan: loan.name }
    if (changed.has(change.from)) return { refused: 'rate-shares-day', date: change.from }
    changed.add(change.from)
  }
  const laid = changes.map((change, index): RatePeriod => ({
    id: recordIdOf(RATE_PERIOD_RECORDS, `${loan.id}-scenario-${index}`),
    loan: loan.id,
    from: change.from,
    rate: change.rate,
    rateType: change.rateType,
    note: '',
  }))
  return [...periods.filter((period) => !changed.has(period.from)), ...laid].sort((earlier, later) => earlier.from.localeCompare(later.from))
}

/**
 * What the costs come to on their dates: the one-off amount on the start, the monthly amount with
 * every payment the loan schedules (its interim interest and each instalment), and the yearly amount
 * on the start and every 12 months after, once per started year of instalments.
 */
function datedCosts(costs: LoanCosts, start: CivilDate, rows: readonly PlanRow[]): DatedCost[] {
  const scheduled = rows.filter((row) => row.kind !== 'extra-payment')
  const years = Math.ceil(rows.filter((row) => row.kind === 'instalment').length / 12)
  return [
    ...(costs.upfront > 0 ? [{ date: start, amount: costs.upfront }] : []),
    ...(costs.monthly > 0 ? scheduled.map((row) => ({ date: row.date, amount: costs.monthly })) : []),
    ...(costs.yearly > 0 ? Array.from({ length: years }, (_, year) => ({ date: dayMonthsLater(start, 12 * year), amount: costs.yearly })) : []),
  ]
}

/**
 * Works out a scenario: the loan it starts from with its changes, through the same plan engine as a
 * bank loan. With `today`, a change dated on or before it counts from the first due date after it,
 * and a regular extra payment drops its payments by then, so the past stays as it was. Of the rate
 * changes by today only the latest still holds, and none when another rate change starts on that due
 * date. A rate change must start on a due date of the loan it applies to. A move happens after the
 * instalment due on its day: the rows of the old loan up to it, then a new loan drawn that day for
 * what is still owed, due on the old loan's due dates from the next one, with no interim interest and
 * no subsidy, at the move's rate. The changes after the move apply to the new loan. No row repays the
 * old balance, since the new bank does.
 */
export function scenarioPlan(base: ScenarioBase, changes: readonly LoanChange[], today: CivilDate | null): ScenarioPlan | ScenarioRefusal {
  const { loan } = base
  const dues = dueDatesOf(loan)
  const firstDueAfterToday = today === null ? null : (dues.find((due) => due > today) ?? null)
  const passed = today === null ? [] : changes.filter((change) => changeDate(change) <= today)
  const latestPassedRate = passed
    .filter((change) => change.kind === 'rate-change')
    .reduce<LoanChange | null>((latest, change) => (latest === null || change.from >= changeDate(latest) ? change : latest), null)
  const rateStartsOnFirstDue = changes.some((change) => change.kind === 'rate-change' && !passed.includes(change) && change.from === firstDueAfterToday)
  const effective = changes.flatMap((change): LoanChange[] => {
    if (!passed.includes(change) || change.kind === 'regular-extra-payment') return [change]
    if (change.kind === 'rate-change' && (change !== latestPassedRate || rateStartsOnFirstDue)) return []
    return firstDueAfterToday === null ? [] : [movedTo(change, firstDueAfterToday)]
  })

  const moves = effective.filter((change) => change.kind === 'move')
  if (moves.length > 1) return { refused: 'two-moves' }
  const move = moves[0] ?? null
  if (move !== null && !dues.includes(move.on)) return { refused: 'not-a-due-date', date: move.on, loan: loan.name }
  const beforeMove = (day: CivilDate): boolean => move === null || day <= move.on
  const keptInstalments = move === null ? loan.instalments : dues.indexOf(move.on) + 1
  const lastDue = dayMonthsLater(loan.firstInstalment, keptInstalments + (move?.instalments ?? 0) - 1)

  const paidEarly = effective.flatMap((change): Pick<ExtraPayment, 'date' | 'amount' | 'effect'>[] => {
    if (change.kind === 'extra-payment') return [change]
    if (change.kind !== 'regular-extra-payment') return []
    const step = change.every === 'month' ? 1 : 12
    const until = change.until === null || change.until > lastDue ? lastDue : change.until
    const days: CivilDate[] = []
    for (let count = 0; dayMonthsLater(change.from, step * count) <= until; count += 1) {
      days.push(dayMonthsLater(change.from, step * count))
    }
    return days.filter((day) => today === null || day > today).map((date) => ({ date, amount: change.amount, effect: change.effect }))
  })
  const extras = [...base.extraPayments, ...paidEarly.map((extra, index): ExtraPayment => ({ ...extra, id: recordIdOf(EXTRA_PAYMENT_RECORDS, `scenario-${index}`), loan: loan.id }))]
  const rateChanges = effective.filter((change) => change.kind === 'rate-change')

  const oldPeriods = withRateChanges(
    loan,
    dues,
    base.ratePeriods.filter((period) => beforeMove(period.from)),
    rateChanges.filter((change) => beforeMove(change.from)),
  )
  if ('refused' in oldPeriods) return oldPeriods
  if (!oldPeriods.some((period) => period.from === loan.firstInstalment)) return { refused: 'no-first-rate', firstInstalment: loan.firstInstalment }
  const oldRows = loanPlan(
    loan,
    oldPeriods,
    extras.filter((extra) => beforeMove(extra.date)),
  )
  const firstEarlyRepayment = [...paidEarly.map((extra) => extra.date), ...(move === null ? [] : [move.on])].reduce<CivilDate | null>(
    (earliest, day) => (earliest === null || day < earliest ? day : earliest),
    null,
  )
  if (move === null) {
    return { loan, rows: oldRows, costs: datedCosts(base.costs, loan.drawdown, oldRows), periods: oldPeriods, move: null, passed, firstEarlyRepayment }
  }

  const kept = oldRows.filter((row) => row.date <= move.on)
  const owed = kept.at(-1)?.balance ?? loan.principal
  if (owed === 0 || kept.length === oldRows.length) return { refused: 'move-not-before-payoff', on: move.on }
  const moved: BankLoan = {
    id: recordIdOf(BANK_LOAN_RECORDS, `${loan.id}-moved`),
    name: loan.name,
    lender: move.lender,
    principal: owed,
    drawdown: move.on,
    firstInstalment: dayMonthsLater(loan.firstInstalment, keptInstalments),
    instalments: move.instalments,
    interimInterest: null,
    subsidy: null,
    note: '',
  }
  const firstNewPeriod: RatePeriod = { id: recordIdOf(RATE_PERIOD_RECORDS, `${moved.id}-first`), loan: moved.id, from: moved.firstInstalment, rate: move.rate, rateType: move.rateType, note: '' }
  const newPeriods = withRateChanges(
    moved,
    dueDatesOf(moved, loan.firstInstalment),
    [firstNewPeriod],
    rateChanges.filter((change) => !beforeMove(change.from)),
  )
  if ('refused' in newPeriods) return newPeriods
  const newRows = loanPlan(
    moved,
    newPeriods,
    extras.filter((extra) => !beforeMove(extra.date)).map((extra) => ({ ...extra, loan: moved.id })),
    loan.firstInstalment,
  )
  return {
    loan,
    rows: [...kept, ...newRows],
    costs: [...datedCosts(base.costs, loan.drawdown, kept), ...datedCosts(move.costs, move.on, newRows)].sort((earlier, later) => earlier.date.localeCompare(later.date)),
    periods: [...oldPeriods, ...newPeriods],
    move: move.on,
    passed,
    firstEarlyRepayment,
  }
}
