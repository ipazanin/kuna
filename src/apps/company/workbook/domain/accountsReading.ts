import { normaliseIban } from '../../../../shared/text/fold'
import { currencyProblem } from '../../settings/domain/settings'
import { ACCOUNT_RECORDS } from './coreKinds'
import { filledKey, labelWords } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { BY_HAND, EXTRA_ORIGINS } from '../../../../shared/app/accountSource'
import { choiceList, keyedId, optionalDate, refuse, requiredChoice, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { COMPANY_ROWS_FROM } from './workbook'
import type { Account, CompanyIntake } from './workbook'
import { words } from './words'

/** An account as the accounts tab holds it, with the id its name makes. Its intake is null in a file from before each account said how its rows come in. */
export type AccountRecord = Omit<Account, 'intake'> & { readonly intake: CompanyIntake | null; readonly id: RecordId }

/** How the account's rows come in, null while it does not say. Only an account the bank's statements fill has a start day, which it always has, and other origins it takes. */
function intakeOf(fields: StoredFields): CompanyIntake | null {
  const startsOn = optionalDate(fields, 'starts_on')
  const alsoFrom = choiceList(fields, 'also_from', EXTRA_ORIGINS, 'other origin of its rows')
  const rowsFrom = fields.rows_from === undefined ? null : requiredChoice(fields, 'rows_from', COMPANY_ROWS_FROM, 'way its rows come in')
  if (rowsFrom !== 'mail') {
    if (startsOn !== null || alsoFrom.length > 0) refuse(words.accounts.startWithoutMail)
    return rowsFrom === null ? null : BY_HAND
  }
  return { rowsFrom: 'mail', startsOn: startsOn ?? refuse(words.accounts.mailWithoutStart), alsoFrom }
}

export function accountOf(fields: StoredFields, id: RecordId | null): AccountRecord {
  const slug = slugOf(fields.account)
  if (slug === '') {
    refuse(words.accounts.noName)
  }
  return { slug, label: textOf(fields.label), iban: normaliseIban(textOf(fields.iban)), currency: textOf(fields.currency).toUpperCase(), intake: intakeOf(fields), id: keyedId(id) }
}

export const ACCOUNT_CODEC: RecordCodec<AccountRecord> = {
  kind: ACCOUNT_RECORDS,
  key: (fields) => filledKey(slugOf(fields.account)),
  label: (fields) => labelWords([textOf(fields.account)]),
  make: accountOf,
  fieldsOf: (account) =>
    filledFields({
      account: account.slug,
      iban: account.iban,
      currency: account.currency,
      label: account.label,
      rows_from: account.intake?.rowsFrom ?? '',
      starts_on: account.intake?.rowsFrom === 'mail' ? account.intake.startsOn : null,
      also_from: account.intake?.rowsFrom === 'mail' ? account.intake.alsoFrom.join(',') : '',
    }),
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
      problems.push(problemOf(stored, words.accounts.otherCurrency(slug, currency, workbookCurrency)))
    }
  }
  const shared = sharedKeys(read.records, (stored) => stored.record.slug)
  for (const stored of read.records.filter((candidate) => shared.has(candidate.record.slug))) {
    problems.push(problemOf(stored, words.accounts.namedTwice(stored.record.slug)))
  }
  return { facts: read.records.map((stored) => stored.record).filter((account) => !shared.has(account.slug)), problems }
}
