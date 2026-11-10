import { currencyCodeOf } from '../../../../../../shared/money/currencyCode'
import { decimalOfText, decimalText } from '../../../../../../shared/money/decimal'
import type { Money } from '../../../../../../shared/money/money'
import { withIdField } from '../../../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../../../shared/storage/domain/recordFields'
import { keyOfRecordId, recordIdOf } from '../../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { readEach } from '../../../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordsRead } from '../../../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../../../shared/storage/domain/sharedKeys'
import { optionalDate, optionalMoney, ownId, positiveMoney, refuse, requiredChoice, requiredDate, slugOf, textOf, wholeNumberOf } from '../../../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../../../shared/storage/domain/storedFields'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { ruleValue } from '../../ruleset/ruleset'
import { TRIP_COST_RECORDS, TRIP_LEG_RECORDS, TRIP_RECORDS } from '../hrDooKinds'
import { HOME_COUNTRY, TRANSPORTS, TRIP_COST_KINDS, TRIP_COST_PAYERS } from './trip'
import type { Abroad, ForeignAmount, Odometer, PrivateCar, Trip, TripCost, TripLeg } from './trip'
import { tripMomentOf, tripMomentText } from './tripMoment'
import type { TripMoment } from './tripMoment'
import { abroadProblem, carProblem, countryProblem, lengthProblem, mealsProblem, odometerProblem, orderOfTimesProblem, reportProblem, travellerProblem, tripOfChildProblem } from './tripRules'
import type { TripProblem } from './tripRules'

/** The field in which a leg or a cost names its trip, by the trip's bare id. */
export const TRIP_FIELD = 'trip'

/** The most meals a line of the per-diem table can cut it by. */
export const MOST_MEALS = 2

/** Why a stored trip, leg or cost cannot be read at all, as a fact the wording turns into the reason the storage keeps. */
export type TripFault =
  | { readonly kind: 'none'; readonly field: string }
  | { readonly kind: 'not-a-moment'; readonly field: string; readonly text: string }
  | { readonly kind: 'not-whole-from'; readonly field: string; readonly text: string; readonly least: number }
  | { readonly kind: 'km-rate-above-zero' }
  | { readonly kind: 'go-together'; readonly first: string; readonly second: string }
  | { readonly kind: 'odometer-backwards'; readonly start: number; readonly end: number }
  | { readonly kind: 'not-meals'; readonly entry: string; readonly most: number }
  | { readonly kind: 'not-foreign-amount'; readonly text: string }
  | { readonly kind: 'not-a-currency'; readonly text: string }

/**
 * How the trip kinds' faults, problems and nameless records are worded. The storage keeps a reason as text, so the reader takes the
 * wording from the pack, which holds the pack's reading words.
 */
export interface TripWording {
  fault(fault: TripFault): string
  problem(problem: TripProblem): string
  readonly unnumbered: string
  readonly leg: string
  readonly cost: string
}

function optionalMoment(fields: StoredFields, name: string, say: TripWording): TripMoment | null {
  const field = fields[name]
  if (field === undefined) return null
  return tripMomentOf(field.text) ?? refuse(say.fault({ kind: 'not-a-moment', field: name, text: field.text }))
}

function wholeAtLeast(fields: StoredFields, name: string, least: number, say: TripWording): number | null {
  const field = fields[name]
  if (field === undefined) return null
  const number = wholeNumberOf(field)
  return number !== null && number >= least ? number : refuse(say.fault({ kind: 'not-whole-from', field: name, text: field.text, least }))
}

function requiredWhole(fields: StoredFields, name: string, least: number, say: TripWording): number {
  return wholeAtLeast(fields, name, least, say) ?? refuse(say.fault({ kind: 'none', field: name }))
}

function carOf(fields: StoredFields, say: TripWording): PrivateCar | null {
  const make = textOf(fields.car)
  const plate = textOf(fields.plate)
  const kmRate = optionalMoney(fields, 'km_rate')
  if (make === '' && plate === '' && kmRate === null) return null
  if (kmRate === null || kmRate <= 0) refuse(say.fault({ kind: 'km-rate-above-zero' }))
  return { make, plate, kmRate }
}

function odometerOf(fields: StoredFields, say: TripWording): Odometer | null {
  const start = wholeAtLeast(fields, 'odometer_start', 0, say)
  const end = wholeAtLeast(fields, 'odometer_end', 0, say)
  if (start === null && end === null) return null
  if (start === null || end === null) refuse(say.fault({ kind: 'go-together', first: 'odometer_start', second: 'odometer_end' }))
  if (end < start) refuse(say.fault({ kind: 'odometer-backwards', start, end }))
  return { start, end }
}

