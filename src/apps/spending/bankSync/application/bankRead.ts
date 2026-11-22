import { leftOutOfKuna, linkedAccountEnding, proposeAccount } from '../domain/bankAccountSetup'
import type { AccountProposal, LinkedOfBank } from '../domain/bankAccountSetup'
import { NO_SINGLE_CURRENCY, namesEndedSession, sessionEnded } from '../../../../shared/bank-sync/domain/bankAnswer'
import type { BankBalance, BankTransaction, LinkedAccount } from '../../../../shared/bank-sync/domain/bankAnswer'
import type { StatedBalance } from '../domain/bankBalance'
import { sameLink } from '../../../../shared/bank-sync/domain/bankLink'
import type { LinkName } from '../../../../shared/bank-sync/domain/bankLink'
import { liveLinks } from '../../../../shared/bank-sync/domain/bankLinkDays'
import { statedBalance, unlistedPending } from '../../../../shared/bank-sync/domain/statedBalance'
import type { BankSyncPort } from '../../../../shared/bank-sync/application/bankSyncPort'
import { accountsOfLinked, fetchFrom, olderRowsMissing } from '../domain/bankLinks'
import { BANK_SYNC_LABEL, bankSyncRows, rowsWithMoves } from '../domain/bankSyncRows'
import { words } from '../domain/words'
import type { FileNote, StatementRow, StatementRows } from '../../statements/domain/statementRows'
import { sourceOfDay } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { ACCOUNT_RECORDS } from '../../workbook/domain/spendingKinds'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { Decimal } from '../../../../shared/money/decimal'
import { isUnauthorized } from '../../../../shared/google/googleApi'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How far back a fetch for an account Kuna does not keep yet asks, so a link's first minutes bring all the history a bank gives. */
const NEW_ACCOUNT_HISTORY_DAYS = 5 * 366

/** A kept account whose fetch wanted older days than a bank gives outside a fresh link, and got none of them. */
export interface OlderRowsMissing {
  readonly link: LinkName
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
  /** The links whose approval is over, whatever day the file holds. */
  readonly ended: readonly LinkName[]
  /** The links that answered for at least one account's rows, which starts their six hours. */
  readonly fetched: readonly LinkName[]
  /** What the banks say the accounts they answered for hold. */
  readonly stated: readonly StatedBalance[]
  readonly olderRows: readonly OlderRowsMissing[]
}

function withLink(links: readonly LinkName[], link: LinkName): readonly LinkName[] {
  return links.some((other) => sameLink(other, link)) ? links : [...links, { bank: link.bank, usage: link.usage }]
}

function reasonOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}

/** The accounts whose rows come from a bank link today, which are the only ones the sync reads. */
function readByBank(accounts: readonly Account[], day: CivilDate): readonly Account[] {
  return accounts.filter((account) => sourceOfDay(account, day) === 'bank-link')
}

