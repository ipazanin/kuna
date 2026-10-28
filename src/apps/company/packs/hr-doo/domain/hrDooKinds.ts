import { recordKind } from '../../../../../shared/storage/domain/recordKind'
import type { Asset } from './assets/assets'
import type { Employee } from './employees/employees'
import type { PlanLine } from './forecast/plan'
import type { Grant } from './grants/grants'
import type { OwnerAdvanceEntry } from './ownerAdvancesReading'
import type { ScenarioRow } from './scenarios/scenariosReading'
import type { YearEndLine } from './yearEnd/yearEnd'

export const OWNER_ADVANCE_RECORDS = recordKind<OwnerAdvanceEntry>('hr-doo.owner-advance', 'owner advance', 'owner advances', 'an')
export const ASSET_RECORDS = recordKind<Asset>('hr-doo.asset', 'asset', 'assets', 'an')
export const GRANT_RECORDS = recordKind<Grant>('hr-doo.grant', 'grant', 'grants')
export const YEAR_END_RECORDS = recordKind<YearEndLine>('hr-doo.year-end-line', 'year-end line', 'year-end lines')
export const PLAN_RECORDS = recordKind<PlanLine>('hr-doo.plan-line', 'plan row', 'plan rows')
export const SCENARIO_RECORDS = recordKind<ScenarioRow>('hr-doo.scenario-component', 'scenario row', 'scenario rows')
export const EMPLOYEE_RECORDS = recordKind<Employee>('hr-doo.employee', 'employee', 'employees', 'an')
