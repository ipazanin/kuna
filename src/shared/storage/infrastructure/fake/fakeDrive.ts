import { FOLDER_MIME_TYPE, JSON_MIME_TYPE } from '../../../google/driveClient'
import type { DriveRevision } from '../../../google/driveClient'
import type { DocumentDrive, DocumentUpload } from '../driveDocument'

/** Drive's cap on the revisions of one file kept forever. */
const KEPT_REVISIONS_CAP = 200
/** The modified time of the fake's first revision. Each later one is a second after the one before. */
const CLOCK_START = Date.UTC(2026, 9, 24, 15, 0, 0)

export interface FakeRevision extends DriveRevision {
  readonly text: string
}

export interface FakeDriveFile {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  readonly parents: readonly string[]
  readonly appProperties: Readonly<Record<string, string>>
  trashed: boolean
  /** In the order they landed. Drive lists them by modified time instead. */
  readonly revisions: FakeRevision[]
  headRevisionId: string
}

/** An upload that reached the fake Drive and waits to land, its revision id and modified time given on arrival. */
export interface UploadInFlight {
  readonly fileId: string
  readonly text: string
  readonly revisionId: string
}

/**
 * A Drive held in memory, with revisions and the 200 kept revision cap, which records every request
 * by name. Uploads can be held in flight and landed in any order, so a test can race two devices.
 */
export interface FakeDrive extends DocumentDrive {
  readonly requests: string[]
  file(fileId: string): FakeDriveFile
  /** From now on uploads wait in flight until `land` lands them. */
  holdUploads(): void
  /** Resolves once `count` uploads are in flight, in the order they arrived. */
  uploadsInFlight(count: number): Promise<readonly UploadInFlight[]>
  /** Lands the uploads in flight in this order, then answers them, and answers later uploads at once. */
  land(order: readonly UploadInFlight[]): void
  /** A save from outside the app, such as Drive for Desktop's, whose revision is not kept forever. */
  editOutside(fileId: string, text: string): void
}

