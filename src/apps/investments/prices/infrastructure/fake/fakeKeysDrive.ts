import type { KeysDrive } from '../../application/pricesPorts'
import { APP_DATA_FOLDER } from '../../../../../shared/google/driveClient'
import type { FakeDrive } from '../../../../../shared/storage/infrastructure/fake/fakeDrive'
import { fakeDriveSession } from '../../../../../shared/storage/infrastructure/fake/fakeDriveSession'

/** The keys file's requests on a fake Drive, whose hidden folder of the app is the parent `appDataFolder`, as Google's is. */
export function keysDriveOn(drive: FakeDrive): KeysDrive {
  return {
    async filesNamed(name) {
      return (await drive.children(APP_DATA_FOLDER)).filter((entry) => entry.name === name).map((entry) => entry.id)
    },
    async createFile(name, text) {
      return (await drive.createFile(APP_DATA_FOLDER, name, text)).id
    },
    download: (fileId) => drive.download(fileId),
    async overwrite(fileId, text) {
      await drive.upload(fileId, text)
    },
    delete: (fileId) => drive.delete(fileId),
  }
}

/** The fake build's Drive, the one its books are kept on. */
export function fakeKeysDrive(): KeysDrive {
  return keysDriveOn(fakeDriveSession())
}
