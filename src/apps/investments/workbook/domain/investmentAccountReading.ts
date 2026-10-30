import type { InvestmentAccount } from './investmentAccount'
import { INVESTMENT_ACCOUNT_RECORDS } from './investmentKinds'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

export function investmentAccountOf(fields: StoredFields, id: RecordId | null): InvestmentAccount {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  return { id: ownId(id), name, note: textOf(fields.note) }
}

export const INVESTMENT_ACCOUNT_CODEC: RecordCodec<InvestmentAccount> = withIdField(
  INVESTMENT_ACCOUNT_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  investmentAccountOf,
  (account) => filledFields({ name: account.name, note: account.note }),
)
