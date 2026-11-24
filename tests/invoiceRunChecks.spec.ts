import { reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { FAKE_INVOICE_FOLDER } from '../src/apps/company/documents/infrastructure/fake/fakeFilingDrive'
import { createFakeInvoiceGoogle } from '../src/apps/company/invoicing/infrastructure/fake/fakeInvoiceGoogle'
import type { FakeInvoiceGoogle } from '../src/apps/company/invoicing/infrastructure/fake/fakeInvoiceGoogle'
import type { InvoiceRunMode } from '../src/apps/company/invoicing/presentation/useInvoiceRun'
import { useInvoiceRun } from '../src/apps/company/invoicing/presentation/useInvoiceRun'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import type { Invoice, Workbook } from '../src/apps/company/workbook/domain/workbook'
import { NO_CLIENT_INVOICING } from '../src/apps/company/workbook/domain/workbook'
import { INVOICE_CODEC } from '../src/apps/company/workbook/domain/invoicesReading'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { invoiceOf, planRow } from './fixtures/billingPlan'
import { exampleStudio } from './fixtures/exampleStudio'

const store = vi.hoisted(() => ({
  state: null as unknown as { workbook: Workbook | null; snapshot: null; status: string; error: string | null },
  sync: async (): Promise<void> => undefined,
  refusal: null as string | null,
  checks: 0,
  async check(): Promise<{ status: 'refused'; reason: string } | { status: 'nothingToChange' }> {
    store.checks += 1
    return store.refusal === null ? { status: 'nothingToChange' } : { status: 'refused', reason: store.refusal }
  },
  written: [] as Invoice[],
  async write(_title: string, work: (unit: UnitOfWork) => void): Promise<null> {
    const kept = (record: unknown) => store.written.push(record as Invoice)
    work({ of: () => ({ add: kept, change: (_before: unknown, after: unknown) => kept(after), remove: () => {}, repair: () => {}, discard: () => {} }) } as UnitOfWork)
    return null
  },
}))
const google = vi.hoisted(() => ({ session: null as unknown as FakeInvoiceGoogle }))

vi.mock('../src/apps/company/workbook/application/workbookStore', () => ({ useWorkbook: () => store }))
vi.mock('../src/apps/company/documents/application/filingDrive', () => ({ filingDrive: async () => google.session.drive }))
vi.mock('../src/apps/company/invoicing/application/invoiceGoogle', () => ({ invoiceDrafts: async () => google.session.drafts }))
vi.mock('../src/apps/company/documents/infrastructure/documentFonts', () => ({ documentFonts: async () => ({}) }))
vi.mock('../src/apps/company/invoicing/infrastructure/invoicePdf', () => ({
  renderInvoicePdf: async (document: { number: string }) => new TextEncoder().encode(document.number),
}))
vi.mock('../src/shared/files/downloadFile', () => ({ downloadFile: () => undefined }))

function googleWorkbook(): Workbook {
  return exampleStudio({
    source: 'drive',
    clients: [{ slug: 'north', name: 'North Ltd', ibans: [], invoicing: { ...NO_CLIENT_INVOICING, address: '1 Road, London', reverseCharge: true } }],
    invoices: [invoiceOf('8-1-26', 6925, '2026-08-21'), invoiceOf('9-1-26', 6925, '2026-09-21')],
    settings: {
      ...DEFAULT_SETTINGS,
      invoicing: {
        ...DEFAULT_SETTINGS.invoicing,
        name: 'Primjer d.o.o.',
        address: 'Ulica 1, Split',
        oib: '12345678901',
        iban: 'HR6212345670000000001',
        place: 'Split',
        signatory: 'Ana Čičić',
        folderId: FAKE_INVOICE_FOLDER.id,
      },
    },
  })
}

function openedRun() {
  const run = useInvoiceRun(ref<InvoiceRunMode>({ kind: 'new', client: 'north' }))
  run.reset()
  run.lines.value = [{ description: 'Software development', amount: '6925.00', items: [] }]
  return run
}

describe('the checks before an invoice is made', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-21T10:00:00'), toFake: ['Date'] })
    store.state = reactive({ workbook: googleWorkbook(), snapshot: null, status: 'ready', error: null })
    store.sync = async () => undefined
    store.written = []
    store.refusal = null
    store.checks = 0
    google.session = createFakeInvoiceGoogle((_title, offered) => offered, 2026)
    void google.session.drive.pickFolders(null, 'Pick the invoice folder')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('says a line without an amount under the lines only once Check is pressed, and stays on the form without asking the file', async () => {
    const run = openedRun()
    run.lines.value = [...run.lines.value, { description: 'Maintenance', amount: '', items: [] }]

    expect(run.tried.value).toBe(false)
    expect(run.problems.value).toEqual([])

    await run.check()

    expect(run.tried.value).toBe(true)
    expect(run.errors.value.lines).toBe('Every line needs an amount above zero.')
    expect(run.stage.value).toEqual({ kind: 'edit', message: null })
    expect(store.checks).toBe(0)
    expect(store.written).toEqual([])
    run.dispose()
  })

  it('says a due date before the issue date and a number taken under their fields with the lines in one Check, and keeps the box for the terms', async () => {
    const run = openedRun()
    run.due.value = '2026-10-15'
    run.typeNumber('9-1-26')
    run.lines.value = [{ description: '', amount: '6925.00', items: [] }]

    await run.check()

    expect(run.errors.value).toEqual({
      client: null,
      issued: null,
      number: 'Invoice 9-1-26 is already on the invoices tab, and each number is used once.',
      due: 'Not before the issue date',
      period: null,
      lines: 'Every line needs a description.',
    })
    expect(run.problems.value).toEqual([])
    expect(store.checks).toBe(0)
    run.reset()
    expect(run.tried.value).toBe(false)
    run.dispose()
  })

  it('says a typed number under its field when the fresh read before the checks finds it taken', async () => {
    const run = openedRun()
    run.typeNumber('10-1-26')
    store.sync = async () => {
      const workbook = store.state.workbook!
      store.state.workbook = { ...workbook, invoices: [...workbook.invoices, invoiceOf('10-1-26', 100, '2026-10-21', 'other')] }
    }

    await run.check()

    expect(run.stage.value).toEqual({ kind: 'edit', message: null })
    expect(run.errors.value.number).toBe('Invoice 10-1-26 is already on the invoices tab, and each number is used once.')
    run.dispose()
  })

  it('writes the register row under the number the PDF printed, even when a sync after the check moves the next number on', async () => {
    const run = openedRun()
    await run.check()
    expect(run.stage.value.kind).toBe('ready')
    const printed = run.stage.value.kind === 'ready' ? new TextDecoder().decode(run.stage.value.pdf) : ''
    expect(printed).toBe('10-1-26')

    const workbook = store.state.workbook!
    store.state.workbook = { ...workbook, invoices: [...workbook.invoices, invoiceOf('10-1-26', 100, '2026-10-21', 'other')] }
    await run.make()

    expect(store.written.map((invoice) => invoice.number)).toEqual(['10-1-26'])
    run.dispose()
  })

  it('files nothing when the store refuses a write, as it does for a file a newer Kuna saved', async () => {
    const run = openedRun()
    await run.check()
    expect(run.stage.value.kind).toBe('ready')
    store.refusal = 'Saved by a newer version.'

    await run.make()

    expect(run.stage.value).toEqual({ kind: 'edit', message: 'Saved by a newer version.' })
    expect(google.session.nodes.filter((node) => node.content !== undefined)).toEqual([])
    expect(google.session.savedDrafts).toEqual([])
    expect(store.written).toEqual([])
    run.dispose()
  })

  it('stops the checks at once when the store refuses a write', async () => {
    store.refusal = 'Saved by a newer version.'
    const run = openedRun()

    await run.check()

    expect(run.stage.value).toEqual({ kind: 'edit', message: 'Saved by a newer version.' })
    run.dispose()
  })
})

