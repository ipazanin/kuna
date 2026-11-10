import { FOLDER_MIME_TYPE } from '../../google/driveClient'
import { MAIL_SOURCE_PROPERTY } from '../../mail-filing/domain/mailSource'
import { DriveMoveRefused } from '../application/driveMoveRefused'
import type { DriveFileBeside, DriveMovePlan, KunaFilesFolder, KunaFilesInFolder } from '../application/workbookPorts'
import { APP_PROPERTY, KUNA_FOLDER_MARK } from '../domain/driveMarks'
import { KUNA_FOLDER_NAME } from '../domain/kunaFolderName'
import { backupDayOf, BACKUPS_FOLDER } from './driveDocument'
import type { DocumentDrive } from './driveDocument'

/** The property a moved file carries, naming the folder the rest of it still sits in, until the move has brought the rest. */
const MOVED_FROM = 'movedFrom'

/** The person's own Kuna folder, or null before any device made one. */
export async function findKunaFolder(drive: DocumentDrive): Promise<string | null> {
  return [...(await drive.findOwnedByAppProperty(APP_PROPERTY, KUNA_FOLDER_MARK))].sort()[0] ?? null
}

/** The Kuna folder, made when missing. It searches again after making, so two devices making one at the same moment both take the same one. */
async function kunaFolder(drive: DocumentDrive, parentId: string | null): Promise<string> {
  const found = await findKunaFolder(drive)
  if (found !== null) return found
  const made = await drive.createFolder(parentId, KUNA_FOLDER_NAME, { [APP_PROPERTY]: KUNA_FOLDER_MARK })
  return (await findKunaFolder(drive)) ?? made
}

async function childFolder(drive: DocumentDrive, parentId: string, name: string): Promise<string | null> {
  return (await drive.children(parentId)).find((entry) => entry.mimeType === FOLDER_MIME_TYPE && entry.name === name)?.id ?? null
}

/** The app's subfolder of the Kuna folder, named by the app's id, each made when missing. `parentId` is where a new Kuna folder goes, null for My Drive. */
export async function kunaFolderOfApp(drive: DocumentDrive, app: string, parentId: string | null): Promise<string> {
  const kunaId = await kunaFolder(drive, parentId)
  return (await childFolder(drive, kunaId, app)) ?? (await drive.createFolder(kunaId, app))
}

/** Whether the folder is the app's subfolder of the Kuna folder. */
export async function isKunaFolderOfApp(drive: DocumentDrive, app: string, folderId: string): Promise<boolean> {
  const kunaId = await findKunaFolder(drive)
  return kunaId !== null && (await childFolder(drive, kunaId, app)) === folderId
}

/** The folder a move that went only part way left the rest in, or null. */
export async function unfinishedMoveOf(drive: DocumentDrive, fileId: string): Promise<string | null> {
  return drive.appPropertyOf(fileId, MOVED_FROM)
}

type DriveEntry = Awaited<ReturnType<DocumentDrive['children']>>[number]

/** A file Kuna made, the folder it sits in and its folders below the folder looked through. */
interface KunaFile {
  readonly entry: DriveEntry
  readonly parentId: string
  readonly below: readonly string[]
}

/** Whether Kuna made the file: the app made it, and for a folder mail files into, this source filed it. Nothing else says so, and a file that cannot show it stays. */
function madeByKuna(entry: DriveEntry, mailSource: string | null): boolean {
  return entry.isAppAuthorized && (mailSource === null || entry.appProperties?.[MAIL_SOURCE_PROPERTY] === mailSource)
}

/** The files Kuna made in a folder and the folders in it, and how many others are in there, which a `drive.file` token may not list at all. */
async function filesWithin(drive: DocumentDrive, folderId: string, mailSource: string | null, below: readonly string[] = []): Promise<{ readonly kuna: readonly KunaFile[]; readonly others: number }> {
  const kuna: KunaFile[] = []
  let others = 0
  for (const entry of await drive.children(folderId)) {
    if (entry.mimeType === FOLDER_MIME_TYPE) {
      const inside = await filesWithin(drive, entry.id, mailSource, [...below, entry.name])
      kuna.push(...inside.kuna)
      others += inside.others
    } else if (madeByKuna(entry, mailSource)) {
      kuna.push({ entry, parentId: folderId, below })
    } else {
      others += 1
    }
  }
  return { kuna, others }
}

async function folderToRead(drive: DocumentDrive, sourceId: string, folder: KunaFilesFolder): Promise<string | null> {
  return folder.fromPath === undefined ? childFolder(drive, sourceId, folder.name) : drive.folderAtPath(folder.fromPath)
}

/** The file's own folder, which is the old one while a move is unfinished. */
async function homeOfFile(drive: DocumentDrive, fileId: string): Promise<string> {
  return (await unfinishedMoveOf(drive, fileId)) ?? (await drive.parentOf(fileId))
}

async function backupsOf(drive: DocumentDrive, sourceId: string, app: string): Promise<{ readonly id: string; readonly files: readonly DriveEntry[] } | null> {
  const id = await childFolder(drive, sourceId, BACKUPS_FOLDER)
  return id === null ? null : { id, files: (await drive.children(id)).filter((entry) => entry.isAppAuthorized && backupDayOf(app, entry.name) !== null) }
}

