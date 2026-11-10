import { NO_SINGLE_CURRENCY } from './bankAnswer'
import type { BankBalance, BankTransaction, LinkedAccount } from './bankAnswer'
import { statedBalance } from './bankBalance'
import { accountsOfLinked } from './bankLinks'
import { openingOn, startDays as startDaysOf, startsWithin } from '../../accounts/domain/bankOpening'
import type { BankOpening, OpeningEvidence } from '../../accounts/domain/bankOpening'
import { bankSyncRows, pendingMoney } from './bankSyncRows'
import type { SyncedRows } from './bankSyncRows'
import { draftedAccount } from '../../accounts/domain/accountDraft'
import type { Account, AccountKind } from '../../workbook/domain/account'
import { ibanKey } from '../../workbook/domain/accountReading'
import type { LinkableBank, SpendingSettings } from '../../workbook/domain/spendingSettings'
import type { Transaction } from '../../workbook/domain/transaction'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'

/** One account a session reaches, with the bank it belongs to. */
export interface LinkedOfBank {
  readonly bank: LinkableBank
  readonly account: LinkedAccount
}

/** An account Kuna does not keep yet, drafted from what its bank says, with the bank's answer held until it is added. */
export interface AccountProposal {
  readonly bank: LinkableBank
  readonly linked: LinkedAccount
  /** The draft, starting on the day of the fetch at the bank's balance less that day's rows. */
  readonly account: Account
  /** Every row the fetch gave for it, on the draft, held until it is added. */
  readonly rows: SyncedRows
  /** The bank's balance at the fetch, or null when it gave none. */
  readonly stated: AccountMoney | null
  /** Whether the bank held pending rows its balance may count. */
  readonly pending: boolean
  /** The day of the fetch, the latest day the account can start on, since the bank's balance knows nothing after it. */
  readonly fetchedOn: CivilDate
}

/** An account to add from a proposal, starting on the day the person chose. Rows before that day stay out of Kuna. */
export interface BankAccountStart {
  readonly proposal: AccountProposal
  readonly startsOn: CivilDate
}

/** The account a start adds, with how its opening was worked out. */
export interface StartedAccount {
  readonly account: Account
  readonly opening: BankOpening
}

function evidenceOf(proposal: Pick<AccountProposal, 'rows' | 'stated' | 'pending'>): OpeningEvidence {
  return { rows: proposal.rows.rows, stated: proposal.stated, pending: proposal.pending }
}

/** The days a proposed account can start on, from the first day its rows reach to the day of the fetch. */
export function startDays(proposal: AccountProposal): { readonly earliest: CivilDate; readonly latest: CivilDate } {
  return startDaysOf(evidenceOf(proposal), proposal.fetchedOn)
}

/** Whether a proposed account can start on the day. */
export function canStartOn(proposal: AccountProposal, startsOn: CivilDate): boolean {
  return startsWithin(evidenceOf(proposal), startsOn, proposal.fetchedOn)
}

/** The account as it starts on the day: opening at the bank's balance less the rows from that day on. */
export function startedAccount({ proposal, startsOn }: BankAccountStart): StartedAccount {
  const opening = openingOn(evidenceOf(proposal), startsOn)
  return { account: { ...proposal.account, opening: opening.opening, openedOn: opening.openedOn }, opening }
}

/**
 * One line of the setup list for one currency of a linked account. `kept` has a Spending account by IBAN and currency,
 * `fits` has an account that would keep it once it takes the bank's details, `missing` has none, and `not-in-kuna` is one
 * you said Kuna does not keep. `update` is the account with the bank's details, when they differ from what it holds and
 * you did not say to keep yours, which `keptMine` tells.
 */
export type SetupLine =
  | { readonly kind: 'kept'; readonly bank: LinkableBank; readonly linked: LinkedAccount; readonly account: Account; readonly update: Account | null; readonly keptMine: boolean }
  | { readonly kind: 'fits'; readonly bank: LinkableBank; readonly linked: LinkedAccount; readonly account: Account; readonly update: Account; readonly proposal: AccountProposal | null }
  | { readonly kind: 'missing'; readonly bank: LinkableBank; readonly linked: LinkedAccount; readonly currency: string; readonly proposal: AccountProposal | null }
  | { readonly kind: 'not-in-kuna'; readonly bank: LinkableBank; readonly linked: LinkedAccount; readonly key: string }

/**
 * How the settings of accounts not in Kuna and accounts that keep their own details name a linked account: its IBAN, else
 * the bank's hash of it, then its currency. Null for an account with neither, since the bank names it anew on every link.
 */
export function bankAccountKey(linked: LinkedAccount): string | null {
  const name = ibanKey(linked.iban) || linked.identificationHash?.trim() || ''
  return name === '' ? null : `${name} ${linked.currency}`
}

