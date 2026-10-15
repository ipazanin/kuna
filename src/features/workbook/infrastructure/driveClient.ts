import { googleFetch } from './googleApi'

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files'
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const FILE_FIELDS = 'id,name,mimeType,parents'

export interface DriveFile {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  readonly parents?: string[]
}

export async function getFile(accessToken: string, fileId: string): Promise<DriveFile> {
  const query = new URLSearchParams({ fields: FILE_FIELDS })
  const response = await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?${query}`, accessToken)
  return (await response.json()) as DriveFile
}

/** Lists what this token can see inside a folder. Under drive.file that may be fewer than all its files. */
export async function listChildren(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const query = new URLSearchParams({
      q: `'${folderId.replaceAll("'", "\\'")}' in parents and trashed = false`,
      fields: `nextPageToken,files(${FILE_FIELDS})`,
      pageSize: '1000',
    })
    if (pageToken !== undefined) {
      query.set('pageToken', pageToken)
    }
    const response = await googleFetch(`${DRIVE_FILES_API}?${query}`, accessToken)
    const page = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string }
    files.push(...(page.files ?? []))
    pageToken = page.nextPageToken
  } while (pageToken !== undefined)
  return files
}

/** Exports a Google Sheet as an xlsx file. Google caps an export at 10 MB. */
export async function exportAsXlsx(accessToken: string, fileId: string): Promise<Blob> {
  const query = new URLSearchParams({ mimeType: XLSX_MIME_TYPE })
  const response = await googleFetch(`${DRIVE_FILES_API}/${encodeURIComponent(fileId)}/export?${query}`, accessToken)
  return response.blob()
}
