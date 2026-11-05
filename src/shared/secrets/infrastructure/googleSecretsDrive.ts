import type { SecretsDrive } from '../application/secretsDrive'
import { APP_DATA_FOLDER, createFile, deleteFile, downloadFile, JSON_MIME_TYPE, listChildren, queryLiteral, uploadContent } from '../../google/driveClient'
import { tokenFor } from '../../google/googleAuth'

/** The page's token for the app's hidden folder, which the Keys step of the sync asks for. */
function appFolderToken(): Promise<string> {
  return tokenFor('drive.appdata', null)
}

/** Asks Google for the hidden folder when the page lacks it. On a phone that leaves the page and resumes nothing, so the person taps again once back. */
export async function allowHiddenFolder(): Promise<void> {
  await tokenFor('drive.appdata', { resume: 'none' })
}

/** Drive v3 with a `drive.appdata` token, for the secrets file in the app's hidden folder. */
export function googleSecretsDrive(): SecretsDrive {
  const decoder = new TextDecoder()
  return {
    async files() {
      return listChildren(await appFolderToken(), `${queryLiteral(APP_DATA_FOLDER)} in parents`, ['id', 'name'], APP_DATA_FOLDER)
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
