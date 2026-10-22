import { googleFetch } from '../../../shared/google/googleApi'
import { listChildren } from '../../../shared/google/driveClient'
import { pickFromDrive } from '../../../shared/google/picker'
import type { DriveEntry, InvoiceDrive, MailDrafts } from '../application/invoiceRun'
import { rawInvoiceMessage } from './invoiceMessage'

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'
const GMAIL_DRAFTS_API = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

function entryOf(file: { readonly id: string; readonly name: string; readonly mimeType: string }): DriveEntry {
  return { id: file.id, name: file.name, folder: file.mimeType === FOLDER_MIME_TYPE }
}

/** Drive v3 with a `drive.file` token. */
export function googleInvoiceDrive(accessToken: string): InvoiceDrive {
  return {
    async children(folderId) {
      return (await listChildren(accessToken, folderId)).map(entryOf)
    },

    async pickFolders(parentId, title) {
      const picked = await pickFromDrive('folder', accessToken, { ...(parentId === null ? {} : { parentId }), title, several: parentId !== null })
      return picked.map(entryOf)
    },

    async createFolder(parentId, name) {
      const response = await googleFetch(`${DRIVE_FILES_API}?fields=id,name,mimeType`, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, parents: [parentId] }),
      })
      return entryOf(await response.json())
    },

    async createPdf(folderId, name, pdf) {
      const boundary = `ledgerboard-${crypto.randomUUID()}`
      const metadata = JSON.stringify({ name, mimeType: 'application/pdf', parents: [folderId] })
      const body = new Blob(
        [
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
          pdf as BlobPart,
          `\r\n--${boundary}--`,
        ],
        { type: `multipart/related; boundary=${boundary}` },
      )
      const response = await googleFetch(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,mimeType`, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      })
      return entryOf(await response.json())
    },

    async replacePdf(fileId, pdf) {
      await googleFetch(`${DRIVE_UPLOAD_API}/${encodeURIComponent(fileId)}?uploadType=media`, accessToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/pdf' },
        body: new Blob([pdf as BlobPart], { type: 'application/pdf' }),
      })
    },
  }
}

/** Gmail drafts with a `gmail.compose` token. */
export function gmailDrafts(accessToken: string): MailDrafts {
  return {
    async create(mail, attachment) {
      await googleFetch(GMAIL_DRAFTS_API, accessToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { raw: rawInvoiceMessage(mail, attachment.fileName, attachment.pdf) } }),
      })
    },
  }
}
