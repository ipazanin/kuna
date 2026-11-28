import { words } from './words'
import type { CompanyPeriod, CompanySource } from '../../workbook/domain/workbook'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** Each way an account's rows come in, as the accounts editor names it. */
export const SOURCE_NAMES: Readonly<Record<CompanySource, string>> = {
  mail: words.accounts.rowsFrom.mail,
  'provider-file': words.accounts.rowsFrom.providerFile,
  'by-hand': words.accounts.rowsFrom.byHand,
}

/** Where an account's rows come in from, in a line, such as Bank's statements, By hand from 1 Jun 2026. */
export function sourcesInWords(periods: readonly CompanyPeriod[]): string {
  return periods.map((period) => (period.from === null ? SOURCE_NAMES[period.source] : `${SOURCE_NAMES[period.source]} ${words.accounts.sources.fromDay(dayLabel(period.from))}`)).join(', ')
}
