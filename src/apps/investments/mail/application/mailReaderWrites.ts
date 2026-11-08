import { INVESTMENT_KINDS, bookWith } from '../../workbook/application/investmentWriteGuards'
import { MAIL_READER_RECORDS } from '../../workbook/domain/investmentKinds'
import type { MailReader } from '../../workbook/domain/mailReader'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
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
