import { parseCivilDate, serialFromCivilDate } from '../../../shared/calendar/civilDate'
import { ibanListOf } from '../../workbook/domain/iban'
import type { RecordId } from '../../workbook/domain/recordId'
import type { Reading, RecordsRead } from '../../workbook/domain/recordsRead'
import { refusalOr, storedFieldOf } from '../../workbook/domain/storedFields'
import type { StoredField, StoredFields } from '../../workbook/domain/storedFields'
import type { StoredRecord } from '../../workbook/domain/recordsRead'

/**
 * What an editor field holds and how its text becomes a stored value. A word is stored in lower
 * case, a date as a date, a percent typed as 10 as 0.1, a flag as TRUE or blank, a list of IBANs
 * without their grouping spaces and separated by commas, and `amount-or-word` takes a number or a
 * keyword such as whole.
 */
export type DraftCellKind = 'text' | 'word' | 'date' | 'amount' | 'whole-number' | 'percent' | 'flag' | 'amount-or-word' | 'iban-list'

/** Reads another field of the same record as lower-case text, so a field's kind can follow it. */
export type FieldReader = (column: string) => string

export interface DraftColumn {
  readonly name: string
  readonly kind: DraftCellKind
  /** Overrides `kind` for a column whose stored type depends on the rest of the record. */
  readonly kindOf?: (fieldOf: FieldReader) => DraftCellKind
}

/** One record of an editor, as the text in its fields. */
export interface RecordDraft {
  /** Where the record this draft was read from stands among the records the editor opened with, or null for a record added in the editor. */
  readonly saved: number | null
  readonly fields: Readonly<Record<string, string>>
}

/** Makes a record of the kind from its fields, keeping the id it was stored with where the kind has no business key. Refuses by throwing, as a kind's factory does. */
export type DraftFactory<R> = (fields: StoredFields, storedId: RecordId | null) => R

export function kindOfColumn(column: DraftColumn, fieldOf: FieldReader): DraftCellKind {
  return column.kindOf?.(fieldOf) ?? column.kind
}

/** The drafts of stored records, in the order the records are given. */
export function draftsOfRecords(stored: readonly StoredRecord<unknown>[], columns: readonly DraftColumn[]): RecordDraft[] {
  return stored.map((record, saved) => {
    const fieldOf: FieldReader = (column) => (record.fields[column]?.text ?? '').toLowerCase()
    return { saved, fields: Object.fromEntries(columns.map((column) => [column.name, draftTextOf(record.fields[column.name], kindOfColumn(column, fieldOf))])) }
  })
}

/** The fields each draft gives, over the fields its stored record holds, so a field the editor does not show keeps what is stored. A blank field is absent. */
export function fieldsOfDrafts(drafts: readonly RecordDraft[], columns: readonly DraftColumn[], stored: readonly StoredRecord<unknown>[]): StoredFields[] {
  return drafts.map((draft) => {
    const fieldOf: FieldReader = (column) => (draft.fields[column] ?? '').trim().toLowerCase()
    const fields: Record<string, StoredField> = { ...(draft.saved === null ? {} : (stored[draft.saved]?.fields ?? {})) }
    for (const column of columns) {
      const value = valueOfDraftText(draft.fields[column.name] ?? '', kindOfColumn(column, fieldOf))
      if (value === '') {
        delete fields[column.name]
      } else {
        fields[column.name] = storedFieldOf(value)
      }
    }
    return fields
  })
}

export function draftTextOf(field: StoredField | undefined, kind: DraftCellKind): string {
  if (field === undefined) return ''
  switch (kind) {
    case 'date':
      return field.date ?? field.text
    case 'percent':
      return field.number === null ? field.text : String(Math.round(field.number * 1_000_000) / 10_000)
    case 'flag':
      return field.flag === true || field.text.toLowerCase() === 'true' ? 'TRUE' : ''
    default:
      return field.text
  }
}

/**
 * The value a field's text becomes. Text that does not fit the kind is kept as text, so the kind's
 * factory reports it the way it would report it in the file.
 */
export function valueOfDraftText(text: string, kind: DraftCellKind): string | number | boolean {
  const trimmed = text.trim()
  if (trimmed === '') return ''
  const number = Number(trimmed)
  switch (kind) {
    case 'date': {
      const date = parseCivilDate(trimmed)
      return date === null ? trimmed : serialFromCivilDate(date)
    }
    case 'amount':
    case 'whole-number':
      return Number.isFinite(number) ? number : trimmed
    case 'percent':
      return Number.isFinite(number) ? number / 100 : trimmed
    case 'flag':
      return trimmed === 'TRUE'
    case 'amount-or-word':
      return Number.isFinite(number) ? number : trimmed.toLowerCase()
    case 'word':
      return trimmed.toLowerCase()
    case 'iban-list':
      return ibanListOf(trimmed).join(', ')
    case 'text':
      return trimmed
  }
}

/** One draft as its kind's factory takes it: the record it makes, or why it refuses the fields. */
export type MadeDraft<R> = { readonly saved: number | null; readonly record: R } | { readonly saved: number | null; readonly refused: string }

/** Each draft's fields made into a record, keeping the id of the record it was read from. */
export function madeOfDrafts<R>(drafts: readonly Pick<RecordDraft, 'saved'>[], fields: readonly StoredFields[], stored: readonly StoredRecord<unknown>[], make: DraftFactory<R>): MadeDraft<R>[] {
  return drafts.map((draft, index) => {
    const made = refusalOr(() => make(fields[index]!, draft.saved === null ? null : (stored[draft.saved]?.id ?? null)))
    return 'made' in made ? { saved: draft.saved, record: made.made } : { saved: draft.saved, refused: made.refused }
  })
}

/**
 * What the kind's reader says of each draft once saved: whether it counts, and every reason given
 * for it. A draft its factory refuses is left out with that reason. A draft is known to the reader
 * by its record's id.
 */
export function draftOutcomes<R extends { readonly id: RecordId }>(
  made: readonly MadeDraft<R>[],
  fields: readonly StoredFields[],
  read: (records: RecordsRead<R>) => Reading<{ readonly id: RecordId }>,
): { readonly kept: boolean; readonly reasons: readonly string[] }[] {
  const records = made.flatMap((draft, index) => ('record' in draft ? [{ record: draft.record, id: draft.record.id, label: `draft ${index + 1}`, fields: fields[index]! }] : []))
  const reading = read({ records, refused: [] })
  return made.map((draft) => {
    if ('refused' in draft) return { kept: false, reasons: [draft.refused] }
    const reasons = reading.problems.filter((problem) => problem.id === draft.record.id).map((problem) => problem.reason)
    return { kept: reading.facts.some((fact) => fact.id === draft.record.id), reasons: [...new Set(reasons)] }
  })
}
