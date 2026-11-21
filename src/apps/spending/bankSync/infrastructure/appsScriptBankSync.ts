import { BankScriptFailure } from '../application/bankSync'
import type { BankLinkMade, BankSyncPort } from '../application/bankSync'
import type { KeptSession } from '../application/bankSecrets'
import type { BankApplication, BankBalance, BankFields, BankSession, BankTransaction, LinkedAccount } from '../domain/bankAnswer'
import { ENABLE_BANKING_NAMES } from '../domain/bankAnswer'
import { words } from '../domain/words'
import { googleRequest, isUnauthorized } from '../../../../shared/google/googleApi'

const SCRIPT_API = 'https://script.googleapis.com/v1/scripts'

/** The answer of `scripts.run`: a result, or the error the script threw, with its message in the first of `details`. */
interface RunAnswer {
  readonly response?: { readonly result?: unknown }
  readonly error?: { readonly message?: string; readonly details?: readonly { readonly errorMessage?: string }[] }
}

/** A linked account as a script answers it. One deployed before the script returned the bank's descriptions leaves them out. */
type AnsweredAccount = Pick<LinkedAccount, 'uid' | 'iban' | 'currency'> & Partial<LinkedAccount>

type AnsweredSession = Omit<BankSession, 'accounts'> & { readonly accounts?: readonly AnsweredAccount[] }

function sessionOf({ accounts, ...session }: AnsweredSession): BankSession {
  return {
    ...session,
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

  const kept = (): readonly { readonly bank: string; readonly sessionId: string }[] => sessions().map(({ bank, sessionId }) => ({ bank: ENABLE_BANKING_NAMES[bank], sessionId }))

  return {
    application: () => run<BankApplication>('application', []),
    startLink: async (bankName, redirectUrl, state) => (await run<{ readonly url: string }>('startLink', [bankName, redirectUrl, state])).url,
    finishLink: async (code) => {
      const { sessionId, validUntil } = await run<BankLinkMade>('finishLink', [code])
      return { sessionId, validUntil }
    },
    closeSession: async (sessionId) => {
      await run<null>('closeSession', [sessionId])
    },
    // Google's page does not say whether an empty list comes back as `[]` or as no result at all.
    sessions: async () => {
      const asked = kept()
      return asked.length === 0 ? [] : ((await run<readonly AnsweredSession[] | undefined>('accounts', [asked, ...present])) ?? []).map(sessionOf)
    },
    bankFields: async () => {
      const asked = kept()
      return asked.length === 0 ? [] : ((await run<readonly BankFields[] | undefined>('bankFields', [asked])) ?? [])
    },
    transactions: async (accountUid, from, longest) => (await run<readonly BankTransaction[] | undefined>('transactions', [accountUid, from, longest ? 'longest' : 'default', ...present])) ?? [],
    balances: async (accountUid) => (await run<readonly BankBalance[] | undefined>('balances', [accountUid, ...present])) ?? [],
  }
}
