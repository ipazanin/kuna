import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { restOfWhole } from '../../../../shared/money/partsOfWhole'
import { ownerShareProblem, ownerShareText, storedOwnerShare } from '../../owner-share/domain/ownerShare'
import type { OwnerShare } from '../../owner-share/domain/ownerShare'
import { INVOICE_RECORDS, ITEM_RECORDS, SPLIT_PART_RECORDS } from './coreKinds'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { SHARED_ID_REASON, idSharing, problemOf } from '../../../../shared/storage/domain/recordsRead'
import type { ReadRecord, Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { partOrder, rowsOfSplitKey } from './splits'
import type { LedgerSplit, SplitKey, SplitPart, StoredSplit } from './splits'
import { ownId, refusalOr, refuse, requiredDate, requiredMoney, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { Category, Transaction } from './workbook'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import { UNCLASSIFIED } from './bucket'

/** One record of the `splits` tab: the key of a ledger row and one part of it. */
export interface SplitTabRow {
  readonly key: SplitKey
  readonly amount: Money
  /** Blank when the field is. */
  readonly category: string
  readonly note: string
  readonly ownerShare: OwnerShare | null
  readonly id: RecordId
}

interface SplitsReading extends Reading<SplitTabRow> {
  /** Each split whose guards pass, in the order its first part comes, its parts larger first. */
  readonly splits: readonly LedgerSplit[]
}

interface SplitParts {
  readonly key: SplitKey
  /** The ledger rows the key finds. */
  readonly found: readonly Transaction[]
  readonly parts: ReadRecord<SplitTabRow>[]
  /** How many records with this key cannot be read as a part. */
  unreadable: number
}

export function splitPartOf(fields: StoredFields, id: RecordId | null): SplitTabRow {
  const key = keyOfFields(fields)
  return { key, amount: requiredMoney(fields, 'amount'), category: slugOf(fields.category), note: textOf(fields.note), ownerShare: storedOwnerShare(fields.owner_share), id: ownId(id) }
}

export const SPLIT_PART_CODEC: RecordCodec<SplitTabRow> = withIdField(SPLIT_PART_RECORDS, words.labels.splitPart, splitPartOf, (part) =>
  filledFields({
    date: part.key.date,
    account: part.key.account,
    row_amount: amountText(part.key.rowAmount),
    row_balance: amountText(part.key.rowBalance),
    row_id: part.key.rowId,
    amount: amountText(part.amount),
    category: part.category,
    note: part.note,
    owner_share: ownerShareText(part.ownerShare),
  }),
)

function keyOfFields(fields: StoredFields): SplitKey {
  const date = requiredDate(fields, 'date')
  const account = slugOf(fields.account)
  if (account === '') refuse(words.splits.noAccount)
  return { date, account, rowAmount: requiredMoney(fields, 'row_amount'), rowBalance: requiredMoney(fields, 'row_balance'), rowId: textOf(fields.row_id) || null }
}

/** The key a stored part names its bank row by, or null for one whose key cannot be read. */
export function storedSplitKey(fields: StoredFields): SplitKey | null {
  const key = refusalOr(() => keyOfFields(fields))
  return 'made' in key ? key.made : null
}

/**
 * The parts of split ledger rows. The parts whose keys find the same ledger row make one split of it, a
 * key finding its row by the row id it holds, or without one by the date, account, row amount and row
 * balance. A split is refused whole, each of its parts reported, when the key finds no row or several,
 * a part of it cannot be read, it has fewer than
 * two parts, a part is zero or has the other sign to the row, the parts do not add up to the row, a
 * part's category is not on the categories tab, or a part has no id or one another part holds. The
 * bank row then counts whole. A part whose owner share cannot be read is reported and counts with none.
 */
export function readSplits(read: RecordsRead<SplitTabRow>, transactions: readonly Transaction[], categories: readonly Category[]): SplitsReading {
  const problems: RecordProblem[] = []
  const groups = new Map<Transaction | string, SplitParts>()
  const groupOf = (key: SplitKey): SplitParts => {
    const found = rowsOfSplitKey(transactions, key)
    const id = found.length === 1 ? found[0]! : (key.rowId ?? `${key.date}|${key.account}|${key.rowAmount}|${key.rowBalance}`)
    const group = groups.get(id) ?? { key, found, parts: [], unreadable: 0 }
    groups.set(id, group)
    return group
  }
  for (const refused of read.refused) {
    problems.push(problemOf(refused, refused.reason))
    const key = storedSplitKey(refused.fields)
    if (key !== null) {
      groupOf(key).unreadable += 1
    }
  }
  const sharesId = idSharing(read)
  for (const stored of read.records) {
    const share = ownerShareProblem(stored.fields.owner_share)
    if (share !== null) {
      problems.push(problemOf(stored, share))
    }
    if (sharesId(stored)) {
      problems.push(problemOf(stored, SHARED_ID_REASON))
      groupOf(stored.record.key).unreadable += 1
    } else {
      groupOf(stored.record.key).parts.push(stored)
    }
  }

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const facts: SplitTabRow[] = []
  const splits: LedgerSplit[] = []
  for (const group of groups.values()) {
    const { found } = group
    const reasons = [...rowReasons(group, transactions), ...partReasons(group, categoryBySlug)]
    if (reasons.length > 0) {
      const reason = words.splits.countsWhole(reasons.join(', '))
      problems.push(...group.parts.map((stored) => problemOf(stored, reason)))
      continue
    }
    facts.push(...group.parts.map((stored) => stored.record))
    splits.push({
      row: found[0]!,
      parts: group.parts
        .map(({ record: part }): SplitPart => {
          const category = categoryBySlug.get(part.category)!
          return { amount: part.amount, category: part.category, family: category.family, bucket: category.bucket, note: part.note, ownerShare: part.ownerShare, id: part.id }
        })
        .sort(partOrder),
    })
  }
  return { facts, problems, splits }
}

/** The parts the splits tab holds for the row, whether its split is among the counted ones or was refused. */
export function storedSplitOfTab(read: RecordsRead<SplitTabRow>, splits: readonly LedgerSplit[], row: Pick<Transaction, 'id' | 'date' | 'account' | 'amount' | 'balance' | 'rowId'>): StoredSplit {
  const findsRow = (key: SplitKey | null) => key !== null && rowsOfSplitKey([row], key).length === 1
  const parts = read.records
    .map(({ record }) => record)
    .filter((part) => findsRow(part.key))
    .sort(partOrder)
  return {
    parts,
    refused: parts.length > 0 && !splits.some((split) => split.row.id === row.id),
    unreadable: read.refused.filter((refused) => findsRow(storedSplitKey(refused.fields))).length,
  }
}

/** A split counts only on a ledger row that no other row shares its key with, since the screens find the split by that key. */
function rowReasons(group: SplitParts, transactions: readonly Transaction[]): string[] {
  const { key, found, unreadable } = group
  const row = [key.account, key.date, key.rowAmount, key.rowBalance] as const
  const sharing = found.length === 1 ? transactions.filter((transaction) => transaction.id === found[0]!.id).length : 0
  return [
    ...(found.length === 0 ? [key.rowId === null ? words.splits.noRow(...row) : words.splits.noRowWithId(key.rowId, ...row)] : []),
    ...(found.length > 1 ? [key.rowId === null ? words.splits.severalRows(found.length, ...row) : words.splits.severalRowsWithId(found.length, key.rowId)] : []),
    ...(sharing > 1 ? [words.splits.sharesKey(...row)] : []),
    ...(unreadable > 0 ? [plural(words.splits.unreadableParts(unreadable), unreadable)] : []),
  ]
}

/** The parts against the row the key finds, or against the row amount the key holds when it finds none or several. */
function partReasons(group: SplitParts, categoryBySlug: ReadonlyMap<string, Category>): string[] {
  const { parts } = group
  const rowAmount = group.found.length === 1 ? group.found[0]!.amount : group.key.rowAmount
  const reasons: string[] = []
  if (parts.length + group.unreadable < 2) {
    reasons.push(words.splits.onePart)
  }
  for (const stored of parts) {
    const part = stored.record
    if (part.amount === 0) {
      reasons.push(words.splits.partZero(stored.label))
    } else if (Math.sign(part.amount) !== Math.sign(rowAmount)) {
      reasons.push(words.splits.partOtherSign(stored.label))
    }
    if (part.category === '') {
      reasons.push(words.splits.partNoCategory(stored.label))
    } else if (!categoryBySlug.has(part.category)) {
      reasons.push(words.splits.partNotOnTab(part.category, stored.label))
    }
  }
  const amounts = parts.map((stored) => stored.record.amount)
  if (group.unreadable === 0 && parts.length >= 2 && restOfWhole(rowAmount, amounts) !== 0) {
    reasons.push(words.splits.partsAddUp(sumMoney(amounts), rowAmount))
  }
  return reasons
}

/** One record of the `items` tab: what of a ledger row's money counts in which category. */
export interface ItemRecord {
  /** The `rowId` of the ledger row whose money it is. */
  readonly row: string
  /** The same sign as the row, never zero. */
  readonly amount: Money
  /** Blank, or one the categories tab lacks, only on a row's one item, which then waits on To review. */
  readonly category: string
  readonly note: string
  readonly ownerShare: OwnerShare | null
  /** The invoice whose payment this item is, or null for an item that pays none. */
  readonly invoice: RecordId | null
  readonly id: RecordId
}

function itemOf(fields: StoredFields, id: RecordId | null): ItemRecord {
  const row = textOf(fields.row_id)
  if (row === '') refuse(words.items.noRowId)
  const invoice = textOf(fields.invoice_id)
  return {
    row,
    amount: requiredMoney(fields, 'amount'),
    category: slugOf(fields.category),
    note: textOf(fields.note),
    ownerShare: storedOwnerShare(fields.owner_share),
    invoice: invoice === '' ? null : recordIdOf(INVOICE_RECORDS, invoice),
    id: ownId(id),
  }
}

export const ITEM_CODEC: RecordCodec<ItemRecord> = withIdField(ITEM_RECORDS, words.labels.item, itemOf, (item) =>
  filledFields({
    row_id: item.row,
    amount: amountText(item.amount),
    category: item.category,
    note: item.note,
    owner_share: ownerShareText(item.ownerShare),
    invoice_id: item.invoice === null ? undefined : keyOfRecordId(INVOICE_RECORDS, item.invoice),
  }),
)

/** The items of the ledger rows, as the `items` tab holds them. */
export interface ItemsReading {
  /** The records that count, in the order the tab holds them. */
  readonly facts: readonly ItemRecord[]
  readonly problems: readonly RecordProblem[]
  /** Each row whose items pass the guards, by the row's record id, with its items larger first. */
  readonly itemsByRow: ReadonlyMap<RecordId, readonly SplitPart[]>
  /** The rows the tab holds no item of, which count whole and wait on To review. */
  readonly rowsWithoutItems: readonly Transaction[]
}

/** The items the tab holds for one row id. */
interface RowItems {
  readonly rowId: string
  readonly found: readonly Transaction[]
  readonly items: ReadRecord<ItemRecord>[]
  unreadable: number
}

/**
 * The items of the ledger rows, grouped by the row id each names. A row's items count when they find exactly one row, can all be
 * read, none is zero or signed against the row, each has a category the categories tab defines, but for a row's one item, which
 * waits on To review with none or one the tab lacks, and they add up to the row to the cent. Otherwise every item of the row is reported and the row
 * counts whole with no category, so it waits on To review. An item whose owner share cannot be read is reported and counts with none.
 */
export function readItems(read: RecordsRead<ItemRecord>, transactions: readonly Transaction[], categories: readonly Category[]): ItemsReading {
  const problems: RecordProblem[] = []
  const groups = new Map<string, RowItems>()
  const groupOf = (rowId: string): RowItems => {
    const group = groups.get(rowId) ?? { rowId, found: transactions.filter((row) => row.rowId === rowId), items: [], unreadable: 0 }
    groups.set(rowId, group)
    return group
  }
  for (const refused of read.refused) {
    problems.push(problemOf(refused, refused.reason))
    const rowId = textOf(refused.fields.row_id)
    if (rowId !== '') groupOf(rowId).unreadable += 1
  }
  const sharesId = idSharing(read)
  for (const stored of read.records) {
    const share = ownerShareProblem(stored.fields.owner_share)
    if (share !== null) problems.push(problemOf(stored, share))
    if (sharesId(stored)) {
      problems.push(problemOf(stored, SHARED_ID_REASON))
      groupOf(stored.record.row).unreadable += 1
    } else {
      groupOf(stored.record.row).items.push(stored)
    }
  }

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]))
  const facts: ItemRecord[] = []
  const itemsByRow = new Map<RecordId, readonly SplitPart[]>()
  for (const group of groups.values()) {
    const reasons = [...itemRowReasons(group, transactions), ...itemReasons(group, categoryBySlug)]
    if (reasons.length > 0) {
      const reason = words.items.waitsOnReview(reasons.join(', '))
      problems.push(...group.items.map((stored) => problemOf(stored, reason)))
      continue
    }
    facts.push(...group.items.map((stored) => stored.record))
    itemsByRow.set(
      group.found[0]!.id,
      group.items
        .map(({ record: item }): SplitPart => {
          const category = categoryBySlug.get(item.category)
          return {
            amount: item.amount,
            category: item.category,
            family: category?.family ?? UNCLASSIFIED,
            bucket: category?.bucket ?? UNCLASSIFIED,
            note: item.note,
            ownerShare: item.ownerShare,
            id: item.id,
          }
        })
        .sort(partOrder),
    )
  }
  const named = new Set([...groups.values()].flatMap((group) => group.found.map((row) => row.id)))
  return { facts, problems, itemsByRow, rowsWithoutItems: transactions.filter((row) => !named.has(row.id)) }
}

