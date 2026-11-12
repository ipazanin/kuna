import { definedCategories, definedCategorySlugs } from '../../../workbook/domain/categoriesReading'
import { CATEGORY_RECORDS, LEDGER_RECORDS } from '../../../workbook/domain/coreKinds'
import { readLedger } from '../../../workbook/domain/ledgerReading'
import { storedFieldsOf } from '../../../../../shared/storage/domain/recordsRead'
import { counted, countedBy, slugChangeRefusals, usesOf } from '../../../workbook/domain/slug'
import { words } from './words'
import type { SlugEdit } from '../../../workbook/domain/slug'
import { slugOf, textOf, wholeNumberOf } from '../../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../../shared/storage/domain/storedFields'
import { recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import { pickedEdits, pickedUntouched } from '../../../../../shared/storage/domain/writeRules'
import type { FreshRecords, KindChange, RecordEdit, WriteRules } from '../../../../../shared/storage/domain/writeRules'
import { readAssets } from './assets/assetsReading'
import type { Asset } from './assets/assets'
import type { Employee } from './employees/employees'
import { readEmployees } from './employees/employeesReading'
import { planGuards } from './forecast/planGuards'
import type { PlanLine } from './forecast/plan'
import { readPlan } from './forecast/planReading'
import type { Grant } from './grants/grants'
import { readGrants } from './grants/grantsReading'
import {
  ASSET_RECORDS,
  EMPLOYEE_RECORDS,
  GRANT_RECORDS,
  OWNER_ADVANCE_RECORDS,
  PLAN_RECORDS,
  SCENARIO_RECORDS,
  TRIP_COST_RECORDS,
  TRIP_LEG_RECORDS,
  TRIP_RECORDS,
  YEAR_END_RECORDS,
} from './hrDooKinds'
import { readOwnerAdvances } from './ownerAdvancesReading'
import type { OwnerAdvanceEntry } from './ownerAdvancesReading'
import { scenarioGuards } from './scenarios/scenarioGuards'
import { readScenarios } from './scenarios/scenariosReading'
import { scenarioName } from './scenarios/startingScenarios'
import type { ScenarioRow } from './scenarios/scenariosReading'
import type { YearEndLine } from './yearEnd/yearEnd'
import { readYearEndLines } from './yearEnd/yearEndReading'
import type { Trip, TripCost, TripLeg } from './trips/trip'
import { TRIP_FIELD, readTrips, tripCodecs } from './trips/tripReading'
import type { TripCodecs, TripFault, TripWording } from './trips/tripReading'
import type { TripProblem } from './trips/tripRules'
import { TRIP_ROW_LINKS, tripRowProblem } from './trips/tripBankRows'
import type { TripRowLink, TripRowProblem } from './trips/tripBankRows'
import type { TripRecords, TripsReading } from './trips/tripReading'
import type { RecordKind } from '../../../../../shared/storage/domain/recordKind'
import type { RecordsRead } from '../../../../../shared/storage/domain/recordsRead'

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
      usesOf([countedBy(storedFieldsOf(fresh.of(ASSET_RECORDS)), (fields) => [slugOf(fields.funded_by)], counted(words.uses.assets))]),
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
      counted(words.uses.planTabRows),
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
      refusals.push(words.writes.alreadyAScenario(edit.to))
    }
  }
  if (refusals.length > 0) {
    return [...new Set(refusals)]
  }
  const touched = new Set(edits.flatMap((edit) => [edit.from, edit.to]).filter((slug): slug is string => slug !== null))
  const after = readScenarios(change.after).scenarios
  const stopped = after
    .filter((scenario) => touched.has(scenario.slug))
    .flatMap((scenario) => scenarioGuards(scenario).map((guard) => words.writes.scenarioStopped(scenarioName(scenario), guard.reason)))
  if (stopped.length > 0) {
    return stopped
  }
  const plan = readPlan(fresh.of(PLAN_RECORDS), definedCategorySlugs(fresh.of(CATEGORY_RECORDS)), new Set(after.map((scenario) => scenario.slug))).facts
  const years = new Set(plan.filter((line) => line.kind === 'owner-pay-scenario' && touched.has(line.scenario)).map((line) => line.year))
  return planGuards(
    plan.filter((line) => years.has(line.year)),
    after,
  ).map((guard) => words.writes.planTab(guard.reason))
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

