import type { RatesCache } from '../../application/ratesPorts'
import { updateRates } from '../../application/ratesUpdate'
import type { RatesDemand } from '../../domain/ratesDemand'
import type { RatesFile } from '../../domain/ratesFile'
import { everydayBook } from '../../domain/rateBooks'
import type { RatesState } from '../../domain/ratesState'
import { ecbAnswers } from '../ecbRates'
import { fakeRatesFetch } from './fakeEcbRates'
import type { CivilDate } from '../../../calendar/civilDate'

/** A copy of the rates file kept in memory, so the fake build and the checks start each page with none. */
export function memoryRatesCache(): RatesCache {
  let held: RatesFile | null = null
  return {
    read: () => Promise.resolve(held),
    replace(file) {
      held = file
      return Promise.resolve()
    },
  }
}

/** The rates a page holds for the demand on the day once the fake ECB answered, or once every request failed, as the checks work figures out. */
export async function fakeRatesState(demand: RatesDemand, day: CivilDate, failed = false): Promise<RatesState> {
  const ports = { cache: memoryRatesCache(), ecbRates: ecbAnswers(fakeRatesFetch(failed ? 'failed' : null)), today: () => day, now: () => `${day}T12:00:00.000Z` }
  const update = await updateRates(ports, demand, null)
  return { everyday: everydayBook(update.file), failed: update.failed.length > 0 }
}
