import type { Money } from '../../../shared/money/money'
import { categorisationContextOf } from '../../rules/domain/transactionFacts'
import type { Workbook } from '../../workbook/domain/workbook'
import { readCamtDocument } from '../domain/camtStatement'
import { importDryRun } from '../domain/importDryRun'
import type { ImportDryRun } from '../domain/importDryRun'
import type { ImportProfile } from '../domain/importProfile'
import type { StatementReading } from '../domain/importedStatement'
import { headerRowOf, readTabularStatement } from '../domain/tabularStatement'
import type { CellGrid } from '../domain/tabularStatement'

/** A file dropped on Import, as far as reading it goes: a camt document, or a spreadsheet's first sheet as cells. */
export type LoadedImportFile =
  | { readonly kind: 'camt'; readonly fileName: string; readonly document: Document }
  | { readonly kind: 'table'; readonly fileName: string; readonly fileHash: string; readonly grid: CellGrid }

/** The workbook's account for each IBAN on the accounts tab, normalised. */
export function accountsByIban(workbook: Pick<Workbook, 'accounts'>): ReadonlyMap<string, string> {
  return new Map(workbook.accounts.filter((account) => account.iban !== '').map((account) => [account.iban, account.slug]))
}

/** The statements a loaded file holds: a camt document's, or a spreadsheet's by the profile, refused for an account the accounts tab lacks. */
export function statementReadings(file: LoadedImportFile, workbook: Pick<Workbook, 'accounts'>, profile: ImportProfile | null): StatementReading[] {
  if (file.kind === 'camt') {
    return readCamtDocument(file.document, file.fileName, accountsByIban(workbook))
  }
  if (profile === null) {
    return []
  }
  if (!workbook.accounts.some((account) => account.slug === profile.account)) {
    return [{ fileName: file.fileName, label: file.fileName, refusal: `The profile ${profile.name || 'being made'} is for ${profile.account || 'no account'}, which is not on the accounts tab. Pick one of its accounts.` }]
  }
  return [readTabularStatement(file.grid, profile, file.fileName, file.fileHash)]
}

/** What importing would do to the workbook on screen, with the openings the person gave accounts that have no rows yet. */
export function dryRunFor(readings: readonly StatementReading[], workbook: Workbook, starts: ReadonlyMap<string, Money>): ImportDryRun {
  return importDryRun(readings, { transactions: workbook.transactions, rules: workbook.rules, context: categorisationContextOf(workbook), categories: workbook.categories, starts })
}

/** The saved profiles whose columns all head one row of the file, in the order the settings tab lists them. */
export function fittingProfiles(grid: CellGrid, profiles: readonly ImportProfile[]): ImportProfile[] {
  return profiles.filter((profile) => headerRowOf(grid, profile) !== null)
}
