import type { AppCashMovements, PublishedCashMovement } from '../../../../shared/app/cashMovements'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { inEuros } from '../../../../shared/money/decimal'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import { TRANSACTIONS_ROUTE } from '../domain/transactionLinks'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { INVESTMENTS_APP } from '../../workbook/domain/investmentsApp'
import { CASH_MOVEMENT_RECORDS } from '../../workbook/domain/investmentKinds'
import type { InvestmentsWorkbook } from '../../workbook/domain/investmentsBooks'

/**
 * Each deposit and withdrawal of the book as another app reads it, named by its id, with its account's name and its euros at
 * its own rate. Fees and fee refunds stay out, since no bank row pays them, and so does a movement of an account the book lacks.
 */
export function cashMovementTargetsOf(book: Pick<InvestmentBook, 'accounts' | 'cashMovements'>): readonly PublishedCashMovement[] {
  const accountNames = new Map(book.accounts.map((account) => [account.id, account.name]))
  return book.cashMovements.flatMap((movement): PublishedCashMovement[] => {
    const accountName = accountNames.get(movement.account)
    if (accountName === undefined || (movement.kind !== 'deposit' && movement.kind !== 'withdrawal')) return []
    return [
      {
        link: { app: INVESTMENTS_APP, kind: CASH_MOVEMENT_RECORDS.name, key: keyOfRecordId(CASH_MOVEMENT_RECORDS, movement.id), due: null },
        accountName,
        day: movement.date,
        kind: movement.kind,
        euros: inEuros(movement.amount, movement.rate),
        to: TRANSACTIONS_ROUTE,
      },
    ]
  })
}

const { state } = useInvestmentsBooks()

/** The movements last worked out, built again only when a write or a sync gives the store a new book. */
let latest: { readonly workbook: InvestmentsWorkbook; readonly movements: readonly PublishedCashMovement[] } | null = null

/** The deposits and withdrawals of the file on screen, a wait while it opens, a failure, or null while Investments is not set up. */
export function publishedCashMovements(): AppCashMovements {
  return homeCardFigures(state, (workbook) => {
    if (latest === null || latest.workbook !== workbook) latest = { workbook, movements: cashMovementTargetsOf(workbook.book) }
    return latest.movements
  })
}
