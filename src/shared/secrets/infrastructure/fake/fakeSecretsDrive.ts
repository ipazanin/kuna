import type { SecretsDrive } from '../../application/secretsDrive'
import { APP_DATA_FOLDER } from '../../../google/driveClient'
import type { FakeDrive } from '../../../storage/infrastructure/fake/fakeDrive'
import { fakeDriveSession } from '../../../storage/infrastructure/fake/fakeDriveSession'

/** The secrets file's requests on a fake Drive, whose hidden folder of the app is the parent `appDataFolder`, as Google's is. */
export function secretsDriveOn(drive: FakeDrive): SecretsDrive {
  return {
    async files() {
      return (await drive.children(APP_DATA_FOLDER)).map((entry) => ({ id: entry.id, name: entry.name }))
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
export function fakeSecretsDrive(): SecretsDrive {
  return secretsDriveOn(fakeDriveSession())
}
