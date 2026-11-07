import { words as mailWords } from '../mail/presentation/words'
import { INVESTMENTS_CHECKS_ROUTE, INVESTMENTS_GENERAL_ROUTE, INVESTMENTS_PRICES_ROUTE } from '../overview/presentation/investmentLinks'
import { words as settingsWords } from '../settings/presentation/words'
import * as investmentKinds from '../workbook/domain/investmentKinds'
import type { AppAssistant } from '../../../shared/app/appContribution'
import { words } from './words'
import type { AutomationLabels } from './words'

const AUTOMATION_LABELS: AutomationLabels = {
  settings: settingsWords.title,
  general: settingsWords.tabs.general,
  mail: mailWords.card.title,
}

/** What Investments tells the chat: what it keeps, the tabs of its Settings and the automation it offers. It has no settings table of its own. */
export const INVESTMENTS_ASSISTANT: AppAssistant = {
  kinds: Object.values(investmentKinds),
  places: [
    { route: INVESTMENTS_GENERAL_ROUTE, title: settingsWords.tabs.general },
    { route: INVESTMENTS_PRICES_ROUTE, title: settingsWords.tabs.prices },
    { route: INVESTMENTS_CHECKS_ROUTE, title: settingsWords.tabs.checks },
  ],
  settings: [],
  guides: [{ id: 'ibkr-mail', title: mailWords.guide.title, body: mailWords.guide.body, places: [INVESTMENTS_GENERAL_ROUTE] }],
  automations: [{ id: 'ibkr-mail', title: words.automations.ibkrMail.title, what: words.automations.ibkrMail.what(AUTOMATION_LABELS), setUpRoute: INVESTMENTS_GENERAL_ROUTE, guide: 'ibkr-mail' }],
}
