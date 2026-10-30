import type { PricesDrive } from '../application/pricesPorts'
import { createFile, downloadFile, FOLDER_MIME_TYPE, getFile, JSON_MIME_TYPE, listChildren, queryLiteral, uploadContent } from '../../../../shared/google/driveClient'
import { GoogleApiError } from '../../../../shared/google/googleApi'
import { tokenFor } from '../../../../shared/google/googleAuth'
import { words } from './words'

/** The page's token for the files Kuna made, as the books' requests take it. */
function driveToken(): Promise<string> {
  return tokenFor('drive.file', null)
}

/** Drive v3 with a `drive.file` token, for the prices file beside the Investments file. */
export function googlePricesDrive(): PricesDrive {
  const decoder = new TextDecoder()
  return {
    async parentOf(fileId) {
      const [parentId] = (await getFile(await driveToken(), fileId, ['parents'])).parents
      if (parentId === undefined) {
        throw new Error(words.noFolder)
      }
      return parentId
    },

    async filesNamed(folderId, name) {
      const query = `${queryLiteral(folderId)} in parents and name = ${queryLiteral(name)} and mimeType != ${queryLiteral(FOLDER_MIME_TYPE)} and trashed = false`
      return (await listChildren(await driveToken(), query, ['id'])).map((file) => file.id)
    },

    async createFile(parentId, name, text) {
      const created = await createFile(await driveToken(), { name, mimeType: JSON_MIME_TYPE, parents: [parentId] }, text, ['id', 'headRevisionId'])
      return { id: created.id, revision: created.headRevisionId }
    },

    async headRevision(fileId) {
      try {
        return (await getFile(await driveToken(), fileId, ['headRevisionId'])).headRevisionId
      } catch (failure) {
        if (failure instanceof GoogleApiError && failure.status === 404) {
          return null
        }
        throw failure
      }
    },

    async download(fileId) {
      return decoder.decode(await downloadFile(await driveToken(), fileId))
    },

    async overwrite(fileId, text) {
      // Kept revisions would reach Drive's 200 in as many days, and yesterday's prices are fetched again anyway.
      return uploadContent(await driveToken(), fileId, text, JSON_MIME_TYPE, false)
    },
  }
}
