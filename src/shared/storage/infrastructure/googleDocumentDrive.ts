import {
  createFile,
  createFolder,
  downloadFile,
  downloadRevision,
  JSON_MIME_TYPE,
  filesWithAppProperty,
  folderOfMyDrivePath,
  getFile,
  listChildren,
  listRevisions,
  moveFile,
  queryLiteral,
  setAppProperty,
  trashFile,
  deleteRevision,
  uploadContent,
} from '../../google/driveClient'
import { GoogleApiError } from '../../google/googleApi'
import { DriveFileMissing } from '../application/driveFileMissing'
import type { DocumentDrive } from './driveDocument'
import { words } from './words'

/** Drive v3 with a `drive.file` token, which `accessToken` gives for each request, so one drive serves a file for as long as the page holds it. */
export function googleDocumentDrive(accessToken: () => Promise<string>): DocumentDrive {
  const decoder = new TextDecoder()

  return {
    async headRevision(fileId) {
      try {
        const file = await getFile(await accessToken(), fileId, ['headRevisionId', 'trashed'])
        if (file.trashed) {
          throw new DriveFileMissing(true)
        }
        return file.headRevisionId
      } catch (failure) {
        if (failure instanceof GoogleApiError && failure.status === 404) {
          throw new DriveFileMissing(false)
        }
        throw failure
      }
    },

    async download(fileId) {
      return decoder.decode(await downloadFile(await accessToken(), fileId))
    },

    async upload(fileId, text) {
      try {
        return { kind: 'uploaded', revision: await uploadContent(await accessToken(), fileId, text, JSON_MIME_TYPE, true) }
      } catch (failure) {
        if (failure instanceof GoogleApiError && failure.reason === 'keptRevisionsLimitExceeded') {
          return { kind: 'kept-revisions-full' }
        }
        throw failure
      }
    },

    async revisions(fileId) {
      return listRevisions(await accessToken(), fileId)
    },

    async downloadRevision(fileId, revisionId) {
      return decoder.decode(await downloadRevision(await accessToken(), fileId, revisionId))
    },

    async deleteRevision(fileId, revisionId) {
      return deleteRevision(await accessToken(), fileId, revisionId)
    },

    async parentOf(fileId) {
      const parentId = (await getFile(await accessToken(), fileId, ['parents'])).parents?.[0]
      if (parentId === undefined) {
        throw new Error(words.noFolder)
      }
      return parentId
    },

    async nameOf(fileId) {
      return (await getFile(await accessToken(), fileId, ['name'])).name
    },

    async children(folderId) {
      return listChildren(await accessToken(), `${queryLiteral(folderId)} in parents and trashed = false`, ['id', 'name', 'mimeType', 'appProperties', 'isAppAuthorized'])
    },

    async createFolder(parentId, name, appProperties) {
      return (await createFolder(await accessToken(), parentId, name, appProperties)).id
    },

    async move(fileId, fromParentId, toParentId, appProperties) {
      return moveFile(await accessToken(), fileId, fromParentId, toParentId, appProperties)
    },

    async appPropertyOf(fileId, key) {
      return (await getFile(await accessToken(), fileId, ['appProperties'])).appProperties?.[key] ?? null
    },

    async setAppProperty(fileId, key, value) {
      return setAppProperty(await accessToken(), fileId, key, value)
    },

    async folderAtPath(path) {
      const folder = await folderOfMyDrivePath(await accessToken(), path)
      return folder.kind === 'found' ? folder.id : null
    },

    async createFile(parentId, name, text, appProperties = {}) {
      const created = await createFile(await accessToken(), { name, mimeType: JSON_MIME_TYPE, parents: [parentId], appProperties }, text, ['id', 'headRevisionId'])
      return { id: created.id, revision: created.headRevisionId }
    },

    async trash(fileId) {
      return trashFile(await accessToken(), fileId)
    },

    async findByAppProperty(key, value) {
      return (await filesWithAppProperty(await accessToken(), key, value, ['id'])).map((file) => file.id)
    },

    async findOwnedByAppProperty(key, value) {
      return (await filesWithAppProperty(await accessToken(), key, value, ['id', 'ownedByMe'])).filter((file) => file.ownedByMe === true).map((file) => file.id)
    },
  }
}
