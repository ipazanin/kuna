import type { PricesDrive } from '../../application/pricesPorts'
import { words } from '../words'
import type { FakeDrive } from '../../../../../shared/storage/infrastructure/fake/fakeDrive'
import { FOLDER_MIME_TYPE } from '../../../../../shared/google/driveClient'
import { fakeDriveSession } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'

/** The prices file's requests on a fake Drive, each one recorded by name as the fake records the books'. */
export function pricesDriveOn(drive: FakeDrive): PricesDrive {
  return {
    parentOf: (fileId) => drive.parentOf(fileId),
    async filesNamed(folderId, name) {
      return (await drive.children(folderId)).filter((entry) => entry.name === name && entry.mimeType !== FOLDER_MIME_TYPE).map((entry) => entry.id)
    },
    createFile: (parentId, name, text) => drive.createFile(parentId, name, text),
    async headRevision(fileId) {
      try {
        return await drive.headRevision(fileId)
      } catch {
        return null
      }
    },
    download: (fileId) => drive.download(fileId),
    async overwrite(fileId, text) {
      const uploaded = await drive.upload(fileId, text)
      if (uploaded.kind !== 'uploaded') {
        throw new Error(words.fakeRevisionsFull)
      }
      return uploaded.revision
    },
  }
}

/** The fake build's Drive, the one its books are kept on. */
export function fakePricesDrive(): PricesDrive {
  return pricesDriveOn(fakeDriveSession())
}