const SAVINGS_PRODUCT = /saving|štedn|stedn/i

/** Savings when the bank says so by its type or its product's name, a current account for any other type it states, and null when it states nothing. */
export function kindOfBankAccount(linked: Pick<LinkedAccount, 'cashAccountType' | 'product'>): Extract<AccountKind, 'bank' | 'savings'> | null {
  if (linked.cashAccountType === 'SVGS' || SAVINGS_PRODUCT.test(linked.product ?? '')) return 'savings'
  return linked.cashAccountType === null ? null : 'bank'
}

/** A new account as its bank describes it, opening at zero on the day. */
export function draftAccount(linked: LinkedAccount, bank: LinkableBank, currency: CurrencyCode, id: RecordId, day: CivilDate, accounts: readonly Pick<Account, 'name'>[]): Account {
  return { id, ...draftedAccount({ kind: kindOfBankAccount(linked) ?? 'bank', bank, currency, iban: ibanKey(linked.iban), opening: ZERO_ACCOUNT_MONEY, openedOn: day }, accounts) }
}

/** The draft starting on the day of the fetch, with the bank's rows and balance held for when it is added. */
export function proposeAccount(
  linked: LinkedAccount,
  bank: LinkableBank,
  currency: CurrencyCode,
  answer: readonly BankTransaction[],
  balances: readonly BankBalance[],
  id: RecordId,
  day: CivilDate,
  accounts: readonly Pick<Account, 'name'>[],
): AccountProposal {
  const draft = draftAccount(linked, bank, currency, id, day, accounts)
  const held = { bank, linked, account: draft, rows: bankSyncRows(answer, draft), stated: statedBalance(balances, currency), pending: pendingMoney(answer, currency) !== null, fetchedOn: day }
  return { ...held, account: startedAccount({ proposal: held, startsOn: day }).account }
}

/** The account with the bank's details: its bank, IBAN and currency, and its kind where the bank states one. Its name and opening stay. */
export function withBankDetails(account: Account, linked: LinkedAccount, bank: LinkableBank, currency: CurrencyCode): Account {
  return { ...account, bank, iban: ibanKey(linked.iban), currency, kind: kindOfBankAccount(linked) ?? account.kind }
}

function sameDetails(one: Account, other: Account): boolean {
  return one.bank === other.bank && one.iban === other.iban && one.currency === other.currency && one.kind === other.kind
}

/**
 * The account that would keep a linked account once it takes the bank's details: an open one of the bank and currency typed
 * without an IBAN, else one with its IBAN in another currency that no other linked account keeps, only while it has no
 * entries, since an account keeps the currency of its entries. Never cash.
 */
function fittingAccount(
  linked: LinkedAccount,
  bank: LinkableBank,
  currency: string,
  accounts: readonly Account[],
  claimed: ReadonlySet<RecordId>,
  rows: readonly Pick<Transaction, 'account'>[],
): Account | null {
  const iban = ibanKey(linked.iban)
  const open = accounts.filter((account) => !claimed.has(account.id) && !account.closed && account.kind !== 'cash')
  const withoutIban = open.find((account) => account.iban === '' && account.currency === currency && (account.bank === bank || account.bank === null || account.bank === 'other'))
  return withoutIban ?? open.find((account) => iban !== '' && account.iban === iban && !rows.some((row) => row.account === account.id)) ?? null
}

/** The currencies a linked account comes as: its own, or for a multi-currency one each that Kuna keeps under its IBAN or that the fetch drafted. */
function currenciesOf(linked: LinkedAccount, kept: readonly Account[], proposals: readonly AccountProposal[]): readonly string[] {
  if (linked.currency !== NO_SINGLE_CURRENCY) return [linked.currency]
  return [...new Set([...kept.map((account) => account.currency), ...proposals.filter((proposal) => proposal.linked.uid === linked.uid).map((proposal) => proposal.account.currency)])]
}

/** Whether a linked account is one you said Kuna does not keep, which an account you keep under its IBAN overrides. */
export function leftOutOfKuna(linked: LinkedAccount, accounts: readonly Account[], notInKuna: readonly string[]): boolean {
  const key = bankAccountKey(linked)
  return key !== null && notInKuna.includes(key) && accountsOfLinked(linked, accounts).length === 0
}

/** A line of the setup list, as the chat reads it and names it in a step. It is no record of the file and lives as long as the fetch it comes from. */
export const BANK_ACCOUNT_LINES: Pick<RecordKind, 'name' | 'noun'> = {
  name: 'bank-account',
  noun: {
    en: { one: 'linked bank account', many: 'linked bank accounts', article: 'a' },
    hr: { one: 'povezani bankovni račun', of: 'povezanog bankovnog računa', few: 'povezana bankovna računa', other: 'povezanih bankovnih računa', gender: 'masculine' },
  },
}

