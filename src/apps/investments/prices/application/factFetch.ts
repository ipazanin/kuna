import type { Asking, VendorPlan } from './priceFetch'
import type { Fetched, FoundListing } from './priceVendor'
import { fetchedFactsBook, profileQueryOf, typeKeyOf, vendorSymbolOf } from '../domain/factsBook'
import type { FactsBook } from '../domain/factsBook'
import { seriesKey } from '../domain/pricesFile'
import { FACT_FAILURES } from '../domain/pricesFile'
import type { DividendsFact, FactFailure, FailureReason, FetchedFacts, FundFact, ProfileFact, TypeFact } from '../domain/pricesFile'
import { investmentLots } from '../../holdings/domain/lots'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { addDays, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** The facts a day's fetch asks for after the closes, and what it got. */
export interface FactWork {
  /** One per fact that may be wanted, each checking again when its turn comes, as an answer before it may have given it. */
  readonly asks: readonly Asking[]
  /** The stored facts with every answer kept so far. */
  facts(): FetchedFacts
  /** The requests sent, the facts left to a later day by a vendor's daily limit, and the vendors facts were wanted from without a key in this browser. */
  counts(): { readonly asked: number; readonly left: number; readonly keyless: readonly string[] }
}

/** Answers that say the vendor has nothing on it, kept as an empty type or dividends fact so it is not asked again. Any other failure is asked again on the next day's fetch. */
const NOTHING_TO_LEARN: readonly FailureReason[] = ['unknown-symbol', 'not-on-free-key']

/** A profile or a fund profile is asked again once it is this many days old, since a TER, a fund's size and a market capitalisation drift. */
export const PROFILE_DAYS = 90

/**
 * How many days a kept profile or fund profile waits before it is asked again. An answer, an empty answer or a vendor
 * that does not know the symbol waits `PROFILE_DAYS`. A refused key, a limit, a premium refusal or a message is asked
 * again at the next day's fetch, so a fixed key clears its warnings by itself.
 */
export function daysBeforeAskedAgain(failed: FactFailure | 'empty' | null): number {
  return failed === null || failed === 'empty' || failed === 'unknown-symbol' ? PROFILE_DAYS : 1
}

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
  /** Keeps a failure the vendor answered, for a fact whose failures show on the holding's page. Without it, a failure is kept as `NOTHING_TO_LEARN` says. */
  keptFailure?(failure: FactFailure): void
}

type Mutable<Facts> = { -readonly [Kind in keyof Facts]: Record<string, Facts[Kind][keyof Facts[Kind]]> }

/** The listing a search of the instrument's own source symbol found: the same symbol, on its exchange where both name one. */
function listingOf(instrument: Instrument, listings: readonly FoundListing[]): FoundListing | null {
  const symbol = instrument.sourceSymbol.toUpperCase()
  const same = listings.filter((listing) => listing.symbol.toUpperCase() === symbol)
  return same.find((listing) => instrument.exchange !== null && listing.mic === instrument.exchange) ?? same[0] ?? null
}

/** Whether the Investments file says the instrument's sector: a typed fund mix by sector, or the typed field. */
function sectorTyped(instrument: Instrument, book: InvestmentBook): boolean {
  return instrument.sector !== null || book.fundMixes.some((line) => line.instrument === instrument.id && line.slice.mix === 'sector')
}

function isFactFailure(reason: FailureReason): reason is FactFailure {
  return FACT_FAILURES.some((failure) => failure === reason)
}

/**
 * The facts a day's fetch asks for, in this order:
 *
 * 1. What each untyped holding is, from a search of its own price vendor.
 * 2. A profile of each share. A fund's or an unknown instrument's profile may be its issuer's, so they get none.
 * 3. A fund profile of each fund, and of each untyped holding whose sector is not typed and that no profile placed.
 * 4. The dividends of each holding that paid in the last 13 months, once a month.
 *
 * Only held instruments are asked about. A type is asked once, and a profile or a fund profile again once it is
 * as old as `daysBeforeAskedAgain` says. An empty answer is kept, and so is a failure the vendor answered for a profile or a fund profile,
 * which the holding's page shows. A fact wanted from a vendor this browser has no key for is not asked, and the vendor
 * is noted, so a browser that holds the key fetches again that day.
 *
 * `again` asks for the facts of that one holding alone, its profile and fund profile whatever their day.
 */
