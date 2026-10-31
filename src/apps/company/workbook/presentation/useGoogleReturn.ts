import { useWorkbook } from '../application/workbookStore'
import { useFindDriveFile } from './useFindDriveFile'
import type { RedirectReturn } from '../../../../shared/google/googleRedirect'

/**
 * Picks up after a tap's trip to Google that the company's books asked for: finds the books or
 * opens the Picker, as the tap asked, and resolves to whether a Drive file is now open. The shell
 * hands over only such a return, and resumes a sync itself. A refusal shows in the sync control
 * only. Call it before auto-sync starts, so a Picker to open goes first.
 */
export async function useGoogleReturn(answer: RedirectReturn | null): Promise<boolean> {
  if (answer === null || answer.kind === 'refused' || answer.ask === 'silent' || (answer.resume !== 'find' && answer.resume !== 'pick')) {
    return false
  }
  const store = useWorkbook()
  const { findDriveFile } = useFindDriveFile()
  const lookup = answer.resume
  await store.open()
  return findDriveFile(lookup)
}
