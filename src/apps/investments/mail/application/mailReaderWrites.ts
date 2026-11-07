import { INVESTMENT_KINDS, bookWith } from '../../workbook/application/investmentWriteGuards'
import { MAIL_READER_RECORDS } from '../../workbook/domain/investmentKinds'
import type { MailReader } from '../../workbook/domain/mailReader'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

export const MAIL_READER_WRITES: WriteRules<MailReader> = {
  kind: MAIL_READER_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(MAIL_READER_RECORDS, read, records).readings.mailReaders,
  refusals: () => [],
}
