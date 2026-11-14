import { paidLate } from './lateInstalments'
import type { LateInstalment } from '../../workbook/domain/lateInstalment'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A row of your bank statement linked to one of a bank loan's instalments, and the day the bank booked it. */
export interface StatementPayment {
  readonly loan: RecordId
  readonly due: CivilDate
  readonly booked: CivilDate
}

/** The statement rows linked to instalments, or unchecked when the statements could not be read, so no instalment reads as not seen. */
export type StatementPayments = readonly StatementPayment[] | 'unchecked'

/** How an instalment stands against what went out. */
export type InstalmentStanding =
  /** Counted as paid on its due date once that has passed, as every instalment was before statements. */
  | { readonly standing: 'as-planned' }
  /** A late-instalment record gives the day it went out, and no statement row is linked to it. */
  | { readonly standing: 'recorded'; readonly paid: CivilDate }
  /** A linked statement row gives the day it went out, and overrules a late-instalment record that gives another day. */
  | { readonly standing: 'seen'; readonly paid: CivilDate; readonly overruled: LateInstalment | null }
  /** Due long enough ago, from the loan's first linked instalment on, with no statement row linked to it. */
  | { readonly standing: 'not-seen' }

/** How many days after its due date a bank may book an instalment before Kuna calls it not seen. */
const BOOKED_DAYS_AFTER_DUE = 7

/**
 * Each instalment of the loan's plan by its due date, as it stands on the day. A row linked to an
 * instalment gives the day it went out, the latest when several are. Instalments due before the first
 * linked one keep counting as paid on their due date, since the statements may start later than the loan.
 */
export function instalmentStandings(book: Pick<BankLoanBook, 'loan' | 'plan' | 'lateInstalments'>, payments: StatementPayments, day: CivilDate): ReadonlyMap<CivilDate, InstalmentStanding> {
  const dues = (book.plan ?? []).filter((row) => row.kind === 'instalment').map((row) => row.date)
  const planned = new Set(dues)
  const booked = new Map<CivilDate, CivilDate>()
  for (const payment of payments === 'unchecked' ? [] : payments) {
    const before = booked.get(payment.due)
    if (payment.loan === book.loan.id && planned.has(payment.due) && (before === undefined || payment.booked > before)) booked.set(payment.due, payment.booked)
  }
  const firstLinked = [...booked.keys()].sort()[0]
  const records = new Map(book.lateInstalments.map((late) => [late.due, late]))
  const standingOf = (due: CivilDate): InstalmentStanding => {
    const paid = booked.get(due)
    const record = records.get(due)
    if (paid !== undefined) return { standing: 'seen', paid, overruled: record === undefined || record.paid === paid ? null : record }
    if (record !== undefined) return { standing: 'recorded', paid: record.paid }
    if (firstLinked !== undefined && due >= firstLinked && daysBetween(due, day) > BOOKED_DAYS_AFTER_DUE) return { standing: 'not-seen' }
    return { standing: 'as-planned' }
  }
  return new Map(dues.map((due) => [due, standingOf(due)]))
}

/** The day an instalment went out after its due date, or null when it is not known to be late. */
export function lateOn(due: CivilDate, standing: InstalmentStanding | undefined): CivilDate | null {
  if (standing === undefined || (standing.standing !== 'seen' && standing.standing !== 'recorded')) return null
  return paidLate(due, standing.paid) ? standing.paid : null
}
