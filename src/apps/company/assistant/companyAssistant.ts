import { words as assistWords } from '../assist/presentation/words'
import { CATEGORY_RULES_TAB } from '../rules/presentation/ruleLinks'
import { ASSISTANT_SETTINGS_LINK } from '../settings/presentation/settingsTabs'
import { SETTING_DEFINITIONS } from '../settings/domain/settings'
import { words as settingsWords } from '../settings/presentation/words'
import { REVIEW_LINK } from '../transactions/presentation/transactionsLinks'
import { words as transactionWords } from '../transactions/presentation/words'
import * as coreKinds from '../workbook/domain/coreKinds'
import type { AppAssistant } from '../../../shared/app/appContribution'
import { words } from './words'
import type { GuideLabels } from './words'

const SETTINGS_ROUTE = '/company/settings'
const CATEGORY_RULES_LINK = `${SETTINGS_ROUTE}?tab=${CATEGORY_RULES_TAB}`

const LABELS: GuideLabels = {
  transactions: transactionWords.title,
  review: transactionWords.tabs.review,
  suggest: assistWords.suggest.title,
  recategorise: transactionWords.review.item.recategorise,
  makeRule: transactionWords.review.makeRule,
  settings: settingsWords.title,
  categoryRules: settingsWords.tabNames.categoryRules,
}

/** What Company tells the chat, with what its pack adds, as only `app.ts` may name the pack. */
export function companyAssistant(pack: Pick<AppAssistant, 'kinds' | 'settings'>): AppAssistant {
  return {
    kinds: [...Object.values(coreKinds), ...pack.kinds],
    places: [
      { route: REVIEW_LINK, title: transactionWords.tabs.review },
      { route: '/company/transactions?tab=import', title: transactionWords.tabs.import },
      { route: `${SETTINGS_ROUTE}?tab=categories`, title: settingsWords.tabNames.categories },
      { route: CATEGORY_RULES_LINK, title: settingsWords.tabNames.categoryRules },
      { route: `${SETTINGS_ROUTE}?tab=accounts`, title: settingsWords.tabNames.accounts },
      { route: ASSISTANT_SETTINGS_LINK, title: settingsWords.tabNames.assistant },
    ],
    settings: [...SETTING_DEFINITIONS.map(({ key, note }) => ({ key, note })), ...pack.settings],
    guides: [{ id: 'review', title: words.guides.review.title, body: words.guides.review.body(LABELS), places: [REVIEW_LINK, CATEGORY_RULES_LINK] }],
  }
}
