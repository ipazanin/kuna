import type { InstalmentStanding } from './instalmentPayments'
import { planYears } from './planYears'
import type { PlanLine, PlanYear } from './planYears'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'

/** How an instalment stands against what you recorded or your statement, apart from one counted as paid on its due date. */
export type InstalmentNote =
  | { readonly kind: 'not-seen' }
  /** The day it went out, by a late-instalment record or a linked statement row, and how many days after its due date. */
  | { readonly kind: 'recorded' | 'seen'; readonly paid: CivilDate; readonly daysLate: number }

/** How a row of the plan stands on the day. */
export type PlanLineStatus =
  | { readonly kind: 'extra-payment'; readonly seen: boolean }
  | { readonly kind: 'interim-interest'; readonly paid: boolean }
  /** Paid once its due date has come. The note says how it stands apart from that, or is null. */
  | { readonly kind: 'instalment'; readonly paid: boolean; readonly note: InstalmentNote | null }

export interface PlanLineOnDay extends PlanLine {
  readonly status: PlanLineStatus
}

export interface PlanYearOnDay extends Omit<PlanYear, 'lines'> {
  readonly lines: readonly PlanLineOnDay[]
}

/** What a balance chart marks on a bank loan: an instalment paid, an extra payment, or a new rate from a due date. */
export type LoanMove =
  | { readonly kind: 'instalment'; readonly date: CivilDate; readonly number: number; readonly amount: Money; readonly note: InstalmentNote | null }
  | { readonly kind: 'extra-payment'; readonly date: CivilDate; readonly amount: Money }
  | { readonly kind: 'rate'; readonly date: CivilDate; readonly period: RatePeriod }

function noteOf(due: CivilDate, standing: InstalmentStanding | undefined): InstalmentNote | null {
  if (standing === undefined || standing.standing === 'as-planned') return null
  if (standing.standing === 'not-seen') return { kind: 'not-seen' }
  return { kind: standing.standing, paid: standing.paid, daysLate: daysBetween(due, standing.paid) }
}

function statusOf(line: PlanLine, standing: InstalmentStanding | undefined, day: CivilDate, extrasSeen: ReadonlySet<CivilDate>): PlanLineStatus {
  if (line.kind === 'extra-payment') return { kind: 'extra-payment', seen: extrasSeen.has(line.date) }
  if (line.kind === 'interim-interest') return { kind: 'interim-interest', paid: line.date <= day }
  return { kind: 'instalment', paid: line.date <= day, note: noteOf(line.date, standing) }
}

/** The plan's years with how each row stands on the day, each instalment as `standings` gives it and each extra payment on a day of `extrasSeen` as seen in your statement. */
export function planYearsOnDay(book: BankLoanBook, day: CivilDate, standings: ReadonlyMap<CivilDate, InstalmentStanding>, extrasSeen: ReadonlySet<CivilDate> = new Set()): PlanYearOnDay[] {
  return planYears(book, day, standings).map((year) => ({
    ...year,
    lines: year.lines.map((line) => ({ ...line, status: statusOf(line, line.kind === 'instalment' ? standings.get(line.date) : undefined, day, extrasSeen) })),
  }))
}

/**
 * What the balance chart marks on a bank loan: each instalment due by the day, with how it stands against what you
 * recorded or your statement, each extra payment whenever it falls, and each rate from a due date after the first instalment.
 */
export function loanMoves(book: BankLoanBook, day: CivilDate, standings: ReadonlyMap<CivilDate, InstalmentStanding>): LoanMove[] {
  const paidMoves = (book.plan ?? []).flatMap((row): LoanMove[] => {
    if (row.kind === 'extra-payment') return [{ kind: 'extra-payment', date: row.date, amount: row.payment }]
    if (row.kind !== 'instalment' || row.number === null || row.date > day) return []
    return [{ kind: 'instalment', date: row.date, number: row.number, amount: row.payment, note: noteOf(row.date, standings.get(row.date)) }]
  })
  const rates = book.ratePeriods.filter((period) => period.from !== book.loan.firstInstalment).map((period): LoanMove => ({ kind: 'rate', date: period.from, period }))
  return [...paidMoves, ...rates]
}
