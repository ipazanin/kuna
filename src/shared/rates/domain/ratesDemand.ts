import { addDays, parseCivilDate, weekdaysBetween } from '../../calendar/civilDate'
import type { CivilDate } from '../../calendar/civilDate'
import { EURO } from '../../money/currencyCode'
import type { CurrencyCode } from '../../money/currencyCode'
import type { DatedRate } from '../../money/rateBook'
import type { RatesFile } from './ratesFile'

/** Each currency an app needs rates of, with the first day it needs them on. */
export type RatesDemand = ReadonlyMap<CurrencyCode, CivilDate>

/** A history is asked from a week before the first day needed, so a first day on a weekend or a holiday still has the rate of the day before. */
const LEAD_DAYS = 7

/** What every app needs, each currency from the earliest day any app needs it. The euro needs no rate. */
export function mergedDemand(demands: readonly (RatesDemand | null)[]): RatesDemand {
  const merged = new Map<CurrencyCode, CivilDate>()
  for (const [currency, day] of demands.flatMap((demand) => [...(demand ?? [])])) {
    const known = merged.get(currency)
    if (currency !== EURO && (known === undefined || day < known)) merged.set(currency, day)
  }
  return merged
}

/** One ECB series to ask for: the day to ask from, and the day the series then holds rates from. */
export interface EcbAsk {
  readonly currency: CurrencyCode
  readonly askFrom: CivilDate
  readonly seriesFrom: CivilDate
}

/** The weekday before the day, the latest whose rate a fetch on the day is sure to find. */
function weekdayBefore(day: CivilDate): CivilDate {
  let candidate = addDays(day, -1)
  while (weekdaysBetween(candidate, candidate) === 0) candidate = addDays(candidate, -1)
  return candidate
}

/** Whether the file holds the ECB's rates of each currency from the day it is needed on, however old the newest. */
export function holdsRatesFor(file: RatesFile, demand: RatesDemand): boolean {
  return [...demand].every(([currency, from]) => (file.ecb[currency]?.from ?? '9999-12-31') <= from)
}

/**
 * The ECB series a fetch on the day asks for: a history for a currency the file lacks from early enough, and the newest
 * rates for one whose last rate is older than the weekday before, unless a fetch since that weekday found nothing newer.
 */
export function ecbRatesDue(file: RatesFile, demand: RatesDemand, today: CivilDate): EcbAsk[] {
  const due = weekdayBefore(today)
  return [...demand].flatMap(([currency, needed]): EcbAsk[] => {
    const known = file.ecb[currency]
    if (known === undefined || known.from > needed) {
      return [{ currency, askFrom: addDays(needed, -LEAD_DAYS), seriesFrom: needed }]
    }
    const last = known.rows.at(-1)?.[0] ?? known.from
    return last >= due || known.checked > due ? [] : [{ currency, askFrom: parseCivilDate(last)!, seriesFrom: parseCivilDate(known.from)! }]
  })
}

/** The file with what the ECB answered for an ask on the day, a new rate replacing a stored one of the same day. */
export function withEcbAnswer(file: RatesFile, ask: EcbAsk, rows: readonly DatedRate[], today: CivilDate): RatesFile {
  const byDay = new Map((file.ecb[ask.currency]?.rows ?? []).map(([day, rate]) => [day, rate]))
  for (const [day, rate] of rows) byDay.set(day, rate)
  const merged = [...byDay.keys()].sort().map((day): DatedRate => [day, byDay.get(day)!])
  return { ...file, ecb: { ...file.ecb, [ask.currency]: { from: ask.seriesFrom, checked: today, rows: merged } } }
}
