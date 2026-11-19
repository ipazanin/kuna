import { isBankSyncKey, isTranscribedKey } from './statementRows'
import type { StatementRow, StatementRows } from './statementRows'
import type { Transaction } from '../../workbook/domain/transaction'
import { addDays, daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { overlapOf } from '../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** Where an account's files end and its bank sync begins: the last day a file brought a row, and the first day the sync did. */
export interface SourceDays {
  readonly lastFileDay: CivilDate | null
  readonly firstSyncDay: CivilDate | null
}

const NO_SOURCE_DAYS: SourceDays = { lastFileDay: null, firstSyncDay: null }

/**
 * Each account's source days. A row the AI copied belongs to neither source, since it is matched row by row, and a row the bank
 * has not booked yet to neither, since a payment of today would make the days of its source reach further than the bank booked.
 */
export function sourceDaysOf(rows: readonly Pick<Transaction, 'account' | 'date' | 'importKey' | 'pending'>[]): ReadonlyMap<RecordId, SourceDays> {
  const days = new Map<RecordId, SourceDays>()
  for (const { account, date, importKey, pending } of rows) {
    if (importKey === '' || isTranscribedKey(importKey) || pending) continue
    const { lastFileDay, firstSyncDay } = days.get(account) ?? NO_SOURCE_DAYS
    days.set(
      account,
      isBankSyncKey(importKey)
        ? { lastFileDay, firstSyncDay: firstSyncDay === null || date < firstSyncDay ? date : firstSyncDay }
        : { firstSyncDay, lastFileDay: lastFileDay === null || date > lastFileDay ? date : lastFileDay },
    )
  }
  return days
}

/** Whether the other of a file and the bank sync covers the row's day: a sync's row on or before the last day a file brought, or a file's row from the sync's first day on. */
export function coveredByOtherSource(days: ReadonlyMap<RecordId, SourceDays>, row: Pick<StatementRow, 'account' | 'date' | 'importKey'>): boolean {
  const { lastFileDay, firstSyncDay } = days.get(row.account) ?? NO_SOURCE_DAYS
  return isBankSyncKey(row.importKey) ? lastFileDay !== null && row.date <= lastFileDay : firstSyncDay !== null && row.date >= firstSyncDay
}

/**
 * The days a file most likely brings when the bank sync covers some of its days: the longest run of its days on which the sync
 * brought no row to any of the file's accounts. Null when no day of the file is one the sync's days would leave out, or when
 * the sync brought rows on every day of it. A copied statement has none, as no day belongs to a source for it.
 */
export function syncGapOf(transactions: readonly Pick<Transaction, 'account' | 'date' | 'importKey' | 'pending'>[], statement: Pick<StatementRows, 'rows' | 'transcribed'>): DateRange | null {
  if (statement.transcribed !== undefined) return null
  const sourceDays = sourceDaysOf(transactions)
  const meetsSync = statement.rows.some((row) => {
    const firstSyncDay = sourceDays.get(row.account)?.firstSyncDay ?? null
    return firstSyncDay !== null && row.date >= firstSyncDay
  })
  if (!meetsSync) return null
  const accounts = new Set(statement.rows.map((row) => row.account))
  const syncDays = [...new Set(transactions.filter((row) => accounts.has(row.account) && isBankSyncKey(row.importKey)).map((row) => row.date))].sort()
  const fileDays = statement.rows.map((row) => row.date).sort()
  const file = { from: fileDays[0]!, to: fileDays[fileDays.length - 1]! }
  const edges = [addDays(file.from, -1), ...syncDays, addDays(file.to, 1)]
  const runs = edges.slice(1).flatMap((next, place) => overlapOf({ from: addDays(edges[place]!, 1), to: addDays(next, -1) }, file) ?? [])
  return runs.reduce<DateRange | null>((longest, run) => (longest === null || daysBetween(run.from, run.to) > daysBetween(longest.from, longest.to) ? run : longest), null)
}
