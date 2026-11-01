import { INVESTMENT_KINDS, bookWith } from '../../workbook/application/investmentWriteGuards'
import type { FundMixLine } from '../../workbook/domain/fundMix'
import { FUND_MIX_RECORDS, TARGET_RECORDS } from '../../workbook/domain/investmentKinds'
import { MIXES } from '../../workbook/domain/mixGroup'
import type { Mix } from '../../workbook/domain/mixGroup'
import type { Target } from '../../workbook/domain/target'
import { words } from './words'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { pickedEdits, pickedUntouched } from '../../../../shared/storage/domain/writeRules'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

/** The lines of one fund and mix add up to 100%, so they are written together. */
export const FUND_MIX_WRITES: WriteRules<FundMixLine> = {
  kind: FUND_MIX_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(FUND_MIX_RECORDS, read, records).readings.fundMixes,
  refusals: () => [],
}

/**
 * The targets of a mix add up to 100%, so they are written together. Targets are set for one mix at a time, so a write
 * that brings in a mix the file does not hold yet must replace every target of the others. Undo puts back what was there.
 */
export const TARGET_WRITES: WriteRules<Target> = {
  kind: TARGET_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(TARGET_RECORDS, read, records).readings.targets,
  refusals: (change) => {
    if (change.undoing) return []
    const mixOf = (fields: StoredFields): string => textOf(fields.mix)
    const kept = new Set(pickedUntouched(change, mixOf))
    const written = pickedEdits(change, mixOf).flatMap((edit) => (edit.after === null ? [] : [edit.after]))
    const added = written.find((mix) => !kept.has(mix))
    const other = [...kept, ...written].find((mix) => mix !== added)
    return added === undefined || other === undefined ? [] : [words.targetsOfTwoMixes(byMix(added), byMix(other))]
  },
}

function byMix(mix: string): string {
  return (MIXES as readonly string[]).includes(mix) ? words.byMix[mix as Mix] : mix
}

/**
 * Leaves rows that only make sense together, such as one fund's mix or the targets, as the wanted ones in one write:
 * the rows held now take them in order, wanted rows beyond them are added with ids of their own, and held rows beyond
 * the wanted ones are removed.
 */
export function replaceRows<Row extends { readonly id: RecordId }>(unit: UnitOfWork, rules: WriteRules<Row>, held: readonly Row[], wanted: readonly Omit<Row, 'id'>[]): void {
  const rows = unit.of(rules)
  wanted.forEach((row, index) => {
    const before = held[index]
    if (before === undefined) rows.add({ ...row, id: recordIdOf(rules.kind, newRecordId()) } as Row)
    else rows.change(before, { ...row, id: before.id } as Row)
  })
  held.slice(wanted.length).forEach((row) => rows.remove(row))
}
