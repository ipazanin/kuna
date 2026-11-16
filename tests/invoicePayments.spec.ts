import { describe, expect, it } from 'vitest'

import { proposedInvoicePayments } from '../src/apps/company/receivables/domain/invoicePayments'
import { BUCKET_COLOUR } from '../src/apps/company/workbook/domain/categoryColour'
import { INVOICE_RECORDS, ITEM_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { LedgerEntry } from '../src/apps/company/workbook/domain/ledgerReading'
import { NO_CLIENT_INVOICING } from '../src/apps/company/workbook/domain/workbook'
import type { Category, Client, Invoice, Transaction } from '../src/apps/company/workbook/domain/workbook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros, ledger } from './fixtures/ledger'
import type { RowSpec } from './fixtures/ledger'

const NORTH = 'XX00FAKE0000000000000101'
const STRANGER = 'XX00FAKE0000000000000999'

const CLIENTS: readonly Client[] = [{ slug: 'north', name: 'North Ltd', ibans: [NORTH], invoicing: NO_CLIENT_INVOICING }]

const CATEGORIES: readonly Category[] = [
  { slug: 'fees', family: 'income', bucket: 'income', colour: BUCKET_COLOUR, roles: ['revenue'], vat: 'none', ownerShare: null },
  { slug: 'equipment', family: 'operating', bucket: 'operating', colour: BUCKET_COLOUR, roles: [], vat: 'none', ownerShare: null },
]

function invoice(number: string, amount: number, issued: string): Invoice {
  return { number, client: 'north', item: '', amount: euros(amount), issued: civil(issued), due: null, deliveryPeriod: null, id: recordIdOf(INVOICE_RECORDS, number) }
}

const INVOICES = [invoice('1-1-26', 800, '2026-01-10'), invoice('1-2-26', 500, '2026-02-10'), invoice('1-3-26', 300, '2026-03-10')]

/** New ledger rows, given oldest first and returned newest first as an import adds them, each with a row id of its own. */
function entries(rows: readonly RowSpec[]): LedgerEntry[] {
  return ledger(rows).map((row, index) => ({ ...row, rowId: `new-${rows.length - index}` }))
}

function credit(date: string, amount: number, iban = NORTH, category = 'fees', description = ''): RowSpec {
  return { date, amount, category, iban, counterparty: 'North Ltd', description }
}

function described(date: string, amount: number, description: string): RowSpec {
  return credit(date, amount, NORTH, 'fees', description)
}

/** What each new row pays, by its row id: each item's amount and the number of the invoice it pays, or null. */
function proposed(booked: readonly Transaction[], added: readonly RowSpec[]) {
  const payments = proposedInvoicePayments({ transactions: booked, categories: CATEGORIES, invoices: INVOICES, clients: CLIENTS }, entries(added))
  return payments.map((payment) => [payment.row, payment.items.map((item) => [item.amount, INVOICES.find((held) => held.id === item.of)?.number ?? null])])
}

describe('which invoices the new rows of an import pay', () => {
  it.each([
    ['an exact amount closes the invoice it equals', [credit('2026-04-01', 500)], [['new-1', [[euros(500), '1-2-26']]]]],
    [
      'an amount no invoice equals fills the oldest first, the rest paying none',
      [credit('2026-04-01', 1000)],
      [
        [
          'new-1',
          [
            [euros(800), '1-1-26'],
            [euros(200), '1-2-26'],
          ],
        ],
      ],
    ],
    [
      'a credit reaches only the invoices issued by its day',
      [credit('2026-02-01', 900)],
      [
        [
          'new-1',
          [
            [euros(100), null],
            [euros(800), '1-1-26'],
          ],
        ],
      ],
    ],
    [
      'two credits of one import, each closing the invoices it adds up to',
      [credit('2026-04-01', 1100), credit('2026-04-02', 500)],
      [
        [
          'new-1',
          [
            [euros(800), '1-1-26'],
            [euros(300), '1-3-26'],
          ],
        ],
        ['new-2', [[euros(500), '1-2-26']]],
      ],
    ],
    ['a credit from an IBAN no client names pays none', [credit('2026-04-01', 500, STRANGER)], []],
    ['a credit filed out of revenue pays none', [credit('2026-04-01', 500, NORTH, 'equipment')], []],
  ] as const)('%s', (_case, added, expected) => {
    expect(proposed([], added)).toEqual(expected)
  })

  it('puts a credit only on what the booked rows leave open', () => {
    const booked = ledger([credit('2026-01-20', 800)])

    expect(proposed(booked, [credit('2026-04-01', 500)])).toEqual([['new-1', [[euros(500), '1-2-26']]]])
  })

  it.each([
    ['the invoice it names, over the one its amount equals', described('2026-04-01', 500, 'Invoice 1-1-26'), [[euros(500), '1-1-26']]],
    [
      'each invoice it names, over the one their sum equals',
      described('2026-04-01', 800, 'Invoices 1-2-26 and 1-3-26'),
      [
        [euros(500), '1-2-26'],
        [euros(300), '1-3-26'],
      ],
    ],
    [
      'the invoice it names first, the rest by the amount rule',
      described('2026-04-01', 500, 'Invoice 1-3-26'),
      [
        [euros(200), '1-1-26'],
        [euros(300), '1-3-26'],
      ],
    ],
    ['the invoice it names in Croatian, with a full stop after the number', described('2026-04-01', 500, 'Plaćanje po računu br. 1-1-26.'), [[euros(500), '1-1-26']]],
    ['an invoice it names that is issued after its day, since a client may pay ahead', described('2026-02-01', 300, 'Invoice 1-3-26'), [[euros(300), '1-3-26']]],
    ['by its amount when the number it names is part of a longer one', described('2026-04-01', 500, 'Invoice 11-1-26'), [[euros(500), '1-2-26']]],
    ['by its amount when the number it names is part of a longer one with a dash', described('2026-04-01', 500, 'Invoice 2-1-1-26'), [[euros(500), '1-2-26']]],
    ['by its amount when it names no invoice', described('2026-04-01', 500, 'Monthly fee'), [[euros(500), '1-2-26']]],
    ['the invoice its payment reference names', { ...credit('2026-04-01', 500), reference: 'HR00 1-1-26' }, [[euros(500), '1-1-26']]],
  ] as const)('a credit whose description or reference names an invoice pays %s', (_case, added, items) => {
    expect(proposed([], [added])).toEqual([['new-1', items]])
  })

  it('puts a credit by its amount when the invoice it names is paid already', () => {
    const booked = ledger([credit('2026-01-20', 800)])

    expect(proposed(booked, [described('2026-04-01', 500, 'Invoice 1-1-26')])).toEqual([['new-1', [[euros(500), '1-2-26']]]])
  })

  it('keeps the row’s own item id on its first item', () => {
    const [payment] = proposedInvoicePayments({ transactions: [], categories: CATEGORIES, invoices: INVOICES, clients: CLIENTS }, entries([credit('2026-04-01', 1000)]))

    expect(payment!.items.map((item) => item.id)).toEqual([recordIdOf(ITEM_RECORDS, 'new-1'), recordIdOf(ITEM_RECORDS, 'new-1-1')])
  })
})
