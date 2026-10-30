import type { DocumentHome, Rewrite, StoredDocument } from '../application/documentHome'
import type { RecordChange, StoragePreview } from '../application/recordStorage'
import type { CopyStorage, WorkbookCopy } from '../application/workbookPorts'
import { WorkbookWriteRefused } from '../application/workbookWriteRefused'
import { identityOf, labelOfRecord } from '../domain/recordCodec'
import type { CodecOfKind } from '../domain/recordCodec'
import type { RecordFields } from '../domain/recordFields'
import { recordIdOf } from '../domain/recordId'
import type { RecordKind } from '../domain/recordKind'
import { sameRecord } from '../domain/recordsRead'
import type { RecordsRead, RefusedRecord, StoredRecord } from '../domain/recordsRead'
import { refusalOr } from '../domain/storedFields'
import type { FreshRecords } from '../domain/writeRules'
import { NEWER_FILE, decodeDocument, encodeDocument, savedByNewerApp, storedFieldsOfDocument } from './documentFormat'
import type { DocumentRecord, WorkbookDocument } from './documentFormat'
import { words } from './words'

/** The copy of the workbook the store holds: the document whole, at the revision its home held it. */
export interface DocumentCopy extends WorkbookCopy {
  readonly revision: string
  readonly document: WorkbookDocument
}

/** One record of the document as its kind's factory reads it, or refuses it. */
function storedOfDocument<R>(kind: RecordKind<R>, record: DocumentRecord, codecOf: CodecOfKind): StoredRecord<R> {
  const codec = codecOf(kind)
  const fields = storedFieldsOfDocument(record)
  const key = codec.key(fields)
  const id = key === null ? null : recordIdOf(kind, key)
  const label = codec.label(fields)
  const read = refusalOr(() => codec.make(fields, id))
  return 'made' in read ? { record: read.made, id, label, fields } : { id, label, fields, reason: read.refused }
}

/** What the document holds of a kind, in the order it holds them. */
export function recordsOfDocument<R>(document: WorkbookDocument, kind: RecordKind<R>, codecOf: CodecOfKind): RecordsRead<R> {
  const stored = (document.records[kind.name] ?? []).map((record) => storedOfDocument(kind, record, codecOf))
  return {
    records: stored.filter((candidate) => 'record' in candidate),
    refused: stored.filter((candidate): candidate is RefusedRecord => !('record' in candidate)),
  }
}

/** The records of a document as a write reads them, each kind read once. */
function freshRecordsOf(document: WorkbookDocument, codecOf: CodecOfKind): FreshRecords {
  const read = new Map<string, RecordsRead<unknown>>()
  return {
    of<R>(kind: RecordKind<R>): RecordsRead<R> {
      const records = read.get(kind.name) ?? recordsOfDocument(document, kind, codecOf)
      read.set(kind.name, records)
      return records as RecordsRead<R>
    },
  }
}

/** The index of the one record a change names: by its identity and the record it reads as, or for a refused one by its identity and fields. */
function indexOfRecord(kind: RecordKind<unknown>, records: readonly DocumentRecord[], change: Exclude<RecordChange, { readonly verb: 'add' }>, codecOf: CodecOfKind): number {
  const holds = (record: DocumentRecord): boolean => {
    const stored = storedOfDocument(kind, record, codecOf)
    if (change.verb === 'repair' || change.verb === 'discard') {
      return !('record' in stored) && stored.id === change.refused.id && sameRecord(stored.fields, change.refused.fields)
    }
    return 'record' in stored && stored.id !== null && stored.id === identityOf(codecOf(kind), change.before) && sameRecord(stored.record, change.before)
  }
  const holding = records.flatMap((record, index) => (holds(record) ? [index] : []))
  if (holding.length !== 1) {
    throw new WorkbookWriteRefused(words.notOnce(kind.noun))
  }
  return holding[0]!
}

/** The record with the fields a change alters set to their new values, a cleared one taken out, and every other field kept. */
function withAltered(record: DocumentRecord, before: RecordFields, after: RecordFields): DocumentRecord {
  const merged: Record<string, unknown> = { ...record }
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (sameRecord(before[name], after[name])) continue
    if (after[name] === undefined) {
      delete merged[name]
    } else {
      merged[name] = after[name]
    }
  }
  return merged
}

/**
 * A refused record repaired: the fields of the fixed record, and of the stored ones it does not
 * name, those that leave the record it reads as unchanged. So a field the app does not know stays,
 * and a field the fix left blank goes.
 */
function repaired<R>(kind: RecordKind<R>, record: DocumentRecord, after: R, codecOf: CodecOfKind): DocumentRecord {
  const fields = codecOf(kind).fieldsOf(after)
  const reads = (candidate: DocumentRecord): boolean => {
    const stored = storedOfDocument(kind, candidate, codecOf)
    return 'record' in stored && sameRecord(stored.record, after)
  }
  const kept = Object.entries(record).filter(([name, value]) => !(name in fields) && reads({ ...fields, [name]: value }))
  return { ...Object.fromEntries(kept), ...fields }
}

