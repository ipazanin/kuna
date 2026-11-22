import { INVESTMENT_SOURCES } from './investmentAccount'
import type { InvestmentAccount, InvestmentPeriod } from './investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from './investmentKinds'
import { words } from './words'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { datedPeriodsRefusal, periodsOfIntake, periodsOfText, periodsText } from '../../../../shared/app/accountSource'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { choiceList, optionalDate, ownId, refuse, requiredChoice, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

/** The periods a `sources` cell holds, which refuses text that is not a list of them, or one whose first period of the mail has no day. */
function sourcesOfText(text: string): readonly InvestmentPeriod[] {
  const periods = periodsOfText(text, INVESTMENT_SOURCES, parseCivilDate, 'may-have-day')
  return periods !== null && datedPeriodsRefusal(periods, ['mail']) === null ? periods : refuse(words.notSources(text))
}

/**
 * The periods of a file from before periods, from its `rows_from`, `starts_on` and `also_from` cells, or null while it has none.
 * Only an account the mail fills has a start day, which it always has, and other origins it takes.
 */
function storedSourcesOf(fields: StoredFields): readonly InvestmentPeriod[] | null {
  const startsOn = optionalDate(fields, 'starts_on')
  const alsoFrom = choiceList(fields, 'also_from', ['provider-file'] as const, 'other origin of its rows')
  const rowsFrom = fields.rows_from === undefined ? null : requiredChoice(fields, 'rows_from', ['mail', 'by-hand'] as const, 'way its rows come in')
  if (rowsFrom !== 'mail') {
    if (startsOn !== null || alsoFrom.length > 0) refuse(words.startWithoutMail)
    return rowsFrom === null ? null : periodsOfIntake(null)
  }
  return periodsOfIntake({ source: 'mail', startsOn: startsOn ?? refuse(words.mailWithoutStart), takesFile: alsoFrom.length > 0 })
}

export function investmentAccountOf(fields: StoredFields, id: RecordId | null): InvestmentAccount {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  return { id: ownId(id), name, note: textOf(fields.note), sources: fields.sources === undefined ? storedSourcesOf(fields) : sourcesOfText(textOf(fields.sources)) }
}

export const INVESTMENT_ACCOUNT_CODEC: RecordCodec<InvestmentAccount> = withIdField(
  INVESTMENT_ACCOUNT_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  investmentAccountOf,
  (account) =>
    filledFields({
      name: account.name,
      note: account.note,
      sources: account.sources === null ? '' : periodsText(account.sources),
    }),
)