/** The currency of a line: the one an account will hold once it takes the bank's details, else its own, else the bank's. */
export function setupLineCurrency(line: SetupLine): string {
  if (line.kind === 'kept' || line.kind === 'fits') return line.update?.currency ?? line.account.currency
  return line.kind === 'missing' ? line.currency : line.linked.currency
}

/** What names a line on the page and in the chat: the bank's id of the linked account and the line's currency. */
export function setupLineKey(line: SetupLine): string {
  return `${line.linked.uid} ${setupLineCurrency(line)}`
}

/** What a person can do with a line of the setup list. Bring back takes an account off the list of ones not in Kuna, and bring back mine offers the bank's details again. */
export type SetupAction = 'add' | 'update' | 'keep-mine' | 'leave-out' | 'bring-back' | 'bring-back-mine'

/** The actions a line offers. Keep mine and leave out need a key that names the account across links. */
export function setupActions(line: SetupLine): readonly SetupAction[] {
  const named = bankAccountKey(line.linked) !== null
  switch (line.kind) {
    case 'missing':
      return [...(line.proposal === null ? [] : (['add'] as const)), ...(named ? (['leave-out'] as const) : [])]
    case 'fits':
      return ['update', ...(named ? (['leave-out'] as const) : [])]
    case 'kept':
      return [...(line.update === null ? [] : (['update'] as const)), ...(line.update !== null && named ? (['keep-mine'] as const) : []), ...(line.keptMine ? (['bring-back-mine'] as const) : [])]
    case 'not-in-kuna':
      return ['bring-back']
  }
}

/** The setup list: each currency of each linked account, matched against the file as it stands now. */
export function setupLines(
  linked: readonly LinkedOfBank[],
  proposals: readonly AccountProposal[],
  book: {
    readonly accounts: readonly Account[]
    readonly transactions: readonly Pick<Transaction, 'account'>[]
    readonly settings: Pick<SpendingSettings, 'bankAccountsNotInKuna' | 'bankAccountsKeepMine'>
  },
): readonly SetupLine[] {
  const { bankAccountsNotInKuna: notInKuna, bankAccountsKeepMine: keepMine } = book.settings
  const claimed = new Set<RecordId>(linked.flatMap(({ account }) => accountsOfLinked(account, book.accounts).map((kept) => kept.id)))
  return linked.flatMap(({ bank, account: linkedAccount }): readonly SetupLine[] => {
    const key = bankAccountKey(linkedAccount)
    if (key !== null && leftOutOfKuna(linkedAccount, book.accounts, notInKuna)) return [{ kind: 'not-in-kuna', bank, linked: linkedAccount, key }]
    const kept = accountsOfLinked(linkedAccount, book.accounts)
    return currenciesOf(linkedAccount, kept, proposals).map((currency): SetupLine => {
      const proposal = proposals.find((held) => held.linked.uid === linkedAccount.uid && held.account.currency === currency) ?? null
      const account = kept.find((each) => each.currency === currency)
      if (account !== undefined) {
        const update = withBankDetails(account, linkedAccount, bank, account.currency)
        const declined = key !== null && keepMine.includes(key)
        return { kind: 'kept', bank, linked: linkedAccount, account, update: declined || sameDetails(account, update) ? null : update, keptMine: declined }
      }
      const code = currencyCodeOf(currency)
      const fitting = code === null ? null : fittingAccount(linkedAccount, bank, code, book.accounts, claimed, book.transactions)
      if (fitting === null || code === null) return { kind: 'missing', bank, linked: linkedAccount, currency, proposal }
      claimed.add(fitting.id)
      return { kind: 'fits', bank, linked: linkedAccount, account: fitting, update: withBankDetails(fitting, linkedAccount, bank, code), proposal }
    })
  })
}

function sameBankAccount(one: AccountProposal, other: AccountProposal): boolean {
  const nameOf = ({ linked }: AccountProposal): string => bankAccountKey(linked) ?? linked.uid
  return one.bank === other.bank && one.account.currency === other.account.currency && nameOf(one) === nameOf(other)
}

/**
 * A new fetch's drafts, each giving way to the one an earlier fetch held for the same account when that one can start earlier,
 * since only the fetch just after a link brings a bank's older rows and a later sync would otherwise drop them.
 */
export function withOlderHistory(fetched: readonly AccountProposal[], held: readonly AccountProposal[]): readonly AccountProposal[] {
  return fetched.map((proposal) => {
    const earlier = held.find((each) => sameBankAccount(each, proposal))
    return earlier !== undefined && startDays(earlier).earliest < startDays(proposal).earliest ? earlier : proposal
  })
}
