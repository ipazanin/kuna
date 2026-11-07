import { NO_ANSWERS, importableRecords, workbookDryRun } from '../../imports/domain/importDryRun'
import type { DryRunEntry, WorkbookRows } from '../../imports/domain/importDryRun'
import { isReportKey } from '../../imports/domain/reportKey'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { RateBook } from '../../../../shared/money/rateBook'

/**
 * What a report's rows hold for the person: the records not in Kuna yet, the records Kuna has that the report now gives
 * other figures for, such as tax withheld a day after its dividend, and the rows its recipe asks about.
 */
export interface ReportNews {
  readonly fresh: number
  readonly changed: number
  readonly asked: number
}

function changedInReport(entry: DryRunEntry): boolean {
  return entry.outcome.kind === 'waiting' && entry.outcome.reason.kind === 'differs-from-kuna'
}

/** Read off the dry run before any answer, at the ECB rates of the prices file, since a foreign record's figures need them to compare. */
export function reportNews(reading: WorkbookRows, book: InvestmentBook, rates: RateBook): ReportNews {
  const entries = workbookDryRun(reading, { book, rates, answers: NO_ANSWERS }).entries
  const changed = entries.filter(changedInReport).length
  return { fresh: entries.filter((entry) => entry.outcome.kind !== 'in-kuna').length - changed, changed, asked: reading.report?.asked.length ?? 0 }
}

/** The newest day of a record a report made, in the file, or null while none has. */
export function newestReportDay(book: InvestmentBook): string | null {
  const days = importableRecords(book).flatMap((imported) => (imported.record.importKey !== null && isReportKey(imported.record.importKey) ? [imported.record.date] : []))
  return days.length === 0 ? null : days.reduce((newest, day) => (day > newest ? day : newest))
}