function abroadOf(fields: StoredFields, say: TripWording): Abroad | null {
  const out = optionalMoment(fields, 'border_out', say)
  const back = optionalMoment(fields, 'border_in', say)
  if (out === null && back === null) return null
  if (out === null || back === null) refuse(say.fault({ kind: 'go-together', first: 'border_out', second: 'border_in' }))
  return { out, back }
}

function mealsOf(fields: StoredFields, say: TripWording): number[] {
  const text = textOf(fields.meals)
  if (text === '') return []
  return text.split(',').map((entry) => {
    const meals = Number(entry.trim())
    return Number.isInteger(meals) && meals >= 0 && meals <= MOST_MEALS ? meals : refuse(say.fault({ kind: 'not-meals', entry: entry.trim(), most: MOST_MEALS }))
  })
}

function positiveOrNull(fields: StoredFields, name: string): Money | null {
  return fields[name] === undefined ? null : positiveMoney(fields, name)
}

function tripOf(fields: StoredFields, id: RecordId | null, say: TripWording): Trip {
  const number = textOf(fields.number)
  if (number === '') refuse(say.fault({ kind: 'none', field: 'number' }))
  const traveller = slugOf(fields.traveller)
  if (traveller === '') refuse(say.fault({ kind: 'none', field: 'traveller' }))
  return {
    id: ownId(id),
    number,
    issued: requiredDate(fields, 'issued'),
    traveller,
    role: textOf(fields.role),
    destination: textOf(fields.destination),
    country: textOf(fields.country).toUpperCase() || HOME_COUNTRY,
    task: textOf(fields.task),
    departs: requiredDate(fields, 'departs'),
    days: requiredWhole(fields, 'days', 1, say),
    transport: requiredChoice(fields, 'transport', TRANSPORTS),
    car: carOf(fields, say),
    advance: positiveOrNull(fields, 'advance'),
    settleBy: optionalDate(fields, 'settle_by'),
    left: optionalMoment(fields, 'left', say),
    returned: optionalMoment(fields, 'returned', say),
    abroad: abroadOf(fields, say),
    odometer: odometerOf(fields, say),
    meals: mealsOf(fields, say),
    report: textOf(fields.report),
    settledOn: optionalDate(fields, 'settled_on'),
    note: textOf(fields.note),
  }
}

/** The trip a leg or a cost names, read as a trip, so an id of another kind names no trip the reader finds. */
function namedTrip(fields: StoredFields, say: TripWording): RecordId {
  const key = textOf(fields[TRIP_FIELD])
  return key === '' ? refuse(say.fault({ kind: 'none', field: TRIP_FIELD })) : recordIdOf(TRIP_RECORDS, key)
}

function tripLegOf(fields: StoredFields, id: RecordId | null, say: TripWording): TripLeg {
  return {
    id: ownId(id),
    trip: namedTrip(fields, say),
    date: requiredDate(fields, 'date'),
    from: textOf(fields.from),
    to: textOf(fields.to),
    km: requiredWhole(fields, 'km', 1, say),
  }
}

function foreignOf(fields: StoredFields, say: TripWording): ForeignAmount | null {
  const amountText = textOf(fields.foreign_amount)
  const currencyText = textOf(fields.currency)
  if (amountText === '' && currencyText === '') return null
  const amount = decimalOfText(amountText)
  if (amount === null || amount <= 0n) refuse(say.fault({ kind: 'not-foreign-amount', text: amountText }))
  const currency = currencyCodeOf(currencyText) ?? refuse(say.fault({ kind: 'not-a-currency', text: currencyText }))
  return { amount, currency }
}

function tripCostOf(fields: StoredFields, id: RecordId | null, say: TripWording): TripCost {
  return {
    id: ownId(id),
    trip: namedTrip(fields, say),
    date: requiredDate(fields, 'date'),
    kind: requiredChoice(fields, 'kind', TRIP_COST_KINDS),
    description: textOf(fields.description),
    amount: positiveMoney(fields, 'amount'),
    foreign: foreignOf(fields, say),
    paidBy: requiredChoice(fields, 'paid_by', TRIP_COST_PAYERS),
  }
}

/** How the three trip kinds are stored. */
export interface TripCodecs {
  readonly trip: RecordCodec<Trip>
  readonly leg: RecordCodec<TripLeg>
  readonly cost: RecordCodec<TripCost>
}

