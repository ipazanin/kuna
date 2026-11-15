import type { FilingPath } from '../domain/filingPath'
import { words } from './words'

/** A file or folder in Drive as the app sees it. */
export interface DriveEntry {
  readonly id: string
  readonly name: string
  readonly folder: boolean
}

/**
 * Drive as a `drive.file` token reaches it: only files and folders the app made or the person
 * picked. A folder another app made stays out of a listing until it is picked once.
 */
export interface FilingDrive {
  /** What the app can see inside a folder. */
  children(folderId: string): Promise<readonly DriveEntry[]>
  /** Opens Google's Picker on folders, inside `parentId` or from My Drive when it is null. Empty when cancelled. Picking grants the app what was picked. */
  pickFolders(parentId: string | null, title: string): Promise<readonly DriveEntry[]>
  createFolder(parentId: string, name: string): Promise<DriveEntry>
  createFile(folderId: string, name: string, content: Uint8Array, mimeType: string): Promise<DriveEntry>
  /** Gives a file the app can see new contents, keeping its id and links. */
  replaceFile(fileId: string, content: Uint8Array, mimeType: string): Promise<void>
}

/** Where a file goes: the deepest path folder found, the path folders still to make under it, and a file of the same name the app can see there. */
export interface FilingTarget {
  readonly folderId: string
  readonly toCreate: readonly string[]
  readonly fileName: string
  readonly existing: DriveEntry | null
}

export type FolderLookup =
  | { readonly kind: 'found'; readonly target: FilingTarget }
  /** No folder of the name is in view and none was picked. `path` names it with its parents, such as 2026/2026-10. */
  | { readonly kind: 'hidden'; readonly segment: string; readonly path: string }

/** The line the Picker shows above the folders inside a path folder's parent. */
export function pickerTitleFor(segment: string): string {
  return words.pickerTitle(segment)
}

/**
 * Finds each folder of the path by name among what the app can see, from the picked folder down.
 * A folder another app made, such as the invoice generator, is not in view until the person picks
 * it, and making a second one of the same name would split the files of a month. So a folder that
 * is not in view opens the Picker on its parent, and only a path in `create`, which the person
 * chose to make, is made, later by the filing step. A folder picked once stays in view.
 */
export async function locateFiling(drive: FilingDrive, rootId: string, path: FilingPath, create: ReadonlySet<string>): Promise<FolderLookup> {
  let current = rootId
  for (const [index, segment] of path.folders.entries()) {
    const prefix = path.folders.slice(0, index + 1).join('/')
    if (create.has(prefix)) {
      return { kind: 'found', target: { folderId: current, toCreate: path.folders.slice(index), fileName: path.fileName, existing: null } }
    }
    const named = (entries: readonly DriveEntry[]): DriveEntry | undefined => entries.find((entry) => entry.folder && entry.name === segment)
    const found = named(await drive.children(current)) ?? named(await drive.pickFolders(current, pickerTitleFor(segment)))
    if (found === undefined) {
      return { kind: 'hidden', segment, path: prefix }
    }
    current = found.id
  }
  const existing = (await drive.children(current)).find((entry) => !entry.folder && entry.name === path.fileName) ?? null
  return { kind: 'found', target: { folderId: current, toCreate: [], fileName: path.fileName, existing } }
}

/** A file to put on Drive. */
export interface DriveFile {
  readonly name: string
  readonly content: Uint8Array
  readonly mimeType: string
}

/** How a file went onto Drive: new, over the file of its name, or new where an earlier one of its name might be hidden. `refused` leaves a file of its name in place. */
export type Filed = 'filed' | 'replaced' | 'filed-over-unseen' | 'refused'

/**
 * Makes the path folders still to make, keeping each in `filing` as it is made so a retry goes on from there, then files the file.
 * A file of its name in view is replaced when `replace` says so, and otherwise left in place.
 */
export async function fileOnDrive(drive: FilingDrive, filing: { target: FilingTarget }, file: DriveFile, replace: boolean): Promise<Filed> {
  while (filing.target.toCreate.length > 0) {
    const [name, ...rest] = filing.target.toCreate as [string, ...string[]]
    const made = await drive.createFolder(filing.target.folderId, name)
    filing.target = { ...filing.target, folderId: made.id, toCreate: rest }
  }
  const existing = (await drive.children(filing.target.folderId)).find((entry) => !entry.folder && entry.name === file.name) ?? null
  if (existing !== null && !replace) return 'refused'
  if (existing !== null) {
    await drive.replaceFile(existing.id, file.content, file.mimeType)
    return 'replaced'
  }
  await drive.createFile(filing.target.folderId, file.name, file.content, file.mimeType)
  return replace ? 'filed-over-unseen' : 'filed'
}
