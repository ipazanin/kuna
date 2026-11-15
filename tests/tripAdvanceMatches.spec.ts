import { describe, expect, it } from 'vitest'

import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { TRIP_CODECS, tripsOf } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { tripCostsPaidAsAdvances } from '../src/apps/company/packs/hr-doo/domain/trips/tripAdvanceMatches'
import type { TripFile } from '../src/apps/company/packs/hr-doo/domain/trips/tripReading'
import { tripWarnings } from '../src/apps/company/packs/hr-doo/domain/trips/tripWarnings'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import type { OwnerAdvance } from '../src/apps/company/workbook/domain/workbook'
import type { RecordCodec } from '../src/shared/storage/domain/recordCodec'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordsRead } from '../src/shared/storage/domain/recordsRead'
import { refusalOr, storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { director } from './fixtures/employees'
import { civil, euros } from './fixtures/ledger'

function tab<R>(codec: RecordCodec<R>, rows: readonly RecordFields[]): RecordsRead<R> {
  return {
    records: rows.map((row) => {
      const fields = storedFieldsOfValues(row)
      const id = recordIdOf(codec.kind, String(row.id))
      const made = refusalOr(() => codec.make(fields, id))
      if ('refused' in made) throw new Error(made.refused)
      return { record: made.made, id, label: codec.label(fields), fields }
    }),
    refused: [],
  }
}

/** A made-up drive to Zadar on 12 and 13 March with a 47.40 toll the traveller paid and fuel the company card paid. */
const ZADAR: RecordFields = {
  id: 'zadar',
  number: '1/2026',
  issued: '2026-03-10',
  traveller: 'alex',
  destination: 'Zadar',
  departs: '2026-03-12',
  days: '2',
  transport: 'private-car',
  car: 'Made-up Estate',
  plate: 'ZG-000-XX',
  km_rate: '0.50',
  left: '2026-03-12 07:00',
  returned: '2026-03-13 20:00',
  odometer_start: '41200',
  odometer_end: '41790',
}

const COSTS: readonly RecordFields[] = [
  { id: 'toll', trip: 'zadar', date: '2026-03-12', kind: 'toll', amount: '47.40', paid_by: 'traveller' },
  { id: 'fuel', trip: 'zadar', date: '2026-03-13', kind: 'fuel', amount: '61.20', paid_by: 'company' },
]

function zadar(fields: RecordFields = ZADAR): TripFile {
  const reading = tripsOf({ trips: tab(TRIP_CODECS.trip, [fields]), legs: tab(TRIP_CODECS.leg, []), costs: tab(TRIP_CODECS.cost, COSTS) }, new Set(['alex', 'mia']))
  const [file] = reading.files
  if (file === undefined) throw new Error(reading.trips.problems.map((problem) => problem.reason).join(', '))
  return file
}

function advance(id: string, date: string, amount: number): OwnerAdvance {
  return {
    date: civil(date),
    amount: euros(amount),
    description: 'Motorway toll, paid privately',
    category: 'travel',
    family: 'operating',
    bucket: 'operating',
    ownerShare: null,
    id: recordIdOf(OWNER_ADVANCE_RECORDS, id),
  }
}

const ALEX = director({ employee: 'alex' })

describe('a trip cost the owner also entered as an owner advance', () => {
  it('matches an advance of the same amount from three days before the departure to three days after the return', () => {
    const advances = [
      advance('before', '2026-03-09', 47.4),
      advance('after', '2026-03-16', 47.4),
      advance('too-early', '2026-03-08', 47.4),
      advance('too-late', '2026-03-17', 47.4),
      advance('other', '2026-03-12', 47.41),
    ]
    expect(tripCostsPaidAsAdvances([zadar()], advances, ALEX).map((match) => [match.cost.kind, match.advance.id])).toEqual([
      ['toll', recordIdOf(OWNER_ADVANCE_RECORDS, 'before')],
      ['toll', recordIdOf(OWNER_ADVANCE_RECORDS, 'after')],
    ])
  })

  it("leaves out a cost the company paid, another employee's trip and books with no director", () => {
    const advances = [advance('fuel', '2026-03-13', 61.2), advance('toll', '2026-03-12', 47.4)]
    expect(tripCostsPaidAsAdvances([zadar()], advances, ALEX).map((match) => match.cost.kind)).toEqual(['toll'])
    expect(tripCostsPaidAsAdvances([zadar({ ...ZADAR, traveller: 'mia' })], advances, ALEX)).toEqual([])
    expect(tripCostsPaidAsAdvances([zadar()], advances, null)).toEqual([])
  })

  it('counts an open trip to the last day its order approves', () => {
    const { left: _left, returned: _returned, odometer_start: _start, odometer_end: _end, ...open } = ZADAR
    expect(tripCostsPaidAsAdvances([zadar(open)], [advance('late', '2026-03-16', 47.4)], ALEX)).toHaveLength(1)
  })

  it('warns on the trip of the advance and of fuel paid beside the kilometres, whoever paid it', () => {
    const toll = advance('toll', '2026-03-12', 47.4)
    const warnings = tripWarnings(zadar(), ALEX, ruleValue, [toll], ALEX)
    expect(warnings.map((warning) => [warning.kind, 'cost' in warning ? warning.cost.amount : null])).toEqual([
      ['fuel-with-kilometres', euros(61.2)],
      ['paid-as-owner-advance', euros(47.4)],
    ])
    expect(tripWarnings(zadar({ ...ZADAR, traveller: 'mia' }), director({ employee: 'mia' }), ruleValue, [toll], ALEX).map((warning) => warning.kind)).toEqual(['fuel-with-kilometres'])
  })
})
