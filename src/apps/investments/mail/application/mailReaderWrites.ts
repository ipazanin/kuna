import { IBKR_FLEX_RECIPE } from '../domain/ibkrFlexRecipe'
import { INVESTMENT_ACCOUNT_WRITES } from '../../holdings/application/holdingWrites'
import { sourcesSaid } from '../../imports/domain/accountIntake'
import { INVESTMENT_KINDS, bookWith } from '../../workbook/application/investmentWriteGuards'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { MAIL_READER_RECORDS } from '../../workbook/domain/investmentKinds'
import type { MailReader } from '../../workbook/domain/mailReader'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'

export const MAIL_READER_WRITES: WriteRules<MailReader> = {
  kind: MAIL_READER_RECORDS,
  reads: INVESTMENT_KINDS,
  undoable: true,
  read: (read, records) => bookWith(MAIL_READER_RECORDS, read, records).readings.mailReaders,
  refusals: () => [],
}

/**
 * Saves how each account that does not say reads now, and drops the readers' shared start day, which then no account needs.
 * A file kept before each account had its own start day gets there on its first write of an account or of IBKR's reader,
 * such as an account saved, a change on the mail card or a mailed report accepted. `written` names the account or reader
 * the write saves itself.
 */
export function writeAccountSources(unit: UnitOfWork, book: InvestmentBook, written: { readonly account?: RecordId; readonly reader?: RecordId }): void {
  const said = sourcesSaid(book)
  book.accounts.forEach((account, at) => {
    if (account.intake === null && account.id !== written.account) unit.of(INVESTMENT_ACCOUNT_WRITES).change(account, said.accounts[at]!)
  })
  book.mailReaders.forEach((reader, at) => {
    if (reader.since !== null && reader.id !== written.reader) unit.of(MAIL_READER_WRITES).change(reader, said.mailReaders[at]!)
  })
}

/** Writes the reader as `after`, with the accounts' sources saved and the shared start day gone in the same write. */
export function writeReader(unit: UnitOfWork, book: InvestmentBook, before: MailReader | null, after: MailReader): void {
  writeAccountSources(unit, book, { reader: after.id })
  const settled = { ...after, since: null }
  if (before === null) unit.of(MAIL_READER_WRITES).add(settled)
  else unit.of(MAIL_READER_WRITES).change(before, settled)
}

/** Keeps the keys of the report's rows the person left out for good, so the reader stops asking about them. Accepting a mailed report saves the accounts' sources too. */
export function writeLeftOut(unit: UnitOfWork, book: InvestmentBook, reader: MailReader, keys: readonly string[]): void {
  if (keys.length === 0 && reader.since === null) writeAccountSources(unit, book, {})
  else writeReader(unit, book, reader, { ...reader, leftOut: [...reader.leftOut, ...keys] })
}

/** The reader the file holds, or a new one, switched off, with IBKR's own terms. Each account keeps its own start day. */
export function heldOrNewReader(held: MailReader | null): MailReader {
  return (
    held ?? {
      id: recordIdOf(MAIL_READER_RECORDS, newRecordId()),
      recipe: IBKR_FLEX_RECIPE.id,
      on: false,
      senders: IBKR_FLEX_RECIPE.mail.senders,
      subject: IBKR_FLEX_RECIPE.mail.subject,
      contents: IBKR_FLEX_RECIPE.mail.contents,
      since: null,
      leftOut: [],
    }
  )
}

/** Keeps the keys of an uploaded report's rows the person left out for good. While the file holds no reader, a new one keeps them, switched off. */
export function writeUploadLeftOut(unit: UnitOfWork, book: InvestmentBook, held: MailReader | null, keys: readonly string[]): void {
  if (held !== null) writeLeftOut(unit, book, held, keys)
  else if (keys.length > 0) writeReader(unit, book, null, { ...heldOrNewReader(null), leftOut: [...keys] })
}
