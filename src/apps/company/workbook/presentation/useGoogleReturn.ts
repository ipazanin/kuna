import { useWorkbook } from '../application/workbookStore'
import { useFindDriveFile } from './useFindDriveFile'
import type { RedirectReturn } from '../../../../shared/google/googleRedirect'

/**
 * Picks up after a tap's trip to Google: runs the sync, finds the books or opens the Picker, as the
 * tap asked. A tap that resumes nothing, such as onboarding's access step, is back on its route,
 * which shows what Google allowed. A refusal, and the silent trip either way, show in the sync
 * control only. Call it before auto-sync starts, so a Picker to open goes first.
 */
export function useGoogleReturn(answer: RedirectReturn | null, sync: () => Promise<void>): void {
  if (answer === null || answer.kind === 'refused' || answer.ask === 'silent') {
    return
  }
  const store = useWorkbook()
  const { findDriveFile } = useFindDriveFile()
  switch (answer.resume) {
    case 'sync':
      void store.open().then(sync)
      return
    case 'find':
    case 'pick': {
      const lookup = answer.resume
      void store.open().then(() => findDriveFile(lookup))
      return
    }
    case 'none':
      return
  }
}
