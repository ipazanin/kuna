import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
import type { Money } from '../../../../shared/money/money'
import { partReplacements } from '../../../../shared/categorising/domain/partReplacements'
import type { PartReplacement } from '../../../../shared/categorising/domain/partReplacements'
import { movedTo } from '../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import { installedPack } from '../../packs/packContribution'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { CATEGORY_RECORDS, LEDGER_RECORDS, SPLIT_PART_RECORDS } from '../../workbook/domain/coreKinds'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import { definedCategories } from '../../workbook/domain/categoriesReading'
import { changesOnly } from '../../workbook/domain/fieldEdits'
import { readLedger } from '../../workbook/domain/ledgerReading'
import { rowsOfSplitKey, splitKeyOf, wholeRowPartId } from '../../workbook/domain/splits'
import { readSplits, storedSplitKey } from '../../workbook/domain/splitsReading'
import type { SplitTabRow, StoredSplit } from '../../workbook/domain/splitsReading'
import { packRecordsOf } from '../../workbook/domain/packPart'
import { recordWithId } from '../../../../shared/storage/domain/recordsRead'
import { refuseOn } from '../../../../shared/storage/application/workbookWriteRefused'
import { LEDGER_WRITES } from '../../imports/application/ledgerWrites'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import type { FreshRecords, WriteRules } from '../../../../shared/storage/domain/writeRules'
import { words } from '../../workbook/domain/words'

/** A part as the editor gives it, with the row's sign. */
export interface SplitPartDraft {
  readonly amount: Money
  readonly category: string
  readonly note: string
  /** The stored part the editor opened, whose id it keeps and whose share it keeps while it keeps its category, or null for a part added in the editor. */
  readonly opened: Pick<SplitTabRow, 'id' | 'category' | 'ownerShare'> | null
}

/**
 * Leaves the row's split holding these parts: a draft opened from a stored part changes that part, other drafts are added with
 * ids of their own, and stored parts no draft opened are removed. The first part of a row with nothing stored keeps the id of
 * the part the row stood for. Each part kept or added takes the row's key as the app read it, its row id with it. A part added
 * in the editor, or one put in another category, takes its category's default share, and a part that keeps its category keeps
 * the share it was opened with. Parts of a refused split are replaced with no Undo, since the guards would refuse to write them
 * back. Gives what each part replaces.
 */
export function writeSplit(
  unit: UnitOfWork,
  row: Pick<Transaction, 'date' | 'account' | 'amount' | 'balance' | 'rowId'>,
  stored: StoredSplit,
  drafts: readonly SplitPartDraft[],
  categories: readonly ShareDefault[],
): readonly PartReplacement<RecordId>[] {
  const parts = unit.of(SPLIT_WRITES)
  const held = stored.refused ? unit.of(REFUSED_SPLIT_WRITES) : parts
  const key = splitKeyOf(row)
  const wholeId = wholeRowPartId(row)
  const nothingStored = stored.parts.length === 0 && stored.unreadable === 0
  const written = drafts.map((draft, index): SplitTabRow => {
    const filed = movedTo(draft.opened ?? { category: '', ownerShare: null }, draft.category, categories)
    const wanted = { amount: draft.amount, category: filed.category, note: draft.note.trim(), ownerShare: filed.ownerShare }
    const part = stored.parts.find((candidate) => candidate.id === draft.opened?.id)
    if (part === undefined) {
      const added = { key, ...wanted, id: index === 0 && nothingStored && wholeId !== null ? wholeId : recordIdOf(SPLIT_PART_RECORDS, newRecordId()) }
      parts.add(added)
      return added
    }
    const changed = { ...part, key, ...wanted }
    held.change(part, changed)
    return changed
  })
  for (const part of stored.parts.filter((candidate) => !written.some((kept) => kept.id === candidate.id))) {
    held.remove(part)
  }
  const whole = wholeId === null ? [] : [{ id: wholeId, amount: row.amount }]
  return partReplacements(stored.parts.length > 0 ? stored.parts : whole, written.length > 0 ? written : whole)
}

/** Why a person cannot take the row's split off, since a record of the pack files it, in a sentence, or null when they can. */
export function splitKeptRefusal(books: CompanyBooks, row: Pick<Transaction, 'id' | 'account' | 'date' | 'amount'>): string | null {
  const why = installedPack().workbook?.splitsKept(books.records.pack, books.workbook).get(row.id)
  return why === undefined ? null : words.splits.refusedSplitKept(row.account, row.date, row.amount, why)
}

/**
 * Takes the split off the row, which then counts whole under the category most of its money was in, with that part's owner
 * share, filed by the person. A row that keeps its category is left as it is. A split the guards refused never counted, so the
 * row keeps the category it counted in. A split a record of the pack files stays, as `splitKeptRefusal` says. Gives what the
 * one part the row stands for again replaces.
 */
export function removeSplit(unit: UnitOfWork, books: CompanyBooks, row: Transaction, stored: StoredSplit): readonly PartReplacement<RecordId>[] {
  const refusal = splitKeptRefusal(books, row)
  refuseOn(refusal === null ? [] : [refusal])
  const replaced = writeSplit(unit, row, stored, [], books.workbook.categories)
  const mainCategory = stored.refused || stored.parts.length === 0 ? null : mainCategoryOf(stored.parts)
  const main = stored.parts.find((part) => part.category === mainCategory) ?? null
  if (main !== null && (main.category !== row.category || main.ownerShare !== row.ownerShare)) {
    const entry = recordWithId(books.records.ledger, row.id)?.record
    if (entry !== undefined) unit.of(LEDGER_WRITES).change(entry, { ...entry, category: main.category, ownerShare: main.ownerShare, flaggedBy: books.workbook.settings.reviewLabel })
  }
  return replaced
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
const REFUSED_SPLIT_WRITES: WriteRules<SplitTabRow> = {
  kind: SPLIT_PART_RECORDS,
  get reads() {
    return SPLIT_WRITES.reads
  },
  undoable: false,
  read: SPLIT_WRITES.read,
  refusals: SPLIT_WRITES.refusals,
}
