import type { RemovalReport } from '../application/appData'
import { words } from './words'

/** Each step of a removal as a line, with what came of it. */
export function removalLines(report: RemovalReport): readonly string[] {
  const { steps, outcomes } = words.deleteData
  return report.steps.map(({ step, outcome }) => {
    if (outcome.kind === 'done') return outcomes.done(steps[step])
    return outcome.kind === 'failed' ? outcomes.failed(steps[step], outcome.message) : outcomes.notRun(steps[step])
  })
}
