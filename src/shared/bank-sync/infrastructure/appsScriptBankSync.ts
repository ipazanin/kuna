import { BankScriptFailure } from '../application/bankSyncPort'
import type { BankLinkMade, BankSyncPort } from '../application/bankSyncPort'
import type { KeptSession } from '../application/bankSecrets'
import type { BankApplication, BankBalance, BankFields, BankSession, BankTransaction, LinkedAccount } from '../domain/bankAnswer'
import { BANK_USAGES } from '../domain/bankLink'
import type { BankUsage, ListedBank } from '../domain/bankLink'
import { words } from './words'
import { googleRequest, isUnauthorized } from '../../google/googleApi'

const SCRIPT_API = 'https://script.googleapis.com/v1/scripts'

/** The answer of `scripts.run`: a result, or the error the script threw, with its message in the first of `details`. */
interface RunAnswer {
  readonly response?: { readonly result?: unknown }
  readonly error?: { readonly message?: string; readonly details?: readonly { readonly errorMessage?: string }[] }
}

/** A linked account as a script answers it. One deployed before the script returned the bank's descriptions leaves them out. */
type AnsweredAccount = Pick<LinkedAccount, 'uid' | 'iban' | 'currency'> & Partial<LinkedAccount>

type AnsweredSession = Omit<BankSession, 'accounts' | 'usage'> & { readonly accounts?: readonly AnsweredAccount[] }

/** A bank as the script lists it. Only the two logins Kuna knows are kept. */
interface AnsweredBank {
  readonly name: string
  readonly usages: readonly string[]
  readonly beta: boolean
}

function listedOf(answered: AnsweredBank): ListedBank {
  return { name: answered.name, usages: BANK_USAGES.filter((usage) => answered.usages.includes(usage)), beta: answered.beta }
}

function sessionOf({ accounts, ...session }: AnsweredSession, usage: BankUsage): BankSession {
  return {
    ...session,
    usage,
    accounts: (accounts ?? []).map((account) => ({
      uid: account.uid,
      iban: account.iban,
      currency: account.currency,
      product: account.product ?? null,
      details: account.details ?? null,
      cashAccountType: account.cashAccountType ?? null,
      usage: account.usage ?? null,
      identificationHash: account.identificationHash ?? null,
    })),
  }
}

/** How long a run of the script waits. Apps Script stops a run after 6 minutes, so its own answer of that comes first. */
const RUN_WAIT_MS = 7 * 60_000

/** What the adapter is given: the script, the page's Google token, the person's signed Enable Banking token and the sessions kept here. */
export interface BankScriptAccess {
  readonly deployment: string
  googleToken(): string
  bankToken(): Promise<string>
  sessions(): readonly KeptSession[]
}

/**
 * The bank sync script, called with the page's Google token through the Apps Script API, each call with the person's signed
 * token first. `psuUserAgent` is the browser's on a fetch a person started, and goes with each call that reads a bank.
 */
export function appsScriptBankSync({ deployment, googleToken, bankToken, sessions }: BankScriptAccess, psuUserAgent: string | null = null): BankSyncPort {
  const present = psuUserAgent === null ? [] : [psuUserAgent]

  async function run<Answer>(name: string, parameters: readonly unknown[]): Promise<Answer> {
    const token = await bankToken()
    let answer: RunAnswer
    try {
      answer = await googleRequest(
        `${SCRIPT_API}/${encodeURIComponent(deployment)}:run`,
        googleToken(),
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ function: name, parameters: [token, ...parameters] }) },
        (response) => response.json() as Promise<RunAnswer>,
        RUN_WAIT_MS,
      )
    } catch (failure) {
      if (isUnauthorized(failure)) throw failure
      throw new Error(words.didNotAnswer(failure instanceof Error ? failure.message : String(failure)))
    }
    if (answer.error !== undefined) throw new BankScriptFailure(words.didNotAnswer(answer.error.details?.[0]?.errorMessage ?? answer.error.message ?? ''))
    return answer.response?.result as Answer
  }

  const asked = (session: KeptSession): { readonly bank: string; readonly sessionId: string } => ({ bank: session.bank, sessionId: session.sessionId })

  return {
    application: () => run<BankApplication>('application', []),
    banks: async () => ((await run<readonly AnsweredBank[] | undefined>('banks', [])) ?? []).map(listedOf),
    startLink: async (link, redirectUrl, state) => (await run<{ readonly url: string }>('startLink', [link.bank, redirectUrl, state, link.usage])).url,
    finishLink: async (code) => {
      const { sessionId, bank, usage, validUntil } = await run<Omit<BankLinkMade, 'usage'> & { readonly usage?: string }>('finishLink', [code])
      return { sessionId, bank, usage: usage === 'business' ? 'business' : 'personal', validUntil }
    },
    closeSession: async (sessionId) => {
      await run<null>('closeSession', [sessionId])
    },
    // Google's page does not say whether an empty list comes back as `[]` or as no result at all.
    sessions: async () => {
      const held = sessions()
      if (held.length === 0) return []
      // The script answers each session in the order it was given, so its login is the one asked at the same place.
      const answered = (await run<readonly AnsweredSession[] | undefined>('accounts', [held.map(asked), ...present])) ?? []
      return answered.map((session, place) => sessionOf(session, held[place]?.usage ?? 'personal'))
    },
    bankFields: async () => {
      const held = sessions()
      return held.length === 0 ? [] : ((await run<readonly BankFields[] | undefined>('bankFields', [held.map(asked)])) ?? [])
    },
    transactions: async (accountUid, from, longest) => (await run<readonly BankTransaction[] | undefined>('transactions', [accountUid, from, longest ? 'longest' : 'default', ...present])) ?? [],
    balances: async (accountUid) => (await run<readonly BankBalance[] | undefined>('balances', [accountUid, ...present])) ?? [],
  }
}
