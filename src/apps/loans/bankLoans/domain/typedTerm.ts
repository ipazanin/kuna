import { MOST_INSTALMENTS } from '../../workbook/domain/bankLoanReading'

/** A term typed as years and months, each digits or blank for none, as a number of monthly instalments, or null when it is not one from 1 to the most a loan's file holds. */
export function typedTerm(years: string, months: string): number | null {
  const whole = (text: string): number | null => (text.trim() === '' ? 0 : /^\d+$/.test(text.trim()) ? Number(text.trim()) : null)
  const yearCount = whole(years)
  const monthCount = whole(months)
  if (yearCount === null || monthCount === null || monthCount > 11) return null
  const count = yearCount * 12 + monthCount
  return count >= 1 && count <= MOST_INSTALMENTS ? count : null
}
