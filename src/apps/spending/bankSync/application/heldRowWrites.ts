import { BANK_SYNC_LABEL } from '../domain/bankSyncRows'
import { writeRows } from '../../entries/application/rowRecords'
import { HELD_ROW_WRITES, writeDryRun } from '../../statements/application/statementWrites'
import { statementDryRun } from '../../statements/domain/statementDryRun'
import { rowOfHeld } from '../../workbook/domain/heldBankRow'
import type { HeldBankRow } from '../../workbook/domain/heldBankRow'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { rowKey } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/**
 * The person's word on a bank row on hold, in one write with one Undo, and the hold goes either way. Keep both books it as the
 * sync would have. Keeping only the row Kuna has gives that row the bank's key and leaves its day, payee and text, so a later
 * sync finds it by the key and a file read again finds it by the same day, amount and payee.
 */
export function answerHeldRow(unit: UnitOfWork, book: SpendingBook, held: HeldBankRow, keep: TwinAnswer['keep'], day: CivilDate): void {
  if (keep === 'both') {
    const statement = { label: BANK_SYNC_LABEL, rows: [rowOfHeld(held)], notes: [], twinAnswers: new Map([[rowKey(held), { booked: held.like, keep }]]) }
    writeDryRun(unit, book.stored, statementDryRun({ ...book, held: book.held.filter((other) => other !== held) }, statement, day))
  } else {
    const kept = book.transactions.find((row) => row.id === held.like)
    if (kept !== undefined) writeRows(unit, book.stored, [{ before: kept, after: { ...kept, importKey: held.importKey } }])
  }
  unit.of(HELD_ROW_WRITES).remove(held)
}
