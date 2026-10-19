import { describe, expect, it } from 'vitest'

import { plannedAgainstInvoiced } from '../src/features/billingPlan/domain/plannedAgainstInvoiced'
import type { ClientBillingMatch } from '../src/features/billingPlan/domain/plannedAgainstInvoiced'
import { sumMoney } from '../src/shared/money/money'
import type { BillingItem } from '../src/features/workbook/domain/billingPlan'
import type { Invoice } from '../src/features/workbook/domain/workbook'
import { euros } from './fixtures/ledger'
import { invoiceOf, planRow } from './fixtures/billingPlan'

function matchOf(plan: readonly BillingItem[], invoices: readonly Invoice[], client = 'north'): ClientBillingMatch {
  const match = plannedAgainstInvoiced(plan, invoices).find((candidate) => candidate.client === client)
  if (match === undefined) throw new Error(`no match for ${client}`)
  return match
}

/** The rows not invoiced in full, oldest first. */
function notInvoiced(match: ClientBillingMatch) {
  return match.months.flatMap((month) => month.items).filter((item) => item.open > 0)
}

/** Each row's description with the invoice numbers that billed it and what is still open. */
function billedBy(match: ClientBillingMatch): [string, string[], number][] {
  return match.months.flatMap((month) => month.items.map((item): [string, string[], number] => [item.row.description, item.invoices.map((share) => share.invoice.number), item.open]))
}

