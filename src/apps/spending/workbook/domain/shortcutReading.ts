import { orderOf, requiredAccountMoney } from './fieldReading'
import { requiredReference } from './recordReference'
import type { Shortcut, ShortcutPart } from './shortcut'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS, LABEL_RECORDS, SHORTCUT_PART_RECORDS, SHORTCUT_RECORDS } from './spendingKinds'
import { labelWords, numberText, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { idsOf, idsText, ownId, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

function shortcutOf(fields: StoredFields, id: RecordId | null): Shortcut {
  return {
    id: ownId(id),
    order: orderOf(fields, 'order'),
    name: textOf(fields.name),
    account: requiredReference(fields, 'account', ACCOUNT_RECORDS),
    payee: textOf(fields.payee),
  }
}

export const SHORTCUT_CODEC: RecordCodec<Shortcut> = withIdField(
  SHORTCUT_RECORDS,
  (fields) => labelWords([textOf(fields.name), textOf(fields.payee)]),
  shortcutOf,
  (shortcut) =>
    filledFields({
      order: String(shortcut.order),
      name: shortcut.name,
      account: keyOfRecordId(ACCOUNT_RECORDS, shortcut.account),
      payee: shortcut.payee,
    }),
)

function shortcutPartOf(fields: StoredFields, id: RecordId | null): ShortcutPart {
  return {
    id: ownId(id),
    shortcut: requiredReference(fields, 'shortcut', SHORTCUT_RECORDS),
    amount: requiredAccountMoney(fields, 'amount'),
    category: requiredReference(fields, 'category', CATEGORY_RECORDS),
    note: textOf(fields.note),
    labels: idsOf(fields.labels, LABEL_RECORDS),
  }
}

export const SHORTCUT_PART_CODEC: RecordCodec<ShortcutPart> = withIdField(
  SHORTCUT_PART_RECORDS,
  (fields) => labelWords([textOf(fields.note), numberText(fields.amount)]),
  shortcutPartOf,
  (part) =>
    filledFields({
      shortcut: keyOfRecordId(SHORTCUT_RECORDS, part.shortcut),
      amount: amountText(part.amount),
      category: keyOfRecordId(CATEGORY_RECORDS, part.category),
      note: part.note,
      labels: idsText(part.labels, LABEL_RECORDS),
    }),
)
