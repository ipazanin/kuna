import type { DocumentCopy } from './documentRecordStorage'
import { openWorkbookCache } from './workbookCache'
import { saveWorkbookChoice } from './workbookChoice'

/** Fills this browser's cache with the copy, as a successful read would, and chooses its file for the app on this device. The fake and the real-books seeds start an app this way. */
export async function keepChosenCopy(app: string, copy: DocumentCopy): Promise<void> {
  const cache = openWorkbookCache(copy.meta.id)
  try {
    await cache.replace(copy)
  } finally {
    cache.close()
  }
  saveWorkbookChoice(app, { source: copy.meta.source, id: copy.meta.id, name: copy.meta.title })
}
