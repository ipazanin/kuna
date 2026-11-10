import type { UnitOfWork } from '../../../../../shared/storage/application/repository'
import { filledFields } from '../../../../../shared/storage/domain/recordFields'
import type { RecordFields } from '../../../../../shared/storage/domain/recordFields'
import { keyOfRecordId, newRecordId, recordIdOf } from '../../../../../shared/storage/domain/recordId'
import { refusalOr, storedFieldsOfValues } from '../../../../../shared/storage/domain/storedFields'
import { TRIP_COST_RECORDS, TRIP_LEG_RECORDS, TRIP_RECORDS } from '../domain/hrDooKinds'
import { TRIP_CODECS, TRIP_COST_WRITES, TRIP_LEG_WRITES, TRIP_WRITES } from '../domain/hrDooWrites'
import type { Trip, TripCost, TripLeg } from '../domain/trips/trip'
import { TRIP_FIELD } from '../domain/trips/tripReading'
import type { TripFile } from '../domain/trips/tripReading'

/** The travel order as its dialog types it, each field as text, blank for none. */
export interface TripOrderDraft {
  readonly number: string
  /** A day such as 2026-03-10. */
  readonly issued: string
  /** The employee's short name. */
  readonly traveller: string
  readonly role: string
  readonly destination: string
  /** A two-letter country code, blank for Croatia. */
  readonly country: string
  readonly task: string
  readonly departs: string
  readonly days: string
  readonly transport: string
  readonly car: string
  readonly plate: string
  /** An amount such as 0.50. */
  readonly kmRate: string
  readonly advance: string
  readonly settleBy: string
  readonly note: string
}

/** The settlement of a trip as its form types it, each field as text, blank for none. */
export interface TripSettlementDraft {
  /** A day and time such as 2026-03-12 07:30. */
  readonly left: string
  readonly returned: string
  readonly borderOut: string
  readonly borderIn: string
  readonly odometerStart: string
  readonly odometerEnd: string
  /** Meals paid per line of the per-diem table, such as 1, 0. */
  readonly meals: string
  readonly report: string
  readonly settledOn: string
}

/** A leg as its dialog types it. */
export interface TripLegDraft {
  readonly date: string
  readonly from: string
  readonly to: string
  readonly km: string
}

/** A cost as its dialog types it. */
export interface TripCostDraft {
  readonly date: string
  readonly kind: string
  readonly description: string
  /** In euros. */
  readonly amount: string
  readonly foreignAmount: string
  readonly currency: string
  readonly paidBy: string
}

type Made<R> = { readonly made: R } | { readonly refused: string }

function orderFields(draft: TripOrderDraft): RecordFields {
  return {
    number: draft.number,
    issued: draft.issued,
    traveller: draft.traveller,
    role: draft.role,
    destination: draft.destination,
    country: draft.country,
    task: draft.task,
    departs: draft.departs,
    days: draft.days,
    transport: draft.transport,
    car: draft.car,
    plate: draft.plate,
    km_rate: draft.kmRate,
    advance: draft.advance,
    settle_by: draft.settleBy,
    note: draft.note,
  }
}

function settlementFields(draft: TripSettlementDraft): RecordFields {
  return {
    left: draft.left,
    returned: draft.returned,
    border_out: draft.borderOut,
    border_in: draft.borderIn,
    odometer_start: draft.odometerStart,
    odometer_end: draft.odometerEnd,
    meals: draft.meals,
    report: draft.report,
    settled_on: draft.settledOn,
  }
}

function trimmed(fields: RecordFields): RecordFields {
  return filledFields(Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, typeof value === 'string' ? value.trim() : value])))
}

/** The order as the dialog types it over the trip it changes, which keeps its settlement, or a new trip with an id of its own. */
export function tripOfOrder(draft: TripOrderDraft, before: Trip | null): Made<Trip> {
  const kept = before === null ? {} : TRIP_CODECS.trip.fieldsOf(before)
  const id = before?.id ?? recordIdOf(TRIP_RECORDS, newRecordId())
  return refusalOr(() => TRIP_CODECS.trip.make(storedFieldsOfValues(trimmed({ ...kept, ...orderFields(draft) })), id))
}

/** The trip with its settlement as the form types it. */
export function tripOfSettlement(before: Trip, draft: TripSettlementDraft): Made<Trip> {
  return refusalOr(() => TRIP_CODECS.trip.make(storedFieldsOfValues(trimmed({ ...TRIP_CODECS.trip.fieldsOf(before), ...settlementFields(draft) })), before.id))
}

export function legOfDraft(trip: Trip, draft: TripLegDraft, before: TripLeg | null): Made<TripLeg> {
  const id = before?.id ?? recordIdOf(TRIP_LEG_RECORDS, newRecordId())
  return refusalOr(() => TRIP_CODECS.leg.make(storedFieldsOfValues(trimmed({ [TRIP_FIELD]: keyOfRecordId(TRIP_RECORDS, trip.id), ...draft })), id))
}

