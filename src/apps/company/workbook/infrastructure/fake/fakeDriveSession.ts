import { FOLDER_MIME_TYPE } from '../../../../../shared/google/driveClient'
import { currentToken } from '../../../../../shared/google/googleAuth'
import { decodeDocument, encodeDocument } from '../../../../../shared/storage/infrastructure/documentFormat'
import type { DriveAccess } from '../documentStorePorts'
import { createFakeDrive } from './fakeDrive'
import type { FakeDrive } from './fakeDrive'

/** The folder of My Drive the fake build keeps the books in, which its Picker always picks. */
const BOOKS_FOLDER = 'Books'

let session: FakeDrive | null = null
let racing = false

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

/** Makes the next save meet a save another device made a moment before its upload: the snack kiosk's row filed as travel on a phone. */
export function raceTheNextSave(): void {
  racing = true
}

function otherDeviceSave(text: string): string {
  const document = decodeDocument(text)
  const ledger = (document.records['ledger-row'] ?? []).map((row) => (row.counterparty === 'SNACK KIOSK' ? { ...row, category: 'travel', flagged_by: 'phone' } : row))
  return encodeDocument({ ...document, records: { ...document.records, 'ledger-row': ledger } })
}

/** The file in the books folder, which the fake build's Picker always picks, or null while the folder holds none. */
async function fakeBooksFile(): Promise<string | null> {
  const drive = fakeDriveSession()
  const folder = (await drive.children('root')).find((entry) => entry.mimeType === FOLDER_MIME_TYPE && entry.name === BOOKS_FOLDER)
  const files = folder === undefined ? [] : await drive.children(folder.id)
  return files.find((entry) => entry.mimeType !== FOLDER_MIME_TYPE)?.id ?? null
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
 * or the file in it. Its folder path, like Google's, needs a token that carries Drive read.
 */
export function fakeDriveAccess(): DriveAccess {
  const drive = fakeDriveSession()
  return {
    drive: {
      ...drive,
      async upload(fileId, text) {
        if (racing) {
          racing = false
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
    pickFile: fakeBooksFile,
  }
}
