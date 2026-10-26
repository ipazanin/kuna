import { definedCategories, definedCategorySlugs } from '../../../features/workbook/domain/categoriesReading'
import { CATEGORY_RECORDS } from '../../../features/workbook/domain/recordKind'
import { storedFieldsOf } from '../../../features/workbook/domain/recordsRead'
import { countedBy, slugChangeRefusals, usesOf } from '../../../features/workbook/domain/slug'
import type { SlugEdit } from '../../../features/workbook/domain/slug'
import { slugOf, wholeNumberOf } from '../../../features/workbook/domain/storedFields'
import type { StoredField } from '../../../features/workbook/domain/storedFields'
import { pickedEdits, pickedUntouched } from '../../../features/workbook/domain/writeRules'
import type { FreshRecords, KindChange, WriteRules } from '../../../features/workbook/domain/writeRules'
import { readAssets } from './assets/assetsReading'
import type { Asset } from './assets/assets'
import type { Employee } from './employees/employees'
import { readEmployees } from './employees/employeesReading'
import { planGuards } from './forecast/planGuards'
import type { PlanLine } from './forecast/plan'
import { readPlan } from './forecast/planReading'
import type { Grant } from './grants/grants'
import { readGrants } from './grants/grantsReading'
import { ASSET_RECORDS, EMPLOYEE_RECORDS, GRANT_RECORDS, OWNER_ADVANCE_RECORDS, PLAN_RECORDS, SCENARIO_RECORDS, YEAR_END_RECORDS } from './hrDooKinds'
import { readOwnerAdvances } from './ownerAdvancesReading'
import type { OwnerAdvanceEntry } from './ownerAdvancesReading'
import { scenarioGuards } from './scenarios/scenarioGuards'
import { readScenarios } from './scenarios/scenariosReading'
import type { ScenarioRow } from './scenarios/scenariosReading'
import type { YearEndLine } from './yearEnd/yearEnd'
import { readYearEndLines } from './yearEnd/yearEndReading'

const SCENARIO_ON_PLAN = 'owner_pay_scenario'

/** A name field of each record an edit touches, before and after, as the slug rules take it. */
function slugEdits<R>(change: KindChange<R>, field: string): SlugEdit[] {
  return pickedEdits(change, (fields) => slugOf(fields[field])).map((edit) => ({ from: edit.before, to: edit.after }))
}

/** The names the records a change leaves alone hold, blank ones aside. */
function untouchedSlugs<R>(change: KindChange<R>, field: string): { readonly slug: string }[] {
  return pickedUntouched(change, (fields) => ({ slug: slugOf(fields[field]) })).filter((row) => row.slug !== '')
}

/** A cost the owner paid, checked by its reader against the categories: an amount above zero, in an operating or taxes category. */
export const OWNER_ADVANCE_WRITES: WriteRules<OwnerAdvanceEntry> = {
  kind: OWNER_ADVANCE_RECORDS,
  reads: [CATEGORY_RECORDS],
  undoable: true,
  read: (read, records) => readOwnerAdvances(read, definedCategories(records.of(CATEGORY_RECORDS))),
  refusals: () => [],
}

function grantSlugs(records: FreshRecords): ReadonlySet<string> {
  return new Set(readGrants(records.of(GRANT_RECORDS)).facts.map((grant) => grant.slug))
}

export const ASSET_WRITES: WriteRules<Asset> = {
  kind: ASSET_RECORDS,
  reads: [GRANT_RECORDS],
  undoable: true,
  read: (read, records) => readAssets(read, grantSlugs(records)),
  refusals: () => [],
}

/** A grant keeps to the slug format, once on its tab, and keeps its name while an asset is funded by it. */
export const GRANT_WRITES: WriteRules<Grant> = {
  kind: GRANT_RECORDS,
  reads: [ASSET_RECORDS],
  undoable: true,
  read: (read) => readGrants(read),
  refusals: (change, fresh) =>
    slugChangeRefusals(
      'grant',
      { edits: slugEdits(change, 'grant'), untouched: untouchedSlugs(change, 'grant') },
      usesOf([countedBy(storedFieldsOf(fresh.of(ASSET_RECORDS)), (fields) => [slugOf(fields.funded_by)], 'asset', 'assets')]),
      true,
    ),
}

export const YEAR_END_WRITES: WriteRules<YearEndLine> = {
  kind: YEAR_END_RECORDS,
  reads: [CATEGORY_RECORDS],
  undoable: true,
  read: (read, records) => readYearEndLines(read, definedCategorySlugs(records.of(CATEGORY_RECORDS))),
  refusals: () => [],
}

