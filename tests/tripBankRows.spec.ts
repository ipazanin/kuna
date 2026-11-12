import { describe, expect, it } from 'vitest'

import { TRIP_CODECS, TRIP_WRITES, tripsOf } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { salaryReconciliation } from '../src/apps/company/packs/hr-doo/domain/salaries/salaryReconciliation'
import { filedBySettlement, tripRowProblem, tripRowSuggestions, tripRowsSplit, withDismissedRow, withLinkedRow } from '../src/apps/company/packs/hr-doo/domain/trips/tripBankRows'
import type { TripFile } from '../src/apps/company/packs/hr-doo/domain/trips/tripReading'
import { code17Amount, reportWaiting, tripReports, tripReportsOfMonth, tripsWaiting } from '../src/apps/company/packs/hr-doo/domain/trips/tripPayments'
import { tripSettlement } from '../src/apps/company/packs/hr-doo/domain/trips/tripSettlement'
import type { WorkedSettlement } from '../src/apps/company/packs/hr-doo/domain/trips/tripSettlement'
import { ruleValue } from '../src/apps/company/packs/hr-doo/ruleset/ruleset'
import { BUCKET_COLOUR } from '../src/apps/company/workbook/domain/categoryColour'
import type { Category, Transaction } from '../src/apps/company/workbook/domain/workbook'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { RecordFields } from '../src/shared/storage/domain/recordFields'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import type { RecordsRead } from '../src/shared/storage/domain/recordsRead'
import { refusalOr, storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import type { RecordCodec } from '../src/shared/storage/domain/recordCodec'
import { director } from './fixtures/employees'
import { exampleStudio } from './fixtures/exampleStudio'
import { withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger, month } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'
import { withSplit } from './fixtures/splits'

const IBAN = 'XX00FAKE0000000000000105'
const ALEX = director({ employee: 'alex', name: 'Alex Example', iban: IBAN })

function category(slug: string, roles: readonly string[]): Category {
  return { slug, family: 'owner', bucket: 'owner-pay', colour: BUCKET_COLOUR, roles, vat: 'none', ownerShare: null }
}

const CATEGORIES: readonly Category[] = [
  category('travel', []),
  category('per-diems', ['tax-free:domestic-per-diem-over-12-hours']),
  category('car-km', ['tax-free:private-car-business-travel']),
  category('trip-costs', ['tax-free:business-travel-cost']),
]

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

/** The worked example of docs/law/company/business-trips.md: Zagreb to Split and back by private car, 820 km, a 100.00 advance and 30.00 of tolls. */
const SPLIT_TRIP: RecordFields = {
  id: 'split',
  number: '1/2026',
  issued: '2026-02-20',
  traveller: 'alex',
  destination: 'Split',
  departs: '2026-03-03',
  days: '2',
  transport: 'private-car',
  car: 'Made-up Estate',
  plate: 'ZG-000-XX',
  km_rate: '0.50',
  advance: '100',
  left: '2026-03-03 06:00',
  returned: '2026-03-04 20:00',
  odometer_start: '10000',
  odometer_end: '10820',
  meals: '0, 1',
  report: 'Met the client.',
  settled_on: '2026-03-06',
}

function fileOf(fields: RecordFields = SPLIT_TRIP): TripFile {
  const reading = tripsOf(
    {
      trips: tab(TRIP_CODECS.trip, [fields]),
      legs: tab(TRIP_CODECS.leg, [
        { id: 'out', trip: 'split', date: '2026-03-03', from: 'Zagreb', to: 'Split', km: '410' },
        { id: 'back', trip: 'split', date: '2026-03-04', from: 'Split', to: 'Zagreb', km: '410' },
      ]),
      costs: tab(TRIP_CODECS.cost, [{ id: 'toll', trip: 'split', date: '2026-03-03', kind: 'toll', amount: '30', paid_by: 'traveller' }]),
    },
    new Set(['alex']),
  )
  const [file] = reading.files
  if (file === undefined) throw new Error(reading.trips.problems.map((problem) => problem.reason).join(', '))
  return file
}

function worked(file: TripFile): WorkedSettlement {
  const settlement = tripSettlement(file, ruleValue)
  if (settlement.kind !== 'worked') throw new Error('The settlement waits.')
  return settlement
}

/** Rows with their row ids, the advance on 27 February and the payout on 9 March to the traveller. */
function rows(specs: readonly RowSpec[] = PAYMENTS): Transaction[] {
  return withPackBuckets(ledger(specs), CATEGORIES).map((row) => ({ ...row, rowId: `row-${row.date}-${row.amount}` }))
}

const PAYMENTS: readonly RowSpec[] = [
  { date: '2026-02-27', amount: -100, category: 'travel', iban: IBAN, counterparty: 'Alex Example' },
  { date: '2026-03-09', amount: -391, category: 'travel', iban: IBAN, counterparty: 'Alex Example' },
  { date: '2026-03-09', amount: -391, category: 'travel', iban: 'XX00SOMEONEELSE000000001' },
]

function linked(file: TripFile, transactions: readonly Transaction[]): TripFile {
  const advance = transactions.find((row) => row.date === '2026-02-27')
  const payout = transactions.find((row) => row.date === '2026-03-09' && row.counterpartyIban === IBAN)
  return { ...file, trip: withLinkedRow(withLinkedRow(file.trip, 'advance', advance?.rowId ?? null), 'payout', payout?.rowId ?? null) }
}

describe('a trip linked to its bank rows', () => {
  it('reads and stores the advance and payout row ids', () => {
    const trip = fileOf({ ...SPLIT_TRIP, advance_row: 'a', payout_row: 'b' }).trip
    expect([trip.advanceRow, trip.payoutRow]).toEqual(['a', 'b'])
    expect(TRIP_CODECS.trip.fieldsOf(trip)).toMatchObject({ advance_row: 'a', payout_row: 'b' })
  })

  it("offers the payments to the traveller's IBAN of the advance and of the payout, and nothing a trip already links", () => {
    const file = fileOf()
    const transactions = rows()
    const offered = tripRowSuggestions(file, worked(file), ALEX, [file.trip], transactions)
    expect(offered.map((suggestion) => [suggestion.link, suggestion.row.date, suggestion.row.amount])).toEqual([
      ['advance', '2026-02-27', euros(-100)],
      ['payout', '2026-03-09', euros(-391)],
    ])
    const other = { ...file.trip, id: recordIdOf(TRIP_CODECS.trip.kind, 'other'), number: '2/2026', advanceRow: offered[0]!.row.rowId }
    expect(tripRowSuggestions(file, worked(file), ALEX, [file.trip, other], transactions).map((suggestion) => suggestion.link)).toEqual(['payout'])
  })

  it('offers no payment a person set aside for the trip, and stores what was set aside', () => {
    const file = fileOf()
    const transactions = rows()
    const advance = transactions.find((row) => row.date === '2026-02-27')!
    const dismissed = { ...file, trip: withDismissedRow(file.trip, advance.rowId!) }
    expect(tripRowSuggestions(dismissed, worked(file), ALEX, [dismissed.trip], transactions).map((suggestion) => suggestion.link)).toEqual(['payout'])
    expect(TRIP_CODECS.trip.fieldsOf(dismissed.trip)).toMatchObject({ dismissed_rows: advance.rowId })
    expect(fileOf({ ...SPLIT_TRIP, dismissed_rows: 'a, b' }).trip.dismissedRows).toEqual(['a', 'b'])
  })

  it('refuses a row no debit carries, an advance row on an order without an advance, and a row another trip links', () => {
    const file = fileOf()
    const transactions = rows()
    const linkedFile = linked(file, transactions)
    expect(tripRowProblem({ ...file.trip, payoutRow: 'gone' }, 'payout', [file.trip], transactions)).toEqual({ kind: 'row-gone', link: 'payout', rowId: 'gone' })
    expect(tripRowProblem({ ...linkedFile.trip, advance: null }, 'advance', [], transactions)).toEqual({ kind: 'no-advance' })
    const twice = { ...linkedFile.trip, number: '2/2026', id: recordIdOf(TRIP_CODECS.trip.kind, 'twice') }
    expect(tripRowProblem(linkedFile.trip, 'payout', [linkedFile.trip, twice], transactions)).toEqual({ kind: 'linked-twice', link: 'payout', number: '2/2026' })
    expect(tripRowProblem(linkedFile.trip, 'payout', [linkedFile.trip], transactions)).toBeNull()
  })

  it('reads the trip with its links through the trips write rules', () => {
    expect(TRIP_WRITES.reads.map((kind) => kind.name)).toEqual(expect.arrayContaining(['ledger-row', 'category']))
  })
})

describe('filing the rows by the settlement', () => {
  it('fills the advance first, per diems and then kilometres, and gives the payout row the rest', () => {
    const transactions = rows()
    const file = linked(fileOf(), transactions)
    const split = tripRowsSplit(file, worked(file), transactions, CATEGORIES)
    if ('refused' in split) throw new Error(split.refused.kind)
    // Per diems 30.00 and 21.00, kilometres 820 × 0.50 = 410.00, tolls 30.00. The advance of 100.00 takes 51.00 and 49.00.
    expect(split.rows.map((row) => [row.link, row.parts.map((part) => [part.category, part.amount])])).toEqual([
      [
        'advance',
        [
          ['per-diems', euros(-51)],
          ['car-km', euros(-49)],
        ],
      ],
      [
        'payout',
        [
          ['car-km', euros(-361)],
          ['trip-costs', euros(-30)],
        ],
      ],
    ])
  })

  it('refuses a payout row of another amount, and a payment no category holds', () => {
    const transactions = rows([PAYMENTS[0]!, { ...PAYMENTS[1]!, amount: -390 }])
    const file = linked(fileOf(), transactions)
    expect(tripRowsSplit(file, worked(file), transactions, CATEGORIES)).toEqual({ refused: { kind: 'payout-differs', row: euros(390), payout: euros(391) } })
    const right = rows()
    const rightFile = linked(fileOf(), right)
    expect(tripRowsSplit(rightFile, worked(rightFile), right, CATEGORIES.slice(0, 3))).toEqual({ refused: { kind: 'no-category', payment: 'business-travel-cost' } })
  })

  it('keeps what the traveller returns of a large advance in the row’s own category', () => {
    const transactions = rows([{ ...PAYMENTS[0]!, amount: -600 }])
    const file = linked(fileOf({ ...SPLIT_TRIP, advance: '600' }), transactions)
    const split = tripRowsSplit(file, worked(file), transactions, CATEGORIES)
    if ('refused' in split) throw new Error(split.refused.kind)
    expect(split.rows[0]?.parts.map((part) => [part.category, part.amount])).toEqual([
      ['per-diems', euros(-51)],
      ['car-km', euros(-410)],
      ['trip-costs', euros(-30)],
      ['travel', euros(-109)],
    ])
  })

  it('knows a row split into the parts the settlement gives, in any order', () => {
    const transactions = rows()
    const file = linked(fileOf(), transactions)
    const split = tripRowsSplit(file, worked(file), transactions, CATEGORIES)
    if ('refused' in split) throw new Error(split.refused.kind)
    const payout = split.rows[1]!
    const parts = payout.parts.map((part, index) => ({
      amount: part.amount,
      category: part.category,
      family: 'owner',
      bucket: 'owner-pay' as const,
      note: '',
      ownerShare: null,
      id: recordIdOf(TRIP_CODECS.trip.kind, `p${index}`),
    }))
    expect(filedBySettlement(payout, [{ row: payout.row, parts: [...parts].reverse() }])).toBe(true)
    expect(filedBySettlement(payout, [])).toBe(false)
  })
})

describe('JOPPD code 17', () => {
  it('totals a month for one traveller or everyone', () => {
    const file = fileOf()
    expect(tripReportsOfMonth([file], month('2026-03'), null, ruleValue, NO_RATES).total).toBe(euros(461))
    expect(tripReportsOfMonth([file], month('2026-03'), 'someone', ruleValue, NO_RATES)).toEqual({ reports: [], total: euros(0) })
  })

  it('reports the per diems and kilometres up to the caps in the month of the settled day, by the 15th of the next', () => {
    const file = fileOf()
    expect(tripReports([file], ruleValue, NO_RATES).map((report) => [report.month, report.amount, report.dueOn])).toEqual([['2026-03', euros(461), civil('2026-04-15')]])
    const over = fileOf({ ...SPLIT_TRIP, km_rate: '0.60' })
    // 51.00 of per diems and 820 km at the 0.50 cap, not the order's 0.60.
    expect(code17Amount(over, worked(over), ruleValue)).toBe(euros(461))
    const { settled_on: _settled, ...open } = SPLIT_TRIP
    expect(tripReports([fileOf(open)], ruleValue, NO_RATES)).toEqual([])
  })

  it('has a code 17 line wait from the settled day until it is marked reported, late after its due day', () => {
    const [report] = tripReports([fileOf()], ruleValue, NO_RATES)
    if (report === undefined) throw new Error('no code 17 line')
    expect(reportWaiting(report, civil('2026-03-05'))).toBeNull()
    expect(reportWaiting(report, civil('2026-04-15'))?.late).toBe(false)
    expect(reportWaiting(report, civil('2026-04-16'))?.late).toBe(true)
    const reported = { ...report, trip: { ...report.trip, reportedOn: civil('2026-04-20') } }
    expect(reportWaiting(reported, civil('2026-05-01'))).toBeNull()
    expect(TRIP_CODECS.trip.fieldsOf(reported.trip)).toMatchObject({ reported_on: '2026-04-20' })
  })

  it('waits on each payment Kuna found to link, and on the code 17 report until it is due', () => {
    const file = fileOf()
    const waiting = tripsWaiting([file], [ALEX], rows(), civil('2026-03-20'), ruleValue, NO_RATES)
    expect(waiting.toLink.map((found) => [found.link, found.row.amount])).toEqual([
      ['advance', euros(-100)],
      ['payout', euros(-391)],
    ])
    expect(waiting.reports.map((entry) => entry.late)).toEqual([false])
    expect(tripsWaiting([file], [ALEX], rows(), civil('2026-04-16'), ruleValue, NO_RATES).reports.map((entry) => entry.late)).toEqual([true])
    expect(tripsWaiting([file], [ALEX], rows(), civil('2026-03-05'), ruleValue, NO_RATES).reports).toEqual([])
  })
})

describe('Salaries with a linked trip', () => {
  it("counts the parts of the linked rows on the settled day, against the trip's days and kilometres", () => {
    const base = rows(PAYMENTS.slice(0, 2))
    const file = linked(fileOf(), base)
    const filed = withSplit(
      withSplit(
        base,
        { date: '2026-02-27', amount: -100 },
        [
          [-51, 'per-diems'],
          [-49, 'car-km'],
        ],
        CATEGORIES,
      ),
      { date: '2026-03-09', amount: -391 },
      [
        [-361, 'car-km'],
        [-30, 'trip-costs'],
      ],
      CATEGORIES,
    )
    const { paydays, extras } = salaryReconciliation(exampleStudio({ categories: CATEGORIES, transactions: filed, employees: [ALEX], director: ALEX, trips: [file] }))
    expect(paydays.flatMap((payday) => payday.problems.filter((problem) => problem.kind === 'needs-units' || problem.kind === 'over-cap'))).toEqual([])
    expect(extras.flatMap((extra) => extra.usage.map((usage) => [usage.payment, usage.periodKey, usage.paid.amount, usage.cap?.amount ?? null]))).toEqual([
      ['business-travel-cost', '2026', euros(30), null],
      ['domestic-per-diem-over-12-hours', '2026-03', euros(51), euros(60)],
      ['private-car-business-travel', '2026-03', euros(410), euros(410)],
    ])
  })
})
