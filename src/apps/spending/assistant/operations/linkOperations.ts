import { TEXT, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { linkEntry, unlinkEntry } from '../../entries/application/entryWrites'
import { heldItemsOf } from '../../entries/application/rowRecords'
import type { LinkedEntry } from '../../links/domain/instalmentSplit'
import { mayAddToCompany, maybeCompanyPayment, movedInTime } from '../../links/domain/linkTarget'
import type { AppTargets, CashMovementTarget, LinkTarget } from '../../links/domain/linkTarget'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { fold } from '../../../../shared/text/fold'
import { words as linkWords } from '../../links/presentation/words'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { holdsLink, linkOfItems } from '../../workbook/domain/rowItems'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { language } from '../../../../shared/text/language'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What the entry dialog's link does: link an entry to its record in Loans, its payment in Company or its deposit or withdrawal in Investments, or take the link off. */
export const LINK_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'link-entry',
    about:
      "Links an entry to the record in Loans it is, in place of any link it had, by the loan's name as Loans lists it and a day: a bank loan's instalment or interim interest by its due date, or an extra payment or an informal loan's movement by its day. A movement or an extra payment must be in Loans already. An instalment on money out of an account in euros splits a filed entry into the plan's interest under its category, principal under Loan principal, which counts as no spending, and what differs from the plan under its category. An extra payment files the whole entry under Loan principal, and an informal loan or its movement under Loans to and from people. With Company as the loan, it links a payment between the person's company and them on that day the way the entry's money went, filed by what its money is, or for money out a cost they paid for the company that day, filed under For the company. With the name of a broker's account in Investments as the loan, it links money out to a deposit into that account made on that day, from the entry's day to 7 days after it, or money in to a withdrawal made on that day, up to 7 days before it. An entry with no category goes under Saved to investments, and one with a category keeps it.",
    input: inputOf({
      entry: TEXT,
      loan: TEXT,
      due: { type: 'string', description: "The instalment's due date, or the day of the movement, extra payment, Company's payment or the broker's deposit or withdrawal, as yyyy-mm-dd." },
    }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction', loan: 'Housing loan', due: '2026-11-15' },
  },
  {
    name: 'unlink-entry',
    about: 'Takes the link to a record in another app off an entry. The entry keeps its category.',
    input: inputOf({ entry: TEXT }),
    refs: { entry: TRANSACTION_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction-linked' },
  },
]

const LINK_OPERATION_NAMES: ReadonlySet<string> = new Set(LINK_OPERATIONS.map((operation) => operation.name))

/** Whether the step is one of the link operations. */
export function isLinkStep(operation: string): boolean {
  return LINK_OPERATION_NAMES.has(operation)
}

/** The records Loans lists, or why the chat cannot name one. */
export function readLoans(loans: AppTargets<LinkTarget>): readonly LinkTarget[] {
  if (loans === null) throw new StepRefused('Loans is not set up on this device, so nothing in it can be linked.')
  if (loans === 'opening') throw new StepRefused('Loans is still opening. Propose the link again once it is open.')
  if (loans === 'failed') throw new StepRefused('Loans did not open, so nothing in it can be linked.')
  return loans
}

/** The record in Loans a step names by its loan's name: an instalment by its due date, or a movement or an extra payment by its day. */
function linkedTarget(loans: AppTargets<LinkTarget>, name: string, due: CivilDate): LinkTarget {
  const named = readLoans(loans)
    .filter((target) => target.kind === 'instalment' || target.kind === 'movement' || target.kind === 'extra-payment')
    .filter((target) => target.loanName === name && (target.kind === 'instalment' ? target.due : target.day) === due)
  if (named.length > 1) throw new StepRefused(`More than one record of a loan called ${name} falls on that day. Rename one in Loans, or link it on the entry's dialog.`)
  const [target] = named
  if (target !== undefined) return target
  throw new StepRefused(`${name} is not a loan Loans lists with an instalment, a movement or an extra payment on ${due}. Add a movement or an extra payment in Loans first, or on the entry's dialog.`)
}

/** The name a step gives in place of a loan's to link a payment between the person's company and them. */
const COMPANY = 'COMPANY'

/**
 * The payment between the person's company and them on the day that the entry on the account can be, or for money out a cost
 * they paid for the company on that day, as the entry dialog offers them.
 */
function companyPaymentOf(payments: readonly LinkTarget[], row: Transaction, account: Pick<Account, 'currency' | 'iban'>, items: readonly TransactionItem[], day: CivilDate): LinkTarget {
  const named = payments.filter(
    (target) => (target.kind === 'owner-payment' && target.day === day && maybeCompanyPayment(row, account, target)) || (target.kind === 'owner-advance' && target.day === day && row.amount < 0),
  )
  if (named.length > 1) throw new StepRefused("More than one payment or cost in Company that day can be this entry. The person links it on the entry's dialog.")
  const [payment] = named
  if (payment !== undefined) return payment
  const adding = mayAddToCompany(row, account.currency, items) ? " The person can add it to Company as a cost they paid with Add to Company on the entry's dialog." : ''
  throw new StepRefused(
    `Company has no payment or cost on ${day} that this entry can be: a payment is paid to or from the account's IBAN, in euros, the way the entry's money went, and a cost the person paid for the company is money out. Company may not be open.${adding}`,
  )
}

/**
 * The deposit or withdrawal of the broker's account of that name on the day that the entry can be, as the entry dialog offers it,
 * or null when no account has the name. A name both a broker's account and a loan in Loans have is refused, since either may be meant.
 */
function cashMovementOf(movements: readonly LinkTarget[], loans: AppTargets<LinkTarget>, row: Transaction, accountName: string, day: CivilDate): LinkTarget | null {
  const ofAccount = movements.filter((target): target is CashMovementTarget => target.kind === 'cash-movement' && fold(target.accountName) === fold(accountName))
  if (ofAccount.length === 0) return null
  if (Array.isArray(loans) && loans.some((target) => 'loanName' in target && fold(target.loanName) === fold(accountName))) {
    throw new StepRefused(`Both a loan in Loans and a broker's account in Investments are called ${accountName}. The person renames one, or links the entry on its dialog.`)
  }
  const named = ofAccount.filter((target) => target.day === day && movedInTime(row, target))
  if (named.length > 1) throw new StepRefused(`More than one movement of ${accountName} that day can be this entry. The person links it on the entry's dialog.`)
  const [movement] = named
  if (movement !== undefined) return movement
  throw new StepRefused(
    `${accountName} has no deposit or withdrawal on ${day} that this entry can be: money out pays a deposit made from its day to 7 days after, and money in is a withdrawal made up to 7 days before.`,
  )
}

/** Writes a link step through the writes the entry dialog uses, and gives the linked entry when it links one. */
export function writeLinkStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: SpendingRecords,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
  targets: { readonly loans: AppTargets<LinkTarget>; readonly companyPayments: readonly LinkTarget[]; readonly cashMovements: readonly LinkTarget[] },
): LinkedEntry | null {
  const row = found(book.transactions, idOf(field['entry']), 'row')
  const held = heldItemsOf(records)(row)
  if (operation === 'link-entry') {
    const account = found(book.accounts, idOf(row.account), 'account')
    const day = dayOf(field['due'])
    const target =
      fold(field['loan']) === COMPANY
        ? companyPaymentOf(targets.companyPayments, row, account, held, day)
        : (cashMovementOf(targets.cashMovements, targets.loans, row, field['loan'], day) ?? linkedTarget(targets.loans, field['loan'], day))
    const place = { currency: account.currency, categories: book.categories, language, notes: linkWords.notes }
    return linkEntry(unit, records, row, target, place)
  }
  const link = linkOfItems(held)
  if (link === null && holdsLink(held)) throw new StepRefused("That entry's parts link to different records. The person takes each part's link off on the entry's dialog.")
  if (link === null) throw new StepRefused('That entry has no link.')
  unlinkEntry(unit, records, row, link)
  return null
}
