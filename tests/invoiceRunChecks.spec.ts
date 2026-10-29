import { reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeInvoiceGoogle, FAKE_INVOICE_FOLDER } from '../src/apps/company/invoicing/infrastructure/fake/fakeInvoiceGoogle'
import type { FakeInvoiceGoogle } from '../src/apps/company/invoicing/infrastructure/fake/fakeInvoiceGoogle'
import type { InvoiceRunMode } from '../src/apps/company/invoicing/presentation/useInvoiceRun'
import { useInvoiceRun } from '../src/apps/company/invoicing/presentation/useInvoiceRun'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import type { UnitOfWork } from '../src/shared/storage/application/repository'
import type { Invoice, Workbook } from '../src/apps/company/workbook/domain/workbook'
import { NO_CLIENT_INVOICING } from '../src/apps/company/workbook/domain/workbook'
import { invoiceOf } from './fixtures/billingPlan'
import { exampleStudio } from './fixtures/exampleStudio'

const store = vi.hoisted(() => ({
  state: null as unknown as { workbook: Workbook | null; snapshot: null; status: string; error: string | null; writing: boolean },
  sync: async (): Promise<void> => undefined,
  written: [] as Invoice[],
  async write(_title: string, work: (unit: UnitOfWork) => void): Promise<null> {
    const kept = (record: unknown) => store.written.push(record as Invoice)
    work({ of: () => ({ add: kept, change: (_before: unknown, after: unknown) => kept(after), remove: () => {}, repair: () => {}, discard: () => {} }) } as UnitOfWork)
    return null
  },
}))
const google = vi.hoisted(() => ({ session: null as unknown as FakeInvoiceGoogle }))

vi.mock('../src/apps/company/workbook/application/workbookStore', () => ({ useWorkbook: () => store }))
vi.mock('../src/apps/company/invoicing/application/invoiceGoogle', () => ({
  invoiceDrive: async () => google.session.drive,
  invoiceDrafts: async () => google.session.drafts,
}))
vi.mock('../src/apps/company/invoicing/infrastructure/invoiceFonts', () => ({ invoiceFonts: async () => ({}) }))
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
        vatId: 'HR1',
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
  run.lines.value = [{ description: 'Software development', amount: '6925.00' }]
  return run
}

describe('the checks before an invoice is made', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-21T10:00:00'), toFake: ['Date'] })
    store.state = reactive({ workbook: googleWorkbook(), snapshot: null, status: 'ready', error: null, writing: false })
    store.sync = async () => undefined
    store.written = []
    google.session = createFakeInvoiceGoogle((_title, offered) => offered, 2026)
    void google.session.drive.pickFolders(null, 'Pick the invoice folder')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refuses to go on when a sync already running kept the register from being read again', async () => {
    const run = openedRun()
    store.state.status = 'syncing'
    await run.check()
    expect(run.stage.value).toMatchObject({ kind: 'edit', message: expect.stringContaining('was not read again') })
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
})
