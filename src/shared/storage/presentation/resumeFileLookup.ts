import type { Router } from 'vue-router'

import type { RedirectReturn } from '../../google/googleRedirect'
import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'
import { useFindFile } from './useFindFile'
import type { FindFileWords } from './useFindFile'

/** An app's file and the routes its find or pick goes between. */
export interface FileLookupResume {
  readonly store: Pick<WorkbookStore<BooksRead, DocumentCopy, WorkbookDocument>, 'state' | 'open' | 'chooseDriveFile'>
  readonly words: FindFileWords
  readonly startRoute: string
  readonly overviewRoute: string
}

/**
 * Carries on with a find or a pick of the app's file that Google's return hands over, once the store is open. A find
 * the first run left for ends on the Overview, as the find step's own tap does. Any other return does nothing.
 */
export function resumeFileLookup(resume: FileLookupResume, router: Router, googleReturn: RedirectReturn | null): void {
  if (googleReturn?.kind !== 'granted' || (googleReturn.resume !== 'find' && googleReturn.resume !== 'pick')) return
  const findFile = useFindFile(resume.store, resume.words)
  const lookup = googleReturn.resume
  void resume.store.open().then(async () => {
    const opened = await findFile(lookup)
    await router.isReady()
    if (opened && router.currentRoute.value.path === resume.startRoute) await router.push(resume.overviewRoute)
  })
}
