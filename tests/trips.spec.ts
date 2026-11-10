import { describe, expect, it } from 'vitest'

import { perDiemsOf } from '../src/apps/company/packs/hr-doo/domain/trips/perDiems'
import type { Trip } from '../src/apps/company/packs/hr-doo/domain/trips/trip'
import { nextTripNumber, tripDefaults } from '../src/apps/company/packs/hr-doo/domain/trips/tripDefaults'
import { TRIP_CODECS, tripsOf } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import type { TripsReading } from '../src/apps/company/packs/hr-doo/domain/trips/tripReading'
import { tripSettlement } from '../src/apps/company/packs/hr-doo/domain/trips/tripSettlement'
import { tripWarnings } from '../src/apps/company/packs/hr-doo/domain/trips/tripWarnings'
import { perDiemLineFigure, settlementBuildUps } from '../src/apps/company/packs/hr-doo/presentation/trips/tripBuildUps'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import type { RecordCodec } from '../src/shared/storage/domain/recordCodec'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordsRead } from '../src/shared/storage/domain/recordsRead'
import { refusalOr, storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { director } from './fixtures/employees'
import { decimalOfText } from '../src/shared/money/decimal'
import { civil, euros } from './fixtures/ledger'

/** A tab as a storage holds it, each record made by the codec from its fields and the id the row gives. */
function tab<R>(codec: RecordCodec<R>, rows: readonly RecordFields[]): RecordsRead<R> {
  const records: RecordsRead<R>['records'][number][] = []
  const refused: RecordsRead<R>['refused'][number][] = []
  rows.forEach((row) => {
    const fields = storedFieldsOfValues(row)
    const id = recordIdOf(codec.kind, String(row.id))
    const made = refusalOr(() => codec.make(fields, id))
    if ('made' in made) records.push({ record: made.made, id, label: codec.label(fields), fields })
    else refused.push({ id, label: codec.label(fields), fields, reason: made.refused })
  })
  return { records, refused }
}

const SPLIT: RecordFields = {
  id: 'split',
  number: '1/2026',
  issued: '2026-03-10',
  traveller: 'alex',
  role: 'Director',
  destination: 'Split',
  task: 'Client meeting',
  departs: '2026-03-12',
  days: '2',
  transport: 'private-car',
  car: 'Made-up Estate',
  plate: 'ZG-000-XX',
  km_rate: '0.50',
  advance: '100',
  left: '2026-03-12 07:00',
  returned: '2026-03-13 20:00',
  odometer_start: '10000',
  odometer_end: '10820',
  meals: '1, 0',
  report: 'Met the client and signed the order.',
  settled_on: '2026-03-16',
}

/** The fields without the named ones, as a row with those cells blank. */
function without(fields: RecordFields, ...names: readonly string[]): RecordFields {
  return Object.fromEntries(Object.entries(fields).filter(([name]) => !names.includes(name)))
}

const BY_CAR = ['car', 'plate', 'km_rate', 'odometer_start', 'odometer_end']

function read(trips: readonly RecordFields[], legs: readonly RecordFields[] = [], costs: readonly RecordFields[] = [], employees: readonly string[] = ['alex']): TripsReading {
  return tripsOf({ trips: tab(TRIP_CODECS.trip, trips), legs: tab(TRIP_CODECS.leg, legs), costs: tab(TRIP_CODECS.cost, costs) }, new Set(employees))
}

function tripOf(fields: RecordFields): Trip {
  const record = tab(TRIP_CODECS.trip, [fields]).records[0]?.record
  if (record === undefined) throw new Error(tab(TRIP_CODECS.trip, [fields]).refused[0]?.reason)
  return record
}

function problems(reading: TripsReading): string[] {
  return [...reading.trips.problems, ...reading.legs.problems, ...reading.costs.problems].map((problem) => problem.reason)
}

/** A day trip at home that leaves at 08:00 and comes back after the given hours and minutes. */
function dayTrip(hours: number, minutes = 0): Trip {
  const back = 8 * 60 + hours * 60 + minutes
  const day = back >= 24 * 60 ? '2026-03-13' : '2026-03-12'
  const clock = back % (24 * 60)
  const text = `${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`
  return tripOf({ ...without(SPLIT, ...BY_CAR, 'meals'), transport: 'train', left: '2026-03-12 08:00', returned: `${day} ${text}` })
}

function sharesOf(trip: Trip): string[] {
  return perDiemsOf(trip, ruleValue)?.lines.map((line) => `${line.share} ${line.amount}`) ?? []
}

describe('per diems', () => {
  it('earns none for exactly 8 hours, half over 8 up to and with 12, and full over 12', () => {
    expect(sharesOf(dayTrip(8))).toEqual([`none ${euros(0)}`])
    expect(sharesOf(dayTrip(8, 1))).toEqual([`half ${euros(15)}`])
    expect(sharesOf(dayTrip(10))).toEqual([`half ${euros(15)}`])
    expect(sharesOf(dayTrip(12))).toEqual([`half ${euros(15)}`])
    expect(sharesOf(dayTrip(12, 1))).toEqual([`full ${euros(30)}`])
  })

  it('splits a trip of several days into 24-hour blocks from departure, the last part by its own hours', () => {
    expect(sharesOf(dayTrip(24))).toEqual([`full ${euros(30)}`])
    expect(sharesOf(dayTrip(24 + 9))).toEqual([`full ${euros(30)}`, `half ${euros(15)}`])
    expect(sharesOf(dayTrip(24 + 7))).toEqual([`full ${euros(30)}`, `none ${euros(0)}`])
  })

  it('cuts a line by 30% for one meal paid and 60% for two', () => {
    const trip = tripOf({ ...SPLIT, meals: '1, 2' })
    const perDiems = perDiemsOf(trip, ruleValue)
    // 30.00 less 30% is 21.00, and 30.00 less 60% is 12.00.
    expect(perDiems?.lines.map((line) => line.amount)).toEqual([euros(21), euros(12)])
    expect(perDiems?.total).toBe(euros(33))
    expect([perDiems?.lines[0]?.earned, perDiems?.lines[0]?.mealCut]).toEqual([euros(30), euros(9)])
  })
})

const LONDON: RecordFields = {
  ...without(SPLIT, ...BY_CAR, 'meals', 'advance'),
  id: 'london',
  number: '2/2026',
  destination: 'London',
  country: 'GB',
  transport: 'plane',
  left: '2026-04-15 05:30',
  border_out: '2026-04-15 09:10',
  border_in: '2026-04-17 21:30',
  returned: '2026-04-17 22:40',
}

describe('per diems abroad', () => {
  it('counts abroad from 2 hours before take-off to landing, in blocks first, then the time at home', () => {
    const perDiems = perDiemsOf(tripOf(LONDON), ruleValue)
    // Abroad from 07:10 to 21:30 two days later is 62 h 20 min: two blocks and 14 h 20 min, each a full 80.00. At home are the 2 h 50 min left.
    expect(perDiems?.lines.map((line) => [line.place, line.minutes, line.share, line.amount])).toEqual([
      ['abroad', 1440, 'full', euros(80)],
      ['abroad', 1440, 'full', euros(80)],
      ['abroad', 860, 'full', euros(80)],
      ['home', 170, 'none', euros(0)],
    ])
  })

  it('pays a country in dollars at the ECB rate of the day the traveller left, and waits while that rate is missing', () => {
    const trip = tripOf({ ...LONDON, country: 'US', destination: 'New York' })
    const rates = { unitsPerEuroOnOrBefore: () => decimalOfText('1.25'), newestDay: () => civil('2026-04-15') }
    // 100.00 USD at 1.25 dollars a euro is 80.00.
    expect(perDiemsOf(trip, ruleValue, rates)?.lines[0]?.amount).toBe(euros(80))
    expect(tripSettlement({ trip, legs: [], costs: [] }, ruleValue)).toEqual({ kind: 'waiting', gaps: ['rate'] })
  })
})

describe('the settlement', () => {
  it('adds per diems, kilometres and what the traveller paid, lists what the company paid apart, and takes off the advance', () => {
    const reading = read(
      [SPLIT],
      [
        { id: 'out', trip: 'split', date: '2026-03-12', from: 'Zagreb', to: 'Split', km: '410' },
        { id: 'back', trip: 'split', date: '2026-03-13', from: 'Split', to: 'Zagreb', km: '410' },
      ],
      [
        { id: 'toll', trip: 'split', date: '2026-03-12', kind: 'toll', description: 'Motorway', amount: '27.40', paid_by: 'traveller' },
        { id: 'hotel', trip: 'split', date: '2026-03-12', kind: 'lodging', description: 'Hotel', amount: '95', paid_by: 'company' },
      ],
    )
    expect(problems(reading)).toEqual([])
    const settlement = tripSettlement(reading.files[0]!, ruleValue)
    if (settlement.kind !== 'worked') throw new Error('not worked')
    // 21.00 and 30.00 per diems, 820 km at 0.50 is 410.00, and the 27.40 toll, less the 100.00 advance.
    expect(settlement.perDiems).toBe(euros(51))
    expect(settlement.kilometres?.amount).toBe(euros(410))
    expect(settlement.travellerCosts).toBe(euros(27.4))
    expect(settlement.companyCosts).toBe(euros(95))
    expect(settlement.owed).toBe(euros(488.4))
    expect(settlement.payout).toBe(euros(388.4))
  })

  it('waits for the times, the border times abroad and the odometer of a private car', () => {
    const reading = read([without(SPLIT, 'left', 'returned', 'odometer_start', 'odometer_end', 'meals', 'settled_on')])
    expect(tripSettlement(reading.files[0]!, ruleValue)).toEqual({ kind: 'waiting', gaps: ['times', 'odometer'] })
  })
})

describe('the build-ups', () => {
  const DOLLARS = { unitsPerEuroOnOrBefore: () => decimalOfText('1.25'), newestDay: () => civil('2026-04-15') }

  it('takes the meals off the earned per diem of a line', () => {
    const line = perDiemsOf(tripOf({ ...SPLIT, meals: '1, 0' }), ruleValue)?.lines[0]
    if (line === undefined) throw new Error('no line')
    expect(perDiemLineFigure(line, 0).steps.map((step) => step.amount)).toEqual([euros(30), euros(-9)])
  })

  it('shows a dollar per diem as the stated dollars at the ECB rate of the day the traveller left, cited as unconfirmed', () => {
    const line = perDiemsOf(tripOf({ ...LONDON, country: 'US', destination: 'New York' }), ruleValue, DOLLARS)?.lines[0]
    if (line === undefined) throw new Error('no line')
    const stated = perDiemLineFigure(line, 0).steps[0]?.steps[0]
    expect(stated?.amount).toBe(euros(80))
    expect(stated?.label).toContain('100 USD')
    expect(stated?.rules.map((rule) => rule.confidence)).toEqual(['unconfirmed'])
  })

  it('reads a payout below zero as what the traveller returns, a positive amount', () => {
    const reading = read([{ ...SPLIT, advance: '1000' }], [{ id: 'out', trip: 'split', date: '2026-03-12', km: '820' }])
    const settlement = tripSettlement(reading.files[0]!, ruleValue)
    if (settlement.kind !== 'worked') throw new Error('not worked')
    // 51.00 of per diems and 410.00 of kilometres, against an advance of 1,000.00.
    expect(settlement.payout).toBe(euros(-539))
    const payout = settlementBuildUps(reading.files[0]!, settlement).payout
    expect([payout.label, payout.amount, payout.steps.map((step) => step.amount)]).toEqual(['To return', euros(539), [euros(1000), euros(-461)]])
  })
})

describe('the trips reader', () => {
  it('leaves out every trip of a number given twice, and the legs and costs that name one', () => {
    const reading = read([SPLIT, { ...SPLIT, id: 'copy', number: '1/2026 ' }], [{ id: 'leg', trip: 'split', date: '2026-03-12', km: '10' }])
    expect(reading.files).toEqual([])
    expect(problems(reading)).toEqual([
      'travel order 1/2026 is on more than one row, so none of them counts',
      'travel order 1/2026 is on more than one row, so none of them counts',
      'it names no travel order that counts',
    ])
  })

  it('checks the traveller, the length, the private car, the odometer and the report', () => {
    expect(problems(read([SPLIT], [], [], []))).toEqual(['"alex" is not on the employees tab'])
    expect(problems(read([{ ...SPLIT, days: '31' }]))).toEqual(['31 days is more than the 30 days in a row a business trip may last'])
    expect(problems(read([{ ...SPLIT, plate: '' }]))).toEqual(['a trip by private car needs the car, its plate and km_rate'])
    expect(problems(read([without(SPLIT, 'odometer_start', 'odometer_end')]))).toEqual(['a settled trip by private car needs odometer_start and odometer_end'])
    expect(problems(read([{ ...SPLIT, report: '' }]))).toEqual(['a settled trip needs the report on the trip'])
    expect(problems(read([{ ...SPLIT, meals: '1, 0, 0' }]))).toEqual(['meals lists 3 lines, and the per-diem table has 2'])
    expect(problems(read([{ ...SPLIT, transport: 'train' }]))).toEqual(['car, plate, km_rate and the odometer belong to a trip by private car'])
  })

  it('refuses legs beyond the odometer on the legs as well as on the trip', () => {
    const reading = read([{ ...SPLIT, odometer_end: '10500' }], [{ id: 'leg', trip: 'split', date: '2026-03-12', km: '600' }])
    expect(problems(reading)).toEqual(['the legs add up to 600 km, more than the 500 km the odometer shows', 'the legs add up to 600 km, more than the 500 km the odometer shows'])
  })
})

describe('warnings', () => {
  it('warns of a rate over the tax-free cap, a first leg under 30 km and a traveller not employed on the day', () => {
    const reading = read([{ ...SPLIT, km_rate: '0.60' }], [{ id: 'leg', trip: 'split', date: '2026-03-12', km: '12' }])
    const employee = director({ employee: 'alex', from: '2026-04-01' })
    expect(tripWarnings(reading.files[0]!, employee, ruleValue)).toEqual([
      { kind: 'km-rate-over-cap', rate: euros(0.6), cap: euros(0.5) },
      { kind: 'first-leg-short', km: 12, shortest: 30 },
      { kind: 'not-employed' },
    ])
  })
})

describe('a new order', () => {
  it('takes the next number of the issue year, leaving a deleted number as a gap, and starts again each year', () => {
    const trips = [tripOf({ ...SPLIT, number: '1/2026' }), tripOf({ ...SPLIT, id: 'b', number: '3/2026' })]
    expect(nextTripNumber(civil('2026-11-10'), trips)).toBe('4/2026')
    expect(nextTripNumber(civil('2027-01-05'), trips)).toBe('1/2027')
  })

  it("starts from the traveller's last order, else a trip at home by private car at the cap", () => {
    const trips = [tripOf(SPLIT), tripOf({ ...without(SPLIT, ...BY_CAR), id: 'later', number: '2/2026', issued: '2026-05-01', transport: 'train' })]
    expect(tripDefaults('alex', civil('2026-11-10'), trips, ruleValue)).toMatchObject({ role: 'Director', transport: 'train', car: null, kmRateCap: euros(0.5) })
    expect(tripDefaults('mia', civil('2026-11-10'), trips, ruleValue)).toEqual({ role: '', country: 'HR', transport: 'private-car', car: null, kmRateCap: euros(0.5) })
  })
})
