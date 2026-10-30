import { listInWords } from '../../text/listInWords'
import { plural } from '../../text/translation'
import type { RecordId } from '../domain/recordId'
import type { RecordKind } from '../domain/recordKind'
import { sameRecord, storedOf } from '../domain/recordsRead'
import type { Reading, StoredRecord } from '../domain/recordsRead'
import type { FreshRecords, KindChange, RecordEdit, WriteRules } from '../domain/writeRules'
import type { RecordChange, StorageView } from './recordStorage'
import type { Repository, UnitOfWork } from './repository'
import { words } from './words'
import { refuseOn } from './workbookWriteRefused'

/** One change of a write with the rules of its kind. */
export interface RuledChange {
  readonly rules: WriteRules<unknown>
  readonly change: RecordChange
}

/** One record a write touched: the change as made, with each record as the storage held it before and holds it after, and the words that name it. */
export interface WrittenRecord extends RuledChange {
  readonly label: string
}

/** What one write did, which Undo turns around. */
export interface WriteReceipt {
  readonly title: string
  readonly records: readonly WrittenRecord[]
}

/** A write checked against a fresh read and ready to apply. */
export interface CheckedWrite {
  readonly title: string
  readonly changes: readonly RuledChange[]
  /** Every kind the write touches and every kind their checks read. */
  readonly kinds: readonly RecordKind<unknown>[]
  /** Each change's record as the storage will hold it, null for a removal, in the order of the changes. */
  readonly written: readonly (StoredRecord<unknown> | null)[]
  /** Each change's record as the storage held it, null for an add. */
  readonly found: readonly (StoredRecord<unknown> | null)[]
}

/** The changes a write's work makes through its repositories, in the order it makes them. */
export function changesOf(work: (unit: UnitOfWork) => void): RuledChange[] {
  const changes: RuledChange[] = []
  const finished: unknown = work({
    of<R>(rules: WriteRules<R>): Repository<R> {
      const ruled = rules as WriteRules<unknown>
      const kind = rules.kind as RecordKind<unknown>
      return {
        add: (record) => changes.push({ rules: ruled, change: { kind, verb: 'add', after: record } }),
        change: (before, after) => changes.push({ rules: ruled, change: { kind, verb: 'change', before, after } }),
        remove: (record) => changes.push({ rules: ruled, change: { kind, verb: 'remove', before: record } }),
        repair: (refused, after) => changes.push({ rules: ruled, change: { kind, verb: 'repair', refused, after } }),
        discard: (refused) => changes.push({ rules: ruled, change: { kind, verb: 'discard', refused } }),
      }
    },
  })
  if (finished instanceof Promise) {
    throw new Error('A write must make its changes before it returns. Changes made after an await would be lost.')
  }
  return changes
}

/** Whether Undo can put back what the write did: every kind it touched keeps Undo, and it repaired or discarded no refused record, which nothing could store again. */
export function isUndoable(receipt: WriteReceipt): boolean {
  return receipt.records.every(({ rules, change }) => rules.undoable && change.verb !== 'repair' && change.verb !== 'discard')
}

/** The changes that put back what a write did: its added records removed, its changed ones changed back, its removed ones added again with the same identity. */
export function undoOf(receipt: WriteReceipt): RuledChange[] {
  return receipt.records.map(({ rules, change }): RuledChange => {
    switch (change.verb) {
      case 'add':
        return { rules, change: { kind: change.kind, verb: 'remove', before: change.after } }
      case 'change':
        return { rules, change: { kind: change.kind, verb: 'change', before: change.after, after: change.before } }
      case 'remove':
        return { rules, change: { kind: change.kind, verb: 'add', after: change.before } }
      case 'repair':
      case 'discard':
        throw new Error('A repaired or discarded record has no Undo.')
    }
  })
}

function isRead(stored: StoredRecord<unknown>): stored is Extract<StoredRecord<unknown>, { readonly record: unknown }> {
  return 'record' in stored
}

/** The fields of a record a change alters, by name. */
function alteredFields(before: unknown, after: unknown): string[] {
  const fields = [...new Set([...Object.keys(before as object), ...Object.keys(after as object)])]
  return fields.filter((field) => !sameRecord((before as Readonly<Record<string, unknown>>)[field], (after as Readonly<Record<string, unknown>>)[field]))
}

/**
 * The stored record a change, a repair or a removal names, or why there is not exactly one: found by
 * its identity, then by holding what the app read.
 */
