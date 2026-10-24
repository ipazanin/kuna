import { googleFetch } from '../../../shared/google/googleApi'
import { createFile, createFolder, FOLDER_MIME_TYPE, listChildren, queryLiteral, uploadContent } from '../../../shared/google/driveClient'
import { pickFromDrive } from '../../../shared/google/picker'
import type { DriveEntry, InvoiceDrive, MailDrafts } from '../application/invoiceRun'
import { rawInvoiceMessage } from './invoiceMessage'

const PDF_MIME_TYPE = 'application/pdf'
const GMAIL_DRAFTS_API = 'https://gmail.googleapis.com/gmail/v1/users/me/drafts'

function entryOf(file: { readonly id: string; readonly name: string; readonly mimeType: string }): DriveEntry {
  return { id: file.id, name: file.name, folder: file.mimeType === FOLDER_MIME_TYPE }
}

/** Drive v3 with a `drive.file` token. */
export function googleInvoiceDrive(accessToken: string): InvoiceDrive {
  return {
    async children(folderId) {
      return (await listChildren(accessToken, `${queryLiteral(folderId)} in parents and trashed = false`, ['id', 'name', 'mimeType'])).map(entryOf)
    },

    async pickFolders(parentId, title) {
      const picked = await pickFromDrive('folder', accessToken, { ...(parentId === null ? {} : { parentId }), title, several: parentId !== null })
      return picked.map(entryOf)
    },

    async createFolder(parentId, name) {
      return entryOf(await createFolder(accessToken, parentId, name))
    },

    async createPdf(folderId, name, pdf) {
      return entryOf(await createFile(accessToken, { name, mimeType: PDF_MIME_TYPE, parents: [folderId] }, pdf as BlobPart, ['id', 'name', 'mimeType']))
    },

    async replacePdf(fileId, pdf) {
      await uploadContent(accessToken, fileId, pdf as BlobPart, PDF_MIME_TYPE, false)
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
