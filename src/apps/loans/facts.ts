import type { RouteLocationRaw } from 'vue-router'

import { homeCardFigures } from '../../shared/app/homeCardFigures'
import type { CivilDate } from '../../shared/calendar/civilDate'
import type { Money } from '../../shared/money/money'
import { keyOfRecordId } from '../../shared/storage/domain/recordId'
import { bankLoanFigures } from './bankLoans/domain/bankLoanFigures'
import { splitOf } from './bankLoans/domain/loanFigures'
import { bankLoanLink, informalLoanLink } from './overview/presentation/loanLinks'
import { useLoansBooks } from './workbook/application/loansStore'
import { BANK_LOAN_RECORDS, INFORMAL_LOAN_RECORDS } from './workbook/domain/loanKinds'
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

/** A bank loan's instalment as another app reads it: when it falls due and what of it you pay, as interest and as principal. */
export interface PublishedInstalment {
  /** The loan's bare UUID. */
  readonly loan: string
  readonly loanName: string
  readonly due: CivilDate
  /** What you pay of it, the subsidy left out, which is your interest and your principal together. */
  readonly yourShare: Money
  readonly interest: Money
  readonly principal: Money
  readonly to: RouteLocationRaw
}

/** Money owed between people, as another app reads it: who it is with and which way it runs. */
export interface PublishedInformalLoan {
  /** The loan's bare UUID. */
  readonly key: string
  readonly name: string
  readonly counterparty: string
  readonly direction: 'you-owe' | 'owed-to-you'
  readonly to: RouteLocationRaw
}

/** What a payment in another app may name in Loans: each instalment of a bank loan whose plan can be worked out, and each informal loan. */
export interface PublishedLoanTargets {
  readonly instalments: readonly PublishedInstalment[]
  readonly informalLoans: readonly PublishedInformalLoan[]
}

/** The instalments and informal loans of the book, for a reader that has the book in hand. */
export function loanTargetsOf(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>): PublishedLoanTargets {
  return {
    instalments: book.bankLoans.flatMap(({ loan, plan }) =>
      (plan ?? []).flatMap((row) => {
        if (row.kind !== 'instalment') return []
        const { interest, principal } = splitOf(row)
        return [
          {
            loan: keyOfRecordId(BANK_LOAN_RECORDS, loan.id),
            loanName: loan.name,
            due: row.date,
            yourShare: row.yourShare,
            interest,
            principal,
            to: bankLoanLink(loan),
          },
        ]
      }),
    ),
    informalLoans: book.informalLoans.map(({ loan }) => ({
      key: keyOfRecordId(INFORMAL_LOAN_RECORDS, loan.id),
      name: loan.name,
      counterparty: loan.counterparty,
      direction: loan.direction,
      to: informalLoanLink(loan),
    })),
  }
}

/** The instalments and informal loans of the file on screen, a wait while it opens, a failure, or null while Loans is not set up. */
export function publishedLoanTargets(): PublishedLoanTargets | 'opening' | 'failed' | null {
  return homeCardFigures(state, loanTargetsOf)
}
