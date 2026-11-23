import { newEntry } from '../../entries/application/entryWrites'
import { writeRows } from '../../entries/application/rowRecords'
import { shortcutAmount } from '../domain/shortcuts'
import type { ShortcutDraft, ShortcutWithParts } from '../domain/shortcuts'
import { SPENDING_KINDS, bookWith, dependentRefusals } from '../../workbook/application/spendingWriteGuards'
import type { SpendingRecords } from '../../workbook/domain/readSpendingBook'
import type { ItemizedRow } from '../../workbook/domain/rowItems'
import type { Shortcut, ShortcutPart } from '../../workbook/domain/shortcut'
import { ITEM_RECORDS, SHORTCUT_PART_RECORDS, SHORTCUT_RECORDS } from '../../workbook/domain/spendingKinds'
import { BY_DAYS } from '../../workbook/domain/event'
import { words } from '../domain/words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** A shortcut names an account that counts and keeps at least one part. */
export const SHORTCUT_WRITES: WriteRules<Shortcut> = {
  kind: SHORTCUT_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(SHORTCUT_RECORDS, read, records).readings.shortcuts,
  refusals: (_change, fresh, after) => dependentRefusals(['shortcuts', 'shortcutParts'], fresh, after),
}

/** A part of a shortcut reads as `shortcutPartProblem` says. */
export const SHORTCUT_PART_WRITES: WriteRules<ShortcutPart> = {
  kind: SHORTCUT_PART_RECORDS,
  reads: SPENDING_KINDS,
  undoable: true,
  read: (read, records) => bookWith(SHORTCUT_PART_RECORDS, read, records).readings.shortcutParts,
  refusals: (_change, fresh, after) => dependentRefusals(['shortcuts', 'shortcutParts'], fresh, after),
}

/** The records a shortcut write reads of the file. */
type ShortcutRecords = Pick<SpendingRecords, 'shortcuts' | 'shortcutParts'>

/** A new shortcut after the last one, its text trimmed, with ids of its own. */
export function newShortcut(records: ShortcutRecords, draft: ShortcutDraft, newKey: () => string = newRecordId): ShortcutWithParts {
  const last = Math.max(0, ...recordsOf(records.shortcuts).map((shortcut) => shortcut.order))
  const shortcut: Shortcut = { id: recordIdOf(SHORTCUT_RECORDS, newKey()), order: last + 1, name: draft.name.trim(), account: draft.account, payee: draft.payee.trim() }
  return { shortcut, parts: partsOf(shortcut, draft.parts, newKey) }
}

function partsOf(shortcut: Shortcut, parts: ShortcutDraft['parts'], newKey: () => string): readonly ShortcutPart[] {
  return parts.map((part) => ({ ...part, note: part.note.trim(), id: recordIdOf(SHORTCUT_PART_RECORDS, newKey()), shortcut: shortcut.id }))
}

/** Adds the shortcut with its parts, which `newShortcut` made. */
export function addShortcut(unit: UnitOfWork, made: ShortcutWithParts): void {
  unit.of(SHORTCUT_WRITES).add(made.shortcut)
  made.parts.forEach((part) => unit.of(SHORTCUT_PART_WRITES).add(part))
}

/** The shortcut as the draft gives it, in its place, its parts written anew. */
export function changeShortcut(unit: UnitOfWork, held: ShortcutWithParts, draft: ShortcutDraft, newKey: () => string = newRecordId): void {
  const after: Shortcut = { ...held.shortcut, name: draft.name.trim(), account: draft.account, payee: draft.payee.trim() }
  unit.of(SHORTCUT_WRITES).change(held.shortcut, after)
  held.parts.forEach((part) => unit.of(SHORTCUT_PART_WRITES).remove(part))
  partsOf(after, draft.parts, newKey).forEach((part) => unit.of(SHORTCUT_PART_WRITES).add(part))
}

/** Deletes the shortcut and its parts. Entries it wrote stay. */
export function deleteShortcut(unit: UnitOfWork, held: ShortcutWithParts): void {
  held.parts.forEach((part) => unit.of(SHORTCUT_PART_WRITES).remove(part))
  unit.of(SHORTCUT_WRITES).remove(held.shortcut)
}

/** Swaps the shortcut with the one before it, `step` -1, or after it, 1, among `shown`. Nothing moves past either end. */
export function moveShortcut(unit: UnitOfWork, shown: readonly Shortcut[], shortcut: Shortcut, step: -1 | 1): void {
  const place = shown.findIndex((candidate) => candidate.id === shortcut.id)
  const other = shown[place + step]
  if (place < 0 || other === undefined) return
  // Two shortcuts with one order, as a file edited by hand may hold, still swap.
  const [first, second] = other.order === shortcut.order ? [shortcut.order + step, other.order] : [other.order, shortcut.order]
  unit.of(SHORTCUT_WRITES).change(shortcut, { ...shortcut, order: first })
  unit.of(SHORTCUT_WRITES).change(other, { ...other, order: second })
}

/**
 * The entry a shortcut writes on the day: on its account, to its payee, typed, of its parts added up. One part makes an entry not
 * split, and more make one entry split into them. Each part joins an event by the day, as a typed entry does.
 */
export function entryOfShortcut({ shortcut, parts }: ShortcutWithParts, day: CivilDate, newKey: () => string = newRecordId): ItemizedRow {
  const [first] = parts
  if (first === undefined) throw new Error(words.noPart)
  const whole = newEntry({ account: shortcut.account, date: day, amount: shortcutAmount(parts), payee: shortcut.payee, category: first.category, note: first.note, labels: first.labels })
  if (parts.length === 1) return whole
  return {
    row: whole.row,
    items: parts.map((part) => ({
      id: recordIdOf(ITEM_RECORDS, newKey()),
      transaction: whole.row.id,
      receipt: null,
      printed: '',
      note: part.note,
      amount: part.amount,
      category: part.category,
      payee: '',
      link: null,
      labels: part.labels,
      ruleLabels: [],
      event: BY_DAYS,
      sharedCost: null,
      splitByLink: false,
    })),
  }
}

/** Adds the entry the shortcut writes on the day, and gives it back. */
export function addEntryFromShortcut(unit: UnitOfWork, records: Pick<SpendingRecords, 'transactions' | 'lines' | 'items' | 'receipts'>, held: ShortcutWithParts, day: CivilDate): ItemizedRow {
  const entry = entryOfShortcut(held, day)
  writeRows(unit, records, [{ before: null, after: entry.row, items: entry.items }])
  return entry
}