/** The codecs of the trip kinds, their refusals in the wording given. */
export function tripCodecs(say: TripWording): TripCodecs {
  return {
    trip: withIdField(
      TRIP_RECORDS,
      (fields) => textOf(fields.number) || say.unnumbered,
      (fields, id) => tripOf(fields, id, say),
      (trip) =>
        filledFields({
          number: trip.number,
          issued: trip.issued,
          traveller: trip.traveller,
          role: trip.role,
          destination: trip.destination,
          country: trip.country,
          task: trip.task,
          departs: trip.departs,
          days: String(trip.days),
          transport: trip.transport,
          car: trip.car?.make,
          plate: trip.car?.plate,
          km_rate: trip.car === null ? null : amountText(trip.car.kmRate),
          advance: trip.advance === null ? null : amountText(trip.advance),
          settle_by: trip.settleBy,
          left: trip.left === null ? null : tripMomentText(trip.left),
          returned: trip.returned === null ? null : tripMomentText(trip.returned),
          border_out: trip.abroad === null ? null : tripMomentText(trip.abroad.out),
          border_in: trip.abroad === null ? null : tripMomentText(trip.abroad.back),
          odometer_start: trip.odometer === null ? null : String(trip.odometer.start),
          odometer_end: trip.odometer === null ? null : String(trip.odometer.end),
          meals: trip.meals.join(', '),
          report: trip.report,
          settled_on: trip.settledOn,
          note: trip.note,
        }),
    ),
    leg: withIdField(
      TRIP_LEG_RECORDS,
      (fields) => [textOf(fields.from), textOf(fields.to)].filter((place) => place !== '').join(' – ') || say.leg,
      (fields, id) => tripLegOf(fields, id, say),
      (leg) => filledFields({ [TRIP_FIELD]: keyOfRecordId(TRIP_RECORDS, leg.trip), date: leg.date, from: leg.from, to: leg.to, km: String(leg.km) }),
    ),
    cost: withIdField(
      TRIP_COST_RECORDS,
      (fields) => textOf(fields.description) || textOf(fields.kind) || say.cost,
      (fields, id) => tripCostOf(fields, id, say),
      (cost) =>
        filledFields({
          [TRIP_FIELD]: keyOfRecordId(TRIP_RECORDS, cost.trip),
          date: cost.date,
          kind: cost.kind,
          description: cost.description,
          amount: amountText(cost.amount),
          foreign_amount: cost.foreign === null ? null : decimalText(cost.foreign.amount),
          currency: cost.foreign?.currency,
          paid_by: cost.paidBy,
        }),
    ),
  }
}

/** What the company file holds of the three trip kinds. */
export interface TripRecords {
  readonly trips: RecordsRead<Trip>
  readonly legs: RecordsRead<TripLeg>
  readonly costs: RecordsRead<TripCost>
}

/** A trip with its legs and costs, each in the order the file holds them. */
export interface TripFile {
  readonly trip: Trip
  readonly legs: readonly TripLeg[]
  readonly costs: readonly TripCost[]
}

/** Which records of each trip kind count, and the trips they make. */
export interface TripsReading {
  readonly files: readonly TripFile[]
  readonly trips: Reading<Trip>
  readonly legs: Reading<TripLeg>
  readonly costs: Reading<TripCost>
}

/**
 * The trips, checked against the employees and the law of their day, with the legs and costs that
 * name them. A number on more than one trip leaves out every trip with it. A leg or a cost counts
 * only beside a trip that counts, and the legs of a trip by private car must fit its odometer.
 */
export function readTrips(records: TripRecords, employees: ReadonlySet<string>, say: TripWording, rules: RuleSource = ruleValue): TripsReading {
  const worded = (problems: readonly (TripProblem | null)[]) => problems.flatMap((problem) => (problem === null ? [] : [say.problem(problem)]))
  const twice = sharedKeys(records.trips.records, (stored) => stored.record.number.trim().toLowerCase())
  const legsOf = (trip: RecordId) => records.legs.records.filter((stored) => stored.record.trip === trip).map((stored) => stored.record)
  const trips = readEach(records.trips, ({ record: trip }) => {
    if (twice.has(trip.number.trim().toLowerCase())) return worded([{ kind: 'number-twice', number: trip.number }])
    return worded([
      travellerProblem(trip, employees),
      countryProblem(trip, rules),
      orderOfTimesProblem(trip),
      abroadProblem(trip),
      lengthProblem(trip, rules),
      carProblem(trip),
      odometerProblem(trip, legsOf(trip.id)),
      mealsProblem(trip, rules),
      reportProblem(trip),
    ])
  })
  const kept = new Set(trips.facts.map((trip) => trip.id))
  const odometerOf = (id: RecordId) => {
    const trip = records.trips.records.find((stored) => stored.record.id === id)?.record
    return trip === undefined ? null : odometerProblem(trip, legsOf(id))
  }
  const legs = readEach(records.legs, ({ record }) => worded([odometerOf(record.trip) ?? tripOfChildProblem(record, kept)]))
  const costs = readEach(records.costs, ({ record }) => worded([tripOfChildProblem(record, kept)]))
  const files = trips.facts.map((trip) => ({ trip, legs: legs.facts.filter((leg) => leg.trip === trip.id), costs: costs.facts.filter((cost) => cost.trip === trip.id) }))
  return { files, trips, legs, costs }
}
