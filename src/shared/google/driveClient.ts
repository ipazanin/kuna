import { googleFetch } from './googleApi'

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files'
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const FILE_FIELDS = 'id,name,mimeType,parents'

export const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export interface DriveFile {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  readonly parents?: string[]
}

/** A text as a quoted literal of a Drive search query, its backslashes and quotes escaped. */
export function queryLiteral(text: string): string {
  return `'${text.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

export async function getFile(accessToken: string, fileId: string): Promise<DriveFile> {
  const query = new URLSearchParams({ fields: FILE_FIELDS })
  const response = await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?${query}`, accessToken)
  return (await response.json()) as DriveFile
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

/** The contents of a file that is not a Google document. */
export async function downloadFile(accessToken: string, fileId: string): Promise<ArrayBuffer> {
  const response = await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?alt=media`, accessToken)
  return response.arrayBuffer()
}

/** Exports a Google Sheet as an xlsx file. Google caps an export at 10 MB. */
export async function exportAsXlsx(accessToken: string, fileId: string): Promise<Blob> {
  const query = new URLSearchParams({ mimeType: XLSX_MIME_TYPE })
  const response = await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}/export?${query}`, accessToken)
  return response.blob()
}
