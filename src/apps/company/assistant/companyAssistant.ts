import { words as analysisWords } from '../analysis/presentation/words'
import { words as invoicingWords } from '../invoicing/presentation/words'
import { words as mailWords } from '../mail/presentation/words'
import { ASSISTANT_SETTINGS_LINK, BOOKS_FILE_LINK } from '../settings/presentation/settingsTabs'
import { PERSON_PAYEES_KEY, SETTING_DEFINITIONS } from '../settings/domain/settings'
import { words as settingsWords } from '../settings/presentation/words'
import { decodePeriod } from '../filters/domain/filterQuery'
import { COMPANY_SORTING_ROUTE } from '../sorting/presentation/sortingLinks'
import { words as sortingWords } from '../sorting/presentation/words'
import { REVIEW_LINK } from '../transactions/presentation/transactionsLinks'
import { words as transactionWords } from '../transactions/presentation/words'
import * as coreKinds from '../workbook/domain/coreKinds'
import type { AppAssistant, AssistantPlace, PeriodParam } from '../../../shared/app/appContribution'
import type { AppAcceptance, AppProposer, AssistantOperation, ProposalStep } from '../../../shared/app/assistantOperations'
import { words as chatWords } from '../../../shared/ai/presentation/words'
import type { ProposalDescriber } from '../../../shared/app/proposalGroups'
import type { UnitOfWork } from '../../../shared/storage/application/repository'
import type { CompanyBooks } from '../workbook/domain/readWorkbook'
import type { Workbook } from '../workbook/domain/workbook'
import type { KnownPerson } from '../../../shared/privacy/domain/pseudonyms'
import { companyReader } from './companyReader'
import type { CompanyReading, PackReader } from './companyReader'
import { words } from './words'
import type { AutomationLabels, GuideLabels } from './words'

const SETTINGS_ROUTE = '/company/settings'
const GENERAL_SETTINGS_LINK = `${SETTINGS_ROUTE}?tab=general`

const LABELS: GuideLabels = {
  transactions: transactionWords.title,
  review: transactionWords.tabs.review,
  suggest: transactionWords.review.suggestCategories,
  ask: chatWords.ask.button,
  recategorise: transactionWords.review.item.recategorise,
  makeRule: transactionWords.review.makeRule,
  sorting: sortingWords.title,
}

const AUTOMATION_LABELS: AutomationLabels = {
  settings: settingsWords.title,
  general: settingsWords.tabNames.general,
  mail: mailWords.card.title,
  review: transactionWords.tabs.review,
}

/** The periods Company's filters read from `?p=`, which never name a single month. */
export const LEDGER_PERIOD: PeriodParam = {
  periods: 'l3 or l12 for the months up to this one, all, a year such as 2026, a quarter such as 2026q3, or days such as 2026-01-01..2026-03-31, never a single month',
  reads: (key) => decodePeriod(key) !== null,
}

/** The query keys the ledger's filters share across screens: the period as Company's filters write it, and an account and a category by the ref Kuna handed out. */
const LEDGER_FILTERS: AssistantPlace['params'] = { p: LEDGER_PERIOD, acc: { kind: coreKinds.ACCOUNT_RECORDS.name }, cat: { kind: coreKinds.CATEGORY_RECORDS.name } }

/** Every tab of Company's own screens, with the query keys a link may fill. */
const PLACES: readonly AssistantPlace[] = [
  { route: '/company/transactions?tab=rows', title: transactionWords.tabs.rows, params: LEDGER_FILTERS },
  { route: REVIEW_LINK, title: transactionWords.tabs.review, params: { acc: { kind: coreKinds.ACCOUNT_RECORDS.name }, cat: { kind: coreKinds.CATEGORY_RECORDS.name } } },
  { route: '/company/transactions?tab=import', title: transactionWords.tabs.import },
  {
    route: '/company/invoicing?tab=invoices',
    title: invoicingWords.tabs.invoices,
    params: { client: { kind: coreKinds.CLIENT_RECORDS.name }, make: { kind: coreKinds.CLIENT_RECORDS.name }, reexport: { kind: coreKinds.INVOICE_RECORDS.name } },
  },
  { route: '/company/invoicing?tab=plan', title: invoicingWords.tabs.plan, params: { year: 'year', month: 'month' } },
  { route: '/company/invoicing?tab=clients', title: invoicingWords.tabs.clients },
  { route: '/company/analysis?tab=breakdown', title: analysisWords.tabs.breakdown, params: LEDGER_FILTERS },
  { route: '/company/analysis?tab=over-time', title: analysisWords.tabs.overTime, params: LEDGER_FILTERS },
  { route: '/company/analysis?tab=compare', title: analysisWords.tabs.compare, params: LEDGER_FILTERS },
  {
    route: COMPANY_SORTING_ROUTE,
    title: sortingWords.title,
    params: { category: { kind: coreKinds.CATEGORY_RECORDS.name }, label: { kind: coreKinds.LABEL_RECORDS.name }, rule: { kind: coreKinds.RULE_RECORDS.name } },
  },
  { route: GENERAL_SETTINGS_LINK, title: settingsWords.tabNames.general },
  { route: `${SETTINGS_ROUTE}?tab=accounts`, title: settingsWords.tabNames.accounts },
  { route: ASSISTANT_SETTINGS_LINK, title: settingsWords.tabNames.assistant },
  { route: BOOKS_FILE_LINK, title: settingsWords.booksFile },
]