/** The bank-linked accounts more than one linked account of a session fits, as when a pocket comes under the current account's IBAN. Which one is which cannot be told, so neither is read. */
function accountsFitTwice(linkedAccounts: readonly LinkedAccount[], accounts: readonly Account[], day: CivilDate): ReadonlySet<Account> {
  const fits = linkedAccounts.flatMap((linked) => readByBank(accountsOfLinked(linked, accounts), day))
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
 * Asks the script for every session's accounts and each bank-linked account's transactions and balance. The rows of those
 * accounts go into one statement for the dry run, with the legs of each exchange and pocket move among them keyed to pair.
 * An account Kuna does not keep is fetched too and drafted, with its rows held, since a bank gives its older rows only just
 * after a link. One you said is not in Kuna is not fetched unless you keep an account under its IBAN. One whose accounts in
 * Kuna all take their rows by hand is neither fetched nor drafted, since those accounts keep it. A bank or an account that
 * fails is a problem line and leaves the others' rows. Google turning the token away ends it all, since no later call
 * would go through. A bank whose link the file says is live but whose session this browser does not hold is a problem
 * line too, since only fetching the keys brings it here. `freshLinks` are the links made just before this fetch, whose missing older rows a new link cannot bring. `leftAlone` are
 * links asked too recently, whose accounts are listed from the session and none of them read.
 */
export async function readBanks(
  port: BankSyncPort,
  book: Pick<SpendingBook, 'accounts' | 'transactions' | 'settings' | 'bankLinks'>,
  day: CivilDate,
  freshLinks: readonly LinkName[] = [],
  newId: () => RecordId = () => recordIdOf(ACCOUNT_RECORDS, newRecordId()),
  leftAlone: readonly LinkName[] = [],
): Promise<BankRead> {
  const rows: StatementRow[] = []
  const exchangeRates = new Map<StatementRow, Decimal>()
  const fileNotes: FileNote[] = []
  const linkedAll: LinkedOfBank[] = []
  const proposals: AccountProposal[] = []
  const problems: string[] = []
  let ended: readonly LinkName[] = []
  let fetched: readonly LinkName[] = []
  const stated: StatedBalance[] = []
  const olderRows: OlderRowsMissing[] = []
  const covers = new Map<RecordId, DateRange>()
  const endedAt = (link: LinkName): void => {
    ended = withLink(ended, link)
    problems.push(words.sessionEnded(link.bank))
  }
  const sessions = await port.sessions()
  liveLinks(book.bankLinks, day)
    .filter((link) => !sessions.some((session) => sameLink(session, link)))
    .forEach((link) => problems.push(words.sessionNotHere(link.bank)))
  for (const session of sessions) {
    const { bank } = session
    if (sessionEnded(session)) {
      endedAt(session)
      continue
    }
    if (session.status !== 'AUTHORIZED') {
      problems.push(words.bankFailed(bank, session.reason ?? session.status))
      continue
    }
    linkedAll.push(...session.accounts.map((account) => ({ bank, account })))
    if (leftAlone.some((link) => sameLink(link, session))) continue
    const offered = session.accounts.filter((linked) => !leftOutOfKuna(linked, book.accounts, book.settings.bankAccountsNotInKuna))
    const fitTwice = accountsFitTwice(offered, book.accounts, day)
    fitTwice.forEach((account) => problems.push(words.sameAccountTwice(session.bank, account.name)))
    for (const linked of offered) {
      const kept = accountsOfLinked(linked, book.accounts)
      const accounts = readByBank(kept, day)
      if (accounts.some((account) => fitTwice.has(account)) || (kept.length > 0 && accounts.length === 0)) continue
      const starts = accounts.map((account) => fetchFrom(account, book.transactions, day))
      const latest = addDays(day, -1)
      const from = starts.map((start) => start.from).reduce((earliest, date) => (date < earliest ? date : earliest), addDays(day, accounts.length === 0 ? -NEW_ACCOUNT_HISTORY_DAYS : 0))
      const askedFrom = from < latest ? from : latest
      let answer: readonly BankTransaction[]
      try {
        answer = await port.transactions(linked.uid, askedFrom, accounts.length === 0 || starts.some((start) => start.longest))
      } catch (failure) {
        if (isUnauthorized(failure)) throw failure
        const reason = reasonOf(failure)
        if (namesEndedSession(reason)) {
          endedAt(session)
          break
        }
        problems.push(words.bankFailed(bank, reason))
        continue
      }
      fetched = withLink(fetched, session)
      const listed = new Map<RecordId, readonly StatementRow[]>()
      accounts.forEach((account, place) => {
        const statement = bankSyncRows(answer, account)
        rows.push(...statement.rows)
        listed.set(account.id, statement.rows)
        covers.set(account.id, { from: askedFrom, to: latest })
        statement.exchangeRates.forEach((rate, row) => exchangeRates.set(row, rate))
        const { zero, unreadable } = statement.leftOut
        if (zero > 0) fileNotes.push({ kind: 'zero-left-out', count: zero, account: account.name })
        if (unreadable > 0) fileNotes.push({ kind: 'unreadable-left-out', count: unreadable, account: account.name })
        const missing = freshLinks.some((link) => sameLink(link, session)) ? null : olderRowsMissing(starts[place]!, statement.rows, day)
        if (missing !== null) olderRows.push({ link: { bank, usage: session.usage }, account, reached: missing.reached })
      })
      let balances: readonly BankBalance[] = []
      try {
        balances = await port.balances(linked.uid)
      } catch (failure) {
        if (isUnauthorized(failure)) throw failure
        const names =
          accounts.length === 0 ? [words.linkedAccount(bank, linked.currency === NO_SINGLE_CURRENCY ? '' : linked.currency, linkedAccountEnding(linked))] : accounts.map((account) => account.name)
        fileNotes.push({ kind: 'balance-not-read', accounts: names.join(', '), reason: reasonOf(failure) })
      }
      for (const account of accounts) {
        const balance = statedBalance(balances, account.currency)
        const pendingRows = (listed.get(account.id) ?? []).filter((row) => row.pending).map((row) => row.amount)
        if (balance !== null) stated.push({ account, ...balance, unlisted: unlistedPending(balances, account.currency, pendingRows) })
      }
      for (const currency of currenciesLeft(linked, kept, answer, balances)) {
        const code = currencyCodeOf(currency)
        if (linked.currency === NO_SINGLE_CURRENCY || currency === linked.currency) {
          if (code !== null) proposals.push(proposeAccount(linked, bank, code, answer, balances, newId(), day, [...book.accounts, ...proposals.map((proposal) => proposal.account)]))
          continue
        }
        const count = answer.filter((transaction) => transaction.currency === currency).length
        fileNotes.push({ kind: 'other-currency-left-out', count, currency })
      }
    }
  }
  // The drafts' rows go through the pairing keys with the kept rows, so an exchange into an account not kept yet keeps a key both legs share.
  const held = proposals.flatMap((proposal) => proposal.rows.rows)
  proposals.forEach((proposal) => proposal.rows.exchangeRates.forEach((rate, row) => exchangeRates.set(row, rate)))
  const moved = rowsWithMoves([...rows, ...held], exchangeRates, [...book.accounts, ...proposals.map((proposal) => proposal.account)])
  const movedOf = new Map(held.map((row, place) => [row, moved[rows.length + place]!]))
  return {
    statement: { label: BANK_SYNC_LABEL, rows: moved.slice(0, rows.length), fileNotes, covers },
    linked: linkedAll,
    proposals: proposals.map((proposal) => ({ ...proposal, rows: { ...proposal.rows, rows: proposal.rows.rows.map((row) => movedOf.get(row) ?? row) } })),
    problems,
    ended,
    fetched,
    stated,
    olderRows,
  }
}
