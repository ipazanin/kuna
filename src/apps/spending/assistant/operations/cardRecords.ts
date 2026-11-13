import { codecOfSpendingKind } from '../../workbook/application/spendingCodecs'
import { SPENDING_PARTS } from '../../workbook/domain/readSpendingBook'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { CardRecordsAccess } from '../../../../shared/app/cardRecords'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'

/** The part of the records that holds a kind, or undefined for a kind the Spending file keeps none of. */
function partOf(kind: RecordKind<unknown>): keyof SpendingRecords | undefined {
  return (Object.keys(SPENDING_PARTS) as (keyof SpendingRecords)[]).find((part) => SPENDING_PARTS[part].name === kind.name)
}

function partHolding(kind: RecordKind<unknown>): keyof SpendingRecords {
  const part = partOf(kind)
  if (part === undefined) throw new Error(`The Spending file keeps no ${kind.noun.en.many}.`)
  return part
}

/** How a card reaches the Spending file's records, by the part that holds each kind. */
export const SPENDING_CARD_RECORDS: CardRecordsAccess<SpendingRecords> = {
  holds: (_records, kind) => partOf(kind) !== undefined,
  of: <R>(records: SpendingRecords, kind: RecordKind<R>) => records[partHolding(kind)] as RecordsRead<unknown> as RecordsRead<R>,
  with: <R>(records: SpendingRecords, kind: RecordKind<R>, read: RecordsRead<R>) => ({ ...records, [partHolding(kind)]: read }),
  codecOf: codecOfSpendingKind,
}
