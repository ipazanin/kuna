import { googleConfig } from './googleConfig'
import { loadScript } from './loadScript'

const GOOGLE_API_LOADER_SRC = 'https://apis.google.com/js/api.js'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export type PickerKind = 'spreadsheet' | 'folder'

export interface PickedDocument {
  readonly id: string
  readonly name: string
  readonly mimeType: string
}

interface GoogleApiLoader {
  load(library: 'picker', handlers: { callback: () => void; onerror: () => void }): void
}

let pickerLibrary: Promise<void> | null = null

function loadPickerLibrary(): Promise<void> {
  pickerLibrary ??= loadScript(GOOGLE_API_LOADER_SRC).then(
    () =>
      new Promise<void>((resolve, reject) => {
        const loader = (window as unknown as { gapi?: GoogleApiLoader }).gapi
        if (loader === undefined) {
          reject(new Error(`${GOOGLE_API_LOADER_SRC} loaded but defined no gapi loader.`))
          return
        }
        loader.load('picker', { callback: resolve, onerror: () => reject(new Error('gapi could not load the picker library.')) })
      }),
  )
  pickerLibrary.catch(() => {
    pickerLibrary = null
  })
  return pickerLibrary
}

/** Loads the Picker ahead of a click, so opening it does not wait on the network. */
export function preparePicker(): Promise<void> {
  return loadPickerLibrary()
}

/**
 * Opens Google's Picker in its docs.google.com frame. Picking a file is what grants the app
 * `drive.file` access to it. Resolves with the picked documents, or an empty list on cancel.
 */
export async function pickFromDrive(kind: PickerKind, accessToken: string): Promise<PickedDocument[]> {
  const { apiKey, projectNumber } = googleConfig()
  await loadPickerLibrary()

  const view =
    kind === 'spreadsheet'
      ? new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      : new google.picker.DocsView(google.picker.ViewId.FOLDERS)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(true)
          .setMimeTypes(FOLDER_MIME_TYPE)

  return new Promise<PickedDocument[]>((resolve) => {
    const picker = new google.picker.PickerBuilder()
      .addView(view)
      .setAppId(projectNumber)
      .setOAuthToken(accessToken)
      .setDeveloperKey(apiKey)
      .setCallback((result) => {
        const action = result[google.picker.Response.ACTION]
        if (action === google.picker.Action.CANCEL) {
          resolve([])
        }
        if (action === google.picker.Action.PICKED) {
          const documents = result[google.picker.Response.DOCUMENTS] ?? []
          resolve(
            documents.map((document) => ({
              id: document[google.picker.Document.ID] ?? '',
              name: document[google.picker.Document.NAME] ?? '',
              mimeType: document[google.picker.Document.MIME_TYPE] ?? '',
            })),
          )
        }
      })
      .build()
    picker.setVisible(true)
  })
}
