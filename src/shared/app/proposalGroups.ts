import type { CheckedWrite } from '../storage/application/recordWrites'
import type { RecordKind, RecordNoun } from '../storage/domain/recordKind'
import type { CardNote, ProposalField, ProposalGroup, ProposalLine } from './assistantOperations'
import { words } from './words'

/** A record of a change as the storage holds it, read field by field. */
export type ProposedRecord = Readonly<Record<string, unknown>>

/** How an app's card reads the records of a change, in the words its screens use. */
export interface ProposalDescriber {
  /** The fields Kuna keeps by itself, which no operation sets, so a card leaves them off. */
  readonly keptByKuna: ReadonlySet<string>
  /** A field's name on the card, which may depend on the record, as it will be held or as it was for a removal. */
  fieldName(field: string, record: ProposedRecord): string
  /** A value as a person reads it on screen, or null for none. */
  shown(kind: RecordKind<unknown>, field: string, record: ProposedRecord): string | null
  /** What the record is called on screen, or the write's own label when the app has no better one. */
  label(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string): string
  /** Whether the field says where money or mail goes, from the record as it will be held, null for a removal, and as it was, null for an add. */
  warns(kind: RecordKind<unknown>, field: string, after: ProposedRecord | null, before: ProposedRecord | null): boolean
  /** The values a new record of the kind has unless a person sets them, which an add or a removal leaves off its line. A change still shows them. */
  defaultsOf?(kind: RecordKind<unknown>): ProposedRecord
  /** The fields a record's label already names, which an add or a removal leaves off its line. A change still shows them. */
  inLabel?(kind: RecordKind<unknown>): ReadonlySet<string>
  /** Whether the change files a row a person confirmed under another category. Without it, no change does. */
  movesConfirmed?(kind: RecordKind<unknown>, before: ProposedRecord, after: ProposedRecord): boolean
  /** The line with what the app checks of the record as it will be held, such as a figure set beside a document's. Without it, a line shows only the fields. */
  checked?(kind: RecordKind<unknown>, record: ProposedRecord, line: ProposalLine): ProposalLine
}

/**
 * A record's line. A change shows the fields it alters. An add shows what the new record holds, and a removal what the record held,
 * each without the defaults a new record has and the fields its label names.
 */
function lineOf(describer: ProposalDescriber, kind: RecordKind<unknown>, fallback: string, before: ProposedRecord | null, after: ProposedRecord | null): ProposalLine {
  const shown = after ?? before
  const whole = before === null || after === null
  const labelled = whole ? (describer.inLabel?.(kind) ?? new Set<string>()) : new Set<string>()
  const names = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((field) => !describer.keptByKuna.has(field) && !labelled.has(field))
  const defaults = describer.defaultsOf?.(kind) ?? {}
  const altered =
    before !== null && after !== null
      ? names.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
      : names.filter((field) => !(field in defaults) || JSON.stringify(defaults[field]) !== JSON.stringify(shown?.[field]))
  const fields = altered.flatMap((field): ProposalField[] => {
    const was = before === null ? null : describer.shown(kind, field, before)
    const will = after === null ? null : describer.shown(kind, field, after)
    return was === null && will === null ? [] : [{ name: describer.fieldName(field, shown ?? {}), before: was, after: will, warns: describer.warns(kind, field, after, before) }]
  })
  const movesConfirmed = before !== null && after !== null && describer.movesConfirmed?.(kind, before, after) === true
  const line: ProposalLine = {
    label: shown === null ? fallback : describer.label(kind, shown, fallback),
    fields: [...fields.filter((field) => field.warns), ...fields.filter((field) => !field.warns)],
    warning: movesConfirmed ? words.confirmedRowMoves : null,
  }
  return after === null || describer.checked === undefined ? line : describer.checked(kind, after, line)
}

/**
 * What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's, each kind
 * read by its describer. A repaired row shows as a change with every field it will hold, and a discarded one as a removal by its label.
 */
export function proposalGroups(checked: CheckedWrite, describerOf: (kind: RecordKind<unknown>) => ProposalDescriber): readonly ProposalGroup[] {
  const groups = new Map<string, { verb: ProposalGroup['verb']; noun: RecordNoun; notes: readonly []; lines: ProposalLine[] }>()
  checked.changes.forEach(({ change }, at) => {
    const verb = change.verb === 'repair' ? 'change' : change.verb === 'discard' ? 'remove' : change.verb
    const key = `${verb}/${change.kind.name}`
    const group = groups.get(key) ?? { verb, noun: change.kind.noun, notes: [], lines: [] }
    groups.set(key, group)
    const fallback = checked.written[at]?.label ?? checked.found[at]?.label ?? ('refused' in change ? change.refused.label : '')
    const before = change.verb === 'change' || change.verb === 'remove' ? (change.before as ProposedRecord) : null
    const after = change.verb === 'add' || change.verb === 'change' || change.verb === 'repair' ? (change.after as ProposedRecord) : null
    group.lines.push(lineOf(describerOf(change.kind), change.kind, fallback, before, after))
  })
  return [...groups.values()]
}

/** The notes on the first group of their kind, in the order given, or on a group of their own with no lines when the card writes nothing of that kind. */
export function withNotes(groups: readonly ProposalGroup[], notes: readonly CardNote[]): readonly ProposalGroup[] {
  return notes.reduce((shown, { noun, note }) => {
    const at = shown.findIndex((group) => group.noun === noun)
    return at < 0 ? [...shown, { verb: 'change', noun, notes: [note], lines: [] }] : shown.map((group, place) => (place === at ? { ...group, notes: [...group.notes, note] } : group))
  }, groups)
}