describe('plannedAgainstInvoiced', () => {
  it('lets one invoice bill a month left over from before, the month it was issued in and a bonus', () => {
    const plan = [
      planRow('Hotel', '2025-12-10', 480.2, 'north', 'December hotel'),
      planRow('Monthly Fee', '2025-12-31', 5000, 'north', 'December fee'),
      planRow('Bonus', '2026-01-01', 3000, 'north', 'Bonus for 2025'),
      planRow('Monthly Fee', '2026-01-31', 5200, 'north', 'January fee'),
    ]
    const match = matchOf(plan, [invoiceOf('1-1-26', 13680.2, '2026-01-21')])

    expect(billedBy(match)).toEqual([
      ['December hotel', ['1-1-26'], 0],
      ['December fee', ['1-1-26'], 0],
      ['Bonus for 2025', ['1-1-26'], 0],
      ['January fee', ['1-1-26'], 0],
    ])
    expect(match.months.map((month) => [month.month, month.planned, month.invoiced, month.open])).toEqual([
      ['2025-12', euros(5480.2), euros(5480.2), 0],
      ['2026-01', euros(8200), euros(8200), 0],
    ])
    expect(notInvoiced(match)).toEqual([])
    expect(match.withoutPlan).toEqual([])
  })

  it('fills rows oldest first, so a ticket left off one invoice is billed by it and the fee finishes on the next', () => {
    const plan = [
      planRow('Plane Tickets', '2026-03-07', 240, 'north', 'March ticket'),
      planRow('Monthly Fee', '2026-03-31', 5000, 'north', 'March fee'),
      planRow('Monthly Fee', '2026-04-30', 5000, 'north', 'April fee'),
    ]
    const march = invoiceOf('3-1-26', 5000, '2026-03-20')
    const april = invoiceOf('4-1-26', 5240, '2026-04-20')
    const match = matchOf(plan, [april, march])

    expect(billedBy(match)).toEqual([
      ['March ticket', ['3-1-26'], 0],
      ['March fee', ['3-1-26', '4-1-26'], 0],
      ['April fee', ['4-1-26'], 0],
    ])
    expect(match.months[0]?.items[1]?.invoices.map((share) => share.amount)).toEqual([euros(4760), euros(240)])
  })

  it('lets an invoice bill next month’s fee ahead, and no row after that month', () => {
    const plan = [
      planRow('Monthly Fee', '2026-05-31', 5000, 'north', 'May fee'),
      planRow('Monthly Fee', '2026-06-30', 5000, 'north', 'June fee'),
    ]
    const match = matchOf(plan, [invoiceOf('5-1-26', 7000, '2026-04-26')])

    expect(billedBy(match)).toEqual([
      ['May fee', ['5-1-26'], 0],
      ['June fee', [], euros(5000)],
    ])
    expect(match.withoutPlan.map((share) => [share.invoice.number, share.amount])).toEqual([['5-1-26', euros(2000)]])
  })

  it('leaves part of a row open, and lists every row not invoiced in full', () => {
    const plan = [
      planRow('Monthly Fee', '2026-08-31', 5000, 'north', 'August fee'),
      planRow('Subscription', '2026-08-31', 200, 'north', 'August subscription'),
      planRow('Monthly Fee', '2026-09-30', 5000, 'north', 'September fee'),
    ]
    const match = matchOf(plan, [invoiceOf('8-1-26', 5100, '2026-08-20')])

    expect(notInvoiced(match).map((item) => [item.row.description, item.invoiced, item.open])).toEqual([
      ['August subscription', euros(100), euros(100)],
      ['September fee', 0, euros(5000)],
    ])
    expect(match.months.map((month) => [month.month, month.open])).toEqual([
      ['2026-08', euros(100)],
      ['2026-09', euros(5000)],
    ])
  })

  it('does not carry what an invoice could not place over to later rows', () => {
    const plan = [planRow('Monthly Fee', '2026-01-31', 5000), planRow('Monthly Fee', '2026-02-28', 5000)]
    const match = matchOf(plan, [invoiceOf('12-1-25', 5500, '2025-12-30'), invoiceOf('2-1-26', 5000, '2026-02-20')])

    expect(match.withoutPlan.map((share) => [share.invoice.number, share.amount])).toEqual([['12-1-25', euros(500)]])
    expect(billedBy(match)).toEqual([
      ['', ['12-1-25'], 0],
      ['', ['2-1-26'], 0],
    ])
  })

  it('places nothing of a credit note, which counts in full as invoiced with no plan row', () => {
    const plan = [planRow('Monthly Fee', '2026-01-31', 5000)]
    const match = matchOf(plan, [invoiceOf('CN-1', -300, '2026-01-25'), invoiceOf('1-1-26', 5000, '2026-01-26')])

    expect(match.withoutPlan.map((share) => [share.invoice.number, share.amount])).toEqual([['CN-1', euros(-300)]])
    expect(notInvoiced(match)).toEqual([])
  })

  it('keeps clients apart, with one that has only invoices and one that has only rows', () => {
    const matches = plannedAgainstInvoiced(
      [planRow('Monthly Fee', '2026-01-31', 5000, 'north'), planRow('Workshop', '2026-02-15', 800, 'west')],
      [invoiceOf('1-1-26', 5000, '2026-01-30', 'north'), invoiceOf('S-1', 1200, '2026-02-01', 'south')],
    )

    expect(matches.map((match) => [match.client, notInvoiced(match).length, sumMoney(match.withoutPlan.map((share) => share.amount))])).toEqual([
      ['north', 0, 0],
      ['south', 0, euros(1200)],
      ['west', 1, 0],
    ])
  })

  it('accounts for every invoice: what the rows took and what no row took add up to the invoices', () => {
    const plan = [
      planRow('Part Time Fee', '2025-04-30', 1400),
      planRow('Monthly Fee', '2025-05-31', 5000),
      planRow('Plane Tickets', '2025-06-20', 150.4),
      planRow('Monthly Fee', '2025-06-30', 5000),
      planRow('Monthly Fee', '2025-07-31', 5000),
    ]
    const invoices = [invoiceOf('1-1-25', 6550.4, '2025-06-30'), invoiceOf('2-1-25', 7311.25, '2025-07-31'), invoiceOf('3-1-25', 3000, '2025-08-31')]
    const match = matchOf(plan, invoices)

    const placed = sumMoney(match.months.map((month) => month.invoiced))
    const unplaced = sumMoney(match.withoutPlan.map((share) => share.amount))
    expect(placed + unplaced).toBe(sumMoney(invoices.map((invoice) => invoice.amount)))
    expect(sumMoney(match.months.map((month) => month.open))).toBe(sumMoney(plan.map((row) => row.amount)) - placed)
  })
})