export function createFakeDrive(): FakeDrive {
  const files = new Map<string, FakeDriveFile>()
  const requests: string[] = []
  let ticks = 0
  let holding = false
  const inFlight: (UploadInFlight & { readonly modifiedTime: string; readonly answer: () => void })[] = []
  const waiting: { readonly count: number; readonly resolve: (uploads: readonly UploadInFlight[]) => void }[] = []

  function next(): { readonly id: string; readonly modifiedTime: string } {
    ticks += 1
    return { id: `rev-${String(ticks).padStart(4, '0')}`, modifiedTime: new Date(CLOCK_START + ticks * 1000).toISOString() }
  }

  function fileOf(fileId: string): FakeDriveFile {
    const file = files.get(fileId)
    if (file === undefined) {
      throw new Error(`404 from the fake Drive: File not found: ${fileId}.`)
    }
    return file
  }

  function add(parentId: string, name: string, mimeType: string, text: string, appProperties: Readonly<Record<string, string>>): FakeDriveFile {
    const revision = next()
    const file: FakeDriveFile = {
      id: `file-${files.size + 1}`,
      name,
      mimeType,
      parents: [parentId],
      appProperties,
      trashed: false,
      revisions: [{ ...revision, keepForever: false, text }],
      headRevisionId: revision.id,
    }
    files.set(file.id, file)
    return file
  }

  function landRevision(fileId: string, revision: FakeRevision): void {
    const file = fileOf(fileId)
    file.revisions.push(revision)
    file.headRevisionId = revision.id
  }

  function wake(): void {
    for (const waiter of [...waiting]) {
      if (inFlight.length >= waiter.count) {
        waiting.splice(waiting.indexOf(waiter), 1)
        waiter.resolve(inFlight.map(({ fileId, text, revisionId }) => ({ fileId, text, revisionId })))
      }
    }
  }

  return {
    requests,

    file: fileOf,

    holdUploads() {
      holding = true
    },

    uploadsInFlight(count) {
      return new Promise((resolve) => {
        waiting.push({ count, resolve })
        wake()
      })
    },

    land(order) {
      holding = false
      const landing = order.map((upload) => {
        const held = inFlight.find((candidate) => candidate.revisionId === upload.revisionId)
        if (held === undefined) {
          throw new Error(`No upload ${upload.revisionId} is in flight.`)
        }
        return held
      })
      for (const held of landing) {
        landRevision(held.fileId, { id: held.revisionId, modifiedTime: held.modifiedTime, keepForever: true, text: held.text })
        inFlight.splice(inFlight.indexOf(held), 1)
      }
      for (const held of landing) {
        held.answer()
      }
    },

    editOutside(fileId, text) {
      landRevision(fileId, { ...next(), keepForever: false, text })
    },

    async headRevision(fileId) {
      requests.push('headRevision')
      return fileOf(fileId).headRevisionId
    },

    async download(fileId) {
      requests.push('download')
      const file = fileOf(fileId)
      return file.revisions.find((revision) => revision.id === file.headRevisionId)!.text
    },

    async upload(fileId, text): Promise<DocumentUpload> {
      requests.push('upload')
      if (fileOf(fileId).revisions.filter((revision) => revision.keepForever).length >= KEPT_REVISIONS_CAP) {
        return { kind: 'kept-revisions-full' }
      }
      const { id, modifiedTime } = next()
      if (!holding) {
        landRevision(fileId, { id, modifiedTime, keepForever: true, text })
        return { kind: 'uploaded', revision: id }
      }
      return new Promise((resolve) => {
        inFlight.push({ fileId, text, revisionId: id, modifiedTime, answer: () => resolve({ kind: 'uploaded', revision: id }) })
        wake()
      })
    },

    async revisions(fileId) {
      requests.push('revisions')
      return [...fileOf(fileId).revisions]
        .sort((left, right) => left.modifiedTime.localeCompare(right.modifiedTime))
        .map(({ id, modifiedTime, keepForever }) => ({ id, modifiedTime, keepForever }))
    },

    async downloadRevision(fileId, revisionId) {
      requests.push('downloadRevision')
      const file = fileOf(fileId)
      const revision = file.revisions.find((candidate) => candidate.id === revisionId)
      if (revision === undefined || !(revision.keepForever || revision.id === file.headRevisionId)) {
        throw new Error(`403 from the fake Drive: revision ${revisionId} is not kept forever, so it cannot be downloaded.`)
      }
      return revision.text
    },

    async unkeepRevision(fileId, revisionId) {
      requests.push('unkeepRevision')
      const revisions = fileOf(fileId).revisions
      const index = revisions.findIndex((revision) => revision.id === revisionId)
      revisions[index] = { ...revisions[index]!, keepForever: false }
    },

    async parentOf(fileId) {
      requests.push('parentOf')
      return fileOf(fileId).parents[0]!
    },

    async nameOf(fileId) {
      requests.push('nameOf')
      return fileOf(fileId).name
    },

    async children(folderId) {
      requests.push('children')
      return [...files.values()].filter((file) => !file.trashed && file.parents.includes(folderId)).map(({ id, name, mimeType }) => ({ id, name, mimeType }))
    },

    async createFolder(parentId, name) {
      requests.push('createFolder')
      return add(parentId, name, FOLDER_MIME_TYPE, '', {}).id
    },

    async createFile(parentId, name, text, appProperties = {}) {
      requests.push('createFile')
      const file = add(parentId, name, JSON_MIME_TYPE, text, appProperties)
      return { id: file.id, revision: file.headRevisionId }
    },

    async trash(fileId) {
      requests.push('trash')
      fileOf(fileId).trashed = true
    },

    async findByAppProperty(key, value) {
      requests.push('findByAppProperty')
      return [...files.values()].filter((file) => !file.trashed && file.appProperties[key] === value).map((file) => file.id)
    },
  }
}
