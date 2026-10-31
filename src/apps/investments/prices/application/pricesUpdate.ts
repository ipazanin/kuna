import { shallowReactive, shallowReadonly } from 'vue'

import { fetchPrices, vendorsNeeded } from './priceFetch'
import type { PriceFetchPorts, PricesCopy, PricesDrive, PricesPlace } from './pricesPorts'
import type { PriceVendor, VendorFetch } from './priceVendor'
import { PRICES_FILE_NAME, decodePricesFile, emptyPricesFile, encodePricesFile } from '../domain/pricesFile'
import type { PricesFile, PricesFileRefusal } from '../domain/pricesFile'
import type { RatesWanted } from '../domain/priceDemand'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { civilDateIn } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'

/** The day a fetch belongs to is the day in Zagreb, wherever the device is. */
const PRICES_TIME_ZONE = 'Europe/Zagreb'

export function pricesDay(at: string): CivilDate {
  return civilDateIn(Date.parse(at), PRICES_TIME_ZONE)
}

/** The prices file beside the Investments file on Drive, made empty there when the folder has none. */
export async function pricesFileBeside(drive: PricesDrive, investmentsFileId: string): Promise<string> {
  const folderId = await drive.parentOf(investmentsFileId)
  const sortedFirst = async (): Promise<string | undefined> => [...(await drive.filesNamed(folderId, PRICES_FILE_NAME))].sort()[0]
  const found = await sortedFirst()
  if (found !== undefined) {
    return found
  }
  const made = await drive.createFile(folderId, PRICES_FILE_NAME, encodePricesFile(emptyPricesFile()))
  // Two devices that each made one at the same moment both list the folder again and take the same one.
  return (await sortedFirst()) ?? made.id
}

/** Whether this browser should fetch the day's prices now, or why not. */
export type PricesFetchVerdict = 'due' | 'running' | 'fetched-today' | 'no-key'

export interface PricesFetchMoment {
  /** When a fetch last wrote the prices file, or null for a file no fetch has written. */
  readonly writtenAt: string | null
  /** Today in Zagreb. */
  readonly today: CivilDate
  /** The vendors the records need closes or rates from. */
  readonly needed: readonly Pick<PriceVendor, 'id' | 'needsKey'>[]
  hasKey(vendorId: string): boolean
  /** The vendors the last fetch had no key for, in the browser that ran it. */
  readonly keyless: readonly string[]
  /** A fetch of this page is under way. */
  readonly running: boolean
}

/** The vendors a prices file notes as having had no key on its last fetch. */
export function keylessVendors(file: PricesFile): string[] {
  return [...new Set(file.failures.filter((failure) => failure.reason === 'no-key').map((failure) => failure.series.split(':')[0]!))]
}

/** Written today in Zagreb, by a fetch that had every key this browser holds. */
function writtenTodayHere(writtenAt: string | null, keyless: readonly string[], today: CivilDate, hasKey: (vendorId: string) => boolean): boolean {
  return writtenAt !== null && pricesDay(writtenAt) >= today && !keyless.some(hasKey)
}

/**
 * Once a day, when the prices file was written before today or by a browser without a key this one holds. The fetch
 * asks every vendor it can, the ECB with no key, and notes those it holds no key for. Only when every vendor the records
 * need wants a key this browser lacks is the fetch left to another browser.
 */
export function pricesFetchVerdict(moment: PricesFetchMoment): PricesFetchVerdict {
  if (moment.running) {
    return 'running'
  }
  if (writtenTodayHere(moment.writtenAt, moment.keyless, moment.today, (vendorId) => moment.hasKey(vendorId))) {
    return 'fetched-today'
  }
  const runnable = moment.needed.some((vendor) => !vendor.needsKey || moment.hasKey(vendor.id))
  return moment.needed.length > 0 && !runnable ? 'no-key' : 'due'
}

/** What the read of the prices file on Drive found: the same revision as the copy, a new one now in the copy, or a file Kuna cannot read. */
export type PricesRead = { readonly kind: 'unchanged' | 'read'; readonly copy: PricesCopy } | { readonly kind: 'refused'; readonly reason: PricesFileRefusal } | { readonly kind: 'not-on-drive' }

/** What a fetch ended in. `busy` is a fetch another tab of this browser was running, so this one did not start. */
export type PricesFetchRun =
  | { readonly kind: 'written'; readonly file: PricesFile }
  | { readonly kind: 'refused'; readonly reason: PricesFileRefusal }
  | { readonly kind: 'busy' }
  /** Another browser wrote the prices file today while this one waited its turn, so this one fetched nothing. */
  | { readonly kind: 'current' }
  | { readonly kind: 'failed'; readonly message: string }

