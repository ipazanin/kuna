import { DIRECTOR_BASES, SCENARIO_COMPONENTS } from '../domain/ownerPayScenarios'
import type { OwnerPayScenario, ScenarioComponent } from '../domain/ownerPayScenarios'
import { sharedKeys } from '../domain/sharedKeys'
import { isUnreadable, moneyOf, optionalDate, readRow, recordProblems, refuse, requiredChoice, requiredYear, slugOf, textOf } from './cellReading'
import type { RowProblem } from './cellReading'
import type { RecordProblem } from '../domain/workbook'
import { readRecordId } from './tabRecords'
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
 * The `scenarios` tab, its rows grouped by scenario name. A scenario is for one year, so one whose
 * rows name two years is left out whole. The same component with the same span on more than one
 * row is left out on every one. A label the rows give differently reads blank.
 */
export function readScenarios(rows: readonly SheetRow[]): { readonly scenarios: readonly OwnerPayScenario[]; readonly problems: readonly RecordProblem[] } {
  const bySlug = new Map<string, { readonly row: SheetRow; readonly read: ScenarioRow }[]>()
  const problems: RowProblem[] = []
  for (const row of rows) {
    const read = readRow(() => readScenarioRow(row))
    if (isUnreadable(read)) {
      problems.push({ sheetRow: row.sheetRow, reason: read.unreadable })
    } else {
      bySlug.set(read.slug, [...(bySlug.get(read.slug) ?? []), { row, read }])
    }
  }
  const scenarios: OwnerPayScenario[] = []
  for (const [slug, scenarioRows] of bySlug) {
    const years = [...new Set(scenarioRows.map(({ read }) => read.year))].sort()
    if (years.length > 1) {
      const reason = `${slug} names the years ${years.join(' and ')}, and a scenario is for one year, so none of its rows counts`
      problems.push(...scenarioRows.map(({ row }) => ({ sheetRow: row.sheetRow, reason })))
      continue
    }
    const shared = sharedKeys(scenarioRows, ({ read }) => read.key)
    const kept = scenarioRows.filter(({ read }) => !shared.has(read.key))
    for (const { row } of scenarioRows.filter(({ read }) => shared.has(read.key))) {
      problems.push({ sheetRow: row.sheetRow, reason: `${slug} has this component for the same days on more than one row, so none of them counts` })
    }
    const labels = [...new Set(scenarioRows.map(({ read }) => read.label).filter((label) => label !== ''))]
    if (labels.length > 1) {
      const reason = `the rows of ${slug} give its label differently, so it reads blank`
      problems.push(...scenarioRows.filter(({ read }) => read.label !== '').map(({ row }) => ({ sheetRow: row.sheetRow, reason })))
    }
    if (kept.length > 0) {
      scenarios.push({ slug, label: labels.length === 1 ? labels[0]! : '', year: years[0]!, components: kept.map(({ read }) => read.component) })
    }
  }
  return { scenarios, problems: recordProblems('scenarios', rows, problems) }
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
  const span = { from, to, id: readRecordId('scenarios', cells) }
  const written = slugOf(cells.component)
  const component = written.startsWith(NONTAXABLE_PREFIX)
    ? nontaxableComponent(written.slice(NONTAXABLE_PREFIX.length).trim(), cells, span)
    : namedComponent(requiredChoice(cells, 'component', SCENARIO_COMPONENTS.filter((name) => name !== 'nontaxable')), cells, span)
  return { slug, label: textOf(cells.label), year, component, key: `${written} ${from ?? ''} ${to ?? ''}` }
}

type Span = Pick<ScenarioComponent, 'from' | 'to' | 'id'>

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
