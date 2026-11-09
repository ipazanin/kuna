import type { BankSyncPort } from './bankSync'
import { leftOutOfKuna, proposeAccount } from '../domain/bankAccountSetup'
import type { AccountProposal, LinkedOfBank } from '../domain/bankAccountSetup'
import { NO_SINGLE_CURRENCY, namesEndedSession, sessionEnded } from '../domain/bankAnswer'
import type { BankBalance, BankTransaction, LinkedAccount } from '../domain/bankAnswer'
import { statedBalance } from '../domain/bankBalance'
import type { StatedBalance } from '../domain/bankBalance'
import { accountsOfLinked, fetchFrom, linkableBankNamed, olderRowsMissing } from '../domain/bankLinks'
import { BANK_SYNC_LABEL, bankSyncRows, pendingMoney, rowsWithMoves } from '../domain/bankSyncRows'
import { words } from '../domain/words'
import type { StatementRow, StatementRows } from '../../statements/domain/statementRows'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { Decimal } from '../../../../shared/money/decimal'
import { isUnauthorized } from '../../../../shared/google/googleApi'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { plural } from '../../../../shared/text/translation'

/** How far back a fetch for an account Kuna does not keep yet asks, so a link's first minutes bring all the history a bank gives. */
const NEW_ACCOUNT_HISTORY_DAYS = 5 * 366

/** A kept account whose fetch wanted older days than a bank gives outside a fresh link, and got none of them. */
export interface OlderRowsMissing {
  readonly bank: LinkableBank
  readonly account: Account
  /** The oldest day the bank's rows reach, or null when it gave none. */
  readonly reached: CivilDate | null
}

/** What the banks answered: the rows of all that did, and for the rest why not. */
export interface BankRead {
  /** The rows of the accounts Kuna keeps. */
  readonly statement: StatementRows
  /** Every account the live sessions reach. */
  readonly linked: readonly LinkedOfBank[]
  /** A draft for each currency of a linked account Kuna keeps no account for, with its rows held. */
  readonly proposals: readonly AccountProposal[]
  /** One line for each bank or account that gave no rows this time. */
  readonly problems: readonly string[]
  /** The banks whose approval is over, whatever day the file holds. */
  readonly ended: readonly LinkableBank[]
  /** The banks that answered for at least one account's rows, which starts their six hours. */
  readonly fetched: readonly LinkableBank[]
  /** What the banks say the accounts they answered for hold. */
  readonly stated: readonly StatedBalance[]
  readonly olderRows: readonly OlderRowsMissing[]
}

function reasonOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}

/** The Spending accounts more than one linked account of a session fits, as when a pocket comes under the current account's IBAN. Which one is which cannot be told, so neither is read. */
function accountsFitTwice(linkedAccounts: readonly LinkedAccount[], accounts: readonly Account[]): ReadonlySet<Account> {
  const fits = linkedAccounts.flatMap((linked) => accountsOfLinked(linked, accounts))
  return new Set(fits.filter((account) => fits.indexOf(account) !== fits.lastIndexOf(account)))
}

/** The currencies of an answer and its balances that no kept account takes, which a multi-currency account drafts an account for. */
function currenciesLeft(linked: LinkedAccount, kept: readonly Account[], answer: readonly BankTransaction[], balances: readonly BankBalance[]): readonly string[] {
  const keptCurrencies = new Set<string>(kept.map((account) => account.currency))
  const named =
    linked.currency === NO_SINGLE_CURRENCY
      ? [...answer.map((transaction) => transaction.currency), ...balances.map((balance) => balance.currency)]
      : [linked.currency, ...answer.map((transaction) => transaction.currency)]
  return [...new Set(named)].filter((currency) => currency !== '' && currency !== NO_SINGLE_CURRENCY && !keptCurrencies.has(currency))
}

/**
 * Asks the script for every session's accounts and each account's transactions and balance. The rows of kept accounts go
 * into one statement for the dry run, with the legs of each exchange and pocket move among them keyed to pair. An account
 * Kuna does not keep is fetched too and drafted, with its rows held, since a bank gives its older rows only just after a
 * link. One you said is not in Kuna is not fetched unless you keep an account under its IBAN. A bank or an account that
 * fails is a problem line and leaves the others' rows. Google turning the token away ends it all, since no later call
 * would go through. `freshLinks` are the banks linked just before this fetch, whose missing older rows a new link cannot bring.
 * `leftAlone` are banks asked too recently, whose accounts are listed from the session and none of them read.
 */