/** The invoice each item pays, by the item's id, and a problem on each item that names an invoice the invoices tab lacks. */
export interface ItemInvoices {
  readonly paid: ReadonlyMap<RecordId, RecordId>
  readonly problems: readonly RecordProblem[]
}

/** The invoices the counted items pay, of those the invoices tab holds. An item naming any other pays none. */
export function readItemInvoices(read: RecordsRead<ItemRecord>, counted: ReadonlySet<RecordId>, invoices: ReadonlySet<RecordId>): ItemInvoices {
  const problems: RecordProblem[] = []
  const paid = new Map<RecordId, RecordId>()
  for (const stored of read.records) {
    const { invoice, id } = stored.record
    if (invoice === null || !counted.has(id)) continue
    if (invoices.has(invoice)) paid.set(id, invoice)
    else problems.push(problemOf(stored, words.items.noInvoice(keyOfRecordId(INVOICE_RECORDS, invoice))))
  }
  return { paid, problems }
}

/** Items count only on a ledger row that no other row shares its id or its key with. */
function itemRowReasons(group: RowItems, transactions: readonly Transaction[]): string[] {
  const { rowId, found, unreadable } = group
  const sharing = found.length === 1 ? transactions.filter((transaction) => transaction.id === found[0]!.id).length : 0
  const [row] = found
  return [
    ...(found.length === 0 ? [words.items.noRow(rowId)] : []),
    ...(found.length > 1 ? [words.splits.severalRowsWithId(found.length, rowId)] : []),
    ...(sharing > 1 && row !== undefined ? [words.splits.sharesKey(row.account, row.date, row.amount, row.balance)] : []),
    ...(unreadable > 0 ? [plural(words.splits.unreadableParts(unreadable), unreadable)] : []),
  ]
}

