import { RATES_FROM } from '../../domain/priceDemand'
import { ECB_SOURCE, rateSeriesKey, seriesKey } from '../../domain/pricesFile'
import type { CloseRow, FetchedFacts, PriceFailure, PricesFile } from '../../domain/pricesFile'
import { addDays, civilDate, weekdaysBetween } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'

/**
 * `sample` has the closes up to the day before, `late-prices` stops four weekdays back with every vendor failing on the
 * last fetch, and `no-benchmark` is the sample without the benchmark's series, which its vendor did not know.
 */
export type FakePricesVariant = 'sample' | 'late-prices' | 'no-benchmark'

/** The made-up series of the fake prices file: two US shares, a Xetra ETF and the US index fund the sample compares with, by the keys their instruments name. */
export const FAKE_SERIES = {
  shareA: seriesKey('twelvedata', 'ABC'),
  shareB: seriesKey('twelvedata', 'DEF'),
  worldEtf: seriesKey('alphavantage', 'XYZ.DEX'),
  benchmark: seriesKey('twelvedata', 'IDX'),
} as const

/** A fall in a straight line over the weekdays from `from` to `bottom`, by `steps`, and back up by `to`. */
interface Dip {
  readonly from: CivilDate
  readonly bottom: CivilDate
  readonly to: CivilDate
  readonly steps: number
}

/** How each made-up series walks: its currency, its first close in steps of its last decimal place, its drift a weekday in steps, how far it wobbles, its places and a dip. */
interface Walk {
  readonly currency: string
  readonly start: number
  readonly drift: number
  readonly swing: number
  readonly places: number
  readonly dip?: Dip
}

const WALKS: Readonly<Record<string, Walk>> = {
  [FAKE_SERIES.shareA]: { currency: 'USD', start: 14_250, drift: 3, swing: 1, places: 2 },
  [FAKE_SERIES.shareB]: { currency: 'USD', start: 4_810, drift: 1, swing: 1, places: 2 },
  [FAKE_SERIES.worldEtf]: {
    currency: 'EUR',
    start: 9_875,
    drift: 2,
    swing: 1,
    places: 2,
    dip: { from: civilDate(2024, 9, 2), bottom: civilDate(2024, 10, 31), to: civilDate(2024, 12, 31), steps: 1_300 },
  },
  [FAKE_SERIES.benchmark]: { currency: 'USD', start: 38_240, drift: 7, swing: 40, places: 2 },
  [rateSeriesKey('USD')]: { currency: 'USD', start: 10_850, drift: 0, swing: 1, places: 4 },
  [rateSeriesKey('GBP')]: { currency: 'GBP', start: 8_520, drift: 0, swing: 1, places: 4 },
  [rateSeriesKey('CHF')]: { currency: 'CHF', start: 9_410, drift: 0, swing: 1, places: 4 },
}

const FIRST_DAY = civilDate(2023, 1, 2)

export function isWeekday(day: CivilDate): boolean {
  return weekdaysBetween(day, day) === 1
}

/** The weekdays from the first day to the last, both included. */
function weekdays(last: CivilDate): CivilDate[] {
  const days: CivilDate[] = []
  for (let day = FIRST_DAY; day <= last; day = addDays(day, 1)) {
    if (isWeekday(day)) {
      days.push(day)
    }
  }
  return days
}

/** The weekday that is late by today: three weekdays lie between it and today. */
function lateDay(today: CivilDate): CivilDate {
  let day = addDays(today, -1)
  let between = 0
  while (between < 3 || !isWeekday(day)) {
    if (isWeekday(day)) {
      between += 1
    }
    day = addDays(day, -1)
  }
  return day
}

/** A weekday's place in the made-up series, the first day's being 0. */
function placeOf(day: CivilDate): number {
  return weekdaysBetween(FIRST_DAY, day) - 1
}

/** How many steps the dip takes off on a weekday. */
function dipOn(dip: Dip | undefined, place: number): number {
  if (dip === undefined) {
    return 0
  }
  const [from, bottom, to] = [placeOf(dip.from), placeOf(dip.bottom), placeOf(dip.to)]
  if (place <= from || place >= to) {
    return 0
  }
  return Math.round(dip.steps * (place <= bottom ? (place - from) / (bottom - from) : (to - place) / (to - bottom)))
}

