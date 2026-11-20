import { TEXT, choiceOf, dayOf, found, inputOf } from '../../../../shared/app/operationInput'
import { linkEntry, unlinkEntry } from '../../entries/application/entryWrites'
import { heldItemsOf } from '../../entries/application/rowRecords'
import type { LinkedEntry } from '../../links/domain/linkFiling'
import { ASSET_USES, mayAddToCompany, maybeCompanyPayment, movedInTime } from '../../links/domain/linkTarget'
import type { AppTargets, AssetTarget, CashMovementTarget, LinkTarget } from '../../links/domain/linkTarget'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import { fold } from '../../../../shared/text/fold'
import { words as linkWords } from '../../links/presentation/words'
import type { SpendingBook, SpendingRecords } from '../../workbook/domain/readSpendingBook'
import { holdsLink, linkOfItems, waitsOnReview } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { lastAssetCategory } from '../../links/domain/assetLinks'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { CATEGORY_RECORDS, TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import type { AssistantOperation } from '../../../../shared/app/assistantOperations'
import { StepRefused } from '../../../../shared/app/proposedWrites'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { language } from '../../../../shared/text/language'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What the entry dialog's link does: link an entry to its record in Loans, its payment in Company, its deposit or withdrawal in Investments or an asset in Assets, or take the link off. */
export const LINK_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'link-entry',
    about:
      "Links an entry to the record in Loans it is, in place of any link it had, by the loan's name as Loans lists it and a day: a bank loan's instalment or interim interest by its due date, or an extra payment or an informal loan's movement by its day. A movement or an extra payment must be in Loans already. An instalment on money out of an account in euros splits a filed entry into the plan's interest under its category, principal under Loan principal, which counts as no spending, and what differs from the plan under its category. An extra payment files the whole entry under Loan principal, and an informal loan or its movement under Loans to and from people. With Company as the loan, it links a payment between the person's company and them on that day the way the entry's money went, filed by what its money is, or for money out a cost they paid for the company that day, filed under For the company. With the name of a broker's account in Investments as the loan, it links money out to a deposit into that account made on that day, from the entry's day to 7 days after it, or money in to a withdrawal made on that day, up to 7 days before it. An entry with no category goes under Saved to investments, and one with a category keeps it. With the name of an asset in Assets as the loan and no day, it links the entry to that asset by its use: bought for its purchase, which files money out whole under Bought assets and counts as no spending, cost for a cost of owning it on money out, or income for income it earned on money in, both of which keep the entry's category. A cost or income on an entry waiting for a category needs the category it goes under, and on an entry with parts it may link only the parts named by their number.",
    input: inputOf({
      entry: TEXT,
      loan: TEXT,
      due: {
        type: ['string', 'null'],
        description: "The instalment's due date, or the day of the movement, extra payment, Company's payment or the broker's deposit or withdrawal, as yyyy-mm-dd. Null for an asset.",
      },
      use: {
        type: ['string', 'null'],
        enum: ['bought', 'cost', 'income', null],
        description: 'For an asset: bought, cost or income. Null for any other link, or for an asset to take cost on money out and income on money in.',
      },
      category: { type: ['string', 'null'], description: 'For a cost of or income from an asset on an entry waiting for a category, the category it goes under. Null otherwise.' },
      parts: {
        type: ['array', 'null'],
        items: { type: 'number' },
        description: "For a cost of or income from an asset on an entry with parts, the numbers of the parts it is for, counting from 1 in the entry's order. Null for every part.",
      },
    }),
    refs: { entry: TRANSACTION_RECORDS.name, category: CATEGORY_RECORDS.name },
    creates: null,
    alone: false,
    example: { entry: 'transaction', loan: 'Housing loan', due: '2026-11-15', use: null, category: null, parts: null },
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

/** What a step asks of a link to an asset: its use, the category of a waiting entry, and the parts by number. */
interface AssetAsk {
  readonly use: string | null
  /** The category's id as the step names it. */
  readonly category: string | null
  readonly parts: readonly number[] | null
}

/**
 * The asset of that name in Assets the entry is linked to by the use the step gives, or with none as a cost of it for money out
 * and income from it for money in, or null when no asset has the name. A name an asset shares with a loan in Loans or a
 * broker's account in Investments is refused, since either may be meant, and so is a use the entry's money cannot have. A cost
 * or income on a waiting entry takes the category named, and is refused without one, naming the category the asset's last one used.
 */
function assetOf(targets: LinkTargetsOfStep, book: SpendingBook, entry: ItemizedRow, name: string, ask: AssetAsk): LinkTarget | null {
  const { row, items } = entry
  const named = targets.assets.filter((target): target is AssetTarget => target.kind === 'asset' && fold(target.name) === fold(name))
  if (named.length === 0) return null
  const [asset] = named
  if (named.length > 1 || asset === undefined) throw new StepRefused(`More than one asset in Assets is called ${name}. The person renames one, or links the entry on its dialog.`)
  const loans = Array.isArray(targets.loans) ? targets.loans : []
  if ([...loans, ...targets.cashMovements].some((target) => ('loanName' in target && fold(target.loanName) === fold(name)) || ('accountName' in target && fold(target.accountName) === fold(name)))) {
    throw new StepRefused(`Both an asset in Assets and a loan or a broker's account are called ${name}. The person renames one, or links the entry on its dialog.`)
  }
  const chosen = choiceOf(ASSET_USES, ask.use, 'use') ?? (row.amount < 0 ? 'cost' : 'income')
  if ((chosen === 'income') !== row.amount >= 0) {
    throw new StepRefused(row.amount < 0 ? `This entry is money out, so it is the purchase of ${name} or a cost of it.` : `This entry is money in, so it is income from ${name}.`)
  }
  if (chosen === 'bought') return { ...asset, use: chosen }
  const parts = ask.parts === null ? undefined : ask.parts.map((number) => partNumbered(items, number))
  const linked = parts === undefined ? items : items.filter((item) => parts.includes(item.id))
  if (!waitsOnReview(linked)) return { ...asset, use: chosen, ...(parts === undefined ? {} : { parts }) }
  if (ask.category === null) {
    const last = lastAssetCategory(book, asset.link, chosen)
    const said = last === null ? `No entry is linked to ${name} that way yet.` : `Its last one went under ${book.categories.find((held) => held.id === last)?.name ?? 'a category gone since'}.`
    throw new StepRefused(`This entry waits for a category, so a ${chosen === 'cost' ? 'cost of' : 'income from'} ${name} needs the category it goes under. ${said}`)
  }
  const category = found(book.categories, ask.category, 'category').id
  return { ...asset, use: chosen, category, ...(parts === undefined ? {} : { parts }) }
}

/** The id of the entry's part of that number, counting from 1, refused when the entry has no such part. */
function partNumbered(items: readonly TransactionItem[], number: number): RecordId {
  const part = Number.isInteger(number) ? items[number - 1] : undefined
  if (part === undefined) throw new StepRefused(`The entry has ${items.length} parts, so part ${number} is not one of them.`)
  return part.id
}

/** The records of the other apps a link step may name. */
interface LinkTargetsOfStep {
  readonly loans: AppTargets<LinkTarget>
  readonly companyPayments: readonly LinkTarget[]
  readonly cashMovements: readonly LinkTarget[]
  readonly assets: readonly LinkTarget[]
}

/** The day a step names, which every link but one to an asset needs. */
function dayOfStep(due: string | null, name: string): CivilDate {
  if (due === null) throw new StepRefused(`${name} is not an asset in Assets, so the link needs the day of the record it names.`)
  return dayOf(due)
}

/** Writes a link step through the writes the entry dialog uses, and gives the linked entry when it links one. */
export function writeLinkStep(
  unit: UnitOfWork,
  book: SpendingBook,
  records: SpendingRecords,
  operation: string,
  field: Readonly<Record<string, never>>,
  idOf: (value: unknown) => string,
  targets: LinkTargetsOfStep,
): LinkedEntry | null {
  const row = found(book.transactions, idOf(field['entry']), 'row')
  const held = heldItemsOf(records)(row)
  if (operation === 'link-entry') {
    const account = found(book.accounts, idOf(row.account), 'account')
    const name = field['loan']
    const target =
      assetOf(targets, book, { row, items: held }, name, { use: field['use'], category: field['category'] === null ? null : idOf(field['category']), parts: field['parts'] }) ??
      (fold(name) === COMPANY
        ? companyPaymentOf(targets.companyPayments, row, account, held, dayOfStep(field['due'], name))
        : (cashMovementOf(targets.cashMovements, targets.loans, row, name, dayOfStep(field['due'], name)) ?? linkedTarget(targets.loans, name, dayOfStep(field['due'], name))))
    const place = { currency: account.currency, categories: book.categories, language, notes: linkWords.notes }
    return linkEntry(unit, records, row, target, place)
  }
  const link = linkOfItems(held)
  if (link === null && holdsLink(held)) throw new StepRefused("That entry's parts link to different records. The person takes each part's link off on the entry's dialog.")
  if (link === null) throw new StepRefused('That entry has no link.')
  unlinkEntry(unit, records, row, link)
  return null
}
