import { holdsKind, recordsOfKindIn, withRecordsOfKind } from '../../workbook/domain/readWorkbook'
import type { WorkbookRecords } from '../../workbook/domain/readWorkbook'
import { codecOfKind } from '../../workbook/application/recordCodecs'
import type { CardRecordsAccess } from '../../../../shared/app/cardRecords'

/** How a card reaches the company's records, core's kinds and the installed pack's. */
export const COMPANY_CARD_RECORDS: CardRecordsAccess<WorkbookRecords> = {
  holds: holdsKind,
  of: recordsOfKindIn,
  with: withRecordsOfKind,
  codecOf: codecOfKind,
}
