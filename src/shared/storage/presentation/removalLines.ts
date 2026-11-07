import type { RemovalReport } from '../application/appData'
import { plural } from '../../text/translation'
import { words } from './words'

/** The label of the backups' row, with how many when that is known. */
export function backupsLabel(count: number | null): string {
  return count === null ? words.deleteData.backups : plural(words.deleteData.backupsCounted(count), count)
}

/** Each step of a removal as a line, with what came of it. */
export function removalLines(report: RemovalReport): readonly string[] {
  const { steps, outcomes } = words.deleteData
  return report.steps.map(({ step, outcome }) => {
    if (outcome.kind === 'done') return outcomes.done(steps[step])
    return outcome.kind === 'failed' ? outcomes.failed(steps[step], outcome.message) : outcomes.notRun(steps[step])
  })
}
