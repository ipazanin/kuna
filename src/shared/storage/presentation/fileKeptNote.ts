import type { WorkbookChoice } from '../application/workbookPorts'

/** An app's words for where its file is kept: on Drive under its name, or in this browser. */
export function fileKeptNote(choice: WorkbookChoice | null, note: { onDrive(name: string): string; readonly inBrowser: string }): string {
  return choice?.source === 'drive' ? note.onDrive(choice.name) : note.inBrowser
}
