import { drillToTransactions } from '../../../../filters/domain/drillTarget'
import type { Category } from '../../../../workbook/domain/workbook'
import type { YearEndLine } from '../yearEnd/yearEnd'
import { civilDate } from '../../../../../../shared/calendar/civilDate'
import { yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import { ZERO, negateMoney, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { fewestMakingUp } from '../../../../../../shared/money/settleOpenRows'
import { naturalOrder } from '../../../../../../shared/text/naturalOrder'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { GrantYearCheck } from '../grants/grantRelease'
import { PACK_ROLES, categoriesWithRole } from '../packRoles'
import { deducted, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { AccrualAdjustment, AdjustmentId, YearEndLineRef } from './accrualAdjustment'
import { withDrill } from './accrualAdjustment'
import { bookingFigure, isCounted, keptInMonthPaid } from './accrualBookings'
import type { AccrualBooking, CountedBooking } from './accrualBookings'
import { words } from './words'

// For a closed year the accountant's figure wins where it rests on a choice the ledger cannot
// show. Each function here returns that choice as a judgement adjustment, or null when the
// accountant's figure agrees with ours or the year-end tab does not hold it.

/** The accountant's release of a year against our policy's, from the year-end tab's grant lines. */
export function grantScheduleJudgement(check: GrantYearCheck | null): AccrualAdjustment | null {
  const released = check?.released ?? null
  if (released === null || released.residual.amount === 0) {
    return null
  }
  return {
    id: 'grant-schedule',
    kind: 'judgement',
    effect: 'profit',
    figure: tracedFigure(words.closed.grantAsAccountant, released.residual.amount, 'accountant', released.residual.rules, [released.accountant, deducted(released.ours)]),
    lines: [
      { statement: 'grant', line: 'released-in-year' },
      { statement: 'grant', line: 'deferred-at-year-end' },
      { statement: 'pl', line: 'other-operating-income' },
    ],
  }
}

export interface ArrearsCutOff {
  readonly adjustment: AccrualAdjustment
  /** The bookings paid after the year that stay in the month they were paid. */
  readonly kept: ReadonlySet<CountedBooking>
}

/**
 * Bookings paid in arrears after a year that the accountant's konto lines leave out of it. For
 * each group of konto lines whose categories all carry the arrears role, the bookings moved back
 * into the year whose costs make up the difference exactly are kept in the month they were paid,
 * the fewest that do. A difference no set of them makes up stays unexplained. The cut-off of the
 * year before counts too, so the bookings it kept stay in this year.
 */
export function arrearsCutOff(bookings: readonly AccrualBooking[], year: number, yearEnd: readonly YearEndLine[], categories: readonly Category[]): ArrearsCutOff | null {
  const closing = keptAtYearEnd(bookings, year, yearEnd, categories)
  const opening = keptAtYearEnd(bookings, year - 1, yearEnd, categories)
  const kept = [...closing.map((step) => step.entry), ...opening.map((step) => step.entry)]
  if (kept.length === 0) {
    return null
  }
  const steps = [...closing.map((step) => step.figure), ...opening.map((step) => deducted({ ...step.figure, label: words.closed.keptLastYear(year - 1, step.entry.label) }))]
  const figure = withDrill(
    summed(words.closed.arrearsKept, steps, 'ledger'),
    drillToTransactions({
      period: { preset: 'custom', range: { from: civilDate(year, 1, 1), to: civilDate(year + 1, 12, 31) } },
      categories: [...new Set(kept.map((entry) => entry.category.slug))],
    }),
  )
  return {
    adjustment: { id: 'arrears-cut-off', kind: 'judgement', effect: 'profit', figure, lines: [{ statement: 'pl', line: 'profit-before-tax' }] },
    kept: new Set(kept),
  }
}

/** The bookings as the year's lines count them: by our policy, except those the cut-off keeps in the month they were paid. */
export function bookingsAfterCutOff(byPolicy: readonly AccrualBooking[], cutOff: ArrearsCutOff | null): readonly AccrualBooking[] {
  return byPolicy.map((entry) => (isCounted(entry) && cutOff?.kept.has(entry) === true ? keptInMonthPaid(entry) : entry))
}

interface KeptBooking {
  readonly entry: CountedBooking
  /** What keeping it out of the year adds to that year's profit. */
  readonly figure: TracedFigure
}

function keptAtYearEnd(bookings: readonly AccrualBooking[], year: number, yearEnd: readonly YearEndLine[], categories: readonly Category[]): KeptBooking[] {
  const arrears = new Set(categoriesWithRole(categories, PACK_ROLES.arrears))
  const groups = kontoGroups(yearEnd.filter((line) => line.year === year)).filter((group) => group.categories.every((slug) => arrears.has(slug)))
  const yearEndDay = civilDate(year, 12, 31)
  return groups.flatMap((group) => {
    const inGroup = bookings.filter(isCounted).filter((entry) => group.categories.includes(entry.category.slug))
    const ours = negateMoney(sumMoney(inGroup.flatMap((entry) => entry.shares.filter((share) => yearOfMonth(share.month) === year).map((share) => share.amount))))
    const difference = subtractMoney(ours, group.amount)
    if (difference === 0) {
      return []
    }
    const movedBack = inGroup
      .filter((entry) => entry.booking.date > yearEndDay && entry.shares.some((share) => yearOfMonth(share.month) === year))
      .sort((earlier, later) => earlier.booking.date.localeCompare(later.booking.date))
    const costOf = (entry: CountedBooking) => negateMoney(sumMoney(entry.shares.map((share) => share.amount)))
    return (fewestMakingUp(movedBack, costOf, difference) ?? []).map((entry) => {
      const label = words.closed.keptInMonth(group.konto.join(', '), year, entry.label)
      const cost = costOf(entry)
      return { entry, figure: bookingFigure(entry, cost, label, entry.vat.cost.rules) }
    })
  })
}

/**
 * Representation as the accountant booked it on konto lines whose categories all carry the
 * representation role. A foreign card payment is booked at the day's exchange rate with the rest
 * as an exchange loss, which the bank amount cannot show, and only the booked part is added back.
 */
export function representationAsBooked(year: number, yearEnd: readonly YearEndLine[], categories: readonly Category[], ours: TracedFigure): AccrualAdjustment | null {
  const representation = new Set(categoriesWithRole(categories, PACK_ROLES.representation))
  const booked = kontoLinesOf(yearEnd, year).filter((line) => line.categories.length > 0 && line.categories.every((slug) => representation.has(slug)))
  if (booked.length === 0) {
    return null
  }
  const accountant = summed(words.closed.representationOn(booked.map((line) => line.line).join(', ')), booked.map(accountantFigure), 'accountant')
  const difference = subtractMoney(accountant.amount, ours.amount)
  if (difference === 0) {
    return null
  }
  return {
    id: 'representation-as-booked',
    kind: 'judgement',
    effect: 'tax-base',
    figure: tracedFigure(words.closed.representationAsBooked, difference, 'accountant', ours.rules, [accountant, deducted(ours)]),
    lines: [{ statement: 'tax', line: 'increases' }],
  }
}

export interface Placement {
  readonly adjustment: AccrualAdjustment
  /** What the placement adds to each line it moves. */
  readonly moves: ReadonlyMap<string, Money>
}

/**
 * The accountant's split of a group of lines whose total agrees with ours, such as the cost lines
 * or the liabilities. Profit and the total stay as they are. A group whose total differs is left
 * alone, so its lines show what is unexplained.
 */
export function placementJudgement(
  id: Extract<AdjustmentId, 'cost-placement' | 'liability-placement' | 'receivable-placement'>,
  label: string,
  statement: YearEndLineRef['statement'],
  ours: ReadonlyMap<string, Money>,
  year: number,
  yearEnd: readonly YearEndLine[],
): Placement | null {
  const accountant = new Map(
    yearEnd
      .filter((line) => line.year === year && line.statement === statement && ours.has(line.line) && line.figure.kind === 'money')
      .map((line) => [line.line, line.figure.kind === 'money' ? line.figure.amount : ZERO]),
  )
  const lineIds = [...ours.keys()].filter((line) => accountant.has(line))
  if (lineIds.length < 2) {
    return null
  }
  const total = (amounts: (line: string) => Money) => sumMoney(lineIds.map(amounts))
  const oursOf = (line: string) => ours.get(line) ?? ZERO
  const theirsOf = (line: string) => accountant.get(line) ?? ZERO
  if (total(oursOf) !== total(theirsOf)) {
    return null
  }
  const moves = new Map(lineIds.map((line) => [line, subtractMoney(theirsOf(line), oursOf(line))] as const).filter(([, move]) => move !== 0))
  if (moves.size === 0) {
    return null
  }
  const steps = [...moves].map(([line, move]) => tracedFigure(ontoLabel(line), move, 'accountant', []))
  return {
    adjustment: {
      id,
      kind: 'judgement',
      effect: 'placement',
      figure: tracedFigure(label, sumMoney(steps.map((step) => step.amount)), 'accountant', rulesOf(steps), steps),
      lines: [...moves.keys()].map((line) => ({ statement, line })),
    },
    moves,
  }
}

/** What an adjustment adds to one line: a placement's move onto it, or the adjustment's own amount. */
export function amountOnLine(adjustment: AccrualAdjustment, line: string): Money {
  if (adjustment.effect !== 'placement') {
    return adjustment.figure.amount
  }
  return adjustment.figure.steps.find((step) => step.label === ontoLabel(line))?.amount ?? ZERO
}

function ontoLabel(line: string): string {
  return words.closed.onto(line)
}

export interface KontoGroup {
  readonly konto: readonly string[]
  readonly categories: readonly string[]
  readonly amount: Money
}

/** Konto lines that share a category, joined, so each group holds every konto line of its categories. Lines go by their konto number. */
export function kontoGroups(yearEnd: readonly YearEndLine[]): KontoGroup[] {
  const lines = yearEnd.filter((line) => line.statement === 'konto' && line.categories.length > 0 && line.figure.kind === 'money').sort(byKonto)
  const groups: { categories: Set<string>; lines: YearEndLine[] }[] = []
  for (const line of lines) {
    const joined = groups.filter((group) => line.categories.some((slug) => group.categories.has(slug)))
    const merged = { categories: new Set(line.categories), lines: [line] }
    for (const group of joined) {
      group.categories.forEach((slug) => merged.categories.add(slug))
      merged.lines.unshift(...group.lines)
      groups.splice(groups.indexOf(group), 1)
    }
    groups.push(merged)
  }
  return groups.map((group) => ({
    konto: [...group.lines].sort(byKonto).map((line) => line.line),
    categories: [...group.categories],
    amount: sumMoney(group.lines.map((line) => (line.figure.kind === 'money' ? line.figure.amount : ZERO))),
  }))
}

/** A year's konto lines that hold an amount, by konto number. */
function kontoLinesOf(yearEnd: readonly YearEndLine[], year: number): YearEndLine[] {
  return yearEnd.filter((line) => line.year === year && line.statement === 'konto' && line.figure.kind === 'money').sort(byKonto)
}

function byKonto(earlier: YearEndLine, later: YearEndLine): number {
  return naturalOrder(earlier.line, later.line)
}

function accountantFigure(line: YearEndLine): TracedFigure {
  return tracedFigure(`Konto ${line.line}, ${line.label}`, line.figure.kind === 'money' ? line.figure.amount : ZERO, 'accountant', [])
}
