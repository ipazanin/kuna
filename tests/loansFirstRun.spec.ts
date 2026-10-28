// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { loansApp } from '../src/apps/loans/app'
import { useLoansBooks } from '../src/apps/loans/workbook/application/loansStore'
import { LOANS_APP, LOANS_DOCUMENT } from '../src/apps/loans/workbook/infrastructure/loansDocument'
import { exportLoansFile, newLoansFileContents } from '../src/apps/loans/workbook/presentation/loansFile'
import { seedFakeWorkbook } from '../src/apps/company/workbook/infrastructure/fake/seedFakeWorkbook'
import { previewImport } from '../src/apps/company/workbook/presentation/workbookFiles'
import { APP_PROPERTY, refuseBackup } from '../src/shared/storage/infrastructure/driveDocument'
import { decodeDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { fakeBooksFolder, fakeDriveSession } from '../src/shared/storage/infrastructure/fake/fakeDriveSession'
import { pageWorkbookStore } from '../src/shared/storage/infrastructure/pageWorkbookStore'
import { loadWorkbookChoice, saveWorkbookChoice } from '../src/shared/storage/infrastructure/workbookChoice'

const downloads: { readonly contents: unknown; readonly fileName: string; readonly type: string }[] = []

// The specs run without the Vue compiler or Nuxt UI's app, which the sync group's export control and the toasts need.
vi.mock('../src/apps/loans/workbook/presentation/LocalLoansStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => {} }) }))
vi.mock('../src/shared/files/downloadFile', () => ({
  downloadFile: (contents: unknown, fileName: string, type: string) => downloads.push({ contents, fileName, type }),
}))

/** The Loans store of another device that shares the fake build's Drive: its own copy of the store, with no Loans file chosen yet. */
function otherDevice() {
  saveWorkbookChoice(LOANS_APP, null)
  return pageWorkbookStore(LOANS_APP, LOANS_DOCUMENT, 'Pick your Loans file')
}

/** The files the fake build's Books folder holds, by name, with the app each is marked for. */
async function booksFolder(): Promise<Record<string, string | undefined>> {
  const drive = fakeDriveSession()
  const files = await drive.children(await fakeBooksFolder())
  return Object.fromEntries(files.map((entry) => [entry.name, drive.file(entry.id).appProperties[APP_PROPERTY]]))
}

beforeAll(async () => {
  vi.stubEnv('VITE_FAKE_WORKBOOK', 'true')
  localStorage.setItem('kuna.google-account', 'owner@example.com')
  await seedFakeWorkbook(null, () => null)
})

// One fake Drive serves the whole file, as it serves a page of the fake build, so each case builds on the one before.
describe('the Loans first run on the fake Drive', () => {
  it('is what a device with the company books on Drive and no Loans file sees under /loans', async () => {
    await useLoansBooks().open()

    expect(loansApp.firstRun()).toBe(true)
    expect(loadWorkbookChoice('company')?.source).toBe('drive')
  })

  it('opens nothing while Drive holds no Loans file, and never the company file', async () => {
    const store = otherDevice()
    await store.open()

    await store.chooseDriveFile('find')
    await store.chooseDriveFile('pick')

    expect(store.state.status).toBe('ready')
    expect(store.state.choice).toBeNull()
  })

  it('keeps a new file on Drive as kuna-loans.json, marked as the Loans file, beside the company file', async () => {
    const store = useLoansBooks()

    const folder = await store.pickBooksFolder()
    await store.keepOnDrive(folder!.id, newLoansFileContents(store), [])

    expect(store.state.error).toBeNull()
    expect(store.state.choice).toMatchObject({ source: 'drive', name: 'kuna-loans.json' })
    expect(await booksFolder()).toEqual({ 'kuna-company.json': 'company', 'kuna-loans.json': 'loans' })
    const stored = decodeDocument(await fakeDriveSession().download(store.state.choice!.id))
    expect(stored).toMatchObject({ app: 'loans', schema: { loans: 1 }, records: {} })
    expect(loansApp.firstRun()).toBe(false)
  })

  it('refuses a second Loans file on Drive', async () => {
    const store = useLoansBooks()

    await expect(store.pickBooksFolder()).rejects.toThrow('Drive already holds kuna-loans.json')
  })

  it('lets a second device find the Loans file by its mark, and its Picker pick it, never the company file', async () => {
    const madeOn = useLoansBooks().state.choice!

    for (const lookup of ['find', 'pick'] as const) {
      const store = otherDevice()
      await store.open()
      await store.chooseDriveFile(lookup)

      expect(store.state.choice).toEqual(madeOn)
      expect(store.state.workbook).toEqual({ title: 'kuna-loans.json' })
    }
    expect(loadWorkbookChoice('company')?.name).toBe('kuna-company.json')
  })

  it('keeps a new file in this browser, which the next open reads back, and keeps the Google sign-in the company file on Drive needs', async () => {
    const store = otherDevice()
    await store.open()

    await store.replaceLocalWorkbook(newLoansFileContents(store), 'Loans file')
    const reopened = pageWorkbookStore(LOANS_APP, LOANS_DOCUMENT, 'Pick your Loans file')
    await reopened.open()

    expect(reopened.state.choice).toMatchObject({ source: 'browser', name: 'Loans file' })
    expect(reopened.state.snapshot?.document).toMatchObject({ app: 'loans', records: {} })
    expect(localStorage.getItem('kuna.google-account')).toBe('owner@example.com')
  })

  it('exports the file as kuna-loans-export-<day>.json, which reads back as the same document, a pick on Drive takes for the books, and the company import refuses', async () => {
    const store = pageWorkbookStore(LOANS_APP, LOANS_DOCUMENT, 'Pick your Loans file')
    await store.open()

    const fileName = await exportLoansFile(store)

    const [download] = downloads
    expect(fileName).toMatch(/^kuna-loans-export-\d{4}-\d{2}-\d{2}\.json$/)
    expect(() => refuseBackup(fileName, LOANS_APP)).not.toThrow()
    expect(download).toMatchObject({ fileName, type: 'application/json' })
    expect(decodeDocument(download!.contents as string)).toEqual(store.state.snapshot!.document)
    expect(store.state.snapshot?.meta).toMatchObject({ unexportedSince: null })
    expect(store.state.snapshot?.meta.lastExportedAt).not.toBeNull()

    await store.replaceLocalWorkbook(decodeDocument(download!.contents as string), 'Loans file')
    expect(store.state.snapshot?.document).toEqual(decodeDocument(download!.contents as string))

    await expect(previewImport(new File([download!.contents as string], fileName))).rejects.toThrow('holds the books of another Kuna app, loans')
  })

})
