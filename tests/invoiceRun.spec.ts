import { readFileSync } from 'node:fs'

import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'

import { continueRun, locateFiling, pickerTitleFor, runStepsOf } from '../src/apps/company/invoicing/application/invoiceRun'
import type { DriveEntry, RegisterChange, RunPlan, RunPorts } from '../src/apps/company/invoicing/application/invoiceRun'
import { DEFAULT_FILE_PATH, filingPathOf } from '../src/apps/company/invoicing/domain/invoiceFiling'
import { createFakeInvoiceGoogle, FAKE_INVOICE_FOLDER } from '../src/apps/company/invoicing/infrastructure/fake/fakeInvoiceGoogle'
import { renderInvoicePdf } from '../src/apps/company/invoicing/infrastructure/invoicePdf'
import type { InvoiceFontFiles } from '../src/apps/company/invoicing/infrastructure/invoicePdf'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import { invoiceOf } from './fixtures/billingPlan'
import { civil, euros } from './fixtures/ledger'

const PATH = filingPathOf(DEFAULT_FILE_PATH, { issued: civil('2026-10-21'), client: 'north', number: '10-1-26' })

/** A Drive whose invoice folder holds 2025 and 2026 with their month folders, made by another app, and a Picker that answers from a script. */
function driveWith(answers: ('pick' | 'cancel')[]) {
  const titles: string[] = []
  const google = createFakeInvoiceGoogle((title, offered) => {
    titles.push(title)
    return answers.shift() === 'pick' ? offered : []
  }, 2026)
  return { google, titles }
}

async function rootPicked(answers: ('pick' | 'cancel')[]) {
  const made = driveWith(['pick', ...answers])
  await made.google.drive.pickFolders(null, 'Pick the invoice folder')
  made.titles.length = 0
  return made
}

/** The invoice folder and its year folders picked, the month folders still out of view. */
async function yearsPicked() {
  const made = await rootPicked(['pick'])
  await made.google.drive.pickFolders(FAKE_INVOICE_FOLDER.id, pickerTitleFor('2026'))
  return made
}

describe('finding the folders to file in', () => {
  it('opens the Picker on a folder the app cannot see, and goes on with the one picked', async () => {
    const { google, titles } = await rootPicked(['pick', 'pick'])
    const found = await locateFiling(google.drive, FAKE_INVOICE_FOLDER.id, PATH, new Set())
    expect(titles).toEqual([pickerTitleFor('2026'), pickerTitleFor('2026-10')])
    expect(found).toEqual({ kind: 'found', target: { folderId: 'fake-folder-2026-10', toCreate: [], fileName: '2026-10-north-invoice.pdf', existing: null } })
  })

  it('finds the folders without asking once they were picked', async () => {
    const { google, titles } = await rootPicked(['pick', 'pick'])
    await locateFiling(google.drive, FAKE_INVOICE_FOLDER.id, PATH, new Set())
    titles.length = 0
    const again = await locateFiling(google.drive, FAKE_INVOICE_FOLDER.id, filingPathOf(DEFAULT_FILE_PATH, { issued: civil('2026-10-21'), client: 'south', number: '11-1-26' }), new Set())
    expect(titles).toEqual([])
    expect(again.kind).toBe('found')
  })

  it('reports a folder the person did not pick, and makes it only when asked to', async () => {
    const { google } = await rootPicked(['pick', 'cancel'])
    const hidden = await locateFiling(google.drive, FAKE_INVOICE_FOLDER.id, PATH, new Set())
    expect(hidden).toEqual({ kind: 'hidden', segment: '2026-10', path: '2026/2026-10' })
    expect(google.nodes.filter((node) => node.name === '2026-10')).toHaveLength(1)

    const toMake = await locateFiling(google.drive, FAKE_INVOICE_FOLDER.id, PATH, new Set(['2026/2026-10']))
    expect(toMake).toEqual({ kind: 'found', target: { folderId: 'fake-folder-2026', toCreate: ['2026-10'], fileName: '2026-10-north-invoice.pdf', existing: null } })
  })

  it('makes no folder while it only looks', async () => {
    const { google } = await rootPicked(['cancel'])
    const count = google.nodes.length
    expect(await locateFiling(google.drive, FAKE_INVOICE_FOLDER.id, PATH, new Set())).toEqual({ kind: 'hidden', segment: '2026', path: '2026' })
    expect(google.nodes).toHaveLength(count)
  })
})

