import { INVESTMENT_KINDS, bookWith } from '../../workbook/application/investmentWriteGuards'
import { CHECK_DEFAULTS } from '../../workbook/domain/checkSetting'
import type { CheckName, CheckSetting } from '../../workbook/domain/checkSetting'
import { CHECK_RECORDS } from '../../workbook/domain/investmentKinds'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { Decimal } from '../../../../shared/money/decimal'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

export const CHECK_WRITES: WriteRules<CheckSetting> = {
  kind: CHECK_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(CHECK_RECORDS, read, records).readings.checks,
  refusals: () => [],
}

/** Keeps a record of the check only while its threshold or its switch differs from the default, and removes it once both are back. */
export function writeCheck(unit: UnitOfWork, held: CheckSetting | null, check: CheckName, threshold: Decimal, on: boolean): void {
  const settings = unit.of(CHECK_WRITES)
  const changed = threshold === CHECK_DEFAULTS[check] ? null : threshold
  if (on && changed === null) {
    if (held !== null) settings.remove(held)
    return
  }
  const wanted = { check, threshold: changed, off: !on }
  if (held === null) settings.add({ ...wanted, id: recordIdOf(CHECK_RECORDS, newRecordId()) })
  else settings.change(held, { ...wanted, id: held.id })
}
