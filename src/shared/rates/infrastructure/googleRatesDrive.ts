import type { RatesDrive } from '../application/ratesPorts'
import { RATES_FILE_NAME, RATES_MARK } from '../domain/ratesFile'
import { createFile, downloadFile, filesWithAppProperty, getFile, JSON_MIME_TYPE, uploadContent } from '../../google/driveClient'
import { tokenFor } from '../../google/googleAuth'
import { APP_PROPERTY, KUNA_FOLDER_MARK } from '../../storage/domain/driveMarks'
import { words } from './words'

/** The page's token for the files Kuna made, as the books' requests take it. */
function driveToken(): Promise<string> {
  return tokenFor('drive.file', null)
}

/** The first of the files the person owns with Kuna's mark, by id, so two devices pick the same one. */
async function ownedWithMark(token: string, mark: string): Promise<string | null> {
  const found = await filesWithAppProperty(token, APP_PROPERTY, mark, ['id', 'ownedByMe'])
  return (
    found
      .filter((file) => file.ownedByMe === true)
      .map((file) => file.id)
      .sort()[0] ?? null
  )
}

/** Drive v3 with a `drive.file` token, for the rates file in the Kuna folder. */
export function googleRatesDrive(): RatesDrive {
  const decoder = new TextDecoder()
  return {
    async find() {
      return ownedWithMark(await driveToken(), RATES_MARK)
    },

    async download(fileId) {
      return decoder.decode(await downloadFile(await driveToken(), fileId))
    },

    async overwrite(fileId, text) {
      // Kept revisions would reach Drive's 200 in as many days, and the ECB's rates are fetched again anyway.
      await uploadContent(await driveToken(), fileId, text, JSON_MIME_TYPE, false)
    },

    async create(text, besideFileId) {
      const token = await driveToken()
      const folderId = (await ownedWithMark(token, KUNA_FOLDER_MARK)) ?? (await getFile(token, besideFileId, ['parents'])).parents[0]
      if (folderId === undefined) {
        throw new Error(words.noFolder)
      }
      const file = { name: RATES_FILE_NAME, mimeType: JSON_MIME_TYPE, parents: [folderId], appProperties: { [APP_PROPERTY]: RATES_MARK } }
      return (await createFile(token, file, text, ['id'])).id
    },
  }
}
