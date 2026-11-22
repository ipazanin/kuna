import { words } from './words'
import { latestRecords } from '../../holdings/domain/latestRecords'
import type { LatestRecord } from '../../holdings/domain/latestRecords'
import type { SourceHandover } from '../../imports/domain/accountIntake'
import { transactionLine } from '../../transactions/presentation/transactionLine'
import type { InvestmentSource } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel, dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { NO_RATES } from '../../../../shared/money/rateBook'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { listInWords } from '../../../../shared/text/listInWords'
import { plural } from '../../../../shared/text/translation'
import { listedRows } from '../../../../shared/ui/sourceHandover'
import type { HandoverWords } from '../../../../shared/ui/sourceHandover'

const text = words.accountDialog

function spanOf(from: CivilDate | null, to: CivilDate | null): string {
  if (from === null) return to === null ? '' : text.handover.before(dayLabel(to))
  return to === null ? text.handover.onwards(dayLabel(from)) : dayRangeLabel({ from, to })
}

/** A record that goes by its day, what it is and its euros, or what it moved when it moved no euros at a known rate. */
function lineOf(entry: LatestRecord): string {
  const line = transactionLine(entry)
  const figure = 'euros' in entry && entry.euros !== null ? formatMoney(entry.euros) : line.moved || line.terms
  return [dayLabel(entry.record.date), line.kind, line.subject, figure].filter((part) => part !== '').join(', ')
}

/** The account a transfer that goes moves to or from beside `account`, or null for a record of the account alone. */
function otherSide(entry: LatestRecord, account: RecordId): string | null {
  if (entry.kind !== 'transfer' || entry.from.id === entry.to.id) return null
  return entry.from.id === account ? entry.to.name : entry.from.name
}

/** The handover's warning in words, or null when it takes nothing out. A transfer with another account takes that account's side out too, which a note names. */
export function handoverWords(handover: SourceHandover, account: RecordId, book: InvestmentBook): HandoverWords | null {
  const { records, runs, given } = handover
  if (records.length === 0) return null
  const going = new Set(records)
  const entries = latestRecords(book, NO_RATES)
    .filter((entry) => going.has(entry.record.id))
    .sort((earlier, later) => earlier.record.date.localeCompare(later.record.date))
  const others = entries.flatMap((entry) => otherSide(entry, account) ?? [])
  const sourceWords = (source: InvestmentSource): string => text.rowsFromOptions[source]
  return {
    title: plural(text.handover.title(records.length), records.length),
    days: [
      ...given.map((run) => text.handover.given(spanOf(run.from, run.to), sourceWords(run.after))),
      ...runs.map((run) => text.handover.days(spanOf(run.from, run.to), sourceWords(run.before), sourceWords(run.after))),
    ],
    rows: listedRows(entries.map(lineOf), text.handover.more),
    notes: [
      ...(others.length === 0 ? [] : [plural(text.handover.otherSide(others.length, listInWords([...new Set(others)])), others.length)]),
      text.handover.brings,
      ...([...runs, ...given].some((run) => run.after === 'mail') ? [text.handover.mailReach] : []),
    ],
  }
}
