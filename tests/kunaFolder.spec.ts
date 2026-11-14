import { describe, expect, it } from 'vitest'

import type { DriveFileBeside } from '../src/shared/storage/application/workbookPorts'
import { DriveMoveRefused } from '../src/shared/storage/application/driveMoveRefused'
import { placeOfDriveDocument } from '../src/shared/storage/infrastructure/driveDocument'
import { FOLDER_MIME_TYPE } from '../src/shared/google/driveClient'
import { statementFilesToRead } from '../src/apps/company/imports/domain/statementFiles'
import { companyFileBeside, settingsAfterMove } from '../src/apps/company/settings/presentation/companyFileBeside'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import type { Workbook } from '../src/apps/company/workbook/domain/workbook'
import { createFakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import type { FakeDrive } from '../src/shared/storage/infrastructure/fake/fakeDrive'
import { finishDriveMove, findKunaFolder, isKunaFolderOfApp, kunaFolderOfApp, moveDriveDocument, planDriveMove, unfinishedMoveOf } from '../src/shared/storage/infrastructure/kunaFolder'
import { exampleStudio } from './fixtures/exampleStudio'

const NOTHING: DriveFileBeside = { files: [], folders: [], stays: [] }

async function pathOf(drive: FakeDrive, fileId: string): Promise<string> {
  const names = [drive.file(fileId).name]
  for (let current = drive.file(fileId).parents[0]!; current !== 'root'; current = drive.file(current).parents[0]!) {
    names.unshift(drive.file(current).name)
  }
  return names.join('/')
}

/** A person's folder with the Spending file, its photos, their backups, another app's backup and a file of their own. */
async function spendingFolder() {
  const drive = createFakeDrive()
  const folder = await drive.createFolder('root', 'life')
  const { id: fileId } = await drive.createFile(folder, 'kuna-spending.json', '{"kept":true}', { kuna: 'spending' })
  const receipts = await drive.createFolder(folder, 'Receipts')
  const { id: photo } = await drive.createFile(receipts, 'receipt-2026-10-01.jpg', 'photo')
  const backups = await drive.createFolder(folder, 'backups')
  const { id: backup } = await drive.createFile(backups, 'kuna-spending-2026-10-01.json', 'old')
  const { id: otherBackup } = await drive.createFile(backups, 'kuna-loans-2026-10-01.json', 'other')
  const { id: mine } = await drive.createFile(folder, 'my-notes.json', 'mine')
  return { drive, folder, fileId, receipts, photo, backups, backup, otherBackup, mine }
}

const BESIDE: DriveFileBeside = { ...NOTHING, folders: [{ name: 'Receipts', mailSource: null }] }

describe('the Kuna folder', () => {
  it('is made once at the top of My Drive with a subfolder per app, and a second device finds it wherever it sits', async () => {
    const drive = createFakeDrive()

    const loans = await kunaFolderOfApp(drive, 'loans', null)
    const assets = await kunaFolderOfApp(drive, 'assets', null)

    expect(await pathOf(drive, loans)).toBe('Kuna/loans')
    expect(await pathOf(drive, assets)).toBe('Kuna/assets')
    expect(drive.file(loans).parents).toEqual(drive.file(assets).parents)
    expect(drive.file(loans).mimeType).toBe(FOLDER_MIME_TYPE)
    expect(await kunaFolderOfApp(drive, 'loans', null)).toBe(loans)
  })

  it('goes in the folder chosen the one time it is made, and that choice means nothing after', async () => {
    const drive = createFakeDrive()
    const elsewhere = await drive.createFolder('root', 'finance')
    const other = await drive.createFolder('root', 'other')

    const loans = await kunaFolderOfApp(drive, 'loans', elsewhere)
    const assets = await kunaFolderOfApp(drive, 'assets', other)

    expect(await pathOf(drive, loans)).toBe('finance/Kuna/loans')
    expect(await pathOf(drive, assets)).toBe('finance/Kuna/assets')
    expect(await isKunaFolderOfApp(drive, 'loans', loans)).toBe(true)
    expect(await isKunaFolderOfApp(drive, 'loans', assets)).toBe(false)
    expect(await isKunaFolderOfApp(drive, 'loans', other)).toBe(false)
  })

  it('takes the first by id when two devices made one at the same moment, so both use the same one', async () => {
    const drive = createFakeDrive()
    const first = await drive.createFolder('root', 'Kuna', { kuna: 'folder' })
    await drive.createFolder('root', 'Kuna', { kuna: 'folder' })

    expect(await findKunaFolder(drive)).toBe(first)
  })

  it('uses the other device’s folder when it made one between the search and the make', async () => {
    const drive = createFakeDrive()
    const racing: FakeDrive = {
      ...drive,
      async createFolder(parentId, name, properties) {
        const made = await drive.createFolder(parentId, name, properties)
        return name === 'Kuna' ? drive.createFolder(parentId, name, properties) : made
      },
    }

    const loans = await kunaFolderOfApp(racing, 'loans', null)

    expect(drive.file(loans).parents).toEqual([await findKunaFolder(drive)])
    expect(await isKunaFolderOfApp(drive, 'loans', loans)).toBe(true)
  })
})

describe('moving a file into the Kuna folder', () => {
  it('keeps the id and the revision of the file, so a device holding the id reads on', async () => {
    const { drive, fileId } = await spendingFolder()
    const before = await drive.headRevision(fileId)

    await moveDriveDocument(drive, fileId, 'spending', BESIDE, null)

    expect(await pathOf(drive, fileId)).toBe('Kuna/spending/kuna-spending.json')
    expect(await drive.headRevision(fileId)).toBe(before)
    expect(await drive.download(fileId)).toBe('{"kept":true}')
  })

  it('takes what the app names and its own backups, a photo keeping its id, and leaves another app’s backup and the person’s own file', async () => {
    const { drive, fileId, photo, backup, otherBackup, mine, backups, folder } = await spendingFolder()

    expect(await planDriveMove(drive, fileId, 'spending', BESIDE)).toEqual({ files: [], folders: [{ name: 'Receipts', kuna: 1, others: 0 }], backups: 1, stays: [] })
    await moveDriveDocument(drive, fileId, 'spending', BESIDE, null)

    expect(await pathOf(drive, photo)).toBe('Kuna/spending/Receipts/receipt-2026-10-01.jpg')
    expect(await pathOf(drive, backup)).toBe('Kuna/spending/backups/kuna-spending-2026-10-01.json')
    expect(drive.file(otherBackup).parents).toEqual([backups])
    expect(drive.file(mine).parents).toEqual([folder])
  })

  it('does nothing to a file already there', async () => {
    const { drive, fileId } = await spendingFolder()
    await moveDriveDocument(drive, fileId, 'spending', BESIDE, null)
    await finishDriveMove(drive, fileId)
    drive.requests.length = 0

    await moveDriveDocument(drive, fileId, 'spending', BESIDE, null)

    expect(drive.requests).not.toContain('move')
  })

  it('tries the file first, so a refusal moves nothing and says what Google did not document', async () => {
    const { drive, fileId, folder, photo, receipts, backup, backups } = await spendingFolder()
    const before = await drive.headRevision(fileId)
    const refusing: FakeDrive = {
      ...drive,
      async move(id, from, to, properties) {
        if (id === fileId) throw new Error('403 from the fake Drive: this folder was never given to the app')
        return drive.move(id, from, to, properties)
      },
    }

    const failure = await moveDriveDocument(refusing, fileId, 'spending', BESIDE, null).catch((refused: unknown) => refused)

    expect(failure).toBeInstanceOf(DriveMoveRefused)
    expect((failure as Error).message).toContain("Google's docs do not say")
    expect((failure as Error).message).toContain('403')
    expect(drive.file(fileId).parents).toEqual([folder])
    expect(drive.file(photo).parents).toEqual([receipts])
    expect(drive.file(backup).parents).toEqual([backups])
    expect(await drive.appPropertyOf(fileId, 'movedFrom')).toBeNull()
    expect(await drive.headRevision(fileId)).toBe(before)
  })

  it('carries on from where the file came from after a later step fails, on any device, and clears the mark', async () => {
    const { drive, fileId, photo, backup, folder } = await spendingFolder()
    const before = await drive.headRevision(fileId)
    const failing: FakeDrive = {
      ...drive,
      async move(id, from, to, properties) {
        if (id === backup) throw new Error('503 from the fake Drive')
        return drive.move(id, from, to, properties)
      },
    }

    const failure = await moveDriveDocument(failing, fileId, 'spending', BESIDE, null).catch((refused: unknown) => refused)

    expect(failure).toBeInstanceOf(Error)
    expect(failure).not.toBeInstanceOf(DriveMoveRefused)
    expect(await pathOf(drive, fileId)).toBe('Kuna/spending/kuna-spending.json')
    expect(await unfinishedMoveOf(drive, fileId)).toBe(folder)
    expect(await planDriveMove(drive, fileId, 'spending', BESIDE)).toMatchObject({ backups: 1 })

    expect(await moveDriveDocument(drive, fileId, 'spending', BESIDE, null)).toEqual([])
    await finishDriveMove(drive, fileId)
    expect(await pathOf(drive, backup)).toBe('Kuna/spending/backups/kuna-spending-2026-10-01.json')
    expect(await pathOf(drive, photo)).toBe('Kuna/spending/Receipts/receipt-2026-10-01.jpg')
    expect(await unfinishedMoveOf(drive, fileId)).toBeNull()
    expect(await drive.headRevision(fileId)).toBe(before)
  })

  it('merges a folder a half-finished move left, overwriting nothing and naming what stayed', async () => {
    const { drive, fileId, folder, photo } = await spendingFolder()
    const target = await kunaFolderOfApp(drive, 'spending', null)
    const there = await drive.createFolder(target, 'Receipts')
    const { id: same } = await drive.createFile(there, 'receipt-2026-10-01.jpg', 'already there')

    const left = await moveDriveDocument(drive, fileId, 'spending', BESIDE, null)

    expect(left).toEqual(['receipt-2026-10-01.jpg'])
    expect(drive.file(photo).parents).not.toEqual([there])
    expect(await drive.download(same)).toBe('already there')
    expect(drive.file(fileId).parents).toEqual([target])
    expect((await drive.children(folder)).map((entry) => entry.name).sort()).toEqual(['Receipts', 'backups', 'my-notes.json'])
  })
})

describe('moving only what Kuna made', () => {
  /** A statements folder at a path from My Drive with one statement Kuna filed from mail, one a script filed, and a file another mail source filed there. */
  async function mixedStatements() {
    const drive = createFakeDrive()
    const folder = await drive.createFolder('root', 'books')
    const { id: fileId } = await drive.createFile(folder, 'kuna-company.json', '{}', { kuna: 'company' })
    const work = await drive.createFolder('root', 'work')
    const statements = await drive.createFolder(work, 'statements')
    const year = await drive.createFolder(statements, '2026-statements')
    const { id: filed } = await drive.createFile(year, '2026-09-01-statement-010-main.xml', 'camt', { 'kuna-mail': 'statements', 'kuna-mail-id': 'a', 'kuna-mail-date': '2026-09-01T08:00:00.000Z' })
    const { id: scripted } = await drive.createFile(year, '2026-09-02-statement-011-main.xml', 'camt')
    drive.file(scripted).isAppAuthorized = false
    const { id: otherSource } = await drive.createFile(year, '2026-09-report.pdf', 'report', { 'kuna-mail': 'reports', 'kuna-mail-id': 'b', 'kuna-mail-date': '2026-09-03T08:00:00.000Z' })
    const beside: DriveFileBeside = { ...NOTHING, folders: [{ name: 'statements', fromPath: ['work', 'statements'], mailSource: 'statements' }] }
    return { drive, fileId, statements, year, filed, scripted, otherSource, beside }
  }

  it('takes a statement Kuna filed from mail, with its id, and leaves the script’s file, another source’s and the folder itself', async () => {
    const { drive, fileId, statements, year, filed, scripted, otherSource, beside } = await mixedStatements()

    await moveDriveDocument(drive, fileId, 'company', beside, null)

    expect(await pathOf(drive, filed)).toBe('Kuna/company/statements/2026-statements/2026-09-01-statement-010-main.xml')
    expect(drive.file(scripted).parents).toEqual([year])
    expect(drive.file(otherSource).parents).toEqual([year])
    expect(drive.file(year).parents).toEqual([statements])
    expect(await drive.folderAtPath(['work', 'statements', '2026-statements'])).toBe(year)
  })

  it('counts what goes and what stays, so the dialog can say it cannot tell who made the rest', async () => {
    const { drive, fileId, beside } = await mixedStatements()

    expect((await planDriveMove(drive, fileId, 'company', beside)).folders).toEqual([{ name: 'statements', kuna: 1, others: 2, fromPath: ['work', 'statements'] }])
  })

  it('moves a file with no mark of its source as nothing Kuna made, which is what an older file looks like', async () => {
    const { drive, fileId, year, beside } = await mixedStatements()
    const { id: older } = await drive.createFile(year, '2026-08-01-statement-001-main.xml', 'camt', { 'ledgerboard-mail': 'statements' })

    await moveDriveDocument(drive, fileId, 'company', beside, null)

    expect(drive.file(older).parents).toEqual([year])
  })

  it('leaves a photo in Receipts that Kuna did not make, and never moves the folder itself', async () => {
    const { drive, fileId, receipts, photo, folder } = await spendingFolder()
    const { id: mine } = await drive.createFile(receipts, 'my-photo.jpg', 'x')
    drive.file(mine).isAppAuthorized = false

    await moveDriveDocument(drive, fileId, 'spending', BESIDE, null)

    expect(drive.file(mine).parents).toEqual([receipts])
    expect(drive.file(receipts).parents).toEqual([folder])
    expect(await pathOf(drive, photo)).toBe('Kuna/spending/Receipts/receipt-2026-10-01.jpg')
  })
})

describe('what the Company file takes along', () => {
  const books = (settings: Partial<Workbook['settings']>) => exampleStudio({ settings: { ...DEFAULT_SETTINGS, ...settings } })

  it('takes statements Kuna files from mail and rewrites the setting to the folder beside the file', () => {
    const workbook = books({ statementsFolder: ['work', 'statements'], statementsMailFrom: ['bank@example.com'] })

    expect(companyFileBeside(workbook).folders).toEqual([{ name: 'statements', fromPath: ['work', 'statements'], mailSource: 'statements' }])
    expect(settingsAfterMove(workbook)).toEqual([{ key: 'statements_folder', value: './statements' }])
  })

  it('keeps the path of a statements folder Kuna does not file into, since only a script or a person fills it, and goes on reading it', () => {
    const workbook = books({ statementsFolder: ['work', 'statements'] })

    expect(companyFileBeside(workbook)).toMatchObject({ folders: [], stays: ['My Drive › work › statements'] })
    expect(settingsAfterMove(workbook)).toEqual([])
  })

  it('needs no new setting for a folder already named from the file, and leaves the invoice folder where the person picked it', () => {
    const workbook = books({ statementsFolder: ['.', 'statements'], invoicing: { ...DEFAULT_SETTINGS.invoicing, folderId: 'picked' } })

    expect(companyFileBeside(workbook).folders).toEqual([{ name: 'statements', mailSource: 'statements' }])
    expect(companyFileBeside(workbook).stays).toHaveLength(1)
    expect(settingsAfterMove(workbook)).toEqual([])
  })
})

describe('a statement after a move', () => {
  it('still reads as imported, since the check reads the name and the account, never the id or the folder', () => {
    const name = '2026-09-01-statement-010-main.xml'
    const ledger = [{ account: 'main', statement: '2026-09-01-statement-010' }]

    expect(statementFilesToRead([{ id: 'before', name }], ledger)).toEqual([])
    expect(statementFilesToRead([{ id: 'after', name }], ledger)).toEqual([])
  })
})

describe('a file in a folder the app was never given', () => {
  /** Drive as `drive.file` shows it where this is measured: the folder's name answers 404, and listing it shows only what the app made. */
  function hidingFolder(drive: FakeDrive, folder: string): FakeDrive {
    return {
      ...drive,
      async nameOf(id) {
        if (id === folder) throw new Error('404 from the fake Drive')
        return drive.nameOf(id)
      },
    }
  }

  it('still knows where the file sits, so Settings can offer the move, with only the name missing', async () => {
    const { drive, fileId, folder } = await spendingFolder()

    expect(await placeOfDriveDocument(hidingFolder(drive, folder), fileId, 'spending')).toEqual({ folderId: folder, folderName: null, lastBackup: '2026-10-01' })
  })
})

describe('the search for the Kuna folder', () => {
  it('passes over a Kuna folder someone shared, so a person’s books never land in another person’s folder', async () => {
    const drive = createFakeDrive()
    const shared = await drive.createFolder('root', 'Kuna', { kuna: 'folder' })
    drive.file(shared).ownedByMe = false

    const loans = await kunaFolderOfApp(drive, 'loans', null)

    expect(drive.file(loans).parents).not.toEqual([shared])
    expect(await findKunaFolder(drive)).not.toBe(shared)
  })
})

describe('a new device, searching for its file', () => {
  it('makes nothing when the search fails, so a failed search never reads as no file', async () => {
    const drive = createFakeDrive()
    const failing: FakeDrive = {
      ...drive,
      async findOwnedByAppProperty() {
        throw new Error('500 from the fake Drive')
      },
    }

    await expect(kunaFolderOfApp(failing, 'loans', null)).rejects.toThrow('500')
    expect(await drive.children('root')).toEqual([])
  })
})
