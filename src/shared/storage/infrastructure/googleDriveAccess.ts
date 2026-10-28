import { pathFromMyDrive } from '../../google/driveClient'
import { currentToken, tokenFor } from '../../google/googleAuth'
import { pickFromDrive } from '../../google/picker'
import type { DriveAccess } from './documentStorePorts'
import { googleDocumentDrive } from './googleDocumentDrive'

/** The page's token for the Drive file, or a new one, which needs the click that asked for it and on a phone fails instead of leaving the page. */
function driveToken(): Promise<string> {
  return tokenFor('drive.file', null)
}

/** Drive through the page's Google token, whose Picker for the books file shows this title. */
export function googleDriveAccess(pickFileTitle: string): DriveAccess {
  return {
    drive: googleDocumentDrive(driveToken),
    async signIn(then) {
      await tokenFor('drive.file', then)
    },
    signedIn: () => currentToken('drive.file') !== null,
    async pickFolder(title) {
      const [folder] = await pickFromDrive('folder', await driveToken(), { title, parentId: 'root' })
      return folder === undefined ? null : { id: folder.id, name: folder.name }
    },
    async folderPath(folderId) {
      const token = currentToken('drive.readonly')
      return token === null ? null : pathFromMyDrive(token, folderId)
    },
    async pickFile() {
      const [file] = await pickFromDrive('json', await driveToken(), { title: pickFileTitle })
      return file?.id ?? null
    },
  }
}