function planFor(overrides: Partial<RunPlan> = {}): RunPlan {
  return {
    pdf: new Uint8Array([37, 80, 68, 70]),
    fileName: PATH.fileName,
    filing: { folderId: 'fake-folder-2026', toCreate: ['2026-10'], fileName: PATH.fileName, existing: null },
    replace: false,
    draft: { to: 'a@example.com', subject: 'Invoice 10-1-26', body: 'Hello' },
    register: { before: null, after: invoiceOf('10-1-26', 4000, '2026-10-31') },
    ...overrides,
  }
}

function portsWith(drive: RunPorts['drive'], drafts: RunPorts['drafts'], register: (change: RegisterChange) => Promise<void>) {
  const downloads: string[] = []
  const ports: RunPorts = { drive, drafts, download: (_pdf, fileName) => downloads.push(fileName), writeRegister: register }
  return { ports, downloads }
}

describe('the run', () => {
  it('files the PDF, saves the draft and writes the register row, in that order', async () => {
    const { google } = await yearsPicked()
    const written: RegisterChange[] = []
    const plan = planFor()
    const steps = runStepsOf(plan)
    const { ports, downloads } = portsWith(google.drive, google.drafts, async (change) => {
      written.push(change)
    })
    await continueRun(plan, steps, ports)

    expect(steps.map((step) => [step.kind, step.status])).toEqual([
      ['file', 'done'],
      ['draft', 'done'],
      ['register', 'done'],
    ])
    const month = google.nodes.find((node) => node.name === '2026-10' && node.visible)!
    expect(google.nodes.filter((node) => node.parentId === month.id).map((node) => node.name)).toEqual([PATH.fileName])
    expect(google.savedDrafts.map((draft) => [draft.mail.to, draft.fileName])).toEqual([['a@example.com', PATH.fileName]])
    expect(written).toHaveLength(1)
    expect(downloads).toEqual([])
  })

  it('saves the PDF through the browser instead of a draft, and only that without a Drive', () => {
    expect(runStepsOf(planFor({ draft: null })).map((step) => step.kind)).toEqual(['file', 'download', 'register'])
    expect(runStepsOf(planFor({ filing: null, draft: null })).map((step) => step.kind)).toEqual(['download', 'register'])
  })

  it('refuses to file over an invoice, and writes nothing after', async () => {
    const { google } = await yearsPicked()
    const year = (await google.drive.children(FAKE_INVOICE_FOLDER.id))[0] as DriveEntry
    const month = await google.drive.createFolder(year.id, 'made-here')
    await google.drive.createPdf(month.id, PATH.fileName, new Uint8Array([1]))
    const plan = planFor({ filing: { folderId: month.id, toCreate: [], fileName: PATH.fileName, existing: null } })
    const steps = runStepsOf(plan)
    await continueRun(plan, steps, portsWith(google.drive, google.drafts, async () => undefined).ports)
    expect(steps.map((step) => step.status)).toEqual(['failed', 'waiting', 'waiting'])
    expect(steps[0]!.note).toContain('does not overwrite an invoice')
    expect(google.savedDrafts).toEqual([])
  })

  it('retries only the steps left after a failure', async () => {
    const { google } = await yearsPicked()
    const plan = planFor()
    const steps = runStepsOf(plan)
    let refusals = 1
    const written: RegisterChange[] = []
    const { ports } = portsWith(google.drive, google.drafts, async (change) => {
      if (refusals > 0) {
        refusals -= 1
        throw new Error('Another change or a sync is still running. Try again when it finishes.')
      }
      written.push(change)
    })
    await continueRun(plan, steps, ports)
    expect(steps.map((step) => step.status)).toEqual(['done', 'done', 'failed'])

    await continueRun(plan, steps, ports)
    expect(steps.map((step) => step.status)).toEqual(['done', 'done', 'done'])
    expect(google.nodes.filter((node) => node.name === '2026-10' && node.visible)).toHaveLength(1)
    expect(google.nodes.filter((node) => node.name === PATH.fileName)).toHaveLength(1)
    expect(google.savedDrafts).toHaveLength(1)
    expect(written).toHaveLength(1)
  })

  it('keeps a folder it made when the upload after it fails, and makes it only once', async () => {
    const { google } = await yearsPicked()
    let uploads = 0
    const drive = {
      ...google.drive,
      async createPdf(folderId: string, name: string, pdf: Uint8Array) {
        uploads += 1
        if (uploads === 1) throw new Error('503 from /upload/drive/v3/files: backend error')
        return google.drive.createPdf(folderId, name, pdf)
      },
    }
    const plan = planFor()
    const steps = runStepsOf(plan)
    const { ports } = portsWith(drive, google.drafts, async () => undefined)
    await continueRun(plan, steps, ports)
    expect(steps[0]!.status).toBe('failed')
    await continueRun(plan, steps, ports)
    expect(steps.every((step) => step.status === 'done')).toBe(true)
    expect(google.nodes.filter((node) => node.name === '2026-10' && node.visible)).toHaveLength(1)
  })

  it('replaces the PDF on a re-export and says the old draft may still be there', async () => {
    const { google } = await yearsPicked()
    const year = (await google.drive.children(FAKE_INVOICE_FOLDER.id))[0] as DriveEntry
    const month = await google.drive.createFolder(year.id, 'made-here')
    const old = await google.drive.createPdf(month.id, PATH.fileName, new Uint8Array([1]))
    const plan = planFor({ replace: true, register: null, filing: { folderId: month.id, toCreate: [], fileName: PATH.fileName, existing: old } })
    const steps = runStepsOf(plan)
    await continueRun(plan, steps, portsWith(google.drive, google.drafts, async () => undefined).ports)
    expect(steps.map((step) => [step.kind, step.status])).toEqual([
      ['file', 'done'],
      ['draft', 'done'],
    ])
    expect(google.nodes.find((node) => node.id === old.id)?.pdf).toEqual(plan.pdf)
    expect(steps[1]!.note).toContain('Delete the earlier draft')
  })
})

