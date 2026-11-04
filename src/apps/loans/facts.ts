import type { RouteLocationRaw } from 'vue-router'

import { homeCardFigures } from '../../shared/app/homeCardFigures'
import type { CivilDate } from '../../shared/calendar/civilDate'
import type { Money } from '../../shared/money/money'
import { keyOfRecordId } from '../../shared/storage/domain/recordId'
import { bankLoanFigures } from './bankLoans/presentation/bankLoanView'
import { bankLoanLink } from './overview/presentation/loanLinks'
import { useLoansBooks } from './workbook/application/loansStore'
import { BANK_LOAN_RECORDS } from './workbook/domain/loanKinds'
import type { LoanBook } from './workbook/domain/readLoanBook'

/** A bank loan as another app reads it: what it is called and what you owe on it on the day. */
export interface PublishedBankLoan {
  /** The loan's bare UUID, as a record that names it stores it. */
  readonly key: string
  readonly name: string
  /** Null while its plan cannot be worked out. */
  readonly owed: Money | null
  readonly to: RouteLocationRaw
}

/** Every bank loan of the book on the day, for a reader that has the book in hand, such as check:figures. */
export function bankLoansOf(book: Pick<LoanBook, 'bankLoans'>, day: CivilDate): readonly PublishedBankLoan[] {
  return book.bankLoans.map((entry) => ({
    key: keyOfRecordId(BANK_LOAN_RECORDS, entry.loan.id),
    name: entry.loan.name,
    owed: bankLoanFigures(entry, day)?.owed ?? null,
    to: bankLoanLink(entry.loan),
  }))
}

const { state } = useLoansBooks()

/** The bank loans of the file on screen, a wait while it opens, a failure, or null while Loans is not set up. */
export function publishedBankLoans(day: CivilDate): readonly PublishedBankLoan[] | 'opening' | 'failed' | null {
  return homeCardFigures(state, (book) => bankLoansOf(book, day))
}
