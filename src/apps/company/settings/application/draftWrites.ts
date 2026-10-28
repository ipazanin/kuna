import type { Repository } from '../../../../shared/storage/application/repository'
import { sameRecord } from '../../../../shared/storage/domain/recordsRead'
import type { StoredRecord } from '../../../../shared/storage/domain/recordsRead'

/**
 * What an editor's save does to the kind's records: each stored record a draft holds is changed to
 * the record the draft makes, or repaired when it was refused, each draft without a stored record is
 * added, and each stored record no draft holds is removed. A record the draft leaves as it was
 * stored is left alone.
 */
export function writeDrafts<R>(records: Repository<R>, stored: readonly StoredRecord<R>[], made: readonly { readonly saved: number | null; readonly record: R }[]): void {
  const kept = new Set(made.flatMap((draft) => (draft.saved === null ? [] : [draft.saved])))
  for (const draft of made) {
    const held = draft.saved === null ? undefined : stored[draft.saved]
    if (held === undefined) {
      records.add(draft.record)
    } else if (!('record' in held)) {
      records.repair(held, draft.record)
    } else if (!sameRecord(held.record, draft.record)) {
      records.change(held.record, draft.record)
    }
  }
  stored.forEach((held, saved) => {
    if (kept.has(saved)) return
    if ('record' in held) {
      records.remove(held.record)
    } else {
      records.discard(held)
    }
  })
}
