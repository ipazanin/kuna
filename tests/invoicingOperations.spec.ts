import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { companyAssistant } from '../src/apps/company/assistant/companyAssistant'
import { INVOICING_OPERATIONS } from '../src/apps/company/assistant/operations/invoicingOperations'
import { words as companyWords } from '../src/apps/company/assistant/operations/words'
import { words as invoicingWords } from '../src/apps/company/assistant/operations/invoicingWords'
import { HR_DOO_ASSISTANT } from '../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { COMPANY_APP } from '../src/apps/company/workbook/domain/companyApp'
import { installedSchema } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookRecords } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { filledFields } from '../src/shared/storage/domain/recordFields'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { companyChat, deskPorts } from './fixtures/companyDesk'
import type { CompanyChat } from './fixtures/companyDesk'
import { browserHarness, forgetCaches } from './fixtures/writeBack'
import { expectCountsOfChanges } from './fixtures/cardCounts'
import { stepOf } from './fixtures/operationSteps'
import { exampleInput } from './fixtures/exampleInput'
import { NO_RATES } from '../src/shared/money/rateBook'
import { civil, euros } from './fixtures/ledger'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

/** The fake company kept in this browser, with one client nothing names yet. */
function companyDocument() {
  const records = fakeWorkbookRecords('browser', fakeStaffOf('five-employees'))
  return newDocument(
    COMPANY_APP,
    installedSchema(),
    { ...records, client: [...(records['client'] ?? []), filledFields({ client: 'quiet', name: 'Quiet Ltd', iban: 'DE89370400440532013000' })] },
    '2026-11-07T09:00:00.000Z',
  )
}

interface Desk extends CompanyChat {
  readonly store: WorkbookStore<CompanyBooks>
}

async function desk(): Promise<Desk> {
  const { store } = await browserHarness<CompanyBooks>(used, companyDocument())
  return { ...companyChat(store, deskPorts(), false), store }
}

const bookOf = ({ store }: Desk) => store.state.workbook!

/** The records of each kind, in no order, as Undo puts a deleted record back at the end of its kind. */
function heldRecords({ store }: Desk): string {
  return JSON.stringify(
    Object.entries(store.state.records!).map(([kind, read]) => [kind, JSON.stringify(read).length, ...('records' in read ? read.records.map((stored) => JSON.stringify(stored.record)).sort() : [])]),
  )
}

/** The record each example names, by the name it gives it, as the chat's ref of it resolves. */
function exampleRecords(desk: Desk): Readonly<Record<string, string>> {
  const book = bookOf(desk)
  return {
    client: 'northwind',
    'client-unused': 'quiet',
    invoice: book.invoices[0]!.id,
    'billing-item': book.billingPlan[0]!.id,
  }
}

describe('every invoicing operation', () => {
  it.each(INVOICING_OPERATIONS.operations.map((operation) => [operation.name, operation] as const))(
    'has an example that passes the checks of the file, and one Undo takes it back: %s',
    async (_name, operation) => {
      const company = await desk()
      const before = heldRecords(company)

      const answer = await company.propose([{ op: operation.name, input: exampleInput(operation, company, exampleRecords(company)) }])

      expect(answer.isError, answer.text).toBe(false)
      const card = company.cards[0]!
      expectCountsOfChanges(card!)
      expect(card.undoable).toBe(true)
      expect(card.outside).toEqual([])
      expect(card.groups.flatMap((group) => group.lines).length).toBeGreaterThan(0)
      const done = await company.accept()
      expect(done.kind).toBe('done')
      if (done.kind !== 'done') return
      expect((await done.undo!()).kind).toBe('undone')
      expect(heldRecords(company)).toBe(before)
    },
  )
})

