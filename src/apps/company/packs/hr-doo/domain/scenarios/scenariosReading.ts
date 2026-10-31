import { problemOf, refusedProblems } from '../../../../../../shared/storage/domain/recordsRead'
import type { ReadRecord, RecordProblem, RecordsRead } from '../../../../../../shared/storage/domain/recordsRead'
import type { Money } from '../../../../../../shared/money/money'
import { DIRECTOR_BASES, SCENARIO_COMPONENTS } from './ownerPayScenarios'
import type { OwnerPayScenario, ScenarioComponent } from './ownerPayScenarios'
import { amountText, filledFields } from '../../../../../../shared/storage/domain/recordFields'
import type { FieldValue } from '../../../../../../shared/storage/domain/recordFields'
import { dayText } from '../../../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../../../shared/storage/domain/recordCodec'
import { recordIdOf } from '../../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
import { sharedKeys } from '../../../../../../shared/storage/domain/sharedKeys'
import { keyedId, optionalDate, refuse, requiredChoice, requiredYear, slugOf, textOf } from '../../../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../../../shared/storage/domain/storedFields'
import { SCENARIO_RECORDS } from '../hrDooKinds'
import type { ComponentDraft } from './startingScenarios'
import { words } from '../words'

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
  if (slug === '') refuse(words.reading.noScenarioName)
  const year = requiredYear(fields, 'year')
  const from = optionalDate(fields, 'from')
  const to = optionalDate(fields, 'to')
  for (const [name, date] of [
    ['from', from],
    ['to', to],
  ] as const) {
    if (date !== null && Number(date.slice(0, 4)) !== year) refuse(words.reading.outsideYear(name, date, year))
  }
  if (from !== null && to !== null && to < from) refuse(words.reading.before('to', to, 'from', from))
  const span = { from, to, id: keyedId(id) }
  const written = slugOf(fields.component)
  const component = written.startsWith(NONTAXABLE_PREFIX)
    ? nontaxableComponent(written.slice(NONTAXABLE_PREFIX.length).trim(), fields, span)
    : namedComponent(
        requiredChoice(
          fields,
          'component',
          SCENARIO_COMPONENTS.filter((name) => name !== 'nontaxable'),
        ),
        fields,
        span,
      )
  return { slug, label: textOf(fields.label), year, component, key: `${written} ${from ?? ''} ${to ?? ''}` }
}

/** A scenario component's name and amount fields, a tax-free item as `nontaxable:<item>`. */
function componentFields(component: ScenarioComponent): Readonly<Record<string, FieldValue>> {
  switch (component.component) {
    case 'salary_gross':
      return { component: 'salary_gross', amount: component.gross === 'floor' ? 'floor' : amountText(component.gross) }
    case 'nontaxable':
      return { component: `${NONTAXABLE_PREFIX}${component.item}`, amount: amountText(component.amount) }
    case 'rent_monthly':
      return { component: 'rent_monthly', amount: amountText(component.amount) }
    case 'dividend':
      return { component: 'dividend', amount: component.amount === 'max' ? 'max' : amountText(component.amount) }
    case 'director_basis':
      return { component: 'director_basis', amount: component.basis }
  }
}

export const SCENARIO_CODEC: RecordCodec<ScenarioRow> = {
  kind: SCENARIO_RECORDS,
  key: (fields) => {
    const scenario = slugOf(fields.scenario)
    return scenario === '' ? null : scenarioKeyOf({ scenario, component: slugOf(fields.component), from: dayText(fields.from), to: dayText(fields.to) })
  },
  label: words.labels.scenarioRow,
  make: scenarioRowOf,
  fieldsOf: (row) => filledFields({ scenario: row.slug, label: row.label, year: String(row.year), ...componentFields(row.component), from: row.component.from, to: row.component.to }),
}

type Span = Pick<ScenarioComponent, 'from' | 'to' | 'id'>

function nontaxableComponent(item: string, fields: StoredFields, span: Span): ScenarioComponent {
  if (!ITEM_SHAPE.test(item)) refuse(words.reading.notAnItem(item))
  return { ...span, component: 'nontaxable', item, amount: positiveAmount(fields) }
}

function namedComponent(component: Exclude<(typeof SCENARIO_COMPONENTS)[number], 'nontaxable'>, fields: StoredFields, span: Span): ScenarioComponent {
  switch (component) {
    case 'salary_gross':
      return { ...span, component, gross: slugOf(fields.amount) === 'floor' ? 'floor' : positiveAmount(fields, words.reading.orFloor) }
    case 'rent_monthly':
      return { ...span, component, amount: positiveAmount(fields) }
    case 'dividend':
      return { ...span, component, amount: slugOf(fields.amount) === 'max' ? 'max' : positiveAmount(fields, words.reading.orMax) }
    case 'director_basis':
      return { ...span, component, basis: requiredChoice(fields, 'amount', DIRECTOR_BASES, 'director basis') }
  }
}

function positiveAmount(fields: StoredFields, alternative = ''): Money {
  const amount = fields.amount?.money ?? null
  if (amount === null || amount <= 0) {
    refuse(fields.amount === undefined ? words.reading.noAmount : words.reading.notAnAmountAboveZero(fields.amount.text, alternative))
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
      const reason = words.reading.yearsOfScenario(slug, years)
      problems.push(...scenarioRows.map((stored) => problemOf(stored, reason)))
      continue
    }
    const shared = sharedKeys(scenarioRows, (stored) => stored.record.key)
    const kept = scenarioRows.filter((stored) => !shared.has(stored.record.key))
    for (const stored of scenarioRows.filter((candidate) => shared.has(candidate.record.key))) {
      problems.push(problemOf(stored, words.reading.sameComponent(slug)))
    }
    const labels = [...new Set(scenarioRows.map((stored) => stored.record.label).filter((label) => label !== ''))]
    if (labels.length > 1) {
      const reason = words.reading.labelsDiffer(slug)
      problems.push(...scenarioRows.filter((stored) => stored.record.label !== '').map((stored) => problemOf(stored, reason)))
    }
    if (kept.length > 0) {
      scenarios.push({ slug, label: labels.length === 1 ? labels[0]! : '', year: years[0]!, components: kept.map((stored) => stored.record.component) })
    }
  }
  return { scenarios, problems }
}
