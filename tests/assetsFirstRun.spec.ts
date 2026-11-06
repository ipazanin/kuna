// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { assetsApp } from '../src/apps/assets/app'
import { useAssetsBooks } from '../src/apps/assets/workbook/application/assetsStore'
import { ASSETS_APP, ASSETS_DOCUMENT } from '../src/apps/assets/workbook/infrastructure/assetsDocument'
import { newAssetsFileContents } from '../src/apps/assets/workbook/presentation/assetsFile'
import { words as fileWords } from '../src/apps/assets/workbook/presentation/words'
import { exportAppFile } from '../src/shared/storage/presentation/exportAppFile'
import { BooksAlreadyOnDrive } from '../src/shared/storage/application/booksAlreadyOnDrive'
import { seedFakeWorkbook } from '../src/apps/company/workbook/infrastructure/fake/seedFakeWorkbook'
import { previewImport } from '../src/apps/company/workbook/presentation/workbookFiles'
import { APP_PROPERTY, refuseBackup } from '../src/shared/storage/infrastructure/driveDocument'
import { decodeDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { fakeBooksFolder, fakeDriveSession } from '../src/shared/storage/infrastructure/fake/fakeDriveSession'
import { pageWorkbookStore } from '../src/shared/storage/infrastructure/pageWorkbookStore'
import { loadWorkbookChoice, saveWorkbookChoice } from '../src/shared/storage/infrastructure/workbookChoice'

const downloads: { readonly contents: unknown; readonly fileName: string; readonly type: string }[] = []

// The specs run without the Vue compiler or Nuxt UI's app, which the sync group's export control and the toasts need.
vi.mock('../src/apps/assets/workbook/presentation/LocalAssetsStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => {} }) }))
vi.mock('../src/shared/files/downloadFile', () => ({
  downloadFile: (contents: unknown, fileName: string, type: string) => downloads.push({ contents, fileName, type }),
}))

/** The Assets store of another device that shares the fake build's Drive: its own copy of the store, with no Assets file chosen yet. */
function otherDevice() {
  saveWorkbookChoice(ASSETS_APP, null)
  return pageWorkbookStore(ASSETS_APP, ASSETS_DOCUMENT, 'Pick your Assets file')
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
describe('the Assets first run on the fake Drive', () => {
  it('is what a device with the company books on Drive and no Assets file sees under /assets', async () => {
    await useAssetsBooks().open()

    expect(assetsApp.firstRun()).toBe(true)
    expect(loadWorkbookChoice('company')?.source).toBe('drive')
  })

  it('opens nothing while Drive holds no Assets file, and never the company file', async () => {
    const store = otherDevice()
    await store.open()

    await store.chooseDriveFile('find')
    await store.chooseDriveFile('pick')

    expect(store.state.status).toBe('ready')
    expect(store.state.choice).toBeNull()
  })

  it('keeps a new file on Drive as kuna-assets.json, marked as the Assets file, in its subfolder of the Kuna folder', async () => {
    const store = useAssetsBooks()

    await store.keepOnDrive(await store.driveHomeOfApp(null), newAssetsFileContents(store))

    expect(store.state.error).toBeNull()
    expect(store.state.choice).toMatchObject({ source: 'drive', name: 'kuna-assets.json' })
    expect(fakeDriveSession().file(fakeDriveSession().file(store.state.choice!.id).parents[0]!).name).toBe('assets')
    expect(await booksFolder()).toEqual({ 'kuna-company.json': 'company' })
    const stored = decodeDocument(await fakeDriveSession().download(store.state.choice!.id))
    expect(stored).toMatchObject({ app: 'assets', schema: { assets: 1 }, records: {} })
    expect(assetsApp.firstRun()).toBe(false)
  })

  it('refuses a second Assets file on Drive as books already there, before the Picker and on the make, so the folder step can offer to find them', async () => {
    const store = otherDevice()
    await store.open()

    await expect(store.driveHomeOfApp(null)).rejects.toThrow(BooksAlreadyOnDrive)
    await expect(store.keepOnDrive(await fakeBooksFolder(), newAssetsFileContents(store))).rejects.toThrow('Drive already holds kuna-assets.json')
    expect(store.state).toMatchObject({ status: 'ready', error: null, choice: null })
    expect(await booksFolder()).toEqual({ 'kuna-company.json': 'company' })
  })

  it('lets a second device find the Assets file by its mark, and its Picker pick it, never the company file', async () => {
    const madeOn = useAssetsBooks().state.choice!

    for (const lookup of ['find', 'pick'] as const) {
      const store = otherDevice()
      await store.open()
      await store.chooseDriveFile(lookup)

      expect(store.state.choice).toEqual(madeOn)
      expect(store.state.workbook).toMatchObject({ title: 'kuna-assets.json', assets: [], problems: [] })
    }
    expect(loadWorkbookChoice('company')?.name).toBe('kuna-company.json')
  })

  it('keeps a new file in this browser, which the next open reads back, and keeps the Google sign-in the company file on Drive needs', async () => {
    const store = otherDevice()
    await store.open()

    await store.replaceLocalWorkbook(newAssetsFileContents(store), 'Assets file')
    const reopened = pageWorkbookStore(ASSETS_APP, ASSETS_DOCUMENT, 'Pick your Assets file')
    await reopened.open()

    expect(reopened.state.choice).toMatchObject({ source: 'browser', name: 'Assets file' })
    expect(reopened.state.snapshot?.document).toMatchObject({ app: 'assets', records: {} })
    expect(localStorage.getItem('kuna.google-account')).toBe('owner@example.com')
  })

  it('exports the file as kuna-assets-export-<day>.json, which reads back as the same document, a pick on Drive takes for the books, and the company import refuses', async () => {
    const store = pageWorkbookStore(ASSETS_APP, ASSETS_DOCUMENT, 'Pick your Assets file')
    await store.open()

    const fileName = await exportAppFile(store, ASSETS_APP, fileWords.nothingToExport)

    const [download] = downloads
    expect(fileName).toMatch(/^kuna-assets-export-\d{4}-\d{2}-\d{2}\.json$/)
    expect(() => refuseBackup(fileName, ASSETS_APP)).not.toThrow()
    expect(download).toMatchObject({ fileName, type: 'application/json' })
    expect(decodeDocument(download!.contents as string)).toEqual(store.state.snapshot!.document)
    expect(store.state.snapshot?.meta).toMatchObject({ unexportedSince: null })
    expect(store.state.snapshot?.meta.lastExportedAt).not.toBeNull()

    await store.replaceLocalWorkbook(decodeDocument(download!.contents as string), 'Assets file')
    expect(store.state.snapshot?.document).toEqual(decodeDocument(download!.contents as string))

    await expect(previewImport(new File([download!.contents as string], fileName))).rejects.toThrow('holds the books of another Kuna app, assets')
  })
})
