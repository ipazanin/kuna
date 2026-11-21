import { ACCOUNT_KINDS, SPENDING_SOURCES, cardsOfText, cardsText, sourceOfDetails } from './account'
import type { Account, SpendingPeriod } from './account'
import { flagOf, optionalAccountMoney } from './fieldReading'
import { ACCOUNT_RECORDS } from './spendingKinds'
import { words } from './words'
import { ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { periodsOfText, periodsText } from '../../../../shared/app/accountSource'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { ownId, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
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

/** The periods a `sources` cell holds, which refuses text that is not a list of them. */
function sourcesOf(text: string): readonly SpendingPeriod[] {
  return periodsOfText(text, SPENDING_SOURCES, parseCivilDate) ?? refuse(words.notSources(text))
}

/**
 * The one source of a file from before periods, from its `rows_from` cell, or by its details when it has none. The book works
 * out the periods such an account had from its rows, as `derivedSources` says.
 */
function storedSourceOf(fields: StoredFields, kind: Account['kind'], iban: string): readonly SpendingPeriod[] {
  const source = fields.rows_from === undefined ? sourceOfDetails({ kind, iban }) : requiredChoice(fields, 'rows_from', ['bank-link', 'by-hand'] as const, 'way its rows come in')
  return [{ source, from: null }]
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
  const sources = fields.sources === undefined ? storedSourceOf(fields, kind, iban) : sourcesOf(textOf(fields.sources))
  if (kind === 'cash' && sources.some((period) => period.source !== 'by-hand')) refuse(words.sourcesOnCash)
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
    sources,
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
      sources: periodsText(account.sources),
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
