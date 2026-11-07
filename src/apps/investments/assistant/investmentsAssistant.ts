import { INVESTMENTS_SETTINGS_ROUTE } from '../overview/presentation/investmentLinks'
import { words as settingsWords } from '../settings/presentation/words'
import * as investmentKinds from '../workbook/domain/investmentKinds'
import type { AppAssistant } from '../../../shared/app/appContribution'

/** What Investments tells the chat: what it keeps and the tabs of its Settings. It has no settings table of its own. */
export const INVESTMENTS_ASSISTANT: AppAssistant = {
  kinds: Object.values(investmentKinds),
  places: [
    { route: `${INVESTMENTS_SETTINGS_ROUTE}?tab=prices`, title: settingsWords.tabs.prices },
    { route: `${INVESTMENTS_SETTINGS_ROUTE}?tab=checks`, title: settingsWords.tabs.checks },
  ],
  settings: [],
  guides: [],
}