/** What a document holds once the changes are made on it, and each change's record as it then holds it, null for a removal. */
function changedDocument(
  document: WorkbookDocument,
  changes: readonly RecordChange[],
  savedAt: string,
  schema: WorkbookDocument['schema'],
  codecOf: CodecOfKind,
): { readonly document: WorkbookDocument; readonly written: readonly (DocumentRecord | null)[] } {
  if (savedByNewerApp(document, schema)) {
    throw new WorkbookWriteRefused(NEWER_FILE)
  }
  const records: Record<string, DocumentRecord[]> = Object.fromEntries(Object.entries(document.records).map(([name, held]) => [name, [...held]]))
  const written = changes.map((change): DocumentRecord | null => {
    const kind = change.kind
    const held = (records[kind.name] ??= [])
    const codec = codecOf(kind)
    if (change.verb === 'add') {
      const added = codec.fieldsOf(change.after)
      held.push(added)
      return added
    }
    const index = indexOfRecord(kind, held, change, codecOf)
    if (change.verb === 'remove' || change.verb === 'discard') {
      held.splice(index, 1)
      return null
    }
    const after = change.verb === 'change' ? withAltered(held[index]!, codec.fieldsOf(change.before), codec.fieldsOf(change.after)) : repaired(kind, held[index]!, change.after, codecOf)
    held[index] = after
    return after
  })
  return { document: { ...document, schema, savedAt, records }, written }
}

/** The records of a document, as one write reads, checks and changes them, with nothing stored. */
function documentRecords(document: WorkbookDocument, schema: WorkbookDocument['schema'], codecOf: CodecOfKind, now: () => string) {
  return {
    async read(): Promise<FreshRecords> {
      return freshRecordsOf(document, codecOf)
    },
    identify<R>(kind: RecordKind<R>, record: R) {
      return identityOf(codecOf(kind), record)
    },
    labelOf<R>(kind: RecordKind<R>, record: R) {
      return labelOfRecord(codecOf(kind), record)
    },
    preview(changes: readonly RecordChange[]): StoragePreview {
      const changed = changedDocument(document, changes, now(), schema, codecOf)
      return {
        records: freshRecordsOf(changed.document, codecOf),
        written: changes.map((change, index) => {
          const record = changed.written[index] ?? null
          return record === null ? null : storedOfDocument(change.kind, record, codecOf)
        }),
      }
    },
    changed(changes: readonly RecordChange[]): WorkbookDocument {
      return changedDocument(document, changes, now(), schema, codecOf).document
    },
  }
}

/** The document as text in its home, the form a home reads and stores. */
function storedOf(revision: string, document: WorkbookDocument): StoredDocument {
  return { revision, text: encodeDocument(document) }
}

/**
 * Records kept in one document in its home, a Drive file or this browser. A read decodes the
 * document and makes each record with its kind's factory. A write works out the next document in
 * memory: an added record goes at the end of its kind, a changed one takes the fields the change
 * alters, and a removed one leaves. The home then stores the document whole, so a write is all or
 * nothing, and runs the write's checks again on another device's save that landed at the same moment.
 */
export function documentRecordStorage(home: DocumentHome, held: DocumentCopy, schema: WorkbookDocument['schema'], codecOf: CodecOfKind, now: () => string): CopyStorage<DocumentCopy> {
  let current: { readonly revision: string; readonly document: WorkbookDocument } = { revision: held.revision, document: held.document }
  let cached: StoredDocument | null = null

  async function readHome(): Promise<void> {
    cached ??= storedOf(current.revision, current.document)
    const stored = await home.read(cached)
    if (stored !== cached) {
      cached = stored
      current = { revision: stored.revision, document: decodeDocument(stored.text) }
    }
  }

  function view(): ReturnType<typeof documentRecords> {
    return documentRecords(current.document, schema, codecOf, now)
  }

  /** Set once the home stored this write, whose document is then what the write reads back, with nothing downloaded. */
  let saved = false

  return {
    async read() {
      if (!saved) {
        await readHome()
      }
      return view().read()
    },

    async readAgain() {
      saved = false
      await readHome()
    },

    readBack(copy) {
      return { ...copy, revision: current.revision, document: current.document }
    },

    identify: (kind, record) => view().identify(kind, record),

    labelOf: (kind, record) => view().labelOf(kind, record),

    preview: (changes) => view().preview(changes),

    async apply(changes, recheck) {
      const base = cached ?? storedOf(current.revision, current.document)
      const next = view().changed(changes)
      const rewrite = async (other: string): Promise<Rewrite> => {
        const otherRecords = documentRecords(decodeDocument(other), schema, codecOf, now)
        try {
          await recheck(otherRecords)
        } catch (failure) {
          if (failure instanceof WorkbookWriteRefused) {
            return { kind: 'refused', reason: failure.message }
          }
          throw failure
        }
        return { kind: 'rewritten', text: encodeDocument(otherRecords.changed(changes)) }
      }
      const stored = await home.save(base, encodeDocument(next), rewrite)
      if (stored.kind === 'moved') {
        return 'moved'
      }
      if (stored.kind === 'refused') {
        throw new WorkbookWriteRefused(stored.reason)
      }
      cached = stored.document
      current = { revision: stored.document.revision, document: decodeDocument(stored.document.text) }
      saved = true
      return 'applied'
    },
  }
}

/** A new document for the app, at the schema it writes, holding these records by the kind's name. */
export function newDocument(app: string, schema: WorkbookDocument['schema'], records: Readonly<Record<string, readonly DocumentRecord[]>>, savedAt: string): WorkbookDocument {
  return { app, schema, savedAt, records }
}
