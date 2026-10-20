import { DIRECTOR_BASES, SCENARIO_COMPONENTS } from '../domain/ownerPayScenarios'
import type { OwnerPayScenario, ScenarioComponent } from '../domain/ownerPayScenarios'
import { inTabOrder, isUnreadable, moneyOf, optionalDate, readRow, refuse, requiredChoice, requiredYear, slugOf, textOf } from './cellReading'
import type { RowProblem } from './cellReading'
import type { SheetRow } from './workbookSnapshot'
import type { Money } from '../../../shared/money/money'

const NONTAXABLE_PREFIX = 'nontaxable:'
const ITEM_SHAPE = /^[a-z0-9][a-z0-9-]*$/

interface ScenarioRow {
  readonly slug: string
  readonly label: string
  readonly year: number
  readonly component: ScenarioComponent
  /** The component and the span it holds for, so the same row twice can be told apart from two spans. */
  readonly key: string
}

/**
 * The `scenarios` tab, its rows grouped by scenario name. A scenario is for one year, so a row
 * naming another year than the scenario's first row is left out. The same component with the same
 * span twice is left out the second time.
 */
export function readScenarios(rows: readonly SheetRow[]): { readonly scenarios: readonly OwnerPayScenario[]; readonly problems: readonly RowProblem[] } {
  const bySlug = new Map<string, { label: string; year: number; components: ScenarioComponent[]; keys: Set<string> }>()
  const problems: RowProblem[] = []
  for (const row of inTabOrder(rows)) {
    const read = readRow(() => readScenarioRow(row))
    if (isUnreadable(read)) {
      problems.push({ sheetRow: row.sheetRow, reason: read.unreadable })
      continue
    }
    const scenario = bySlug.get(read.slug) ?? { label: '', year: read.year, components: [], keys: new Set<string>() }
    if (scenario.year !== read.year) {
      problems.push({ sheetRow: row.sheetRow, reason: `${read.slug} is a scenario for ${scenario.year} on an earlier row` })
      continue
    }
    if (scenario.keys.has(read.key)) {
      problems.push({ sheetRow: row.sheetRow, reason: `${read.slug} already has this component for the same days above` })
      continue
    }
    scenario.label ||= read.label
    scenario.keys.add(read.key)
    scenario.components.push(read.component)
    bySlug.set(read.slug, scenario)
  }
  const scenarios = [...bySlug].map(([slug, scenario]) => ({ slug, label: scenario.label, year: scenario.year, components: scenario.components }))
  return { scenarios, problems }
}

function readScenarioRow(row: SheetRow): ScenarioRow {
  const { cells } = row
  const slug = slugOf(cells.scenario)
  if (slug === '') refuse('no scenario name')
  const year = requiredYear(cells, 'year')
  const from = optionalDate(cells, 'from')
  const to = optionalDate(cells, 'to')
  for (const [column, date] of [['from', from], ['to', to]] as const) {
    if (date !== null && Number(date.slice(0, 4)) !== year) refuse(`${column} ${date} is outside ${year}`)
  }
  if (from !== null && to !== null && to < from) refuse(`to ${to} is before from ${from}`)
  const span = { from, to, sheetRow: row.sheetRow }
  const written = slugOf(cells.component)
  const component = written.startsWith(NONTAXABLE_PREFIX)
    ? nontaxableComponent(written.slice(NONTAXABLE_PREFIX.length).trim(), cells, span)
    : namedComponent(requiredChoice(cells, 'component', SCENARIO_COMPONENTS.filter((name) => name !== 'nontaxable')), cells, span)
  return { slug, label: textOf(cells.label), year, component, key: `${written} ${from ?? ''} ${to ?? ''}` }
}

type Span = Pick<ScenarioComponent, 'from' | 'to' | 'sheetRow'>

function nontaxableComponent(item: string, cells: SheetRow['cells'], span: Span): ScenarioComponent {
  if (!ITEM_SHAPE.test(item)) refuse(`"${item}" is not a tax-free item name, such as nontaxable:occasional-gift`)
  return { ...span, component: 'nontaxable', item, amount: positiveAmount(cells) }
}

function namedComponent(component: Exclude<(typeof SCENARIO_COMPONENTS)[number], 'nontaxable'>, cells: SheetRow['cells'], span: Span): ScenarioComponent {
  switch (component) {
    case 'salary_gross':
      return { ...span, component, gross: slugOf(cells.amount) === 'floor' ? 'floor' : positiveAmount(cells, 'or floor') }
    case 'rent_monthly':
      return { ...span, component, amount: positiveAmount(cells) }
    case 'dividend':
      return { ...span, component, amount: slugOf(cells.amount) === 'max' ? 'max' : positiveAmount(cells, 'or max') }
    case 'director_basis':
      return { ...span, component, basis: requiredChoice(cells, 'amount', DIRECTOR_BASES, 'director basis') }
  }
}

function positiveAmount(cells: SheetRow['cells'], alternative = ''): Money {
  const amount = moneyOf(cells.amount)
  if (amount === null || amount <= 0) {
    refuse(cells.amount === undefined ? 'no amount' : `amount "${textOf(cells.amount)}" is not an amount above zero${alternative === '' ? '' : ` ${alternative}`}`)
  }
  return amount
}
