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
import { datedPeriodsRefusal, periodsOfIntake, periodsOfText, periodsText } from '../../../../shared/app/accountSource'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { choiceList, keyedId, optionalDate, refuse, requiredChoice, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { COMPANY_SOURCES } from './workbook'
import type { Account, CompanyPeriod } from './workbook'
import { words } from './words'

/** An account as the accounts tab holds it, with the id its name makes. Its periods are null in a file from before each account said how its rows come in. */
export type AccountRecord = Omit<Account, 'sources'> & { readonly sources: readonly CompanyPeriod[] | null; readonly id: RecordId }

/** The periods a `sources` cell holds, which refuses text that is not a list of them. */
function sourcesOfText(text: string): readonly CompanyPeriod[] {
  const periods = periodsOfText(text, COMPANY_SOURCES, parseCivilDate, 'may-have-day')
  return periods !== null && datedPeriodsRefusal(periods, ['mail']) === null ? periods : refuse(words.accounts.notSources(text))
}

/**
 * The periods of a file from before periods, from its `rows_from`, `starts_on` and `also_from` cells, or null while it has none.
 * Only an account the bank's statements fill has a start day, which it always has, and other origins it takes.
 */
function storedSourcesOf(fields: StoredFields): readonly CompanyPeriod[] | null {
  const startsOn = optionalDate(fields, 'starts_on')
  const alsoFrom = choiceList(fields, 'also_from', ['provider-file'] as const, 'other origin of its rows')
  const rowsFrom = fields.rows_from === undefined ? null : requiredChoice(fields, 'rows_from', ['mail', 'by-hand'] as const, 'way its rows come in')
  if (rowsFrom !== 'mail') {
    if (startsOn !== null || alsoFrom.length > 0) refuse(words.accounts.startWithoutMail)
    return rowsFrom === null ? null : periodsOfIntake(null)
  }
  return periodsOfIntake({ source: 'mail', startsOn: startsOn ?? refuse(words.accounts.mailWithoutStart), takesFile: alsoFrom.length > 0 })
}

export function accountOf(fields: StoredFields, id: RecordId | null): AccountRecord {
  const slug = slugOf(fields.account)
  if (slug === '') {
    refuse(words.accounts.noName)
  }
  return {
    slug,
    label: textOf(fields.label),
    iban: normaliseIban(textOf(fields.iban)),
    currency: textOf(fields.currency).toUpperCase(),
    bank: textOf(fields.bank).trim(),
    sources: fields.sources === undefined ? storedSourcesOf(fields) : sourcesOfText(textOf(fields.sources)),
    id: keyedId(id),
  }
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
      bank: account.bank,
      sources: account.sources === null ? '' : periodsText(account.sources),
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
