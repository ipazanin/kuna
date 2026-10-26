import { downloadFile, filesInside, folderOfPath, foldersInside } from '../../../shared/google/driveClient'
import type { StatementFolder } from '../application/statementFolder'

/** Drive v3 with a token that can read the whole Drive. A name that two folders share is refused instead of guessed. */
export function googleStatementFolder(accessToken: string): StatementFolder {
  return {
    async files(path) {
      const folder = await folderOfPath(accessToken, path)
      switch (folder.kind) {
        case 'missing':
          return { kind: 'refused', reason: `${folder.where} holds no folder named "${folder.name}", so no statements were read. Check the statements_folder setting.` }
        case 'ambiguous':
          return { kind: 'refused', reason: `${folder.where} holds ${folder.count} folders named "${folder.name}", so the app cannot tell which one holds the statements. Rename or remove the others in Drive.` }
        case 'found': {
          const years = await foldersInside(accessToken, [folder.id], ['id'])
          return { kind: 'listed', files: await filesInside(accessToken, years.map((year) => year.id), ['id', 'name']) }
        }
      }
    },

    download(file) {
      return downloadFile(accessToken, file.id)
    },
  }
}
