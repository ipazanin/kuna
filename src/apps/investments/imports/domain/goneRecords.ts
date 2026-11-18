import type { ImportedRecord } from './importedRecords'
import type { WorkbookRow } from './portfolioWorkbook'
import { isWorkbookKey } from './reportKey'
import type { RowEntry } from './workbookEntries'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/**
 * Records in Kuna with an import key the file no longer gives, of an account the file covers and dated within its rows
 * of that account. A split or a spin-off names no account, so it counts when it is dated within the file's rows.
 */
export function goneRecords(
  rows: readonly WorkbookRow[],
  entries: readonly RowEntry[],
  keyed: ReadonlyMap<string, ImportedRecord>,
  accountOf: (row: WorkbookRow) => InvestmentAccount | null,
): ImportedRecord[] {
  const fileKeys = new Set(entries.map((entry) => entry.key))
  const ranges = new Map<RecordId, { from: CivilDate; to: CivilDate }>()
  for (const row of rows) {
    const account = accountOf(row)
    if (account !== null) {
      const range = ranges.get(account.id)
      ranges.set(account.id, { from: range === undefined || row.date < range.from ? row.date : range.from, to: range === undefined || row.date > range.to ? row.date : range.to })
    }
  }
  const dates = rows.map((row) => row.date).sort()
  const covers = (account: RecordId | null, date: CivilDate): boolean => {
    const range = account === null ? { from: dates[0] ?? '', to: dates.at(-1) ?? '' } : ranges.get(account)
    return range !== undefined && date >= range.from && date <= range.to
  }
  return [...keyed]
    .filter(([key]) => !fileKeys.has(key) && isWorkbookKey(key))
    .map(([, imported]) => imported)
    .filter((imported) => {
      const record = imported.record
      if (imported.kind === 'transfer') {
        return covers(imported.record.from, record.date) || covers(imported.record.to, record.date)
      }
      return covers('account' in record ? record.account : null, record.date)
    })
}