/** An employee keeps to the slug format, is on its tab once, and keeps the name travel orders give as their traveller. */
export const EMPLOYEE_WRITES: WriteRules<Employee> = {
  kind: EMPLOYEE_RECORDS,
  reads: [TRIP_RECORDS],
  undoable: true,
  read: (read) => readEmployees(read),
  refusals: (change, fresh) =>
    slugChangeRefusals(
      'employee',
      { edits: slugEdits(change, 'employee'), untouched: untouchedSlugs(change, 'employee') },
      usesOf([countedBy(storedFieldsOf(fresh.of(TRIP_RECORDS)), (fields) => [slugOf(fields.traveller)], counted(words.uses.trips))]),
      true,
    ),
}

const TRIP_KINDS = [TRIP_RECORDS, TRIP_LEG_RECORDS, TRIP_COST_RECORDS, EMPLOYEE_RECORDS]

function tripFaultText(fault: TripFault): string {
  const said = words.tripReading
  switch (fault.kind) {
    case 'none':
      return said.none(fault.field)
    case 'not-a-moment':
      return said.notAMoment(fault.field, fault.text)
    case 'not-whole-from':
      return said.notWholeFrom(fault.field, fault.text, fault.least)
    case 'km-rate-above-zero':
      return said.kmRateAboveZero
    case 'go-together':
      return said.goTogether(fault.first, fault.second)
    case 'odometer-backwards':
      return said.odometerBackwards(fault.start, fault.end)
    case 'not-meals':
      return said.notMeals(fault.entry, fault.most)
    case 'not-foreign-amount':
      return said.notForeignAmount(fault.text)
    case 'not-a-currency':
      return said.notACurrency(fault.text)
  }
}

function tripProblemText(problem: TripProblem): string {
  const said = words.tripReading
  switch (problem.kind) {
    case 'number-twice':
      return said.numberTwice(problem.number)
    case 'no-traveller':
      return said.noTraveller(problem.traveller)
    case 'unknown-country':
      return said.unknownCountry(problem.country)
    case 'returned-without-left':
      return said.returnedWithoutLeft
    case 'returned-before-left':
      return said.returnedBeforeLeft
    case 'abroad-needs-borders':
      return said.abroadNeedsBorders
    case 'borders-at-home':
      return said.bordersAtHome
    case 'borders-out-of-order':
      return said.bordersOutOfOrder
    case 'borders-outside-trip':
      return said.bordersOutsideTrip
    case 'too-many-days':
      return said.tooManyDays(problem.days, problem.longest)
    case 'lasted-too-long':
      return said.lastedTooLong(problem.longest)
    case 'car-without-private-car':
      return said.carWithoutPrivateCar
    case 'private-car-needs-car':
      return said.privateCarNeedsCar
    case 'private-car-needs-odometer':
      return said.privateCarNeedsOdometer
    case 'legs-beyond-odometer':
      return said.legsBeyondOdometer(problem.legs, problem.driven)
    case 'meals-without-times':
      return said.mealsWithoutTimes
    case 'too-many-meals':
      return said.tooManyMeals(problem.meals, problem.lines)
    case 'settled-without-times':
      return said.settledWithoutTimes
    case 'settled-without-report':
      return said.settledWithoutReport
    case 'no-trip':
      return said.noTrip
  }
}

/** The trip kinds' faults and problems in the pack's reading words, which the problems card and a refused write show. */
const TRIP_WORDING: TripWording = { fault: tripFaultText, problem: tripProblemText, unnumbered: words.tripReading.unnumbered, leg: words.tripReading.leg, cost: words.tripReading.cost }

export const TRIP_CODECS: TripCodecs = tripCodecs(TRIP_WORDING)

/** The trips the records make, against the employees they name. */
export function tripsOf(records: TripRecords, employees: ReadonlySet<string>): TripsReading {
  return readTrips(records, employees, TRIP_WORDING)
}

/** The trips the records make, with one kind's records as `read` gives them. */
function tripsWith<R>(kind: RecordKind<R>, read: RecordsRead<R>, records: FreshRecords): TripsReading {
  const of = <K>(other: RecordKind<K>): RecordsRead<K> => (other.name === kind.name ? (read as RecordsRead<unknown> as RecordsRead<K>) : records.of(other))
  const tripRecords: TripRecords = { trips: of(TRIP_RECORDS), legs: of(TRIP_LEG_RECORDS), costs: of(TRIP_COST_RECORDS) }
  return tripsOf(tripRecords, new Set(readEmployees(records.of(EMPLOYEE_RECORDS)).facts.map((employee) => employee.slug)))
}

