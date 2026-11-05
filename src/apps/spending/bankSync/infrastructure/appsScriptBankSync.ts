import { BankScriptFailure } from '../application/bankSync'
import type { BankSyncPort } from '../application/bankSync'
import type { BankSession, BankTransaction } from '../domain/bankAnswer'
import { words } from '../domain/words'
import { googleFetch, isUnauthorized } from '../../../../shared/google/googleApi'

const SCRIPT_API = 'https://script.googleapis.com/v1/scripts'

/** The answer of `scripts.run`: a result, or the error the script threw, with its message in the first of `details`. */
interface RunAnswer {
  readonly response?: { readonly result?: unknown }
  readonly error?: { readonly message?: string; readonly details?: readonly { readonly errorMessage?: string }[] }
}

/** The bank sync script, called with the page's Google token through the Apps Script API. */
export function appsScriptBankSync(deployment: string, tokenFor: () => string): BankSyncPort {
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
    sessions: async () => (await run<readonly BankSession[] | undefined>('accounts', [])) ?? [],
    transactions: async (accountUid, from, longest) => (await run<readonly BankTransaction[] | undefined>('transactions', [accountUid, from, longest ? 'longest' : 'default'])) ?? [],
  }
}
