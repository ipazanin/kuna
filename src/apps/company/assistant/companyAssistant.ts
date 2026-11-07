import { CATEGORY_RULES_TAB } from '../rules/presentation/ruleLinks'
import { ASSISTANT_SETTINGS_LINK } from '../settings/presentation/settingsTabs'
import { SETTING_DEFINITIONS } from '../settings/domain/settings'
import { words as settingsWords } from '../settings/presentation/words'
import { REVIEW_LINK } from '../transactions/presentation/transactionsLinks'
import { words as transactionWords } from '../transactions/presentation/words'
import * as coreKinds from '../workbook/domain/coreKinds'
import type { AppAssistant } from '../../../shared/app/appContribution'

const SETTINGS_ROUTE = '/company/settings'

/** What Company tells the chat, with what its pack adds, as only `app.ts` may name the pack. */
export function companyAssistant(pack: Pick<AppAssistant, 'kinds' | 'settings'>): AppAssistant {
  return {
    kinds: [...Object.values(coreKinds), ...pack.kinds],
    places: [
      { route: REVIEW_LINK, title: transactionWords.tabs.review },
      { route: '/company/transactions?tab=import', title: transactionWords.tabs.import },
      { route: `${SETTINGS_ROUTE}?tab=categories`, title: settingsWords.tabNames.categories },
      { route: `${SETTINGS_ROUTE}?tab=${CATEGORY_RULES_TAB}`, title: settingsWords.tabNames.categoryRules },
      { route: `${SETTINGS_ROUTE}?tab=accounts`, title: settingsWords.tabNames.accounts },
      { route: ASSISTANT_SETTINGS_LINK, title: settingsWords.tabNames.assistant },
    ],
    settings: [...SETTING_DEFINITIONS.map(({ key, note }) => ({ key, note })), ...pack.settings],
    guides: [],
  }
}
