import {
  createFile,
  createFolder,
  downloadFile,
  downloadRevision,
  JSON_MIME_TYPE,
  filesWithAppProperty,
  getFile,
  listChildren,
  listRevisions,
  queryLiteral,
  trashFile,
  unkeepRevision,
  uploadContent,
} from '../../../shared/google/driveClient'
import { GoogleApiError } from '../../../shared/google/googleApi'
import type { DocumentDrive } from './driveDocument'

/** Drive v3 with a `drive.file` token, which `accessToken` gives for each request, so one drive serves a file for as long as the page holds it. */
export function googleDocumentDrive(accessToken: () => Promise<string>): DocumentDrive {
  const decoder = new TextDecoder()

  return {
    async headRevision(fileId) {
      return (await getFile(await accessToken(), fileId, ['headRevisionId'])).headRevisionId
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

    async unkeepRevision(fileId, revisionId) {
      return unkeepRevision(await accessToken(), fileId, revisionId)
    },

    async parentOf(fileId) {
      const [parentId] = (await getFile(await accessToken(), fileId, ['parents'])).parents
      if (parentId === undefined) {
        throw new Error('The file has no folder the app can see, so it has nowhere to keep backups.')
      }
      return parentId
    },

    async nameOf(fileId) {
      return (await getFile(await accessToken(), fileId, ['name'])).name
    },

    async children(folderId) {
      return listChildren(await accessToken(), `${queryLiteral(folderId)} in parents and trashed = false`, ['id', 'name', 'mimeType'])
    },

    async createFolder(parentId, name) {
      return (await createFolder(await accessToken(), parentId, name)).id
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
  }
}
