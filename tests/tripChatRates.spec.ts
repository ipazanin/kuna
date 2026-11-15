import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { tripKinds } from '../src/apps/company/packs/hr-doo/assistant/tripReads'
import { hrDooOperations } from '../src/apps/company/packs/hr-doo/assistant/operations/packOperations'
import { TRIP_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { readDocument } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import type { ReadableRow } from '../src/shared/app/assistantReader'
import { decimalOfText } from '../src/shared/money/decimal'
import { NO_RATES } from '../src/shared/money/rateBook'
import type { RateBook } from '../src/shared/money/rateBook'
import { companyChat, deskPorts } from './fixtures/companyDesk'
import { civil, euros } from './fixtures/ledger'
import { browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const SAVED = '2026-11-07T09:00:00.000Z'
/** A made-up ECB rate of 1.25 dollars a euro, so New York's 100.00 USD a day is 80.00. */
const DOLLAR_RATES: RateBook = { unitsPerEuroOnOrBefore: () => decimalOfText('1.25'), newestDay: () => civil('2026-10-05') }

function oneEmployeeBooks(): CompanyBooks {
  return readDocument({ id: 'fake', source: 'drive', title: 'Fake workbook', syncedAt: SAVED }, fakeWorkbookDocument(SAVED, 'drive', fakeStaffOf('one-employee')))
}

function newYorkRead(rates: RateBook): ReadableRow {
  const books = oneEmployeeBooks()
  const reading = { status: () => 'open' as const, workbook: () => books.workbook, records: () => books.records, rates: () => rates }
  const trips = tripKinds(reading, () => 'EUR').find((kind) => kind.name === TRIP_RECORDS.name)!
  const newYork = hrDooWorkbook(books.workbook).trips.find((file) => file.trip.number === '4/2026')!
  return trips.rows().find((row) => row.id === newYork.trip.id)!
}

function fieldOf(row: ReadableRow, name: string) {
  return row.fields.find((field) => field.name === name)
}

async function dollarDesk(rates: RateBook) {
  const { store } = await browserHarness(used, fakeWorkbookDocument(SAVED, 'browser', fakeStaffOf('one-employee')))
  const chat = companyChat(store, deskPorts({ pack: hrDooOperations({ anonymising: () => false, rates: () => rates }) }), false)
  const newYork = hrDooWorkbook(store.state.workbook!).trips.find((file) => file.trip.number === '4/2026')!
  return { chat, store, newYork }
}

describe('the chat works out a trip in dollars with the ECB rates', () => {
  it('reads its per diems once the rate is in, and waits for the rate without it', () => {
    // Four full per diems of 100.00 USD at 1.25 are 4 × 80.00.
    expect(fieldOf(newYorkRead(DOLLAR_RATES), 'perDiems')).toMatchObject({ cents: euros(320) })
    expect(fieldOf(newYorkRead(DOLLAR_RATES), 'waitsFor')).toMatchObject({ value: '' })
    expect(fieldOf(newYorkRead(NO_RATES), 'waitsFor')).toMatchObject({ value: 'rate' })
  })

  it('files its rows once the rate is in', async () => {
    const { chat, store, newYork } = await dollarDesk(DOLLAR_RATES)
    await chat.propose([{ op: 'file-trip-rows', input: { trip: chat.ref(TRIP_RECORDS.name, newYork.trip.id) } }])
    expect((await chat.accept()).kind).toBe('done')
    const advance = store.state.workbook!.transactions.find((row) => row.description === 'Advance, travel order 4/2026')!
    // The 300.00 advance holds 300.00 of the 320.00 of foreign per diems.
    expect([advance.amount, advance.category]).toEqual([euros(-300), 'foreign-per-diems'])
  })

  it('refuses to file them while the rate is missing', async () => {
    const { chat, newYork } = await dollarDesk(NO_RATES)
    const answer = await chat.propose([{ op: 'file-trip-rows', input: { trip: chat.ref(TRIP_RECORDS.name, newYork.trip.id) } }])
    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('waits for rate') })
  })
})
