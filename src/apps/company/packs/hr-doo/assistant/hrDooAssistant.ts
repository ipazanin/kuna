import type { PackAssistant } from '../../../assistant/companyAssistant'
import { COMPANY_FACT_SETTINGS } from '../domain/companyFacts'
import * as hrDooKinds from '../domain/hrDooKinds'
import { words as salaryWords } from '../presentation/salaries/words'
import { words as packWords } from '../presentation/words'
import { words as yearWords } from '../presentation/year/words'
import { TAX_RULES_TAB } from '../ruleset/presentation/taxRuleLinks'
import { words as rulesetWords } from '../ruleset/presentation/words'
import type { AssistantPlace } from '../../../../../shared/app/appContribution'
import { TAX_RULE_KIND } from './buildUpRead'
import { hrDooReader } from './packReader'

const YEAR = { year: 'year' } as const satisfies AssistantPlace['params']
const EMPLOYEE = { kind: hrDooKinds.EMPLOYEE_RECORDS.name }

/** The tabs of the pack's own screens, and its tab on Settings, with the query keys a link may fill. */
const PLACES: readonly AssistantPlace[] = [
  { route: '/company/owner?tab=taken', title: packWords.owner.tabs.taken, params: { p: 'period' } },
  { route: '/company/owner?tab=owed', title: packWords.owner.tabs.owed, params: { p: 'period' } },
  { route: '/company/year?tab=forecast', title: yearWords.tabs.forecast, params: YEAR },
  { route: '/company/year?tab=plan', title: yearWords.tabs.plan, params: YEAR },
  { route: '/company/year?tab=pay', title: yearWords.tabs.pay, params: YEAR },
  { route: '/company/year?tab=taxes', title: yearWords.tabs.taxes, params: YEAR },
  { route: '/company/year?tab=assets', title: yearWords.tabs.assets, params: YEAR },
  { route: '/company/year?tab=accountant', title: yearWords.tabs.accountant, params: YEAR },
  { route: '/company/year?tab=statements', title: yearWords.tabs.statements, params: YEAR },
  { route: '/company/salaries?tab=month', title: salaryWords.screen.tabs.month, params: { year: 'year', month: 'month', employee: EMPLOYEE } },
  { route: '/company/salaries?tab=over-time', title: salaryWords.screen.tabs.overTime, params: { year: 'year', employee: EMPLOYEE } },
  { route: '/company/salaries?tab=people', title: salaryWords.screen.tabs.people, params: { year: 'year', month: 'month' } },
  { route: `/company/settings?tab=${TAX_RULES_TAB}`, title: rulesetWords.tab, params: { rule: { kind: TAX_RULE_KIND } } },
]

/** What the Croatian d.o.o. pack adds to what Company tells the chat and to what it reads. */
export const HR_DOO_ASSISTANT: PackAssistant = {
  kinds: Object.values(hrDooKinds),
  places: PLACES,
  settings: COMPANY_FACT_SETTINGS.definitions.map(({ key, note }) => ({ key, note })),
  reader: hrDooReader,
}