export async function readBanks(
  port: BankSyncPort,
  book: Pick<SpendingBook, 'accounts' | 'transactions' | 'settings'>,
  day: CivilDate,
  freshLinks: readonly LinkableBank[] = [],
  newId: () => RecordId = () => recordIdOf(ACCOUNT_RECORDS, newRecordId()),
  leftAlone: readonly LinkableBank[] = [],
): Promise<BankRead> {
  const rows: StatementRow[] = []
  const exchangeRates = new Map<StatementRow, Decimal>()
  const notes: string[] = []
  const linkedAll: LinkedOfBank[] = []
  const proposals: AccountProposal[] = []
  const problems: string[] = []
  const ended = new Set<LinkableBank>()
  const fetched = new Set<LinkableBank>()
  const stated: StatedBalance[] = []
  const olderRows: OlderRowsMissing[] = []
  const endedAt = (bank: LinkableBank, name: string): void => {
    ended.add(bank)
    problems.push(words.sessionEnded(name))
  }
  for (const session of await port.sessions()) {
    const bank = linkableBankNamed(session.bank)
    if (bank === null) continue
    if (sessionEnded(session)) {
      endedAt(bank, session.bank)
      continue
    }
    if (session.status !== 'AUTHORIZED') {
      problems.push(words.bankFailed(words.banks[bank], session.reason ?? session.status))
      continue
    }
    linkedAll.push(...session.accounts.map((account) => ({ bank, account })))
    if (leftAlone.includes(bank)) continue
    const offered = session.accounts.filter((linked) => !leftOutOfKuna(linked, book.accounts, book.settings.bankAccountsNotInKuna))
    const fitTwice = accountsFitTwice(offered, book.accounts)
    fitTwice.forEach((account) => problems.push(words.sameAccountTwice(session.bank, account.name)))
    for (const linked of offered) {
      const accounts = accountsOfLinked(linked, book.accounts)
      if (accounts.some((account) => fitTwice.has(account))) continue
      const starts = accounts.map((account) => fetchFrom(account, book.transactions, day))
      const latest = addDays(day, -1)
      const from = starts.map((start) => start.from).reduce((earliest, date) => (date < earliest ? date : earliest), addDays(day, accounts.length === 0 ? -NEW_ACCOUNT_HISTORY_DAYS : 0))
      let answer: readonly BankTransaction[]
      try {
        answer = await port.transactions(linked.uid, from < latest ? from : latest, accounts.length === 0 || starts.some((start) => start.longest))
      } catch (failure) {
        if (isUnauthorized(failure)) throw failure
        const reason = reasonOf(failure)
        if (namesEndedSession(reason)) {
          endedAt(bank, session.bank)
          break
        }
        problems.push(words.bankFailed(words.banks[bank], reason))
        continue
      }
      fetched.add(bank)
      accounts.forEach((account, place) => {
        const statement = bankSyncRows(answer, account)
        rows.push(...statement.rows)
        statement.exchangeRates.forEach((rate, row) => exchangeRates.set(row, rate))
        notes.push(...statement.notes)
        const missing = freshLinks.includes(bank) ? null : olderRowsMissing(account, starts[place]!, statement.rows, book.transactions, day)
        if (missing !== null) olderRows.push({ bank, account, reached: missing.reached })
      })
      let balances: readonly BankBalance[] = []
      try {
        balances = await port.balances(linked.uid)
      } catch (failure) {
        if (isUnauthorized(failure)) throw failure
        notes.push(words.balanceNotRead((accounts.length === 0 ? [linked.iban] : accounts.map((account) => account.name)).join(', '), reasonOf(failure)))
      }
      for (const account of accounts) {
        const balance = statedBalance(balances, account.currency)
        if (balance !== null) stated.push({ account, balance, pending: pendingMoney(answer, account.currency) })
      }
      for (const currency of currenciesLeft(linked, accounts, answer, balances)) {
        const code = currencyCodeOf(currency)
        if (linked.currency === NO_SINGLE_CURRENCY || currency === linked.currency) {
          if (code !== null) proposals.push(proposeAccount(linked, bank, code, answer, balances, newId(), day, [...book.accounts, ...proposals.map((proposal) => proposal.account)]))
          continue
        }
        const count = answer.filter((transaction) => transaction.currency === currency).length
        notes.push(plural(words.otherCurrencyLeftOut(count, currency), count))
      }
    }
  }
  // The drafts' rows go through the pairing keys with the kept rows, so an exchange into an account not kept yet keeps a key both legs share.
  const held = proposals.flatMap((proposal) => proposal.rows.rows)
  proposals.forEach((proposal) => proposal.rows.exchangeRates.forEach((rate, row) => exchangeRates.set(row, rate)))
  const moved = rowsWithMoves([...rows, ...held], exchangeRates, [...book.accounts, ...proposals.map((proposal) => proposal.account)])
  const movedOf = new Map(held.map((row, place) => [row, moved[rows.length + place]!]))
  return {
    statement: { label: BANK_SYNC_LABEL, rows: moved.slice(0, rows.length), notes },
    linked: linkedAll,
    proposals: proposals.map((proposal) => ({ ...proposal, rows: { ...proposal.rows, rows: proposal.rows.rows.map((row) => movedOf.get(row) ?? row) } })),
    problems,
    ended: [...ended],
    fetched: [...fetched],
    stated,
    olderRows,
  }
}
