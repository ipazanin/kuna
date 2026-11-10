import type { CompanyBooks } from '../../../../workbook/domain/readWorkbook'
import {
  costDraftOf,
  costOfDraft,
  legDraftOf,
  legOfDraft,
  orderDraftOf,
  removeTrip,
  removeTripCost,
  removeTripLeg,
  saveTripCost,
  saveTripLeg,
  saveTripOrder,
  settleTrip,
  settlementDraftOf,
  tripOfOrder,
  tripOfSettlement,
} from '../../application/tripWrites'
import type { TripCostDraft, TripLegDraft, TripOrderDraft, TripSettlementDraft } from '../../application/tripWrites'
import { EMPLOYEE_RECORDS, TRIP_COST_RECORDS, TRIP_LEG_RECORDS, TRIP_RECORDS } from '../../domain/hrDooKinds'
import { hrDooWorkbook } from '../../domain/hrDooPart'
import { TRANSPORTS, TRIP_COST_KINDS, TRIP_COST_PAYERS } from '../../domain/trips/trip'
import { nextTripNumber } from '../../domain/trips/tripDefaults'
import type { TripFile } from '../../domain/trips/tripReading'
import type { AssistantOperation, ProposalStep } from '../../../../../../shared/app/assistantOperations'
import { TEXT, dayOf, inputOf } from '../../../../../../shared/app/operationInput'
import { StepRefused } from '../../../../../../shared/app/proposedWrites'
import type { StrictSchema } from '../../../../../../shared/ai/domain/strictSchema'
import type { UnitOfWork } from '../../../../../../shared/storage/application/repository'

const DAY: StrictSchema = { type: ['string', 'null'], description: 'A day such as 2026-03-12, "" to blank it, or null to leave it.' }
const MOMENT: StrictSchema = { type: ['string', 'null'], description: 'A day and time such as 2026-03-12 07:30, "" to blank it, or null to leave it.' }
const FIELD: StrictSchema = { type: ['string', 'null'], description: 'Text, "" to blank it, or null to leave it.' }
const AMOUNT: StrictSchema = { type: ['string', 'null'], description: 'An amount such as 0.50, "" to blank it, or null to leave it.' }
const WHOLE: StrictSchema = { type: ['string', 'null'], description: 'A whole number, "" to blank it, or null to leave it.' }

function choiceOf(choices: readonly string[]): StrictSchema {
  return { type: ['string', 'null'], enum: [...choices, null], description: 'One of these, or null to leave it.' }
}

const ORDER_FIELDS = {
  number: { type: ['string', 'null'], description: 'Such as 3/2026. Null on a new order takes the next number of its issue year.' },
  issued: DAY,
  traveller: { type: ['string', 'null'], description: 'The employee who travels, or null to leave it.' },
  role: FIELD,
  destination: FIELD,
  country: { type: ['string', 'null'], description: 'A two-letter country code such as GB, "" for Croatia, or null to leave it.' },
  task: FIELD,
  departs: DAY,
  days: WHOLE,
  transport: choiceOf(TRANSPORTS),
  car: FIELD,
  plate: FIELD,
  kmRate: AMOUNT,
  advance: AMOUNT,
  settleBy: DAY,
  note: FIELD,
} as const satisfies Readonly<Record<keyof TripOrderDraft, StrictSchema>>

const SETTLEMENT_FIELDS = {
  left: MOMENT,
  returned: MOMENT,
  borderOut: MOMENT,
  borderIn: MOMENT,
  odometerStart: WHOLE,
  odometerEnd: WHOLE,
  meals: { type: ['string', 'null'], description: 'Meals paid for the traveller, a count from 0 to 2 for each line of the per-diem table, such as 1, 0, or null to leave it.' },
  report: FIELD,
  settledOn: DAY,
} as const satisfies Readonly<Record<keyof TripSettlementDraft, StrictSchema>>

const LEG_FIELDS = { date: DAY, from: FIELD, to: FIELD, km: WHOLE } as const satisfies Readonly<Record<keyof TripLegDraft, StrictSchema>>

const COST_FIELDS = {
  date: DAY,
  kind: choiceOf(TRIP_COST_KINDS),
  description: FIELD,
  amount: { type: ['string', 'null'], description: 'In euros, from the card statement or at the ECB rate of the payment day, or null to leave it.' },
  foreignAmount: AMOUNT,
  currency: FIELD,
  paidBy: choiceOf(TRIP_COST_PAYERS),
} as const satisfies Readonly<Record<keyof TripCostDraft, StrictSchema>>

const nulls = (fields: Readonly<Record<string, unknown>>) => Object.fromEntries(Object.keys(fields).map((field) => [field, null]))

