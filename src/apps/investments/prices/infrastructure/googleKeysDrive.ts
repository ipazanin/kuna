import type { KeysDrive } from '../application/pricesPorts'
import { APP_DATA_FOLDER, createFile, deleteFile, downloadFile, JSON_MIME_TYPE, listChildren, queryLiteral, uploadContent } from '../../../../shared/google/driveClient'
import { tokenFor } from '../../../../shared/google/googleAuth'

/** The page's token for the app's hidden folder, which the Keys step of the sync asks for. */
function appFolderToken(): Promise<string> {
  return tokenFor('drive.appdata', null)
}

/** Drive v3 with a `drive.appdata` token, for the keys file in the app's hidden folder. */
export function googleKeysDrive(): KeysDrive {
  const decoder = new TextDecoder()
  return {
    async filesNamed(name) {
      return (await listChildren(await appFolderToken(), `name = ${queryLiteral(name)}`, ['id'], APP_DATA_FOLDER)).map((file) => file.id)
    },

    async createFile(name, text) {
      return (await createFile(await appFolderToken(), { name, mimeType: JSON_MIME_TYPE, parents: [APP_DATA_FOLDER] }, text, ['id'])).id
    },

    async download(fileId) {
      return decoder.decode(await downloadFile(await appFolderToken(), fileId))
    },

    async overwrite(fileId, text) {
      await uploadContent(await appFolderToken(), fileId, text, JSON_MIME_TYPE, false)
    },

    async delete(fileId) {
      await deleteFile(await appFolderToken(), fileId)
    },
  }
}
