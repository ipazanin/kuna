import type { RouteLocationRaw } from 'vue-router'

import { addDays, parseCivilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import { absMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import type { RateBook } from '../../../../../../shared/money/rateBook'
import { amountForTyping, typedAmount } from '../../../../../../shared/money/typedAmount'
import { amountText } from '../../../../../../shared/storage/domain/recordFields'
import { countryName } from '../../../../../../shared/text/countryName'
import type { Employee } from '../../domain/employees/employees'
import { HOME_COUNTRY } from '../../domain/trips/trip'
import type { Trip } from '../../domain/trips/trip'
import { MINUTES_IN_HOUR, tripMomentOf } from '../../domain/trips/tripMoment'
import type { TripFile } from '../../domain/trips/tripReading'
import { tripSettlement } from '../../domain/trips/tripSettlement'
import type { TripSettlement } from '../../domain/trips/tripSettlement'
import { tripWarnings } from '../../domain/trips/tripWarnings'
import type { TripWarning } from '../../domain/trips/tripWarnings'
import { ruleValue } from '../../ruleset/ruleset'
import { employeeName } from '../salaries/salariesView'
import { tripLink } from './tripLinks'
import { words } from './words'

/** How a trip's settlement stands, in a word and a colour with an icon beside it. */
export interface TripStatus {
  readonly label: string
  readonly color: 'success' | 'info' | 'warning'
  readonly icon: string
}

/** One travel order in the list of its issue year. */
export interface TripRow {
  readonly key: string
  readonly number: string
  readonly traveller: string
  readonly destination: string
  readonly dates: string
  readonly status: TripStatus
  /** What the company pays out, or what the traveller returns, as a positive amount. Null while the settlement waits for something. */
  readonly payout: Money | null
  readonly paysBack: boolean
  readonly to: RouteLocationRaw
}

/** The settlement of a trip as Kuna works it out on the screen, a per diem in dollars at the page's ECB rates. */
export function settlementOf(file: TripFile, rates: RateBook): TripSettlement {
  return tripSettlement(file, ruleValue, rates)
}

export function travellerName(slug: string, employees: readonly Employee[]): string {
  const employee = employees.find((candidate) => candidate.slug === slug)
  return employee === undefined ? slug : employeeName(employee)
}

/** The destination with its country, when the trip goes abroad. */
export function destinationText(trip: Trip): string {
  return trip.country === HOME_COUNTRY ? trip.destination : `${trip.destination}, ${countryName(trip.country)}`
}

/** The days the trip took, or the days its order approves while the traveller has not left. */
export function tripDates(trip: Trip): string {
  const from = trip.left?.day ?? trip.departs
  const to: CivilDate = trip.returned?.day ?? addDays(trip.departs, trip.days - 1)
  return words.dates(dayLabel(from), dayLabel(to))
}

export function tripStatus(trip: Trip, settlement: TripSettlement): TripStatus {
  if (trip.settledOn !== null) return { label: words.status.settled, color: 'success', icon: 'i-lucide-circle-check' }
  if (settlement.kind === 'waiting') return { label: words.status.gaps[settlement.gaps[0] ?? 'times'], color: 'info', icon: 'i-lucide-clock' }
  return { label: words.status.open, color: 'warning', icon: 'i-lucide-circle-dashed' }
}

/** The issue years of the trips, newest first. */
export function tripYears(files: readonly TripFile[]): number[] {
  return [...new Set(files.map((file) => yearOf(file.trip.issued)))].sort((first, second) => second - first)
}

/** The travel orders issued in a year, in the order they were issued. */
export function tripRows(files: readonly TripFile[], year: number, employees: readonly Employee[], rates: RateBook): TripRow[] {
  return files
    .filter((file) => yearOf(file.trip.issued) === year)
    .sort((first, second) => first.trip.issued.localeCompare(second.trip.issued))
    .map((file) => {
      const settlement = settlementOf(file, rates)
      return {
        key: file.trip.id,
        number: file.trip.number,
        traveller: travellerName(file.trip.traveller, employees),
        destination: destinationText(file.trip),
        dates: tripDates(file.trip),
        status: tripStatus(file.trip, settlement),
        payout: settlement.kind === 'worked' ? absMoney(settlement.payout) : null,
        paysBack: settlement.kind === 'worked' && settlement.payout < 0,
        to: tripLink(file.trip.id),
      }
    })
}

/** What a warning says. */
export function warningText(warning: TripWarning): string {
  switch (warning.kind) {
    case 'km-rate-over-cap':
      return words.warnings.kmRateOverCap(formatMoney(warning.rate), formatMoney(warning.cap))
    case 'first-leg-short':
      return words.warnings.firstLegShort(warning.km, warning.shortest)
    case 'not-employed':
      return words.warnings.notEmployed
  }
}

/** The warnings of a trip, in words. */
export function tripWarningTexts(file: TripFile, employees: readonly Employee[]): string[] {
  const traveller = employees.find((employee) => employee.slug === file.trip.traveller) ?? null
  return tripWarnings(file, traveller, ruleValue).map(warningText)
}

/** A span of minutes in hours and minutes, such as "10 h 30 min". */
export function durationText(minutes: number): string {
  return words.perDiems.duration(Math.floor(minutes / MINUTES_IN_HOUR), minutes % MINUTES_IN_HOUR)
}

/** Why a day field cannot be saved, or null. An empty field that may stay empty is fine. */
export function dayProblem(typed: string, required: boolean): string | null {
  if (typed.trim() === '') return required ? words.dialog.notADay : null
  return parseCivilDate(typed.trim()) === null ? words.dialog.notADay : null
}

/** Why a day and time field cannot be saved, or null. It may stay empty. */
export function momentProblem(typed: string): string | null {
  return typed.trim() !== '' && tripMomentOf(typed) === null ? words.dialog.notAMoment : null
}

/** Why a field of a whole number from `least` cannot be saved, or null. An empty field that may stay empty is fine. */
export function wholeProblem(typed: string, least: number, required: boolean): string | null {
  if (typed.trim() === '') return required ? words.dialog.notAWhole(least) : null
  return /^\d+$/.test(typed.trim()) && Number(typed.trim()) >= least ? null : words.dialog.notAWhole(least)
}

/** Why an amount above zero cannot be saved, or null. An empty field that may stay empty is fine. */
export function amountProblem(typed: string, required: boolean): string | null {
  if (typed.trim() === '') return required ? words.dialog.notAnAmount : null
  const money = typedAmount(typed)
  return money === null || money <= 0 ? words.dialog.notAnAmount : null
}

/** Whether none of a dialog's fields has a problem, so a refusal left is a rule across fields. */
export function fieldsValid(problems: Readonly<Record<string, string | null>>): boolean {
  return Object.values(problems).every((problem) => problem === null)
}

/** An amount as a draft stores it, such as 0.50, from what a money field shows. Text that is no amount stays as typed, so the write refuses it with its reason. */
export function draftAmount(typed: string): string {
  const money = typedAmount(typed)
  return typed.trim() === '' || money === null ? typed.trim() : amountText(money)
}

/** An amount of a draft as a money field shows it in the language on screen. */
export function typingAmount(stored: string): string {
  const money = typedAmount(stored)
  return money === null ? stored : amountForTyping(money)
}

/** A draft's moment, such as `2026-03-12 07:30`, as a date and time field takes it, which the draft reads back. */
export function momentForInput(stored: string): string {
  return stored.replace(' ', 'T')
}
