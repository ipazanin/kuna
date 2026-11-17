import { TEXT, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { linkEntry, unlinkEntry } from '../../entries/application/entryWrites'
import { heldItemsOf } from '../../entries/application/rowRecords'
import type { LinkedEntry } from '../../links/domain/instalmentSplit'
import type { AppTargets, LinkTarget } from '../../links/domain/linkTarget'
import { words as linkWords } from '../../links/presentation/words'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { holdsLink, linkOfItems } from '../../workbook/domain/rowItems'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { language } from '../../../../shared/text/language'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What the entry dialog's link does: link an entry to its record in Loans, or take the link off. */
export const LINK_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'link-entry',
    about:
      "Links an entry to the record in Loans it is, in place of any link it had, by the loan's name as Loans lists it and a day: a bank loan's instalment or interim interest by its due date, or an extra payment or an informal loan's movement by its day. A movement or an extra payment must be in Loans already. An instalment on money out of an account in euros splits a filed entry into the plan's interest under its category, principal under Loan principal, which counts as no spending, and what differs from the plan under its category. An extra payment files the whole entry under Loan principal, and an informal loan or its movement under Loans to and from people.",
    input: inputOf({
      entry: TEXT,
      loan: TEXT,
      due: { type: 'string', description: "The instalment's due date or the movement's or extra payment's day as yyyy-mm-dd." },
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
    .filter((target) => target.kind !== 'informal-loan')
    .filter((target) => target.loanName === name && (target.kind === 'instalment' ? target.due : target.day) === due)
  if (named.length > 1) throw new StepRefused(`More than one record of a loan called ${name} falls on that day. Rename one in Loans, or link it on the entry's dialog.`)
  const [target] = named
  if (target !== undefined) return target
  throw new StepRefused(`${name} is not a loan Loans lists with an instalment, a movement or an extra payment on ${due}. Add a movement or an extra payment in Loans first, or on the entry's dialog.`)
}

/** Writes a link step through the writes the entry dialog uses, and gives the linked entry when it links one. */
export function writeLinkStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: SpendingRecords,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
  loans: AppTargets<LinkTarget>,
): LinkedEntry | null {
  const row = found(book.transactions, idOf(field['entry']), 'row')
  if (operation === 'link-entry') {
    const target = linkedTarget(loans, field['loan'], dayOf(field['due']))
    const place = { currency: found(book.accounts, idOf(row.account), 'account').currency, categories: book.categories, language, notes: linkWords.notes }
    return linkEntry(unit, records, row, target, place)
  }
  const held = heldItemsOf(records)(row)
  const link = linkOfItems(held)
  if (link === null && holdsLink(held)) throw new StepRefused("That entry's parts link to different records. The person takes each part's link off on the entry's dialog.")
  if (link === null) throw new StepRefused('That entry has no link.')
  unlinkEntry(unit, records, row, link)
  return null
}
