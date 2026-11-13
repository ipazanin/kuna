import { HOLDING_ROUTE, HOLDINGS_ROUTE } from '../holdings/presentation/holdingLinks'
import { words as holdingsWords } from '../holdings/presentation/words'
import { words as incomeWords } from '../income/presentation/words'
import { words as mailWords } from '../mail/presentation/words'
import {
  INVESTMENTS_ASSISTANT_ROUTE,
  INVESTMENTS_CHECKS_ROUTE,
  INVESTMENTS_GENERAL_ROUTE,
  INVESTMENTS_OVERVIEW_ROUTE,
  INVESTMENTS_PRICES_ROUTE,
  INVESTMENTS_SETTINGS_ROUTE,
} from '../overview/presentation/investmentLinks'
import { words as overviewWords } from '../overview/presentation/words'
import { PERFORMANCE_ROUTE } from '../performance/presentation/performanceLinks'
import { words as performanceWords } from '../performance/presentation/words'
import { words as settingsWords } from '../settings/presentation/words'
import { TAX_ROUTE } from '../tax/presentation/taxLinks'
import { words as taxWords } from '../tax/presentation/words'
import { TRANSACTIONS_ROUTE } from '../transactions/presentation/transactionLinks'
import { words as transactionWords } from '../transactions/presentation/words'
import * as investmentKinds from '../workbook/domain/investmentKinds'
import { INSTRUMENT_RECORDS } from '../workbook/domain/investmentKinds'
import { SURTAX_CITY_2023_KEY } from '../workbook/domain/investmentSettings'
import type { AppAssistant, AssistantPlace } from '../../../shared/app/appContribution'
import type { AppAcceptance, AppProposer } from '../../../shared/app/assistantOperations'
import { lawFilesIn } from '../../../shared/law/infrastructure/lawFiles'
import { investmentsReader } from './investmentsReader'
import type { InvestmentsReading } from './investmentsReader'
import { words } from './words'
import type { AutomationLabels } from './words'

const AUTOMATION_LABELS: AutomationLabels = {
  settings: settingsWords.title,
  general: settingsWords.tabs.general,
  prices: settingsWords.tabs.prices,
  mail: mailWords.card.title,
}

const performanceTab = (tab: string): `/${string}` => `${PERFORMANCE_ROUTE}?tab=${tab}`
const taxTab = (tab: string): `/${string}` => `${TAX_ROUTE}?tab=${tab}`

/** Every Investments screen and tab, the tabs first, since a person on a tab is on that tab and not on its screen. */
const PLACES: readonly AssistantPlace[] = [
  { route: performanceTab('months'), title: performanceWords.tabs.months },
  { route: performanceTab('sources'), title: performanceWords.tabs.sources, params: { period: 'period' } },
  { route: performanceTab('falls'), title: performanceWords.tabs.falls, params: { period: 'period' } },
  { route: performanceTab('income'), title: incomeWords.tabs.income },
  { route: performanceTab('coming'), title: incomeWords.tabs.coming },
  { route: performanceTab('costs'), title: incomeWords.tabs.costs },
  { route: performanceTab('saving'), title: incomeWords.tabs.saving },
  { route: taxTab('sales'), title: taxWords.tabs.sales, params: { year: 'year' } },
  { route: taxTab('foreign'), title: taxWords.tabs.foreign, params: { year: 'year' } },
  { route: taxTab('tax-free'), title: taxWords.tabs.taxFree },
  { route: INVESTMENTS_GENERAL_ROUTE, title: settingsWords.tabs.general },
  { route: INVESTMENTS_PRICES_ROUTE, title: settingsWords.tabs.prices },
  { route: INVESTMENTS_CHECKS_ROUTE, title: settingsWords.tabs.checks },
  { route: INVESTMENTS_ASSISTANT_ROUTE, title: settingsWords.tabs.assistant },
  { route: INVESTMENTS_OVERVIEW_ROUTE, title: overviewWords.title },
  { route: HOLDINGS_ROUTE, title: holdingsWords.title, params: { on: 'day' } },
  { route: HOLDING_ROUTE, title: holdingsWords.holding, params: { instrument: { kind: INSTRUMENT_RECORDS.name } } },
  { route: TRANSACTIONS_ROUTE, title: transactionWords.title },
  { route: PERFORMANCE_ROUTE, title: performanceWords.title, params: { period: 'period' } },
  { route: TAX_ROUTE, title: taxWords.title, params: { year: 'year' } },
  { route: INVESTMENTS_SETTINGS_ROUTE, title: settingsWords.title },
]

/** What Investments tells the chat: what it keeps and where things are, the 2023 city the Tax screen keeps, the automations it offers, the law its Tax screen rests on, what it can read and what it can change. */
export const investmentsAssistant = (reading: InvestmentsReading, changes: { readonly proposer: AppProposer; readonly acceptance: AppAcceptance } | null = null): AppAssistant => ({
  kinds: Object.values(investmentKinds),
  places: PLACES,
  law: lawFilesIn('investments'),
  settings: [{ key: SURTAX_CITY_2023_KEY, note: words.settings.surtaxCity2023 }],
  guides: [
    { id: 'set-up', label: words.guides.setUp.label, title: words.guides.setUp.title, body: words.guides.setUp.body, places: [INVESTMENTS_GENERAL_ROUTE, TRANSACTIONS_ROUTE] },
    { id: 'ibkr-mail', title: mailWords.guide.title, body: mailWords.guide.body, places: [INVESTMENTS_GENERAL_ROUTE] },
  ],
  automations: [
    { id: 'daily-closes', title: words.automations.dailyCloses.title, what: words.automations.dailyCloses.what(AUTOMATION_LABELS), setUpRoute: INVESTMENTS_PRICES_ROUTE },
    { id: 'ibkr-mail', title: words.automations.ibkrMail.title, what: words.automations.ibkrMail.what(AUTOMATION_LABELS), setUpRoute: INVESTMENTS_GENERAL_ROUTE, guide: 'ibkr-mail' },
  ],
  setUp: [
    { key: 'first-holdings', about: 'The file has no transaction yet.', operations: ['add-account', 'import-transcribed', 'add-holding'] },
    { key: 'cash-below-zero', about: 'Cash is below zero, so a deposit is missing.', operations: ['import-transcribed'] },
    { key: 'history', about: 'The person has not said the history is complete.', operations: ['confirm-history'] },
    { key: 'prices', about: 'Some holdings have no price.', operations: ['fetch-prices'] },
  ],
  reader: investmentsReader(reading),
  proposer: changes?.proposer ?? null,
  acceptance: changes?.acceptance ?? null,
  quickActions: [words.quickActions.doing, words.quickActions.income],
  persons: () => [],
})