describe('the invoices register', () => {
  it('refuses a due day before the issue day and a work period with one end, as the invoice dialog does', async () => {
    const company = await desk()
    const client = company.ref('client', 'northwind')
    const invoice = { number: '99-1-26', client, lines: [{ text: 'Consulting', amount: 100, items: [] }], issued: '2026-10-31', due: null, periodFrom: null, periodTo: null, paidBy: [] }

    const late = await company.propose([{ op: 'add-invoice', input: { ...invoice, due: '2026-10-01' } }])
    const oneEnd = await company.propose([{ op: 'add-invoice', input: { ...invoice, periodFrom: '2026-10-01' } }])
    const nothing = await company.propose([{ op: 'add-invoice', input: { ...invoice, lines: [{ text: 'Consulting', amount: 0, items: [] }] } }])

    expect(late.isError).toBe(true)
    expect(late.text).toContain('due day')
    expect(oneEnd.text).toContain('both days')
    expect(nothing.isError).toBe(true)
  })

  it('refuses a number already on the register, whatever the client', async () => {
    const company = await desk()
    const taken = bookOf(company).invoices[0]!

    const answer = await company.propose([
      stepOf(INVOICING_OPERATIONS.operations, 'add-invoice', { number: taken.number, client: company.ref('client', 'quiet'), lines: [{ text: 'Again', amount: 10, items: [] }], issued: '2026-10-31' }),
    ])

    expect(answer.isError).toBe(true)
  })

  it('adds a client and its first invoice on one card, the invoice naming the client by its $ name', async () => {
    const company = await desk()

    const answer = await company.propose([
      stepOf(
        INVOICING_OPERATIONS.operations,
        'add-client',
        {
          client: 'acme',
          name: 'Acme Ltd',
          ibans: 'HR1210010051863000160',
          address: '',
          country: '',
          taxId: '',
          invoiceMail: 'billing@acme.example',
          mailLanguage: '',
          reverseCharge: 'no',
          lines: [],
        },
        '$acme',
      ),
      stepOf(INVOICING_OPERATIONS.operations, 'add-invoice', { number: 'A-1', client: '$acme', lines: [{ text: 'Setup', amount: 500, items: [] }], issued: '2026-11-02' }),
    ])

    expect(answer.isError, answer.text).toBe(false)
    const client = company.cards[0]!.groups.find((group) => group.noun.en.one === 'client')!.lines[0]!
    expect(client.fields.filter((field) => field.warns).map((field) => field.after)).toEqual(['HR1210010051863000160', 'billing@acme.example'])
    expect((await company.accept()).kind).toBe('done')
    expect(bookOf(company).invoices.some((invoice) => invoice.client === 'acme' && invoice.number === 'A-1')).toBe(true)
  })

  it('refuses to delete a client invoices name', async () => {
    const company = await desk()

    const answer = await company.propose([stepOf(INVOICING_OPERATIONS.operations, 'delete-client', { client: company.ref('client', 'lumen') })])

    expect(answer.isError).toBe(true)
  })
})

