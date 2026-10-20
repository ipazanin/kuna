import { reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeInvoiceGoogle, FAKE_INVOICE_FOLDER } from '../src/features/invoicing/infrastructure/fake/fakeInvoiceGoogle'
import type { FakeInvoiceGoogle } from '../src/features/invoicing/infrastructure/fake/fakeInvoiceGoogle'
import type { InvoiceRunMode } from '../src/features/invoicing/presentation/useInvoiceRun'
import { useInvoiceRun } from '../src/features/invoicing/presentation/useInvoiceRun'
import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import type { TabRowsChange } from '../src/features/workbook/domain/rowChanges'
import type { Workbook } from '../src/features/workbook/domain/workbook'
import { NO_CLIENT_INVOICING } from '../src/features/workbook/domain/workbook'
import { invoiceOf } from './fixtures/billingPlan'
import { exampleStudio } from './fixtures/exampleStudio'

const store = vi.hoisted(() => ({
  state: null as unknown as { workbook: Workbook | null; snapshot: null; status: string; error: string | null; writing: boolean },
  sync: async (): Promise<void> => undefined,
  written: [] as TabRowsChange[],
  async changeRows(_rules: unknown, change: TabRowsChange): Promise<null> {
    store.written.push(change)
    return null
  },
  async changeSettings(): Promise<void> {},
}))
const google = vi.hoisted(() => ({ session: null as unknown as FakeInvoiceGoogle }))

vi.mock('../src/features/workbook/application/workbookStore', () => ({ useWorkbook: () => store }))
vi.mock('../src/features/invoicing/application/invoiceGoogle', () => ({
  invoiceDrive: async () => google.session.drive,
  invoiceDrafts: async () => google.session.drafts,
}))
vi.mock('../src/features/invoicing/infrastructure/invoiceFonts', () => ({ invoiceFonts: async () => ({}) }))
vi.mock('../src/features/invoicing/infrastructure/invoicePdf', () => ({
  renderInvoicePdf: async (document: { number: string }) => new TextEncoder().encode(document.number),
}))
vi.mock('../src/shared/files/downloadFile', () => ({ downloadFile: () => undefined }))

function googleWorkbook(): Workbook {
  return exampleStudio({
    source: 'google',
    clients: [{ slug: 'north', name: 'North Ltd', ibans: [], invoicing: { ...NO_CLIENT_INVOICING, address: '1 Road, London', reverseCharge: true } }],
    invoices: [invoiceOf('8-1-26', 6925, '2026-08-21'), invoiceOf('9-1-26', 6925, '2026-09-21')],
    settings: {
      ...DEFAULT_SETTINGS,
      invoicing: { ...DEFAULT_SETTINGS.invoicing, name: 'Primjer d.o.o.', address: 'Ulica 1, Split', vatId: 'HR1', iban: 'HR6212345670000000001', place: 'Split', signatory: 'Ana Čičić', folderId: FAKE_INVOICE_FOLDER.id },
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

    expect(store.written.map((change) => change.added[0]?.number)).toEqual(['10-1-26'])
    run.dispose()
  })
})
