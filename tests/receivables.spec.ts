import { describe, expect, it } from 'vitest'

import { AGEING_BUCKETS, ageingOf } from '../src/apps/company/receivables/domain/ageing'
import { daysToPaid } from '../src/apps/company/receivables/domain/daysToPaid'
import { receivablesOf } from '../src/apps/company/receivables/domain/invoiceMatching'
import type { ClientReceivables, Receivables } from '../src/apps/company/receivables/domain/invoiceMatching'
import { INVOICE_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { Category, Client, Invoice } from '../src/apps/company/workbook/domain/workbook'
import { civil, euros, ledger } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'
import { NO_CLIENT_INVOICING } from '../src/apps/company/workbook/domain/workbook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { BUCKET_COLOUR } from '../src/apps/company/workbook/domain/categoryColour'

const NORTH = 'XX00FAKE0000000000000101'
const NORTH_SECOND = 'XX00FAKE0000000000000102'
const SOUTH = 'XX00FAKE0000000000000201'
const STRANGER = 'XX00FAKE0000000000000999'

const CLIENTS: readonly Client[] = [
  { slug: 'north', name: 'North Ltd', ibans: [NORTH, NORTH_SECOND], invoicing: NO_CLIENT_INVOICING },
  { slug: 'south', name: 'South GmbH', ibans: [SOUTH], invoicing: NO_CLIENT_INVOICING },
]

/** Revenue is picked by its role, so the category here is named something else on purpose. */
const CATEGORIES: readonly Category[] = [
  { slug: 'fees', family: 'income', bucket: 'income', colour: BUCKET_COLOUR, roles: ['revenue'], vat: 'none', ownerShare: null },
  { slug: 'revenue', family: 'income', bucket: 'income', colour: BUCKET_COLOUR, roles: [], vat: 'none', ownerShare: null },
  { slug: 'money-back', family: 'income', bucket: 'income', colour: BUCKET_COLOUR, roles: ['client-refund'], vat: 'none', ownerShare: null },
]

let nextRow = 2

function invoice(number: string, amount: number, issued: string, due: string | null = null, client = 'north'): Invoice {
  nextRow += 1
  return { number, client, item: '', amount: euros(amount), issued: civil(issued), due: due === null ? null : civil(due), deliveryPeriod: null, id: recordIdOf(INVOICE_RECORDS, `row-${nextRow}`) }
}

function paid(date: string, amount: number, iban = NORTH): RowSpec {
  return { date, amount, category: 'fees', iban, counterparty: 'Payer' }
}

function match(rows: readonly RowSpec[], invoices: readonly Invoice[], clients: readonly Client[] = CLIENTS): Receivables {
  const transactions = ledger(rows).map((transaction) => {
    const category = CATEGORIES.find((candidate) => candidate.slug === transaction.category)
    return category === undefined ? transaction : { ...transaction, family: category.family, bucket: category.bucket }
  })
  return receivablesOf(transactions, CATEGORIES, invoices, clients)
}

function client(receivables: Receivables, slug: string): ClientReceivables {
  const found = receivables.clients.find((candidate) => candidate.client.slug === slug)
  if (found === undefined) throw new Error(`no ${slug}`)
  return found
}

function states(receivables: ClientReceivables) {
  return receivables.invoices.map((matched) => [matched.invoice.number, matched.status, matched.remaining, matched.received])
}

describe('invoice matching', () => {
  it('fills invoices issued on one day by number, compared as numbers, wherever their rows sit', () => {
    const north = client(match([paid('2026-02-10', 100)], [invoice('10-1-26', 100, '2026-01-31'), invoice('9-1-26', 100, '2026-01-31')]), 'north')

    expect(states(north)).toEqual([
      ['10-1-26', 'outstanding', euros(100), null],
      ['9-1-26', 'paid', euros(0), civil('2026-02-10')],
    ])
  })

  it('fills invoices oldest first and lets a payment reach only invoices issued by its day', () => {
    const north = client(
      match(
        [paid('2026-01-05', 300), paid('2026-02-10', 1000), paid('2026-03-12', 400)],
        [invoice('1', 1000, '2026-01-31'), invoice('2', 600, '2026-02-28')],
      ),
      'north',
    )

    // The January credit lands before any invoice exists, so it is a credit with no invoice. The
    // February one fills invoice 1, and the March one fills 400 of invoice 2.
    expect(states(north)).toEqual([
      ['1', 'paid', euros(0), civil('2026-02-10')],
      ['2', 'partial', euros(200), null],
    ])
    expect([north.outstanding, north.overpaid, north.creditsWithNoInvoice]).toEqual([euros(200), euros(0), euros(300)])
    expect(north.payments.map((payment) => [payment.applied, payment.leftover])).toEqual([
      [euros(0), euros(300)],
      [euros(1000), euros(0)],
      [euros(400), euros(0)],
    ])
  })

  it('lands an overpayment on the newest invoice the payment could reach, and never owes less than nothing', () => {
    const north = client(
      match([paid('2026-02-03', 1070), paid('2026-03-03', 500)], [invoice('1', 1000, '2026-01-31'), invoice('2', 500, '2026-02-28')]),
      'north',
    )

    expect(states(north)).toEqual([
      ['1', 'paid', euros(0), civil('2026-02-03')],
      ['2', 'paid', euros(0), civil('2026-03-03')],
    ])
    expect(north.invoices[0]?.overpayments.map((overpayment) => [overpayment.payment.transaction.date, overpayment.amount])).toEqual([
      [civil('2026-02-03'), euros(70)],
    ])
    expect(north.invoices[1]?.overpayments).toEqual([])
    expect([north.outstanding, north.overpaid, north.creditsWithNoInvoice]).toEqual([euros(0), euros(70), euros(0)])
  })

  it('gives each invoice the payments that went towards it, a payment spanning two invoices in both', () => {
    const north = client(
      match(
        [paid('2026-02-10', 600), paid('2026-03-10', 900)],
        [invoice('1', 1000, '2026-01-31'), invoice('2', 800, '2026-02-28')],
      ),
      'north',
    )

    expect(north.invoices.map((matched) => matched.allocations.map((allocation) => [allocation.payment.transaction.date, allocation.amount]))).toEqual([
      [
        [civil('2026-02-10'), euros(600)],
        [civil('2026-03-10'), euros(400)],
      ],
      [[civil('2026-03-10'), euros(500)]],
    ])
    for (const matched of north.invoices) {
      const allocated = matched.allocations.reduce((total, allocation) => total + allocation.amount, 0)
      expect(allocated).toBe(matched.invoice.amount - matched.remaining)
    }
    expect(north.invoices[0]?.allocations[0]?.payment.drill.filters).toMatchObject({
      period: { preset: 'custom', range: { from: civil('2026-02-10'), to: civil('2026-02-10') } },
      categories: ['fees'],
      amount: { min: euros(600), max: euros(600) },
    })
  })

  it('lists the invoices in the order given, and settles nothing on an invoice of nothing', () => {
    const nothing = invoice('Z', 0, '2026-01-31')
    const north = client(match([paid('2026-02-02', 300)], [nothing, invoice('Y', 200, '2026-01-31'), invoice('X', 300, '2026-01-31')]), 'north')

    expect(states(north)).toEqual([
      ['Z', 'paid', euros(0), null],
      ['Y', 'outstanding', euros(200), null],
      ['X', 'paid', euros(0), civil('2026-02-02')],
    ])
  })

  it('keeps two clients apart by IBAN, reads a client paying from a second account as the same client, and never pools a stranger’s credit', () => {
    const receivables = match(
      [paid('2026-02-01', 400, NORTH_SECOND), paid('2026-02-02', 900, SOUTH), paid('2026-02-03', 250, STRANGER), paid('2026-02-04', 100, '')],
      [invoice('N-1', 1000, '2026-01-31'), invoice('S-1', 900, '2026-01-31', null, 'south')],
    )
    const north = client(receivables, 'north')
    const south = client(receivables, 'south')

    expect(states(north)).toEqual([['N-1', 'partial', euros(600), null]])
    expect(states(south)).toEqual([['S-1', 'paid', euros(0), civil('2026-02-02')]])
    expect(receivables.unattributedCredits.map((credit) => credit.transaction.amount)).toEqual([euros(250), euros(100)])
    expect(north.creditsWithNoInvoice + south.creditsWithNoInvoice).toBe(0)
  })

  it('chooses revenue and client refunds by role, and puts each refund on its client', () => {
    const receivables = match(
      [
        paid('2026-02-01', 1000),
        { date: '2026-02-02', amount: 500, category: 'revenue', iban: NORTH },
        { date: '2026-02-20', amount: -70, category: 'money-back', iban: NORTH },
        { date: '2026-02-21', amount: -30, category: 'money-back', iban: STRANGER },
      ],
      [invoice('1', 1000, '2026-01-31')],
    )
    const north = client(receivables, 'north')

    expect(north.payments).toHaveLength(1)
    expect(north.refunded).toBe(euros(70))
    expect(client(receivables, 'south').refunded).toBe(euros(0))
    expect(receivables.unattributedRefunds.map((refund) => refund.transaction.amount)).toEqual([euros(-30)])
  })

  it('reads every credit as one with no invoice while the register is empty', () => {
    const north = client(match([paid('2026-02-01', 400), paid('2026-03-01', 200)], []), 'north')

    expect([north.outstanding, north.overpaid, north.creditsWithNoInvoice]).toEqual([euros(0), euros(0), euros(600)])
  })

  it('lists a client an invoice names but the clients tab does not, with nothing paid', () => {
    const receivables = match([paid('2026-02-01', 400)], [invoice('E-1', 250, '2026-01-31', null, 'east')])

    expect(states(client(receivables, 'east'))).toEqual([['E-1', 'outstanding', euros(250), null]])
    expect(client(receivables, 'east').client.ibans).toEqual([])
  })
})

describe('ageing', () => {
  it('counts from the due date, else the issue date, and keeps what is not due yet apart', () => {
    const north = client(
      match(
        [],
        [
          invoice('1', 100, '2026-01-05'),
          invoice('2', 200, '2026-06-01', '2026-07-01'),
          invoice('3', 300, '2026-08-01', '2026-09-01'),
          invoice('4', 400, '2026-09-20', '2026-10-20'),
          invoice('5', 500, '2026-09-25'),
        ],
      ),
      'north',
    )

    const aged = ageingOf(north.invoices, civil('2026-10-10'))

    expect(Object.keys(aged)).toEqual([...AGEING_BUCKETS])
    // 278, 101 and 39 days past the date each counts from. Invoice 4 is due in ten days and 5 is 15 days old.
    expect(aged).toEqual({
      'not-due': euros(400),
      'days-0-30': euros(500),
      'days-31-60': euros(300),
      'days-61-90': euros(0),
      'days-over-90': euros(300),
    })
  })

  it('leaves out what is paid and ages the remainder of a part-paid invoice', () => {
    const north = client(match([paid('2026-02-01', 1150)], [invoice('1', 1000, '2026-01-01'), invoice('2', 400, '2026-01-02', '2026-02-02')]), 'north')

    expect(ageingOf(north.invoices, civil('2026-03-15'))['days-31-60']).toBe(euros(250))
  })
})

describe('days to get paid', () => {
  const north = client(
    match(
      [paid('2026-02-05', 1100), paid('2026-03-10', 500), paid('2026-06-20', 700)],
      [invoice('1', 1100, '2026-01-31'), invoice('2', 500, '2026-02-28'), invoice('3', 700, '2026-03-31'), invoice('4', 300, '2026-06-30')],
    ),
    'north',
  )

  it('takes the median over the invoices paid in the range, and the mean beside it', () => {
    // 5, 10 and 81 days.
    expect(daysToPaid(north.invoices, null)).toEqual({ days: [5, 10, 81], median: 10, mean: 32 })
    expect(daysToPaid(north.invoices, { from: civil('2026-03-01'), to: civil('2026-12-31') })).toEqual({ days: [10, 81], median: 45.5, mean: 45.5 })
  })

  it('has no figure when nothing was paid in the range', () => {
    expect(daysToPaid(north.invoices, { from: civil('2026-07-01'), to: civil('2026-07-31') })).toEqual({ days: [], median: null, mean: null })
  })
})
