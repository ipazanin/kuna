import { INVESTMENT_ROWS_FROM } from './investmentAccount'
import type { InvestmentAccount, InvestmentIntake } from './investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from './investmentKinds'
import { words } from './words'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { BY_HAND, EXTRA_ORIGINS } from '../../../../shared/app/accountSource'
import { choiceList, optionalDate, ownId, refuse, requiredChoice, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

/** How the account's rows come in, null while it does not say. Only an account the mail fills has a start day, which it always has, and other origins it takes. */
function intakeOf(fields: StoredFields): InvestmentIntake | null {
  const startsOn = optionalDate(fields, 'starts_on')
  const alsoFrom = choiceList(fields, 'also_from', EXTRA_ORIGINS, 'other origin of its rows')
  const rowsFrom = fields.rows_from === undefined ? null : requiredChoice(fields, 'rows_from', INVESTMENT_ROWS_FROM, 'way its rows come in')
  if (rowsFrom !== 'mail') {
    if (startsOn !== null || alsoFrom.length > 0) refuse(words.startWithoutMail)
    return rowsFrom === null ? null : BY_HAND
  }
  return { rowsFrom: 'mail', startsOn: startsOn ?? refuse(words.mailWithoutStart), alsoFrom }
}

export function investmentAccountOf(fields: StoredFields, id: RecordId | null): InvestmentAccount {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  return { id: ownId(id), name, note: textOf(fields.note), intake: intakeOf(fields) }
}

export const INVESTMENT_ACCOUNT_CODEC: RecordCodec<InvestmentAccount> = withIdField(
  INVESTMENT_ACCOUNT_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  investmentAccountOf,
  (account) =>
    filledFields({
      name: account.name,
      note: account.note,
      rows_from: account.intake?.rowsFrom ?? '',
      starts_on: account.intake?.rowsFrom === 'mail' ? account.intake.startsOn : null,
      also_from: account.intake?.rowsFrom === 'mail' ? account.intake.alsoFrom.join(',') : '',
    }),
)
