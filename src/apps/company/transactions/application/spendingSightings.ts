import { linksNaming } from '../../../../shared/app/rowLinks'
import type { AppLinkedRows } from '../../../../shared/app/rowLinks'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { installedPack } from '../../packs/packContribution'
import { LEDGER_RECORDS } from '../../workbook/domain/coreKinds'
import type { Transaction } from '../../workbook/domain/workbook'
import type { ListedRow } from '../domain/listedRows'

/** The records of Company's that rows in your other apps link to: ledger rows by their row id, and costs the owner paid by their id. */
export interface LinkedElsewhere {
  readonly rows: ReadonlySet<string>
  readonly advances: ReadonlySet<RecordId>
}

const NONE: LinkedElsewhere = { rows: new Set(), advances: new Set() }

/**
 * The records of Company's that rows in your other apps link to, such as a salary payment or a cost the owner paid linked to its
 * row in Spending, with the kind the pack keeps the costs in. While an app's links cannot be read none is given, since the mark
 * only says what is known.
 */
export function linkedElsewhereFrom(linked: readonly AppLinkedRows[], companyApp: string, advanceRecords: RecordKind | null): LinkedElsewhere {
  const links = linksNaming(linked, companyApp)
  if (links === 'unchecked') return NONE
  const targets = links.map(({ target }) => target)
  return {
    rows: new Set(targets.filter((target) => target.kind === LEDGER_RECORDS.name).map((target) => target.key)),
    advances: new Set(advanceRecords === null ? [] : targets.filter((target) => target.kind === advanceRecords.name).map((target) => recordIdOf(advanceRecords, target.key))),
  }
}

let readSightings: () => LinkedElsewhere = () => NONE

/** Keeps how Company reads the records other apps link to, which `app.ts` builds from what the shell hands over as Company installs. */
export function readSightingsThrough(read: () => readonly AppLinkedRows[], companyApp: string): void {
  readSightings = () => linkedElsewhereFrom(read(), companyApp, installedPack().ownerAdvanceRecords)
}

/** The records of Company's linked in your other apps now. */
export function linkedElsewhere(): LinkedElsewhere {
  return readSightings()
}

/** Whether a listed row's bank row or cost the owner paid is linked elsewhere. A part of a split or shared row counts as its row. */
export function isLinkedElsewhere(seen: LinkedElsewhere, row: ListedRow | Transaction): boolean {
  if ('advance' in row) return seen.advances.has(row.advance.id)
  return row.rowId !== null && seen.rows.has(row.rowId)
}
