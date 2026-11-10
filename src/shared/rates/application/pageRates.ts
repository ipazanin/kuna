import { shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import type { RatesCache, RatesDrive, RatesUpdatePorts } from './ratesPorts'
import { updateRates } from './ratesUpdate'
import type { RatesUpdate } from './ratesUpdate'
import { today } from '../../calendar/civilDate'
import { holdsRatesFor, mergedDemand } from '../domain/ratesDemand'
import type { RatesDemand } from '../domain/ratesDemand'
import { emptyRatesFile } from '../domain/ratesFile'
import type { RatesFile } from '../domain/ratesFile'
import { everydayBook } from '../domain/rateBooks'
import { everydayRates } from '../domain/ratesState'
import type { RatesState } from '../domain/ratesState'
import { browserRatesFetch } from '../infrastructure/browserRatesFetch'
import { ecbAnswers } from '../infrastructure/ecbRates'
import type { RatesFetch } from '../infrastructure/ecbRates'
import { googleRatesDrive } from '../infrastructure/googleRatesDrive'
import { browserRatesCache } from '../infrastructure/ratesCache'

/** The page's adapters: this browser's copy, the ECB, and the file on Drive. */
interface PageRatesPorts {
  readonly update: RatesUpdatePorts
  readonly drive: RatesDrive
}

function updatePorts(cache: RatesCache, fetch: RatesFetch): RatesUpdatePorts {
  return {
    cache,
    ecbRates: ecbAnswers(fetch),
    today,
    now: () => new Date().toISOString(),
  }
}

let held: Promise<PageRatesPorts> | null = null

/** The page's adapters, the fake ones in the fake build, made once. */
function pagePorts(): Promise<PageRatesPorts> {
  held ??= (async () => {
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const [{ fakeRatesFetch }, { fakeRatesDrive }, { memoryRatesCache }] = await Promise.all([
        import('../infrastructure/fake/fakeEcbRates'),
        import('../infrastructure/fake/fakeRatesDrive'),
        import('../infrastructure/fake/fakeRatesState'),
      ])
      return { update: updatePorts(memoryRatesCache(), fakeRatesFetch(new URLSearchParams(window.location.search).get('rates'))), drive: fakeRatesDrive() }
    }
    return { update: updatePorts(browserRatesCache(), browserRatesFetch), drive: googleRatesDrive() }
  })()
  return held
}

const state = shallowRef<RatesState>('loading')
let demandOf: () => RatesDemand = () => new Map()
let queue: Promise<unknown> = Promise.resolve()

function shown(file: RatesFile, failed: boolean): RatesState {
  return { everyday: everydayBook(file), failed }
}

function sameDemand(first: RatesDemand, second: RatesDemand): boolean {
  return JSON.stringify([...first]) === JSON.stringify([...second])
}

/**
 * Runs one update after any under way, so two never write at once, and shows what it left. An update for what the apps
 * needed before they needed more leaves the page waiting for the next one, unless the file already holds it all.
 */
function queued(demand: RatesDemand, run: (ports: PageRatesPorts) => Promise<RatesUpdate>): Promise<RatesUpdate> {
  const next = queue.then(async () => {
    const update = await run(await pagePorts())
    const current = demandOf()
    state.value = holdsRatesFor(update.file, current) || sameDemand(demand, current) ? shown(update.file, update.failed.length > 0) : 'loading'
    return update
  })
  queue = next.catch(() => undefined)
  return next
}

/** The page's rates, which every app's figures read. */
export function useRates(): Readonly<Ref<RatesState>> {
  return state
}

/**
 * Keeps the page's rates for what the apps need: this browser's copy at once when it holds every currency from early
 * enough, then what the ECB has newer. A currency with no rates yet waits, rather than reading as one whose rates
 * failed. Returns the function that stops watching.
 */
export function startRates(demands: () => readonly (RatesDemand | null)[]): () => void {
  demandOf = () => mergedDemand(demands())
  return watch(
    () => JSON.stringify([...demandOf()]),
    async () => {
      const demand = demandOf()
      const copy = (await (await pagePorts()).update.cache.read()) ?? emptyRatesFile()
      if (sameDemand(demand, demandOf())) state.value = holdsRatesFor(copy, demand) ? shown(copy, false) : 'loading'
      await queued(demand, (ports) => updateRates(ports.update, demand, null)).catch(() => {
        state.value = { everyday: everydayRates(state.value), failed: true }
      })
    },
    { immediate: true },
  )
}

/** Merges this browser's rates with the file on Drive and fetches what is due, as the page's sync does. A new file goes beside `besideFileId` while there is no Kuna folder. */
export function syncRates(besideFileId: string): Promise<RatesUpdate> {
  const demand = demandOf()
  return queued(demand, (ports) => updateRates(ports.update, demand, { drive: ports.drive, besideFileId }))
}
