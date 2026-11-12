import type { WorkbookChoice } from '../application/workbookPorts'
import { jsonChoice, keptKeys, onChoiceKeptElsewhere } from '../../device/deviceChoice'

/** Each app remembers its own workbook on this device, under one key per app. */
const KEY_PREFIX = 'kuna.workbook-file.'

export function loadWorkbookChoice(app: string): WorkbookChoice | null {
  return jsonChoice(`${KEY_PREFIX}${app}`, choiceOf).read()
}

/** Null forgets the choice, so the next start goes to onboarding. Where storage is denied the choice is not remembered. */
export function saveWorkbookChoice(app: string, choice: WorkbookChoice | null): void {
  jsonChoice(`${KEY_PREFIX}${app}`, choiceOf).remember(choice)
}

/** Tells the page when another tab chose a file for the app, forgot its choice, or cleared this site's storage. */
export function onChoiceChangedElsewhere(app: string, changed: { forgotten(): void; chosen(): void }): void {
  onChoiceKeptElsewhere((key, kept) => {
    if (key !== null && key !== `${KEY_PREFIX}${app}`) return
    if (key === null || kept === null) changed.forgotten()
    else changed.chosen()
  })
}

/** Whether some app keeps its workbook on Drive on this device. */
export function someWorkbookOnDrive(): boolean {
  return keptKeys(KEY_PREFIX).some((key) => loadWorkbookChoice(key.slice(KEY_PREFIX.length))?.source === 'drive')
}

function choiceOf(candidate: unknown): WorkbookChoice | null {
  if (typeof candidate !== 'object' || candidate === null) {
    return null
  }
  const { source, id, name } = candidate as Record<string, unknown>
  if ((source !== 'drive' && source !== 'browser') || typeof id !== 'string' || id === '' || typeof name !== 'string') {
    return null
  }
  return { source, id, name }
}
