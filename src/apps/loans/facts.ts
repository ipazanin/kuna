import type { RouteLocationRaw } from 'vue-router'

import { homeCardFigures } from '../../shared/app/homeCardFigures'
import type { PublishedLinkTarget } from '../../shared/app/rowLinks'
import type { AppLoanTargets, PublishedLoanTargets, PublishedMovementKind } from '../../shared/app/loanTargets'
import type { CivilDate } from '../../shared/calendar/civilDate'
import type { Money } from '../../shared/money/money'
import { keyOfRecordId, recordIdOf } from '../../shared/storage/domain/recordId'
import type { RecordId } from '../../shared/storage/domain/recordId'
import type { RecordKind } from '../../shared/storage/domain/recordKind'
import { bankLoanFigures, owedByYou } from './bankLoans/domain/bankLoanFigures'
import { splitOf } from './bankLoans/domain/loanFigures'
import { bankLoanLink, informalLoanLink } from './overview/presentation/loanLinks'
import { EXTRA_PAYMENT_WRITES, newExtraPayment } from './bankLoans/application/bankLoanWrites'
import { MOVEMENT_WRITES, newMovement } from './informalLoans/application/informalLoanWrites'
import { useLoansBooks } from './workbook/application/loansStore'
import { sessionWrite } from '../../shared/storage/application/sessionWrite'
import { BANK_LOAN_RECORDS, EXTRA_PAYMENT_RECORDS, INFORMAL_LOAN_RECORDS, MOVEMENT_RECORDS } from './workbook/domain/loanKinds'
import { LOANS_APP } from './workbook/domain/loansApp'
import type { LoanBook } from './workbook/domain/readLoanBook'

/** A bank loan as another app reads it: what it is called and what you owe on it on the day. */
export interface PublishedBankLoan {
  /** The loan's bare UUID, as a record that names it stores it. */
  readonly key: string
  readonly name: string
  /** Your part of what the bank is owed, or all of it for a loan you took out alone. Null while its plan cannot be worked out. */
  readonly owed: Money | null
  /** What the bank is owed in all, only for a loan you took out with others whose plan can be worked out. */
  readonly whole?: Money
  readonly to: RouteLocationRaw
}

/** Every bank loan of the book on the day, for a reader that has the book in hand, such as check:figures. */
export function bankLoansOf(book: Pick<LoanBook, 'bankLoans'>, day: CivilDate): readonly PublishedBankLoan[] {
  return book.bankLoans.map((entry) => {
    const figures = bankLoanFigures(entry, day)
    return {
      key: keyOfRecordId(BANK_LOAN_RECORDS, entry.loan.id),
      name: entry.loan.name,
      owed: figures === null ? null : owedByYou(figures),
      ...(figures?.yours === undefined ? {} : { whole: figures.owed }),
      to: bankLoanLink(entry.loan),
    }
  })
}

const { state } = useLoansBooks()

/** The bank loans of the file on screen, a wait while it opens, a failure, or null while Loans is not set up. */
export function publishedBankLoans(day: CivilDate): readonly PublishedBankLoan[] | 'opening' | 'failed' | null {
  return homeCardFigures(state, (book) => bankLoansOf(book, day))
}

/** The record as a row of another app names it, with Loans' own id and the record's kind. */
function linkOf(kind: RecordKind, id: RecordId, due: CivilDate | null = null): PublishedLinkTarget {
  return { app: LOANS_APP, kind: kind.name, key: keyOfRecordId(kind, id), due }
}

