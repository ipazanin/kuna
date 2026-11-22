import type { LinkedOfBank } from '../domain/bankAccountSetup'
import { bankOfOldKey } from '../../../../shared/bank-sync/domain/bankLink'
import { deviceChoice } from '../../../../shared/device/deviceChoice'

/**
 * What this device's last fetch left wanting, which the step repeats while it holds back. When it ran is in the Spending
 * file, which every device shares. The linked accounts are kept apart from the lines, so the step can leave out one that
 * has been added since. Of each account the browser keeps only what names it, so the bank's product and the description
 * the person set stay out.
 */
export interface LastFetch {
  readonly problems: readonly string[]
  readonly linked: readonly LinkedOfBank[]
}

function linkedOf(candidate: unknown): LinkedOfBank | null {
  const { bank, account } = (candidate ?? {}) as Partial<LinkedOfBank>
  if (typeof bank !== 'string' || bank === '' || account === undefined || typeof account.uid !== 'string' || typeof account.iban !== 'string' || typeof account.currency !== 'string') return null
  const hash = typeof account.identificationHash === 'string' ? account.identificationHash : null
  return {
    bank: bankOfOldKey(bank) ?? bank,
    account: { uid: account.uid, iban: account.iban, currency: account.currency, product: null, details: null, cashAccountType: null, usage: null, identificationHash: hash },
  }
}

function lastFetchOf(parsed: unknown): LastFetch | null {
  const candidate = parsed as Partial<LastFetch> | null
  if (candidate === null || typeof candidate !== 'object') return null
  return {
    problems: Array.isArray(candidate.problems) ? candidate.problems.map(String) : [],
    linked: Array.isArray(candidate.linked) ? candidate.linked.flatMap((linked) => linkedOf(linked) ?? []) : [],
  }
}

const FETCHED = deviceChoice<LastFetch | null>('kuna.bank-sync-fetched', null, {
  read: (kept) => lastFetchOf(JSON.parse(kept)),
  write: (fetch) => {
    if (fetch === null) return null
    const named = fetch.linked.map(({ bank, account: { uid, iban, currency, identificationHash } }) => ({ bank, account: { uid, iban, currency, identificationHash } }))
    return JSON.stringify({ ...fetch, linked: named })
  },
})

export function loadLastFetch(): LastFetch | null {
  return FETCHED.read()
}

export function saveLastFetch(fetch: LastFetch | null): void {
  FETCHED.remember(fetch)
}
