import { startsAtBooksFolder } from '../text/folderPath'
import { googleFetch } from './googleApi'

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'

export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export const JSON_MIME_TYPE = 'application/json'

const IS_FOLDER = `mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`

export interface DriveFile {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  /** The revision the file's content stands at. Only files with binary content, such as JSON, have one. */
  readonly headRevisionId: string
  readonly parents: readonly string[]
  /** RFC 3339 time the file was made in Drive. */
  readonly createdTime: string
  /** The SHA-256 of the file's content in lower-case hex. Drive leaves it out for a Google document and for some uploads. */
  readonly sha256Checksum?: string
  /** The properties this app gave the file, which only it sees. */
  readonly appProperties?: Readonly<Record<string, string>>
}

/** What a new file is called, what it holds and where it goes. */
export interface NewDriveFile {
  readonly name: string
  readonly mimeType: string
  readonly parents: readonly string[]
  /** Properties only this app sees, which a search can find the file by. */
  readonly appProperties?: Readonly<Record<string, string>>
}

/** One revision of a file's content as `revisions.list` gives it. */
export interface DriveRevision {
  readonly id: string
  /** RFC 3339 time, by which Drive orders the list. Two revisions saved at the same moment can land in the other order. */
  readonly modifiedTime: string
  /** Only a revision kept forever can be downloaded once it is no longer the head. */
  readonly keepForever: boolean
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

/** Where a path of folder names leads: to one folder, or to a name no folder or several folders have, under `where`. */
type FolderOfPath =
  | { readonly kind: 'found'; readonly id: string }
  | { readonly kind: 'missing'; readonly where: string; readonly name: string }
  | { readonly kind: 'ambiguous'; readonly where: string; readonly name: string; readonly count: number }

/**
 * Drive has no search by path, so the path is walked one folder name at a time from the folder
 * `startId`, which messages call `start`. A name that two folders share is not guessed.
 */
async function folderBelow(accessToken: string, startId: string, start: string, path: readonly string[]): Promise<FolderOfPath> {
  let folderId = startId
  for (const [depth, name] of path.entries()) {
    const where = depth === 0 ? start : path.slice(0, depth).join('/')
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

/** Where a path of folder names from My Drive leads, which needs a token that reads the whole Drive. */
function folderOfPath(accessToken: string, path: readonly string[]): Promise<FolderOfPath> {
  return folderBelow(accessToken, 'root', 'My Drive', path)
}

/**
 * Where a folder setting's path leads. One that starts at the folder the books file is in, such as
 * `./statements`, is walked from there, which `drive.file` can do through the folders the app made.
 * Any other path is walked from My Drive.
 */
export async function folderOfSetting(accessToken: string, path: readonly string[], booksFileId: string): Promise<FolderOfPath> {
  if (!startsAtBooksFolder(path)) {
    return folderOfPath(accessToken, path)
  }
  const start = 'The folder of the books file'
  const parent = (await getFile(accessToken, booksFileId, ['parents'])).parents?.[0]
  return parent === undefined ? { kind: 'missing', where: start, name: path[1] ?? '' } : folderBelow(accessToken, parent, start, path.slice(1))
}

/** The folders directly inside the given ones, with the fields asked for, or none when none are given. */
export async function foldersInside<Field extends keyof DriveFile>(accessToken: string, folderIds: readonly string[], fields: readonly Field[]): Promise<Pick<DriveFile, Field>[]> {
  return folderIds.length === 0 ? [] : listChildren(accessToken, `(${inAnyOf(folderIds)}) and ${IS_FOLDER}`, fields)
}

/** The files directly inside the given folders, folders left out, with the fields asked for. */
export async function filesInside<Field extends keyof DriveFile>(accessToken: string, folderIds: readonly string[], fields: readonly Field[]): Promise<Pick<DriveFile, Field>[]> {
  return folderIds.length === 0 ? [] : listChildren(accessToken, `(${inAnyOf(folderIds)}) and mimeType != '${FOLDER_MIME_TYPE}' and trashed = false`, fields)
}

function inAnyOf(folderIds: readonly string[]): string {
  return folderIds.map((id) => `${queryLiteral(id)} in parents`).join(' or ')
}

/** The contents of a file that is not a Google document, never from the browser's HTTP cache, which could hold an older revision. */
export async function downloadFile(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const response = await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?alt=media`, accessToken, { cache: 'no-store' })
  return response.arrayBuffer()
}

/** One file's fields, never from the browser's HTTP cache, which could hold an older head revision. */
export async function getFile<Field extends keyof DriveFile>(accessToken: string, fileId: string, fields: readonly Field[]): Promise<Pick<DriveFile, Field>> {
  const query = new URLSearchParams({ fields: fields.join(',') })
  const response = await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?${query}`, accessToken, { cache: 'no-store' })
  return (await response.json()) as Pick<DriveFile, Field>
}

/** Deeper than any folder a person keeps books in, so a loop in the parents cannot run on. */
const DEEPEST_FOLDER = 64

/**
 * The names of the folders from My Drive down to this one, walked up through each folder's parent
 * with a token that can read the whole Drive. Null for a folder that is not in My Drive, such as one
 * shared with the person. Under `drive.file` alone Drive answers 404 for the parents.
 */
export async function pathFromMyDrive(accessToken: string, folderId: string): Promise<string[] | null> {
  const { id: rootId } = await getFile(accessToken, 'root', ['id'])
  const names: string[] = []
  let current = folderId
  for (let depth = 0; depth < DEEPEST_FOLDER; depth += 1) {
    if (current === rootId) {
      return names.reverse()
    }
    const folder = await getFile(accessToken, current, ['name', 'parents'])
    const parent = folder.parents?.[0]
    if (parent === undefined) {
      return null
    }
    names.push(folder.name)
    current = parent
  }
  return null
}

/** The files a search finds by a property this app gave them, read page by page. */
export async function filesWithAppProperty<Field extends keyof DriveFile>(accessToken: string, key: string, value: string, fields: readonly Field[]): Promise<Pick<DriveFile, Field>[]> {
  return listChildren(accessToken, `appProperties has { key=${queryLiteral(key)} and value=${queryLiteral(value)} } and trashed = false`, fields)
}

export async function createFolder(accessToken: string, parentId: string, name: string): Promise<Pick<DriveFile, 'id' | 'name' | 'mimeType'>> {
  const response = await googleFetch(`${DRIVE_FILES_API}?fields=id,name,mimeType`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE, parents: [parentId] }),
  })
  return (await response.json()) as Pick<DriveFile, 'id' | 'name' | 'mimeType'>
}

