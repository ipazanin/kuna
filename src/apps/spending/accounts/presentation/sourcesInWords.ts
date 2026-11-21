import { words } from './words'
import type { SpendingPeriod } from '../../workbook/domain/account'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** Where an account's rows come from in a line, such as Statement file, From the bank from 1 Jun 2025. */
export function sourcesInWords(periods: readonly SpendingPeriod[]): string {
  return periods.map((period) => (period.from === null ? words.rowsFrom[period.source] : `${words.rowsFrom[period.source]} ${words.rowsFromChoice.fromDay(dayLabel(period.from))}`)).join(', ')
}
