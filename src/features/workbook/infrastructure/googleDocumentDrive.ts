import {
  createFile,
  createFolder,
  downloadFile,
  downloadRevision,
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

const JSON_MIME_TYPE = 'application/json'

/** Drive v3 with a `drive.file` token. */
export function googleDocumentDrive(accessToken: string): DocumentDrive {
  const decoder = new TextDecoder()

  return {
    async headRevision(fileId) {
      return (await getFile(accessToken, fileId, ['headRevisionId'])).headRevisionId
    },

    async download(fileId) {
      return decoder.decode(await downloadFile(accessToken, fileId))
    },

    async upload(fileId, text) {
      try {
        return { kind: 'uploaded', revision: await uploadContent(accessToken, fileId, text, JSON_MIME_TYPE, true) }
      } catch (failure) {
        if (failure instanceof GoogleApiError && failure.reason === 'keptRevisionsLimitExceeded') {
          return { kind: 'kept-revisions-full' }
        }
        throw failure
      }
    },

    revisions(fileId) {
      return listRevisions(accessToken, fileId)
    },

    async downloadRevision(fileId, revisionId) {
      return decoder.decode(await downloadRevision(accessToken, fileId, revisionId))
    },

    unkeepRevision(fileId, revisionId) {
      return unkeepRevision(accessToken, fileId, revisionId)
    },

    async parentOf(fileId) {
      const [parentId] = (await getFile(accessToken, fileId, ['parents'])).parents
      if (parentId === undefined) {
        throw new Error('The file has no folder the app can see, so it has nowhere to keep backups.')
      }
      return parentId
    },

    children(folderId) {
      return listChildren(accessToken, `${queryLiteral(folderId)} in parents and trashed = false`, ['id', 'name', 'mimeType'])
    },

    async createFolder(parentId, name) {
      return (await createFolder(accessToken, parentId, name)).id
    },

    async createFile(parentId, name, text, appProperties = {}) {
      const created = await createFile(accessToken, { name, mimeType: JSON_MIME_TYPE, parents: [parentId], appProperties }, text, ['id', 'headRevisionId'])
      return { id: created.id, revision: created.headRevisionId }
    },

    trash(fileId) {
      return trashFile(accessToken, fileId)
    },

    async findByAppProperty(key, value) {
      return (await filesWithAppProperty(accessToken, key, value, ['id'])).map((file) => file.id)
    },
  }
}
