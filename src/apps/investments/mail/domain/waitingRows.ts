import { waitingQuestions } from '../../imports/domain/importDryRun'
import type { ReportQuestion, WorkbookRows } from '../../imports/domain/importDryRun'
import { importedByKey } from '../../imports/domain/importKeys'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { bookingStart } from './askedRowStart'
import type { AskedRowStart } from './askedRowStart'

/** A question of the mailed report that still waits, by its number among the report's questions, with the form Book opens for it or null where it cannot be booked. */
export interface WaitingRow {
  readonly number: number
  readonly question: ReportQuestion
  readonly start: AskedRowStart | null
}

/**
 * The questions of the last mailed report that still wait. Each keeps its number among all the report's questions, so
 * booking one leaves the others' numbers as they were.
 */
export function waitingRows(rows: WorkbookRows | null, book: InvestmentBook): readonly WaitingRow[] {
  const report = rows?.report
  if (report === undefined || !report.mailed) return []
  const waiting = new Map(waitingQuestions(report, importedByKey(book)).map((question) => [question.key, question]))
  return report.asked.flatMap((asked, index) => {
    const question = waiting.get(asked.key)
    return question === undefined ? [] : [{ number: index + 1, question, start: bookingStart(question, book) }]
  })
}
