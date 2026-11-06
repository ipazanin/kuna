// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { spendingApp } from '../src/apps/spending/app'
import { starterCategories } from '../src/apps/spending/categories/domain/starterCategories'
import type { Language } from '../src/shared/text/language'
import { useSpendingBooks } from '../src/apps/spending/workbook/application/spendingStore'
import { SPENDING_APP, SPENDING_DOCUMENT } from '../src/apps/spending/workbook/infrastructure/spendingDocument'
import { newSpendingFileContents } from '../src/apps/spending/workbook/presentation/spendingFile'
import { words as fileWords } from '../src/apps/spending/workbook/presentation/words'
import { exportAppFile } from '../src/shared/storage/presentation/exportAppFile'
import { BooksAlreadyOnDrive } from '../src/shared/storage/application/booksAlreadyOnDrive'
import { seedFakeWorkbook } from '../src/apps/company/workbook/infrastructure/fake/seedFakeWorkbook'
import { previewImport } from '../src/apps/company/workbook/presentation/workbookFiles'
import { APP_PROPERTY, refuseBackup } from '../src/shared/storage/infrastructure/driveDocument'
import { decodeDocument } from '../src/shared/storage/infrastructure/documentFormat'
import { fakeBooksFolder, fakeDriveSession } from '../src/shared/storage/infrastructure/fake/fakeDriveSession'
import { pageWorkbookStore } from '../src/shared/storage/infrastructure/pageWorkbookStore'
import { loadWorkbookChoice, saveWorkbookChoice } from '../src/shared/storage/infrastructure/workbookChoice'

const ENGLISH_GROUPS = ['Food', 'Home', 'Transport', 'Boat', 'Health', 'Personal', 'Leisure', 'Travel', 'Family and gifts', 'Money and fees', 'Other', 'Income']
const CROATIAN_GROUPS = ['Hrana', 'Dom', 'Prijevoz', 'Brod', 'Zdravlje', 'Osobno', 'Slobodno vrijeme', 'Putovanja', 'Obitelj i pokloni', 'Novac i naknade', 'Ostalo', 'Prihodi']
const FIXED = [
  ['Between my accounts', 'Između mojih računa', 'transfer'],
  ['Saved to investments', 'Prijenos u ulaganja', 'saving'],
  ['For the company', 'Za tvrtku', 'company'],
] as const

// Eleven spending groups with 40 children, Income with 5, and the three fixed categories.
const STARTER_COUNT = 11 + 40 + 1 + 4 + 3

const downloads: { readonly contents: unknown; readonly fileName: string; readonly type: string }[] = []

// The specs run without the Vue compiler or Nuxt UI's app, which the sync group's export control and the toasts need.
vi.mock('../src/apps/spending/workbook/presentation/LocalSpendingStatus.vue', () => ({ default: {} }))
vi.mock('@nuxt/ui/composables/useToast', () => ({ useToast: () => ({ add: () => {} }) }))
vi.mock('../src/shared/files/downloadFile', () => ({
  downloadFile: (contents: unknown, fileName: string, type: string) => downloads.push({ contents, fileName, type }),
}))

