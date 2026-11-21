import { ACCOUNT_KINDS, ROWS_FROM, cardsOfText, cardsText, rowsFromOfDetails } from './account'
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
import { EXTRA_ORIGINS } from '../../../../shared/app/accountSource'
import { choiceList, ownId, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'
import { bankLinkWithoutIban } from './account'
import { doubted, readEach } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { listInWords } from '../../../../shared/text/listInWords'

/** An IBAN as Kuna compares it: in capitals, without spaces. */
export function ibanKey(text: string): string {
  return text.replace(/\s+/g, '').toUpperCase()
}

/** The banks a file stored as keys before a bank took any name, read as the names Enable Banking gives them. `other` named no bank. */
const BANK_KEYS: Readonly<Record<string, string | null>> = { otp: 'OTP banka', revolut: 'Revolut', other: null }

/** A stored bank as its name, trimmed, or null for none. */
function bankOfText(text: string): string | null {
  const trimmed = text.trim()
  return trimmed === '' ? null : Object.hasOwn(BANK_KEYS, trimmed) ? BANK_KEYS[trimmed]! : trimmed
}

export function accountOf(fields: StoredFields, id: RecordId | null): Account {
  const name = textOf(fields.name)
  if (name === '') refuse(storedWords.reasons.none('name', ''))
  const kind = requiredChoice(fields, 'kind', ACCOUNT_KINDS, 'kind of account')
  const bank = bankOfText(textOf(fields.bank))
  if (bank !== null && kind === 'cash') refuse(words.bankOnCash)
  const currencyText = textOf(fields.currency)
  if (currencyText === '') refuse(storedWords.reasons.none('currency', ''))
  const currency = currencyCodeOf(currencyText) ?? refuse(words.notACurrency(currencyText))
  const iban = ibanKey(textOf(fields.iban))
  if (iban !== '' && kind === 'cash') refuse(words.ibanOnCash)
  const rowsFrom = fields.rows_from === undefined ? rowsFromOfDetails({ kind, iban }) : requiredChoice(fields, 'rows_from', ROWS_FROM, 'way its rows come in')
  if (rowsFrom === 'bank-link' && kind === 'cash') refuse(words.bankLinkOnCash)
  const alsoFrom = choiceList(fields, 'also_from', EXTRA_ORIGINS, 'other origin of its rows')
  if (alsoFrom.length > 0 && rowsFrom === 'by-hand') refuse(words.alsoFromByHand)
  const cardsField = textOf(fields.cards)
  const cards = cardsOfText(cardsField) ?? refuse(words.notCards(cardsField))
  if (cards.length > 0 && kind === 'cash') refuse(words.cardsOnCash)
  return {
    id: ownId(id),
    name,
    kind,
    bank,
    currency,
    opening: optionalAccountMoney(fields, 'opening') ?? ZERO_ACCOUNT_MONEY,
    openedOn: requiredDate(fields, 'opened_on'),
    rowsFrom,
    alsoFrom,
    iban,
    cards,
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
      also_from: account.alsoFrom.join(','),
      iban: account.iban,
      cards: account.cards.length === 0 ? null : cardsText(account.cards),
      closed: account.closed ? true : null,
    }),
)

/** Accounts count, but one that shares its IBAN and currency with another, or takes its rows from a bank link with no IBAN, is doubted. */
export function readAccounts(read: RecordsRead<Account>): Reading<Account> {
  const ibanOf = (account: Account): string | null => (account.iban === '' ? null : `${ibanKey(account.iban)} ${account.currency}`)
  return doubted(
    readEach(read, () => []),
    read,
    (account) => {
      if (bankLinkWithoutIban(account)) return words.bankLinkWithoutIban
      const key = ibanOf(account)
      const others = key === null ? [] : read.records.filter((stored) => stored.record !== account && ibanOf(stored.record) === key).map((stored) => stored.record.name.trim())
      return others.length === 0 ? null : words.ibanShared(listInWords(others), ibanKey(account.iban), account.currency)
    },
  )
}
