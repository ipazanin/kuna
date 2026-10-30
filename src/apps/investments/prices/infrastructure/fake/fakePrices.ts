import { rateSeriesKey, seriesKey } from '../../domain/pricesFile'
import type { CloseRow, PriceFailure, PricesFile } from '../../domain/pricesFile'
import { addDays, civilDate, weekdaysBetween } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'

/** `sample` has the closes up to the day before, `late-prices` stops four weekdays back with every provider failing on the last run. */
export type FakePricesVariant = 'sample' | 'late-prices'

/** The made-up series of the fake prices file: two US shares and a Xetra ETF, by the keys their instruments name. */
export const FAKE_SERIES = {
  shareA: seriesKey('tiingo', 'ABC'),
  shareB: seriesKey('tiingo', 'DEF'),
  worldEtf: seriesKey('alphavantage', 'XYZ.DEX'),
} as const

const FIRST_DAY = civilDate(2023, 1, 2)
/** The made-up 10-for-1 split of share B, whose closes before it are ten times higher, as they closed. */
const SPLIT_DAY = civilDate(2024, 6, 10)

function isWeekday(day: CivilDate): boolean {
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

/** A made-up walk in whole steps of the last decimal place, which drifts by `drift` steps a day and wobbles. */
function walk(days: readonly CivilDate[], start: number, drift: number, places: number, scale: (day: CivilDate) => number = () => 1): CloseRow[] {
  const unit = 10 ** places
  return days.map((day, place): CloseRow => {
    const steps = (start + place * drift + ((place * 37) % 23) - 11) * scale(day)
    return [day, `${Math.floor(steps / unit)}.${String(steps % unit).padStart(places, '0')}`]
  })
}

/** A made-up prices file as the daily job would have written it on `today`, every figure invented. */
export function fakePricesFile(variant: FakePricesVariant, today: CivilDate): PricesFile {
  const last = variant === 'late-prices' ? lateDay(today) : addDays(today, -1)
  const days = weekdays(last)
  const failures: PriceFailure[] =
    variant === 'late-prices'
      ? [
          { series: FAKE_SERIES.shareA, day: today, reason: 'refused' },
          { series: FAKE_SERIES.shareB, day: today, reason: 'refused' },
          { series: FAKE_SERIES.worldEtf, day: today, reason: 'limit' },
          ...['USD', 'GBP', 'CHF'].map((currency): PriceFailure => ({ series: rateSeriesKey(currency), day: today, reason: 'no-answer' })),
        ]
      : []
  return {
    writtenAt: `${today}T05:41:00.000Z`,
    series: {
      [FAKE_SERIES.shareA]: { currency: 'USD', from: FIRST_DAY, closes: walk(days, 14_250, 3, 2) },
      [FAKE_SERIES.shareB]: { currency: 'USD', from: FIRST_DAY, closes: walk(days, 4_810, 1, 2, (day) => (day < SPLIT_DAY ? 10 : 1)) },
      [FAKE_SERIES.worldEtf]: { currency: 'EUR', from: FIRST_DAY, closes: walk(days, 9_875, 2, 2) },
      [rateSeriesKey('USD')]: { currency: 'USD', from: FIRST_DAY, closes: walk(days, 10_850, 0, 4) },
      [rateSeriesKey('GBP')]: { currency: 'GBP', from: FIRST_DAY, closes: walk(days, 8_520, 0, 4) },
      [rateSeriesKey('CHF')]: { currency: 'CHF', from: FIRST_DAY, closes: walk(days, 9_410, 0, 4) },
    },
    splits: [{ series: FAKE_SERIES.shareB, date: SPLIT_DAY, newUnits: '10', oldUnits: '1' }],
    failures,
  }
}