/** The travel orders, their settlement, legs and costs, each through the writes the Trips screen uses. */
export const TRIP_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-trip',
    about:
      "A travel order for an employee, as the Trips screen's New travel order makes it. A private car needs car, plate and kmRate, the tax-free 0.50 a km unless the person says otherwise. Null leaves a field blank, and the number the next of its issue year.",
    input: inputOf(ORDER_FIELDS),
    refs: { traveller: EMPLOYEE_RECORDS.name },
    creates: null,
    alone: false,
    example: { ...nulls(ORDER_FIELDS), issued: '2026-11-02', traveller: 'employee', destination: 'Rijeka', task: 'Client visit', departs: '2026-11-12', days: '1', transport: 'train' },
  },
  {
    name: 'change-trip',
    about: "Fixes a travel order's own fields, as its Edit does. The settlement stays as it is. Null leaves a field as it is.",
    input: inputOf({ trip: TEXT, ...ORDER_FIELDS }),
    refs: { trip: TRIP_RECORDS.name, traveller: EMPLOYEE_RECORDS.name },
    creates: null,
    alone: false,
    example: { trip: 'trip', ...nulls(ORDER_FIELDS), task: 'Client visit and workshop' },
  },
  {
    name: 'settle-trip',
    about:
      'Fills in or fixes the settlement of a travel order: when the traveller left and came back, the border times abroad (by plane take-off and landing), the odometer of a private car, meals paid per line of the per-diem table, the report and the day it was settled. A settled trip needs its report. Null leaves a field as it is.',
    input: inputOf({ trip: TEXT, ...SETTLEMENT_FIELDS }),
    refs: { trip: TRIP_RECORDS.name },
    creates: null,
    alone: false,
    example: { trip: 'trip', ...nulls(SETTLEMENT_FIELDS), report: 'Met the client as planned.' },
  },
  {
    name: 'delete-trip',
    about: 'Deletes a travel order with its legs and costs. Its number stays a gap.',
    input: inputOf({ trip: TEXT }),
    refs: { trip: TRIP_RECORDS.name },
    creates: null,
    alone: false,
    example: { trip: 'trip' },
  },
  {
    name: 'add-trip-leg',
    about: 'A drive of a travel order by private car, with its kilometres. The legs of a trip fit within its odometer.',
    input: inputOf({ trip: TEXT, ...LEG_FIELDS }),
    refs: { trip: TRIP_RECORDS.name },
    creates: null,
    alone: false,
    example: { trip: 'trip', date: '2026-03-12', from: 'Zagreb', to: 'Karlovac', km: '20' },
  },
  {
    name: 'change-trip-leg',
    about: 'Fixes a leg of a travel order. Null leaves a field as it is.',
    input: inputOf({ leg: TEXT, ...LEG_FIELDS }),
    refs: { leg: TRIP_LEG_RECORDS.name },
    creates: null,
    alone: false,
    example: { leg: 'trip-leg', ...nulls(LEG_FIELDS), to: 'Split centre' },
  },
  {
    name: 'delete-trip-leg',
    about: 'Deletes a leg of a travel order.',
    input: inputOf({ leg: TEXT }),
    refs: { leg: TRIP_LEG_RECORDS.name },
    creates: null,
    alone: false,
    example: { leg: 'trip-leg' },
  },
  {
    name: 'add-trip-cost',
    about:
      'A ticket, a night or another cost of a travel order, in euros, with who paid it. The traveller is paid back in the settlement, and a cost the company paid is only listed beside it. A foreign receipt keeps its amount and currency beside the euros.',
    input: inputOf({ trip: TEXT, ...COST_FIELDS }),
    refs: { trip: TRIP_RECORDS.name },
    creates: null,
    alone: false,
    example: { trip: 'trip', date: '2026-03-12', kind: 'parking', description: 'Parking garage', amount: '12', foreignAmount: null, currency: null, paidBy: 'traveller' },
  },
  {
    name: 'change-trip-cost',
    about: 'Fixes a cost of a travel order. Null leaves a field as it is.',
    input: inputOf({ cost: TEXT, ...COST_FIELDS }),
    refs: { cost: TRIP_COST_RECORDS.name },
    creates: null,
    alone: false,
    example: { cost: 'trip-cost', ...nulls(COST_FIELDS), description: 'Motorway toll, both ways' },
  },
  {
    name: 'delete-trip-cost',
    about: 'Deletes a cost of a travel order.',
    input: inputOf({ cost: TEXT }),
    refs: { cost: TRIP_COST_RECORDS.name },
    creates: null,
    alone: false,
    example: { cost: 'trip-cost' },
  },
]

/** The operations on a travel order, which names its traveller, an employee, so the chat makes none while Anonymise is on. */
const NAMES_A_PERSON: ReadonlySet<string> = new Set(['add-trip', 'change-trip', 'settle-trip', 'delete-trip'])

const ANONYMISING =
  'A travel order names its traveller, an employee, so it stays on this device while Anonymise is on and the chat cannot change it. Ask the person to turn Anonymise off for this AI company, or to make the change on the Trips screen.'

type Field = Readonly<Record<string, never>>

/** The typed fields over the draft: a null field keeps what the draft holds. */
function typedOver<Draft extends object>(draft: Draft, field: Field): Draft {
  const typed = Object.fromEntries(Object.keys(draft).flatMap((name) => (field[name] === null || field[name] === undefined ? [] : [[name, String(field[name])]])))
  return { ...draft, ...typed }
}