/**
 * The backups Kuna made of the file: in the `backups` folder of its folder, and of the folder a move left unfinished, under a daily backup's name and made by the app.
 * They carry no property of their own, so these three are what tells them from anything else in there.
 */
export async function backupsOfDocument(drive: DocumentDrive, fileId: string, app: string): Promise<readonly DriveEntry[]> {
  const homes = new Set([await homeOfFile(drive, fileId), await drive.parentOf(fileId)])
  const found: DriveEntry[] = []
  for (const home of homes) {
    found.push(...((await backupsOf(drive, home, app))?.files ?? []))
  }
  return found
}

/** What a move of the file into the app's subfolder would take and leave, reading Drive and changing nothing. */
export async function planDriveMove(drive: DocumentDrive, fileId: string, app: string, beside: DriveFileBeside): Promise<DriveMovePlan> {
  const sourceId = await homeOfFile(drive, fileId)
  const entries = await drive.children(sourceId)
  const folders: KunaFilesInFolder[] = []
  for (const folder of beside.folders) {
    const folderId = await folderToRead(drive, sourceId, folder)
    if (folderId !== null) {
      const { kuna, others } = await filesWithin(drive, folderId, folder.mailSource)
      folders.push({ name: folder.name, kuna: kuna.length, others, ...(folder.fromPath === undefined ? {} : { fromPath: folder.fromPath }) })
    }
  }
  return {
    files: entries.filter((entry) => beside.files.includes(entry.name) && madeByKuna(entry, null)).map((entry) => entry.name),
    folders,
    backups: (await backupsOf(drive, sourceId, app))?.files.length ?? 0,
    stays: beside.stays,
  }
}

/** The folder at these names under the parent, each made when missing. */
async function folderBelow(drive: DocumentDrive, parentId: string, names: readonly string[]): Promise<string> {
  let current = parentId
  for (const name of names) {
    current = (await childFolder(drive, current, name)) ?? (await drive.createFolder(current, name))
  }
  return current
}

/** Moves a file into the folder, unless its name is taken there, which it then gives back so nothing is overwritten. */
async function moveFile(drive: DocumentDrive, entry: DriveEntry, sourceId: string, targetId: string): Promise<readonly string[]> {
  if ((await drive.children(targetId)).some((other) => other.name === entry.name)) return [entry.name]
  await drive.move(entry.id, sourceId, targetId)
  return []
}

/** Brings what Kuna made from beside the file, one file at a time, so a folder and whatever else it holds stay where they are. */
async function moveBeside(drive: DocumentDrive, sourceId: string, targetId: string, app: string, beside: DriveFileBeside): Promise<readonly string[]> {
  const left: string[] = []
  for (const entry of await drive.children(sourceId)) {
    if (beside.files.includes(entry.name) && madeByKuna(entry, null)) left.push(...(await moveFile(drive, entry, sourceId, targetId)))
  }
  for (const folder of beside.folders) {
    const folderId = await folderToRead(drive, sourceId, folder)
    if (folderId !== null) {
      for (const { entry, parentId, below } of (await filesWithin(drive, folderId, folder.mailSource)).kuna) {
        left.push(...(await moveFile(drive, entry, parentId, await folderBelow(drive, targetId, [folder.name, ...below]))))
      }
    }
  }
  const backups = await backupsOf(drive, sourceId, app)
  if (backups !== null && backups.files.length > 0) {
    const targetBackups = await folderBelow(drive, targetId, [BACKUPS_FOLDER])
    for (const entry of backups.files) {
      left.push(...(await moveFile(drive, entry, backups.id, targetBackups)))
    }
  }
  return left
}

/**
 * Moves the file into the app's subfolder of the Kuna folder, and what Kuna made beside it with it. The file goes first, since it is the one request
 * Drive may refuse: a refusal here moves nothing. The same request marks the file with where it came from, because the rest is found there. A later
 * failure leaves the mark, and pressing again carries on from it, until `finishDriveMove` clears it. Gives the names that stayed because their name
 * was taken. Trashes nothing, and a folder stays where it is with whatever Kuna did not make.
 */
export async function moveDriveDocument(drive: DocumentDrive, fileId: string, app: string, beside: DriveFileBeside, parentId: string | null): Promise<readonly string[]> {
  const parent = await drive.parentOf(fileId)
  const targetId = await kunaFolderOfApp(drive, app, parentId)
  const unfinished = await unfinishedMoveOf(drive, fileId)
  if (parent !== targetId) {
    try {
      await drive.move(fileId, parent, targetId, { [MOVED_FROM]: parent })
    } catch (refused) {
      throw new DriveMoveRefused(refused instanceof Error ? refused.message : String(refused))
    }
  }
  const sourceId = parent === targetId ? unfinished : parent
  return sourceId === null ? [] : moveBeside(drive, sourceId, targetId, app, beside)
}

/** The move is over: the file no longer says the rest is still to come. */
export async function finishDriveMove(drive: DocumentDrive, fileId: string): Promise<void> {
  await drive.setAppProperty(fileId, MOVED_FROM, null)
}
