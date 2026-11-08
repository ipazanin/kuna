import { BankScriptFailure } from '../application/bankSync'
import type { BankSyncPort } from '../application/bankSync'
import type { BankBalance, BankSession, BankTransaction, LinkedAccount } from '../domain/bankAnswer'
import { words } from '../domain/words'
import { googleFetch, isUnauthorized } from '../../../../shared/google/googleApi'

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

/** The bank sync script, called with the page's Google token through the Apps Script API. `psuUserAgent` is the browser's on a fetch a person started, and goes with each call that reads a bank. */
export function appsScriptBankSync(deployment: string, tokenFor: () => string, psuUserAgent: string | null = null): BankSyncPort {
  const present = psuUserAgent === null ? [] : [psuUserAgent]

  async function run<Answer>(name: string, parameters: readonly unknown[]): Promise<Answer> {
    let answer: RunAnswer
    try {
      const response = await googleFetch(`${SCRIPT_API}/${encodeURIComponent(deployment)}:run`, tokenFor(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ function: name, parameters }),
      })
      answer = (await response.json()) as RunAnswer
    } catch (failure) {
      if (isUnauthorized(failure)) throw failure
      throw new Error(words.didNotAnswer(failure instanceof Error ? failure.message : String(failure)))
    }
    if (answer.error !== undefined) throw new BankScriptFailure(words.didNotAnswer(answer.error.details?.[0]?.errorMessage ?? answer.error.message ?? ''))
    return answer.response?.result as Answer
  }

  return {
    startLink: async (bankName, redirectUrl, state) => (await run<{ readonly url: string }>('startLink', [bankName, redirectUrl, state])).url,
    finishLink: async (code) => (await run<{ readonly validUntil: string }>('finishLink', [code])).validUntil,
    // Google's page does not say whether an empty list comes back as `[]` or as no result at all.
    sessions: async () => ((await run<readonly AnsweredSession[] | undefined>('accounts', present)) ?? []).map(sessionOf),
    transactions: async (accountUid, from, longest) => (await run<readonly BankTransaction[] | undefined>('transactions', [accountUid, from, longest ? 'longest' : 'default', ...present])) ?? [],
    balances: async (accountUid) => (await run<readonly BankBalance[] | undefined>('balances', [accountUid, ...present])) ?? [],
  }
}
