import { downloadFile, filesInside, folderOfSetting, foldersInside } from '../../../../shared/google/driveClient'
import type { StatementFolder } from '../application/statementFolder'
import { words } from './words'

/**
 * Drive v3 with a token that reads the folder: Drive read for a path from My Drive, and the books
 * file's own scope for a path from the folder `booksFileId` is in, which holds only what the app
 * made. A name that two folders share is refused instead of guessed.
 */
export function googleStatementFolder(accessToken: string, booksFileId: string): StatementFolder {
  return {
    async files(path) {
      const folder = await folderOfSetting(accessToken, path, booksFileId)
      switch (folder.kind) {
        case 'missing':
          return { kind: 'refused', reason: words.noFolder(folder.where, folder.name) }
        case 'ambiguous':
          return { kind: 'refused', reason: words.severalFolders(folder.where, folder.count, folder.name) }
        case 'found': {
          const years = await foldersInside(accessToken, [folder.id], ['id'])
          return {
            kind: 'listed',
            files: await filesInside(
              accessToken,
              years.map((year) => year.id),
              ['id', 'name'],
            ),
          }
        }
      }
    },

    download(file) {
      return downloadFile(accessToken, file.id)
    },
  }
}
