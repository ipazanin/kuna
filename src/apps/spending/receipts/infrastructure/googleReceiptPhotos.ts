import { RECEIPTS_FOLDER } from '../application/receiptPhotos'
import type { ReceiptPhotos } from '../application/receiptPhotos'
import { FOLDER_MIME_TYPE, createFile, createFolder, getFile, listChildren, queryLiteral } from '../../../../shared/google/driveClient'
import { newRecordId } from '../../../../shared/storage/domain/recordId'

const EXTENSION = /\.[a-z0-9]+$/i

/** The Receipts folder beside the Spending file, made on first use. `drive.file` sees the folder since the app made it. */
async function photosFolderId(accessToken: string, booksFileId: string): Promise<string> {
  const parent = (await getFile(accessToken, booksFileId, ['parents'])).parents?.[0]
  if (parent === undefined) throw new Error(`The file ${booksFileId} has no folder.`)
  const query = `${queryLiteral(parent)} in parents and name = ${queryLiteral(RECEIPTS_FOLDER)} and mimeType = ${queryLiteral(FOLDER_MIME_TYPE)} and trashed = false`
  const [held] = await listChildren(accessToken, query, ['id'])
  return held?.id ?? (await createFolder(accessToken, parent, RECEIPTS_FOLDER)).id
}

/** Drive v3 with a `drive.file` token. */
export function googleReceiptPhotos(accessToken: string, booksFileId: string): ReceiptPhotos {
  return {
    async keep(photo, issuedOn) {
      const folder = await photosFolderId(accessToken, booksFileId)
      const name = `receipt-${issuedOn}-${newRecordId().slice(0, 8)}${EXTENSION.exec(photo.name)?.[0] ?? ''}`
      return (await createFile(accessToken, { name, mimeType: photo.type === '' ? 'application/octet-stream' : photo.type, parents: [folder] }, photo, ['id'])).id
    },
  }
}
