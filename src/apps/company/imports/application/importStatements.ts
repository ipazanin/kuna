import type { TwinAnswer } from '../../../../shared/money/lookAlikeBookings'
import type { Money } from '../../../../shared/money/money'
import { categorisationContextOf } from '../../rules/domain/categorisationContext'
import { ACCOUNT_WRITES } from '../../settings/application/namedRecordWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { accountOfFields } from '../../workbook/domain/accountsReading'
import { slugProblem } from '../../workbook/domain/slug'
import { recordWithId, recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { storedFieldOfValue } from '../../../../shared/storage/domain/storedFields'
import type { CompanyBooks } from '../../workbook/domain/readWorkbook'
import type { Workbook } from '../../workbook/domain/workbook'
import { storesItems } from '../../workbook/domain/rowItems'
import { proposedInvoicePayments } from '../../receivables/domain/invoicePayments'
import { startPlacingPayments } from '../../receivables/application/invoicePaymentWrites'
import { presentedWorkbook } from '../../transactions/domain/presentedWorkbook'
import { installedPack } from '../../packs/packContribution'
import { readCamtDocument } from '../domain/camtStatement'
import { importDryRun } from '../domain/importDryRun'
import type { DryRunInputs, ImportDryRun } from '../domain/importDryRun'
import { replaceLedgerRows } from '../../transactions/application/itemWrites'
import type { ImportProfile } from '../domain/importProfile'
import type { StatementReading } from '../domain/importedStatement'
import { headerRowOf, readTabularStatement } from '../domain/tabularStatement'
import { words } from './words'
import type { CellGrid } from '../domain/tabularStatement'

/** A file dropped on Import, as far as reading it goes: a camt document, or a spreadsheet's first sheet as cells. */
export type LoadedImportFile =
  { readonly kind: 'camt'; readonly fileName: string; readonly document: Document } | { readonly kind: 'table'; readonly fileName: string; readonly fileHash: string; readonly grid: CellGrid }

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
    return [
      {
        fileName: file.fileName,
        label: file.fileName,
        refusal: words.profileWithoutAccount(profile.name, profile.account),
      },
    ]
  }
  return [readTabularStatement(file.grid, profile, file.fileName, file.fileHash)]
}

/** Why a name the person typed for a new account cannot be used, or null. `taken` are the names the accounts tab and the other new accounts hold. */
export function newAccountNameProblem(name: string, taken: ReadonlySet<string>): string | null {
  return slugProblem(name, 'account') ?? (taken.has(name) ? words.alreadyAnAccount(name) : null)
}

/**
 * What importing would do to the books on screen, with the openings the person gave accounts that
 * have no rows yet, the names typed for new accounts, by IBAN, and what the person said of entries
 * that look like rows the AI copied. A statement read before its IBAN was added to the accounts tab
 * is filed under that account, and a name that cannot be used names no account. The new rows pay
 * the invoices `proposedInvoicePayments` places them on, on books that place client payments, and
 * on books with an items tab that do not yet when `startsPlacing`, since confirming starts it. `camtOrigin` says whether a camt
 * statement comes from the bank's mail or from the person.
 */
export function dryRunFor(
  readings: readonly StatementReading[],
  books: CompanyBooks,
  starts: ReadonlyMap<string, Money>,
  names: ReadonlyMap<string, string> = new Map(),
  twinAnswers: ReadonlyMap<string, TwinAnswer> = new Map(),
  startsPlacing = true,
  camtOrigin: DryRunInputs['camtOrigin'] = 'provider-file',
): ImportDryRun {
  const { records, workbook } = books
  const placesInvoices = storesItems(records) && (workbook.paidInvoices !== undefined || startsPlacing)
  const known = accountsByIban(workbook)
  const current = readings.map((reading): StatementReading => {
    const slug = 'newAccount' in reading ? known.get(reading.newAccount.iban) : undefined
    return slug === undefined || !('statement' in reading) ? reading : { statement: { ...reading.statement, account: slug } }
  })
  const taken = new Set(workbook.accounts.map((account) => account.slug))
  const named = new Map<string, string>()
  for (const [iban, name] of names) {
    if (newAccountNameProblem(name, taken) === null) {
      named.set(iban, name)
      taken.add(name)
    }
  }
  return importDryRun(current, {
    transactions: workbook.transactions,
    rules: workbook.rules,
    context: categorisationContextOf(workbook),
    categories: workbook.categories,
    starts,
    named,
    twinAnswers,
    intakes: new Map(workbook.accounts.map((account) => [account.slug, account.intake])),
    camtOrigin,
    paymentsOf: (added) => [...(placesInvoices ? proposedInvoicePayments(presentedWorkbook(workbook), added) : []), ...installedPack().repaymentsOf(workbook, added)],
  })
}

/**
 * The write of an import: the accounts it adds, the copied rows its entries take the place of, as the app read them, then its
 * ledger entries with their items, in the shape the books keep, and what of them pays back the records the pack keeps. A first
 * payment placed on an invoice starts placing the books' client payments. A copied row's items go to the bank's row that takes
 * its place, still paying the invoices they paid, since the two agree on the amount. A copied row the records on screen no longer
 * hold stays, and the ledger then refuses entries that do not run on.
 */
export function writeImport(unit: UnitOfWork, run: ImportDryRun, books: CompanyBooks | null): void {
  if (books === null) throw new Error('The books are not read yet, so nothing is imported.')
  const { records } = books
  const invoices = new Set(recordsOf(records.invoices).map((invoice) => invoice.id))
  if (run.payments.some((payment) => payment.items.some((item) => item.of !== null && invoices.has(item.of)))) {
    startPlacingPayments(unit, books)
  }
  for (const account of run.accounts) {
    unit
      .of(ACCOUNT_WRITES)
      .add({ ...accountOfFields({ account: storedFieldOfValue(account.slug), iban: storedFieldOfValue(account.iban), currency: storedFieldOfValue(account.currency) }), intake: account.intake })
  }
  const removed = run.removed.flatMap((copied) => recordWithId(records.ledger, copied.id)?.record ?? [])
  replaceLedgerRows(unit, records, removed, run.added, run.payments)
  installedPack().linkRepayments(unit, records, run.payments)
}

/** "Imported 4 rows", or "Added main and imported 4 rows" when the import adds accounts. */
export function importTitle(run: Pick<ImportDryRun, 'accounts' | 'newRows'>): string {
  return words.imported(
    run.accounts.map((account) => account.slug),
    run.newRows,
  )
}

/** The saved profiles whose columns all head one row of the file, in the order the settings tab lists them. */
export function fittingProfiles(grid: CellGrid, profiles: readonly ImportProfile[]): ImportProfile[] {
  return profiles.filter((profile) => headerRowOf(grid, profile) !== null)
}
