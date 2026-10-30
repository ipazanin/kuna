import { recordKind } from '../../../../../shared/storage/domain/recordKind'
import type { Asset } from './assets/assets'
import type { Employee } from './employees/employees'
import type { PlanLine } from './forecast/plan'
import type { Grant } from './grants/grants'
import type { OwnerAdvanceEntry } from './ownerAdvancesReading'
import type { ScenarioRow } from './scenarios/scenariosReading'
import type { YearEndLine } from './yearEnd/yearEnd'

export const OWNER_ADVANCE_RECORDS = recordKind<OwnerAdvanceEntry>('hr-doo.owner-advance', {
  en: { one: 'owner advance', many: 'owner advances', article: 'an' },
  hr: { one: 'predujam vlasnika', of: 'predujma vlasnika', few: 'predujma vlasnika', other: 'predujmova vlasnika', gender: 'masculine' },
})
export const ASSET_RECORDS = recordKind<Asset>('hr-doo.asset', {
  en: { one: 'asset', many: 'assets', article: 'an' },
  hr: { one: 'sredstvo', of: 'sredstva', few: 'sredstva', other: 'sredstava', gender: 'neuter' },
})
export const GRANT_RECORDS = recordKind<Grant>('hr-doo.grant', {
  en: { one: 'grant', many: 'grants', article: 'a' },
  hr: { one: 'potpora', of: 'potpore', few: 'potpore', other: 'potpora', gender: 'feminine' },
})
export const YEAR_END_RECORDS = recordKind<YearEndLine>('hr-doo.year-end-line', {
  en: { one: 'year-end line', many: 'year-end lines', article: 'a' },
  hr: { one: 'stavka zaključka godine', of: 'stavke zaključka godine', few: 'stavke zaključka godine', other: 'stavki zaključka godine', gender: 'feminine' },
})
export const PLAN_RECORDS = recordKind<PlanLine>('hr-doo.plan-line', {
  en: { one: 'plan row', many: 'plan rows', article: 'a' },
  hr: { one: 'stavka plana', of: 'stavke plana', few: 'stavke plana', other: 'stavki plana', gender: 'feminine' },
})
export const SCENARIO_RECORDS = recordKind<ScenarioRow>('hr-doo.scenario-component', {
  en: { one: 'scenario row', many: 'scenario rows', article: 'a' },
  hr: { one: 'stavka scenarija', of: 'stavke scenarija', few: 'stavke scenarija', other: 'stavki scenarija', gender: 'feminine' },
})
export const EMPLOYEE_RECORDS = recordKind<Employee>('hr-doo.employee', {
  en: { one: 'employee', many: 'employees', article: 'an' },
  hr: { one: 'zaposlenik', of: 'zaposlenika', few: 'zaposlenika', other: 'zaposlenika', gender: 'masculine' },
})
