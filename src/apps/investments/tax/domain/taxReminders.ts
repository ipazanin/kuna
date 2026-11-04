import { foreignIncomeYear } from './foreignIncome'
import { capitalGainsYear } from './taxYear'
import type { RateBook } from '../../prices/domain/rateBook'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'

/** A tax date coming up: last year's INO-DOH, last year's JOPPD for its sales, or the 30 days of payments with nothing withheld abroad. */
export type TaxReminder = { readonly kind: 'ino-doh' | 'joppd'; readonly due: CivilDate } | { readonly kind: 'payments'; readonly count: number; readonly due: CivilDate }

/**
 * The nearest tax date on the day. Kuna does not know what was filed, so each stays until its day passes. The INO-DOH
 * shows in January only, by the safe day before the weekend move.
 */
export function taxReminder(book: InvestmentBook, rates: RateBook, today: CivilDate): TaxReminder | null {
  const lastYear = yearOf(today) - 1
  const reminders: TaxReminder[] = []
  const last = foreignIncomeYear(book, rates, lastYear)
  if (today.slice(5, 7) === '01' && today <= last.inoDohDue.fileBy && last.filesInoDoh) {
    reminders.push({ kind: 'ino-doh', due: last.inoDohDue.fileBy })
  }
  const gains = capitalGainsYear(book, rates, lastYear)
  if (gains.due !== null && today <= gains.due) {
    reminders.push({ kind: 'joppd', due: gains.due })
  }
  const running = [...last.payments, ...foreignIncomeYear(book, rates, lastYear + 1).payments].flatMap((entry) =>
    entry.due !== null && entry.payment.gross > DECIMAL_ZERO && entry.payment.date <= today && today <= entry.due ? [entry.due] : [],
  )
  if (running.length > 0) {
    reminders.push({ kind: 'payments', count: running.length, due: running.reduce((first, due) => (due < first ? due : first)) })
  }
  return reminders.reduce<TaxReminder | null>((nearest, reminder) => (nearest === null || reminder.due < nearest.due ? reminder : nearest), null)
}
