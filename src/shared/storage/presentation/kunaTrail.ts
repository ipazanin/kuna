import type { PickedFolder } from '../application/workbookPorts'
import { folderTrail } from '../../text/folderPath'
import { KUNA_FOLDER_NAME } from '../domain/kunaFolderName'

/**
 * The app's subfolder as a person reads it. A new Kuna folder at the top of My Drive starts there, with `null`. One picked elsewhere starts at
 * the picked folder's name. With no parent given the Kuna folder already exists, and only its name is known.
 */
export function kunaTrail(appId: string, parent: PickedFolder | null | undefined): string {
  if (parent === undefined) return [KUNA_FOLDER_NAME, appId].join(' › ')
  if (parent !== null) return [parent.name, KUNA_FOLDER_NAME, appId].join(' › ')
  return folderTrail([KUNA_FOLDER_NAME, appId])
}
