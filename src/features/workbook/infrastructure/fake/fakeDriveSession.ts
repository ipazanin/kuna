import { FOLDER_MIME_TYPE } from '../../../../shared/google/driveClient'
import { decodeDocument, encodeDocument } from '../documentFormat'
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

/** The fake build never goes to Google: it is always signed in, its Picker picks the books folder, and it never offers a file to pick. */
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
    pickFolder: fakeBooksFolder,
    pickFile: async () => null,
  }
}
