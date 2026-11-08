import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { companyAssistant } from '../src/apps/company/assistant/companyAssistant'
import { INVOICING_OPERATIONS } from '../src/apps/company/assistant/operations/invoicingOperations'
import { words as companyWords } from '../src/apps/company/assistant/operations/words'
import { words as invoicingWords } from '../src/apps/company/assistant/operations/invoicingWords'
import { HR_DOO_ASSISTANT } from '../src/apps/company/packs/hr-doo/assistant/hrDooAssistant'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import { COMPANY_APP, installedSchema } from '../src/apps/company/workbook/infrastructure/companyDocument'
import { fakeWorkbookRecords } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import { filledFields } from '../src/shared/storage/domain/recordFields'
import { newDocument } from '../src/shared/storage/infrastructure/documentRecordStorage'
import type { AssistantOperation } from '../src/shared/app/assistantOperations'
import { companyChat, deskPorts } from './fixtures/companyDesk'
import type { CompanyChat } from './fixtures/companyDesk'
import { browserHarness, forgetCaches } from './fixtures/writeBack'

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
function exampleRecord(desk: Desk, name: string): string {
  const book = bookOf(desk)
  const ids: Readonly<Record<string, string>> = {
    client: 'northwind',
    'client-unused': 'quiet',
    invoice: book.invoices[0]!.id,
    'billing-item': book.billingPlan[0]!.id,
  }
  return ids[name]!
}

function exampleInput(desk: Desk, operation: AssistantOperation): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(operation.example).map(([field, value]) => {
      const kind = operation.refs[field]
      return [field, kind !== undefined && typeof value === 'string' ? desk.ref(kind, exampleRecord(desk, value)) : value]
    }),
  )
}

describe('every invoicing operation', () => {
  it.each(INVOICING_OPERATIONS.operations.map((operation) => [operation.name, operation] as const))(
    'has an example that passes the checks of the file, and one Undo takes it back: %s',
    async (_name, operation) => {
      const company = await desk()
      const before = heldRecords(company)

      const answer = await company.propose([{ op: operation.name, input: exampleInput(company, operation) }])

      expect(answer.isError, answer.text).toBe(false)
      const card = company.cards[0]!
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
    const invoice = { number: '99-1-26', client, item: 'Consulting', amount: 100, issued: '2026-10-31', due: null, periodFrom: null, periodTo: null }

    const late = await company.propose([{ op: 'add-invoice', input: { ...invoice, due: '2026-10-01' } }])
    const oneEnd = await company.propose([{ op: 'add-invoice', input: { ...invoice, periodFrom: '2026-10-01' } }])
    const nothing = await company.propose([{ op: 'add-invoice', input: { ...invoice, amount: 0 } }])

    expect(late.isError).toBe(true)
    expect(late.text).toContain('due day')
    expect(oneEnd.text).toContain('both days')
    expect(nothing.isError).toBe(true)
  })

  it('refuses a number already on the register, whatever the client', async () => {
    const company = await desk()
    const taken = bookOf(company).invoices[0]!

    const answer = await company.propose([
      { op: 'add-invoice', input: { number: taken.number, client: company.ref('client', 'quiet'), item: 'Again', amount: 10, issued: '2026-10-31', due: null, periodFrom: null, periodTo: null } },
    ])

    expect(answer.isError).toBe(true)
  })

  it('adds a client and its first invoice on one card, the invoice naming the client by its $ name', async () => {
    const company = await desk()

    const answer = await company.propose([
      {
        op: 'add-client',
        input: { client: 'acme', name: 'Acme Ltd', ibans: 'HR1210010051863000160', address: '', country: '', taxId: '', invoiceMail: 'billing@acme.example', mailLanguage: '', reverseCharge: 'no' },
        as: '$acme',
      },
      { op: 'add-invoice', input: { number: 'A-1', client: '$acme', item: 'Setup', amount: 500, issued: '2026-11-02', due: null, periodFrom: null, periodTo: null } },
    ])

    expect(answer.isError, answer.text).toBe(false)
    const client = company.cards[0]!.groups.find((group) => group.noun.en.one === 'client')!.lines[0]!
    expect(client.fields.filter((field) => field.warns).map((field) => field.after)).toEqual(['HR1210010051863000160', 'billing@acme.example'])
    expect((await company.accept()).kind).toBe('done')
    expect(bookOf(company).invoices.some((invoice) => invoice.client === 'acme' && invoice.number === 'A-1')).toBe(true)
  })

  it('refuses to delete a client invoices name', async () => {
    const company = await desk()

    const answer = await company.propose([{ op: 'delete-client', input: { client: company.ref('client', 'lumen') } }])

    expect(answer.isError).toBe(true)
  })
})

describe('the billing plan', () => {
  it("fills the year as the Plan tab's fill does, and Undo takes every row back", async () => {
    const company = await desk()
    const rows = bookOf(company).billingPlan.length

    await company.propose([{ op: 'fill-billing-year', input: { year: 2027 } }])
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

    await company.propose([
      { op: 'set-setting', input: { key: 'billing_client', value: 'quiet' } },
      { op: 'fill-billing-year', input: { year: 2027 } },
    ])
    expect((await company.accept()).kind).toBe('done')

    const added = bookOf(company).billingPlan.slice(rows)
    expect(added.length).toBeGreaterThan(0)
    expect(added.every((row) => row.client === 'quiet')).toBe(true)
  })

  it('warns on a currency with a line of its own, since every amount then reads differently', async () => {
    const company = await desk()

    await company.propose([{ op: 'set-setting', input: { key: 'currency', value: 'USD' } }])

    const lines = company.cards[0]!.groups.flatMap((group) => group.lines)
    expect(lines.map((line) => line.warning)).toContain(companyWords.everyFigure.currency)
  })
})

describe('clients', () => {
  it('warns on invoice details only when the mail address changes', async () => {
    const company = await desk()
    const client = company.ref('client', 'northwind')
    const unchanged = { client, shortName: null, name: null, ibans: null, country: null, taxId: null, invoiceMail: null, mailLanguage: null, reverseCharge: null }

    await company.propose([{ op: 'change-client', input: { ...unchanged, address: '9 New Street, Zagreb' } }])
    await company.propose([{ op: 'change-client', input: { ...unchanged, address: null, invoiceMail: 'new@northwind.example' } }])

    const details = (at: number) => company.cards[at]!.groups[0]!.lines[0]!.fields.find((field) => field.name === invoicingWords.fields.invoicing)!
    expect(details(0).warns).toBe(false)
    expect(details(1).warns).toBe(true)
  })
})

describe('making an invoice', () => {
  it('is a link to the Invoices tab for a client or an invoice, never a card', () => {
    const company = companyAssistant(HR_DOO_ASSISTANT, { status: () => 'none', workbook: () => null, records: () => null }, () => [])
    const invoices = company.places.find((place) => place.route === '/company/invoicing?tab=invoices')!

    expect(invoices.params).toMatchObject({ make: { kind: 'client' }, reexport: { kind: 'invoice' } })
    expect(INVOICING_OPERATIONS.operations.map((operation) => operation.name)).not.toEqual(expect.arrayContaining(['make-invoice', 'reexport-invoice', 'switch-invoice-drafts']))
  })
})
