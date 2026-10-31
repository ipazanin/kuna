import { importableRecords } from '../domain/importDryRun'
import type { ImportedRecord } from '../domain/importDryRun'
import { INSTRUMENT_WRITES, INVESTMENT_ACCOUNT_WRITES } from '../../holdings/application/holdingWrites'
import { writeTransaction } from '../../transactions/application/transactionWrites'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/**
 * Adds what a dry run of the workbook adds, through each kind's write rules, and takes out the records gone from the
 * workbook that the person chose to delete. It is one unit of work, so one Undo puts all of it back.
 */
export function writeWorkbookImport(unit: UnitOfWork, added: InvestmentBook, deleting: readonly ImportedRecord[]): void {
  added.accounts.forEach((account) => unit.of(INVESTMENT_ACCOUNT_WRITES).add(account))
  added.instruments.forEach((instrument) => unit.of(INSTRUMENT_WRITES).add(instrument))
  importableRecords(added).forEach((imported) => writeTransaction(unit, null, imported))
  deleting.forEach((gone) => writeTransaction(unit, gone, null))
}