function findStored(storage: StorageView, fresh: FreshRecords, change: Exclude<RecordChange, { readonly verb: 'add' }>): StoredRecord<unknown> | string {
  const stored = storedOf(fresh.of(change.kind))
  if (change.verb === 'repair' || change.verb === 'discard') {
    const holding = stored.filter((candidate) => !isRead(candidate) && candidate.id === change.refused.id && sameRecord(candidate.fields, change.refused.fields))
    const { noun } = change.kind
    const { label } = change.refused
    if (holding.length === 1) return holding[0]!
    return holding.length === 0 ? words.refusals.noLongerAsRead(noun, label) : plural(words.refusals.heldBy(holding.length, noun, label), holding.length)
  }
  const id = storage.identify(change.kind, change.before)
  const sameId = stored.filter((candidate) => id !== null && candidate.id === id)
  const holding = sameId.filter((candidate) => isRead(candidate) && sameRecord(candidate.record, change.before))
  const { noun } = change.kind
  const label = sameId[0]?.label ?? storage.labelOf(change.kind, change.before)
  if (id === null) return words.refusals.nothingToFindBy(noun, label)
  if (holding.length === 1) return holding[0]!
  if (holding.length > 1) return plural(words.refusals.heldBy(holding.length, noun, label), holding.length)
  return sameId.length === 0 ? words.refusals.gone(noun, label) : words.refusals.changedSince(noun, label)
}

/** What a reading says of one record: whether it counts, and every reason given for it. A record without an identity is known by its label. */
function outcomeOf(reading: Reading<{ readonly id: RecordId }>, stored: StoredRecord<unknown>): { readonly kept: boolean; readonly reasons: readonly string[] } {
  const reasons = reading.problems.filter((problem) => (stored.id === null ? problem.id === null && problem.label === stored.label : problem.id === stored.id)).map((problem) => problem.reason)
  return { kept: stored.id !== null && reading.facts.some((fact) => fact.id === stored.id), reasons: [...new Set(reasons)] }
}

/**
 * What the kind's reader says once the change is made: a record the change writes may not be left
 * out or gain a problem, and a record it leaves alone that counts today may not drop out.
 */
function readerRefusals(rules: WriteRules<unknown>, change: KindChange<unknown>, fresh: FreshRecords, after: FreshRecords): string[] {
  const { noun } = rules.kind
  const readBefore = rules.read(change.before, fresh)
  const readAfter = rules.read(change.after, after)
  const refusals: string[] = []
  for (const edit of change.edits) {
    if (edit.after === null) continue
    const { label } = edit.after
    const outcome = outcomeOf(readAfter, edit.after)
    if (!outcome.kept) {
      refusals.push((edit.before === null ? words.refusals.newLeftOut : words.refusals.leftOut)(noun, label, outcome.reasons.join(', ')))
      continue
    }
    const known = edit.before === null ? [] : outcomeOf(readBefore, edit.before).reasons
    const introduced = outcome.reasons.filter((reason) => !known.includes(reason))
    if (introduced.length > 0) {
      refusals.push((edit.before === null ? words.refusals.newProblem : words.refusals.problem)(noun, label, introduced.join(', ')))
    }
  }
  for (const stored of change.untouched) {
    const outcome = outcomeOf(readAfter, stored)
    if (outcomeOf(readBefore, stored).kept && !outcome.kept) {
      refusals.push(words.refusals.leftOutThen(noun, stored.label, outcome.reasons.join(', ')))
    }
  }
  return refusals
}

/**
 * Checks a write on a fresh read, before anything is written: each changed, repaired or removed
 * record is found by its identity and must still hold what the app read, an added record's identity
 * must be free, a change touches only the fields its kind lets it, then each kind's own checks run
 * and its reader must keep every record it kept. Throws `WorkbookWriteRefused` with every reason.
 * Null when no change alters anything.
 */
