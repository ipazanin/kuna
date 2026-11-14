import type { InstalmentStanding } from '../domain/instalmentPayments'
import { fractionOf } from '../domain/yearlyRate'
import { planYears } from '../domain/planYears'
import type { PlanLine, PlanYear } from '../domain/planYears'
import type { BalanceMove } from '../../balances/presentation/balanceChart'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { formatRate } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import { words, wordsFor } from './words'

/** One row of the plan as the table shows it. */
export interface PlanLineOnScreen extends PlanLine {
  /** "Paid", "Due", "Paid 8 Dec, 18 days late", "Paid 20 Nov, seen in your statement", "Not seen in your statement" or "Extra payment", in the language on screen. */
  readonly status: string
  /** Set on an instalment due long enough ago that your statement should show it, and does not. */
  readonly notSeen?: true
}

export interface PlanYearOnScreen extends Omit<PlanYear, 'lines'> {
  readonly lines: readonly PlanLineOnScreen[]
}

/** How an instalment stands in the loan's own words, or null for one counted as paid on its due date. */
function standingText(due: CivilDate, standing: InstalmentStanding | undefined, loanWords: typeof words): string | null {
  if (standing === undefined || standing.standing === 'as-planned') return null
  if (standing.standing === 'not-seen') return loanWords.status.notSeen
  const days = daysBetween(due, standing.paid)
  const day = shortDayLabel(standing.paid)
  if (standing.standing === 'recorded') return plural(loanWords.status.paidLate(days, day), days)
  return days > 0 ? plural(loanWords.status.seenLate(days, day), days) : loanWords.status.seen(day)
}

function statusOf(line: PlanLine, standing: InstalmentStanding | undefined, day: CivilDate, loanWords: typeof words): string {
  if (line.kind === 'extra-payment') return loanWords.status.extra
  if (line.kind === 'interim-interest') return line.date <= day ? loanWords.status.interimPaid : loanWords.status.interimDue
  return standingText(line.date, standing, loanWords) ?? (line.date <= day ? loanWords.status.paid : loanWords.status.due)
}

/** The plan's years with each row's status in the loan's own words, each instalment as `standings` gives it. */
export function planYearsOnScreen(book: BankLoanBook, day: CivilDate, standings: ReadonlyMap<CivilDate, InstalmentStanding>): PlanYearOnScreen[] {
  const loanWords = wordsFor(book.loan.repayment)
  return planYears(book, day, standings).map((year) => ({
    ...year,
    lines: year.lines.map((line) => {
      const standing = line.kind === 'instalment' ? standings.get(line.date) : undefined
      return { ...line, status: statusOf(line, standing, day, loanWords), ...(standing?.standing === 'not-seen' ? { notSeen: true as const } : {}) }
    }),
  }))
}

/**
 * What the balance chart marks on a bank loan: each instalment due by the day, as paid, with the day it
 * went out when it was late or how it stands against your statement, each extra payment whenever it
 * falls, and each rate from a due date after the first instalment.
 */
export function bankLoanMoves(book: BankLoanBook, day: CivilDate, standings: ReadonlyMap<CivilDate, InstalmentStanding>): BalanceMove[] {
  const loanWords = wordsFor(book.loan.repayment)
  const paidMoves = (book.plan ?? []).flatMap((row): BalanceMove[] => {
    if (row.kind === 'extra-payment') return [{ date: row.date, kind: loanWords.status.extra, amount: row.payment, note: '', effect: 'lowers' }]
    if (row.kind !== 'instalment' || row.number === null || row.date > day) return []
    return [{ date: row.date, kind: loanWords.moves.instalment(row.number), amount: row.payment, note: standingText(row.date, standings.get(row.date), loanWords) ?? '', effect: 'lowers' }]
  })
  const rates = book.ratePeriods
    .filter((period) => period.from !== book.loan.firstInstalment)
    .map((period): BalanceMove => ({
      date: period.from,
      kind: loanWords.moves.newRate(loanWords.changes.rate(formatRate(fractionOf(period.rate)), loanWords.changes.rateTypes[period.rateType])),
      amount: null,
      note: period.note,
      effect: 'rate',
    }))
  return [...paidMoves, ...rates]
}
