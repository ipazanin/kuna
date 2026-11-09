import { IBKR_FLEX_RECIPE } from '../domain/ibkrFlexRecipe'
import { firstReportDay } from '../domain/reportRows'
import type { ReportFile } from '../domain/reportRows'
import { INVESTMENT_KINDS, bookWith } from '../../workbook/application/investmentWriteGuards'
import { MAIL_READER_RECORDS } from '../../workbook/domain/investmentKinds'
import type { MailReader } from '../../workbook/domain/mailReader'
import { today } from '../../../../shared/calendar/civilDate'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

export const MAIL_READER_WRITES: WriteRules<MailReader> = {
  kind: MAIL_READER_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(MAIL_READER_RECORDS, read, records).readings.mailReaders,
  refusals: () => [],
}

/** Keeps the keys of the report's rows the person left out for good, so the reader stops asking about them. */
export function writeLeftOut(unit: UnitOfWork, reader: MailReader, keys: readonly string[]): void {
  unit.of(MAIL_READER_WRITES).change(reader, { ...reader, leftOut: [...reader.leftOut, ...keys] })
}

/** The reader the file holds, or a new one, switched off, with IBKR's own terms from today. */
export function heldOrNewReader(held: MailReader | null): MailReader {
  return (
    held ?? {
      id: recordIdOf(MAIL_READER_RECORDS, newRecordId()),
      recipe: IBKR_FLEX_RECIPE.id,
      on: false,
      senders: IBKR_FLEX_RECIPE.mail.senders,
      subject: IBKR_FLEX_RECIPE.mail.subject,
      contents: IBKR_FLEX_RECIPE.mail.contents,
      since: today(),
      leftOut: [],
    }
  )
}

/**
 * Keeps the keys of an uploaded report's rows the person left out for good. While the file holds no reader, a new one
 * keeps them, switched off, from the report's first day, so the rows the report gives stay in.
 */
export function writeUploadLeftOut(unit: UnitOfWork, held: MailReader | null, keys: readonly string[], file: ReportFile): void {
  if (held !== null) {
    writeLeftOut(unit, held, keys)
    return
  }
  const added = heldOrNewReader(null)
  unit.of(MAIL_READER_WRITES).add({ ...added, since: firstReportDay(file) ?? added.since, leftOut: [...keys] })
}
