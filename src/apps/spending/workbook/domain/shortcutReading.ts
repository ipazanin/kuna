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
import { problemOf, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { Account } from './account'
import type { Category } from './category'
import type { Label } from '../../../../shared/categorising/domain/labels'
import { shortcutPartProblem } from '../../shortcuts/domain/shortcuts'
import type { ShortcutPartProblem } from '../../shortcuts/domain/shortcuts'

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

/** Why a shortcut does not count: it names no account in the file, worded as `noAccount`. */
export function readShortcuts(read: RecordsRead<Shortcut>, accounts: ReadonlyMap<string, Account>, noAccount: string): Reading<Shortcut> {
  return readEach(read, ({ record: shortcut }) => (accounts.has(shortcut.account) ? [] : [noAccount]))
}

/** The words of the reasons a part of a shortcut, or a shortcut for its parts, does not count. */
export interface ShortcutPartReasons {
  readonly problems: { readonly [Problem in ShortcutPartProblem]: string }
  readonly noShortcut: string
  readonly leftOut: string
  readonly withoutPart: string
}

/** The parts of shortcuts as `shortcutPartProblem` says, each of a shortcut that counts, all of a shortcut's or none. */
export function readShortcutParts(
  read: RecordsRead<ShortcutPart>,
  shortcuts: readonly Shortcut[],
  book: { readonly categories: readonly Category[]; readonly labels: readonly Label[] },
  reasons: ShortcutPartReasons,
): Reading<ShortcutPart> {
  const counted = new Set(shortcuts.map((shortcut) => shortcut.id))
  const siblingsOf = (part: ShortcutPart): readonly ShortcutPart[] => read.records.map((stored) => stored.record).filter((other) => other.shortcut === part.shortcut && other !== part)
  const ownReason = (part: ShortcutPart): string | null => {
    if (!counted.has(part.shortcut)) return reasons.noShortcut
    const problem = shortcutPartProblem(part, siblingsOf(part), book)
    return problem === null ? null : reasons.problems[problem]
  }
  const broken = new Set(read.records.filter((stored) => ownReason(stored.record) !== null).map((stored) => stored.record.shortcut))
  return readEach(read, ({ record: part }) => {
    const own = ownReason(part)
    if (own !== null) return [own]
    return broken.has(part.shortcut) ? [reasons.leftOut] : []
  })
}

/** The shortcuts with a part that counts, in order, and those without as left out. */
export function withParts(reading: Reading<Shortcut>, read: RecordsRead<Shortcut>, parts: readonly ShortcutPart[], reasons: Pick<ShortcutPartReasons, 'withoutPart'>): Reading<Shortcut> {
  const held = new Set(parts.map((part) => part.shortcut))
  const left = read.records.filter((stored) => reading.facts.includes(stored.record) && !held.has(stored.record.id))
  return {
    facts: reading.facts.filter((shortcut) => held.has(shortcut.id)).sort((earlier, later) => earlier.order - later.order),
    problems: [...reading.problems, ...left.map((stored) => problemOf(stored, reasons.withoutPart))],
  }
}
