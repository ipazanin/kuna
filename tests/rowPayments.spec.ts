import { describe, expect, it } from 'vitest'

import { inPickingOrder } from '../src/apps/company/workbook/domain/rowPayments'

describe('inPickingOrder', () => {
  it('lists the payments a record holds first, as they were paid, then the free ones newest first', () => {
    const payment = (key: string, date: string, sequence: number, named: boolean) => ({ key, named, payment: { date, sequence } })
    const choices = [
      payment('free-march', '2026-03-02', 1, false),
      payment('held-april', '2026-04-01', 1, true),
      payment('free-may-first', '2026-05-10', 1, false),
      payment('held-june', '2026-06-01', 1, true),
      payment('free-may-second', '2026-05-10', 2, false),
    ]

    expect(inPickingOrder(choices).map((choice) => choice.key)).toEqual(['held-april', 'held-june', 'free-may-second', 'free-may-first', 'free-march'])
  })
})
