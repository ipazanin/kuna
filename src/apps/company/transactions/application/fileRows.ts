import { LEDGER_WRITES } from '../../imports/application/ledgerWrites'
import type { ShareDefault } from '../../owner-share/domain/ownerShare'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import { recordWithId } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { withVerdict } from '../domain/verdictChanges'
import type { RowVerdict } from '../domain/verdictChanges'

/** Files each ledger row under its new verdict with its category's default share, the row as the app read it. A row the records on screen no longer hold is left out. */
export function fileRows(unit: UnitOfWork, ledger: RecordsRead<LedgerEntry>, verdicts: readonly RowVerdict[], categories: readonly ShareDefault[]): void {
  const rows = unit.of(LEDGER_WRITES)
  for (const { id, verdict } of verdicts) {
    const entry = recordWithId(ledger, id)?.record
    if (entry !== undefined) {
      rows.change(entry, withVerdict(entry, verdict, categories))
    }
  }
}
