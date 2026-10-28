import { describe, expect, it } from 'vitest'

import { addDays, civilDate } from '../src/shared/calendar/civilDate'
import type { CivilDate } from '../src/shared/calendar/civilDate'
import type { DocumentSave, Rewrite, StoredDocument } from '../src/shared/storage/application/documentHome'
import { createDriveDocument, driveDocumentHome, findDriveDocument } from '../src/shared/storage/infrastructure/driveDocument'
import type { DocumentDrive } from '../src/shared/storage/infrastructure/driveDocument'
import { createFakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import type { FakeDrive, UploadInFlight } from '../src/shared/storage/infrastructure/fake/fakeDrive'

const TODAY = civilDate(2026, 10, 24)

/** The test's document: categories by ledger row, as JSON with the rows in order. */
type Categories = Record<string, string>

function documentText(categories: Categories): string {
  return JSON.stringify(Object.fromEntries(Object.entries(categories).sort(([left], [right]) => left.localeCompare(right))))
}

function categoriesIn(text: string): Categories {
  return JSON.parse(text) as Categories
}

/** A write that files one row in a category, worked out on `base`, which refuses to run again on a text where another device filed that row. */
function filing(base: StoredDocument, row: string, category: string) {
  const before = categoriesIn(base.text)[row]
  const reruns: string[] = []
  return {
    text: documentText({ ...categoriesIn(base.text), [row]: category }),
    reruns,
    async rewrite(other: string): Promise<Rewrite> {
      reruns.push(other)
      const held = categoriesIn(other)
      return held[row] === before ? { kind: 'rewritten', text: documentText({ ...held, [row]: category }) } : { kind: 'refused', reason: `${row} was filed in ${held[row]} on another device.` }
    },
  }
}

/** The books in a picked folder, whose backup of the day is already made unless `backedUp` says otherwise. */
async function books(options: { readonly backedUp?: boolean; readonly day?: () => CivilDate } = {}) {
  const drive = createFakeDrive()
  const folderId = await drive.createFolder('root', 'books')
  const { fileId, document } = await createDriveDocument(drive, folderId, 'company', documentText({}))
  if (options.backedUp ?? true) {
    const backupsId = await drive.createFolder(folderId, 'backups')
    await drive.createFile(backupsId, `kuna-company-${TODAY}.json`, document.text)
  }
  drive.requests.length = 0
  return { drive, folderId, fileId, base: document, home: () => driveDocumentHome(drive, fileId, 'company', options.day ?? (() => TODAY)) }
}

function headText(drive: FakeDrive, fileId: string): string {
  const file = drive.file(fileId)
  return file.revisions.find((revision) => revision.id === file.headRevisionId)!.text
}

function keptCount(drive: FakeDrive, fileId: string): number {
  return drive.file(fileId).revisions.filter((revision) => revision.keepForever).length
}

function byText(uploads: readonly UploadInFlight[], text: string): UploadInFlight {
  return uploads.find((upload) => upload.text === text)!
}

describe('driveDocumentHome', () => {
  it('saves with a check of the head before the upload and a list of the revisions and the head after it, once the day has its backup', async () => {
    const { drive, fileId, base, home } = await books()
    const device = home()
    const first = filing(base, 'row-1', 'software')
    const firstSaved = await device.save(base, first.text, first.rewrite)
    const current = firstSaved.kind === 'saved' ? firstSaved.document : base
    drive.requests.length = 0
    const write = filing(current, 'row-2', 'travel')

    const saved = await device.save(current, write.text, write.rewrite)

    expect(saved).toEqual({ kind: 'saved', document: { revision: drive.file(fileId).headRevisionId, text: write.text } })
    expect(drive.requests).toEqual(['headRevision', 'upload', 'revisions', 'headRevision'])
    expect(write.reruns).toEqual([])
    expect(keptCount(drive, fileId)).toBe(2)
  })

  it('downloads only when the head moved from the revision the caller holds', async () => {
    const { drive, fileId, base, home } = await books()

    expect(await home().read(base)).toBe(base)
    drive.editOutside(fileId, documentText({ 'row-9': 'travel' }))
    const read = await home().read(base)

    expect(read).toEqual({ revision: drive.file(fileId).headRevisionId, text: documentText({ 'row-9': 'travel' }) })
    expect(drive.requests).toEqual(['headRevision', 'headRevision', 'download'])
  })

  it('stores nothing and says the file moved when another save landed since the read, so the caller starts again', async () => {
    const { drive, fileId, base, home } = await books()
    const first = filing(base, 'row-1', 'software')
    await home().save(base, first.text, first.rewrite)
    drive.requests.length = 0
    const stale = filing(base, 'row-2', 'travel')

    const moved = await home().save(base, stale.text, stale.rewrite)

    expect(moved).toEqual({ kind: 'moved' })
    expect(drive.requests).toEqual(['parentOf', 'children', 'children', 'headRevision'])
    expect(categoriesIn(headText(drive, fileId))).toEqual({ 'row-1': 'software' })
  })

  /** When the upload that lands second lands, against the device whose upload landed first. */
  type SecondLanding = 'with the first' | 'after the first device finished' | 'between the first device listing and reading the head'

  describe.each([
    ['phone', 'phone'],
    ['phone', 'laptop'],
    ['laptop', 'phone'],
    ['laptop', 'laptop'],
  ] as const)('when the %s upload is stamped first and the %s upload lands first', (stampedFirst, landsFirst) => {
    it.each<[SecondLanding, boolean]>([
      ['with the first', false],
      ['after the first device finished', false],
      ['between the first device listing and reading the head', false],
      ['with the first', true],
      ['after the first device finished', true],
      ['between the first device listing and reading the head', true],
    ])('and the second lands %s, with a conflict: %s, the first stands and only the device that landed last acts on it', async (secondLanding, conflict) => {
      const { drive, fileId, base } = await books()
      let landSecond = () => {}
      let firstListed = false
      // Both devices go through the same wrapper, so the device that saves first is stamped first.
      // The first device's drive lands the second upload once it has listed the revisions and before it reads the head.
      const deviceDrive = (landsHere: boolean): DocumentDrive => ({
        ...drive,
        async revisions(id) {
          firstListed ||= landsHere
          return drive.revisions(id)
        },
        async headRevision(id) {
          if (landsHere && firstListed && secondLanding === 'between the first device listing and reading the head') {
            landSecond()
            landSecond = () => {}
          }
          return drive.headRevision(id)
        },
      })
      const phone = filing(base, 'row-1', 'software')
      const laptop = filing(base, conflict ? 'row-1' : 'row-2', 'travel')
      const [first, second] = landsFirst === 'phone' ? [phone, laptop] : [laptop, phone]
      const saving = (device: typeof phone) => driveDocumentHome(deviceDrive(device === first), fileId, 'company', () => TODAY).save(base, device.text, device.rewrite)
      drive.holdUploads()

      const saves = new Map<typeof phone, Promise<DocumentSave>>()
      for (const device of stampedFirst === 'phone' ? [phone, laptop] : [laptop, phone]) {
        saves.set(device, saving(device))
      }
      const [firstSave, secondSave] = [saves.get(first)!, saves.get(second)!]
      const uploads = await drive.uploadsInFlight(2)
      const [firstUpload, secondUpload] = [byText(uploads, first.text), byText(uploads, second.text)]
      if (secondLanding === 'with the first') {
        drive.land([firstUpload, secondUpload])
      } else {
        landSecond = () => drive.land([secondUpload])
        drive.land([firstUpload])
      }
      const firstSaved = await firstSave
      landSecond()
      const secondSaved = await secondSave

      expect(uploads[0]!.text).toBe((stampedFirst === 'phone' ? phone : laptop).text)
      expect(firstSaved).toEqual({ kind: 'saved', document: { revision: firstUpload.revisionId, text: first.text } })
      expect(first.reruns).toEqual([])
      expect(second.reruns).toEqual([first.text])
      if (conflict) {
        expect(secondSaved).toEqual({ kind: 'refused', reason: `row-1 was filed in ${landsFirst === 'phone' ? 'software' : 'travel'} on another device.` })
        expect(headText(drive, fileId)).toBe(first.text)
      } else {
        const both = documentText({ 'row-1': 'software', 'row-2': 'travel' })
        expect(secondSaved).toEqual({ kind: 'saved', document: { revision: drive.file(fileId).headRevisionId, text: both } })
        expect(headText(drive, fileId)).toBe(both)
      }
    })
  })

  it('reads the head from Drive when the upload that landed last is not the last one listed, and still keeps both saves', async () => {
    const { drive, fileId, base, home } = await books()
    const phone = filing(base, 'row-1', 'software')
    const laptop = filing(base, 'row-2', 'travel')
    drive.holdUploads()

    const saves = Promise.all([home().save(base, phone.text, phone.rewrite), home().save(base, laptop.text, laptop.rewrite)])
    const [earlier, later] = await drive.uploadsInFlight(2)
    drive.land([later!, earlier!])
    const listed = await drive.revisions(fileId)

    // Drive lists by modified time, so the phone's upload, which landed last, is listed before the laptop's.
    expect(drive.file(fileId).headRevisionId).toBe(earlier!.revisionId)
    expect(listed.at(-1)!.id).toBe(later!.revisionId)
    await saves
    expect(categoriesIn(headText(drive, fileId))).toEqual({ 'row-1': 'software', 'row-2': 'travel' })
  })

  it('puts the save that landed first back and refuses the one that landed last with its reason when the write no longer holds on it', async () => {
    const { drive, fileId, base, home } = await books()
    const phone = filing(base, 'row-1', 'software')
    const laptop = filing(base, 'row-1', 'travel')
    drive.holdUploads()

    const saves = Promise.all([home().save(base, phone.text, phone.rewrite), home().save(base, laptop.text, laptop.rewrite)])
    const [earlier, later] = await drive.uploadsInFlight(2)
    drive.land([later!, earlier!])
    const [phoneSaved, laptopSaved] = await saves

    expect(laptopSaved.kind).toBe('saved')
    expect(phoneSaved).toEqual({ kind: 'refused', reason: 'row-1 was filed in travel on another device.' })
    expect(headText(drive, fileId)).toBe(laptop.text)
    // In the order they landed: the laptop's upload, the phone's, and the laptop's put back over the phone's.
    expect(drive.file(fileId).revisions.map((revision) => revision.text)).toEqual([base.text, laptop.text, phone.text, laptop.text])
  })

  it('says the file changed outside the app when a revision it cannot download landed during the save', async () => {
    const { drive, fileId, base, home } = await books()
    const write = filing(base, 'row-1', 'software')
    drive.holdUploads()

    const saving = home().save(base, write.text, write.rewrite)
    const [upload] = await drive.uploadsInFlight(1)
    drive.editOutside(fileId, documentText({ 'row-7': 'rent' }))
    drive.land([upload!])

    await expect(saving).rejects.toThrow('The file changed outside the app during this save. Check the backups folder.')
    expect(write.reruns).toEqual([])
  })

  it('lets go of the oldest kept revision once a save makes the 101st', async () => {
    const { drive, fileId, base, home } = await books()
    for (let upload = 0; upload < 100; upload += 1) {
      await drive.upload(fileId, base.text)
    }
    const oldestKept = drive.file(fileId).revisions.find((revision) => revision.keepForever)!
    const current = await home().read(null)
    const write = filing(current, 'row-1', 'software')

    expect((await home().save(current, write.text, write.rewrite)).kind).toBe('saved')
    expect(keptCount(drive, fileId)).toBe(100)
    expect(drive.file(fileId).revisions.find((revision) => revision.id === oldestKept.id)!.keepForever).toBe(false)
  })

  it('lets go of the oldest kept revisions and uploads once more when Drive refuses a 201st', async () => {
    const { drive, fileId, base, home } = await books()
    for (let upload = 0; upload < 200; upload += 1) {
      await drive.upload(fileId, base.text)
    }
    const current = await home().read(null)
    const write = filing(current, 'row-1', 'software')
    drive.requests.length = 0

    const saved = await home().save(current, write.text, write.rewrite)

    expect(saved.kind).toBe('saved')
    expect(drive.requests.filter((request) => request === 'upload')).toHaveLength(2)
    expect(keptCount(drive, fileId)).toBe(100)
    expect(headText(drive, fileId)).toBe(write.text)
  })

  it('copies the document as it stood into the backups folder on the first save of a day, keeping 30 dailies and the first of each month', async () => {
    let day = TODAY
    const { drive, folderId, base, home } = await books({ backedUp: false, day: () => day })
    const backupsId = await drive.createFolder(folderId, 'backups')
    for (let backupDay = civilDate(2026, 6, 15); backupDay < TODAY; backupDay = addDays(backupDay, 1)) {
      await drive.createFile(backupsId, `kuna-company-${backupDay}.json`, documentText({}))
    }
    await drive.createFile(backupsId, 'notes.json', '{}')
    const keptBackups = async () =>
      (await drive.children(backupsId))
        .map((entry) => entry.name)
        .filter((name) => name.startsWith('kuna-'))
        .map((name) => name.slice('kuna-company-'.length, -'.json'.length))
        .sort()
    const home1 = home()
    const first = filing(base, 'row-1', 'software')

    const saved = await home1.save(base, first.text, first.rewrite)

    const dailies = Array.from({ length: 30 }, (_, back) => addDays(TODAY, back - 29))
    expect(await keptBackups()).toEqual(['2026-06-15', '2026-07-01', '2026-08-01', '2026-09-01', ...dailies])
    const todays = [...(await drive.children(backupsId))].find((entry) => entry.name === `kuna-company-${TODAY}.json`)!
    expect(drive.file(todays.id).revisions[0]!.text).toBe(base.text)
    expect((await drive.children(backupsId)).some((entry) => entry.name === 'notes.json')).toBe(true)

    drive.requests.length = 0
    const current = saved.kind === 'saved' ? saved.document : base
    const second = filing(current, 'row-2', 'travel')
    await home1.save(current, second.text, second.rewrite)
    expect(drive.requests).toEqual(['headRevision', 'upload', 'revisions', 'headRevision'])

    day = addDays(TODAY, 1)
    const next = await home1.read(null)
    const third = filing(next, 'row-3', 'rent')
    await home1.save(next, third.text, third.rewrite)
    expect(await keptBackups()).toEqual(['2026-06-15', '2026-07-01', '2026-08-01', '2026-09-01', ...dailies.slice(1), addDays(TODAY, 1)])
  })

  it('makes no second backup of a day on a device whose first save of the day comes after another device made it', async () => {
    const { drive, folderId, fileId, base, home } = await books({ backedUp: false })
    const write = filing(base, 'row-1', 'software')
    await home().save(base, write.text, write.rewrite)
    const current = await home().read(null)
    drive.requests.length = 0

    const again = filing(current, 'row-2', 'travel')
    await home().save(current, again.text, again.rewrite)

    expect(drive.requests).toEqual(['parentOf', 'children', 'children', 'headRevision', 'upload', 'revisions', 'headRevision'])
    const backups = (await drive.children(folderId)).filter((entry) => entry.name === 'backups')
    expect(backups).toHaveLength(1)
    expect((await drive.children(backups[0]!.id)).map((entry) => entry.name)).toEqual([`kuna-company-${TODAY}.json`])
    expect(drive.file(fileId).parents).toEqual([folderId])
  })
})

describe('the document on Drive', () => {
  it('is created in the picked folder, marked with the app, and found by that mark on another device', async () => {
    const drive = createFakeDrive()
    const folderId = await drive.createFolder('root', 'books')

    expect(await findDriveDocument(drive, 'company')).toBeNull()
    const { fileId, document } = await createDriveDocument(drive, folderId, 'company', documentText({}))

    expect(drive.file(fileId)).toMatchObject({ name: 'kuna-company.json', parents: [folderId], appProperties: { kuna: 'company' } })
    expect(document).toEqual({ revision: drive.file(fileId).headRevisionId, text: documentText({}) })
    expect(await findDriveDocument(drive, 'company')).toBe(fileId)
    expect(await findDriveDocument(drive, 'personal')).toBeNull()
  })

  it('refuses to guess when the search finds two documents of the app', async () => {
    const drive = createFakeDrive()
    await createDriveDocument(drive, await drive.createFolder('root', 'books'), 'company', '{}')
    await createDriveDocument(drive, await drive.createFolder('root', 'old books'), 'company', '{}')

    await expect(findDriveDocument(drive, 'company')).rejects.toThrow('Drive holds 2 files the app made as kuna-company.json')
  })
})