/** The instalments, extra payments and informal loans of the book, for a reader that has the book in hand. */
export function loanTargetsOf(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>): PublishedLoanTargets {
  return {
    instalments: book.bankLoans.flatMap(({ loan, plan }) => {
      const count = (plan ?? []).filter((row) => row.kind === 'instalment').length
      return (plan ?? []).flatMap((row) => {
        if (row.kind === 'extra-payment') return []
        const { interest, principal } = splitOf(row)
        return [
          {
            kind: row.kind,
            loan: keyOfRecordId(BANK_LOAN_RECORDS, loan.id),
            loanName: loan.name,
            lender: loan.lender,
            number: row.number,
            count,
            due: row.date,
            youPay: row.youPay,
            interest,
            principal,
            link: linkOf(BANK_LOAN_RECORDS, loan.id, row.date),
            to: bankLoanLink(loan),
          },
        ]
      })
    }),
    extraPayments: book.bankLoans.flatMap(({ loan, extraPayments }) =>
      extraPayments.map((payment) => ({ loanName: loan.name, day: payment.date, amount: payment.amount, link: linkOf(EXTRA_PAYMENT_RECORDS, payment.id), to: bankLoanLink(loan) })),
    ),
    informalLoans: book.informalLoans.map(({ loan, movements }) => ({
      key: keyOfRecordId(INFORMAL_LOAN_RECORDS, loan.id),
      name: loan.name,
      counterparty: loan.counterparty,
      direction: loan.direction,
      movements: movements.map((movement) => ({ day: movement.date, kind: movement.kind, amount: movement.amount, note: movement.note, link: linkOf(MOVEMENT_RECORDS, movement.id) })),
      link: linkOf(INFORMAL_LOAN_RECORDS, loan.id),
      to: informalLoanLink(loan),
    })),
  }
}

/** A movement another app adds to one of the informal loans Loans publishes. */
export interface MovementToAdd {
  /** The informal loan's bare UUID. */
  readonly loan: string
  readonly day: CivilDate
  readonly kind: PublishedMovementKind
  /** Above zero. */
  readonly amount: Money
  readonly note: string
}

/** A record another app added in Loans: the link that names it, and Undo, which Loans refuses once the record changed. */
export interface AddedInLoans {
  readonly link: PublishedLinkTarget
  undo(): Promise<void>
}

/**
 * Adds the movement to the Loans file on screen in a write of its own, under the title the adding app gives, as the movement
 * dialog adds one. Throws with the reason when Loans is not open or refuses it.
 */
export async function addMovement(movement: MovementToAdd, title: string): Promise<AddedInLoans> {
  const store = useLoansBooks()
  const added = newMovement({ loan: recordIdOf(INFORMAL_LOAN_RECORDS, movement.loan), date: movement.day, kind: movement.kind, amount: movement.amount, note: movement.note })
  const written = await sessionWrite(store, title, (unit) => unit.of(MOVEMENT_WRITES).add(added), 'add-movement-from-another-app')
  return { link: linkOf(MOVEMENT_RECORDS, added.id), undo: async () => (written === null ? undefined : store.undo(written)) }
}

/** What an extra payment does to the rest of its loan: ends it sooner, or keeps the term with a lower instalment. */
export type PublishedExtraPaymentEffect = 'shorter-term' | 'lower-instalment'

/** An extra payment another app adds to one of the bank loans Loans publishes. */
export interface ExtraPaymentToAdd {
  /** The bank loan's bare UUID. */
  readonly loan: string
  readonly day: CivilDate
  /** Above zero. */
  readonly amount: Money
  readonly effect: PublishedExtraPaymentEffect
}

/**
 * Adds the extra payment to the Loans file on screen in a write of its own, under the title the adding app gives, as the
 * extra payment dialog adds one. Throws with the reason when Loans is not open or refuses it.
 */
export async function addExtraPayment(payment: ExtraPaymentToAdd, title: string): Promise<AddedInLoans> {
  const store = useLoansBooks()
  const added = newExtraPayment({ loan: recordIdOf(BANK_LOAN_RECORDS, payment.loan), date: payment.day, amount: payment.amount, effect: payment.effect })
  const written = await sessionWrite(store, title, (unit) => unit.of(EXTRA_PAYMENT_WRITES).add(added), 'add-extra-payment-from-another-app')
  return { link: linkOf(EXTRA_PAYMENT_RECORDS, added.id), undo: async () => (written === null ? undefined : store.undo(written)) }
}

/** The targets last worked out, built again only when a write or a sync gives the store a new book. */
let latest: { readonly book: LoanBook; readonly targets: PublishedLoanTargets } | null = null

function loanTargetsOnce(book: LoanBook): PublishedLoanTargets {
  if (latest === null || latest.book !== book) latest = { book, targets: loanTargetsOf(book) }
  return latest.targets
}

/** The instalments, extra payments and informal loans of the file on screen, a wait while it opens, a failure, or null while Loans is not set up. */
export function publishedLoanTargets(): AppLoanTargets {
  return homeCardFigures(state, loanTargetsOnce)
}
