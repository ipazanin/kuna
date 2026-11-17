import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import type { Money } from '../../../../shared/money/money'
import { partReplacements } from '../../../../shared/categorising/domain/partReplacements'
import type { PartReplacement } from '../../../../shared/categorising/domain/partReplacements'
import { movedTo } from '../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import { installedPack } from '../../packs/packContribution'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { CATEGORY_RECORDS, LEDGER_RECORDS, SPLIT_PART_RECORDS } from '../../workbook/domain/coreKinds'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import { definedCategories } from '../../workbook/domain/categoriesReading'
import { changesOnly } from '../../workbook/domain/fieldEdits'
import { readLedger } from '../../workbook/domain/ledgerReading'
import { rowItemsOf, rowsOfSplitKey, wholeItemId } from '../../workbook/domain/splits'
import type { StoredItem, StoredSplit } from '../../workbook/domain/splits'
import { readSplits, storedSplitKey } from '../../workbook/domain/splitsReading'
import type { SplitTabRow } from '../../workbook/domain/splitsReading'
import { packRecordsOf } from '../../workbook/domain/packPart'
import { recordWithId } from '../../../../shared/storage/domain/recordsRead'
import { refuseOn } from '../../../../shared/storage/application/workbookWriteRefused'
import type { CompanyBooks, WorkbookRecords } from '../../workbook/domain/readWorkbook'
import { heldLabels, invoicesFreed, placedMoneyRefusal, storedItemIdOf, writeRowItems } from './itemWrites'
import type { ItemDraft } from './itemWrites'
import type { FreshRecords, WriteRules } from '../../../../shared/storage/domain/writeRules'
import { words } from '../../workbook/domain/words'

/** A part as the editor gives it, with the row's sign. */
export interface SplitPartDraft {
  readonly amount: Money
  readonly category: string
  readonly note: string
  /** The stored part the editor opened, whose id it keeps and whose share it keeps while it keeps its category, or null for a part added in the editor. */
  readonly opened: Pick<StoredItem, 'id' | 'category' | 'ownerShare'> | null
  /** The labels the part carries as the editor shows them, which the write stores as given. Left out, a part keeps those of the item whose id it keeps, and a new or grown one takes those of the parts it replaces. */
  readonly labels?: readonly RecordId[]
}

/**
 * Leaves the row's split holding these parts: a draft opened from a stored part keeps that part, other drafts are added with ids
 * of their own, and stored parts no draft opened are removed. The first part of a row with nothing stored keeps the id of the
 * one item the row stood for. A part added in the editor, or one put in another category, takes its category's default share,
 * and a part that keeps its category keeps the share it was opened with. Parts of a refused split are replaced with no Undo,
 * since the guards would refuse to write them back. Gives what each part replaces.
 */
export function writeSplit(
  unit: UnitOfWork,
  records: WorkbookRecords,
  row: Pick<Transaction, 'id' | 'date' | 'account' | 'amount' | 'balance' | 'rowId' | 'category' | 'ownerShare'>,
  stored: StoredSplit,
  drafts: readonly SplitPartDraft[],
  categories: readonly ShareDefault[],
): readonly PartReplacement<RecordId>[] {
  if (drafts.length === 0) return writeOneItem(unit, records, row, stored, { category: row.category, ownerShare: row.ownerShare }, null)
  return partReplacements(stored.parts.length > 0 ? stored.parts : wholeOf(records, row), writeRowItems(unit, records, row, stored, splitItems(records, row, stored, drafts, categories)))
}

/** The items the parts become, as `writeSplit` describes, each with the labels its draft gives, or else those of the item whose id it keeps. */
function splitItems(records: WorkbookRecords, row: Pick<Transaction, 'id' | 'rowId'>, stored: StoredSplit, drafts: readonly SplitPartDraft[], categories: readonly ShareDefault[]): ItemDraft[] {
  const nothingStored = stored.parts.length === 0 && stored.unreadable === 0
  const labelsOf = heldLabels(records, row)
  return drafts.map((draft, index): ItemDraft => {
    const filed = movedTo(draft.opened ?? { category: '', ownerShare: null }, draft.category, categories)
    const kept = stored.parts.find((candidate) => candidate.id === draft.opened?.id)
    const id = kept?.id ?? (index === 0 && nothingStored && row.rowId !== null ? wholeItemId(row) : null)
    const given = draft.labels === undefined ? {} : { labelsGiven: true }
    return { id, amount: draft.amount, category: filed.category, note: draft.note.trim(), ownerShare: filed.ownerShare, labels: draft.labels ?? labelsOf(id), ...given }
  })
}

/**
 * Why the row's split cannot be saved with these parts, or taken off when there are none, in a sentence, or null when it can: a
 * record of the pack files its items, as `itemsKeptRefusal` says, or the change would move money a person placed on an invoice.
 */
export function splitRefusal(books: CompanyBooks, row: Transaction, stored: StoredSplit, drafts: readonly SplitPartDraft[] | null): string | null {
  if (drafts === null) return itemsKeptRefusal(books, row) ?? placedMoneyRefusal(books.records, row, [oneItemOf(books.records, row, stored)])
  return drafts.length === 0 ? null : placedMoneyRefusal(books.records, row, splitItems(books.records, row, stored, drafts, books.workbook.categories))
}

/** The numbers of the invoices saving the split with these parts takes the row's money off, since a part leaves revenue. */
export function invoicesSplitOff(books: CompanyBooks, row: Transaction, stored: StoredSplit, drafts: readonly SplitPartDraft[]): readonly string[] {
  return invoicesFreed(books.records, row, splitItems(books.records, row, stored, drafts, books.workbook.categories))
}