/** The Spending store of another device that shares the fake build's Drive: its own copy of the store, with no Spending file chosen yet. */
function otherDevice() {
  saveWorkbookChoice(SPENDING_APP, null)
  return pageWorkbookStore(SPENDING_APP, SPENDING_DOCUMENT, 'Pick your Spending file')
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
describe('the Spending first run on the fake Drive', () => {
  it('is what a device with the company books on Drive and no Spending file sees under /spending', async () => {
    await useSpendingBooks().open()

    expect(spendingApp.firstRun()).toBe(true)
    expect(loadWorkbookChoice('company')?.source).toBe('drive')
  })

  it('opens nothing while Drive holds no Spending file, and never the company file', async () => {
    const store = otherDevice()
    await store.open()

    await store.chooseDriveFile('find')
    await store.chooseDriveFile('pick')

    expect(store.state.status).toBe('ready')
    expect(store.state.choice).toBeNull()
  })

  it('keeps a new file on Drive as kuna-spending.json, marked as the Spending file, in its subfolder of the Kuna folder', async () => {
    const store = useSpendingBooks()

    await store.keepOnDrive(await store.driveHomeOfApp(null), newSpendingFileContents(store))

    expect(store.state.error).toBeNull()
    expect(store.state.choice).toMatchObject({ source: 'drive', name: 'kuna-spending.json' })
    expect(fakeDriveSession().file(fakeDriveSession().file(store.state.choice!.id).parents[0]!).name).toBe('spending')
    expect(await booksFolder()).toEqual({ 'kuna-company.json': 'company' })
    const stored = decodeDocument(await fakeDriveSession().download(store.state.choice!.id))
    expect(stored).toMatchObject({ app: 'spending', schema: { spending: 1 } })
    expect(Object.keys(stored.records)).toEqual(['category'])
    expect(store.state.workbook!.categories.filter((category) => category.parent === null).map((category) => category.name)).toEqual([...ENGLISH_GROUPS, ...FIXED.map(([en]) => en)])
    expect(spendingApp.firstRun()).toBe(false)
  })

  it('refuses a second Spending file on Drive as books already there, before the Picker and on the make, so the folder step can offer to find them', async () => {
    const store = otherDevice()
    await store.open()

    await expect(store.driveHomeOfApp(null)).rejects.toThrow(BooksAlreadyOnDrive)
    await expect(store.keepOnDrive(await fakeBooksFolder(), newSpendingFileContents(store))).rejects.toThrow('Drive already holds kuna-spending.json')
    expect(store.state).toMatchObject({ status: 'ready', error: null, choice: null })
    expect(await booksFolder()).toEqual({ 'kuna-company.json': 'company' })
  })

  it('lets a second device find the Spending file by its mark, and its Picker pick it, never the company file', async () => {
    const madeOn = useSpendingBooks().state.choice!

    for (const lookup of ['find', 'pick'] as const) {
      const store = otherDevice()
      await store.open()
      await store.chooseDriveFile(lookup)

      expect(store.state.choice).toEqual(madeOn)
      expect(store.state.workbook).toMatchObject({ title: 'kuna-spending.json', accounts: [], transactions: [], budgets: [], problems: [] })
      expect(store.state.workbook!.categories).toHaveLength(STARTER_COUNT)
    }
    expect(loadWorkbookChoice('company')?.name).toBe('kuna-company.json')
  })

  it('keeps a new file in this browser, which the next open reads back, and keeps the Google sign-in the company file on Drive needs', async () => {
    const store = otherDevice()
    await store.open()

    await store.replaceLocalWorkbook(newSpendingFileContents(store), 'Spending file')
    const reopened = pageWorkbookStore(SPENDING_APP, SPENDING_DOCUMENT, 'Pick your Spending file')
    await reopened.open()

    expect(reopened.state.choice).toMatchObject({ source: 'browser', name: 'Spending file' })
    expect(reopened.state.snapshot?.document).toMatchObject({ app: 'spending' })
    expect(reopened.state.workbook!.categories).toHaveLength(STARTER_COUNT)
    expect(localStorage.getItem('kuna.google-account')).toBe('owner@example.com')
  })

  it('exports the file as kuna-spending-export-<day>.json, which reads back as the same document, a pick on Drive takes for the books, and the company import refuses', async () => {
    const store = pageWorkbookStore(SPENDING_APP, SPENDING_DOCUMENT, 'Pick your Spending file')
    await store.open()

    const fileName = await exportAppFile(store, SPENDING_APP, fileWords.nothingToExport)

    const [download] = downloads
    expect(fileName).toMatch(/^kuna-spending-export-\d{4}-\d{2}-\d{2}\.json$/)
    expect(() => refuseBackup(fileName, SPENDING_APP)).not.toThrow()
    expect(download).toMatchObject({ fileName, type: 'application/json' })
    expect(decodeDocument(download!.contents as string)).toEqual(store.state.snapshot!.document)
    expect(store.state.snapshot?.meta).toMatchObject({ unexportedSince: null })
    expect(store.state.snapshot?.meta.lastExportedAt).not.toBeNull()

    await store.replaceLocalWorkbook(decodeDocument(download!.contents as string), 'Spending file')
    expect(store.state.snapshot?.document).toEqual(decodeDocument(download!.contents as string))

    await expect(previewImport(new File([download!.contents as string], fileName))).rejects.toThrow('holds the books of another Kuna app, spending')
  })
})

describe('the starter categories', () => {
  /** Each group with its kind and its children's names, in their order. */
  function treeOf(language: Language) {
    const categories = starterCategories(language)
    return categories.filter((category) => category.parent === null).map((group) => [group.name, group.kind, categories.filter((child) => child.parent === group.id).map((child) => child.name)])
  }

  it('are eleven spending groups, Income and the three fixed categories, in English for a first run in English', () => {
    const tree = treeOf('en')

    expect(tree.map(([name]) => name)).toEqual([...ENGLISH_GROUPS, ...FIXED.map(([en]) => en)])
    expect(tree.filter(([, kind]) => kind === 'spending')).toHaveLength(11)
    expect(tree.slice(11).map(([name, kind, children]) => [name, kind, children])).toEqual([
      ['Income', 'income', ['Salary', 'Profit payout', 'Interest', 'Other income']],
      ...FIXED.map(([en, , kind]) => [en, kind, []]),
    ])
    expect(tree[0]).toEqual(['Food', 'spending', ['Groceries', 'Restaurants', 'Coffee', 'Delivery']])
    expect(tree[9]).toEqual(['Money and fees', 'spending', ['Bank fees', 'Taxes and charges', 'Insurance', 'Loan instalments']])
    expect(starterCategories('en')).toHaveLength(STARTER_COUNT)
  })

  it('are named in Croatian for a first run in Croatian, from the same table', () => {
    const tree = treeOf('hr')

    expect(tree.map(([name]) => name)).toEqual([...CROATIAN_GROUPS, ...FIXED.map(([, hr]) => hr)])
    expect(tree[0]).toEqual(['Hrana', 'spending', ['Namirnice', 'Restorani', 'Kava', 'Dostava']])
    expect(tree[3]).toEqual(['Brod', 'spending', ['Vez', 'Gorivo', 'Servis i oprema', 'Osiguranje i registracija broda']])
    expect(tree[11]).toEqual(['Prihodi', 'income', ['Plaća', 'Isplata dobiti', 'Kamate', 'Ostali prihodi']])
    expect(treeOf('hr').map(([, kind, children]) => [kind, children.length])).toEqual(treeOf('en').map(([, kind, children]) => [kind, children.length]))
  })

  it('give each category an id of its own, each group its place, and each child its place in its group', () => {
    const categories = starterCategories('en')

    expect(new Set(categories.map((category) => category.id)).size).toBe(categories.length)
    expect(categories.filter((category) => category.parent === null).map((category) => category.order)).toEqual(Array.from({ length: 15 }, (_, place) => place + 1))
    expect(categories.filter((category) => category.parent === categories[0]!.id).map((category) => category.order)).toEqual([1, 2, 3, 4])
    expect(categories.every((category) => category.colour === '' && !category.hidden)).toBe(true)
  })
})
