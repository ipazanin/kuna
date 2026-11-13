import { StepRefused } from './proposedWrites'
import type { Repository, UnitOfWork } from '../storage/application/repository'
import { identityOf, labelOfRecord } from '../storage/domain/recordCodec'
import type { RecordCodec } from '../storage/domain/recordCodec'
import type { RecordKind } from '../storage/domain/recordKind'
import type { ReadRecord, RecordsRead, RefusedRecord } from '../storage/domain/recordsRead'
import { sameRecord } from '../storage/domain/recordsRead'
import { storedFieldsOfValues } from '../storage/domain/storedFields'
import type { WriteRules } from '../storage/domain/writeRules'

/** One record a card writes: as read, and as the card's steps leave it. Null before an add, and after a removal. */
interface StagedRecord {
  readonly rules: WriteRules<unknown>
  readonly read: unknown
  current: unknown
}

/** A repair or a discard of a record the reader refused, which no later step can touch. */
interface StagedRepair {
  readonly rules: WriteRules<unknown>
  readonly refused: RefusedRecord
  readonly after: unknown
}

/** How a card reaches one app's records by kind: whether it holds a kind, what it holds of it, the records with a kind put in place, and its codec. */
export interface CardRecordsAccess<Records> {
  holds(records: Records, kind: RecordKind<unknown>): boolean
  of<R>(records: Records, kind: RecordKind<R>): RecordsRead<R>
  with<R>(records: Records, kind: RecordKind<R>, read: RecordsRead<R>): Records
  codecOf<R>(kind: RecordKind<R>): RecordCodec<R>
}

/** The record as a storage holds it: its identity, its label and its fields, which the editors' drafts read. */
function readRecordOf<R>(codec: RecordCodec<R>, record: R, stored: Pick<ReadRecord<R>, 'id' | 'label'> | null): ReadRecord<R> {
  return { record, id: stored?.id ?? identityOf(codec, record), label: stored?.label ?? labelOfRecord(codec, record), fields: storedFieldsOfValues(codec.fieldsOf(record)) }
}

/** What a card's steps see and write: the records as its earlier steps left them, and a unit that adds up every step's changes. */
export interface CardRecords<Records> {
  /** A unit the screens' write functions write through. A record two steps change is changed once, from the record as read to the last step's. */
  readonly unit: UnitOfWork
  /** The records as read, with what the card's steps wrote so far. */
  records(): Records
  /** Writes what the steps add up to into the write itself, one change for each record. */
  writeInto(unit: UnitOfWork): void
}

/**
 * The records a card's steps work on, starting from the app's books on screen. Each step calls a screen's own write functions on
 * the records as the earlier steps left them, and the card writes one change per record, as a write refuses a record changed twice.
 */
export function cardRecords<Records>(read: Records, access: CardRecordsAccess<Records>): CardRecords<Records> {
  const staged: StagedRecord[] = []
  const repairs: StagedRepair[] = []
  /** The record an earlier step wrote that a step now changes, found by what it holds, as a write function may pass a copy of it. */
  const stagedOf = (kind: string, record: unknown): StagedRecord | undefined =>
    staged.find((entry) => entry.rules.kind.name === kind && entry.current !== null && (entry.current === record || sameRecord(entry.current, record)))

  const unit: UnitOfWork = {
    of<R>(rules: WriteRules<R>): Repository<R> {
      const ruled = rules as WriteRules<unknown>
      if (!access.holds(read, rules.kind)) throw new StepRefused(`The chat writes no ${rules.kind.noun.en.many} from this card.`)
      return {
        add: (record) => {
          staged.push({ rules: ruled, read: null, current: record })
        },
        change: (before, after) => {
          const entry = stagedOf(rules.kind.name, before)
          if (entry === undefined) staged.push({ rules: ruled, read: before, current: after })
          else entry.current = after
        },
        remove: (record) => {
          const entry = stagedOf(rules.kind.name, record)
          if (entry === undefined) staged.push({ rules: ruled, read: record, current: null })
          else entry.current = null
        },
        repair: (refused, after) => {
          repairs.push({ rules: ruled, refused, after })
        },
        discard: (refused) => {
          repairs.push({ rules: ruled, refused, after: null })
        },
      }
    },
  }

  function kindNow<R>(kind: RecordKind<R>): RecordsRead<R> {
    const records = access.of(read, kind)
    const codec = access.codecOf(kind)
    const ofKind = staged.filter((entry) => entry.rules.kind.name === kind.name)
    const kept = records.records.flatMap((stored): ReadRecord<R>[] => {
      const entry = ofKind.find((candidate) => candidate.read !== null && (candidate.read === stored.record || sameRecord(candidate.read, stored.record)))
      if (entry === undefined) return [stored]
      return entry.current === null ? [] : [readRecordOf(codec, entry.current as R, stored)]
    })
    const added = ofKind.flatMap((entry): ReadRecord<R>[] => (entry.read === null && entry.current !== null ? [readRecordOf(codec, entry.current as R, null)] : []))
    return { records: [...kept, ...added], refused: records.refused.filter((refused) => !repairs.some((repair) => repair.refused === refused)) }
  }

  return {
    unit,
    records() {
      const touched = new Map([...staged, ...repairs].map(({ rules }) => [rules.kind.name, rules.kind]))
      return [...touched.values()].reduce((now, kind) => access.with(now, kind, kindNow(kind)), read)
    },
    writeInto(written) {
      for (const { rules, refused, after } of repairs) {
        if (after === null) written.of(rules).discard(refused)
        else written.of(rules).repair(refused, after)
      }
      for (const { rules, read: before, current } of staged) {
        const records = written.of(rules)
        if (before === null && current !== null) records.add(current)
        else if (before !== null && current === null) records.remove(before)
        else if (before !== null && current !== null && !sameRecord(before, current)) records.change(before, current)
      }
    },
  }
}
