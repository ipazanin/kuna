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
  /** "Paid", "Due", "Paid 8 Dec, 18 days late" or "Extra payment", in the language on screen. */
  readonly status: string
}

export interface PlanYearOnScreen extends Omit<PlanYear, 'lines'> {
  readonly lines: readonly PlanLineOnScreen[]
}

function statusOf(line: PlanLine, paidLate: CivilDate | undefined, day: CivilDate, loanWords: typeof words): string {
  if (line.kind === 'extra-payment') return loanWords.status.extra
  if (line.kind === 'interim-interest') return line.date <= day ? loanWords.status.interimPaid : loanWords.status.interimDue
  if (paidLate !== undefined) {
    const days = daysBetween(line.date, paidLate)
    return plural(loanWords.status.paidLate(days, shortDayLabel(paidLate)), days)
  }
  return line.date <= day ? loanWords.status.paid : loanWords.status.due
}

/** The plan's years with each row's status in the loan's own words. */
export function planYearsOnScreen(book: BankLoanBook, day: CivilDate): PlanYearOnScreen[] {
  const loanWords = wordsFor(book.loan.repayment)
  const paidLate = new Map(book.lateInstalments.map((late) => [late.due, late.paid]))
  return planYears(book, day).map((year) => ({
    ...year,
    lines: year.lines.map((line) => ({ ...line, status: statusOf(line, line.kind === 'instalment' ? paidLate.get(line.date) : undefined, day, loanWords) })),
  }))
}

/**
 * What the balance chart marks on a bank loan: each instalment due by the day, as paid, with the day it
 * went out when it was late, each extra payment whenever it falls, and each rate from a due date after
 * the first instalment.
 */
export function bankLoanMoves(book: BankLoanBook, day: CivilDate): BalanceMove[] {
  const loanWords = wordsFor(book.loan.repayment)
  const paidLate = new Map(book.lateInstalments.map((late) => [late.due, late.paid]))
  const payments = (book.plan ?? []).flatMap((row): BalanceMove[] => {
    if (row.kind === 'extra-payment') return [{ date: row.date, kind: loanWords.status.extra, amount: row.payment, note: '', effect: 'lowers' }]
    if (row.kind !== 'instalment' || row.number === null || row.date > day) return []
    const late = paidLate.get(row.date)
    const days = late === undefined ? 0 : daysBetween(row.date, late)
    return [
      {
        date: row.date,
        kind: loanWords.moves.instalment(row.number),
        amount: row.payment,
        note: late === undefined ? '' : plural(loanWords.status.paidLate(days, shortDayLabel(late)), days),
        effect: 'lowers',
      },
    ]
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
  return [...payments, ...rates]
}
