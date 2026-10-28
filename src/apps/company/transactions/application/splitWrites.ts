import { plainAmount } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { movedTo } from '../../owner-share/domain/ownerShare'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import { installedPack } from '../../packs/packContribution'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { CATEGORY_RECORDS, LEDGER_RECORDS, SPLIT_PART_RECORDS } from '../../workbook/domain/coreKinds'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import { definedCategories } from '../../workbook/domain/categoriesReading'
import { slugOf as slugOfField } from '../../../../shared/storage/domain/storedFields'
import { readLedger } from '../../workbook/domain/ledgerReading'
import { readSplits } from '../../workbook/domain/splitsReading'
import type { SplitTabRow } from '../../workbook/domain/splitsReading'
import { packRecordsOf } from '../../workbook/domain/packPart'
import type { FreshRecords, WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A part as the editor gives it, with the row's sign. */
export interface SplitPartDraft {
  readonly amount: Money
  readonly category: string
  readonly note: string
  /** The part as the editor opened it, whose share it keeps while it keeps its category, or null for a part added in the editor. */
  readonly opened: Pick<SplitTabRow, 'category' | 'ownerShare'> | null
}

/**
 * Leaves the row's split holding these parts: the parts it holds now take the drafts in order,
 * drafts beyond them are added with ids of their own, and parts beyond the drafts are removed. A
 * part keeps the row's key as the app read it. A part added in the editor, or one put in another
 * category, takes its category's default share, and a part that keeps its category keeps the share
 * it was opened with.
 */
export function writeSplit(
  unit: UnitOfWork,
  row: Pick<Transaction, 'date' | 'account' | 'amount' | 'balance'>,
  current: readonly SplitTabRow[],
  drafts: readonly SplitPartDraft[],
  categories: readonly ShareDefault[],
): void {
  const parts = unit.of(SPLIT_WRITES)
  const key = { date: row.date, account: row.account, rowAmount: row.amount, rowBalance: row.balance }
  drafts.forEach((draft, index) => {
    const filed = movedTo(draft.opened ?? { category: '', ownerShare: null }, draft.category, categories)
    const wanted = { amount: draft.amount, category: filed.category, note: draft.note.trim(), ownerShare: filed.ownerShare }
    const held = current[index]
    if (held === undefined) {
      parts.add({ key, ...wanted, id: recordIdOf(SPLIT_PART_RECORDS, newRecordId()) })
    } else {
      parts.change(held, { ...held, ...wanted })
    }
  })
  for (const held of current.slice(drafts.length)) {
    parts.remove(held)
  }
}

function ledgerOfRecords(fresh: FreshRecords): { readonly transactions: readonly Transaction[]; readonly categories: readonly Category[] } {
  const categories = definedCategories(fresh.of(CATEGORY_RECORDS))
  return { transactions: readLedger(fresh.of(LEDGER_RECORDS), categories).facts, categories }
}

/**
 * Split parts, checked by their reader against the ledger and the categories as they are now, so a
 * split the guards refuse is never written. A split of a row the pack keeps whole, such as one an
 * asset claims as its whole payment, is refused too.
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
    const keptWhole = pack?.rowsKeptWhole(packRecordsOf(pack.keptWholeReads, (kind) => fresh.of(kind)), { transactions, categories }) ?? new Map<RecordId, string>()
    const written = change.edits.flatMap((edit) => (edit.after === null ? [] : [edit.after.fields]))
    return transactions.flatMap((row) => {
      const why = keptWhole.get(row.id)
      const splitHere = written.some(
        (fields) => fields.date?.date === row.date && slugOfField(fields.account) === row.account && fields.row_amount?.money === row.amount && fields.row_balance?.money === row.balance,
      )
      return why !== undefined && splitHere ? [`The ${row.account} row of ${row.date} for ${plainAmount(row.amount)} stays whole, since ${why}.`] : []
    })
  },
}
