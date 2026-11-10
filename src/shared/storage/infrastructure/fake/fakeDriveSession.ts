import { FOLDER_MIME_TYPE } from '../../../google/driveClient'
import { GoogleApiError } from '../../../google/googleApi'
import { currentToken, tokenFor } from '../../../google/googleAuth'
import type { DriveAccess } from '../documentStorePorts'
import { APP_PROPERTY } from '../../domain/driveMarks'
import { BACKUPS_FOLDER } from '../driveDocument'
import { createFakeDrive } from './fakeDrive'
import type { FakeDrive } from './fakeDrive'

/** The folder of My Drive the fake build keeps the books in, which its Picker always picks. */
export const FAKE_BOOKS_FOLDER = 'Books'

let session: FakeDrive | null = null
let racing: ((text: string) => string) | null = null
let held: ReadonlySet<string> = new Set()
let uploadMs = 0
let failingUpload = false

const SLOW_UPLOAD_MS = 2_500

/** The fake build's Drive, the same one for every read and save until the page reloads. */
export function fakeDriveSession(): FakeDrive {
  session ??= createFakeDrive()
  return session
}

/** The folder the fake build keeps the books in, made on first use. */
export async function fakeBooksFolder(): Promise<string> {
  const drive = fakeDriveSession()
  const existing = (await drive.children('root')).find((entry) => entry.mimeType === FOLDER_MIME_TYPE && entry.name === FAKE_BOOKS_FOLDER)
  return existing?.id ?? (await drive.createFolder('root', FAKE_BOOKS_FOLDER))
}

/**
 * Two backups Kuna made beside the app's file and one file a person put in that folder, so a check can see which go to the bin. Also lets a check
 * list what is left in the folder through `window.kunaFakeBackupsLeft()`, since the fake Drive lives only in the page.
 */
export async function seedFakeBackups(fileId: string, app: string): Promise<void> {
  const drive = fakeDriveSession()
  const folder = await drive.createFolder(drive.file(fileId).parents[0] ?? 'root', BACKUPS_FOLDER)
  await drive.createFile(folder, `kuna-${app}-2026-10-01.json`, '{}')
  await drive.createFile(folder, `kuna-${app}-2026-10-02.json`, '{}')
  const theirs = await drive.createFile(folder, 'my-notes.json', '{}')
  drive.file(theirs.id).isAppAuthorized = false
  ;(window as unknown as { kunaFakeBackupsLeft: () => Promise<string[]> }).kunaFakeBackupsLeft = async () => (await drive.children(folder)).map((entry) => entry.name).sort()
}

/** Makes the next save meet a save another device made a moment before its upload, which `otherDeviceSave` makes from the file as it stands. */
export function raceTheNextSave(otherDeviceSave: (text: string) => string): void {
  racing = otherDeviceSave
}

/** Makes every save take a few seconds to land, so a check can see the page while it writes. */
export function slowUploads(): void {
  uploadMs = SLOW_UPLOAD_MS
}

/** Makes the next save fail once it has waited its upload, as a Drive that answers with an error does. */
export function failNextUpload(): void {
  failingUpload = true
}

/** Makes every read of the file wait for good, so a screen shows what it shows while its books open. */
export function holdReadsOf(fileId: string): void {
  held = new Set([...held, fileId])
}

/** Never settles for a held file. */
async function unlessHeld(fileId: string): Promise<void> {
  if (held.has(fileId)) await new Promise<never>(() => {})
}

/** The app's file wherever it sits, which the fake build's Picker always picks, or null while Drive holds none. */
async function fakeBooksFile(app: string): Promise<string | null> {
  return (await fakeDriveSession().findByAppProperty(APP_PROPERTY, app))[0] ?? null
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
 * or the app's file. Its folder path, like Google's, needs a token that carries Drive read.
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
        if (uploadMs > 0) await new Promise((resolve) => setTimeout(resolve, uploadMs))
        if (failingUpload) {
          failingUpload = false
          throw new GoogleApiError(`https://www.googleapis.com/upload/drive/v3/files/${fileId}`, 500, '')
        }
        if (racing !== null) {
          const otherDeviceSave = racing
          racing = null
          await drive.upload(fileId, otherDeviceSave(await drive.download(fileId)))
        }
        return drive.upload(fileId, text)
      },
    },
    // As the real one, so a token that lapsed asks Google again. The fake build's page holds one from the start.
    async signIn(then) {
      if (currentToken('drive.file') === null) await tokenFor('drive.file', then)
    },
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
