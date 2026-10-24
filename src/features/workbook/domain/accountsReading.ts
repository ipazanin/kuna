import { normaliseIban } from '../../../shared/text/fold'
import { currencyProblem } from '../../settings/domain/settings'
import { filledKey, labelWords } from './recordCodec'
import type { RecordCodec } from './recordCodec'
import { filledFields } from './recordFields'
import { recordIdOf } from './recordId'
import type { RecordId } from './recordId'
import { ACCOUNT_RECORDS } from './recordKind'
import { problemOf, refusedProblems } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { sharedKeys } from './sharedKeys'
import { keyedId, refuse, slugOf, textOf } from './storedFields'
import type { StoredFields } from './storedFields'
import type { Account, RecordProblem } from './workbook'

/** An account as the accounts tab holds it, with the id its name makes. */
export type AccountRecord = Account & { readonly id: RecordId }

export function accountOf(fields: StoredFields, id: RecordId | null): AccountRecord {
  const slug = slugOf(fields.account)
  if (slug === '') {
    refuse('no account name')
  }
  return { slug, label: textOf(fields.label), iban: normaliseIban(textOf(fields.iban)), currency: textOf(fields.currency).toUpperCase(), id: keyedId(id) }
}

export const ACCOUNT_CODEC: RecordCodec<AccountRecord> = {
  kind: ACCOUNT_RECORDS,
  key: (fields) => filledKey(slugOf(fields.account)),
  label: (fields) => labelWords([textOf(fields.account)]),
  make: accountOf,
  fieldsOf: (account) => filledFields({ account: account.slug, iban: account.iban, currency: account.currency, label: account.label }),
}

/** An account made from its fields, with the id its name makes, as an editor makes one. */
export function accountOfFields(fields: StoredFields): AccountRecord {
  return accountOf(fields, recordIdOf(ACCOUNT_RECORDS, slugOf(fields.account)))
}

/**
 * One currency per workbook: an account in another one is still read, and its amounts shown as the
 * workbook's. With no workbook currency given, only a currency that is not one is reported. An
 * account named on more than one record is read from none of them.
 */
export function readAccounts(read: RecordsRead<AccountRecord>, workbookCurrency: string | null): Reading<AccountRecord> {
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    const { slug, currency } = stored.record
    const invalid = currency === '' ? null : currencyProblem(currency)
    if (invalid !== null) {
      problems.push(problemOf(stored, invalid))
    } else if (currency !== '' && workbookCurrency !== null && currency !== workbookCurrency) {
      problems.push(problemOf(stored, `${slug} is in ${currency} but the workbook counts in ${workbookCurrency}, so its amounts read as ${workbookCurrency}`))
    }
  }
  const shared = sharedKeys(read.records, (stored) => stored.record.slug)
  for (const stored of read.records.filter((candidate) => shared.has(candidate.record.slug))) {
    problems.push(problemOf(stored, `${stored.record.slug} is named on more than one row, so none of them counts`))
  }
  return { facts: read.records.map((stored) => stored.record).filter((account) => !shared.has(account.slug)), problems }
}
