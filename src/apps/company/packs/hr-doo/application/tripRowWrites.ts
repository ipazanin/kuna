import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { UnitOfWork } from '../../../../../shared/storage/application/repository'
import { recordWithId } from '../../../../../shared/storage/domain/recordsRead'
import { LEDGER_WRITES } from '../../../imports/application/ledgerWrites'
import { writeSplit } from '../../../transactions/application/splitWrites'
import { withVerdict } from '../../../transactions/domain/verdictChanges'
import type { CompanyBooks } from '../../../workbook/domain/readWorkbook'
import type { SplitTabRow } from '../../../workbook/domain/splitsReading'
import { TRIP_WRITES } from '../domain/hrDooWrites'
import type { Trip } from '../domain/trips/trip'
import { withDismissedRow, withLinkedRow } from '../domain/trips/tripBankRows'
import type { TripRowLink, TripRowSplit } from '../domain/trips/tripBankRows'

/** Links one of a trip's bank rows to a ledger row's id, or unlinks it with null. The row's category and split stay as they are. */
export function linkTripRow(unit: UnitOfWork, trip: Trip, link: TripRowLink, rowId: string | null): void {
  unit.of(TRIP_WRITES).change(trip, withLinkedRow(trip, link, rowId))
}

/** Sets aside a payment Kuna offered for the trip, which a person says is not its advance or payout. */
export function dismissTripRow(unit: UnitOfWork, trip: Trip, rowId: string): void {
  unit.of(TRIP_WRITES).change(trip, withDismissedRow(trip, rowId))
}

/** Marks the trip's JOPPD code 17 line as reported on the day, or clears the mark with null. */
export function markTripReported(unit: UnitOfWork, trip: Trip, on: CivilDate | null): void {
  unit.of(TRIP_WRITES).change(trip, { ...trip, reportedOn: on })
}

/** The parts the row's split holds now, as the app read them, or null when the books on screen no longer hold one of them. */
function storedParts(books: CompanyBooks, split: TripRowSplit): SplitTabRow[] | null {
  const held = books.workbook.splits.find((candidate) => candidate.row.id === split.row.id)
  if (held === undefined) return []
  const parts = held.parts.flatMap((part) => recordWithId(books.records.splits, part.id)?.record ?? [])
  return parts.length === held.parts.length ? parts : null
}

/**
 * Files each linked row by the settlement in one write: a row of two parts or more is split into them, and a row the settlement
 * files in one category whole takes that category, any split it held removed, with the person's review label.
 */
export function fileTripRows(unit: UnitOfWork, books: CompanyBooks, splits: readonly TripRowSplit[], reviewLabel: string): void {
  const { categories } = books.workbook
  for (const split of splits) {
    const current = storedParts(books, split)
    if (current === null) throw new Error('A split of a linked row changed since it was read.')
    const [only, ...more] = split.parts
    if (only !== undefined && more.length === 0) {
      writeSplit(unit, split.row, current, [], categories)
      const entry = recordWithId(books.records.ledger, split.row.id)?.record
      if (entry === undefined) throw new Error('A linked row is no longer in the books.')
      unit.of(LEDGER_WRITES).change(entry, withVerdict(entry, { category: only.category, flaggedBy: reviewLabel }, categories))
    } else {
      const drafts = split.parts.map((part, index) => ({ amount: part.amount, category: part.category, note: '', opened: current[index] ?? null }))
      writeSplit(unit, split.row, current, drafts, categories)
    }
  }
}
