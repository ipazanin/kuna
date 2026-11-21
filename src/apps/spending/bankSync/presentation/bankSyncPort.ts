import { keyOf, sessionsOf } from '../application/bankSecrets'
import type { BankUsage } from '../application/bankSecrets'
import type { BankSyncPort } from '../application/bankSync'
import { appsScriptBankSync } from '../infrastructure/appsScriptBankSync'
import { enableBankingTokens } from '../infrastructure/enableBankingToken'
import type { BankTokens } from '../infrastructure/enableBankingToken'
import { words } from './words'
import { currentToken } from '../../../../shared/google/googleAuth'
import { bankSyncDeployment } from '../../../../shared/google/googleConfig'
import type { GoogleScope } from '../../../../shared/google/googleScopes'
import { words as googleWords } from '../../../../shared/google/words'
import { storedSecret } from '../../../../shared/secrets/infrastructure/browserSecrets'

export const BANK_SYNC_SCOPE: GoogleScope = 'script.external_request'

/** Whose banks Spending reads. */
export const BANK_USAGE: BankUsage = 'personal'

/** The secrets this browser keeps, read only, since asking the banks never changes a key or a session. */
const KEPT = { read: storedSecret }

/** Whether this build has a bank sync script to call: the deployment built in, or the fake build's twin. */
export function bankSyncBuiltIn(): boolean {
  return import.meta.env.VITE_FAKE_WORKBOOK === 'true' || bankSyncDeployment() !== null
}

/** Whether this browser holds the key of the application. The fake build's twin signs nothing, so it holds one unless `?banksync=no-key` says otherwise. */
export function bankKeyHere(applicationId: string): boolean {
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') return new URLSearchParams(window.location.search).get('banksync') !== 'no-key'
  return keyOf(KEPT, applicationId) !== null
}

/** The signer of the last key used on this page, so its key is imported once and its token reused for its hour. */
let signer: { readonly applicationId: string; readonly pem: string; readonly tokens: BankTokens } | null = null

function tokensOf(applicationId: string, pem: string): BankTokens {
  if (signer?.applicationId !== applicationId || signer.pem !== pem) signer = { applicationId, pem, tokens: enableBankingTokens(applicationId, pem) }
  return signer.tokens
}

/**
 * The script signed with the application's key as given, or the fake build's twin, which sends nothing to another origin.
 * Check uses it before the key is kept.
 */
export async function bankSyncPortWithKey(applicationId: string, pem: string, personHere = false): Promise<BankSyncPort> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeBankSyncHere } = await import('../infrastructure/fake/fakeBankSync')
    return fakeBankSyncHere()
  }
  const deployment = bankSyncDeployment()
  if (deployment === null) throw new Error(words.noScript)
  const tokens = tokensOf(applicationId, pem)
  return appsScriptBankSync(
    {
      deployment,
      googleToken: () => {
        const token = currentToken(BANK_SYNC_SCOPE)
        if (token === null) throw new Error(googleWords.notGranted[BANK_SYNC_SCOPE])
        return token
      },
      bankToken: () => tokens.token(),
      sessions: () => sessionsOf(KEPT, BANK_USAGE),
    },
    personHere ? navigator.userAgent : null,
  )
}

/** The script signed with the key this browser keeps for the application. Fails with one plain line when it keeps none. */
export async function bankSyncPort(applicationId: string, personHere = false): Promise<BankSyncPort> {
  if (!bankKeyHere(applicationId)) throw new Error(words.noKeyHere)
  return bankSyncPortWithKey(applicationId, keyOf(KEPT, applicationId) ?? '', personHere)
}
