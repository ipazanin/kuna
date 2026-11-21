import { isBankSyncKey, isTranscribedKey } from '../../statements/domain/statementRows'
import type { Account, SpendingPeriod, SpendingSource } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** A row as the periods of a file from before periods are worked out from it. */
export type SourceRow = Pick<Transaction, 'account' | 'date' | 'importKey' | 'pending'>

/**
 * The periods of an account a file from before periods keeps with one source, worked out once from its rows so no row already
 * in sits on a day whose source would not take it. One kept by hand stays by hand, which takes files too. One the bank fills starts with the source of its oldest file or sync row, and each run of days the other source
 * brought starts a period, as a lapsed link's days a file filled do. When a file brought its newest rows, the bank link takes
 * over from the day after. A day both brought stays with the source before it. A copied row, a typed one and one the bank has
 * not booked yet belong to no source, as the bank may book a payment later than it shows it.
 */
export function derivedSources(account: Pick<Account, 'id' | 'sources'>, rows: readonly SourceRow[]): readonly SpendingPeriod[] {
  if ((account.sources[0]?.source ?? 'by-hand') === 'by-hand') return [{ source: 'by-hand', from: null }]
  const days = new Map<CivilDate, Set<SpendingSource>>()
  for (const row of rows) {
    if (row.account !== account.id || row.importKey === '' || isTranscribedKey(row.importKey) || row.pending) continue
    const sources = days.get(row.date) ?? new Set<SpendingSource>()
    sources.add(isBankSyncKey(row.importKey) ? 'bank-link' : 'provider-file')
    days.set(row.date, sources)
  }
  const ordered = [...days].sort(([one], [other]) => (one < other ? -1 : 1))
  const first = ordered[0]
  if (first === undefined) return [{ source: 'bank-link', from: null }]
  const periods: SpendingPeriod[] = [{ source: first[1].has('provider-file') ? 'provider-file' : 'bank-link', from: null }]
  for (const [day, sources] of ordered.slice(1)) {
    const current = periods[periods.length - 1]!.source
    if (!sources.has(current)) periods.push({ source: current === 'bank-link' ? 'provider-file' : 'bank-link', from: day })
  }
  if (periods[periods.length - 1]!.source === 'provider-file') periods.push({ source: 'bank-link', from: addDays(ordered[ordered.length - 1]![0], 1) })
  return periods
}

/** The accounts with the periods of each one a file from before periods keeps worked out from its rows, and the ids of those. */
export function withDerivedSources(read: RecordsRead<Account>, rows: RecordsRead<SourceRow>): { readonly read: RecordsRead<Account>; readonly ids: ReadonlySet<Account['id']> } {
  const unstored = read.records.filter((stored) => stored.fields.sources === undefined)
  if (unstored.length === 0) return { read, ids: new Set() }
  const rowRecords = rows.records.map((stored) => stored.record)
  return {
    read: { ...read, records: read.records.map((stored) => (unstored.includes(stored) ? { ...stored, record: { ...stored.record, sources: derivedSources(stored.record, rowRecords) } } : stored)) },
    ids: new Set(unstored.map((stored) => stored.record.id)),
  }
}
