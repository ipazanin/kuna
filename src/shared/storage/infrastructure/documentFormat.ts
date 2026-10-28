import type { FieldValue } from '../domain/recordFields'
import { storedFieldOfValue } from '../domain/storedFields'
import type { StoredFields } from '../domain/storedFields'

/** One record as the file holds it, by field name: text, or a flag. A field the app does not know is kept as the file gave it. */
export type DocumentRecord = Readonly<Record<string, unknown>>

/** The books of one app: the schema version of each contributor and the records of each kind, by the kind's name. */
export interface WorkbookDocument {
  readonly app: string
  readonly schema: Readonly<Record<string, number>>
  /** ISO timestamp of the save that wrote the document. */
  readonly savedAt: string
  readonly records: Readonly<Record<string, readonly DocumentRecord[]>>
}

const FORMAT = 'ledgerboard'

export const NEWER_FILE = 'This file was saved by a newer ledgerboard. Reload to update before you change anything.'

/** Whether a newer app saved the document: a contributor at a higher version than the app's `installed` schema, or one the app lacks. */
export function savedByNewerApp(document: WorkbookDocument, installed: WorkbookDocument['schema']): boolean {
  return Object.entries(document.schema).some(([contributor, version]) => version > (installed[contributor] ?? 0))
}

/**
 * The document as the file holds it: one record per line, so Drive's preview reads it and a
 * revision's diff shows one line per changed record.
 */
export function encodeDocument(document: WorkbookDocument): string {
  const kinds = Object.entries(document.records).map(([name, records]) => {
    const lines = records.map((record) => `      ${JSON.stringify(record)}`)
    return `    ${JSON.stringify(name)}: ${lines.length === 0 ? '[]' : `[\n${lines.join(',\n')}\n    ]`}`
  })
  return [
    '{',
    `  "format": ${JSON.stringify(FORMAT)},`,
    `  "app": ${JSON.stringify(document.app)},`,
    `  "schema": ${JSON.stringify(document.schema)},`,
    `  "savedAt": ${JSON.stringify(document.savedAt)},`,
    `  "records": ${kinds.length === 0 ? '{}' : `{\n${kinds.join(',\n')}\n  }`}`,
    '}',
    '',
  ].join('\n')
}

function isObject(candidate: unknown): candidate is Readonly<Record<string, unknown>> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}

/** The document a file holds. Throws for a file that is not a ledgerboard document. */
export function decodeDocument(text: string): WorkbookDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (failure) {
    throw new Error('The file is not a ledgerboard file: it does not read as JSON.', { cause: failure })
  }
  if (!isObject(parsed) || parsed.format !== FORMAT || typeof parsed.app !== 'string' || !isObject(parsed.schema) || !isObject(parsed.records)) {
    throw new Error('The file is not a ledgerboard file.')
  }
  const schema = Object.entries(parsed.schema)
  const records = Object.entries(parsed.records)
  if (schema.some(([, version]) => typeof version !== 'number') || records.some(([, kind]) => !Array.isArray(kind) || !kind.every(isObject))) {
    throw new Error('The file is not a ledgerboard file: its schema or its records are not in the shape the app writes.')
  }
  return {
    app: parsed.app,
    schema: Object.fromEntries(schema) as Record<string, number>,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    records: Object.fromEntries(records) as Record<string, readonly DocumentRecord[]>,
  }
}

/** A field as the file holds it, as a record's field: text and flags as they are, a number as its decimal text. Anything else is no field the app reads. */
export function fieldValueOf(value: unknown): FieldValue | null {
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null
}

/** A record's filled fields as the domain reads them. */
export function storedFieldsOfDocument(record: DocumentRecord): StoredFields {
  return Object.fromEntries(
    Object.entries(record).flatMap(([name, value]) => {
      const field = fieldValueOf(value)
      return field === null || (typeof field === 'string' && field.trim() === '') ? [] : [[name, storedFieldOfValue(field)]]
    }),
  )
}
