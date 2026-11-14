import { packPart, recordsOfKind } from '../../../workbook/domain/packPart'
import { recordsOf } from '../../../../../shared/storage/domain/recordsRead'
import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import { itemsTripsFile } from './trips/tripBankRows'
import type { RecordCodec } from '../../../../../shared/storage/domain/recordCodec'
import type { PackKey, PackPart } from '../../../workbook/domain/packPart'
import { CATEGORY_NAMING, OWNER_ADVANCE_NAMING } from './categoryNaming'
import { tabProblems } from '../../../workbook/domain/workbook'
import type { OwnerAdvance, Workbook } from '../../../workbook/domain/workbook'
import { assetPaymentProblems, assetsClaimingRows } from './assets/assetRegister'
import type { Asset } from './assets/assets'
import { ASSET_CODEC, readAssets } from './assets/assetsReading'
import { COMPANY_FACT_SETTINGS } from './companyFacts'
import type { CompanyFacts } from './companyFacts'
import type { Employee } from './employees/employees'
import { EMPLOYEE_CODEC, readEmployees } from './employees/employeesReading'
import type { PlanLine } from './forecast/plan'
import { PLAN_CODEC, readPlan } from './forecast/planReading'
import type { Grant } from './grants/grants'
import { GRANT_CODEC, readGrants } from './grants/grantsReading'
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
import {
  ASSET_WRITES,
  EMPLOYEE_WRITES,
  GRANT_WRITES,
  OWNER_ADVANCE_WRITES,
  PLAN_WRITES,
  SCENARIO_WRITES,
  TRIP_CODECS,
  TRIP_COST_WRITES,
  TRIP_LEG_WRITES,
  TRIP_WRITES,
  YEAR_END_WRITES,
  tripRowProblemText,
  tripsOf,
} from './hrDooWrites'
import { tripRowProblems } from './trips/tripBankRows'
import { problemOf } from '../../../../../shared/storage/domain/recordsRead'
import type { TripFile } from './trips/tripReading'
import { OWNER_ADVANCE_CODEC, advanceItemProblemsOf, readOwnerAdvances } from './ownerAdvancesReading'
import type { RepaidBy } from './ownerAdvancesReading'
import { PACK_ROLES, TAX_FREE_ROLES } from './packRoles'
import type { OwnerPayScenario } from './scenarios/ownerPayScenarios'
import { SCENARIO_CODEC, readScenarios } from './scenarios/scenariosReading'
import type { YearEndLine } from './yearEnd/yearEnd'
import { YEAR_END_CODEC, readYearEnd } from './yearEnd/yearEndReading'
import { STARTING_CATEGORIES } from '../preset/domain/startingCategories'
import { startingRules } from '../preset/domain/startingRules'
import { CATEGORY_CLASSES } from '../preset/domain/taxClassOf'
import { words } from './words'

/** The pack's part of the workbook: the records only the pack reads, the costs it hands core, and the facts its settings keys hold. */
export interface HrDooPart {
  /** In the order the tab holds them. */
  readonly ownerAdvances: readonly OwnerAdvance[]
  /** What paid each advance back, in books that keep items. Left out in books from before items, which read as they did. */
  readonly repaidBy?: RepaidBy
  /** In the order the tab holds them. */
  readonly assets: readonly Asset[]
  /** In the order the tab holds them. */
  readonly grants: readonly Grant[]
  /** The accountant's figures, in the order the tab holds them. */
  readonly yearEndLines: readonly YearEndLine[]
  /** In the order the tab holds them. */
  readonly planLines: readonly PlanLine[]
  /** In the order their first rows appear on the tab. */
  readonly payScenarios: readonly OwnerPayScenario[]
  /** In the order the tab holds them. */
  readonly employees: readonly Employee[]
  /** The director among the employees, whose facts the owner's pay is worked out on, or null when no single row is the director's. */
  readonly director: Employee | null
  /** The travel orders that count, each with its legs and costs, in the order the trips tab holds them. */
  readonly trips: readonly TripFile[]
  readonly companyFacts: CompanyFacts
}

/** The workbook as the pack's figures read it: core's records with the pack's part. */
export type HrDooWorkbook = Workbook & HrDooPart

export const HR_DOO: PackKey<HrDooPart> = { name: 'hr-doo' }

/** The workbook with the pack's part. Throws for a workbook read without the pack installed, which no pack screen is shown for. */
export function hrDooWorkbook(workbook: Workbook): HrDooWorkbook {
  const part = packPart(workbook, HR_DOO)
  if (part === null) {
    throw new Error('The workbook was read without the hr-doo pack installed.')
  }
  return { ...workbook, ...part }
}

/**
 * The pack's part, read from its records against core's categories with the rules across them:
 * assets against the grants, plan lines against the categories and the scenarios, year-end konto
 * lines against the categories, and owner advances in an operating or taxes category.
 */
