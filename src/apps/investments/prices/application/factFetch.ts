import type { Asking, VendorPlan } from './priceFetch'
import type { Fetched, FoundListing } from './priceVendor'
import { fetchedFactsBook, profileQueryOf, typeKeyOf, vendorSymbolOf } from '../domain/factsBook'
import type { FactsBook } from '../domain/factsBook'
import { seriesKey } from '../domain/pricesFile'
import type { DividendsFact, FailureReason, FetchedFacts, ProfileFact, SectorsFact, TypeFact } from '../domain/pricesFile'
import { investmentLots } from '../../holdings/domain/lots'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { FundMixGroup } from '../../workbook/domain/mixGroup'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'

/** The facts a day's fetch asks for after the closes, and what it got. */
export interface FactWork {
  /** One per fact that may be wanted, each checking again when its turn comes, as an answer before it may have given it. */
  readonly asks: readonly Asking[]
  /** The stored facts with every answer kept so far. */
  facts(): FetchedFacts
  /** The requests sent, the facts left to a later day by a vendor's daily limit, and the vendors facts were wanted from without a key in this browser. */
  counts(): { readonly asked: number; readonly left: number; readonly keyless: readonly string[] }
}

/** Answers that say the vendor has nothing on it, kept as an empty fact so it is not asked again. Any other failure is asked again on the next day's fetch. */
const NOTHING_TO_LEARN: readonly FailureReason[] = ['unknown-symbol', 'not-on-free-key']

/** A holding pays when it paid in this many months, so its next dividends are worth asking for. */
const PAYER_MONTHS = 13

function failed<Answer>(answer: Fetched<Answer>): answer is { readonly kind: 'failed'; readonly reason: FailureReason } {
  return (answer as { readonly kind?: unknown }).kind === 'failed'
}

/** One fact to ask a vendor for, as `factWork` queues it. */
interface FactAsk<Answer> {
  readonly plan: VendorPlan
  readonly kind: keyof FetchedFacts
  readonly key: string
  wanted(): boolean
  mayBeWanted?(): boolean
  request(): Promise<Fetched<Answer>>
  kept(answer: Answer | null): void
}

type Mutable<Facts> = { -readonly [Kind in keyof Facts]: Record<string, Facts[Kind][keyof Facts[Kind]]> }

/** The listing a search of the instrument's own source symbol found: the same symbol, on its exchange where both name one. */
function listingOf(instrument: Instrument, listings: readonly FoundListing[]): FoundListing | null {
  const symbol = instrument.sourceSymbol.toUpperCase()
  const same = listings.filter((listing) => listing.symbol.toUpperCase() === symbol)
  return same.find((listing) => instrument.exchange !== null && listing.mic === instrument.exchange) ?? same[0] ?? null
}

/** Whether the Investments file says the instrument's sector or country: a typed fund mix of it, or the typed field. */
function typed(instrument: Instrument, book: InvestmentBook, mix: FundMixGroup['mix']): boolean {
  const field = mix === 'sector' ? instrument.sector : instrument.country
  return field !== null || book.fundMixes.some((line) => line.instrument === instrument.id && line.slice.mix === mix)
}

/**
 * The facts a day's fetch asks for, in this order:
 *
 * 1. What each untyped holding is, from a search of its own price vendor.
 * 2. A profile of each share whose sector or country is not typed. A fund's or an unknown instrument's profile may be its issuer's, so they get none.
 * 3. The sector weights of each fund or untyped holding whose sector is not typed and that no profile placed.
 * 4. The dividends of each holding that paid in the last 13 months, once a month.
 *
 * Only held instruments are asked about, each fact once, and an empty answer is kept. A fact wanted from a vendor this
 * browser has no key for is not asked, and the vendor is noted, so a browser that holds the key fetches again that day.
 */
