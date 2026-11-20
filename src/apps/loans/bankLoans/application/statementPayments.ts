import type { StatementPayment, StatementPayments } from '../domain/instalmentPayments'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS } from '../../workbook/domain/loanKinds'
import { linksNaming } from '../../../../shared/app/rowLinks'
import type { AppLinkedRows } from '../../../../shared/app/rowLinks'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'

/**
 * The rows of your statements linked to an instalment or an extra payment of a bank loan in Loans, from whichever app links them.
 * Each item of a split row is linked on its own, so a row may come more than once. An app still opening or not set up
 * gives no rows, and an app that failed to open leaves the instalments unchecked.
 */
export function statementPaymentsFrom(linked: readonly AppLinkedRows[], loansApp: string): StatementPayments {
  const links = linksNaming(linked, loansApp)
  if (links === 'unchecked') return 'unchecked'
  return links.flatMap(({ day, target }): StatementPayment[] => {
    if (target.kind === EXTRA_PAYMENT_RECORDS.name) return [{ kind: 'extra-payment', payment: recordIdOf(EXTRA_PAYMENT_RECORDS, target.key), booked: day }]
    return target.kind === BANK_LOAN_RECORDS.name && target.due !== null ? [{ kind: 'instalment', loan: recordIdOf(BANK_LOAN_RECORDS, target.key), due: target.due, booked: day }] : []
  })
}

let readStatements: () => StatementPayments = () => []

/** Keeps how Loans reads the statement rows linked to its instalments, which `app.ts` builds from what the shell hands over as Loans installs. */
export function readStatementsThrough(read: () => StatementPayments): void {
  readStatements = read
}

/** The statement rows linked to bank loan instalments on this page now. */
export function statementPayments(): StatementPayments {
  return readStatements()
}
