import { recordKind } from '../../../features/workbook/domain/recordKind'
import type { Asset } from './assets/assets'
import type { PlanLine } from './forecast/plan'
import type { Grant } from './grants/grants'
import type { OwnerAdvanceEntry } from './ownerAdvancesReading'
import type { ScenarioRow } from './scenarios/scenariosReading'
import type { YearEndLine } from './yearEnd/yearEnd'

export const OWNER_ADVANCE_RECORDS = recordKind<OwnerAdvanceEntry>('owner-advance', 'owner advance', 'owner advances', 'an')
export const ASSET_RECORDS = recordKind<Asset>('asset', 'asset', 'assets', 'an')
export const GRANT_RECORDS = recordKind<Grant>('grant', 'grant', 'grants')
export const YEAR_END_RECORDS = recordKind<YearEndLine>('year-end-line', 'year-end line', 'year-end lines')
export const PLAN_RECORDS = recordKind<PlanLine>('plan-line', 'plan row', 'plan rows')
export const SCENARIO_RECORDS = recordKind<ScenarioRow>('scenario-component', 'scenario row', 'scenario rows')