describe('the lines of an invoice', () => {
  const twoLines = [
    { text: 'Software development', amount: 3000, items: ['Development'] },
    { text: 'Maintenance in November 2026', amount: 620, items: ['Hosting', 'Support'] },
  ]

  async function twoLineInvoice() {
    const company = await desk()
    const client = company.ref('client', 'northwind')
    await company.propose([{ op: 'add-invoice', input: { number: '99-1-26', client, lines: twoLines, issued: '2026-11-30', due: null, periodFrom: null, periodTo: null, paidBy: [] } }])
    expect((await company.accept()).kind).toBe('done')
    const held = bookOf(company).invoices.find((invoice) => invoice.number === '99-1-26')!
    return { company, held }
  }

  it('adds an invoice whose amount is the total of its lines and whose item joins their texts', async () => {
    const { held } = await twoLineInvoice()

    expect(held).toMatchObject({
      item: 'Software development; Maintenance in November 2026',
      amount: euros(3620),
      lines: [
        { description: 'Software development', amount: euros(3000), items: ['Development'] },
        { description: 'Maintenance in November 2026', amount: euros(620), items: ['Hosting', 'Support'] },
      ],
    })
  })

  it('keeps both lines of a two-line invoice on a change of its due date only', async () => {
    const { company, held } = await twoLineInvoice()
    const unchanged = { invoice: company.ref('invoice', held.id), number: null, client: null, lines: null, issued: null, due: null, periodFrom: null, periodTo: null, paid: 'keep', paidBy: [] }

    await company.propose([{ op: 'change-invoice', input: { ...unchanged, due: '2026-12-31' } }])
    expect((await company.accept()).kind).toBe('done')

    expect(bookOf(company).invoices.find((invoice) => invoice.id === held.id)).toEqual({ ...held, due: civil('2026-12-31') })
  })

  it('puts new lines in place of the old ones, and the amount follows them', async () => {
    const { company, held } = await twoLineInvoice()
    const unchanged = { invoice: company.ref('invoice', held.id), number: null, client: null, lines: null, issued: null, due: null, periodFrom: null, periodTo: null, paid: 'keep', paidBy: [] }

    await company.propose([{ op: 'change-invoice', input: { ...unchanged, lines: [twoLines[0], { text: 'Maintenance', amount: 600, items: [] }] } }])
    expect((await company.accept()).kind).toBe('done')

    expect(bookOf(company).invoices.find((invoice) => invoice.id === held.id)).toMatchObject({ item: 'Software development; Maintenance', amount: euros(3600) })
  })

  it('refuses a line without a text, as the invoice dialog does', async () => {
    const { company, held } = await twoLineInvoice()
    const unchanged = { invoice: company.ref('invoice', held.id), number: null, client: null, lines: null, issued: null, due: null, periodFrom: null, periodTo: null, paid: 'keep', paidBy: [] }

    const answer = await company.propose([{ op: 'change-invoice', input: { ...unchanged, lines: [{ text: ' ', amount: 600, items: [] }] } }])

    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Every line needs a description.')
  })
})

describe('the payments that pay an invoice', () => {
  /** An invoice the fake books hold a payment on, with the items that pay it. */
  function paidInvoice(company: Desk) {
    const { store } = company
    const items = recordsOf(store.state.records!.items)
    const invoice = bookOf(company).invoices.find((held) => items.some((item) => item.invoice === held.id))!
    return { invoice, paying: items.filter((item) => item.invoice === invoice.id) }
  }

  it('takes the payments off an invoice on a card that names the invoice each item comes off, and places them again', async () => {
    const company = await desk()
    const { invoice, paying } = paidInvoice(company)
    const change = (paidBy: readonly string[]) => stepOf(INVOICING_OPERATIONS.operations, 'change-invoice', { invoice: company.ref('invoice', invoice.id), paid: 'set', paidBy })

    const answer = await company.propose([change([])])

    expect(answer.isError, answer.text).toBe(false)
    const fields = company.cards[0]!.groups.flatMap((group) => group.lines.flatMap((line) => line.fields)).filter((field) => field.name === companyWords.fields.invoice)
    expect(fields.map((field) => [field.before, field.after])).toEqual(paying.map(() => [invoice.number, null]))
    expect((await company.accept()).kind).toBe('done')
    expect(recordsOf(company.store.state.records!.items).filter((item) => item.invoice === invoice.id)).toEqual([])

    const again = await company.propose([change(paying.map((item) => company.ref('item', item.id)))])

    expect(again.isError, again.text).toBe(false)
    expect((await company.accept()).kind).toBe('done')
    expect(
      recordsOf(company.store.state.records!.items)
        .filter((item) => item.invoice === invoice.id)
        .map((item) => item.amount),
    ).toEqual(paying.map((item) => item.amount))
  })

  it('refuses a payment the invoice dialog would not offer, such as a cost', async () => {
    const company = await desk()
    const { invoice } = paidInvoice(company)
    const cost = recordsOf(company.store.state.records!.items).find((item) => item.amount < 0)!

    const answer = await company.propose([
      stepOf(INVOICING_OPERATIONS.operations, 'change-invoice', { invoice: company.ref('invoice', invoice.id), paid: 'set', paidBy: [company.ref('item', cost.id)] }),
    ])

    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Each paidBy item is a revenue credit')
  })
})

