import { fixedByBank, refusedOnAccount } from './bankRows'
import type { Account } from '../../workbook/domain/account'
import { categoryWithRole } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { TRANSACTION_RECORDS } from '../../workbook/domain/spendingKinds'
import { NO_BANK_FACTS } from '../../workbook/domain/transaction'
import type { Transaction } from '../../workbook/domain/transaction'
import { wholeItemOf } from '../../workbook/domain/rowItems'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { absAccountMoney, negateAccountMoney, subtractAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'

/** One side of a transfer: its account, and the leg already on it, whose amount the bank may have fixed. Both legs held is a transfer already saved. */
export interface TransferSide {
  readonly account: Pick<Account, 'id' | 'currency' | 'bank' | 'rowsFrom' | 'openedOn'>
  readonly row: Pick<Transaction, 'importKey'> | null
}

/** A transfer as typed: what left the from account, and what reached the other in its own currency, or null for all of it in one currency. */
export interface TransferDraft {
  readonly from: TransferSide
  readonly to: TransferSide
  readonly sent: AccountMoney
  readonly arrived: AccountMoney | null
}

/**
 * Why a typed transfer cannot be kept: the amount that arrived is missing in two currencies, above what was sent in one, or
 * less arrived where no side takes a fee row or on a transfer already saved, whose fee is an entry of its own.
 */
export type TransferRefusal = 'arrived-missing' | 'arrived-above-sent' | 'no-fee-side' | 'saved-transfer'

/** The amounts a transfer writes: the two equal or converted legs, and the fee that did not arrive, on the side that takes it. */
export interface TransferAmounts {
  readonly out: AccountMoney
  readonly in: AccountMoney
  readonly fee: { readonly side: 'from' | 'to'; readonly amount: AccountMoney } | null
}

/** The words a fee row is written with: the bank's name as its payee, and its description. */
export interface FeeWords {
  readonly bankNames: Readonly<Record<LinkableBank, string>>
  readonly description: string
}

/** The legs of a transfer and the fee row that less arriving in one currency writes. */
export interface TypedTransfer {
  readonly legs: readonly [ItemizedRow, ItemizedRow]
  readonly fee: ItemizedRow | null
}

const TYPED_ROW = { importKey: '' }

function takesFee(side: TransferSide): boolean {
  return !(side.row !== null && fixedByBank(side.row, side.account)) && !refusedOnAccount(TYPED_ROW, side.account)
}

/**
 * The side whose account takes the fee row when less arrives in one currency: the arrival account, as a bank's own file writes
 * its fees, or the from account when the bank fixed the arrival row or fills that account. Null when the bank fills both, and
 * for a transfer already saved, so changing it never adds a second fee row beside the one it may have written.
 */
export function feeSide(from: TransferSide, to: TransferSide): 'from' | 'to' | null {
  if (from.row !== null && to.row !== null) return null
  if (takesFee(to)) return 'to'
  return takesFee(from) ? 'from' : null
}

/**
 * What a typed transfer writes. In two currencies the arrived amount is the other leg. In one currency the legs are equal,
 * and what did not arrive is a fee: the legs are the sent amount with the fee on the arrival account, or the arrived amount
 * with the fee on the from account when the bank fixed the arrival.
 */
export function transferAmounts(draft: TransferDraft): TransferAmounts | { readonly refused: TransferRefusal } {
  const { from, to, sent, arrived } = draft
  if (from.account.currency !== to.account.currency) return arrived === null ? { refused: 'arrived-missing' } : { out: sent, in: arrived, fee: null }
  if (arrived === null || arrived === sent) return { out: sent, in: sent, fee: null }
  if (arrived > sent) return { refused: 'arrived-above-sent' }
  const side = feeSide(from, to)
  if (side === null) return { refused: from.row !== null && to.row !== null ? 'saved-transfer' : 'no-fee-side' }
  const fee = { side, amount: subtractAccountMoney(sent, arrived) }
  return side === 'to' ? { out: sent, in: sent, fee } : { out: arrived, in: arrived, fee }
}

/**
 * The two legs of a transfer, money out of one account and into the other, each naming the other as its pair and with one item
 * under Between my accounts that holds the note. The money stays yours, so neither leg has a payee. Less arriving in one
 * currency adds a fee row of its own, money out on the side `transferAmounts` names, under the category with the bank fees
 * role, as a bank's file files its fees, or waiting on To review in a book with none.
 */
export function newTransfer(
  draft: TransferDraft,
  entry: Pick<Transaction, 'date'> & { readonly note: string; readonly category: RecordId },
  categories: readonly Category[],
  feeWords: FeeWords,
): TypedTransfer | { readonly refused: TransferRefusal } {
  const amounts = transferAmounts(draft)
  if ('refused' in amounts) return amounts
  const outId = recordIdOf(TRANSACTION_RECORDS, newRecordId())
  const inId = recordIdOf(TRANSACTION_RECORDS, newRecordId())
  const shared = { ...NO_BANK_FACTS, date: entry.date, payee: '', source: 'typed' as const, categorisedBy: 'person' as const }
  const legOf = (row: Transaction): ItemizedRow => ({ row, items: [wholeItemOf(row, { category: entry.category, note: entry.note.trim(), link: null, labels: [] })] })
  const legs = [
    legOf({ ...shared, id: outId, account: draft.from.account.id, amount: negateAccountMoney(absAccountMoney(amounts.out)), pair: inId }),
    legOf({ ...shared, id: inId, account: draft.to.account.id, amount: absAccountMoney(amounts.in), pair: outId }),
  ] as const
  if (amounts.fee === null) return { legs, fee: null }
  const { bank, id } = (amounts.fee.side === 'to' ? draft.to : draft.from).account
  const fee: Transaction = {
    ...shared,
    id: recordIdOf(TRANSACTION_RECORDS, newRecordId()),
    account: id,
    amount: negateAccountMoney(amounts.fee.amount),
    payee: bank === 'otp' || bank === 'revolut' ? feeWords.bankNames[bank] : '',
    description: feeWords.description,
    pair: null,
  }
  return { legs, fee: { row: fee, items: [wholeItemOf(fee, { category: categoryWithRole(categories, 'bank-fees')?.id ?? null, note: '', link: null, labels: [] })] } }
}
