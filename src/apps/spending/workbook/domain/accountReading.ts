import { ACCOUNT_BANKS, ACCOUNT_KINDS, ROWS_FROM, rowsFromOfDetails } from './account'
import type { Account } from './account'
import { flagOf, optionalAccountMoney } from './fieldReading'
import { ACCOUNT_RECORDS } from './spendingKinds'
import { words } from './words'
import { ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

/** An IBAN as Kuna compares it: in capitals, without spaces. */
export function ibanKey(text: string): string {
  return text.replace(/\s+/g, '').toUpperCase()
}

export function accountOf(fields: StoredFields, id: RecordId | null): Account {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  const kind = requiredChoice(fields, 'kind', ACCOUNT_KINDS, 'kind of account')
  const bank = fields.bank === undefined ? null : requiredChoice(fields, 'bank', ACCOUNT_BANKS)
  if (bank !== null && kind === 'cash') refuse(words.bankOnCash)
  const currencyText = textOf(fields.currency)
  if (currencyText === '') refuse(storedWords.reasons.none('currency', ''))
  const currency = currencyCodeOf(currencyText) ?? refuse(words.notACurrency(currencyText))
  const iban = ibanKey(textOf(fields.iban))
  if (iban !== '' && kind === 'cash') refuse(words.ibanOnCash)
  const rowsFrom = fields.rows_from === undefined ? rowsFromOfDetails({ kind, iban }) : requiredChoice(fields, 'rows_from', ROWS_FROM, 'way its rows come in')
  if (rowsFrom === 'bank-link' && kind === 'cash') refuse(words.bankLinkOnCash)
  return {
    id: ownId(id),
    name,
    kind,
    bank,
    currency,
    opening: optionalAccountMoney(fields, 'opening') ?? ZERO_ACCOUNT_MONEY,
    openedOn: requiredDate(fields, 'opened_on'),
    rowsFrom,
    iban,
    closed: flagOf(fields, 'closed'),
  }
}

export const ACCOUNT_CODEC: RecordCodec<Account> = withIdField(
  ACCOUNT_RECORDS,
  (fields) => labelWords([textOf(fields.name)]),
  accountOf,
  (account) =>
    filledFields({
      name: account.name,
      kind: account.kind,
      bank: account.bank,
      currency: account.currency,
      opening: amountText(account.opening),
      opened_on: account.openedOn,
      rows_from: account.rowsFrom,
      iban: account.iban,
      closed: account.closed ? true : null,
    }),
)