/** What a pack tells the chat beside core, and what it adds to what the chat reads of the company. */
export interface PackAssistant extends Pick<AppAssistant, 'kinds' | 'settings' | 'places'> {
  reader(reading: CompanyReading): PackReader
}

/** How a card reads a pack's records, for the kinds it names. Company's own describer reads the rest. */
export interface PackDescriber extends ProposalDescriber {
  readonly kinds: ReadonlySet<string>
  /** The pack's setting keys by the names its screens show them. */
  readonly settingNames: Readonly<Record<string, string>>
}

/** The changes a pack lets the chat propose, which Company's proposer plans in the same write as its own steps. */
export interface PackOperations {
  readonly operations: readonly AssistantOperation[]
  /**
   * Plans one of the pack's steps through the pack's own write functions, and throws `StepRefused` for one that cannot go.
   * `idOf` gives the id a value stands for, the id itself or what a `$` name of an earlier step made, such as a category's short name.
   */
  plan(unit: UnitOfWork, books: CompanyBooks, step: ProposalStep, idOf: (value: unknown) => string): void
  describer(workbook: Workbook): PackDescriber
  /** `after` with the pack's records that `before` holds and `after` no longer does, so a card names what it removes. */
  withRemovedRecords(before: Workbook, after: Workbook): Workbook
}

/**
 * What Company tells the chat and lets it read, with what its pack adds, as only `app.ts` may name the pack. `reading` and
 * `persons` read the books `app.ts` holds: the persons are the employees through the pack and the payees the owner flagged.
 * `changes` are the proposer and acceptance `app.ts` builds over the store, or null for a chat that only reads.
 */
export function companyAssistant(
  pack: PackAssistant,
  reading: CompanyReading,
  persons: () => readonly KnownPerson[],
  changes: { readonly proposer: AppProposer; readonly acceptance: AppAcceptance } | null = null,
): AppAssistant {
  return {
    kinds: [...Object.values(coreKinds), ...pack.kinds],
    places: [...PLACES, ...pack.places],
    settings: [
      ...SETTING_DEFINITIONS.filter(({ key }) => key !== PERSON_PAYEES_KEY).map(({ key, note }) => ({ key, note })),
      { key: 'invoice_mail_drafts', note: words.settings.mailDrafts },
      ...pack.settings,
    ],
    guides: [
      {
        id: 'set-up',
        label: words.guides.setUp.label,
        title: words.guides.setUp.title,
        body: words.guides.setUp.body,
        places: [GENERAL_SETTINGS_LINK, COMPANY_SORTING_ROUTE, '/company/transactions?tab=import'],
      },
      { id: 'review', title: words.guides.review.title, body: words.guides.review.body(LABELS), places: [REVIEW_LINK, COMPANY_SORTING_ROUTE] },
    ],
    automations: [
      {
        id: 'statements-from-mail',
        title: words.automations.statementsFromMail.title,
        what: words.automations.statementsFromMail.what(AUTOMATION_LABELS),
        setUpRoute: GENERAL_SETTINGS_LINK,
      },
    ],
    setUp: [
      { key: 'first-statement', about: 'No statement row is in yet.', operations: ['import-statement'] },
      { key: 'first-rules', about: 'Rows a rule could file wait, and fewer than five rules of the person file them.', operations: ['add-rule'] },
      { key: 'statements-mail', about: "An account takes the bank's statements, with no address the bank mails them from.", operations: [] },
      {
        key: 'categories',

        about: 'The categories are still the ones new books start with, until the person says they look right.',
        operations: ['add-category', 'change-category', 'answer-set-up'],
      },
      { key: 'invoice-terms', about: 'There is a client to invoice, and an invoice issuer field is empty.', operations: ['set-setting'] },
      { key: 'statement-delivery', about: 'How later statements arrive is not set up.', operations: ['answer-set-up'] },
    ],
    reader: companyReader(reading, pack.reader(reading)),
    proposer: changes?.proposer ?? null,
    acceptance: changes?.acceptance ?? null,
    quickActions: [words.quickActions.sort, words.quickActions.month, words.quickActions.rules],
    persons,
  }
}
