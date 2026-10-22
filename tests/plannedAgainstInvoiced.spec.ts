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
  it('takes the rows of one day by item, amount and description, wherever they sit on the tab', () => {
    const plan = [
      planRow('Monthly Fee', '2026-03-31', 5000, 'north', 'March fee'),
      planRow('Hotel', '2026-03-31', 300, 'north', 'Second night'),
      planRow('Hotel', '2026-03-31', 200, 'north', 'First night'),
    ]

    expect(billedBy(matchOf(plan, []))).toEqual([
      ['First night', [], euros(200)],
      ['Second night', [], euros(300)],
      ['March fee', [], euros(5000)],
    ])
  })

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

  it('takes the row an invoice equals before an older one, so a ticket left off one invoice goes to the next', () => {
    const plan = [
      planRow('Plane Tickets', '2026-03-07', 240, 'north', 'March ticket'),
      planRow('Monthly Fee', '2026-03-31', 5000, 'north', 'March fee'),
      planRow('Monthly Fee', '2026-04-30', 5000, 'north', 'April fee'),
    ]
    const march = invoiceOf('3-1-26', 5000, '2026-03-20')
    const april = invoiceOf('4-1-26', 5240, '2026-04-20')
    const match = matchOf(plan, [april, march])

    expect(billedBy(match)).toEqual([
      ['March ticket', ['4-1-26'], 0],
      ['March fee', ['3-1-26'], 0],
      ['April fee', ['4-1-26'], 0],
    ])
    expect(match.months[0]?.items[1]?.invoices.map((share) => share.amount)).toEqual([euros(5000)])
  })

  it('fills rows oldest first when no set of open rows equals the invoice', () => {
    const plan = [
      planRow('Plane Tickets', '2026-03-07', 240, 'north', 'March ticket'),
      planRow('Monthly Fee', '2026-03-31', 5000, 'north', 'March fee'),
      planRow('Monthly Fee', '2026-04-30', 5000, 'north', 'April fee'),
    ]
    const match = matchOf(plan, [invoiceOf('3-1-26', 4900, '2026-03-20'), invoiceOf('4-1-26', 5340, '2026-04-20')])

    expect(billedBy(match)).toEqual([
      ['March ticket', ['3-1-26'], 0],
      ['March fee', ['3-1-26', '4-1-26'], 0],
      ['April fee', ['4-1-26'], 0],
    ])
    expect(match.months[0]?.items[1]?.invoices.map((share) => share.amount)).toEqual([euros(4660), euros(340)])
  })

  it('lets a fee billed ahead take next month’s fee it equals, not an older bonus of that month', () => {
    const plan = [
      planRow('Monthly Fee', '2026-04-30', 5000, 'north', 'April fee'),
      planRow('Bonus', '2026-05-15', 6000, 'north', 'Bonus'),
      planRow('Monthly Fee', '2026-05-31', 5000, 'north', 'May fee'),
    ]
    const match = matchOf(plan, [invoiceOf('4-1-26', 5000, '2026-04-20'), invoiceOf('5-1-26', 5000, '2026-04-26'), invoiceOf('6-1-26', 6000, '2026-06-19')])

    expect(billedBy(match)).toEqual([
      ['April fee', ['4-1-26'], 0],
      ['Bonus', ['6-1-26'], 0],
      ['May fee', ['5-1-26'], 0],
    ])
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

  it('keeps a rounding cent on the invoice that billed it, above the plan, instead of letting it ripple into later months', () => {
    // The bonus row's formula reads 4,666.66 and the invoices billed 4,666.67 of it.
    const plan = [
      planRow('Monthly Fee', '2026-04-30', 5000, 'north', 'April fee'),
      planRow('Bonus', '2026-05-15', 4666.66, 'north', 'Bonus'),
      planRow('Plane Tickets', '2026-05-25', 210.4, 'north', 'May ticket'),
      planRow('Monthly Fee', '2026-05-31', 5000, 'north', 'May fee'),
      planRow('Contractor', '2026-06-08', 1200, 'north', 'June contractor'),
      planRow('Monthly Fee', '2026-06-30', 5000, 'north', 'June fee'),
      planRow('Monthly Fee', '2026-07-31', 5000, 'north', 'July fee'),
      planRow('Monthly Fee', '2026-08-31', 5000, 'north', 'August fee'),
      planRow('Subscription', '2026-08-31', 150, 'north', 'August subscription'),
      planRow('Plane Tickets', '2026-09-10', 98.3, 'north', 'September ticket'),
      planRow('Monthly Fee', '2026-09-30', 5000, 'north', 'September fee'),
      planRow('Subscription', '2026-09-30', 150, 'north', 'September subscription'),
      planRow('Monthly Fee', '2026-10-31', 5000, 'north', 'October fee'),
      planRow('Subscription', '2026-10-31', 150, 'north', 'October subscription'),
    ]
    const invoices = [
      invoiceOf('4-1-26', 5000, '2026-04-20'),
      invoiceOf('5-1-26', 5000, '2026-04-26'),
      // The bonus at 4,666.67, the ticket, the contractor and June's fee.
      invoiceOf('6-1-26', 11077.07, '2026-06-19'),
      invoiceOf('7-1-26', 5000, '2026-07-20'),
      invoiceOf('8-1-26', 5150, '2026-08-20'),
      invoiceOf('9-1-26', 5248.3, '2026-09-21'),
    ]
    const match = matchOf(plan, invoices)

    expect(billedBy(match)).toEqual([
      ['April fee', ['4-1-26'], 0],
      ['Bonus', ['6-1-26'], 0],
      ['May ticket', ['6-1-26'], 0],
      ['May fee', ['5-1-26'], 0],
      ['June contractor', ['6-1-26'], 0],
      ['June fee', ['6-1-26'], 0],
      ['July fee', ['7-1-26'], 0],
      ['August fee', ['8-1-26'], 0],
      ['August subscription', ['8-1-26'], 0],
      ['September ticket', ['9-1-26'], 0],
      ['September fee', ['9-1-26'], 0],
      ['September subscription', ['9-1-26'], 0],
      ['October fee', [], euros(5000)],
      ['October subscription', [], euros(150)],
    ])
    expect(match.withoutPlan.map((share) => [share.invoice.number, share.amount])).toEqual([['6-1-26', euros(0.01)]])
  })

  it('lets a remainder of one euro or more bill the next month ahead, and keeps a smaller one above the plan', () => {
    const plan = [planRow('Monthly Fee', '2026-03-31', 5000, 'north', 'March fee'), planRow('Monthly Fee', '2026-04-30', 5000, 'north', 'April fee')]

    expect(billedBy(matchOf(plan, [invoiceOf('3-1-26', 5001, '2026-03-20')]))).toEqual([
      ['March fee', ['3-1-26'], 0],
      ['April fee', ['3-1-26'], euros(4999)],
    ])
    const short = matchOf(plan, [invoiceOf('3-1-26', 5000.99, '2026-03-20')])
    expect(billedBy(short)).toEqual([
      ['March fee', ['3-1-26'], 0],
      ['April fee', [], euros(5000)],
    ])
    expect(short.withoutPlan.map((share) => [share.invoice.number, share.amount])).toEqual([['3-1-26', euros(0.99)]])
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
