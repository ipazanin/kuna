import { computed, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

import { withGoogleAccess } from '../../google/withGoogleAccess'
import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import type { PickedFolder } from '../application/workbookPorts'
import { kunaTrail } from './kunaTrail'
import { words } from './words'

export interface KunaFolderHome {
  /** The folder a new Kuna folder goes in, or null for the top of My Drive. */
  readonly parent: Readonly<Ref<PickedFolder | null>>
  /** True while Kuna may still be made here, so the person can say where. */
  readonly canChoose: ComputedRef<boolean>
  readonly picking: Readonly<Ref<boolean>>
  /** The app's subfolder as a person reads it, naming no place above the Kuna folder unless the app is making it there. */
  trail(appId: string): string
  /** Asks Drive again whether the Kuna folder exists. A failed or token-less read leaves that unknown, never "none". */
  read(): Promise<void>
  /** Asks for the folder the new Kuna folder goes in. It asks nothing when Drive already holds one. */
  chooseElsewhere(): Promise<void>
}

/** Where the Kuna folder goes the one time it is made, for the two screens that can make it: the first file on Drive, and the first move into it. */
export function useKunaFolderHome(store: Pick<WorkbookStore<BooksRead>, 'hasKunaFolder' | 'pickDriveFolder'>): KunaFolderHome {
  const parent = ref<PickedFolder | null>(null)
  const exists = ref<boolean | null>(null)
  const picking = ref(false)

  return {
    parent,
    canChoose: computed(() => exists.value !== true),
    picking,
    trail: (appId) => kunaTrail(appId, exists.value === false || parent.value !== null ? parent.value : undefined),
    async read() {
      exists.value = await store.hasKunaFolder().catch(() => null)
    },
    async chooseElsewhere() {
      picking.value = true
      try {
        await withGoogleAccess(['drive.file'], async () => {
          exists.value = await store.hasKunaFolder()
          if (exists.value === false) parent.value = (await store.pickDriveFolder(words.firstRun.folder.pickerTitle)) ?? parent.value
        })
      } finally {
        picking.value = false
      }
    },
  }
}
