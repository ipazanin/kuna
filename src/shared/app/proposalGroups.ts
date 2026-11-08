import type { CheckedWrite } from '../storage/application/recordWrites'
import type { RecordKind, RecordNoun } from '../storage/domain/recordKind'
import type { ProposalField, ProposalGroup, ProposalLine } from './assistantOperations'
import { words } from './words'

/** A record of a change as the storage holds it, read field by field. */
export type ProposedRecord = Readonly<Record<string, unknown>>

/** How an app's card reads the records of a change, in the words its screens use. */
export interface ProposalDescriber {
  /** The fields Kuna keeps by itself, which no operation sets, so a card leaves them off. */
  readonly keptByKuna: ReadonlySet<string>
  /** A field's name on the card. */
  fieldName(field: string): string
  /** A value as a person reads it on screen, or null for none. */
  shown(kind: RecordKind<unknown>, field: string, record: ProposedRecord): string | null
  /** What the record is called on screen, or the write's own label when the app has no better one. */
  label(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string): string
  /** Whether the field says where money or mail goes, from the record as it will be held, null for a removal, and as it was, null for an add. */
  warns(kind: RecordKind<unknown>, field: string, after: ProposedRecord | null, before: ProposedRecord | null): boolean
  /** Whether the change files a row a person confirmed under another category. Without it, no change does. */
  movesConfirmed?(kind: RecordKind<unknown>, before: ProposedRecord, after: ProposedRecord): boolean
}

function lineOf(describer: ProposalDescriber, kind: RecordKind<unknown>, fallback: string, before: ProposedRecord | null, after: ProposedRecord | null): ProposalLine {
  const names = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter((field) => !describer.keptByKuna.has(field))
  const altered = before !== null && after !== null ? names.filter((field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])) : after !== null ? names : []
  const fields = altered.flatMap((field): ProposalField[] => {
    const was = before === null ? null : describer.shown(kind, field, before)
    const will = after === null ? null : describer.shown(kind, field, after)
    return was === null && will === null ? [] : [{ name: describer.fieldName(field), before: was, after: will, warns: describer.warns(kind, field, after, before) }]
  })
  const shown = after ?? before
  const movesConfirmed = before !== null && after !== null && describer.movesConfirmed?.(kind, before, after) === true
  return {
    label: shown === null ? fallback : describer.label(kind, shown, fallback),
    fields: [...fields.filter((field) => field.warns), ...fields.filter((field) => !field.warns)],
    warning: movesConfirmed ? words.confirmedRowMoves : null,
  }
}

/** What a checked write does, grouped by verb and kind in the order it does it, in Kuna's words and never the model's, each kind read by its describer. A repair or a discard shows no line. */
export function proposalGroups(checked: CheckedWrite, describerOf: (kind: RecordKind<unknown>) => ProposalDescriber): readonly ProposalGroup[] {
  const groups = new Map<string, { verb: ProposalGroup['verb']; noun: RecordNoun; lines: ProposalLine[] }>()
  checked.changes.forEach(({ change }, at) => {
    if (change.verb === 'repair' || change.verb === 'discard') return
    const key = `${change.verb}/${change.kind.name}`
    const group = groups.get(key) ?? { verb: change.verb, noun: change.kind.noun, lines: [] }
    groups.set(key, group)
    const fallback = checked.written[at]?.label ?? checked.found[at]?.label ?? ''
    const before = change.verb === 'add' ? null : (change.before as ProposedRecord)
    const after = change.verb === 'remove' ? null : (change.after as ProposedRecord)
    group.lines.push(lineOf(describerOf(change.kind), change.kind, fallback, before, after))
  })
  return [...groups.values()]
}