export function factWork(plans: readonly VendorPlan[], stored: FetchedFacts, book: InvestmentBook, day: string): FactWork {
  const working: Mutable<FetchedFacts> = { profiles: { ...stored.profiles }, sectors: { ...stored.sectors }, dividends: { ...stored.dividends }, types: { ...stored.types } }
  const facts: FactsBook = fetchedFactsBook(working)
  const lots = investmentLots(book)
  const held = book.instruments.filter((instrument) => (lots.get(instrument.id)?.open ?? []).some((lot) => lot.quantity > DECIMAL_ZERO))
  const counted = { asked: 0, left: 0 }
  const keyless = new Set<string>()
  const asks: Asking[] = []
  const queued = new Set<string>()

  /**
   * Queues one request, once per kind and key, when `mayBeWanted` holds before the fetch's first answer, as `wanted`
   * does unless an earlier answer may decide it. It runs only while `wanted` holds and keeps what `kept` reads of the answer.
   */
  function queue<Answer>({ plan, kind, key, wanted, mayBeWanted = wanted, request, kept }: FactAsk<Answer>): void {
    if (queued.has(`${kind} ${key}`) || !mayBeWanted()) {
      return
    }
    queued.add(`${kind} ${key}`)
    if (plan.vendor.needsKey && plan.key === null) {
      keyless.add(plan.vendor.id)
      return
    }
    asks.push({
      plan,
      async ask() {
        if (!wanted()) {
          return
        }
        if (plan.pacing.stopped) {
          counted.left += 1
          return
        }
        counted.asked += 1
        const answer = await request()
        if (!failed(answer)) {
          kept(answer)
        } else if (NOTHING_TO_LEARN.includes(answer.reason)) {
          kept(null)
        } else if (answer.reason === 'limit') {
          counted.left += 1
        }
      },
    })
  }

  for (const instrument of held) {
    const key = typeKeyOf(instrument)
    const plan = plans.find((candidate) => candidate.vendor.id === instrument.prices)
    const search = plan?.vendor.search
    if (key === null || plan === undefined || search === undefined) {
      continue
    }
    queue({
      plan,
      kind: 'types',
      key,
      wanted: () => instrument.type === null && working.types[key] === undefined,
      request: () => search(plan.fetch, plan.key, instrument.sourceSymbol),
      kept(answer) {
        working.types[key] = { asked: day, type: answer === null ? null : (listingOf(instrument, answer.listings)?.type ?? null) } satisfies TypeFact
      },
    })
  }

  for (const plan of plans) {
    const profile = plan.vendor.profile
    if (profile === undefined) continue
    for (const instrument of held) {
      const key = seriesKey(plan.vendor.id, profileQueryOf(instrument))
      const untold = (): boolean => working.profiles[key] === undefined && (!typed(instrument, book, 'sector') || !typed(instrument, book, 'country'))
      queue({
        plan,
        kind: 'profiles',
        key,
        wanted: () => untold() && facts.typeOf(instrument) === 'share',
        // The search queued before it may yet make an untyped holding a share.
        mayBeWanted: () => untold() && [null, 'share'].includes(facts.typeOf(instrument)),
        request: () => profile(plan.fetch, plan.key, { isin: instrument.isin, symbol: instrument.symbol }),
        kept(answer) {
          working.profiles[key] = { asked: day, industry: answer?.industry ?? null, country: answer?.country ?? null } satisfies ProfileFact
        },
      })
    }
  }

  for (const plan of plans) {
    const fundSectors = plan.vendor.fundSectors
    if (fundSectors === undefined) continue
    for (const instrument of held) {
      const symbol = vendorSymbolOf(instrument, plan.vendor.id)
      const key = seriesKey(plan.vendor.id, symbol)
      queue({
        plan,
        kind: 'sectors',
        key,
        wanted: () =>
          working.sectors[key] === undefined && [null, 'fund'].includes(facts.typeOf(instrument)) && !typed(instrument, book, 'sector') && (facts.profileOf(instrument)?.sector ?? null) === null,
        request: () => fundSectors(plan.fetch, plan.key, symbol),
        kept(answer) {
          working.sectors[key] = { asked: day, sectors: answer?.sectors ?? [] } satisfies SectorsFact
        },
      })
    }
  }

  const paidSince = dayMonthsLater(parseCivilDate(day)!, -PAYER_MONTHS)
  const payers = held.filter((instrument) => book.income.some((payment) => payment.instrument === instrument.id && payment.date > paidSince))
  for (const plan of plans) {
    const dividends = plan.vendor.dividends
    if (dividends === undefined) continue
    for (const instrument of payers) {
      const symbol = vendorSymbolOf(instrument, plan.vendor.id)
      const key = seriesKey(plan.vendor.id, symbol)
      queue({
        plan,
        kind: 'dividends',
        key,
        wanted: () => (working.dividends[key]?.asked.slice(0, 7) ?? '') < day.slice(0, 7),
        request: () => dividends(plan.fetch, plan.key, symbol),
        kept(answer) {
          working.dividends[key] = { asked: day, dividends: (answer?.dividends ?? []).filter(([, paymentDay]) => paymentDay >= day) } satisfies DividendsFact
        },
      })
    }
  }

  return { asks, facts: () => working, counts: () => ({ ...counted, keyless: [...keyless].sort() }) }
}
