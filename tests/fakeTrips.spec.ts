import { describe, expect, it } from 'vitest'

import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { packWaitingJobs } from '../src/apps/company/packs/hr-doo/presentation/packWaitingJobs'
import { settlementOf } from '../src/apps/company/packs/hr-doo/presentation/trips/tripsView'
import { newestBookingOf } from '../src/apps/company/workbook/domain/workbook'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import { NO_RATES } from '../src/shared/money/rateBook'
import { decimalOfText } from '../src/shared/money/decimal'
import { civil, euros } from './fixtures/ledger'

const SYNCED = '2026-10-16T08:00:00.000Z'

function fakeBooks(variant: string) {
  const read = readDocument({ id: 'fake', source: 'drive', title: 'Fake workbook', syncedAt: SYNCED }, fakeWorkbookDocument(SYNCED, 'drive', fakeStaffOf(variant)))
  return { workbook: hrDooWorkbook(read.workbook), problems: read.workbook.problems }
}

describe('the made-up trips', () => {
  const { workbook, problems } = fakeBooks('one-employee')
  const byNumber = (number: string) => {
    const file = workbook.trips.find((candidate) => candidate.trip.number === number)
    if (file === undefined) throw new Error(`no travel order ${number}`)
    return file
  }

  it('keeps every trip, leg and cost of the one-employee variant', () => {
    expect(problems.filter((problem) => problem.tab.startsWith('trip'))).toEqual([])
    expect(workbook.trips.map((file) => [file.trip.number, file.legs.length, file.costs.length])).toEqual([
      ['1/2025', 0, 1],
      ['1/2026', 2, 1],
      ['2/2026', 0, 2],
      ['3/2026', 0, 0],
      ['4/2026', 0, 1],
    ])
  })

  it('pays each settled trip what its per diems, kilometres and the traveller’s costs come to', () => {
    const payout = (number: string) => {
      const settlement = settlementOf(byNumber(number), NO_RATES)
      return settlement.kind === 'worked' ? settlement.payout : null
    }
    // 10 hours in Croatia is a half per diem of 15.00, beside 36.80 of train tickets.
    expect(payout('1/2025')).toBe(euros(51.8))
    // Two full per diems of 30.00 less 30% for the lunch on the first, 570 km at 0.50 and 47.40 of tolls.
    expect(payout('1/2026')).toBe(euros(21 + 30 + 285 + 47.4))
    // From two hours before take-off to landing is 64.5 hours abroad, three full per diems of 80.00, beside the 286.40 flight.
    expect(payout('2/2026')).toBe(euros(240 + 286.4))
  })

  it('pays the trip to a dollar country at the ECB rate of the day the traveller left, and waits without it', () => {
    const rates = { unitsPerEuroOnOrBefore: () => decimalOfText('1.25'), newestDay: () => civil('2026-10-05') }
    const settlement = settlementOf(byNumber('4/2026'), rates)
    // From two hours before take-off to landing is 85 h 40 min abroad, four full per diems of 100.00 USD, each 80.00 at 1.25, beside the 742.10 flight, less the 300.00 advance.
    expect(settlement.kind === 'worked' ? settlement.payout : null).toBe(euros(4 * 80 + 742.1 - 300))
    expect(settlementOf(byNumber('4/2026'), NO_RATES)).toEqual({ kind: 'waiting', gaps: ['rate'] })
  })

  it('lists the hotel the company paid apart from the payout', () => {
    const settlement = settlementOf(byNumber('2/2026'), NO_RATES)
    expect(settlement.kind === 'worked' ? settlement.companyCosts : null).toBe(euros(412.3))
  })

  it('has the open order wait for its times and odometer, and for a settlement on Overview', () => {
    expect(settlementOf(byNumber('3/2026'), NO_RATES)).toEqual({ kind: 'waiting', gaps: ['times', 'odometer'] })
    const asOf = newestBookingOf(workbook.transactions)
    if (asOf === null) throw new Error('the fake ledger is empty')
    expect(packWaitingJobs(workbook, asOf).filter((job) => job.key.startsWith('trip-'))).toEqual([
      expect.objectContaining({ key: 'trip-3/2026', tone: 'warning', link: expect.objectContaining({ to: expect.objectContaining({ path: '/company/trips' }) }) }),
    ])
  })

  it('leaves the other variants without trips', () => {
    expect(fakeBooks('five-employees').workbook.trips).toEqual([])
  })
})