/** The fetch under way: the series asked for so far, of a total that is null until the fetch has read the records. */
export interface PricesFetching {
  readonly asked: number
  readonly of: number | null
}

export interface PricesUpdateState {
  /** The Investments file whose prices `copy` holds, or null while none is open and while the copy of this browser is read. */
  readonly investmentsFileId: string | null
  readonly copy: PricesCopy | null
  readonly fetching: PricesFetching | null
  /** What this page's last fetch ended in, or null before one. A fetch that found the day's prices already written leaves it as it was. */
  readonly lastRun: PricesFetchRun | null
}

export interface PricesUpdatePorts {
  /** Where the prices of the Investments file on screen are kept, or null while none is open. */
  place(): Promise<PricesPlace | null>
  /** The Investments records on screen, or null while they are not read. */
  investments(): InvestmentBook | null
  readonly vendors: readonly PriceVendor[]
  readonly fetch: VendorFetch
  pause(milliseconds: number): Promise<void>
  key(vendorId: string): string | null
  /** Runs `run` while no other tab of this browser runs a fetch, or answers busy without running it. */
  exclusively<Result>(run: () => Promise<Result>): Promise<Result | 'busy'>
  /** ISO timestamp. */
  now(): string
  /** A new revision for a copy this browser alone keeps. */
  newRevision(): string
}

export interface PricesUpdate {
  readonly state: Readonly<PricesUpdateState>
  /** Shows the copy this browser keeps of the prices of the Investments file now on screen. */
  open(): Promise<void>
  /** Reads the prices file on Drive into the copy, downloading nothing when its head revision is the copy's. */
  read(): Promise<PricesRead>
  /** Fetches the day's prices when the verdict says so, and resolves to the verdict once any fetch is over. */
  fetchIfDue(): Promise<PricesFetchVerdict | 'no-books'>
  /** Fetches now, whatever the day, unless a fetch of this page is under way. */
  fetchNow(): Promise<PricesFetchRun | 'running' | 'no-books'>
  /** Fetches the ECB rates wanted beside those the records need, and no closes, once a fetch of this page under way is over. The day's fetch stays due. */
  fetchRates(wanted: RatesWanted): Promise<PricesFetchRun | 'no-books'>
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure)
}