function fileOf(books: CompanyBooks, id: string): TripFile {
  const file = hrDooWorkbook(books.workbook).trips.find((candidate) => candidate.trip.id === id)
  if (file === undefined) throw new StepRefused('That travel order is no longer in the file, or the file cannot read it.')
  return file
}

function madeOrRefused<R>(made: { readonly made: R } | { readonly refused: string }): R {
  if ('refused' in made) throw new StepRefused(made.refused)
  return made.made
}

const BLANK_ORDER: TripOrderDraft = {
  number: '',
  issued: '',
  traveller: '',
  role: '',
  destination: '',
  country: '',
  task: '',
  departs: '',
  days: '',
  transport: '',
  car: '',
  plate: '',
  kmRate: '',
  advance: '',
  settleBy: '',
  note: '',
}
const BLANK_LEG: TripLegDraft = { date: '', from: '', to: '', km: '' }
const BLANK_COST: TripCostDraft = { date: '', kind: '', description: '', amount: '', foreignAmount: '', currency: '', paidBy: '' }

/** One trip step through the Trips screen's writes, or false for an operation that is not a trip's. */
export function plannedTripStep(unit: UnitOfWork, books: CompanyBooks, { operation, input }: ProposalStep, idOf: (value: unknown) => string, anonymising: boolean): boolean {
  if (anonymising && NAMES_A_PERSON.has(operation)) throw new StepRefused(ANONYMISING)
  // The chat checked the input against this operation's schema, so each field has the type the schema gives it.
  const field = input as Field
  const trips = () => hrDooWorkbook(books.workbook).trips.map((file) => file.trip)
  const withTraveller = (draft: TripOrderDraft): TripOrderDraft => (field['traveller'] === null ? draft : { ...draft, traveller: idOf(field['traveller']) })
  switch (operation) {
    case 'add-trip': {
      const typed = withTraveller(typedOver(BLANK_ORDER, field))
      const draft = typed.number === '' ? { ...typed, number: nextTripNumber(dayOf(typed.issued), trips()) } : typed
      madeOrRefused(tripOfOrder(draft, null))
      saveTripOrder(unit, draft, null)
      return true
    }
    case 'change-trip': {
      const before = fileOf(books, idOf(field['trip'])).trip
      const draft = withTraveller(typedOver(orderDraftOf(before), field))
      madeOrRefused(tripOfOrder(draft, before))
      saveTripOrder(unit, draft, before)
      return true
    }
    case 'settle-trip': {
      const before = fileOf(books, idOf(field['trip'])).trip
      const draft = typedOver(settlementDraftOf(before), field)
      madeOrRefused(tripOfSettlement(before, draft))
      settleTrip(unit, before, draft)
      return true
    }
    case 'delete-trip':
      removeTrip(unit, fileOf(books, idOf(field['trip'])))
      return true
    case 'add-trip-leg': {
      const { trip } = fileOf(books, idOf(field['trip']))
      const draft = typedOver(BLANK_LEG, field)
      madeOrRefused(legOfDraft(trip, draft, null))
      saveTripLeg(unit, trip, draft, null)
      return true
    }
    case 'change-trip-leg':
    case 'delete-trip-leg': {
      const file = hrDooWorkbook(books.workbook).trips.find((candidate) => candidate.legs.some((leg) => leg.id === idOf(field['leg'])))
      const before = file?.legs.find((leg) => leg.id === idOf(field['leg']))
      if (file === undefined || before === undefined) throw new StepRefused('That leg is no longer in the file, or the file cannot read it.')
      if (operation === 'delete-trip-leg') {
        removeTripLeg(unit, before)
        return true
      }
      const draft = typedOver(legDraftOf(before), field)
      madeOrRefused(legOfDraft(file.trip, draft, before))
      saveTripLeg(unit, file.trip, draft, before)
      return true
    }
    case 'add-trip-cost': {
      const { trip } = fileOf(books, idOf(field['trip']))
      const draft = typedOver(BLANK_COST, field)
      madeOrRefused(costOfDraft(trip, draft, null))
      saveTripCost(unit, trip, draft, null)
      return true
    }
    case 'change-trip-cost':
    case 'delete-trip-cost': {
      const file = hrDooWorkbook(books.workbook).trips.find((candidate) => candidate.costs.some((cost) => cost.id === idOf(field['cost'])))
      const before = file?.costs.find((cost) => cost.id === idOf(field['cost']))
      if (file === undefined || before === undefined) throw new StepRefused('That cost is no longer in the file, or the file cannot read it.')
      if (operation === 'delete-trip-cost') {
        removeTripCost(unit, before)
        return true
      }
      const draft = typedOver(costDraftOf(before), field)
      madeOrRefused(costOfDraft(file.trip, draft, before))
      saveTripCost(unit, file.trip, draft, before)
      return true
    }
    default:
      return false
  }
}