export function factWork(plans: readonly VendorPlan[], stored: FetchedFacts, book: InvestmentBook, day: string, again: RecordId | null = null): FactWork {
  const working: Mutable<FetchedFacts> = { profiles: { ...stored.profiles }, funds: { ...stored.funds }, dividends: { ...stored.dividends }, types: { ...stored.types } }
  const facts: FactsBook = fetchedFactsBook(working)
  const lots = investmentLots(book)
  const held = book.instruments.filter((instrument) => (again === null || instrument.id === again) && (lots.get(instrument.id)?.open ?? []).some((lot) => lot.quantity > DECIMAL_ZERO))
  const today = parseCivilDate(day)!
  /** Whether a profile or a fund profile is still to ask for: none kept, one old enough for what it holds, or one the holding asks for again. */
  const due = (fact: { readonly asked: string; readonly failed: FactFailure | null } | undefined): boolean =>
    fact === undefined || fact.asked <= addDays(today, -daysBeforeAskedAgain(fact.failed)) || again !== null
  const counted = { asked: 0, left: 0 }
  const keyless = new Set<string>()
  const asks: Asking[] = []
  const queued = new Set<string>()

  /**
   * Queues one request, once per kind and key, when `mayBeWanted` holds before the fetch's first answer, as `wanted`
   * does unless an earlier answer may decide it. It runs only while `wanted` holds and keeps what `kept` reads of the answer.
   */
  function queue<Answer>({ plan, kind, key, wanted, mayBeWanted = wanted, request, kept, keptFailure }: FactAsk<Answer>): void {
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
        } else if (keptFailure !== undefined && isFactFailure(answer.reason)) {
          keptFailure(answer.reason)
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
      const profileOf = (answer: Partial<Omit<ProfileFact, 'asked'>>): ProfileFact => ({
        asked: day,
        industry: answer.industry ?? null,
        country: answer.country ?? null,
        exchange: answer.exchange ?? null,
        marketCap: answer.marketCap ?? null,
        currency: answer.currency ?? null,
        ipo: answer.ipo ?? null,
        failed: answer.failed ?? null,
      })
      queue({
        plan,
        kind: 'profiles',
        key,
        wanted: () => due(working.profiles[key]) && facts.typeOf(instrument) === 'share',
        // The search queued before it may yet make an untyped holding a share.
        mayBeWanted: () => due(working.profiles[key]) && [null, 'share'].includes(facts.typeOf(instrument)),
        request: () => profile(plan.fetch, plan.key, { isin: instrument.isin, symbol: instrument.symbol }),
        kept(answer) {
          working.profiles[key] = profileOf(answer ?? {})
        },
        keptFailure(failure) {
          working.profiles[key] = profileOf({ failed: failure })
        },
      })
    }
  }

  for (const plan of plans) {
    const fundProfile = plan.vendor.fundProfile
    if (fundProfile === undefined) continue
    for (const instrument of held) {
      const symbol = vendorSymbolOf(instrument, plan.vendor.id)
      const key = seriesKey(plan.vendor.id, symbol)
      const fundOf = (answer: Partial<Omit<FundFact, 'asked'>>): FundFact => ({
        asked: day,
        expenseRatio: answer.expenseRatio ?? null,
        netAssets: answer.netAssets ?? null,
        inception: answer.inception ?? null,
        leveraged: answer.leveraged ?? null,
        holdings: answer.holdings ?? null,
        dividendYield: answer.dividendYield ?? null,
        sectors: answer.sectors ?? [],
        failed: answer.failed ?? null,
      })
      const fundLike = (): boolean => {
        const type = facts.typeOf(instrument)
        return type === 'fund' || (type === null && !sectorTyped(instrument, book) && (facts.profileOf(instrument)?.sector ?? null) === null)
      }
      queue({
        plan,
        kind: 'funds',
        key,
        wanted: () => due(working.funds[key]) && fundLike(),
        request: () => fundProfile(plan.fetch, plan.key, symbol),
        kept(answer) {
          working.funds[key] = fundOf(answer ?? {})
        },
        keptFailure(failure) {
          working.funds[key] = fundOf({ failed: failure })
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