function scenarioSlugs(records: FreshRecords): ReadonlySet<string> {
  return new Set(readScenarios(records.of(SCENARIO_RECORDS)).scenarios.map((scenario) => scenario.slug))
}

function readPlanLines(read: KindChange<PlanLine>['after'], records: FreshRecords) {
  return readPlan(read, definedCategorySlugs(records.of(CATEGORY_RECORDS)), scenarioSlugs(records))
}

function yearOf(field: StoredField | undefined): number | null {
  return field === undefined ? null : wholeNumberOf(field)
}

/** The reader checks each line against the categories and scenarios, then the plan guards check every year the change touches. */
export const PLAN_WRITES: WriteRules<PlanLine> = {
  kind: PLAN_RECORDS,
  reads: [CATEGORY_RECORDS, SCENARIO_RECORDS],
  undoable: true,
  read: readPlanLines,
  refusals: (change, fresh) => {
    const years = new Set(
      change.edits.flatMap((edit) => [edit.before, edit.after].flatMap((touched) => (touched === null ? [] : [yearOf(touched.fields.year)]))).filter((year): year is number => year !== null),
    )
    const lines = readPlanLines(change.after, fresh).facts.filter((line) => years.has(line.year))
    return planGuards(lines, readScenarios(fresh.of(SCENARIO_RECORDS)).scenarios).map((guard) => guard.reason)
  },
}

/** How many plan rows name each scenario. */
function planUses(fresh: FreshRecords): ReadonlyMap<string, readonly string[]> {
  return usesOf([
    countedBy(
      storedFieldsOf(fresh.of(PLAN_RECORDS)).filter((fields) => slugOf(fields.item) === SCENARIO_ON_PLAN),
      (fields) => [slugOf(fields.amount)],
      'plan tab row',
      'plan tab rows',
    ),
  ])
}

/**
 * A scenario's name keeps to the slug format, is never moved onto the rows of another scenario,
 * and is kept while plan rows name it. Each scenario the change touches must then pass its guards,
 * and so must the owner pay of every plan year that names one of them.
 */
function scenarioRefusals(change: KindChange<ScenarioRow>, fresh: FreshRecords): string[] {
  const edits = slugEdits(change, 'scenario')
  const untouched = untouchedSlugs(change, 'scenario')
  const refusals = slugChangeRefusals('scenario', { edits, untouched }, planUses(fresh), false)
  for (const edit of edits) {
    if (edit.from !== null && edit.to !== null && edit.from !== edit.to && untouched.some((row) => row.slug === edit.to)) {
      refusals.push(`"${edit.to}" is already a scenario. Pick another name.`)
    }
  }
  if (refusals.length > 0) {
    return [...new Set(refusals)]
  }
  const touched = new Set(edits.flatMap((edit) => [edit.from, edit.to]).filter((slug): slug is string => slug !== null))
  const after = readScenarios(change.after).scenarios
  const stopped = after
    .filter((scenario) => touched.has(scenario.slug))
    .flatMap((scenario) => scenarioGuards(scenario).map((guard) => `${scenario.label || scenario.slug}: ${guard.reason}`))
  if (stopped.length > 0) {
    return stopped
  }
  const plan = readPlan(fresh.of(PLAN_RECORDS), definedCategorySlugs(fresh.of(CATEGORY_RECORDS)), new Set(after.map((scenario) => scenario.slug))).facts
  const years = new Set(plan.filter((line) => line.kind === 'owner-pay-scenario' && touched.has(line.scenario)).map((line) => line.year))
  return planGuards(
    plan.filter((line) => years.has(line.year)),
    after,
  ).map((guard) => `The plan tab: ${guard.reason}`)
}

/** The reader checks each row, then the scenario guards check each scenario the change touches. */
export const SCENARIO_WRITES: WriteRules<ScenarioRow> = {
  kind: SCENARIO_RECORDS,
  reads: [PLAN_RECORDS, CATEGORY_RECORDS],
  undoable: true,
  read: (read) => {
    const { scenarios, problems } = readScenarios(read)
    return { facts: scenarios.flatMap((scenario) => scenario.components), problems }
  },
  refusals: scenarioRefusals,
}

/** An employee keeps to the slug format and is on its tab once. */
export const EMPLOYEE_WRITES: WriteRules<Employee> = {
  kind: EMPLOYEE_RECORDS,
  reads: [],
  undoable: true,
  read: (read) => readEmployees(read),
  refusals: (change) => slugChangeRefusals('employee', { edits: slugEdits(change, 'employee'), untouched: untouchedSlugs(change, 'employee') }, usesOf([]), true),
}
