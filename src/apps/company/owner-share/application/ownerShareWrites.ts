import { LEDGER_WRITES } from '../../imports/application/ledgerWrites'
import { installedPack } from '../../packs/packContribution'
import { SPLIT_WRITES } from '../../transactions/application/splitWrites'
import type { Repository, UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import { recordWithId } from '../../../../shared/storage/domain/recordsRead'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import type { OwnerShare, ShareFill, ShareTarget } from '../domain/ownerShare'

interface SharedRecord {
  readonly id: RecordId
  readonly ownerShare: OwnerShare | null
}

/** The share a record takes, from the one it holds. */
type ShareFrom = (held: OwnerShare | null) => OwnerShare | null

function changeShare<R extends SharedRecord>(repository: Repository<R>, read: RecordsRead<R>, id: RecordId, shareFrom: ShareFrom): void {
  const held = recordWithId(read, id)?.record
  if (held === undefined) {
    throw new Error('The row is no longer in the workbook as the app read it. Sync and look again.')
  }
  const share = shareFrom(held.ownerShare)
  if (held.ownerShare !== share) {
    repository.change(held, { ...held, ownerShare: share })
  }
}

/** The installed pack's owner advances. Their records carry the share as core's `OwnerAdvance` does. */
function ownerAdvances(records: WorkbookRecords): { readonly rules: WriteRules<SharedRecord>; readonly read: RecordsRead<SharedRecord> } {
  const part = installedPack().workbook
  const rules = part?.kinds.find((kind) => kind.kind.name === part.ownerAdvanceNaming.kind.name)
  if (part === null || rules === undefined) {
    throw new Error('No pack keeps owner advances in this workbook.')
  }
  return { rules: rules as WriteRules<SharedRecord>, read: recordsOfKindIn(records, part.ownerAdvanceNaming.kind) as RecordsRead<SharedRecord> }
}

function changeShareOf(unit: UnitOfWork, records: WorkbookRecords, target: ShareTarget, shareFrom: ShareFrom): void {
  switch (target.holder) {
    case 'ledger':
      return changeShare(unit.of(LEDGER_WRITES), records.ledger, target.id, shareFrom)
    case 'split-part':
      return changeShare(unit.of(SPLIT_WRITES), records.splits, target.id, shareFrom)
    case 'owner-advance': {
      const advances = ownerAdvances(records)
      return changeShare(unit.of(advances.rules), advances.read, target.id, shareFrom)
    }
  }
}

/** Writes one record's share, found by its id in the records the app read. A blank share clears the cell. */
export function writeOwnerShare(unit: UnitOfWork, records: WorkbookRecords, target: ShareTarget, share: OwnerShare | null): void {
  changeShareOf(unit, records, target, () => share)
}

/** Gives each record of the fills its category's new default, in the same write as the categories. A record that holds a share by then keeps it. */
export function fillShares(unit: UnitOfWork, records: WorkbookRecords, fills: readonly ShareFill[]): void {
  for (const fill of fills) {
    for (const target of fill.targets) {
      changeShareOf(unit, records, target, (held) => held ?? fill.ownerShare)
    }
  }
}
