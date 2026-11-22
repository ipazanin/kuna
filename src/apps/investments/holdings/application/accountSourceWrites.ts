import { INVESTMENT_ACCOUNT_WRITES } from './holdingWrites'
import { accountSources, landingRecords, sourceHandover } from '../../imports/domain/accountIntake'
import type { SourceHandover } from '../../imports/domain/accountIntake'
import { writeAccountSources } from '../../mail/application/mailReaderWrites'
import { CASH_MOVEMENT_WRITES, EXCHANGE_WRITES, INCOME_WRITES, TRADE_WRITES, TRANSFER_WRITES } from '../../transactions/application/transactionWrites'
import { BY_HAND_SOURCES } from '../../workbook/domain/investmentAccount'
import type { InvestmentAccount } from '../../workbook/domain/investmentAccount'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'

/** What saving the account's new periods takes out of the book, or null when no day changes source. A new account takes nothing out. */
export function accountHandover(book: InvestmentBook, before: InvestmentAccount | null, after: InvestmentAccount): SourceHandover | null {
  if (before === null || after.sources === null) return null
  const was = accountSources(book).get(before.id) ?? BY_HAND_SOURCES
  return sourceHandover(before.id, was, after.sources, landingRecords(book))
}

/**
 * Adds or changes the account, and in the same write takes out the records its new periods give to another source, so one Undo
 * puts all of it back. Accounts that do not say where their rows come from say it from then on.
 */
export function writeInvestmentAccount(unit: UnitOfWork, book: InvestmentBook, before: InvestmentAccount | null, after: InvestmentAccount): void {
  if (before === null) unit.of(INVESTMENT_ACCOUNT_WRITES).add(after)
  else unit.of(INVESTMENT_ACCOUNT_WRITES).change(before, after)
  const going = new Set(accountHandover(book, before, after)?.records ?? [])
  if (going.size > 0) {
    book.trades.filter((record) => going.has(record.id)).forEach((record) => unit.of(TRADE_WRITES).remove(record))
    book.income.filter((record) => going.has(record.id)).forEach((record) => unit.of(INCOME_WRITES).remove(record))
    book.cashMovements.filter((record) => going.has(record.id)).forEach((record) => unit.of(CASH_MOVEMENT_WRITES).remove(record))
    book.exchanges.filter((record) => going.has(record.id)).forEach((record) => unit.of(EXCHANGE_WRITES).remove(record))
    book.transfers.filter((record) => going.has(record.id)).forEach((record) => unit.of(TRANSFER_WRITES).remove(record))
  }
  writeAccountSources(unit, book, { account: after.id })
}
