import type { RatesFetch } from '../../../../../shared/rates/infrastructure/ecbRates'
import { fakeEcbFetch } from '../../../../../shared/rates/infrastructure/fake/fakeEcbRates'

/** The fake build's ECB as `?rates=` names it: `opening` never answers, `failed` gets no answer, and anything else answers made-up rates. */
export function fakeRatesFetch(variant: string | null): RatesFetch {
  if (variant === 'opening') return () => new Promise(() => {})
  if (variant === 'failed') return () => Promise.reject(new Error('The fake ECB is down.'))
  return fakeEcbFetch
}