describe('the PDF', () => {
  const files = 'node_modules/@fontsource/inter/files/'
  const pair = (weight: number, style: string) => ({
    latin: readFileSync(`${files}inter-latin-${weight}-${style}.woff`),
    extended: readFileSync(`${files}inter-latin-ext-${weight}-${style}.woff`),
  })
  const fonts: InvoiceFontFiles = { regular: pair(400, 'normal'), bold: pair(600, 'normal'), italic: pair(400, 'italic') }

  it('draws one A4 page with the Croatian letters in Inter', async () => {
    const issuer = { ...DEFAULT_SETTINGS.invoicing, name: 'Primjer d.o.o.', address: 'Ulica 1, Đakovo', vatId: 'HR1', iban: 'HR6212345670000000001', place: 'Đakovo', signatory: 'Ana Čičić, Šimić-Žužić' }
    const bytes = await renderInvoicePdf(
      {
        number: '10-1-26',
        issued: civil('2026-10-21'),
        due: civil('2026-11-21'),
        deliveryPeriod: { from: civil('2026-10-01'), to: civil('2026-10-31') },
        issuer,
        recipient: { name: 'North Ltd', address: '1 Road, London', country: 'United Kingdom', taxId: '' },
        lines: [
          { description: 'Software development for October, a description long enough to wrap onto a second line of the table', amount: euros(6700) },
          { description: 'Subscription', amount: euros(225) },
        ],
        total: euros(6925),
        currency: 'EUR',
        numberLocale: 'en-GB',
      },
      fonts,
    )
    const document = await PDFDocument.load(bytes)
    expect(document.getPageCount()).toBe(1)
    expect(document.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 })
    expect(document.getTitle()).toBe('Invoice 10-1-26')
  })
})
