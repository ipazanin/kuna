import { carriedFields } from '../../workbook/domain/carriedChoices'
import { ITEM_RECORDS } from '../../workbook/domain/spendingKinds'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import { wholeRowItemId } from '../../workbook/domain/rowItems'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** One part a link splits an entry into: its amount signed as the entry is, its category or null while it waits for one, its note and the record it is linked to. */
export type LinkedPart = readonly [AccountMoney, RecordId | null, string, RowLink]

/** How one kind of link splits an entry. */
export interface LinkedSplit {
  /** An instalment's plan leaves out an interest or a difference of nothing. A company payment keeps every part its link note named. */
  readonly dropsEmpty: boolean
  /** Whether the parts say a link split them off, which the entry dialog's split note reads. A company payment filed in one part is filed whole. */
  readonly splitByLink: boolean
}

/**
 * The entry in the parts given, in place of the items it had. The first part keeps the id of the entry's first item, and the
 * entry is filed by you. Every part carries what `carriedFields` carries.
 */
export function linkedParts(entry: ItemizedRow, parts: readonly LinkedPart[], split: LinkedSplit, newKey: () => string): ItemizedRow {
  const firstId = entry.items[0]?.id ?? wholeRowItemId(entry.row)
  const carried = carriedFields(entry.items)
  const items = parts
    .filter(([amount]) => !split.dropsEmpty || amount !== 0)
    .map(([amount, category, note, link], place): TransactionItem => ({
      id: place === 0 ? firstId : recordIdOf(ITEM_RECORDS, newKey()),
      transaction: entry.row.id,
      receipt: null,
      printed: '',
      note,
      amount,
      category,
      link,
      ...carried,
      sharedCost: null,
      splitByLink: split.splitByLink,
    }))
  return { row: { ...entry.row, categorisedBy: 'person' }, items }
}