/** A made-up close in whole steps of the last decimal place, which drifts by `drift` steps a weekday, wobbles and dips. */
function walkedClose(walk: Walk, place: number): string {
  const unit = 10 ** walk.places
  const steps = walk.start + place * walk.drift + walk.swing * (((place * 37) % 23) - 11) - dipOn(walk.dip, place)
  return `${Math.floor(steps / unit)}.${String(steps % unit).padStart(walk.places, '0')}`
}

/** A made-up series' close on a weekday, as the fake prices file holds it, so a made-up trade can pay what the day closed at. */
export function fakeClose(series: string, day: CivilDate): string {
  return walkedClose(WALKS[series]!, placeOf(day))
}

/**
 * What made-up vendors answered about the sample's holdings on `today`. A profile of the dividend payer agrees with
 * its ISIN. The spinco's profile gives its country but not its industry, so the spinco still has no sector. The money
 * fund has sector weights, the payer has an announced dividend a few days before the copy of its January payment, and
 * a search named what three of the listings are.
 */
function fakeFacts(today: CivilDate): FetchedFacts {
  return {
    profiles: {
      [seriesKey('finnhub', 'US000000DEF2')]: { asked: today, industry: 'Food Products', country: 'US' },
      [seriesKey('finnhub', 'GHI')]: { asked: today, industry: null, country: 'US' },
    },
    sectors: {
      [seriesKey('alphavantage', 'EMF')]: {
        asked: today,
        sectors: [
          ['FINANCIALS', '0.900'],
          ['INDUSTRIALS', '0.100'],
        ],
      },
    },
    dividends: { [seriesKey('alphavantage', 'DEF')]: { asked: today, dividends: [['2026-12-28', '2027-01-12', '0.3400']] } },
    types: {
      [FAKE_SERIES.shareA]: { asked: today, type: 'Common Stock' },
      [FAKE_SERIES.shareB]: { asked: today, type: 'Common Stock' },
      [FAKE_SERIES.worldEtf]: { asked: today, type: 'ETF' },
    },
  }
}

/** A made-up prices file as a fetch would have written it on `today`, every figure invented. */
export function fakePricesFile(variant: FakePricesVariant, today: CivilDate): PricesFile {
  const last = variant === 'late-prices' ? lateDay(today) : addDays(today, -1)
  const days = weekdays(last)
  const failures: PriceFailure[] =
    variant === 'late-prices'
      ? [
          { series: FAKE_SERIES.shareA, day: today, reason: 'refused' },
          { series: FAKE_SERIES.shareB, day: today, reason: 'refused' },
          { series: FAKE_SERIES.worldEtf, day: today, reason: 'limit' },
          { series: FAKE_SERIES.benchmark, day: today, reason: 'refused' },
          ...['USD', 'GBP', 'CHF'].map((currency): PriceFailure => ({ series: rateSeriesKey(currency), day: today, reason: 'no-answer' })),
        ]
      : variant === 'no-benchmark'
        ? [{ series: FAKE_SERIES.benchmark, day: today, reason: 'unknown-symbol' }]
        : []
  const kept = Object.keys(WALKS).filter((key) => variant !== 'no-benchmark' || key !== FAKE_SERIES.benchmark)
  return {
    writtenAt: `${today}T05:41:00.000Z`,
    lastFetch: { asked: kept.length, upToDate: 0, factsAsked: 0, factsLeft: 0, factsKeyless: [] },
    series: Object.fromEntries(
      kept.map((key) => {
        const walk = WALKS[key]!
        // A fetch asks the ECB from 2015 and keeps that start, though the made-up rates begin later.
        const from = key.startsWith(`${ECB_SOURCE}:`) ? RATES_FROM : FIRST_DAY
        // A series the last fetch failed for was last answered on the day of its last close.
        const checked = failures.some((failure) => failure.series === key) ? addDays(last, 1) : today
        return [key, { currency: walk.currency, from, checked, closes: days.map((day, place): CloseRow => [day, walkedClose(walk, place)]) }]
      }),
    ),
    splits: [],
    failures,
    facts: fakeFacts(today),
  }
}
