import { words } from './words'
import { camtStatementOf } from '../../workbook/domain/rowOrigin'
import { dayLabel } from '../../../../shared/calendar/dayLabel'

/** A statement by its label in words: a camt statement by its number and day, such as Statement 001 of 6 Oct 2026, and any other as its label. */
export function statementInWords(label: string): string {
  const camt = camtStatementOf(label)
  return camt === null ? label : words.statementOn(camt.sequence, dayLabel(camt.created))
}
