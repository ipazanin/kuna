import type { MatchedRecord } from './importDryRun'
import { importableRecords } from './importedRecords'
import type { ImportedRecord } from './importedRecords'
import type { WorkbookRow } from './portfolioWorkbook'
import { accountScopeOf, isAskedKey, isReportKey, withImportKey } from './reportKey'
import type { RowEntry } from './workbookEntries'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The record the person said a row is, holding the row's key beside its keys from other sources. */
export function matchedWithKey(imported: ImportedRecord, key: string): ImportedRecord {
  return { kind: imported.kind, record: { ...imported.record, importKeys: withImportKey(imported.record.importKeys, key) } } as ImportedRecord
}

/** The book with each matched record holding the import keys it took. */
export function withMatchedKeys(book: InvestmentBook, matched: readonly MatchedRecord[]): InvestmentBook {
  if (matched.length === 0) return book
  const keysOf = new Map(matched.map(({ keyed }) => [keyed.record.id, keyed.record.importKeys]))
  const keyedOf = <Kept extends { readonly id: RecordId; readonly importKeys: readonly string[] }>(records: readonly Kept[]): Kept[] =>
    records.map((record) => (keysOf.has(record.id) ? { ...record, importKeys: keysOf.get(record.id)! } : record))
  return { ...book, trades: keyedOf(book.trades), income: keyedOf(book.income), cashMovements: keyedOf(book.cashMovements), exchanges: keyedOf(book.exchanges) }
}

/** Each record of the kinds an import writes by every import key it holds. */
export function importedByKey(book: InvestmentBook): Map<string, ImportedRecord> {
  return new Map(importableRecords(book).flatMap((imported) => imported.record.importKeys.map((key) => [key, imported] as const)))
}

/**
 * The keys a record took that another record of the book holds too. A key names one row of one file, so a second
 * record with it is that row booked twice. `before` is the record as it was, whose keys it keeps without a check.
 */
export function keysHeldTwice(book: InvestmentBook, record: { readonly id: RecordId; readonly importKeys: readonly string[] }, before: readonly string[]): string[] {
  const taken = record.importKeys.filter((key) => !before.includes(key))
  if (taken.length === 0) return []
  const others = new Set(importableRecords(book).flatMap((imported) => (imported.record.id === record.id ? [] : imported.record.importKeys)))
  return taken.filter((key) => others.has(key))
}

/** The account each of the workbook's Account texts was imported into, read off the records its rows already made. */
export function knownAccountsOf(inKuna: readonly RowEntry[], keyed: ReadonlyMap<string, ImportedRecord>): Map<string, RecordId> {
  const known = new Map<string, RecordId>()
  for (const entry of inKuna) {
    const imported = keyed.get(entry.key)!
    const accounts = imported.kind === 'transfer' ? [imported.record.from, imported.record.to] : 'account' in imported.record ? [imported.record.account] : []
    accounts.forEach((account, index) => {
      const row = entry.rows[index]
      if (row !== undefined) {
        known.set(row.account, account)
      }
    })
  }
  return known
}

/** The account a report's rows belong to, read off any record of the same recipe and account, however old, since a rolling file overlaps with few of them. */
export function accountsOfReportScope(rows: readonly WorkbookRow[], keyed: ReadonlyMap<string, ImportedRecord>): Map<string, RecordId> {
  const byScope = new Map<string, RecordId>()
  for (const [key, imported] of keyed) {
    if (isReportKey(key) && !isAskedKey(key) && 'account' in imported.record) byScope.set(accountScopeOf(key), imported.record.account)
  }
  return new Map(
    rows.flatMap((row) => {
      const account = byScope.get(accountScopeOf(row.key))
      return account === undefined ? [] : [[row.account, account] as const]
    }),
  )
}

/** The instrument each identity was imported as, read off the records its rows already made. */
export function knownInstrumentsOf(inKuna: readonly RowEntry[], keyed: ReadonlyMap<string, ImportedRecord>, identityOf: (row: WorkbookRow) => string): Map<string, RecordId> {
  const known = new Map<string, RecordId>()
  for (const entry of inKuna) {
    const imported = keyed.get(entry.key)!
    const instrument =
      imported.kind === 'trade' || imported.kind === 'split' || imported.kind === 'income'
        ? imported.record.instrument
        : imported.kind === 'spin-off'
          ? imported.record.received
          : imported.kind === 'transfer' && imported.record.moved.kind === 'units'
            ? imported.record.moved.instrument
            : null
    if (instrument !== null) {
      known.set(identityOf(entry.rows[0]), instrument)
    }
  }
  return known
}
