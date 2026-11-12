import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { EURO, currencyCodeOf } from '../../../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../../../shared/money/currencyCode'
import { decimalOfMoney } from '../../../../../../shared/money/decimal'
import type { Decimal } from '../../../../../../shared/money/decimal'
import { ZERO, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { moneyAt } from '../../../../../../shared/money/percent'
import { NO_RATES, eurosAtRate } from '../../../../../../shared/money/rateBook'
import type { RateBook } from '../../../../../../shared/money/rateBook'
import type { RuleCitation } from '../../ruleset/schema'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { HOME_COUNTRY, OTHER_COUNTRIES } from './trip'
import type { Trip } from './trip'
import { MINUTES_IN_HOUR, minutesAfter, minutesBetween } from './tripMoment'
import type { TripMoment } from './tripMoment'

/** How much of a per diem a part of a trip earns. */
export type PerDiemShare = 'full' | 'half' | 'none'

/** A full foreign per diem as the table states it in a currency other than the euro, with the rule that converts it. */
export interface StatedPerDiem {
  readonly amount: Decimal
  readonly currency: CurrencyCode
  readonly conversion: RuleCitation
}

/** The full per diem of the place a line is in, in euros, with how the table states it and the rule that gives it. */
export interface FullPerDiem {
  readonly amount: Money
  /** Null for a per diem the table states in euros. */
  readonly stated: StatedPerDiem | null
  readonly citation: RuleCitation
}

/** One line of the per-diem table: a 24-hour block of the trip, or the part after the last whole block. */
export interface PerDiemLine {
  readonly place: 'abroad' | 'home'
  /** ISO 3166-1 alpha-2, `HR` at home. */
  readonly country: string
  /** When the block starts. Null for the time at home of a trip abroad, which is counted as one span around the time abroad. */
  readonly from: TripMoment | null
  readonly minutes: number
  readonly share: PerDiemShare
  /** Meals the company or a host paid in the block, from 0 to 2. */
  readonly meals: number
  readonly full: FullPerDiem
  /** What the share earns before meals: the full per diem, the half one, or zero. */
  readonly earned: Money
  /** What the meals take off. */
  readonly mealCut: Money
  /** What the line pays, the earned per diem less the meals. */
  readonly amount: Money
  /** The rules the line rests on: the per diem's and the business trip's. */
  readonly citations: readonly RuleCitation[]
}

export interface PerDiems {
  readonly lines: readonly PerDiemLine[]
  readonly total: Money
}

/** The trip's spans abroad and at home, the time abroad first, as Art. 7(20) works out the foreign per diem first. */
interface Span {
  readonly place: 'abroad' | 'home'
  readonly from: TripMoment | null
  readonly minutes: number
}

/** When the time abroad starts: at the border, or by air the hours before take-off the law names, but never before the trip. */
export function abroadFrom(trip: Trip, left: TripMoment, takeOffLead: number): TripMoment | null {
  if (trip.abroad === null) return null
  const out = trip.transport === 'plane' ? minutesAfter(trip.abroad.out, -takeOffLead * MINUTES_IN_HOUR) : trip.abroad.out
  return minutesBetween(left, out) < 0 ? left : out
}

function spansOf(trip: Trip, left: TripMoment, returned: TripMoment, takeOffLead: number): Span[] {
  const total = minutesBetween(left, returned)
  const out = abroadFrom(trip, left, takeOffLead)
  if (trip.abroad === null || out === null) return [{ place: 'home', from: left, minutes: total }]
  const abroad = minutesBetween(out, trip.abroad.back)
  const home = total - abroad
  return [{ place: 'abroad', from: out, minutes: abroad }, ...(home > 0 ? [{ place: 'home' as const, from: null, minutes: home }] : [])]
}

/** A span cut into 24-hour blocks from its start, and the part after the last whole block. A part over 12 hours earns a full per diem, over 8 up to 12 a half, and 8 or fewer none. */
function blocksOf(span: Span, blockHours: number, fullOverHours: number, halfOverHours: number): { readonly from: TripMoment | null; readonly minutes: number; readonly share: PerDiemShare }[] {
  const block = blockHours * MINUTES_IN_HOUR
  const blocks: { from: TripMoment | null; minutes: number; share: PerDiemShare }[] = []
  let start = 0
  while (span.minutes - start > block) {
    blocks.push({ from: span.from === null ? null : minutesAfter(span.from, start), minutes: block, share: 'full' })
    start += block
  }
  const rest = span.minutes - start
  const share: PerDiemShare = rest > fullOverHours * MINUTES_IN_HOUR ? 'full' : rest > halfOverHours * MINUTES_IN_HOUR ? 'half' : 'none'
  blocks.push({ from: span.from === null ? null : minutesAfter(span.from, start), minutes: rest, share })
  return blocks
}

/** Where each line of the per-diem table of a trip with both times is and what share it earns, without the amounts, which need no rate. Null without both times. */
export function perDiemShares(trip: Trip, rules: RuleSource): { readonly place: 'abroad' | 'home'; readonly share: PerDiemShare }[] | null {
  if (trip.left === null || trip.returned === null || minutesBetween(trip.left, trip.returned) <= 0) return null
  const law = rules('hr.pit.business-trip', trip.left.day).value
  return spansOf(trip, trip.left, trip.returned, law.airportHoursBeforeTakeOff.count).flatMap((span) =>
    blocksOf(span, law.blockHours.count, law.fullDayOverHours.count, law.halfDayOverHours.count).map((block) => ({ place: span.place, share: block.share })),
  )
}

/** How many lines the per-diem table of a trip with both times has, which the meals list follows. Null without both times. */
export function perDiemLineCount(trip: Trip, rules: RuleSource): number | null {
  return perDiemShares(trip, rules)?.length ?? null
}

/** The full and the half per diem of a place. At home the law caps each, and abroad the half is the table's share of the full one. */
interface Rates {
  readonly full: FullPerDiem
  readonly half: Money
}

function homeRates(left: TripMoment, rules: RuleSource): Rates {
  const caps = rules('hr.pit.nontaxable-caps', left.day)
  const capOf = (payment: string): Money => caps.value.caps.rows.find((row) => row.payment.text === payment)?.cap?.cents ?? ZERO
  return { full: { amount: capOf('domestic-per-diem-over-12-hours'), stated: null, citation: caps.citation }, half: capOf('domestic-per-diem-8-to-12-hours') }
}

/** The row of the foreign per-diem table a country is paid by: its own, or the one for every country the table does not list. */
export function foreignPerDiemRow(country: string, day: CivilDate, rules: RuleSource) {
  const rows = rules('hr.pit.foreign-per-diem', day).value.perDiems.rows
  return rows.find((row) => row.country.text === country) ?? rows.find((row) => row.country.text === OTHER_COUNTRIES) ?? null
}

/** The currency the trip's foreign per diem is stated in, whose ECB rates the settlement needs. Null at home or in euros. */
export function perDiemCurrency(trip: Trip, rules: RuleSource): CurrencyCode | null {
  if (trip.country === HOME_COUNTRY) return null
  const row = foreignPerDiemRow(trip.country, trip.left?.day ?? trip.departs, rules)
  const currency = row === null ? null : currencyCodeOf(row.currency.text)
  return currency === EURO ? null : currency
}

/** The foreign per diems in euros. A row in dollars is converted at the ECB rate of the day `hr.pit.foreign-per-diem-rate` names. Null while that rate is missing. */
function abroadRates(trip: Trip, left: TripMoment, rules: RuleSource, rates: RateBook): Rates | null {
  const table = rules('hr.pit.foreign-per-diem', left.day)
  const row = foreignPerDiemRow(trip.country, left.day, rules)
  if (row === null) {
    throw new RangeError(`The ruleset has no foreign per diem for ${trip.country}.`)
  }
  const currency = currencyCodeOf(row.currency.text)
  const stated = decimalOfMoney(row.fullDay.cents)
  const euros = currency === null ? null : eurosAtRate(stated, currency, left.day, rates)
  if (euros === null || currency === null) return null
  const conversion = currency === EURO ? null : { amount: stated, currency, conversion: rules('hr.pit.foreign-per-diem-rate', left.day).citation }
  return { full: { amount: euros, stated: conversion, citation: table.citation }, half: moneyAt(euros, row.halfDayShare.basisPoints) }
}

/** Whether the foreign per diem of a trip abroad waits for an ECB rate of the day the traveller left. */
export function waitsForRate(trip: Trip, rules: RuleSource, rates: RateBook): boolean {
  return trip.country !== HOME_COUNTRY && trip.left !== null && abroadRates(trip, trip.left, rules, rates) === null
}

/**
 * The per diems of a trip with both times, a line per 24-hour block from departure and one for the
 * part after it, abroad first and then the time at home. A meal the company or a host paid cuts the
 * line's per diem by the share the law names for one meal or for two, rounded once on the line. Null
 * without both times, or while a per diem in dollars waits for the ECB rate of the day.
 */
export function perDiemsOf(trip: Trip, rules: RuleSource, rates: RateBook = NO_RATES): PerDiems | null {
  const { left, returned } = trip
  if (left === null || returned === null || minutesBetween(left, returned) <= 0) return null
  const law = rules('hr.pit.business-trip', left.day)
  const spans = spansOf(trip, left, returned, law.value.airportHoursBeforeTakeOff.count)
  const home = homeRates(left, rules)
  const abroad = trip.country === HOME_COUNTRY ? home : abroadRates(trip, left, rules, rates)
  if (abroad === null) return null
  let index = 0
  const lines = spans.flatMap((span) => {
    const perDiem = span.place === 'abroad' ? abroad : home
    return blocksOf(span, law.value.blockHours.count, law.value.fullDayOverHours.count, law.value.halfDayOverHours.count).map((block): PerDiemLine => {
      const meals = trip.meals[index] ?? 0
      index += 1
      const earned = block.share === 'full' ? perDiem.full.amount : block.share === 'half' ? perDiem.half : ZERO
      const cutRate = meals === 1 ? law.value.oneMealCut.basisPoints : law.value.twoMealsCut.basisPoints
      const mealCut = meals === 0 || block.share === 'none' ? ZERO : moneyAt(earned, cutRate)
      return {
        place: span.place,
        country: span.place === 'abroad' ? trip.country : HOME_COUNTRY,
        from: block.from,
        minutes: block.minutes,
        share: block.share,
        meals,
        full: perDiem.full,
        earned,
        mealCut,
        amount: subtractMoney(earned, mealCut),
        citations: [perDiem.full.citation, law.citation],
      }
    })
  })
  return { lines, total: sumMoney(lines.map((line) => line.amount)) }
}
