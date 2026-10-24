import { negateMoney } from '../../../shared/money/money'
import { ownerPartKey } from '../../owner-share/domain/ownerParts'
import type { OwnerPart } from '../../owner-share/domain/ownerParts'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import { listedRowKey } from '../../workbook/domain/splits'
import { ownerAdvanceOrder } from '../../workbook/domain/workbook'
import type { OwnerAdvance, Transaction } from '../../workbook/domain/workbook'
import { OWNER_COUNTERPARTY } from './filterTransactions'

/** A booked bank entry as Transactions lists it, or one part of a split or shared entry. */
export interface ListedBankRow extends Transaction {
  readonly kind: 'bank'
  /** Unique among the rows listed. */
  readonly key: string
}

/** A row of the owner-advances tab, or one part of a shared one, listed as what it books: no bank account, the owner as counterparty. */
export interface ListedAdvanceRow extends Pick<Transaction, 'date' | 'amount' | 'category' | 'family' | 'bucket' | 'counterparty' | 'counterpartyIban' | 'description'> {
  readonly kind: 'owner-advance'
  readonly key: string
  readonly advance: OwnerAdvance
}

export type ListedRow = ListedBankRow | ListedAdvanceRow

/** What an owner advance is badged as on Transactions. */
export const OWNER_ADVANCE_LABEL = 'Owner advance'

/** The bank rows and the advances as one list, in the order given. */
export function listedRows(transactions: readonly Transaction[], advances: readonly OwnerAdvance[]): ListedRow[] {
  return [...transactions.map(listedBankRow), ...advances.map(listedAdvanceRow)]
}

function listedBankRow(transaction: Transaction): ListedBankRow {
  return { ...transaction, kind: 'bank', key: listedRowKey(transaction) }
}

function listedAdvanceRow(advance: OwnerAdvance): ListedAdvanceRow {
  return {
    kind: 'owner-advance',
    key: ownerPartKey(advance.id, advance.ownerPart),
    advance,
    date: advance.date,
    amount: negateMoney(advance.amount),
    category: advance.category,
    family: advance.family,
    bucket: advance.bucket,
    counterparty: OWNER_COUNTERPARTY,
    counterpartyIban: '',
    description: advance.description,
  }
}

/** The share a listed row is a part of, if it is one. */
export function listedOwnerPart(row: ListedRow): OwnerPart | undefined {
  return row.kind === 'bank' ? row.ownerPart : row.advance.ownerPart
}

/** The row as booked: for a part of a shared row the row it comes from. */
export function bookedRowOf(row: ListedRow): ListedRow {
  if (row.kind === 'bank') {
    return row.ownerPart === undefined ? row : listedBankRow(row.ownerPart.whole)
  }
  return row.advance.ownerPart === undefined ? row : listedAdvanceRow(row.advance.ownerPart.whole)
}

/** Where a part sits among its row's parts, from 1, such as part 2 of 2 for the owner's part of a shared row. Null for a row listed whole. */
export function partPlace(row: ListedRow): { readonly number: number; readonly count: number } | null {
  if (row.kind === 'bank' && row.split !== undefined) {
    return { number: row.split.index + 1, count: row.split.count }
  }
  const part = listedOwnerPart(row)
  return part === undefined ? null : { number: part.side === 'owner' ? 2 : 1, count: 2 }
}

/** A listed row, or the row as booked above the parts of it that are listed. */
export type ListedEntry =
  | { readonly kind: 'row'; readonly row: ListedRow }
  | {
      readonly kind: 'split'
      readonly key: string
      readonly whole: Transaction
      /** How many parts the row has, listed or not. */
      readonly count: number
      /** The parts the filters select, in their order. */
      readonly parts: readonly ListedRow[]
    }
  | {
      readonly kind: 'shared'
      readonly key: string
      /** The bank row or the advance as booked. */
      readonly whole: ListedRow
      readonly share: OwnerShare
      /** The parts the filters select, the business part first. */
      readonly parts: readonly ListedRow[]
    }

/** The heading a part is listed under: its split row's, or else its shared row's. Null for a row listed whole. */
function headingKey(row: ListedRow): string | null {
  if (row.kind === 'bank' && row.split !== undefined) {
    return `split:${row.id}`
  }
  if (listedOwnerPart(row) === undefined) {
    return null
  }
  return row.kind === 'bank' ? `shared:${row.id}` : `shared:${row.advance.id}`
}

/** Parts in their split's order, and of one shared part or row the business part first. */
function partOrder(earlier: ListedRow, later: ListedRow): number {
  const splitIndex = (row: ListedRow) => (row.kind === 'bank' ? (row.split?.index ?? 0) : 0)
  const ownerSide = (row: ListedRow) => Number(listedOwnerPart(row)?.side === 'owner')
  return splitIndex(earlier) - splitIndex(later) || ownerSide(earlier) - ownerSide(later)
}

/**
 * The rows with each split or shared row heading its parts. The heading stands where the first of
 * its listed parts would, and the parts follow it in their order, so a sort by amount still keeps a
 * payment's parts together. A split row heads all its parts, the owner's part of a shared one included.
 */
export function withPartHeadings(rows: readonly ListedRow[]): ListedEntry[] {
  const partsOf = new Map<string, ListedRow[]>()
  for (const row of rows) {
    const key = headingKey(row)
    if (key !== null) {
      partsOf.set(key, [...(partsOf.get(key) ?? []), row])
    }
  }
  const headed = new Set<string>()
  return rows.flatMap((row): ListedEntry[] => {
    const key = headingKey(row)
    if (key === null) {
      return [{ kind: 'row', row }]
    }
    if (headed.has(key)) {
      return []
    }
    headed.add(key)
    const parts = [...partsOf.get(key)!].sort(partOrder)
    const heading: ListedEntry =
      row.kind === 'bank' && row.split !== undefined
        ? { kind: 'split', key, whole: row.split.whole, count: row.split.count, parts }
        : { kind: 'shared', key, whole: bookedRowOf(row), share: listedOwnerPart(row)!.share, parts }
    return [heading, ...parts.map((part): ListedEntry => ({ kind: 'row', row: part }))]
  })
}

/** Booking order: by date, then bank rows in the order the bank booked them, then advances in their own order. */
export function inBookingOrder(earlier: ListedRow, later: ListedRow): number {
  return earlier.date.localeCompare(later.date) || sameDayOrder(earlier, later)
}

function sameDayOrder(earlier: ListedRow, later: ListedRow): number {
  if (earlier.kind === 'bank' && later.kind === 'bank') {
    return earlier.sequence - later.sequence
  }
  if (earlier.kind === 'owner-advance' && later.kind === 'owner-advance') {
    return ownerAdvanceOrder(earlier.advance, later.advance)
  }
  return earlier.kind === 'bank' ? -1 : 1
}
