import type { CompanyReading } from '../../../assistant/companyReader'
import { readableKind } from '../../../../../shared/app/assistantReader'
import type { ReadableKind } from '../../../../../shared/app/assistantReader'
import { ZERO } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { decimalText } from '../../../../../shared/money/decimal'
import type { FieldDocs } from '../../../../../shared/privacy/domain/exposure'
import { TRIP_COST_RECORDS, TRIP_LEG_RECORDS, TRIP_RECORDS } from '../domain/hrDooKinds'
import { hrDooWorkbook } from '../domain/hrDooPart'
import type { TripCost, TripLeg } from '../domain/trips/trip'
import { tripMomentText } from '../domain/trips/tripMoment'
import type { TripFile } from '../domain/trips/tripReading'
import { tripSettlement } from '../domain/trips/tripSettlement'
import { ruleValue } from '../ruleset/ruleset'
import { words } from './words'

/** A travel order as the chat reads it, with its settlement's figures once Kuna can work them out. */
interface TripView {
  readonly id: string
  readonly number: string
  readonly issued: string
  readonly traveller: string
  readonly role: string
  readonly destination: string
  readonly country: string
  readonly task: string
  readonly departs: string
  readonly days: number
  readonly transport: string
  readonly car: string
  readonly plate: string
  readonly kmRate: Money
  readonly advance: Money
  readonly settleBy: string
  readonly left: string
  readonly returned: string
  readonly borderOut: string
  readonly borderIn: string
  readonly odometerStart: number | null
  readonly odometerEnd: number | null
  readonly meals: string
  readonly report: string
  readonly settledOn: string
  readonly note: string
  readonly perDiems: Money
  readonly kilometres: Money
  readonly payout: Money
  readonly waitsFor: string
}

interface TripCostView {
  readonly id: string
  readonly trip: string
  readonly date: string
  readonly kind: string
  readonly description: string
  readonly amount: Money
  readonly foreignAmount: string
  readonly paidBy: string
}

/** The traveller names a person, so the whole order, with its plate, odometer and report, stays on the device while Anonymise is on. */
const TRIP_FIELDS: FieldDocs<TripView> = {
  id: { exposure: 'ref', to: TRIP_RECORDS.name, meaning: 'The travel order.' },
  number: { exposure: 'plain', meaning: 'Its number, such as 3/2026.' },
  issued: { exposure: 'plain', meaning: 'The day it was issued.' },
  traveller: { exposure: 'party', meaning: 'The employee who travels.' },
  role: { exposure: 'free-text', meaning: "The traveller's job, as the order names it." },
  destination: { exposure: 'free-text', meaning: 'Where the trip goes.' },
  country: { exposure: 'plain', meaning: 'The two-letter code of the country, HR at home.' },
  task: { exposure: 'free-text', meaning: 'What the trip is for.' },
  departs: { exposure: 'plain', meaning: 'The day the trip starts.' },
  days: { exposure: 'plain', meaning: 'The days the order approves.' },
  transport: { exposure: 'plain', meaning: 'private-car, company-car, plane, train, bus or other.' },
  car: { exposure: 'free-text', meaning: 'The make of a private car.' },
  plate: { exposure: 'free-text', meaning: 'The plate of a private car.' },
  kmRate: { exposure: 'plain', amount: 'app', meaning: 'What a private car is paid per kilometre, zero for other transport.' },
  advance: { exposure: 'plain', amount: 'app', meaning: 'The advance paid before the trip, zero for none.' },
  settleBy: { exposure: 'plain', meaning: 'The day it should be settled by, or empty.' },
  left: { exposure: 'plain', meaning: 'When the traveller left, as 2026-03-12 07:30, or empty.' },
  returned: { exposure: 'plain', meaning: 'When the traveller came back, or empty.' },
  borderOut: { exposure: 'plain', meaning: 'Abroad: when the traveller crossed the border, or by plane took off.' },
  borderIn: { exposure: 'plain', meaning: 'Abroad: when the traveller crossed back, or by plane landed in Croatia.' },
  odometerStart: { exposure: 'plain', meaning: "The private car's odometer at the start." },
  odometerEnd: { exposure: 'plain', meaning: "The private car's odometer at the end." },
  meals: { exposure: 'plain', meaning: 'Meals paid for the traveller, one count per line of the per-diem table.' },
  report: { exposure: 'free-text', meaning: 'The report on the trip.' },
  settledOn: { exposure: 'plain', meaning: 'The day it was settled, or empty while it is open.' },
  note: { exposure: 'free-text', meaning: "The owner's note." },
  perDiems: { exposure: 'plain', amount: 'app', meaning: 'The tax-free per diems Kuna works out, zero while it waits.' },
  kilometres: { exposure: 'plain', amount: 'app', meaning: 'The kilometres of a private car times its rate.' },
  payout: { exposure: 'plain', amount: 'app', meaning: 'What the company pays the traveller after the advance, below zero what the traveller pays back.' },
  waitsFor: { exposure: 'plain', meaning: 'What the settlement still needs: times, borders, odometer or rate, or empty.' },
}

