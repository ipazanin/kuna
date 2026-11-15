import { createFile, createFolder, FOLDER_MIME_TYPE, listChildren, queryLiteral, uploadContent } from '../../../../shared/google/driveClient'
import { pickFromDrive } from '../../../../shared/google/picker'
import type { DriveEntry, FilingDrive } from '../application/driveFiling'

function entryOf(file: { readonly id: string; readonly name: string; readonly mimeType: string }): DriveEntry {
  return { id: file.id, name: file.name, folder: file.mimeType === FOLDER_MIME_TYPE }
}

/** Drive v3 with a `drive.file` token. */
export function googleFilingDrive(accessToken: string): FilingDrive {
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

    async createFile(folderId, name, content, mimeType) {
      return entryOf(await createFile(accessToken, { name, mimeType, parents: [folderId] }, content as BlobPart, ['id', 'name', 'mimeType']))
    },

    async replaceFile(fileId, content, mimeType) {
      await uploadContent(accessToken, fileId, content as BlobPart, mimeType, false)
    },
  }
}
