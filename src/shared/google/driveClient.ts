import { XLSX_MIME_TYPE } from '../xlsx/sheetGrids'
import { googleFetch } from './googleApi'

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files'

export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export const GOOGLE_SHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet'

const IS_FOLDER = `mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`

export interface DriveFile {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  /** Goes up with every change to the file, so a copy read at one version still holds while the version does. */
  readonly version: string
}

/** A text as a quoted literal of a Drive search query, its backslashes and quotes escaped. */
export function queryLiteral(text: string): string {
  return `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

/**
 * The files a Drive search query finds, with the fields asked for, read page by page. Under
 * drive.file that may be fewer than all the files the query describes.
 */
export async function listChildren<Field extends keyof DriveFile>(accessToken: string, query: string, fields: readonly Field[]): Promise<Pick<DriveFile, Field>[]> {
  const files: Pick<DriveFile, Field>[] = []
  let pageToken: string | undefined
  do {
    const parameters = new URLSearchParams({ q: query, fields: `nextPageToken,files(${fields.join(',')})`, pageSize: '1000' })
    if (pageToken !== undefined) {
      parameters.set('pageToken', pageToken)
    }
    const response = await googleFetch(`${DRIVE_FILES_API}?${parameters}`, accessToken)
    const page = (await response.json()) as { files?: Pick<DriveFile, Field>[]; nextPageToken?: string }
    files.push(...(page.files ?? []))
    pageToken = page.nextPageToken
  } while (pageToken !== undefined)
  return files
}

/** Where a path of folder names from My Drive leads: to one folder, or to a name no folder or several folders have, under `where`. */
type FolderOfPath =
  | { readonly kind: 'found'; readonly id: string }
  | { readonly kind: 'missing'; readonly where: string; readonly name: string }
  | { readonly kind: 'ambiguous'; readonly where: string; readonly name: string; readonly count: number }

/**
 * Drive has no search by path, so the path is walked one folder name at a time from My Drive. A name
 * that two folders share is not guessed.
 */
export async function folderOfPath(accessToken: string, path: readonly string[]): Promise<FolderOfPath> {
  let folderId = 'root'
  for (const [depth, name] of path.entries()) {
    const where = depth === 0 ? 'My Drive' : path.slice(0, depth).join('/')
    const found = await listChildren(accessToken, `${queryLiteral(folderId)} in parents and name = ${queryLiteral(name)} and ${IS_FOLDER}`, ['id'])
    if (found.length === 0) {
      return { kind: 'missing', where, name }
    }
    if (found.length > 1) {
      return { kind: 'ambiguous', where, name, count: found.length }
    }
    folderId = found[0]!.id
  }
  return { kind: 'found', id: folderId }
}

/** The folders directly inside the given ones, or none when none are given. */
export async function foldersInside(accessToken: string, folderIds: readonly string[]): Promise<Pick<DriveFile, 'id'>[]> {
  return folderIds.length === 0 ? [] : listChildren(accessToken, `(${inAnyOf(folderIds)}) and ${IS_FOLDER}`, ['id'])
}

/** The files directly inside the given folders, folders left out, with the fields asked for. */
export async function filesInside<Field extends keyof DriveFile>(accessToken: string, folderIds: readonly string[], fields: readonly Field[]): Promise<Pick<DriveFile, Field>[]> {
  return folderIds.length === 0 ? [] : listChildren(accessToken, `(${inAnyOf(folderIds)}) and mimeType != '${FOLDER_MIME_TYPE}' and trashed = false`, fields)
}

function inAnyOf(folderIds: readonly string[]): string {
  return folderIds.map((id) => `${queryLiteral(id)} in parents`).join(' or ')
}

/** The contents of a file that is not a Google document. */
export async function downloadFile(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const response = await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?alt=media`, accessToken)
  return response.arrayBuffer()
}

/** A Google Sheet as the contents of an xlsx file. Google caps an export at 10 MB. */
export async function exportAsXlsx(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const query = new URLSearchParams({ mimeType: XLSX_MIME_TYPE })
  const response = await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}/export?${query}`, accessToken)
  return response.arrayBuffer()
}
