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
import { invoiceOf, planRow } from './fixtures/billingPlan'
import { exampleStudio } from './fixtures/exampleStudio'

const store = vi.hoisted(() => ({
  state: null as unknown as { workbook: Workbook | null; snapshot: null; status: string; error: string | null },
  sync: async (): Promise<void> => undefined,
  refusal: null as string | null,
  async check(): Promise<{ status: 'refused'; reason: string } | { status: 'nothingToChange' }> {
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
    google.session = createFakeInvoiceGoogle((_title, offered) => offered, 2026)
    void google.session.drive.pickFolders(null, 'Pick the invoice folder')
  })

  afterEach(() => {
    vi.useRealTimers()
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
})