/** Creates a file with its metadata and content in one multipart upload. */
export async function createFile<Field extends keyof DriveFile>(accessToken: string, file: NewDriveFile, content: BlobPart, fields: readonly Field[]): Promise<Pick<DriveFile, Field>> {
  const boundary = `kuna-${crypto.randomUUID()}`
  const body = new Blob(
    [
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(file)}\r\n--${boundary}\r\nContent-Type: ${file.mimeType}\r\n\r\n`,
      content,
      `\r\n--${boundary}--`,
    ],
    { type: `multipart/related; boundary=${boundary}` },
  )
  const query = new URLSearchParams({ uploadType: 'multipart', fields: fields.join(',') })
  const response = await googleFetch(`${DRIVE_UPLOAD_API}?${query}`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return (await response.json()) as Pick<DriveFile, Field>
}

/**
 * Replaces a file's content with one media upload and gives the head revision it made. With
 * `keepForever` Drive keeps that revision, up to 200 of a file, until the app lets go of it.
 */
export async function uploadContent(accessToken: string, fileId: string, content: BlobPart, mimeType: string, keepForever: boolean): Promise<string> {
  const query = new URLSearchParams({ uploadType: 'media', fields: 'headRevisionId' })
  if (keepForever) {
    query.set('keepRevisionForever', 'true')
  }
  const response = await googleFetch(`${DRIVE_UPLOAD_API}/${encodeURIComponent(fileId)}?${query}`, accessToken, {
    method: 'PATCH',
    headers: { 'Content-Type': mimeType },
    body: new Blob([content], { type: mimeType }),
  })
  return ((await response.json()) as Pick<DriveFile, 'headRevisionId'>).headRevisionId
}

/** Moves a file to the bin, from which a person can still restore it for 30 days. */
export async function trashFile(accessToken: string, fileId: string): Promise<void> {
  await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?fields=id`, accessToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  })
}

/** Every revision of a file's content, in Drive's order, read page by page and never from the browser's HTTP cache. */
export async function listRevisions(accessToken: string, fileId: string): Promise<DriveRevision[]> {
  const revisions: DriveRevision[] = []
  let pageToken: string | undefined
  do {
    const parameters = new URLSearchParams({ fields: 'nextPageToken,revisions(id,modifiedTime,keepForever)', pageSize: '1000' })
    if (pageToken !== undefined) {
      parameters.set('pageToken', pageToken)
    }
    const response = await googleFetch(`${revisionsOf(fileId)}?${parameters}`, accessToken, { cache: 'no-store' })
    const page = (await response.json()) as { revisions?: DriveRevision[]; nextPageToken?: string }
    revisions.push(...(page.revisions ?? []).map((revision) => ({ ...revision, keepForever: revision.keepForever === true })))
    pageToken = page.nextPageToken
  } while (pageToken !== undefined)
  return revisions
}

/** The content of one revision. Drive downloads only a revision kept forever, or the head. */
export async function downloadRevision(accessToken: string, fileId: string, revisionId: string): Promise<ArrayBuffer> {
  const response = await googleFetch(`${revisionsOf(fileId)}/${encodeURIComponent(revisionId)}?alt=media`, accessToken)
  return response.arrayBuffer()
}

/** Lets Drive purge a revision in its own time, which frees its place among the 200 kept ones. */
export async function unkeepRevision(accessToken: string, fileId: string, revisionId: string): Promise<void> {
  await googleFetch(`${revisionsOf(fileId)}/${encodeURIComponent(revisionId)}?fields=id`, accessToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepForever: false }),
  })
}

function revisionsOf(fileId: string): string {
  return `${DRIVE_FILES_API}/${encodeURIComponent(fileId)}/revisions`
}
