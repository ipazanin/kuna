import { forgetSetUpAnswersOf } from '../../app/setUpAnswer'
import { usePageSync } from '../../sync/presentation/pageSync'
import { placesHeld, removeAppData } from '../application/appData'
import type { AppData, DataBeside } from '../application/appData'
import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'

type StoreOfData = Pick<WorkbookStore<BooksRead>, 'state' | 'dropWorkbook' | 'backupsOnDrive' | 'trashBackups'>

/** An app's data as the delete dialogs reach it, over the app's store and the page's sync. */
export function pageAppData(app: {
  readonly id: string
  readonly name: string
  readonly store: StoreOfData
  backUp(): Promise<string>
  readonly beside?: DataBeside
  /** What this device keeps of the app outside its file, beyond the answers and the assistant's switches every app has. */
  forgetOnThisDevice?(): void
}): AppData {
  const { state } = app.store
  return {
    id: app.id,
    name: app.name,
    held() {
      const { choice } = state
      if (choice === null) return null
      return {
        source: choice.source,
        fileName: choice.name,
        places: placesHeld(choice, state.missing),
        besideFileName: app.beside?.fileName ?? null,
        canBackUp: state.snapshot !== null,
        busy: state.waiting.length > 0,
      }
    },
    backUp: () => app.backUp(),
    backupsOnDrive: () => app.store.backupsOnDrive(),
    async remove(places, withBackups = false) {
      const { choice } = state
      if (choice === null) return { steps: [], removed: false }
      const sync = usePageSync()
      return removeAppData(
        {
          dropFile: (fileId, options) => app.store.dropWorkbook(fileId, options),
          trashBackups: (fileId) => app.store.trashBackups(fileId),
          syncsOver: () => sync.settled(),
          syncing: () => sync.running(),
          beside: app.beside ?? null,
          forgetOnThisDevice(fileId) {
            forgetSetUpAnswersOf(fileId)
            app.forgetOnThisDevice?.()
          },
        },
        choice,
        places,
        withBackups,
      )
    },
  }
}
