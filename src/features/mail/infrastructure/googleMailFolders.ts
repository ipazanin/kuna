import { filesInside, filesWithAppProperty, folderOfPath, foldersInside } from '../../../shared/google/driveClient'
import type { MailFolders } from '../application/mailFiling'
import { MAIL_DATE_PROPERTY, MAIL_SOURCE_PROPERTY } from '../domain/mailSource'

/** A folder found below a source's folder, by its id and its folder names from there down. */
interface FoundFolder {
  readonly id: string
  readonly folders: readonly string[]
}

function startsWith(path: readonly string[], start: readonly string[]): boolean {
  return start.length <= path.length && start.every((name, index) => path[index] === name)
}

/**
 * Drive v3 with a token that carries Drive read, since `drive.file` cannot see what another app
 * filed. Only the folders on the way to the ones asked for are listed, one level per call, so a
 * year of months costs a few calls. A folder name two folders share is read from both.
 */
export function googleMailFolders(accessToken: string): MailFolders {
  return {
    async filesIn(path, below) {
      const folder = await folderOfPath(accessToken, path)
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

    async newestFiled(source) {
      const filed = await filesWithAppProperty(accessToken, MAIL_SOURCE_PROPERTY, source, ['appProperties'])
      const dates = filed.map((file) => Date.parse(file.appProperties?.[MAIL_DATE_PROPERTY] ?? '')).filter(Number.isFinite)
      return dates.length === 0 ? null : Math.max(...dates)
    },
  }
}
