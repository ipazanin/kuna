import { GOOGLE_SHEET_MIME_TYPE, downloadFile, exportAsXlsx, filesInside, folderOfPath, foldersInside } from '../../../shared/google/driveClient'
import type { DriveFile } from '../../../shared/google/driveClient'
import { XLSX_MIME_TYPE, readEveryTab } from '../../../shared/xlsx/sheetGrids'
import type { AccountantFolders, DriveWorkbook } from '../application/accountantDocuments'

type ListedFile = Pick<DriveFile, 'id' | 'name' | 'mimeType' | 'version'>

/**
 * Drive v3 with the Drive read token. Drive lists one folder level at a time, so the folders are
 * walked a level per pair of listings: the files of every folder of the level, and the folders
 * inside them. A Google Sheet is exported as xlsx, so both formats read the same way.
 */
export function googleAccountantFolders(accessToken: string): AccountantFolders {
  return {
    async files(path) {
      const folder = await folderOfPath(accessToken, path)
      switch (folder.kind) {
        case 'missing':
          return { kind: 'refused', reason: `${folder.where} holds no folder named "${folder.name}"` }
        case 'ambiguous':
          return { kind: 'refused', reason: `${folder.where} holds ${folder.count} folders named "${folder.name}", so the app cannot tell which one is meant` }
        case 'found': {
          const files: ListedFile[] = []
          let level = [folder.id]
          while (level.length > 0) {
            const [inLevel, inside] = await Promise.all([filesInside(accessToken, level, ['id', 'name', 'mimeType', 'version']), foldersInside(accessToken, level)])
            files.push(...inLevel)
            level = inside.map((child) => child.id)
          }
          return { kind: 'listed', files: files.flatMap(workbookOf) }
        }
      }
    },

    async tabs(file) {
      return readEveryTab(file.format === 'google-sheet' ? await exportAsXlsx(accessToken, file.id) : await downloadFile(accessToken, file.id))
    },
  }
}

function workbookOf(file: ListedFile): DriveWorkbook[] {
  const format = file.mimeType === GOOGLE_SHEET_MIME_TYPE ? 'google-sheet' : file.mimeType === XLSX_MIME_TYPE || /\.xlsx$/i.test(file.name) ? 'xlsx' : null
  return format === null ? [] : [{ id: file.id, name: file.name, format, version: file.version }]
}
