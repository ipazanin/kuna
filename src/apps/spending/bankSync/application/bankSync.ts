import type { BankBalance, BankSession, BankTransaction, LinkedAccount } from '../domain/bankAnswer'
import { namesEndedSession, sessionEnded } from '../domain/bankAnswer'
import { balanceNotes, statedBalance } from '../domain/bankBalance'
import type { StatedBalance } from '../domain/bankBalance'
import { accountsOfLinked, fetchFrom, linkableBankNamed } from '../domain/bankLinks'
import type { PendingLink } from '../domain/bankReturn'
import { BANK_SYNC_LABEL, bankSyncRows, rowsWithMoves } from '../domain/bankSyncRows'
import { words } from '../domain/words'
import { writeDryRun } from '../../statements/application/statementWrites'
import { rowsAfterDryRun, statementDryRun } from '../../statements/domain/statementDryRun'
import type { StatementDryRun } from '../../statements/domain/statementDryRun'
import type { StatementRow, StatementRows } from '../../statements/domain/statementRows'
import { SETTING_WRITES } from '../../workbook/application/settingWrites'
import { setSetting } from '../../../../shared/storage/application/settingWrites'
import type { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { BANK_SYNC_DEPLOYMENT_KEY, bankLinkKey } from '../../workbook/domain/spendingSettings'
import type { LinkableBank } from '../../workbook/domain/spendingSettings'
import { addDays } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Decimal } from '../../../../shared/money/decimal'
import { isUnauthorized } from '../../../../shared/google/googleApi'
import type { WriteReceipt } from '../../../../shared/storage/application/recordWrites'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { plural } from '../../../../shared/text/translation'

/** What Spending asks of the bank sync script, in the script's five functions. */
export interface BankSyncPort {
  /** Starts a bank's approval and says where to send the tab. */
  startLink(bankName: string, redirectUrl: string, state: string): Promise<string>
  /** Trades the code a bank came back with for a session the script holds, and says until when it lasts. */
  finishLink(code: string): Promise<string>
  sessions(): Promise<readonly BankSession[]>
  /** Every page of an account's transactions from the day. `longest` asks for what the bank has from there, where a plain fetch asks for exactly that period and a bank may refuse it. */
  transactions(accountUid: string, from: CivilDate, longest: boolean): Promise<readonly BankTransaction[]>
  balances(accountUid: string): Promise<readonly BankBalance[]>
}

/** The script ran and threw, as opposed to the call never reaching it. */
export class BankScriptFailure extends Error {
  override readonly name = 'BankScriptFailure'
}

export interface UnknownAccount {
  readonly bank: LinkableBank
  readonly account: LinkedAccount
}

/** What the banks answered: the rows of all that did, and for the rest why not. */
export interface BankRead {
  readonly statement: StatementRows
  /** The linked accounts Kuna keeps no account for. */
  readonly unknown: readonly UnknownAccount[]
  /** One line for each bank or account that gave no rows this time. */
  readonly problems: readonly string[]
  /** The banks whose approval is over, whatever day the file holds. */
  readonly ended: readonly LinkableBank[]
  /** What the banks say the accounts they answered for hold. */
  readonly stated: readonly StatedBalance[]
}

function reasonOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}

/** The Spending accounts more than one linked account of a session fits, as when a pocket comes under the current account's IBAN. Which one is which cannot be told, so neither is read. */
function accountsFitTwice(linkedAccounts: readonly LinkedAccount[], bank: LinkableBank, accounts: readonly Account[]): ReadonlySet<Account> {
  const fits = linkedAccounts.flatMap((linked) => accountsOfLinked(linked, bank, accounts))
  return new Set(fits.filter((account) => fits.indexOf(account) !== fits.lastIndexOf(account)))
}

/**
 * Asks the script for every session's accounts and each account's transactions, and reads them into one statement for the
 * dry run, with the legs of each exchange and pocket move among them keyed to pair. A bank or an account that fails is a
 * problem line and leaves the others' rows, so one bank's bad day never costs another's early history. Google turning the
 * token away ends it all, since no later call would go through.
 */
export async function readBanks(port: BankSyncPort, book: Pick<SpendingBook, 'accounts' | 'transactions'>, day: CivilDate): Promise<BankRead> {
  const rows: StatementRow[] = []
  const exchangeRates = new Map<StatementRow, Decimal>()
  const notes: string[] = []
  const unknown: UnknownAccount[] = []
  const problems: string[] = []
  const ended = new Set<LinkableBank>()
  const stated: StatedBalance[] = []
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
      problems.push(words.bankFailed(session.bank, session.reason ?? session.status))
      continue
    }
    const fitTwice = accountsFitTwice(session.accounts, bank, book.accounts)
    fitTwice.forEach((account) => problems.push(words.sameAccountTwice(session.bank, account.name)))
    for (const linked of session.accounts) {
      const accounts = accountsOfLinked(linked, bank, book.accounts)
      if (accounts.some((account) => fitTwice.has(account))) continue
      if (accounts.length === 0) {
        unknown.push({ bank, account: linked })
        continue
      }
      const starts = accounts.map((account) => fetchFrom(account, book.transactions, day))
      const from = starts.map((start) => start.from).reduce((earliest, date) => (date < earliest ? date : earliest))
      let answer: readonly BankTransaction[]
      try {
        answer = await port.transactions(
          linked.uid,
          from,
          starts.some((start) => start.longest),
        )
      } catch (failure) {
        if (isUnauthorized(failure)) throw failure
        const reason = reasonOf(failure)
        if (namesEndedSession(reason)) {
          endedAt(bank, session.bank)
          break
        }
        problems.push(words.bankFailed(session.bank, reason))
        continue
      }
      for (const account of accounts) {
        const statement = bankSyncRows(answer, account)
        rows.push(...statement.rows)
        statement.exchangeRates.forEach((rate, row) => exchangeRates.set(row, rate))
        notes.push(...statement.notes)
      }
      const kept = new Set<string>(accounts.map((account) => account.currency))
      for (const currency of new Set(answer.map((transaction) => transaction.currency).filter((currency) => !kept.has(currency)))) {
        const count = answer.filter((transaction) => transaction.currency === currency).length
        notes.push(plural(words.otherCurrencyLeftOut(count, currency), count))
      }
      let balances: readonly BankBalance[] = []
      try {
        balances = await port.balances(linked.uid)
      } catch (failure) {
        if (isUnauthorized(failure)) throw failure
        notes.push(words.balanceNotRead(accounts.map((account) => account.name).join(', '), reasonOf(failure)))
      }
      for (const account of accounts) {
        const balance = statedBalance(balances, account.currency)
        if (balance !== null) stated.push({ account, balance })
      }
    }
  }
  return { statement: { label: BANK_SYNC_LABEL, rows: rowsWithMoves(rows, exchangeRates, book.accounts), notes }, unknown, problems, ended: [...ended], stated }
}

