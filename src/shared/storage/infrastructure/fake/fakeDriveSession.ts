import { FOLDER_MIME_TYPE } from '../../../google/driveClient'
import { currentToken } from '../../../google/googleAuth'
import type { DriveAccess } from '../documentStorePorts'
import { APP_PROPERTY } from '../driveDocument'
import { createFakeDrive } from './fakeDrive'
import type { FakeDrive } from './fakeDrive'

/** The folder of My Drive the fake build keeps the books in, which its Picker always picks. */
const BOOKS_FOLDER = 'Books'

let session: FakeDrive | null = null
let racing: ((text: string) => string) | null = null
let held: ReadonlySet<string> = new Set()

/** The fake build's Drive, the same one for every read and save until the page reloads. */
export function fakeDriveSession(): FakeDrive {
  session ??= createFakeDrive()
  return session
}

/** The folder the fake build keeps the books in, made on first use. */
export async function fakeBooksFolder(): Promise<string> {
  const drive = fakeDriveSession()
  const existing = (await drive.children('root')).find((entry) => entry.mimeType === FOLDER_MIME_TYPE && entry.name === BOOKS_FOLDER)
  return existing?.id ?? (await drive.createFolder('root', BOOKS_FOLDER))
}

/** Makes the next save meet a save another device made a moment before its upload, which `otherDeviceSave` makes from the file as it stands. */
export function raceTheNextSave(otherDeviceSave: (text: string) => string): void {
  racing = otherDeviceSave
}

/** Makes every read of the file wait for good, so a screen shows what it shows while its books open. */
export function holdReadsOf(fileId: string): void {
  held = new Set([...held, fileId])
}

/** Never settles for a held file. */
async function unlessHeld(fileId: string): Promise<void> {
  if (held.has(fileId)) await new Promise<never>(() => {})
}

/** The app's file in the books folder, which the fake build's Picker always picks, or null while the folder holds none. */
async function fakeBooksFile(app: string): Promise<string | null> {
  const drive = fakeDriveSession()
  const folder = (await drive.children('root')).find((entry) => entry.mimeType === FOLDER_MIME_TYPE && entry.name === BOOKS_FOLDER)
  const files = folder === undefined ? [] : await drive.children(folder.id)
  return files.find((entry) => entry.mimeType !== FOLDER_MIME_TYPE && drive.file(entry.id).appProperties[APP_PROPERTY] === app)?.id ?? null
}

/** The names of the folders from My Drive down to this one on the fake Drive. */
function fakePathOf(drive: FakeDrive, folderId: string): string[] {
  const names: string[] = []
  for (let current = folderId; current !== 'root'; current = drive.file(current).parents[0] ?? 'root') {
    names.unshift(drive.file(current).name)
  }
  return names
}

/**
 * The fake build never goes to Google: it is always signed in, and its Picker picks the books folder
 * or the app's file in it. Its folder path, like Google's, needs a token that carries Drive read.
 */
export function fakeDriveAccess(app: string): DriveAccess {
  const drive = fakeDriveSession()
  return {
    drive: {
      ...drive,
      async headRevision(fileId) {
        await unlessHeld(fileId)
        return drive.headRevision(fileId)
      },
      async download(fileId) {
        await unlessHeld(fileId)
        return drive.download(fileId)
      },
      async upload(fileId, text) {
        if (racing !== null) {
          const otherDeviceSave = racing
          racing = null
          await drive.upload(fileId, otherDeviceSave(await drive.download(fileId)))
        }
        return drive.upload(fileId, text)
      },
    },
    signIn: async () => {},
    signedIn: () => true,
    async pickFolder() {
      const id = await fakeBooksFolder()
      return { id, name: drive.file(id).name }
    },
    async folderPath(folderId) {
      return currentToken('drive.readonly') === null ? null : fakePathOf(drive, folderId)
    },
    pickFile: () => fakeBooksFile(app),
  }
}
