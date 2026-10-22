import { editsOf, untouchedOf } from '../../../features/workbook/application/tabRowWrites'
import type { RowsChangeCheck, TabRowRules } from '../../../features/workbook/application/tabRowWrites'
import type { FreshTabs } from '../../../features/workbook/infrastructure/workbookWriter'
import type { RowCells, TabRowsChange } from '../../../features/workbook/domain/rowChanges'
import { slugChangeRefusals } from '../../../features/workbook/domain/slug'
import { slugOf } from '../../../features/workbook/infrastructure/cellReading'
import { readPlan } from '../../../features/workbook/infrastructure/planTabReader'
import { readScenarios } from '../../../features/workbook/infrastructure/scenariosTabReader'
import { definedCategorySlugs } from '../../../features/workbook/infrastructure/workbookReader'
import { contentColumns } from '../../../features/workbook/infrastructure/workbookTemplate'
import { serialFromCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { amountOf } from '../../../shared/money/money'
import { planGuards } from '../domain/forecast/planGuards'
import { scenarioGuards } from '../domain/scenarios/scenarioGuards'
import type { ComponentDraft, ScenarioDraft } from '../domain/scenarios/startingScenarios'
import { SCENARIO_RECORDS } from '../../../features/workbook/domain/recordKind'

const COLUMNS = contentColumns('scenarios')
const SCENARIO_ON_PLAN = 'owner_pay_scenario'

/** A component's row as the tab holds it: amounts as numbers, dates as serial days, a tax-free item as `nontaxable:<item>`. */
export function componentCells(slug: string, year: number, component: ComponentDraft, label = ''): RowCells {
  const day = (date: CivilDate | null) => (date === null ? '' : serialFromCivilDate(date))
  const [name, amount] = ((): readonly [string, string | number] => {
    switch (component.component) {
      case 'salary_gross':
        return ['salary_gross', component.gross === 'floor' ? 'floor' : amountOf(component.gross)]
      case 'nontaxable':
        return [`nontaxable:${component.item}`, amountOf(component.amount)]
      case 'rent_monthly':
        return ['rent_monthly', amountOf(component.amount)]
      case 'dividend':
        return ['dividend', component.amount === 'max' ? 'max' : amountOf(component.amount)]
      case 'director_basis':
        return ['director_basis', component.basis]
    }
  })()
  return { scenario: slug, label, year, component: name, amount, from: day(component.from), to: day(component.to) }
}

/** The rows of whole scenarios, the label on each one's first row. */
export function scenarioCells(drafts: readonly ScenarioDraft[]): RowCells[] {
  return drafts.flatMap((draft) => draft.components.map((component, index) => componentCells(draft.slug, draft.year, component, index === 0 ? draft.label : '')))
}

/** Every row of a scenario under a new name, the label on its first row only, so a blank label reads blank. */
export function renamedScenario(rows: readonly RowCells[], slug: string, label: string): TabRowsChange {
  return {
    added: [],
    changed: rows.map((cells, index) => ({ before: cells, after: { ...cells, scenario: slug, label: index === 0 ? label : '' } })),
    removed: [],
  }
}

/** A copy of a scenario's rows below the last row, under a new name and label. */
export function copiedScenario(rows: readonly RowCells[], slug: string, label: string): TabRowsChange {
  return { added: rows.map((cells, index) => ({ ...cells, scenario: slug, label: index === 0 ? label : '' })), changed: [], removed: [] }
}

/** How many plan rows name each scenario. */
function planUses(fresh: FreshTabs): ReadonlyMap<string, readonly string[]> {
  const counts = new Map<string, number>()
  for (const row of fresh.plan?.rows ?? []) {
    if (slugOf(row.cells.item) === SCENARIO_ON_PLAN) {
      const slug = slugOf(row.cells.amount)
      counts.set(slug, (counts.get(slug) ?? 0) + 1)
    }
  }
  return new Map([...counts].map(([slug, count]) => [slug, [count === 1 ? '1 plan tab row' : `${count} plan tab rows`]]))
}

/**
 * A scenario's name keeps to the slug format, is never moved onto the rows of another scenario,
 * and is kept while plan rows name it. Each scenario the change touches must then pass its guards,
 * and so must the owner pay of every plan year that names one of them.
 */
function scenarioRefusals(check: RowsChangeCheck, fresh: FreshTabs): string[] {
  const edits = editsOf(check, (cells) => slugOf(cells.scenario))
  const untouched = untouchedOf(check, (cells) => ({ slug: slugOf(cells.scenario) })).filter((row) => row.slug !== '')
  const refusals = slugChangeRefusals('scenario', { edits: edits.map((edit) => ({ from: edit.before, to: edit.after })), untouched }, planUses(fresh), false)
  for (const edit of edits) {
    const holder = untouched.find((row) => row.slug === edit.after)
    if (edit.before !== null && edit.after !== null && edit.before !== edit.after && holder !== undefined) {
      refusals.push(`"${edit.after}" is already a scenario. Pick another name.`)
    }
  }
  if (refusals.length > 0) {
    return [...new Set(refusals)]
  }
  const touched = new Set(edits.flatMap((edit) => [edit.before, edit.after]).filter((slug): slug is string => slug !== null))
  const after = readScenarios(check.after).scenarios
  const stopped = after
    .filter((scenario) => touched.has(scenario.slug))
    .flatMap((scenario) => scenarioGuards(scenario).map((guard) => `${scenario.label || scenario.slug}: ${guard.reason}`))
  if (stopped.length > 0) {
    return stopped
  }
  const plan = readPlan(fresh.plan?.rows ?? [], definedCategorySlugs(fresh.categories?.rows ?? []), new Set(after.map((scenario) => scenario.slug))).facts
  const naming = plan.filter((line) => line.kind === 'owner-pay-scenario' && touched.has(line.scenario))
  const years = new Set(naming.map((line) => line.year))
  return planGuards(plan.filter((line) => years.has(line.year)), after).map((guard) => `The plan tab: ${guard.reason}`)
}

/** The `scenarios` tab: the reader checks each row, then the scenario guards check each scenario the change touches. */
export const SCENARIO_ROWS: TabRowRules = {
  tab: 'scenarios',
  kind: SCENARIO_RECORDS,
  columns: COLUMNS,
  required: ['scenario', 'year', 'component', 'amount'],
  caseless: ['scenario', 'component', 'amount'],
  reads: ['plan', 'categories'],
  read: (rows) => {
    const { scenarios, problems } = readScenarios(rows)
    return { facts: scenarios.flatMap((scenario) => scenario.components), problems }
  },
  refusals: scenarioRefusals,
}
