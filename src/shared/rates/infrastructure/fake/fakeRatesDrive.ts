import type { RatesDrive } from '../../application/ratesPorts'
import { RATES_FILE_NAME, RATES_MARK } from '../../domain/ratesFile'
import { APP_PROPERTY } from '../../../storage/domain/driveMarks'
import type { FakeDrive } from '../../../storage/infrastructure/fake/fakeDrive'
import { fakeDriveSession } from '../../../storage/infrastructure/fake/fakeDriveSession'
import { findKunaFolder } from '../../../storage/infrastructure/kunaFolder'

/** The rates file's requests on a fake Drive. */
export function ratesDriveOn(drive: FakeDrive): RatesDrive {
  return {
    async find() {
      return [...(await drive.findOwnedByAppProperty(APP_PROPERTY, RATES_MARK))].sort()[0] ?? null
    },
    download: (fileId) => drive.download(fileId),
    async overwrite(fileId, text) {
      await drive.upload(fileId, text)
    },
    async create(text, besideFileId) {
      const folderId = (await findKunaFolder(drive)) ?? (await drive.parentOf(besideFileId))
      return (await drive.createFile(folderId, RATES_FILE_NAME, text, { [APP_PROPERTY]: RATES_MARK })).id
    },
  }
}

/** The fake build's Drive, the one its books are kept on. */
export function fakeRatesDrive(): RatesDrive {
  return ratesDriveOn(fakeDriveSession())
}
