import type { Workbook } from '../../../../workbook/domain/workbook'
import { hrDooWorkbook } from '../../domain/hrDooPart'
import { TRIP_COST_RECORDS, TRIP_LEG_RECORDS, TRIP_RECORDS } from '../../domain/hrDooKinds'
import type { Abroad, ForeignAmount, Odometer, PrivateCar, Transport, Trip, TripCost, TripCostKind, TripCostPayer } from '../../domain/trips/trip'
import { clockText } from '../../domain/trips/tripMoment'
import type { TripMoment } from '../../domain/trips/tripMoment'
import { words as tripWords } from '../../presentation/trips/words'
import { words } from '../words'
import type { ProposedRecord } from '../../../../../../shared/app/proposalGroups'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../../shared/calendar/dayLabel'
import { decimalText } from '../../../../../../shared/money/decimal'
import { ZERO } from '../../../../../../shared/money/money'
import { formatMoney } from '../../../../../../shared/money/moneyFormat'
import type { MoneyFormat } from '../../../../../../shared/money/moneyFormat'
import { countryName } from '../../../../../../shared/text/countryName'
import type { RecordKind } from '../../../../../../shared/storage/domain/recordKind'

export const TRIP_KINDS: readonly RecordKind<unknown>[] = [TRIP_RECORDS, TRIP_LEG_RECORDS, TRIP_COST_RECORDS]

const DAY_FIELDS: ReadonlySet<string> = new Set(['issued', 'departs', 'settleBy', 'settledOn', 'date'])

function momentText(moment: TripMoment): string {
  return `${dayLabel(moment.day)} ${clockText(moment.minute)}`
}

/** How a card shows the trip kinds' values, in the words of the Trips screen, or undefined for a kind that is not a trip's. */
export function tripShownValue(kind: RecordKind<unknown>, field: string, record: ProposedRecord, format: MoneyFormat, workbook: Workbook): string | null | undefined {
  if (!TRIP_KINDS.some((tripKind) => tripKind.name === kind.name)) return undefined
  const value = record[field]
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return null
  if (DAY_FIELDS.has(field)) return dayLabel(value as CivilDate)
  switch (field) {
    case 'trip':
      return hrDooWorkbook(workbook).trips.find((file) => file.trip.id === value)?.trip.number ?? String(value)
    case 'traveller': {
      const employee = hrDooWorkbook(workbook).employees.find((candidate) => candidate.slug === value)
      return employee === undefined ? String(value) : employee.name || employee.slug
    }
    case 'country':
      return countryName(String(value))
    case 'transport':
      return tripWords.transports[value as Transport] ?? String(value)
    case 'kind':
      return tripWords.costKinds[value as TripCostKind] ?? String(value)
    case 'paidBy':
      return tripWords.payers[value as TripCostPayer] ?? String(value)
    case 'advance':
      return formatMoney((record as unknown as Trip).advance ?? ZERO, 'negative', format)
    case 'amount':
      return formatMoney((record as unknown as TripCost).amount, 'negative', format)
    case 'car': {
      const car = value as PrivateCar
      return words.proposals.car(car.make, car.plate, formatMoney(car.kmRate, 'negative', format))
    }
    case 'left':
    case 'returned':
      return momentText(value as TripMoment)
    case 'abroad': {
      const abroad = value as Abroad
      return words.proposals.period(momentText(abroad.out), momentText(abroad.back))
    }
    case 'odometer': {
      const odometer = value as Odometer
      return words.proposals.odometer(odometer.start, odometer.end)
    }
    case 'foreign': {
      const foreign = value as ForeignAmount
      return `${decimalText(foreign.amount)} ${foreign.currency}`
    }
    default:
      return Array.isArray(value) ? value.join(', ') : String(value)
  }
}

/** The fields a new trip record's label names, which its add leaves off the card. */
export function tripFieldsInLabel(kind: RecordKind<unknown>): ReadonlySet<string> | undefined {
  switch (kind.name) {
    case TRIP_RECORDS.name:
      return new Set(['number', 'destination'])
    case TRIP_LEG_RECORDS.name:
      return new Set(['trip', 'from', 'to'])
    case TRIP_COST_RECORDS.name:
      return new Set(['trip', 'description'])
    default:
      return undefined
  }
}

/** What a trip record is called on the Trips screen, a leg or a cost with its order's number, or undefined for a kind that is not a trip's. */
export function tripLabel(kind: RecordKind<unknown>, record: ProposedRecord, fallback: string, workbook: Workbook): string | undefined {
  const text = (field: string): string => (typeof record[field] === 'string' ? (record[field] as string) : '')
  const onTrip = (what: string): string => {
    const number = hrDooWorkbook(workbook).trips.find((file) => file.trip.id === record['trip'])?.trip.number
    return number === undefined ? what : words.proposals.onTrip(what, number)
  }
  switch (kind.name) {
    case TRIP_RECORDS.name:
      return [text('number'), text('destination')].filter((part) => part !== '').join(', ')
    case TRIP_LEG_RECORDS.name:
      return onTrip([text('from'), text('to')].filter((part) => part !== '').join(' – ') || fallback)
    case TRIP_COST_RECORDS.name:
      return onTrip(text('description') || tripWords.costKinds[text('kind') as TripCostKind] || text('kind'))
    default:
      return undefined
  }
}
