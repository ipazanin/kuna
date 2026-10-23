import { packPart, recordsOfKind } from '../../../features/workbook/domain/packPart'
import type { PackKey, PackPart } from '../../../features/workbook/domain/packPart'
import { tabProblems } from '../../../features/workbook/domain/workbook'
import type { OwnerAdvance, Workbook } from '../../../features/workbook/domain/workbook'
import { assetsClaimingRows, uncheckedClaimProblems } from './assets/assetRegister'
import type { Asset } from './assets/assets'
import { readAssets } from './assets/assetsReading'
import { COMPANY_FACT_SETTINGS } from './companyFacts'
import type { CompanyFacts } from './companyFacts'
import type { PlanLine } from './forecast/plan'
import { readPlan } from './forecast/planReading'
import type { Grant } from './grants/grants'
import { readGrants } from './grants/grantsReading'
import { ASSET_RECORDS, GRANT_RECORDS, OWNER_ADVANCE_RECORDS, PLAN_RECORDS, SCENARIO_RECORDS, YEAR_END_RECORDS } from './hrDooKinds'
import { ASSET_WRITES, GRANT_WRITES, OWNER_ADVANCE_WRITES, PLAN_WRITES, SCENARIO_WRITES, YEAR_END_WRITES } from './hrDooWrites'
import { readOwnerAdvances } from './ownerAdvancesReading'
import { PACK_ROLES } from './packRoles'
import type { OwnerPayScenario } from './scenarios/ownerPayScenarios'
import { readScenarios } from './scenarios/scenariosReading'
import type { YearEndLine } from './yearEnd/yearEnd'
import { readYearEnd } from './yearEnd/yearEndReading'

/** The pack's part of the workbook: the records only the pack reads, the costs it hands core, and the facts its settings keys hold. */
export interface HrDooPart {
  /** In the order the tab holds them. */
  readonly ownerAdvances: readonly OwnerAdvance[]
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
  kinds: [OWNER_ADVANCE_WRITES, ASSET_WRITES, GRANT_WRITES, YEAR_END_WRITES, PLAN_WRITES, SCENARIO_WRITES],
  settings: COMPANY_FACT_SETTINGS,
  categoryRoles: Object.values(PACK_ROLES),
  assemble: (records, companyFacts, core) => {
    const categorySlugs = new Set(core.categories.map((category) => category.slug))
    const grants = readGrants(recordsOfKind(records, GRANT_RECORDS))
    const scenarios = readScenarios(recordsOfKind(records, SCENARIO_RECORDS))
    const ownerAdvances = readOwnerAdvances(recordsOfKind(records, OWNER_ADVANCE_RECORDS), core.categories)
    const assets = readAssets(recordsOfKind(records, ASSET_RECORDS), new Set(grants.facts.map((grant) => grant.slug)))
    const yearEndLines = readYearEnd(recordsOfKind(records, YEAR_END_RECORDS), categorySlugs)
    const planLines = readPlan(recordsOfKind(records, PLAN_RECORDS), categorySlugs, new Set(scenarios.scenarios.map((scenario) => scenario.slug)))
    return {
      part: {
        ownerAdvances: ownerAdvances.facts,
        assets: assets.facts,
        grants: grants.facts,
        yearEndLines: yearEndLines.facts,
        planLines: planLines.facts,
        payScenarios: scenarios.scenarios,
        companyFacts,
      },
      problems: [
        ...tabProblems('grants', grants.problems),
        ...tabProblems('scenarios', scenarios.problems),
        ...tabProblems('owner-advances', ownerAdvances.problems),
        ...tabProblems('assets', [...assets.problems, ...uncheckedClaimProblems(assets.facts, core.transactions, core.categories)]),
        ...tabProblems('year-end', yearEndLines.problems),
        ...tabProblems('plan', planLines.problems),
      ],
    }
  },
  ownerAdvances: (part) => part.ownerAdvances,
  // An asset funded by a grant the grants tab lacks still claims its payment, so the grants need no read here.
  rowsKeptWhole: (records, ledger) => assetsClaimingRows(readAssets(recordsOfKind(records, ASSET_RECORDS), new Set()).facts, ledger.transactions, ledger.categories),
  keptWholeReads: [ASSET_RECORDS],
}
