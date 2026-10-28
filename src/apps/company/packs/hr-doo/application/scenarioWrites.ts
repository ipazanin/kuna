import type { Repository } from '../../../../../shared/storage/application/repository'
import { scenarioRowOfComponent } from '../domain/scenarios/scenariosReading'
import type { ScenarioRow } from '../domain/scenarios/scenariosReading'
import type { ScenarioDraft } from '../domain/scenarios/startingScenarios'

/** The records of whole scenarios, the label on each one's first record. */
export function scenarioRowsOf(drafts: readonly ScenarioDraft[]): ScenarioRow[] {
  return drafts.flatMap((draft) => draft.components.map((component, index) => scenarioRowOfComponent(draft.slug, index === 0 ? draft.label : '', draft.year, component)))
}

/** The scenario's records under a new name, the label on the first record only, so a blank label reads blank. */
function renamed(held: readonly ScenarioRow[], slug: string, label: string): ScenarioRow[] {
  return held.map((row, index) => scenarioRowOfComponent(slug, index === 0 ? label : '', row.year, row.component))
}

/** Every record of a scenario under a new name and label. */
export function renameScenario(rows: Repository<ScenarioRow>, held: readonly ScenarioRow[], slug: string, label: string): void {
  renamed(held, slug, label).forEach((row, index) => rows.change(held[index]!, row))
}

/** A copy of a scenario's records under a new name and label. */
export function copyScenario(rows: Repository<ScenarioRow>, held: readonly ScenarioRow[], slug: string, label: string): void {
  for (const row of renamed(held, slug, label)) {
    rows.add(row)
  }
}