describe('the billing plan', () => {
  it("fills the year as the Plan tab's fill does, and Undo takes every row back", async () => {
    const company = await desk()
    const rows = bookOf(company).billingPlan.length

    await company.propose([stepOf(INVOICING_OPERATIONS.operations, 'fill-billing-year', { year: 2027 })])
    const done = await company.accept()

    expect(done.kind).toBe('done')
    expect(bookOf(company).billingPlan.length).toBe(rows + 24)
    if (done.kind === 'done') await done.undo!()
    expect(bookOf(company).billingPlan.length).toBe(rows)
  })
})

describe('the invoicing terms and the money format, through set-setting', () => {
  it('warns on the IBAN an invoice prints, and refuses one that is not an IBAN', async () => {
    const company = await desk()

    await company.propose([{ op: 'set-setting', input: { key: 'invoice_iban', value: 'HR1210010051863000160' } }])
    const wrong = await company.propose([{ op: 'set-setting', input: { key: 'invoice_iban', value: 'HR00' } }])

    const field = company.cards[0]!.groups[0]!.lines[0]!.fields.find((candidate) => candidate.after === 'HR1210010051863000160')!
    expect(field.warns).toBe(true)
    expect(wrong.isError).toBe(true)
  })

  it('never sets the invoice folder, which only the picker does', async () => {
    const company = await desk()

    const answer = await company.propose([{ op: 'set-setting', input: { key: 'invoice_folder_id', value: 'a-folder' } }])

    expect(answer.isError).toBe(true)
    expect(company.cards).toEqual([])
  })

  it('refuses a billing amount whose item is not named, as the terms form does, and takes both on one card', async () => {
    const company = await desk()

    const alone = await company.propose([{ op: 'set-setting', input: { key: 'billing_bonus_item', value: '' } }])
    const both = await company.propose([
      { op: 'set-setting', input: { key: 'billing_bonus_amount', value: '300' } },
      { op: 'set-setting', input: { key: 'billing_bonus_item', value: 'Bonus' } },
    ])

    expect(alone.isError).toBe(true)
    expect(both.isError, both.text).toBe(false)
    expect(company.cards).toHaveLength(1)
  })

  it('refuses a bucket label another bucket already uses, as Settings, General does', async () => {
    const company = await desk()
    const taken = bookOf(company).settings.bucketLabels.income

    const answer = await company.propose([{ op: 'set-setting', input: { key: 'label_operating', value: taken } }])

    expect(answer.isError).toBe(true)
    expect(company.cards).toEqual([])
  })

  it('refuses a billing client that is not on the clients tab, as the terms form offers only those', async () => {
    const company = await desk()

    const nobody = await company.propose([{ op: 'set-setting', input: { key: 'billing_client', value: 'nobody' } }])
    const quiet = await company.propose([{ op: 'set-setting', input: { key: 'billing_client', value: 'quiet' } }])

    expect(nobody.isError).toBe(true)
    expect(quiet.isError, quiet.text).toBe(false)
  })

  it('fills the billing year with the terms an earlier step on the card set', async () => {
    const company = await desk()
    const rows = bookOf(company).billingPlan.length

    await company.propose([{ op: 'set-setting', input: { key: 'billing_client', value: 'quiet' } }, stepOf(INVOICING_OPERATIONS.operations, 'fill-billing-year', { year: 2027 })])
    expect((await company.accept()).kind).toBe('done')

    const added = bookOf(company).billingPlan.slice(rows)
    expect(added.length).toBeGreaterThan(0)
    expect(added.every((row) => row.client === 'quiet')).toBe(true)
  })

  it('warns on a currency with a line of its own, since every amount then reads differently', async () => {
    const company = await desk()

    await company.propose([{ op: 'set-setting', input: { key: 'currency', value: 'USD' } }])

    const notes = company.cards[0]!.groups.flatMap((group) => group.notes)
    expect(notes.map((note) => note.text)).toContain(companyWords.everyFigure.currency)
  })
})

