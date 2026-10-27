import { createFile, createFolder, filesInside, filesWithAppProperty, folderOfSetting, foldersInside } from '../../../shared/google/driveClient'
import { XLSX_MIME_TYPE } from '../../../shared/xlsx/sheetGrids'
import type { MailFolders } from '../application/mailFiling'
import { MAIL_DATE_PROPERTY, MAIL_SOURCE_PROPERTY } from '../domain/mailSource'

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  xml: 'application/xml',
  xlsx: XLSX_MIME_TYPE,
}

/** The media type a file is uploaded as, by the end of its name. */
function mediaTypeOf(name: string): string {
  return MEDIA_TYPES[/\.([^.]+)$/.exec(name)?.[1]?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}

/** A folder found below a source's folder, by its id and its folder names from there down. */
interface FoundFolder {
  readonly id: string
  readonly folders: readonly string[]
}

function startsWith(path: readonly string[], start: readonly string[]): boolean {
  return start.length <= path.length && start.every((name, index) => path[index] === name)
}

/**
 * Drive v3 with a token that carries `drive.file`, which makes files and folders, and Drive read for
 * a folder from My Drive, since `drive.file` cannot see what another app filed. A folder from the one
 * `booksFileId` is in holds only what the app made, so `drive.file` reads it. Only the folders on the
 * way to the ones asked for are listed, one level per call, so a year of months costs a few calls. A
 * folder name two folders share is read from both, and a file goes into the first. The folders found
 * or made on the way to a new file are kept for the rest of the run.
 */
export function googleMailFolders(accessToken: string, booksFileId: string): MailFolders {
  const folderIds = new Map<string, string>()

  /** The id of the folder at the path, found by `find` once a run. */
  async function folderAt(path: readonly string[], find: () => Promise<string>): Promise<string> {
    const key = JSON.stringify(path)
    const id = folderIds.get(key) ?? (await find())
    folderIds.set(key, id)
    return id
  }

  async function sourceFolder(path: readonly string[]): Promise<string> {
    const folder = await folderOfSetting(accessToken, path, booksFileId)
    if (folder.kind !== 'found') {
      throw new Error(`${folder.where} holds ${folder.kind === 'missing' ? 'no folder' : `${folder.count} folders`} named "${folder.name}"`)
    }
    return folder.id
  }

  async function childFolder(parentId: string, name: string): Promise<string> {
    const inside = await foldersInside(accessToken, [parentId], ['id', 'name'])
    return inside.find((folder) => folder.name === name)?.id ?? (await createFolder(accessToken, parentId, name)).id
  }

  return {
    async filesIn(path, below) {
      const folder = await folderOfSetting(accessToken, path, booksFileId)
      switch (folder.kind) {
        case 'missing':
          return { kind: 'refused', reason: `${folder.where} holds no folder named "${folder.name}"` }
        case 'ambiguous':
          return { kind: 'refused', reason: `${folder.where} holds ${folder.count} folders named "${folder.name}", so the app cannot tell which one is meant` }
        case 'found': {
          let level: FoundFolder[] = [{ id: folder.id, folders: [] }]
          const targets = below.some((folders) => folders.length === 0) ? [...level] : []
          for (let depth = 0; level.length > 0 && below.some((folders) => folders.length > depth); depth += 1) {
            const inside = await foldersInside(
              accessToken,
              level.map((entry) => entry.id),
              ['id', 'name', 'parents'],
            )
            level = inside.flatMap((child) => {
              const parent = level.find((entry) => child.parents.includes(entry.id))
              const folders = parent === undefined ? null : [...parent.folders, child.name]
              return folders !== null && below.some((wanted) => startsWith(wanted, folders)) ? [{ id: child.id, folders }] : []
            })
            targets.push(...level.filter((entry) => below.some((wanted) => wanted.length === entry.folders.length && startsWith(wanted, entry.folders))))
          }
          const files = await filesInside(
            accessToken,
            targets.map((target) => target.id),
            ['name', 'parents', 'createdTime', 'sha256Checksum', 'appProperties'],
          )
          return {
            kind: 'listed',
            files: files.flatMap((file) => {
              const target = targets.find((candidate) => file.parents.includes(candidate.id))
              return target === undefined
                ? []
                : [{ folders: target.folders, name: file.name, createdTime: Date.parse(file.createdTime), sha256: file.sha256Checksum ?? null, filedByApp: file.appProperties?.[MAIL_SOURCE_PROPERTY] !== undefined }]
            }),
          }
        }
      }
    },

    async create(folder, below, file) {
      let parentId = await folderAt(folder, () => sourceFolder(folder))
      for (const [depth, name] of below.entries()) {
        const parent = parentId
        parentId = await folderAt([...folder, ...below.slice(0, depth + 1)], () => childFolder(parent, name))
      }
      await createFile(accessToken, { name: file.name, mimeType: mediaTypeOf(file.name), parents: [parentId], appProperties: file.properties }, file.bytes, ['id'])
    },

    async newestFiled(source) {
      const filed = await filesWithAppProperty(accessToken, MAIL_SOURCE_PROPERTY, source, ['appProperties'])
      const dates = filed.map((file) => Date.parse(file.appProperties?.[MAIL_DATE_PROPERTY] ?? '')).filter(Number.isFinite)
      return dates.length === 0 ? null : Math.max(...dates)
    },
  }
}
