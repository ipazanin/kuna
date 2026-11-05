import type { BankSyncPort } from '../application/bankSync'
import { appsScriptBankSync } from '../infrastructure/appsScriptBankSync'
import { currentToken } from '../../../../shared/google/googleAuth'
import type { GoogleScope } from '../../../../shared/google/googleScopes'
import { words as googleWords } from '../../../../shared/google/words'

export const BANK_SYNC_SCOPE: GoogleScope = 'script.external_request'

/** The script a saved deployment names, or the fake build's twin, which sends nothing to another origin. */
export async function bankSyncPort(deployment: string): Promise<BankSyncPort> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeBankSync } = await import('../infrastructure/fake/fakeBankSync')
    return fakeBankSync(new URLSearchParams(window.location.search).get('banksync'))
  }
  return appsScriptBankSync(deployment, () => {
    const token = currentToken(BANK_SYNC_SCOPE)
    if (token === null) throw new Error(googleWords.notGranted[BANK_SYNC_SCOPE])
    return token
  })
}