describe('clients', () => {
  it('warns on invoice details only when the mail address changes', async () => {
    const company = await desk()
    const client = company.ref('client', 'northwind')
    const unchanged = { client, shortName: null, name: null, ibans: null, country: null, taxId: null, invoiceMail: null, mailLanguage: null, reverseCharge: null, lines: null }

    await company.propose([{ op: 'change-client', input: { ...unchanged, address: '9 New Street, Zagreb' } }])
    await company.propose([{ op: 'change-client', input: { ...unchanged, address: null, invoiceMail: 'new@northwind.example' } }])

    const details = (at: number) => company.cards[at]!.groups[0]!.lines[0]!.fields.find((field) => field.name === invoicingWords.fields.invoicing)!
    expect(details(0).warns).toBe(false)
    expect(details(1).warns).toBe(true)
  })

  it("sets a client's invoice lines and keeps its other fields, and an empty list clears them", async () => {
    const company = await desk()
    const client = company.ref('client', 'northwind')
    const unchanged = { client, shortName: null, name: null, ibans: null, address: null, country: null, taxId: null, invoiceMail: null, mailLanguage: null, reverseCharge: null }
    const lines = [
      { text: ' Development for {month} ', items: ['Monthly Fee'] },
      { text: 'Everything else', items: [] },
    ]

    expect((await company.propose([{ op: 'change-client', input: { ...unchanged, lines } }])).isError).toBe(false)
    expect((await company.accept()).kind).toBe('done')
    const northwind = () => bookOf(company).clients.find((candidate) => candidate.slug === 'northwind')!
    expect(northwind().invoicing).toMatchObject({
      address: '1 Example Road, London',
      reverseCharge: true,
      lines: [
        { text: 'Development for {month}', items: ['Monthly Fee'] },
        { text: 'Everything else', items: [] },
      ],
    })

    expect((await company.propose([{ op: 'change-client', input: { ...unchanged, lines: [] } }])).isError).toBe(false)
    expect((await company.accept()).kind).toBe('done')
    expect(northwind().invoicing.lines).toBeUndefined()
    expect(northwind().invoicing.address).toBe('1 Example Road, London')
  })

  it('refuses invoice lines that name a plan item on two lines, as the client dialog does', async () => {
    const company = await desk()
    const unchanged = {
      client: company.ref('client', 'northwind'),
      shortName: null,
      name: null,
      ibans: null,
      address: null,
      country: null,
      taxId: null,
      invoiceMail: null,
      mailLanguage: null,
      reverseCharge: null,
    }

    const answer = await company.propose([
      {
        op: 'change-client',
        input: {
          ...unchanged,
          lines: [
            { text: 'Development', items: ['Monthly Fee'] },
            { text: 'Fees', items: ['Monthly Fee'] },
          ],
        },
      },
    ])

    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Monthly Fee is on an earlier line already')
  })
})

describe('making an invoice', () => {
  it('is a link to the Invoices tab for a client or an invoice, never a card', () => {
    const company = companyAssistant(HR_DOO_ASSISTANT, { status: () => 'none', workbook: () => null, records: () => null, rates: () => NO_RATES }, () => [])
    const invoices = company.places.find((place) => place.route === '/company/invoicing?tab=invoices')!

    expect(invoices.params).toMatchObject({ make: { kind: 'client' }, reexport: { kind: 'invoice' } })
    expect(INVOICING_OPERATIONS.operations.map((operation) => operation.name)).not.toEqual(expect.arrayContaining(['make-invoice', 'reexport-invoice', 'switch-invoice-drafts']))
  })
})
