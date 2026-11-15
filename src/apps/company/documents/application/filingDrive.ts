import { tokenFor } from '../../../../shared/google/googleAuth'
import { googleFilingDrive } from '../infrastructure/googleFilingDrive'
import type { FilingDrive } from './driveFiling'

/**
 * Drive with the page's token, or with a new one, which opens Google's popup. Call it first in a
 * click handler, since Firefox opens the popup only while the click is recent. A phone never leaves
 * the page for it, so what is on screen stays.
 */
export async function filingDrive(): Promise<FilingDrive> {
  // Inline, not hoisted, so a production build folds the fake away.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeFilingDriveSession } = await import('../infrastructure/fake/fakeFilingDrive')
    return fakeFilingDriveSession().drive
  }
  return googleFilingDrive(await tokenFor('drive.file', null))
}
