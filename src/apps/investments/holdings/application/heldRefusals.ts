import { words } from './words'
import { bookOf } from '../../workbook/application/investmentWriteGuards'
import { investmentLots } from '../domain/lots'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { FreshRecords } from '../../../../shared/storage/domain/writeRules'

/** Each sale and unit transfer beyond what its account holds, and each split that empties a lot, by its id, with the sentence that says so. */
function heldProblems(records: FreshRecords): ReadonlyMap<RecordId, string> {
  const { book } = bookOf(records)
  const names = new Map(book.instruments.map((instrument) => [instrument.id, instrument.name]))
  const problems = new Map<RecordId, string>()
  for (const [instrument, lots] of investmentLots(book)) {
    const name = names.get(instrument) ?? ''
    for (const record of lots.refused) {
      if ('side' in record) {
        problems.set(record.id, words.saleBeyond(name, record.date))
      } else {
        problems.set(record.id, words.transferBeyond(name, record.date))
      }
    }
    for (const split of lots.emptied) {
      problems.set(split.id, words.splitEmpties(name, split.date))
    }
  }
  return problems
}

/**
 * Why the write would leave a sale or a unit transfer beyond what its account holds on its day, or a split that empties
 * a lot, where the file had none of them before. The figures would leave such a sale out, so the write is refused instead.
 */
export function heldRefusals(fresh: FreshRecords, after: FreshRecords): string[] {
  const before = heldProblems(fresh)
  return [...heldProblems(after)].filter(([id]) => !before.has(id)).map(([, sentence]) => sentence)
}