/** The page's prices: its copy of the prices file, the read of the file on Drive, and the fetch, one at a time in the browser. */
export function createPricesUpdate(ports: PricesUpdatePorts): PricesUpdate {
  const state = shallowReactive<{ -readonly [Field in keyof PricesUpdateState]: PricesUpdateState[Field] }>({ investmentsFileId: null, copy: null, fetching: null, lastRun: null })
  let running = false
  let current: Promise<PricesFetchRun> | null = null

  /** Shows the copy while its Investments file is still the one on screen, which a read or a fetch may outlast. */
  async function show(place: PricesPlace, copy: PricesCopy): Promise<void> {
    if ((await ports.place())?.investmentsFileId === place.investmentsFileId) {
      state.investmentsFileId = place.investmentsFileId
      state.copy = copy
    }
  }

  /** The prices file the copy names, or the one beside the Investments file when the copy names none or Drive no longer answers for it. */
  async function driveFile(drive: PricesDrive, place: PricesPlace, held: PricesCopy | null): Promise<{ readonly fileId: string; readonly revision: string }> {
    if (held !== null && held.fileId !== null) {
      const revision = await drive.headRevision(held.fileId)
      if (revision !== null) {
        return { fileId: held.fileId, revision }
      }
    }
    const fileId = await pricesFileBeside(drive, place.investmentsFileId)
    // A file listed a moment ago and gone now has no revision, so the download that follows fails with Drive's own answer.
    return { fileId, revision: (await drive.headRevision(fileId)) ?? '' }
  }

  async function fetchInto(place: PricesPlace, book: InvestmentBook, onlyIfDue: boolean, ratesWanted: RatesWanted | null): Promise<PricesFetchRun> {
    const held = await place.cache.read()
    const { drive } = place
    const onDrive = drive === null ? null : await driveFile(drive, place, held)
    let revision = ''
    const currentText = async (): Promise<string> => {
      if (drive === null || onDrive === null || (held?.fileId === onDrive.fileId && held.revision === onDrive.revision)) {
        return encodePricesFile(held?.file ?? emptyPricesFile())
      }
      return drive.download(onDrive.fileId)
    }
    const text = await currentText()
    if (onlyIfDue) {
      // The verdict was worked out before this fetch had its turn, so another tab or device may have fetched since.
      const decoded = decodePricesFile(text)
      if (decoded.kind === 'read' && writtenTodayHere(decoded.file.writtenAt, keylessVendors(decoded.file), pricesDay(ports.now()), (vendorId) => ports.key(vendorId) !== null)) {
        return { kind: 'current' }
      }
    }
    const fetchPorts: PriceFetchPorts = {
      fetch: ports.fetch,
      pause: (milliseconds) => ports.pause(milliseconds),
      key: (vendorId) => ports.key(vendorId),
      investments: () => book,
      readPrices: async () => text,
      async writePrices(text) {
        revision = drive === null || onDrive === null ? ports.newRevision() : await drive.overwrite(onDrive.fileId, text)
      },
      progress(asked, of) {
        state.fetching = { asked, of }
      },
    }
    const at = ports.now()
    const outcome = await fetchPrices(fetchPorts, ports.vendors, { at, day: pricesDay(at) }, ratesWanted)
    if (outcome.kind === 'refused') {
      return outcome
    }
    const copy: PricesCopy = { fileId: onDrive?.fileId ?? null, revision, readAt: ports.now(), file: outcome.file }
    await place.cache.replace(copy)
    await show(place, copy)
    return { kind: 'written', file: outcome.file }
  }

  function runFetch(place: PricesPlace, book: InvestmentBook, onlyIfDue: boolean, ratesWanted: RatesWanted | null = null): Promise<PricesFetchRun> {
    current = fetchRun(place, book, onlyIfDue, ratesWanted)
    return current
  }

  async function fetchRun(place: PricesPlace, book: InvestmentBook, onlyIfDue: boolean, ratesWanted: RatesWanted | null): Promise<PricesFetchRun> {
    running = true
    state.fetching = { asked: 0, of: null }
    let run: PricesFetchRun
    try {
      const result = await ports.exclusively(() => fetchInto(place, book, onlyIfDue, ratesWanted))
      run = result === 'busy' ? { kind: 'busy' } : result
    } catch (failure) {
      run = { kind: 'failed', message: messageOf(failure) }
    } finally {
      running = false
      state.fetching = null
    }
    if (run.kind !== 'current') {
      state.lastRun = run
    }
    return run
  }

  async function opened(): Promise<{ readonly place: PricesPlace; readonly book: InvestmentBook } | null> {
    const place = await ports.place()
    const book = ports.investments()
    return place === null || book === null ? null : { place, book }
  }

  return {
    state: shallowReadonly(state),

    async open() {
      const place = await ports.place()
      state.investmentsFileId = null
      state.copy = null
      if (place !== null) {
        try {
          const copy = await place.cache.read()
          if (copy !== null) await show(place, copy)
        } finally {
          // The screens wait for this read, so one that failed still shows the file, with no prices but those entered by hand.
          if ((await ports.place())?.investmentsFileId === place.investmentsFileId) state.investmentsFileId = place.investmentsFileId
        }
      }
    },

    async read() {
      const place = await ports.place()
      if (place === null || place.drive === null) {
        return { kind: 'not-on-drive' }
      }
      const held = await place.cache.read()
      const { fileId, revision } = await driveFile(place.drive, place, held)
      if (held !== null && held.fileId === fileId && held.revision === revision) {
        await show(place, held)
        return { kind: 'unchanged', copy: held }
      }
      const decoded = decodePricesFile(await place.drive.download(fileId))
      if (decoded.kind === 'refused') {
        return decoded
      }
      const copy: PricesCopy = { fileId, revision, readAt: ports.now(), file: decoded.file }
      await place.cache.replace(copy)
      await show(place, copy)
      return { kind: 'read', copy }
    },

    async fetchIfDue() {
      const found = await opened()
      if (found === null) {
        return 'no-books'
      }
      const copy = await found.place.cache.read()
      const today = pricesDay(ports.now())
      const verdict = pricesFetchVerdict({
        writtenAt: copy?.file.writtenAt ?? null,
        today,
        needed: vendorsNeeded(ports.vendors, found.book, today),
        hasKey: (vendorId) => ports.key(vendorId) !== null,
        keyless: copy === null ? [] : keylessVendors(copy.file),
        running,
      })
      if (verdict === 'due') {
        await runFetch(found.place, found.book, true)
      }
      return verdict
    },

    async fetchNow() {
      if (running) {
        return 'running'
      }
      const found = await opened()
      if (found === null) {
        return 'no-books'
      }
      return running ? 'running' : runFetch(found.place, found.book, false)
    },

    async fetchRates(wanted) {
      for (;;) {
        if (running) {
          await current
          continue
        }
        const found = await opened()
        if (found === null) {
          return 'no-books'
        }
        if (!running) {
          return runFetch(found.place, found.book, false, wanted)
        }
      }
    },
  }
}
