import { describe, expect, it } from 'vitest'

import { changedInvoice } from '../src/apps/company/receivables/domain/invoiceChange'
import { invoiceIdOf } from '../src/apps/company/workbook/domain/invoicesReading'
import type { Invoice } from '../src/apps/company/workbook/domain/workbook'
import { invoiceOf } from './fixtures/billingPlan'
import { civil, euros } from './fixtures/ledger'

const twoLines: Invoice = {
  ...invoiceOf('11-1-26', 3620, '2026-11-02'),
  item: 'Development; Maintenance',
  lines: [
    { description: 'Development', amount: euros(3000), items: ['Monthly Fee'] },
    { description: 'Maintenance', amount: euros(620), items: [] },
  ],
  due: civil('2026-12-02'),
  deliveryPeriod: { from: civil('2026-10-01'), to: civil('2026-10-31') },
  id: invoiceIdOf({ client: 'north', number: '11-1-26' }),
}

describe('an edit of an invoice', () => {
  it('keeps the item, the lines, the amount, the number, the client and the id when only the due date changes', () => {
    const after = changedInvoice(twoLines, { due: civil('2026-12-16') })

    expect(after).toEqual({ ...twoLines, due: civil('2026-12-16') })
  })

  it('leaves no lines on a row that keeps none when only the due date changes', () => {
    const typedInSheet = { ...invoiceOf('9-1-26', 6925, '2026-09-21'), id: invoiceIdOf({ client: 'north', number: '9-1-26' }) }

    const after = changedInvoice(typedInSheet, { due: civil('2026-10-21') })

    expect('lines' in after).toBe(false)
    expect(after).toEqual({ ...typedInSheet, due: civil('2026-10-21') })
  })

  it('clears the due date and the work period it is given as null', () => {
    const after = changedInvoice(twoLines, { due: null, deliveryPeriod: null })

    expect(after.due).toBeNull()
    expect(after.deliveryPeriod).toBeNull()
    expect(after.lines).toEqual(twoLines.lines)
  })

  it('moves the item and the amount with new lines', () => {
    const lines = [{ description: 'Development', amount: euros(3200), items: ['Monthly Fee'] }]

    const after = changedInvoice(twoLines, { lines })

    expect(after.item).toBe('Development')
    expect(after.lines).toEqual(lines)
    expect(after.amount).toBe(euros(3200))
  })

  it('moves the id with a new client or number', () => {
    const after = changedInvoice(twoLines, { number: '12-1-26', client: 'lumen' })

    expect(after.id).toBe(invoiceIdOf({ client: 'lumen', number: '12-1-26' }))
    expect(after.lines).toEqual(twoLines.lines)
  })
})
