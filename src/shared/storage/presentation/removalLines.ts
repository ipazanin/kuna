import type { HeldData, RemovalOutcome, RemovalReport, RemovalStep } from '../application/appData'
import { plural } from '../../text/translation'
import { words } from './words'

/** A line of a failed delete: what failed, or what already went and cannot be taken back by trying again. */
export interface RemovalLine {
  readonly kind: 'failed' | 'gone'
  readonly text: string
}

/** The label of the backups' row, with how many when that is known. */
export function backupsLabel(count: number | null): string {
  if (count === 0) return words.deleteData.noBackups
  return count === null ? words.deleteData.backups : plural(words.deleteData.backupsCounted(count), count)
}

type NamedFiles = Pick<HeldData, 'fileName' | 'besideFileName'>

function failedText(step: RemovalStep, reason: string, { fileName, besideFileName }: NamedFiles): string {
  const { backups, driveFile, browserFile, browserCopy, besideCopy } = words.deleteData.lineFailed
  switch (step) {
    case 'backups':
      return backups(reason)
    case 'beside-file':
      return driveFile(besideFileName ?? fileName, reason)
    case 'drive-file':
      return driveFile(fileName, reason)
    case 'browser-file':
      return browserFile(reason)
    case 'browser-copy':
      return browserCopy(reason)
    case 'beside-copy':
      return besideCopy(reason)
  }
}

function goneText(step: RemovalStep, { fileName, besideFileName }: NamedFiles): string {
  const { backups, driveFile, besideFile, browserFile, browserCopy, besideCopy } = words.deleteData.lineGone
  switch (step) {
    case 'backups':
      return backups
    case 'beside-file':
      return besideFile(besideFileName ?? fileName)
    case 'drive-file':
      return driveFile(fileName)
    case 'browser-file':
      return browserFile
    case 'browser-copy':
      return browserCopy
    case 'beside-copy':
      return besideCopy
  }
}

function lineOf(step: RemovalStep, outcome: RemovalOutcome, files: NamedFiles): RemovalLine | null {
  if (outcome.kind === 'failed') return { kind: 'failed', text: failedText(step, outcome.message, files) }
  return outcome.kind === 'done' ? { kind: 'gone', text: goneText(step, files) } : null
}

/** What a failed delete did, by file. A step that never started leaves its file as it was, which the alert says, so it has no line. */
export function removalLines(report: RemovalReport, files: NamedFiles): readonly RemovalLine[] {
  return report.steps.flatMap(({ step, outcome }) => lineOf(step, outcome, files) ?? [])
}