export function costOfDraft(trip: Trip, draft: TripCostDraft, before: TripCost | null): Made<TripCost> {
  const id = before?.id ?? recordIdOf(TRIP_COST_RECORDS, newRecordId())
  const fields = {
    [TRIP_FIELD]: keyOfRecordId(TRIP_RECORDS, trip.id),
    date: draft.date,
    kind: draft.kind,
    description: draft.description,
    amount: draft.amount,
    foreign_amount: draft.foreignAmount,
    currency: draft.currency,
    paid_by: draft.paidBy,
  }
  return refusalOr(() => TRIP_CODECS.cost.make(storedFieldsOfValues(trimmed(fields)), id))
}

/** Why a draft cannot be saved, which the caller showed before it saves. */
class DraftRefused extends Error {}

function madeOf<R>(made: Made<R>): R {
  if ('refused' in made) throw new DraftRefused(made.refused)
  return made.made
}

/** Adds a travel order, or changes the order of one and keeps its settlement. */
export function saveTripOrder(unit: UnitOfWork, draft: TripOrderDraft, before: Trip | null): Trip {
  const trip = madeOf(tripOfOrder(draft, before))
  if (before === null) unit.of(TRIP_WRITES).add(trip)
  else unit.of(TRIP_WRITES).change(before, trip)
  return trip
}

/** Fills in or changes the settlement of a trip. */
export function settleTrip(unit: UnitOfWork, before: Trip, draft: TripSettlementDraft): void {
  unit.of(TRIP_WRITES).change(before, madeOf(tripOfSettlement(before, draft)))
}

/** Deletes a travel order with its legs and costs in one write, so one Undo puts them all back. A deleted number stays a gap. */
export function removeTrip(unit: UnitOfWork, file: TripFile): void {
  file.legs.forEach((leg) => unit.of(TRIP_LEG_WRITES).remove(leg))
  file.costs.forEach((cost) => unit.of(TRIP_COST_WRITES).remove(cost))
  unit.of(TRIP_WRITES).remove(file.trip)
}

export function saveTripLeg(unit: UnitOfWork, trip: Trip, draft: TripLegDraft, before: TripLeg | null): void {
  const leg = madeOf(legOfDraft(trip, draft, before))
  if (before === null) unit.of(TRIP_LEG_WRITES).add(leg)
  else unit.of(TRIP_LEG_WRITES).change(before, leg)
}

export function removeTripLeg(unit: UnitOfWork, leg: TripLeg): void {
  unit.of(TRIP_LEG_WRITES).remove(leg)
}

export function saveTripCost(unit: UnitOfWork, trip: Trip, draft: TripCostDraft, before: TripCost | null): void {
  const cost = madeOf(costOfDraft(trip, draft, before))
  if (before === null) unit.of(TRIP_COST_WRITES).add(cost)
  else unit.of(TRIP_COST_WRITES).change(before, cost)
}

export function removeTripCost(unit: UnitOfWork, cost: TripCost): void {
  unit.of(TRIP_COST_WRITES).remove(cost)
}

/** The order of a trip as its dialog shows it to change. */
export function orderDraftOf(trip: Trip): TripOrderDraft {
  const fields = TRIP_CODECS.trip.fieldsOf(trip)
  const text = (name: string) => String(fields[name] ?? '')
  return {
    number: text('number'),
    issued: text('issued'),
    traveller: text('traveller'),
    role: text('role'),
    destination: text('destination'),
    country: trip.country,
    task: text('task'),
    departs: text('departs'),
    days: text('days'),
    transport: text('transport'),
    car: text('car'),
    plate: text('plate'),
    kmRate: text('km_rate'),
    advance: text('advance'),
    settleBy: text('settle_by'),
    note: text('note'),
  }
}

/** The settlement of a trip as its form shows it to change. */
export function settlementDraftOf(trip: Trip): TripSettlementDraft {
  const fields = TRIP_CODECS.trip.fieldsOf(trip)
  const text = (name: string) => String(fields[name] ?? '')
  return {
    left: text('left'),
    returned: text('returned'),
    borderOut: text('border_out'),
    borderIn: text('border_in'),
    odometerStart: text('odometer_start'),
    odometerEnd: text('odometer_end'),
    meals: text('meals'),
    report: text('report'),
    settledOn: text('settled_on'),
  }
}

export function legDraftOf(leg: TripLeg): TripLegDraft {
  const fields = TRIP_CODECS.leg.fieldsOf(leg)
  return { date: String(fields.date ?? ''), from: leg.from, to: leg.to, km: String(leg.km) }
}

export function costDraftOf(cost: TripCost): TripCostDraft {
  const fields = TRIP_CODECS.cost.fieldsOf(cost)
  const text = (name: string) => String(fields[name] ?? '')
  return {
    date: text('date'),
    kind: cost.kind,
    description: cost.description,
    amount: text('amount'),
    foreignAmount: text('foreign_amount'),
    currency: text('currency'),
    paidBy: cost.paidBy,
  }
}