describe('the lines an invoice starts from', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-21T10:00:00'), toFake: ['Date'] })
    const workbook = googleWorkbook()
    const lines = [
      { text: 'Software services for {month}', items: ['Monthly Fee'] },
      { text: 'Costs billed on', items: [] },
    ]
    store.state = reactive({
      workbook: {
        ...workbook,
        invoices: [],
        clients: [
          { ...workbook.clients[0]!, invoicing: { ...workbook.clients[0]!.invoicing, lines } },
          { slug: 'south', name: 'South Ltd', ibans: [], invoicing: { ...NO_CLIENT_INVOICING, address: '2 Road', reverseCharge: true } },
        ],
        billingPlan: [
          planRow('Monthly Fee', '2026-10-31', 5000, 'north', 'October fee'),
          planRow('Hotel', '2026-10-12', 300, 'north', 'Hotel in Zagreb'),
          planRow('Workshop', '2026-10-15', 900, 'south', 'Workshop'),
        ],
      },
      snapshot: null,
      status: 'ready',
      error: null,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("follow the client's invoice lines, and the plan's rows again for a client without them", () => {
    const run = useInvoiceRun(ref<InvoiceRunMode>({ kind: 'new', client: 'north' }))
    run.reset()

    expect(run.templated.value).toBe(true)
    expect(run.lines.value).toEqual([
      { description: 'Software services for October 2026', amount: '5000.00', items: ['Monthly Fee'] },
      { description: 'Costs billed on', amount: '300.00', items: ['Hotel'] },
    ])

    run.client.value = 'south'
    run.fillLines()

    expect(run.templated.value).toBe(false)
    expect(run.lines.value).toEqual([{ description: 'Workshop', amount: '900.00', items: ['Workshop'] }])
    run.dispose()
  })

  it('keep the plan items of a line typed over, and of one line made for the total', () => {
    const run = useInvoiceRun(ref<InvoiceRunMode>({ kind: 'new', client: 'north' }))
    run.reset()
    run.lines.value = run.lines.value.map((line, index) => (index === 0 ? { ...line, description: 'Development' } : line))

    expect(run.lines.value[0]!.items).toEqual(['Monthly Fee'])

    run.mergeLines()

    expect(run.lines.value).toEqual([{ description: 'Development', amount: '5300.00', items: ['Monthly Fee', 'Hotel'] }])
    run.dispose()
  })

  it('re-export a two-line invoice from the register with the lines it went out with', async () => {
    store.written = []
    store.refusal = null
    google.session = createFakeInvoiceGoogle((_title, offered) => offered, 2026)
    void google.session.drive.pickFolders(null, 'Pick the invoice folder')
    const made = useInvoiceRun(ref<InvoiceRunMode>({ kind: 'new', client: 'north' }))
    made.reset()
    const sent = made.lines.value.map((line) => ({ ...line }))
    await made.check()
    await made.make()
    made.dispose()
    const [written] = store.written
    expect(written?.lines).toHaveLength(2)

    const read = INVOICE_CODEC.make(storedFieldsOfValues(INVOICE_CODEC.fieldsOf(written!)), written!.id)
    store.state.workbook = { ...store.state.workbook!, invoices: [read] }
    const reexport = useInvoiceRun(ref<InvoiceRunMode>({ kind: 'reexport', id: read.id }))
    reexport.reset()

    expect(sent).toEqual([
      { description: 'Software services for October 2026', amount: '5000.00', items: ['Monthly Fee'] },
      { description: 'Costs billed on', amount: '300.00', items: ['Hotel'] },
    ])
    expect(reexport.lines.value).toEqual(sent)
    reexport.dispose()
  })

  it('re-export a row that keeps no lines from one line of its item at its amount', () => {
    const invoice = invoiceOf('9-1-26', 6925, '2026-09-21', 'north')
    store.state.workbook = { ...store.state.workbook!, invoices: [invoice] }
    const run = useInvoiceRun(ref<InvoiceRunMode>({ kind: 'reexport', id: invoice.id }))
    run.reset()

    expect(run.lines.value).toEqual([{ description: invoice.item, amount: '6925.00', items: [] }])
    run.dispose()
  })
})
