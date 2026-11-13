import { BY_HAND, INVESTMENT_ROWS_FROM } from './investmentAccount'
import type { AccountIntake, InvestmentAccount } from './investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from './investmentKinds'
import { words } from './words'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { optionalDate, ownId, refuse, requiredChoice, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

/** How the account's rows come in, null while it does not say. Only an account the mail fills has a start day, and it always has one. */
function intakeOf(fields: StoredFields): AccountIntake | null {
  const startsOn = optionalDate(fields, 'starts_on')
  if (fields.rows_from === undefined) {
    if (startsOn !== null) refuse(words.startWithoutMail)
    return null
  }
  if (requiredChoice(fields, 'rows_from', INVESTMENT_ROWS_FROM, 'way its rows come in') === 'by-hand') {
    if (startsOn !== null) refuse(words.startWithoutMail)
    return BY_HAND
  }
  return { rowsFrom: 'mail', startsOn: startsOn ?? refuse(words.mailWithoutStart) }
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
    }),
)
