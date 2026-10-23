import type { Money } from '../../../../shared/money/money'
import { DIRECTOR_BASES, SCENARIO_COMPONENTS } from './ownerPayScenarios'
import type { OwnerPayScenario, ScenarioComponent } from './ownerPayScenarios'
import { recordIdOf } from '../../../../features/workbook/domain/recordId'
import type { RecordId } from '../../../../features/workbook/domain/recordId'
import { problemOf, refusedProblems } from '../../../../features/workbook/domain/recordsRead'
import type { ReadRecord, RecordsRead } from '../../../../features/workbook/domain/recordsRead'
import { sharedKeys } from '../../../../features/workbook/domain/sharedKeys'
import { keyedId, optionalDate, refuse, requiredChoice, requiredYear, slugOf, textOf } from '../../../../features/workbook/domain/storedFields'
import type { StoredFields } from '../../../../features/workbook/domain/storedFields'
import type { RecordProblem } from '../../../../features/workbook/domain/workbook'
import { SCENARIO_RECORDS } from '../hrDooKinds'
import type { ComponentDraft } from './startingScenarios'

const NONTAXABLE_PREFIX = 'nontaxable:'
const ITEM_SHAPE = /^[a-z0-9][a-z0-9-]*$/

/** One record of the `scenarios` tab: a component of a named scenario for one year. */
export interface ScenarioRow {
  readonly slug: string
  readonly label: string
  readonly year: number
  readonly component: ScenarioComponent
  /** The component and the span it holds for, so the same component twice can be told apart from two spans. */
  readonly key: string
}

/** What a scenario row is kept by: its scenario, its component as written, and the days its span starts and ends, blank for none. */
export function scenarioKeyOf(parts: { readonly scenario: string; readonly component: string; readonly from: string; readonly to: string }): string {
  return JSON.stringify([parts.scenario, parts.component, parts.from, parts.to])
}

/** A component's name as its field holds it, a tax-free item as `nontaxable:<item>`. */
function componentNameOf(component: ComponentDraft): string {
  return component.component === 'nontaxable' ? `${NONTAXABLE_PREFIX}${component.item}` : component.component
}

/** A scenario row the app makes of a component, with the id its scenario, component and span make. */
export function scenarioRowOfComponent(slug: string, label: string, year: number, component: ComponentDraft): ScenarioRow {
  const written = componentNameOf(component)
  const from = component.from ?? ''
  const to = component.to ?? ''
  return { slug, label, year, component: { ...component, id: recordIdOf(SCENARIO_RECORDS, scenarioKeyOf({ scenario: slug, component: written, from, to })) }, key: `${written} ${from} ${to}` }
}

export function scenarioRowOf(fields: StoredFields, id: RecordId | null): ScenarioRow {
  const slug = slugOf(fields.scenario)
  if (slug === '') refuse('no scenario name')
  const year = requiredYear(fields, 'year')
  const from = optionalDate(fields, 'from')
  const to = optionalDate(fields, 'to')
  for (const [name, date] of [['from', from], ['to', to]] as const) {
    if (date !== null && Number(date.slice(0, 4)) !== year) refuse(`${name} ${date} is outside ${year}`)
  }
  if (from !== null && to !== null && to < from) refuse(`to ${to} is before from ${from}`)
  const span = { from, to, id: keyedId(id) }
  const written = slugOf(fields.component)
  const component = written.startsWith(NONTAXABLE_PREFIX)
    ? nontaxableComponent(written.slice(NONTAXABLE_PREFIX.length).trim(), fields, span)
    : namedComponent(requiredChoice(fields, 'component', SCENARIO_COMPONENTS.filter((name) => name !== 'nontaxable')), fields, span)
  return { slug, label: textOf(fields.label), year, component, key: `${written} ${from ?? ''} ${to ?? ''}` }
}

type Span = Pick<ScenarioComponent, 'from' | 'to' | 'id'>

function nontaxableComponent(item: string, fields: StoredFields, span: Span): ScenarioComponent {
  if (!ITEM_SHAPE.test(item)) refuse(`"${item}" is not a tax-free item name, such as nontaxable:occasional-gift`)
  return { ...span, component: 'nontaxable', item, amount: positiveAmount(fields) }
}

function namedComponent(component: Exclude<(typeof SCENARIO_COMPONENTS)[number], 'nontaxable'>, fields: StoredFields, span: Span): ScenarioComponent {
  switch (component) {
    case 'salary_gross':
      return { ...span, component, gross: slugOf(fields.amount) === 'floor' ? 'floor' : positiveAmount(fields, 'or floor') }
    case 'rent_monthly':
      return { ...span, component, amount: positiveAmount(fields) }
    case 'dividend':
      return { ...span, component, amount: slugOf(fields.amount) === 'max' ? 'max' : positiveAmount(fields, 'or max') }
    case 'director_basis':
      return { ...span, component, basis: requiredChoice(fields, 'amount', DIRECTOR_BASES, 'director basis') }
  }
}

function positiveAmount(fields: StoredFields, alternative = ''): Money {
  const amount = fields.amount?.money ?? null
  if (amount === null || amount <= 0) {
    refuse(fields.amount === undefined ? 'no amount' : `amount "${fields.amount.text}" is not an amount above zero${alternative === '' ? '' : ` ${alternative}`}`)
  }
  return amount
}

/**
 * The scenarios, the records grouped by scenario name. A scenario is for one year, so one whose
 * records name two years is left out whole. The same component with the same span on more than one
 * record is left out on every one. A label the records give differently reads blank.
 */
export function readScenarios(read: RecordsRead<ScenarioRow>): { readonly scenarios: readonly OwnerPayScenario[]; readonly problems: readonly RecordProblem[] } {
  const bySlug = new Map<string, ReadRecord<ScenarioRow>[]>()
  for (const stored of read.records) {
    bySlug.set(stored.record.slug, [...(bySlug.get(stored.record.slug) ?? []), stored])
  }
  const problems: RecordProblem[] = refusedProblems(read)
  const scenarios: OwnerPayScenario[] = []
  for (const [slug, scenarioRows] of bySlug) {
    const years = [...new Set(scenarioRows.map((stored) => stored.record.year))].sort()
    if (years.length > 1) {
      const reason = `${slug} names the years ${years.join(' and ')}, and a scenario is for one year, so none of its rows counts`
      problems.push(...scenarioRows.map((stored) => problemOf(stored, reason)))
      continue
    }
    const shared = sharedKeys(scenarioRows, (stored) => stored.record.key)
    const kept = scenarioRows.filter((stored) => !shared.has(stored.record.key))
    for (const stored of scenarioRows.filter((candidate) => shared.has(candidate.record.key))) {
      problems.push(problemOf(stored, `${slug} has this component for the same days on more than one row, so none of them counts`))
    }
    const labels = [...new Set(scenarioRows.map((stored) => stored.record.label).filter((label) => label !== ''))]
    if (labels.length > 1) {
      const reason = `the rows of ${slug} give its label differently, so it reads blank`
      problems.push(...scenarioRows.filter((stored) => stored.record.label !== '').map((stored) => problemOf(stored, reason)))
    }
    if (kept.length > 0) {
      scenarios.push({ slug, label: labels.length === 1 ? labels[0]! : '', year: years[0]!, components: kept.map((stored) => stored.record.component) })
    }
  }
  return { scenarios, problems }
}
