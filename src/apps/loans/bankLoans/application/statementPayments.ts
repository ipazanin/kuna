import type { StatementPayment, StatementPayments } from '../domain/instalmentPayments'
import { BANK_LOAN_RECORDS } from '../../workbook/domain/loanKinds'
import type { AppLinkedRows } from '../../../../shared/app/rowLinks'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'

/** The app whose linked rows are your bank statements. */
const STATEMENTS_APP = 'spending'

/**
 * The rows of your statements linked to an instalment of a bank loan in Loans, as Loans reads them. Each
 * item of a split row is linked on its own, so a row may come more than once. Spending still opening or
 * not set up gives no rows, and Spending that failed to open leaves the instalments unchecked.
 */
export function statementPaymentsFrom(linked: readonly AppLinkedRows[], loansApp: string): StatementPayments {
  const links = linked.find((entry) => entry.app === STATEMENTS_APP)?.links ?? null
  if (links === 'failed') return 'unchecked'
  if (links === null || links === 'opening') return []
  return links.flatMap(({ day, target }): StatementPayment[] =>
    target.app === loansApp && target.kind === BANK_LOAN_RECORDS.name && target.due !== null ? [{ loan: recordIdOf(BANK_LOAN_RECORDS, target.key), due: target.due, booked: day }] : [],
  )
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
