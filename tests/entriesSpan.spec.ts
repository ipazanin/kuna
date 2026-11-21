import { describe, expect, it } from 'vitest'
import type { Label } from '../src/shared/categorising/domain/labels'

import { ALL_MONTHS, entriesLink, entriesSpanNamed, labelLink, transactionsLink } from '../src/apps/spending/overview/presentation/spendingLinks'
import { ACCOUNT_RECORDS, LABEL_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { keyOfRecordId, recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, month } from './fixtures/ledger'
import { OTP, category } from './fixtures/spending'

const TRIP: Label = { id: recordIdOf(LABEL_RECORDS, 'trip'), name: 'Trip' }
const QUARTER = { from: civil('2026-07-01'), to: civil('2026-09-30') }

describe('a link to Entries over a span', () => {
  it('puts the span in from and to, beside the one group it names', () => {
    expect(entriesLink(QUARTER, { label: TRIP })).toEqual({ path: '/spending/transactions', query: { from: '2026-07-01', to: '2026-09-30', label: 'trip' } })
    expect(entriesLink(QUARTER, { account: OTP })).toEqual({ path: '/spending/transactions', query: { from: '2026-07-01', to: '2026-09-30', account: keyOfRecordId(ACCOUNT_RECORDS, OTP.id) } })
  })

  it('leaves this month out of the address, and builds the older links the same way', () => {
    expect(entriesLink(null, { payee: 'landlord' })).toEqual({ path: '/spending/transactions', query: { payee: 'landlord' } })
    expect(transactionsLink(month('2026-10'), category('Food'))).toEqual(entriesLink(month('2026-10'), { category: category('Food') }))
    expect(labelLink(TRIP)).toEqual(entriesLink(ALL_MONTHS, { label: TRIP }))
  })

  it('reads a span back only when both ends are days in order', () => {
    expect(entriesSpanNamed('2026-07-01', '2026-09-30')).toEqual(QUARTER)
    expect(entriesSpanNamed('2026-07-01', '2026-07-01')).toEqual({ from: civil('2026-07-01'), to: civil('2026-07-01') })
    expect([entriesSpanNamed('2026-09-30', '2026-07-01'), entriesSpanNamed('2026-07-01', undefined), entriesSpanNamed('2026-02-30', '2026-03-01')]).toEqual([null, null, null])
  })
})
