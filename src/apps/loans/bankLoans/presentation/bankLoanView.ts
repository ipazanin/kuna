import type { InstalmentStanding } from '../domain/instalmentPayments'
import { loanMoves, planYearsOnDay } from '../domain/planOnDay'
import type { InstalmentNote, PlanLineOnDay, PlanLineStatus, PlanYearOnDay } from '../domain/planOnDay'
import { fractionOf } from '../domain/yearlyRate'
import type { BalanceMove } from '../../balances/presentation/balanceChart'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { formatRate } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import { words, wordsFor } from './words'

/** One row of the plan as the table shows it. */
export interface PlanLineOnScreen extends Omit<PlanLineOnDay, 'status'> {
  /** "Paid", "Due", "Paid 8 Dec, 18 days late", "Paid 20 Nov, seen in your statement", "Not seen in your statement", "Extra payment" or "Extra payment, seen in your statement", in the language on screen. */
  readonly status: string
  /** Set on an instalment due long enough ago that your statement should show it, and does not. */
  readonly notSeen?: true
}

export interface PlanYearOnScreen extends Omit<PlanYearOnDay, 'lines'> {
  readonly lines: readonly PlanLineOnScreen[]
}

/** How an instalment stands in the loan's own words, or null for one counted as paid on its due date. */
function noteText(note: InstalmentNote | null, loanWords: typeof words): string | null {
  if (note === null) return null
  if (note.kind === 'not-seen') return loanWords.status.notSeen
  const day = shortDayLabel(note.paid)
  if (note.kind === 'recorded') return plural(loanWords.status.paidLate(note.daysLate, day), note.daysLate)
  return note.daysLate > 0 ? plural(loanWords.status.seenLate(note.daysLate, day), note.daysLate) : loanWords.status.seen(day)
}

function statusText(status: PlanLineStatus, loanWords: typeof words): string {
  if (status.kind === 'extra-payment') return status.seen ? loanWords.status.extraSeen : loanWords.status.extra
  if (status.kind === 'interim-interest') return status.paid ? loanWords.status.interimPaid : loanWords.status.interimDue
  return noteText(status.note, loanWords) ?? (status.paid ? loanWords.status.paid : loanWords.status.due)
}

/** The plan's years with each row's status in the loan's own words, each instalment as `standings` gives it and each extra payment on a day of `extrasSeen` as seen in your statement. */
export function planYearsOnScreen(book: BankLoanBook, day: CivilDate, standings: ReadonlyMap<CivilDate, InstalmentStanding>, extrasSeen: ReadonlySet<CivilDate> = new Set()): PlanYearOnScreen[] {
  const loanWords = wordsFor(book.loan.repayment)
  return planYearsOnDay(book, day, standings, extrasSeen).map((year) => ({
    ...year,
    lines: year.lines.map(({ status, ...line }) => ({
      ...line,
      status: statusText(status, loanWords),
      ...(status.kind === 'instalment' && status.note?.kind === 'not-seen' ? { notSeen: true as const } : {}),
    })),
  }))
}

/** What the balance chart marks on a bank loan, in the loan's own words. */
export function bankLoanMoves(book: BankLoanBook, day: CivilDate, standings: ReadonlyMap<CivilDate, InstalmentStanding>): BalanceMove[] {
  const loanWords = wordsFor(book.loan.repayment)
  return loanMoves(book, day, standings).map((move): BalanceMove => {
    if (move.kind === 'extra-payment') return { date: move.date, kind: loanWords.status.extra, amount: move.amount, note: '', effect: 'lowers' }
    if (move.kind === 'instalment') return { date: move.date, kind: loanWords.moves.instalment(move.number), amount: move.amount, note: noteText(move.note, loanWords) ?? '', effect: 'lowers' }
    const { period } = move
    return {
      date: move.date,
      kind: loanWords.moves.newRate(loanWords.changes.rate(formatRate(fractionOf(period.rate)), loanWords.changes.rateTypes[period.rateType])),
      amount: null,
      note: period.note,
      effect: 'rate',
    }
  })
}
