import { FOLDER_MIME_TYPE, downloadFile, listChildren, queryLiteral } from '../../../shared/google/driveClient'
import type { StatementFolder } from '../application/statementFolder'

const IS_FOLDER = `mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`

/**
 * Drive v3 with a token that can read the whole Drive. Drive has no search by path, so the path is
 * walked one folder name at a time from My Drive. A name that two folders share is refused instead
 * of guessed.
 */
export function googleStatementFolder(accessToken: string): StatementFolder {
  return {
    async files(path) {
      let folderId = 'root'
      for (const [depth, segment] of path.entries()) {
        const where = depth === 0 ? 'My Drive' : path.slice(0, depth).join('/')
        const found = await listChildren(accessToken, `${queryLiteral(folderId)} in parents and name = ${queryLiteral(segment)} and ${IS_FOLDER}`, ['id'])
        if (found.length === 0) {
          return { kind: 'refused', reason: `${where} holds no folder named "${segment}", so no statements were read. Check the statements_folder setting.` }
        }
        if (found.length > 1) {
          return { kind: 'refused', reason: `${where} holds ${found.length} folders named "${segment}", so the app cannot tell which one holds the statements. Rename or remove the others in Drive.` }
        }
        folderId = found[0]!.id
      }
      const years = await listChildren(accessToken, `${queryLiteral(folderId)} in parents and ${IS_FOLDER}`, ['id'])
      if (years.length === 0) {
        return { kind: 'listed', files: [] }
      }
      const inYears = years.map((year) => `${queryLiteral(year.id)} in parents`).join(' or ')
      return { kind: 'listed', files: await listChildren(accessToken, `(${inYears}) and mimeType != '${FOLDER_MIME_TYPE}' and trashed = false`, ['id', 'name']) }
    },

    download(file) {
      return downloadFile(accessToken, file.id)
    },
  }
}