/** The script's deployment saved, or cleared by a blank one, which turns the sync off. */
export function saveDeployment(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>, deployment: string): void {
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, BANK_SYNC_DEPLOYMENT_KEY, deployment.trim())
}

/** The day a bank's approval runs out. */
export function saveLink(unit: UnitOfWork, book: Pick<SpendingBook, 'readings'>, bank: LinkableBank, validUntil: string): void {
  setSetting(unit, SETTING_WRITES, book.readings.settings.facts, bankLinkKey(bank), validUntil.slice(0, 10))
}

type SpendingStore = Pick<ReturnType<typeof useSpendingBooks>, 'state' | 'write' | 'settled'>

/** What one fetch did. */
export interface BankSyncOutcome {
  readonly dryRun: StatementDryRun
  readonly unknown: readonly UnknownAccount[]
  readonly problems: readonly string[]
  /** The write it made, which Undo puts back, or null when nothing was new. */
  readonly receipt: WriteReceipt | null
}

export interface BankImportPorts {
  /** The script, told when a person started the fetch, which lifts the banks' limit on unattended reads. */
  script(deployment: string, personHere: boolean): Promise<BankSyncPort>
  readonly store: SpendingStore
  /** The banks answered, so the hold on the next automatic fetch starts from here. A call that never reached them holds nothing. */
  asked(read: BankRead): void
  day(): CivilDate
}

export interface BankImporter {
  /** Asks the banks and imports what is new in one write, so one Undo takes it all back. A second call while one runs gets the same fetch, since each uses up one of a bank's few fetches a day. */
  run(personHere: boolean): Promise<BankSyncOutcome>
}

function openBook(store: SpendingStore): NonNullable<SpendingStore['state']['workbook']> {
  const book = store.state.workbook
  if (book === null) throw new Error(words.noFile)
  return book
}

export function bankImporter(ports: BankImportPorts): BankImporter {
  const { store } = ports
  let running: Promise<BankSyncOutcome> | null = null

  async function fetchOnce(personHere: boolean): Promise<BankSyncOutcome> {
    const day = ports.day()
    const asking = openBook(store)
    const read = await readBanks(await ports.script(asking.settings.bankSyncDeployment, personHere), asking, day)
    ports.asked(read)
    await store.settled()
    const stillLive = read.ended.filter((bank) => (openBook(store).settings.bankLinks[bank] ?? '') >= day)
    if (stillLive.length > 0) {
      // Yesterday, so the home card and Settings say it ended and the step stops asking for it. The bank gives no day of its own.
      const book = openBook(store)
      await store.write(words.linkEndedTitle, (unit) => stillLive.forEach((bank) => saveLink(unit, book, bank, addDays(day, -1))))
      await store.settled()
    }
    // The file as it stands now, not as it stood before the banks answered, which can take minutes and a file dropped meanwhile.
    const book = openBook(store)
    const worked = statementDryRun(book, read.statement, day)
    const dryRun = { ...worked, notes: [...worked.notes, ...balanceNotes(read.stated, rowsAfterDryRun(book.transactions, worked), day)] }
    const changes = dryRun.added.length + dryRun.changed.length
    const receipt = changes === 0 ? null : await store.write(words.imported, (unit) => writeDryRun(unit, dryRun))
    return { dryRun, unknown: read.unknown, problems: read.problems, receipt }
  }

  return {
    run(personHere) {
      running ??= fetchOnce(personHere).finally(() => {
        running = null
      })
      return running
    },
  }
}

export interface PendingLinks {
  load(): PendingLink | null
  save(pending: PendingLink | null): void
}

export interface BankLinkPorts {
  readonly script: BankSyncPort
  readonly pending: PendingLinks
  readonly store: SpendingStore
}

/**
 * Trades the code a bank came back with and writes down the day the link ends. A code works once, so what it was traded for
 * is kept until the write lands and a retry only writes. A code the script refuses is forgotten, since it will never work.
 */
export async function finishBankLink({ script, pending, store }: BankLinkPorts): Promise<void> {
  const held = pending.load()
  if (held === null || held.code === null) return
  let validUntil = held.validUntil
  if (validUntil === null) {
    try {
      validUntil = await script.finishLink(held.code)
    } catch (failure) {
      if (failure instanceof BankScriptFailure) pending.save(null)
      throw failure
    }
    pending.save({ ...held, validUntil })
  }
  const book = openBook(store)
  const until = validUntil
  await store.write(words.linked, (unit) => saveLink(unit, book, held.bank, until))
  pending.save(null)
}
