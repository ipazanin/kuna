import { absMoney, addMoney, ZERO } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { countedSplits } from '../../../transactions/domain/countedSplits'
import { rowItemsOf } from '../../../workbook/domain/splits'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { Transaction } from '../../../workbook/domain/workbook'
import type { HrDooWorkbook } from './hrDooPart'
import { ownerMoneyKindOf } from './packRoles'
import type { OwnerMoneyKind } from './packRoles'

/** One kind of money in a payment between the company and the owner. Above zero. */
export type OwnerPaymentPart = OwnerMoneyKind & { readonly amount: Money }

/** A bank row between the company and the owner, by the row id it carries, with what its money is. */
export interface OwnerPayment {
  readonly rowId: string
  readonly date: CivilDate
  /** Above zero, whichever way the money went. */
  readonly amount: Money
  readonly direction: 'to-owner' | 'from-owner'
  /** The company account's own IBAN, as the accounts tab gives it. */
  readonly companyIban: string
  /** The director's IBAN the row was paid to or from, normalised. */
  readonly ownerIban: string
  /** One part per kind, larger first, which add up to the amount. */
  readonly parts: readonly OwnerPaymentPart[]
}

/**
 * Each bank row with a row id paid to or from one of the director's IBANs, oldest first, with its money by kind as its items
 * file it. A split row reads as its parts, whether the books keep them as split parts or as items, and the ledger may come
 * as read or as the screens count it. A cost the owner paid privately has no bank row, so it is never one.
 */
export function ownerPayments(workbook: Pick<HrDooWorkbook, 'transactions' | 'splits' | 'rowsKeptWhole' | 'categories' | 'accounts' | 'director'>): OwnerPayment[] {
  const ownerIbans = new Set(workbook.director?.ibans ?? [])
  const categories = new Map(workbook.categories.map((category) => [category.slug, category]))
  const accountIbans = new Map(workbook.accounts.map((account) => [account.slug, account.iban]))
  const itemsOf = rowItemsOf(countedSplits(workbook.splits, workbook.rowsKeptWhole).splits)
  const banked = new Map(workbook.transactions.map((row) => row.split?.whole ?? row).map((row) => [row.id, row]))
  return [...banked.values()]
    .filter((row): row is Transaction & { readonly rowId: string } => row.rowId !== null && row.amount !== 0 && ownerIbans.has(row.counterpartyIban))
    .sort((earlier, later) => earlier.sequence - later.sequence)
    .map((row) => ({
      rowId: row.rowId,
      date: row.date,
      amount: absMoney(row.amount),
      direction: row.amount < 0 ? 'to-owner' : 'from-owner',
      companyIban: accountIbans.get(row.account) ?? '',
      ownerIban: row.counterpartyIban,
      parts: partsByKind(itemsOf(row).map((item) => ({ kind: ownerMoneyKindOf(categories.get(item.category)), amount: absMoney(item.amount) }))),
    }))
}

/** The items' money added up per kind, a tax-free payment per its key, larger first, leaving out a kind that holds nothing. */
function partsByKind(items: readonly { readonly kind: OwnerMoneyKind; readonly amount: Money }[]): OwnerPaymentPart[] {
  const parts = new Map<string, OwnerPaymentPart>()
  for (const { kind, amount } of items) {
    const key = kind.kind === 'tax-free' ? `tax-free:${kind.payment}` : kind.kind
    const held = parts.get(key)
    parts.set(key, { ...kind, amount: addMoney(held?.amount ?? ZERO, amount) })
  }
  return [...parts.values()].filter((part) => part.amount > 0).sort((larger, smaller) => smaller.amount - larger.amount)
}