/** A travel order the write removes keeps no leg or cost that names it, which goes in the same write. */
function tripsStillNamed(change: KindChange<Trip>, after: FreshRecords): string[] {
  const removed = change.edits.flatMap((edit) => (edit.before !== null && edit.after === null && edit.before.id !== null ? [{ id: edit.before.id, label: edit.before.label }] : []))
  return removed.flatMap(({ id, label }) => {
    const named = [...storedFieldsOf(after.of(TRIP_LEG_RECORDS)), ...storedFieldsOf(after.of(TRIP_COST_RECORDS))].filter((fields) => keyOfTrip(fields) === id)
    return named.length === 0 ? [] : [words.writes.tripStillNamed(label, named.length)]
  })
}

function keyOfTrip(fields: StoredFields): RecordId {
  return recordIdOf(TRIP_RECORDS, textOf(fields[TRIP_FIELD]))
}

/** What a problem with a trip's link to a bank row says, on the problems card and in a refused write. */
export function tripRowProblemText(problem: TripRowProblem): string {
  const said = words.tripReading
  switch (problem.kind) {
    case 'row-gone':
      return said.rowGone(ROW_FIELDS[problem.link], problem.rowId)
    case 'no-advance':
      return said.noAdvanceToLink
    case 'linked-twice':
      return said.rowLinkedTwice(ROW_FIELDS[problem.link], problem.number)
  }
}

const ROW_FIELDS: Readonly<Record<TripRowLink, string>> = { advance: 'advance_row', payout: 'payout_row' }

/** A link the write sets or changes holds against the ledger and the other trips' links. */
function linkRefusals(change: KindChange<Trip>, fresh: FreshRecords): string[] {
  const linked = (edit: RecordEdit<Trip>, link: TripRowLink) =>
    textOf(edit.after?.fields[ROW_FIELDS[link]]) !== '' && textOf(edit.after?.fields[ROW_FIELDS[link]]) !== textOf(edit.before?.fields[ROW_FIELDS[link]])
  const set = change.edits.flatMap((edit) => {
    const after = edit.after
    return after !== null && 'record' in after ? TRIP_ROW_LINKS.filter((link) => linked(edit, link)).map((link) => ({ trip: after.record, link })) : []
  })
  if (set.length === 0) return []
  const transactions = readLedger(fresh.of(LEDGER_RECORDS), definedCategories(fresh.of(CATEGORY_RECORDS))).facts
  const trips = change.after.records.map((stored) => stored.record)
  return set.flatMap(({ trip, link }) => {
    const problem = tripRowProblem(trip, link, trips, transactions)
    return problem === null ? [] : [`${trip.number}: ${tripRowProblemText(problem)}`]
  })
}

/** A travel order is checked by the trips reader against the employees and its legs, is removed only with its legs and costs, and links only a bank row that can be its. */
export const TRIP_WRITES: WriteRules<Trip> = {
  kind: TRIP_RECORDS,
  reads: [...TRIP_KINDS, LEDGER_RECORDS, CATEGORY_RECORDS],
  undoable: true,
  read: (read, records) => tripsWith(TRIP_RECORDS, read, records).trips,
  refusals: (change, fresh, after) => [...tripsStillNamed(change, after), ...linkRefusals(change, fresh)],
}

/** A leg names a travel order that counts, and the legs of a trip by private car fit its odometer. */
export const TRIP_LEG_WRITES: WriteRules<TripLeg> = {
  kind: TRIP_LEG_RECORDS,
  reads: TRIP_KINDS,
  undoable: true,
  read: (read, records) => tripsWith(TRIP_LEG_RECORDS, read, records).legs,
  refusals: () => [],
}

/** A cost names a travel order that counts. */
export const TRIP_COST_WRITES: WriteRules<TripCost> = {
  kind: TRIP_COST_RECORDS,
  reads: TRIP_KINDS,
  undoable: true,
  read: (read, records) => tripsWith(TRIP_COST_RECORDS, read, records).costs,
  refusals: () => [],
}
