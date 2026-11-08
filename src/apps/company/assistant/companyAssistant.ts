import { words as analysisWords } from '../analysis/presentation/words'
import { words as assistWords } from '../assist/presentation/words'
import { words as invoicingWords } from '../invoicing/presentation/words'
import { words as mailWords } from '../mail/presentation/words'
import { CATEGORY_RULES_TAB } from '../rules/presentation/ruleLinks'
import { ASSISTANT_SETTINGS_LINK, BOOKS_FILE_LINK } from '../settings/presentation/settingsTabs'
import { PERSON_PAYEES_KEY, SETTING_DEFINITIONS } from '../settings/domain/settings'
import { words as settingsWords } from '../settings/presentation/words'
import { REVIEW_LINK } from '../transactions/presentation/transactionsLinks'
import { words as transactionWords } from '../transactions/presentation/words'
import * as coreKinds from '../workbook/domain/coreKinds'
import type { AppAssistant, AssistantPlace } from '../../../shared/app/appContribution'
import type { KnownPerson } from '../../../shared/privacy/domain/pseudonyms'
import { companyReader } from './companyReader'
import type { CompanyReading, PackReader } from './companyReader'
import { words } from './words'
import type { AutomationLabels, GuideLabels } from './words'

const SETTINGS_ROUTE = '/company/settings'
const GENERAL_SETTINGS_LINK = `${SETTINGS_ROUTE}?tab=general`
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

const AUTOMATION_LABELS: AutomationLabels = {
  settings: settingsWords.title,
  general: settingsWords.tabNames.general,
  mail: mailWords.card.title,
  review: transactionWords.tabs.review,
}

/** The query keys the ledger's filters share across screens: the period as Company's filters write it, and an account and a category by the ref Kuna handed out. */
const LEDGER_FILTERS: AssistantPlace['params'] = { p: 'period', acc: { kind: coreKinds.ACCOUNT_RECORDS.name }, cat: { kind: coreKinds.CATEGORY_RECORDS.name } }

/** Every tab of Company's own screens, with the query keys a link may fill. */
const PLACES: readonly AssistantPlace[] = [
  { route: '/company/transactions?tab=rows', title: transactionWords.tabs.rows, params: LEDGER_FILTERS },
  { route: REVIEW_LINK, title: transactionWords.tabs.review, params: { acc: { kind: coreKinds.ACCOUNT_RECORDS.name }, cat: { kind: coreKinds.CATEGORY_RECORDS.name } } },
  { route: '/company/transactions?tab=import', title: transactionWords.tabs.import },
  { route: '/company/invoicing?tab=invoices', title: invoicingWords.tabs.invoices, params: { client: { kind: coreKinds.CLIENT_RECORDS.name } } },
  { route: '/company/invoicing?tab=plan', title: invoicingWords.tabs.plan, params: { year: 'year', month: 'month' } },
  { route: '/company/invoicing?tab=clients', title: invoicingWords.tabs.clients },
  { route: '/company/analysis?tab=breakdown', title: analysisWords.tabs.breakdown, params: LEDGER_FILTERS },
  { route: '/company/analysis?tab=over-time', title: analysisWords.tabs.overTime, params: LEDGER_FILTERS },
  { route: '/company/analysis?tab=compare', title: analysisWords.tabs.compare, params: LEDGER_FILTERS },
  { route: GENERAL_SETTINGS_LINK, title: settingsWords.tabNames.general },
  { route: `${SETTINGS_ROUTE}?tab=categories`, title: settingsWords.tabNames.categories },
  { route: CATEGORY_RULES_LINK, title: settingsWords.tabNames.categoryRules, params: { rule: { kind: coreKinds.RULE_RECORDS.name } } },
  { route: `${SETTINGS_ROUTE}?tab=accounts`, title: settingsWords.tabNames.accounts },
  { route: ASSISTANT_SETTINGS_LINK, title: settingsWords.tabNames.assistant },
  { route: BOOKS_FILE_LINK, title: settingsWords.booksFile },
]

/** What a pack tells the chat beside core, and what it adds to what the chat reads of the company. */
export interface PackAssistant extends Pick<AppAssistant, 'kinds' | 'settings' | 'places'> {
  reader(reading: CompanyReading): PackReader
}

/**
 * What Company tells the chat and lets it read, with what its pack adds, as only `app.ts` may name the pack. `reading` and
 * `persons` read the books `app.ts` holds: the persons are the employees through the pack and the payees the owner flagged.
 */
export function companyAssistant(pack: PackAssistant, reading: CompanyReading, persons: () => readonly KnownPerson[]): AppAssistant {
  return {
    kinds: [...Object.values(coreKinds), ...pack.kinds],
    places: [...PLACES, ...pack.places],
    settings: [...SETTING_DEFINITIONS.filter(({ key }) => key !== PERSON_PAYEES_KEY).map(({ key, note }) => ({ key, note })), ...pack.settings],
    guides: [{ id: 'review', title: words.guides.review.title, body: words.guides.review.body(LABELS), places: [REVIEW_LINK, CATEGORY_RULES_LINK] }],
    automations: [
      {
        id: 'statements-from-mail',
        title: words.automations.statementsFromMail.title,
        what: words.automations.statementsFromMail.what(AUTOMATION_LABELS),
        setUpRoute: GENERAL_SETTINGS_LINK,
      },
      {
        id: 'statements-on-sync',
        title: words.automations.statementsOnSync.title,
        what: words.automations.statementsOnSync.what(AUTOMATION_LABELS),
        setUpRoute: GENERAL_SETTINGS_LINK,
      },
    ],
    reader: companyReader(reading, pack.reader(reading)),
    proposer: null,
    acceptance: null,
    quickActions: [],
    persons,
  }
}