/** The items against the one row their id finds. */
function itemReasons(group: RowItems, categoryBySlug: ReadonlyMap<string, Category>): string[] {
  const [row] = group.found
  if (row === undefined || group.found.length > 1) return []
  const { items } = group
  const reasons: string[] = []
  for (const stored of items) {
    const item = stored.record
    if (item.amount === 0) {
      reasons.push(words.splits.partZero(stored.label))
    } else if (Math.sign(item.amount) !== Math.sign(row.amount)) {
      reasons.push(words.splits.partOtherSign(stored.label))
    }
    const alone = items.length + group.unreadable === 1
    if (item.category === '') {
      if (!alone) reasons.push(words.items.noCategoryBeside(stored.label))
    } else if (!alone && !categoryBySlug.has(item.category)) {
      reasons.push(words.splits.partNotOnTab(item.category, stored.label))
    }
  }
  const amounts = items.map((stored) => stored.record.amount)
  if (group.unreadable === 0 && restOfWhole(row.amount, amounts) !== 0) {
    reasons.push(words.splits.partsAddUp(sumMoney(amounts), row.amount))
  }
  return reasons
}

/** The problem on a ledger row the items tab holds no item of, which counts whole and waits on To review. */
export function rowWithoutItems(stored: Pick<RecordProblem, 'id' | 'label'>): RecordProblem {
  return problemOf(stored, words.items.noItems)
}