export async function checkWrite(storage: StorageView, title: string, ruled: readonly RuledChange[], options: { readonly undoing: boolean }): Promise<CheckedWrite | null> {
  const changes = ruled.filter(({ change }) => change.verb !== 'change' || !sameRecord(change.before, change.after))
  if (changes.length === 0) {
    return null
  }
  const ruleSets = [...new Map(changes.map(({ rules }) => [rules.kind.name, rules])).values()]
  const kinds = [...new Map([...ruleSets.map((rules) => rules.kind), ...ruleSets.flatMap((rules) => rules.reads)].map((kind) => [kind.name, kind])).values()]
  const fresh = await storage.read(kinds)

  const refusals: string[] = []
  const claimed = new Set<RecordId | StoredRecord<unknown>>()
  const claim = (claimant: RecordId | StoredRecord<unknown>, kind: RecordKind<unknown>, label: string | null): void => {
    if (claimed.has(claimant)) refusals.push(words.refusals.twice(kind.noun, label))
    claimed.add(claimant)
  }
  const found = changes.map(({ rules, change }): StoredRecord<unknown> | null => {
    if (change.verb === 'add') {
      const id = storage.identify(change.kind, change.after)
      const held = storedOf(fresh.of(change.kind)).find((stored) => id !== null && stored.id === id)
      if (id === null) {
        refusals.push(words.refusals.newWithoutKey(change.kind.noun))
        return null
      }
      if (held !== undefined) {
        refusals.push(words.refusals.alreadyThere(change.kind.noun, held.label))
      }
      claim(id, change.kind, held?.label ?? null)
      return null
    }
    const stored = findStored(storage, fresh, change)
    if (typeof stored === 'string') {
      refusals.push(stored)
      return null
    }
    claim(stored, change.kind, stored.label)
    if ((change.verb === 'repair' || change.verb === 'discard') && rules.changeable !== undefined) {
      refusals.push(words.refusals.fixedInFile(change.kind.noun, stored.label, listInWords(rules.changeable)))
    }
    if (change.verb === 'change' && rules.changeable !== undefined) {
      const changeable = rules.changeable
      const others = alteredFields(change.before, change.after).filter((field) => !changeable.includes(field))
      if (others.length > 0) {
        refusals.push(words.refusals.otherFields(change.kind.noun, stored.label, listInWords(changeable), others.join(', ')))
      }
    }
    return stored
  })
  refuseOn(refusals)

  const preview = storage.preview(changes.map(({ change }) => change))
  const { written } = preview

  const kindRefusals: string[] = []
  const readRefusals: string[] = []
  for (const rules of ruleSets) {
    const indices = changes.flatMap(({ rules: other }, index) => (other.kind.name === rules.kind.name ? [index] : []))
    const before = fresh.of(rules.kind)
    const touched = new Set(indices.map((index) => found[index]).filter((stored) => stored !== null))
    const change: KindChange<unknown> = {
      edits: indices.map((index): RecordEdit<unknown> => ({ before: found[index] ?? null, after: written[index] ?? null })),
      untouched: storedOf(before).filter((stored) => !touched.has(stored)),
      before,
      after: preview.records.of(rules.kind),
      undoing: options.undoing,
    }
    kindRefusals.push(...rules.refusals(change, fresh, preview.records).filter((sentence) => !kindRefusals.includes(sentence)))
    readRefusals.push(...readerRefusals(rules, change, fresh, preview.records))
  }
  // A kind's own checks name the cause, so the reader's account of the same record is held back until they pass.
  refuseOn(kindRefusals)
  refuseOn(readRefusals)
  return { title, changes, kinds, written, found }
}

/**
 * After the write: every record it wrote reads back by its identity as the check expected, and
 * every record it removed is gone. Returns the receipt, with each record as it now reads.
 */
export function receiptOf(checked: CheckedWrite, after: FreshRecords): WriteReceipt {
  const records = checked.changes.map(({ rules, change }, index): WrittenRecord => {
    const before = checked.found[index] ?? null
    if (change.verb === 'remove' || change.verb === 'discard') {
      const left = (stored: StoredRecord<unknown>): boolean => (before === null || before.id === null || stored.id === before.id) && sameRecord(stored.fields, before?.fields)
      if (before === null || storedOf(after.of(change.kind)).some(left)) {
        throw new Error(words.refusals.stillHeld(change.kind.noun, before?.label ?? null))
      }
      return { rules, change: change.verb === 'remove' && isRead(before) ? { ...change, before: before.record } : change, label: before.label }
    }
    const expected = checked.written[index] ?? null
    const read = storedOf(after.of(change.kind)).find((stored) => expected !== null && stored.id === expected.id && sameRecord(stored.fields, expected.fields))
    if (read === undefined || !isRead(read)) {
      throw new Error(words.refusals.notReadBack(change.kind.noun, expected?.label ?? null))
    }
    if (change.verb === 'change' && before !== null && isRead(before)) {
      return { rules, change: { ...change, before: before.record, after: read.record }, label: read.label }
    }
    return { rules, change: { ...change, after: read.record }, label: read.label }
  })
  return { title: checked.title, records }
}
