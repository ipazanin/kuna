import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'

import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import type { DriveFilePlace } from '../application/workbookPorts'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'

export interface DriveFilePlaceRead {
  /** Where the file on screen sits, or null until it is known. */
  readonly place: ComputedRef<DriveFilePlace | null>
  read(): Promise<void>
}

/** Where the Drive file sits, read again after each save or sync that changed it and once the page holds a token, since asking for one needs a click. */
export function useDriveFilePlace(store: Pick<WorkbookStore<BooksRead, DocumentCopy, WorkbookDocument>, 'state' | 'driveFilePlace'>, holdsToken: () => boolean): DriveFilePlaceRead {
  const held = ref<{ readonly fileId: string; readonly found: DriveFilePlace } | null>(null)
  const source = computed(() => store.state.choice?.source ?? store.state.snapshot?.meta.source ?? null)
  const revision = computed(() => (source.value === 'drive' ? (store.state.snapshot?.revision ?? null) : null))

  async function read(): Promise<void> {
    const fileId = store.state.snapshot?.meta.id
    const asked = revision.value
    if (asked === null || fileId === undefined) return
    try {
      const found = await store.driveFilePlace()
      if (revision.value === asked) held.value = found === null ? null : { fileId, found }
    } catch {
      // The folder and the backup are extras. The file itself still syncs and saves.
    }
  }

  watch([revision, holdsToken], read, { immediate: true })

  return {
    place: computed(() => (held.value !== null && held.value.fileId === store.state.snapshot?.meta.id ? held.value.found : null)),
    read,
  }
}
