import type { ImportedRecord, WorkbookDryRun } from './importDryRun'

/** A record an earlier import wrote whose row the workbook changed, beside the record the changed row makes now. */
export interface EditedRecord {
  readonly gone: ImportedRecord
  readonly now: ImportedRecord
}

export interface GoneFromWorkbook {
  readonly edited: readonly EditedRecord[]
  /** Gone records no new row looks like an edit of. */
  readonly removed: readonly ImportedRecord[]
}

/**
 * The records gone from the workbook, each beside the new record of the same kind, day, accounts and instrument where
 * there is one, since that is the row as the workbook writes it now. Each new record stands beside one gone record at most.
 */
export function goneFromWorkbook(dryRun: Pick<WorkbookDryRun, 'gone' | 'entries'>): GoneFromWorkbook {
  const fresh = dryRun.entries.flatMap((entry) => (entry.outcome.kind === 'new' ? [entry.outcome.imported] : []))
  const taken = new Set<ImportedRecord>()
  const edited: EditedRecord[] = []
  const removed: ImportedRecord[] = []
  for (const gone of dryRun.gone) {
    const now = fresh.find((candidate) => !taken.has(candidate) && sameFacts(gone, candidate))
    if (now === undefined) {
      removed.push(gone)
    } else {
      taken.add(now)
      edited.push({ gone, now })
    }
  }
  return { edited, removed }
}

function sameFacts(first: ImportedRecord, second: ImportedRecord): boolean {
  return first.kind === second.kind && first.record.date === second.record.date && namesOf(first).join() === namesOf(second).join()
}

/** The accounts and instruments a record names, with a trade's side and a cash movement's kind, in a fixed order. */
function namesOf(imported: ImportedRecord): readonly (string | null)[] {
  switch (imported.kind) {
    case 'trade':
      return [imported.record.account, imported.record.instrument, imported.record.side]
    case 'income':
      return [imported.record.account, imported.record.instrument]
    case 'cash-movement':
      return [imported.record.account, imported.record.kind]
    case 'exchange':
      return [imported.record.account]
    case 'transfer':
      return [imported.record.from, imported.record.to, imported.record.moved.kind === 'units' ? imported.record.moved.instrument : null]
    case 'split':
      return [imported.record.instrument]
    case 'spin-off':
      return [imported.record.instrument, imported.record.received]
  }
}