export const HR_DOO_PART: PackPart<HrDooPart, CompanyFacts> = {
  key: HR_DOO,
  kinds: [OWNER_ADVANCE_WRITES, ASSET_WRITES, GRANT_WRITES, YEAR_END_WRITES, PLAN_WRITES, SCENARIO_WRITES, EMPLOYEE_WRITES, TRIP_WRITES, TRIP_LEG_WRITES, TRIP_COST_WRITES],
  codecs: [
    OWNER_ADVANCE_CODEC,
    ASSET_CODEC,
    GRANT_CODEC,
    YEAR_END_CODEC,
    PLAN_CODEC,
    SCENARIO_CODEC,
    EMPLOYEE_CODEC,
    TRIP_CODECS.trip,
    TRIP_CODECS.leg,
    TRIP_CODECS.cost,
  ] as readonly RecordCodec<unknown>[],
  schemaVersion: 2,
  settings: COMPANY_FACT_SETTINGS,
  categoryNaming: CATEGORY_NAMING,
  ownerAdvanceNaming: OWNER_ADVANCE_NAMING,
  categoryRoles: [...Object.values(PACK_ROLES), ...TAX_FREE_ROLES],
  categoryClasses: CATEGORY_CLASSES,
  directionPairedRoles: [PACK_ROLES.ownerLoanOut, PACK_ROLES.ownerLoanRepaid, PACK_ROLES.reimbursement],
  pairSides: { [PACK_ROLES.ownerLoanOut]: 'debit', [PACK_ROLES.ownerLoanRepaid]: 'credit' },
  startingCategories: STARTING_CATEGORIES,
  startingRules,
  assemble: (records, companyFacts, core, itemsStored) => {
    const categorySlugs = new Set(core.categories.map((category) => category.slug))
    const grants = readGrants(recordsOfKind(records, GRANT_RECORDS))
    const scenarios = readScenarios(recordsOfKind(records, SCENARIO_RECORDS))
    const ownerAdvances = readOwnerAdvances(recordsOfKind(records, OWNER_ADVANCE_RECORDS), core.categories, itemsStored)
    const assets = readAssets(recordsOfKind(records, ASSET_RECORDS), new Set(grants.facts.map((grant) => grant.slug)))
    const yearEndLines = readYearEnd(recordsOfKind(records, YEAR_END_RECORDS), categorySlugs)
    const employees = readEmployees(recordsOfKind(records, EMPLOYEE_RECORDS))
    const trips = tripsOf(
      { trips: recordsOfKind(records, TRIP_RECORDS), legs: recordsOfKind(records, TRIP_LEG_RECORDS), costs: recordsOfKind(records, TRIP_COST_RECORDS) },
      new Set(employees.facts.map((employee) => employee.slug)),
    )
    const planLines = readPlan(recordsOfKind(records, PLAN_RECORDS), categorySlugs, new Set(scenarios.scenarios.map((scenario) => scenario.slug)))
    return {
      part: {
        ownerAdvances: ownerAdvances.facts,
        ...(ownerAdvances.repaidBy === null ? {} : { repaidBy: ownerAdvances.repaidBy }),
        assets: assets.facts,
        grants: grants.facts,
        yearEndLines: yearEndLines.facts,
        planLines: planLines.facts,
        payScenarios: scenarios.scenarios,
        employees: employees.facts,
        director: employees.director,
        trips: trips.files,
        companyFacts,
      },
      problems: [
        ...tabProblems('grants', grants.problems),
        ...tabProblems('scenarios', scenarios.problems),
        ...tabProblems('owner-advances', [...ownerAdvances.problems, ...advanceItemProblemsOf(recordsOfKind(records, OWNER_ADVANCE_RECORDS), ownerAdvances, core)]),
        ...tabProblems('assets', [...assets.problems, ...assetPaymentProblems(assets.facts, core.transactions, core.categories)]),
        ...tabProblems('year-end', yearEndLines.problems),
        ...tabProblems('plan', planLines.problems),
        ...tabProblems('employees', employees.problems),
        ...tabProblems('trips', [
          ...trips.trips.problems,
          ...tripRowProblems(trips.trips.facts, core).map(({ trip, problem }) => problemOf({ id: trip.id, label: trip.number }, tripRowProblemText(problem))),
        ]),
        ...tabProblems('trip-legs', trips.legs.problems),
        ...tabProblems('trip-costs', trips.costs.problems),
      ],
    }
  },
  ownerAdvances: (part) => part.ownerAdvances,
  // An asset funded by a grant the grants tab lacks still claims its payment, so the grants need no read here.
  rowsKeptWhole: (records, ledger) =>
    new Map(
      [...assetsClaimingRows(readAssets(recordsOfKind(records, ASSET_RECORDS), new Set()).facts, ledger.transactions, ledger.categories)].map(([row, names]) => [row, words.assetsClaiming(names)]),
    ),
  keptWholeReads: [ASSET_RECORDS],
  itemsKept: (records, ledger) =>
    new Map([
      ...[...itemsTripsFile(recordsOf(recordsOfKind(records, TRIP_RECORDS)), ledger)].map(([item, number]) => [item, words.tripFiling(number)] as const),
      ...recordsOf(recordsOfKind(records, OWNER_ADVANCE_RECORDS)).flatMap((advance) =>
        (advance.repaidBy ?? []).map((item) => [item, words.advanceRepaid(advance.description || dayLabel(advance.date))] as const),
      ),
    ]),
  itemsKeptReads: [TRIP_RECORDS, OWNER_ADVANCE_RECORDS],
}