/** The one item a row stands for while it is not split, by the id the books store its first part under, or none for a row with no row id yet. */
function wholeOf(records: WorkbookRecords, row: Pick<Transaction, 'id' | 'amount' | 'rowId'>): { readonly id: RecordId; readonly amount: Money }[] {
  return row.rowId === null ? [] : [{ id: storedItemIdOf(records, wholeItemId(row)), amount: row.amount }]
}

/** Leaves the row as one item, filed as given, and who filed it when `flaggedBy` is given. Gives what the one item replaces. */
function writeOneItem(
  unit: UnitOfWork,
  records: WorkbookRecords,
  row: Pick<Transaction, 'id' | 'date' | 'account' | 'amount' | 'balance' | 'rowId'>,
  stored: StoredSplit,
  filed: Pick<StoredItem, 'category' | 'ownerShare'>,
  flaggedBy: string | null,
): readonly PartReplacement<RecordId>[] {
  const id = wholeItemId(row)
  writeRowItems(unit, records, row, stored, [{ id, amount: row.amount, category: filed.category, note: '', ownerShare: filed.ownerShare, labels: heldLabels(records, row)(id) }], flaggedBy)
  const whole = wholeOf(records, row)
  return partReplacements(stored.parts.length > 0 ? stored.parts : whole, whole)
}

/** Why a person cannot take the row's split off or file its items in another category, since a record of the pack files them, in a sentence, or null when they can. */
export function itemsKeptRefusal(books: CompanyBooks, row: Transaction): string | null {
  const pack = installedPack().workbook
  if (pack === null) return null
  const kept = pack.itemsKept(books.records.pack, books.workbook)
  const why = rowItemsOf(books.workbook.splits)(row)
    .map((item) => kept.get(item.id))
    .find((reason) => reason !== undefined)
  return why === undefined ? null : words.splits.refusedItemNamed(row.account, row.date, row.amount, why)
}

/**
 * Takes the split off the row, which then counts as one item in the category most of its money was in, with that part's owner
 * share. When that files the row otherwise than the books hold it, the person files it. A split the guards refused never counted,
 * so the row keeps the category it counted in. A split a record of the pack files stays, as `itemsKeptRefusal` says. Gives what
 * the one item the row stands for again replaces.
 */
export function removeSplit(unit: UnitOfWork, books: CompanyBooks, row: Transaction, stored: StoredSplit): readonly PartReplacement<RecordId>[] {
  const refusal = itemsKeptRefusal(books, row)
  refuseOn(refusal === null ? [] : [refusal])
  const entry = recordWithId(books.records.ledger, row.id)?.record
  const main = oneItemOf(books.records, row, stored)
  const refiled = entry !== undefined && (main.category !== entry.category || main.ownerShare !== entry.ownerShare)
  return writeOneItem(unit, books.records, row, stored, main, refiled ? books.workbook.settings.reviewLabel : null)
}

/** The one item a row stands for once its split is taken off, as `removeSplit` files it. */
function oneItemOf(records: WorkbookRecords, row: Transaction, stored: StoredSplit): ItemDraft {
  const mainCategory = stored.refused || stored.parts.length === 0 ? null : mainCategoryOf(stored.parts)
  const main = stored.parts.find((part) => part.category === mainCategory) ?? { category: row.category, ownerShare: row.ownerShare }
  const id = wholeItemId(row)
  return { id, amount: row.amount, category: main.category, note: '', ownerShare: main.ownerShare, labels: heldLabels(records, row)(id) }
}

function ledgerOfRecords(fresh: FreshRecords): { readonly transactions: readonly Transaction[]; readonly categories: readonly Category[] } {
  const categories = definedCategories(fresh.of(CATEGORY_RECORDS))
  return { transactions: readLedger(fresh.of(LEDGER_RECORDS), categories).facts, categories }
}

/**
 * Split parts, checked by their reader against the ledger and the categories as they are now, so a
 * split the guards refuse is never written. A split of a row the pack keeps whole, such as one an
 * asset claims as its whole payment, is refused too, unless the write only gives its parts the row's id.
 */
export const SPLIT_WRITES: WriteRules<SplitTabRow> = {
  kind: SPLIT_PART_RECORDS,
  get reads() {
    return [LEDGER_RECORDS, CATEGORY_RECORDS, ...(installedPack().workbook?.keptWholeReads ?? [])]
  },
  undoable: true,
  read: (read, records) => {
    const { transactions, categories } = ledgerOfRecords(records)
    return readSplits(read, transactions, categories)
  },
  refusals: (change, fresh) => {
    const pack = installedPack().workbook
    const { transactions, categories } = ledgerOfRecords(fresh)
    const keptWhole =
      pack?.rowsKeptWhole(
        packRecordsOf(pack.keptWholeReads, (kind) => fresh.of(kind)),
        { transactions, categories },
      ) ?? new Map<RecordId, string>()
    const written = change.edits.flatMap((edit) => {
      if (edit.before !== null && edit.after !== null && changesOnly(edit.before.fields, edit.after.fields, 'row_id')) return []
      const key = edit.after === null ? null : storedSplitKey(edit.after.fields)
      return key === null ? [] : rowsOfSplitKey(transactions, key)
    })
    return transactions.flatMap((row) => {
      const why = keptWhole.get(row.id)
      return why !== undefined && written.includes(row) ? [words.splits.refusedKeptWhole(row.account, row.date, row.amount, why)] : []
    })
  },
}

/** The split parts' rules for the parts of a split the guards refused, which keep no Undo. */
export const REFUSED_SPLIT_WRITES: WriteRules<SplitTabRow> = {
  kind: SPLIT_PART_RECORDS,
  get reads() {
    return SPLIT_WRITES.reads
  },
  undoable: false,
  read: SPLIT_WRITES.read,
  refusals: SPLIT_WRITES.refusals,
}
