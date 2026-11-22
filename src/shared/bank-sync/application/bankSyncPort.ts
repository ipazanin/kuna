import type { BankApplication, BankBalance, BankFields, BankSession, BankTransaction } from '../domain/bankAnswer'
import type { LinkName, ListedBank } from '../domain/bankLink'
import type { CivilDate } from '../../calendar/civilDate'

/** A bank's new session, which this browser keeps as a secret, its bank and login as Enable Banking answered them, and until when it lasts. */
export interface BankLinkMade extends LinkName {
  readonly sessionId: string
  readonly validUntil: string
}

/** What an app asks of the bank sync script, each call signed in the page with the person's own key. */
export interface BankSyncPort {
  /** The application the key belongs to, which also proves the key signs. */
  application(): Promise<BankApplication>
  /** The banks Enable Banking lists for Croatia, with the logins each takes. */
  banks(): Promise<readonly ListedBank[]>
  /** Starts a bank's approval for a login and says where to send the tab. */
  startLink(link: LinkName, redirectUrl: string, state: string): Promise<string>
  /** Trades the code a bank came back with for a session. */
  finishLink(code: string): Promise<BankLinkMade>
  /** Ends a session at Enable Banking. One the bank already ended is no failure. */
  closeSession(sessionId: string): Promise<void>
  /** Each kept session with the accounts it reaches. */
  sessions(): Promise<readonly BankSession[]>
  /** Every page of an account's transactions from the day. `longest` asks for what the bank has from there, where a plain fetch asks for exactly that period and a bank may refuse it. */
  transactions(accountUid: string, from: CivilDate, longest: boolean): Promise<readonly BankTransaction[]>
  balances(accountUid: string): Promise<readonly BankBalance[]>
  /** The names and counts of what each kept session's bank sends, never a value. */
  bankFields(): Promise<readonly BankFields[]>
}

/** The key could not be read: not a PKCS#8 private key, as Enable Banking's Control Panel downloads it. */
export class UnreadableBankKey extends Error {
  override readonly name = 'UnreadableBankKey'
}

/** The script ran and threw, as opposed to the call never reaching it. */
export class BankScriptFailure extends Error {
  override readonly name = 'BankScriptFailure'
}
