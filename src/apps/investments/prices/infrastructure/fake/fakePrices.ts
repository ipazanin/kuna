import { rateSeriesKey, seriesKey } from '../../domain/pricesFile'
import type { CloseRow, PriceFailure, PricesFile } from '../../domain/pricesFile'
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

/** How each made-up series walks: its currency, its first close in steps of its last decimal place, its drift a weekday in steps, how far it wobbles and its places. */
interface Walk {
  readonly currency: string
  readonly start: number
  readonly drift: number
  readonly swing: number
  readonly places: number
}

const WALKS: Readonly<Record<string, Walk>> = {
  [FAKE_SERIES.shareA]: { currency: 'USD', start: 14_250, drift: 3, swing: 1, places: 2 },
  [FAKE_SERIES.shareB]: { currency: 'USD', start: 4_810, drift: 1, swing: 1, places: 2 },
  [FAKE_SERIES.worldEtf]: { currency: 'EUR', start: 9_875, drift: 2, swing: 1, places: 2 },
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

/** A made-up close in whole steps of the last decimal place, which drifts by `drift` steps a weekday and wobbles. */
function walkedClose(walk: Walk, place: number): string {
  const unit = 10 ** walk.places
  const steps = walk.start + place * walk.drift + walk.swing * (((place * 37) % 23) - 11)
  return `${Math.floor(steps / unit)}.${String(steps % unit).padStart(walk.places, '0')}`
}

/** A made-up series' close on a weekday, as the fake prices file holds it, so a made-up trade can pay what the day closed at. */
export function fakeClose(series: string, day: CivilDate): string {
  return walkedClose(WALKS[series]!, weekdaysBetween(FIRST_DAY, day) - 1)
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
    series: Object.fromEntries(
      kept.map((key) => {
        const walk = WALKS[key]!
        return [key, { currency: walk.currency, from: FIRST_DAY, closes: days.map((day, place): CloseRow => [day, walkedClose(walk, place)]) }]
      }),
    ),
    splits: [],
    failures,
  }
}