const TRIP_LEG_FIELDS: FieldDocs<TripLeg> = {
  id: { exposure: 'ref', to: TRIP_LEG_RECORDS.name, meaning: 'The leg.' },
  trip: { exposure: 'ref', to: TRIP_RECORDS.name, meaning: 'Its travel order.' },
  date: { exposure: 'plain', meaning: 'The day of the leg.' },
  from: { exposure: 'free-text', meaning: 'Where it starts.' },
  to: { exposure: 'free-text', meaning: 'Where it ends.' },
  km: { exposure: 'plain', meaning: 'Kilometres driven.' },
}

const TRIP_COST_FIELDS: FieldDocs<TripCostView> = {
  id: { exposure: 'ref', to: TRIP_COST_RECORDS.name, meaning: 'The cost.' },
  trip: { exposure: 'ref', to: TRIP_RECORDS.name, meaning: 'Its travel order.' },
  date: { exposure: 'plain', meaning: 'The day it was paid.' },
  kind: { exposure: 'plain', meaning: 'ticket, lodging, fuel, toll, parking or other.' },
  description: { exposure: 'free-text', meaning: 'What the receipt says.' },
  amount: { exposure: 'plain', amount: 'app', meaning: 'In euros.' },
  foreignAmount: { exposure: 'plain', meaning: 'The amount on a foreign receipt with its currency, or empty.' },
  paidBy: { exposure: 'plain', meaning: 'traveller, paid back in the settlement, or company.' },
}

function tripViewOf(file: TripFile, travellerName: string): TripView {
  const { trip } = file
  const settlement = tripSettlement(file, ruleValue)
  const worked = settlement.kind === 'worked' ? settlement : null
  return {
    id: trip.id,
    number: trip.number,
    issued: trip.issued,
    traveller: travellerName,
    role: trip.role,
    destination: trip.destination,
    country: trip.country,
    task: trip.task,
    departs: trip.departs,
    days: trip.days,
    transport: trip.transport,
    car: trip.car?.make ?? '',
    plate: trip.car?.plate ?? '',
    kmRate: trip.car?.kmRate ?? ZERO,
    advance: trip.advance ?? ZERO,
    settleBy: trip.settleBy ?? '',
    left: trip.left === null ? '' : tripMomentText(trip.left),
    returned: trip.returned === null ? '' : tripMomentText(trip.returned),
    borderOut: trip.abroad === null ? '' : tripMomentText(trip.abroad.out),
    borderIn: trip.abroad === null ? '' : tripMomentText(trip.abroad.back),
    odometerStart: trip.odometer?.start ?? null,
    odometerEnd: trip.odometer?.end ?? null,
    meals: trip.meals.join(', '),
    report: trip.report,
    settledOn: trip.settledOn ?? '',
    note: trip.note,
    perDiems: worked?.perDiems ?? ZERO,
    kilometres: worked?.kilometres?.amount ?? ZERO,
    payout: worked?.payout ?? ZERO,
    waitsFor: settlement.kind === 'waiting' ? settlement.gaps.join(', ') : '',
  }
}

function costViewOf(cost: TripCost): TripCostView {
  return {
    id: cost.id,
    trip: cost.trip,
    date: cost.date,
    kind: cost.kind,
    description: cost.description,
    amount: cost.amount,
    foreignAmount: cost.foreign === null ? '' : `${decimalText(cost.foreign.amount)} ${cost.foreign.currency}`,
    paidBy: cost.paidBy,
  }
}

/** The travel orders that count, with their legs and costs, as the chat reads them. */
export function tripKinds(reading: CompanyReading, currency: () => string): readonly ReadableKind[] {
  const files = (): readonly TripFile[] => {
    const workbook = reading.workbook()
    return workbook === null ? [] : hrDooWorkbook(workbook).trips
  }
  const nameOf = (slug: string): string => {
    const workbook = reading.workbook()
    const employee = workbook === null ? undefined : hrDooWorkbook(workbook).employees.find((candidate) => candidate.slug === slug)
    return employee === undefined ? slug : employee.name || employee.slug
  }
  return [
    readableKind({
      kind: TRIP_RECORDS,
      about: words.reads.trip,
      fields: TRIP_FIELDS,
      dated: 'departs',
      rows: () => files().map((file) => tripViewOf(file, nameOf(file.trip.traveller))),
      currencyOf: currency,
    }),
    readableKind({ kind: TRIP_LEG_RECORDS, about: words.reads.tripLeg, fields: TRIP_LEG_FIELDS, dated: 'date', rows: () => files().flatMap((file) => file.legs), currencyOf: currency }),
    readableKind({
      kind: TRIP_COST_RECORDS,
      about: words.reads.tripCost,
      fields: TRIP_COST_FIELDS,
      dated: 'date',
      rows: () => files().flatMap((file) => file.costs.map(costViewOf)),
      currencyOf: currency,
    }),
  ]
}
