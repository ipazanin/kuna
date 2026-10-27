/**
 * Renders every screen of the fake-mode build in real Chrome at nine widths, from 360 to 2560 px,
 * in the dark and the light theme at 360, 430 and 1440 and in one theme at the others. It asserts
 * what a screenshot cannot: no horizontal overflow, no card whose content is wider than the card
 * outside the editors allowed to scroll sideways, no console errors (CSP violations included), no
 * request to another origin, that each screen rendered its title, and that it drew as many charts as
 * it has from the fake workbook. Every chart on the gallery must draw and every icon must come from
 * the bundle. From 768 px, cards whose tops line up in a row must end at the same height. A deep
 * link to a rule on Settings, Ruleset must open that rule in the side panel and bring its line to
 * just below the search bar, marked, and keep it there once slow web fonts swap in. Deep links into
 * a collapsed card must open it and land on their row. At 360, 430 and 1440 px each screen
 * collapses and expands one card.
 *
 * Beyond the screens of the fake workbook on Drive, it renders onboarding's first steps on a first
 * run (`?fake=empty`), each Settings tab and the Year page's editors for a workbook kept in this browser
 * (`?fake=browser`), This device for a file a newer app saved (`?fake=newer-file`), Salaries for one
 * made-up employee (`?fake=one-employee`) and for five (`?fake=five-employees`), and the summary
 * of an xlsx file it writes from the fake workbook with two problems added.
 *
 * At 360 and 1440 px, in both themes and both modes, it then adds, edits, deletes and undoes a
 * category, with its colour, a label and a role, an asset, an employee on Salaries and an
 * invoice, changes and deletes an owner advance and undoes the delete, and screenshots the editors
 * and the invoice dialog on the way. On Settings, Categories it searches, filters to a bucket, sorts
 * by a press and the keyboard, and edits, saves and undoes a row while filtered and sorted. On Settings, General it saves the statements folder the
 * settings lack at the path the app uses, then a new path, and adds, refuses and removes card
 * settlement IBANs as tags. On Invoicing, Clients it gives a client a second IBAN, saves it and
 * undoes it, and takes a new IBAN off with its tag's remove button.
 * On Transactions it changes the category of a settled row, which a rule files elsewhere, and undoes it.
 * On Year a link to the Statements tab alone keeps the year it opened through two tabs and Back.
 * It also makes an invoice through the checks and every step, with the fake Picker picking the
 * invoice and year folders and the month folder made on request, then re-exports it.
 * At 360, 430 and 1440 px it does the same with a pay scenario's component, copies a scenario, and
 * adds the starting scenarios to a workbook without any.
 * It plans a category for 2027 on Year, Plan, edits, clears and undoes it, and plans a purchase in a
 * workbook without plan rows. On Transactions it splits a payment, edits the split, deletes it and
 * undoes the delete. On Review it does the same from a row of the queue, and dismisses a group of
 * confirmed rows no rule repeats, restores it and undoes the restore. On its Rules tab it changes a rule's note in the rule's editor and undoes it,
 * then deletes the rule from its editor and brings it back with Undo. On the Import tab of Transactions it drops the sample camt.053 statement and the
 * sample bank export, makes a profile for the export, reads each dry run, confirms it, reads how many
 * new rows wait on Review and undoes it, then deletes the profile, at 360, 430 and 1440 px. With the
 * file on Drive, from Overview, Sync files the fake statements folder's sample statement with no
 * toast, its step on Settings, This device says so with Undo, which takes it out, Import lists it,
 * and a last sync finds nothing new. With a held statement in the folder, the sync control says 1
 * problem and opens its steps, a popover at 1440 and a bottom sheet at 360, whose link opens Import,
 * which says why. A tab Google gave no Drive read token gets Allow access in the sync control, which
 * files the sample, and a slow statements folder shows the control while its step runs and once it
 * is ready. On Salaries with five employees the one problem opens its build-up and its bank rows,
 * the People tab opens one employee's month and a month of the Over time table opens on the Month
 * tab.
 * The mail step is off until the Mail card on Settings, General saves a sender with the subject it
 * asks for, and the next sync files the bank's new mail. With the fake mailbox it files the bank's
 * PDF and statement, the statements step of the same sync files the statement on the ledger, its
 * link opens the list on the Mail card, a second sync files nothing new, and the facts card shows the
 * accountant's mail. Mail all filed already says nothing new, a source that fails and an upload that
 * fails each give 1 problem with the steps open, and a token without Gmail read gets Allow access,
 * which runs the step. Saving a sender on the Mail card without Gmail read asks for it in the same
 * tap and syncs, and Allow access whose Google window closed says so beside the button. With the
 * accountant's kinds switched off the step reads the bank's mail alone, the payroll switched on
 * without a sender fails with what it lacks in the line and under its switch, Gmail asking to slow
 * down fails the step with one plain sentence, which the Mail card says too, and mail all filed by another app moves every
 * source's search to a week before the newest file in its folder.
 * The first run keeps an empty workbook on the fake Drive and one in this browser, and new books
 * on the fake Drive with statements from mail name the bank, make the statements folder beside the
 * books file and file the bank's mail there on the first sync. The statement step asks for Drive
 * read before the Picker when the page lacks it. An xlsx file
 * moves to the fake Drive through its summary, Settings, This device moves a workbook kept in this
 * browser there with the Drive read its folders need asked up front, and a row confirmed on Review while another device files the other row keeps both.
 *
 * Run against a preview of the fake build:
 *   npm run build:fake && npm run preview:fake -- --port 4173
 *   npm run check:visual -- http://localhost:4173/ledgerboard/
 *
 * While working on one screen, `--only billing,owner` limits the run to the screens and flows with those names,
 * or names that start with them and a hyphen, and `--widths 360,1440` to those widths. A limited
 * run keeps the other screenshots and says it was limited. The full run without options is the check.
 *
 * Screenshots go to visual-check/ (gitignored), or to VISUAL_OUTPUT_DIR.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'
import * as XLSX from 'xlsx'

import { fakeWorkbookDocument } from '../src/features/workbook/infrastructure/fake/fakeWorkbook.ts'
import { tabsOfDocument } from '../src/features/workbook/infrastructure/spreadsheetDocument.ts'
import { templateColumnNames } from '../src/features/workbook/infrastructure/workbookTemplate.ts'
import { installHrDooPack } from './support/installPack.mjs'
import { chromePath } from './support/browsers.mjs'
import { collapseAndExpand } from './support/cardFlows.mjs'
import { pageTabsFlow, yearTabLinkFlow } from './support/pageTabFlows.mjs'
import {
  accessClosedFlow,
  advanceFlow,
  assetFlow,
  employeeFlow,
  cardSettlementIbansFlow,
  categoryFiltersFlow,
  categoryFlow,
  changeCategoryFlow,
  clientIbansFlow,
  dismissFlow,
  heldStatementFlow,
  importCamtFlow,
  importTableFlow,
  invoiceFlow,
  invoiceRunFlow,
  mailAccessFlow,
  mailFailedFlow,
  mailNothingNewFlow,
  mailFiledFlow,
  mailOffFlow,
  mailSaveAsksFlow,
  mailUploadFailedFlow,
  mailNoSenderFlow,
  mailRateLimitedFlow,
  mailSwitchesOffFlow,
  mailWindowFlow,
  moveFromBrowserFlow,
  onboardingBringFlow,
  onboardingBrowserFlow,
  onboardingDriveFlow,
  onboardingDriveReadFlow,
  onboardingMailFlow,
  onboardingOpenFlow,
  onboardingStatementAccessFlow,
  ownerShareFlow,
  salariesFlow,
  planFlow,
  planTabFlow,
  raceFlow,
  reviewSplitFlow,
  rulesEditorFlow,
  scenarioFlow,
  shareFillFlow,
  splitFlow,
  startingScenariosFlow,
  statementAccessFlow,
  statementSyncFlow,
  statementsFolderFlow,
  syncRunningFlow,
} from './support/editorFlows.mjs'
import { writeImportSamples } from './support/importSampleFiles.mjs'
import { runSelection } from './support/runSelection.mjs'
import { screenshotWholePage } from './support/wholePage.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCREENSHOT_DIR = process.env.VISUAL_OUTPUT_DIR ?? join(ROOT, 'visual-check')

/**
 * Every screen renders at each width. A width with a `theme` renders in that theme only, since the
 * layout does not change with the theme. `cardFlow` collapses and expands a card on each screen.
 */
const VIEWPORTS = [
  { name: 'phone', width: 360, height: 780, cardFlow: true },
  { name: 'phone-large', width: 430, height: 932, cardFlow: true },
  { name: 'small-tablet', width: 640, height: 960, theme: 'light' },
  { name: 'tablet', width: 768, height: 1024, alignedCards: true, theme: 'dark' },
  { name: 'tablet-wide', width: 1024, height: 1366, alignedCards: true, theme: 'light' },
  { name: 'laptop', width: 1280, height: 800, alignedCards: true, theme: 'dark' },
  { name: 'desktop', width: 1440, height: 900, alignedCards: true, cardFlow: true },
  { name: 'wide', width: 1920, height: 1080, alignedCards: true, theme: 'dark' },
  { name: 'wider', width: 2560, height: 1440, alignedCards: true, theme: 'light' },
]

const selection = runSelection(VIEWPORTS.map((viewport) => viewport.width))
const BASE = selection.base

/** A card is a raised surface. One nested inside another card is part of that card. */
const CARD_SELECTOR = '.rounded-card, .gallery-frame'

/**
 * `charts` is how many charts the screen draws from the fake workbook. `shows` is the text, or the
 * texts, that only appear once the fake workbook's rows reached the screen. `linkedRule` is the rule a deep link names.
 * `linkedPart` is the element a deep link's hash names, and `linkedRow` the row a deep link's query
 * marks, each inside a card that has to open for it. `linkedCard` is a card a link from another
 * screen points at, which has to open. `collapsedBefore` names the cards this device
 * remembers as collapsed, and `expandedBefore` those it remembers as open. `cards: false` marks a screen with no collapsible card.
 */
const SCREENS = [
  { name: 'overview', hash: '#/', title: 'Overview', charts: 2, shows: ['Waiting for you', 'A typical month', 'Every euro earned', 'Balance at month end'] },
  { name: 'transactions', hash: '#/transactions', title: 'Transactions', charts: 0, shows: 'Northwind Analytics', cards: false },
  { name: 'transactions-owner-part', hash: '#/transactions?p=all&cat=equipment', title: 'Transactions', charts: 0, shows: ['30% to owner, from Equipment', 'Laptop Store'], cards: false },
  { name: 'import', hash: '#/transactions?tab=import', title: 'Transactions', charts: 0, shows: 'Drop a statement file here', cards: false },
  { name: 'analysis', hash: '#/analysis', title: 'Analysis', charts: 0, shows: ['External contractors', 'Who the company paid most'] },
  { name: 'analysis-over-time', hash: '#/analysis?tab=over-time', title: 'Analysis', charts: 2, shows: ['Rolling net', 'Cumulative net'] },
  { name: 'analysis-compare', hash: '#/analysis?tab=compare', title: 'Analysis', charts: 0, shows: ['Revenue', 'Show all'] },
  { name: 'invoicing', hash: '#/invoicing', title: 'Invoicing', charts: 1, shows: ['Next invoice', 'Every invoice', 'Show all'] },
  { name: 'invoicing-plan', hash: '#/invoicing?tab=plan', title: 'Invoicing', charts: 0, shows: ['Plan rows, 2026', 'Month by month, 2026', 'Totals over every client'] },
  {
    name: 'invoicing-month',
    hash: '#/invoicing?tab=plan&year=2026&month=2026-10#billing-month-2026-10',
    title: 'Invoicing',
    charts: 0,
    shows: "of the month's rows is not invoiced yet",
    linkedPart: 'billing-month-2026-10',
  },
  { name: 'invoicing-plan-2025', hash: '#/invoicing?tab=plan&year=2025', title: 'Invoicing', charts: 0, shows: 'Month by month, 2025' },
  { name: 'invoicing-clients', hash: '#/invoicing?tab=clients', title: 'Invoicing', charts: 0, shows: 'Add client' },
  {
    name: 'invoicing-terms',
    hash: '#/invoicing?tab=clients#invoicing-terms',
    title: 'Invoicing',
    charts: 0,
    shows: 'Save terms',
    linkedPart: 'invoicing-terms',
  },
  {
    name: 'year',
    hash: '#/year?tab=taxes',
    title: 'Year',
    charts: 0,
    shows: ['Corporate income tax, expected against paid', 'Payroll cadence', 'Tax by type'],
  },
  { name: 'year-forecast', hash: '#/year', title: 'Year', charts: 0, shows: 'The forecast needs the day the company was registered', cards: false },
  { name: 'year-plan', hash: '#/year?tab=plan', title: 'Year', charts: 0, shows: ['Plan for 2026', 'Revenue comes from the billing plan'], cards: false },
  { name: 'year-pay', hash: '#/year?year=2027&tab=pay', title: 'Year', charts: 0, shows: ['The figures need hr_company_registered', 'Scenarios for 2027'] },
  { name: 'year-accountant', hash: '#/year?year=2025', title: 'Year', charts: 1, shows: ['Lines at a glance', 'From the cash net to profit, 2025'] },
  { name: 'year-statements', hash: '#/year?tab=statements', title: 'Year', charts: 0, shows: ['Profit and loss', 'Konto lines', "The accountant's lines"] },
  { name: 'year-assets', hash: '#/year?tab=assets', title: 'Year', charts: 0, shows: ['Workstation', 'Asset rows', 'Grant rows'] },
  { name: 'year-assets-doubled', hash: '#/year?tab=assets&rates=doubled', title: 'Year', charts: 0, shows: 'What doubled rates would change' },
  {
    name: 'year-grant-rows',
    hash: '#/year?tab=assets#grant-rows',
    title: 'Year',
    charts: 0,
    shows: 'Save grants',
    collapsedBefore: ['year.grant-rows'],
    linkedPart: 'grant-rows',
  },
  { name: 'salaries', hash: '#/salaries', title: 'Salaries', charts: 0, shows: ["No row is the director's yet", 'No employees yet.', 'Add employee'] },
  { name: 'owner', hash: '#/owner', title: 'Owner', charts: 2, shows: ['Owner take by type', 'Loans, net', 'Owed by the owner at each month end', 'Net share of gross cost', 'Monthly net pay', 'Benefits from company costs', 'of it from company costs', 'needs hr_company_registered'], cards: false },
  { name: 'owner-2025', hash: '#/owner?p=2025', title: 'Owner', charts: 2, shows: ['Jan 2025 – Dec 2025', 'Owner take by type', 'Monthly net pay', 'over 8 months'], cards: false },
  { name: 'owner-owed', hash: '#/owner?tab=owed', title: 'Owner', charts: 0, shows: ['Costs the owner paid privately', 'with no cost on file waits on Review', 'The company owes the owner on 30 Sept 2026', 'Owed at the end'] },
  { name: 'owner-owed-2025', hash: '#/owner?tab=owed&p=2025', title: 'Owner', charts: 0, shows: ['The owner owes the company on 31 Dec 2025', 'No cost the owner paid privately was owed in Jan 2025 – Dec 2025'] },
  { name: 'owner-owed-filtered', hash: '#/owner?tab=owed&p=all&cat=equipment', title: 'Owner', charts: 0, shows: ['Who owes whom follows the period only', 'The owner owes the company on 8 Oct 2026'] },
  { name: 'review', hash: '#/review', title: 'Review', charts: 0, shows: ['GADGET CORNER', 'Refund of a parking fee'] },
  { name: 'review-rules', hash: '#/review?tab=rules', title: 'Review', charts: 0, shows: ['merchant-airline', 'Confirmed rows no rule repeats'] },
  {
    name: 'review-rule-linked',
    hash: '#/review?tab=rules&rule=merchant-airline',
    title: 'Review',
    charts: 0,
    shows: 'merchant-airline',
    collapsedBefore: ['review.rules'],
    linkedRow: '[data-testid="rule-row"][aria-current="true"]',
  },
  { name: 'settings', hash: '#/settings', title: 'Settings', charts: 0, shows: ['The workbook', 'Mail', 'Company and owner facts', 'Bucket labels', 'Loans to the owner'] },
  {
    name: 'settings-loan-rate',
    hash: '#/settings#owner-loan-interest',
    title: 'Settings',
    charts: 0,
    shows: "Interest the owner's loans carry",
    collapsedBefore: ['settings.facts'],
    linkedPart: 'owner-loan-interest',
  },
  {
    name: 'settings-categories',
    hash: '#/settings?tab=categories',
    title: 'Settings',
    charts: 0,
    shows: 'The bucket decides where a row counts',
    collapsedBefore: ['settings.categories'],
    linkedCard: 'settings.categories',
  },
  { name: 'settings-accounts', hash: '#/settings?tab=accounts', title: 'Settings', charts: 0, shows: 'Your bank accounts' },
  { name: 'settings-ruleset', hash: '#/settings?tab=ruleset', title: 'Settings', charts: 0, shows: ['Watch list', 'Rules by area', 'hr.cit.rate'] },
  {
    name: 'settings-ruleset-linked',
    hash: '#/settings?tab=ruleset&rule=hr.contrib.director-floor',
    title: 'Settings',
    charts: 0,
    shows: 'Contribution base floor for an employed',
    linkedRule: 'hr.contrib.director-floor',
  },
  {
    name: 'settings-device',
    hash: '#/settings?tab=device',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="drive-file-place"] a',
    shows: ['ledgerboard-company.json', 'Books', 'None yet. The first save of a day makes one.', 'Open in Drive'],
    cards: false,
  },
]

/** The gallery's chart cards that draw a chart. The loading card counts, the empty one does not. */
const GALLERY_CHARTS = 7

/** The gallery's donut cards, each of which must draw its ring. */
const GALLERY_DONUTS = 2

/** Screens outside the fake workbook on Drive. `query` picks the fake variant, `upload` drops the import file on the page. */
const SOURCE_SCREENS = [
  { name: 'welcome', query: 'fake=empty', hash: '#/', title: 'Ledgerboard', charts: 0, shows: ['What brings you here?', 'Start new books', 'Open my books on Google Drive'], cards: false },
  {
    name: 'onboarding-access',
    query: 'fake=empty',
    hash: '#/start?step=access&statements=folder',
    title: 'Ledgerboard',
    charts: 0,
    shows: ['What the app may do in your Google account', 'From a folder in my Drive', 'Continue to Google'],
    cards: false,
  },
  { name: 'onboarding-find', query: 'fake=empty', hash: '#/start?path=open&step=find', title: 'Ledgerboard', charts: 0, shows: ['Find your books on Drive', 'Pick another file'], cards: false },
  { name: 'settings-browser', query: 'fake=browser', hash: '#/settings', title: 'Settings', charts: 0, shows: 'Save settings' },
  { name: 'settings-categories-browser', query: 'fake=browser', hash: '#/settings?tab=categories', title: 'Settings', charts: 0, shows: 'Save categories' },
  { name: 'settings-accounts-browser', query: 'fake=browser', hash: '#/settings?tab=accounts', title: 'Settings', charts: 0, shows: 'Save accounts' },
  { name: 'settings-device-browser', query: 'fake=browser', hash: '#/settings?tab=device', title: 'Settings', charts: 0, shows: ['Import a file', 'Keep on Google Drive'], cards: false },
  { name: 'settings-device-newer', query: 'fake=newer-file', hash: '#/settings?tab=device', title: 'Settings', charts: 0, shows: 'A newer ledgerboard saved this file', cards: false },
  { name: 'year-accountant-browser', query: 'fake=browser', hash: '#/year?year=2025', title: 'Year', charts: 1, shows: 'Loans to the owner carry 2.5%' },
  { name: 'year-statements-browser', query: 'fake=browser', hash: '#/year?year=2025&tab=statements', title: 'Year', charts: 0, shows: 'Balance paid on', expandedBefore: ['year.tax'] },
  {
    name: 'year-accountant-lines-browser',
    query: 'fake=browser',
    hash: '#/year?year=2025&tab=statements#accountant-lines',
    title: 'Year',
    charts: 0,
    shows: 'Save year-end lines',
    linkedPart: 'accountant-lines',
  },
  { name: 'year-asset-rows-browser', query: 'fake=browser', hash: '#/year?tab=assets#asset-rows', title: 'Year', charts: 0, shows: 'Save assets', linkedPart: 'asset-rows' },
  {
    name: 'salaries-browser',
    query: 'fake=browser',
    hash: '#/salaries#employee-rows',
    title: 'Salaries',
    charts: 1,
    shows: 'Save employees',
    collapsedBefore: ['salaries.employees'],
    linkedPart: 'employee-rows',
  },
  {
    name: 'salaries-one-employee',
    query: 'fake=one-employee',
    hash: '#/salaries',
    title: 'Salaries',
    charts: 1,
    shows: ['Where the company’s money goes', 'Gross to net', 'App and bank', 'Pension savings', 'The app and the bank agree on every line they both state'],
  },
  { name: 'salaries-one-employee-over-time', query: 'fake=one-employee', hash: '#/salaries?tab=over-time', title: 'Salaries', charts: 1, shows: ['Cost to the company by payday, 2026', 'Paydays of 2026'] },
  {
    name: 'salaries-five-employees',
    query: 'fake=five-employees',
    hash: '#/salaries',
    title: 'Salaries',
    charts: 1,
    shows: ['Paid to the employees', 'Health insurance, everyone paid', 'Everyone'],
  },
  { name: 'salaries-five-employees-people', query: 'fake=five-employees', hash: '#/salaries?tab=people', title: 'Salaries', charts: 0, shows: ['Everyone paid in Sept 2026', 'Niko Test'] },
  { name: 'salaries-five-employees-one', query: 'fake=five-employees', hash: '#/salaries?employee=lea', title: 'Salaries', charts: 1, shows: ['Lea Proba', 'Paid to the employee'] },
  { name: 'owner-browser', query: 'fake=browser', hash: '#/owner', title: 'Owner', charts: 2, shows: ['Tax avoided against a dividend', 'As a dividend you would net', 'Set the defaults', 'Monthly net pay'], cards: false },
  { name: 'owner-owed-browser', query: 'fake=browser', hash: '#/owner?tab=owed&p=all', title: 'Owner', charts: 0, shows: ['Costs the owner paid privately', 'Net owed'] },
  { name: 'year-forecast-browser', query: 'fake=browser', hash: '#/year?year=2026', title: 'Year', charts: 1, shows: ['Month by month, 2026', 'plan rows of 2026 are not invoiced yet', 'Plan against actual, 2026'] },
  { name: 'year-forecast-2027-browser', query: 'fake=browser', hash: '#/year?year=2027', title: 'Year', charts: 1, shows: ['Month by month, 2027', 'Values the ruleset only estimates for 2027'] },
  { name: 'year-pay-browser', query: 'fake=browser', hash: '#/year?year=2027&tab=pay', title: 'Year', charts: 1, shows: ['Dividend capacity', 'Where the profit before owner pay goes, 2027', '1 warning', 'Side by side'] },
  {
    name: 'year-pay-interim-browser',
    query: 'fake=browser',
    hash: '#/year?year=2027&tab=pay&payout=interim',
    title: 'Year',
    charts: 1,
    shows: 'An interim payout in 2027',
    expandedBefore: ['year.comparison'],
  },
  { name: 'year-pay-2026-browser', query: 'fake=browser', hash: '#/year?year=2026&tab=pay', title: 'Year', charts: 0, shows: ['No scenario for 2026 to compare yet', 'Dividend capacity'] },
  { name: 'year-pay-no-scenarios', query: 'fake=no-scenarios', hash: '#/year?year=2027&tab=pay', title: 'Year', charts: 0, shows: 'No scenario is for 2027 yet' },
  { name: 'year-taxes-browser', query: 'fake=browser', hash: '#/year?tab=taxes', title: 'Year', charts: 0, shows: ['For 2026', '1 payment is overdue', 'Less tax refund'] },
  { name: 'invoicing-plan-browser', query: 'fake=browser', hash: '#/invoicing?tab=plan', title: 'Invoicing', charts: 0, shows: 'Fill the rest of 2026' },
  { name: 'invoicing-clients-browser', query: 'fake=browser', hash: '#/invoicing?tab=clients', title: 'Invoicing', charts: 0, shows: 'Save clients' },
  { name: 'invoicing-empty-plan-browser', query: 'fake=browser-no-billing-plan', hash: '#/invoicing?tab=plan', title: 'Invoicing', charts: 0, shows: 'Add the first row', cards: false },
  {
    name: 'import-summary',
    query: 'fake=empty',
    hash: '#/start?path=bring&home=browser&step=file',
    title: 'Ledgerboard',
    charts: 0,
    shows: ['rows the app could not use', 'records, by tab', 'Keep in this browser'],
    upload: true,
    cards: false,
  },
]

const THEMES = ['dark', 'light']

const VISITS = [
  ...THEMES.flatMap((theme) => SCREENS.map((screen) => ({ ...screen, theme, file: `${screen.name}-${theme}` }))),
  ...THEMES.flatMap((theme) => SOURCE_SCREENS.map((screen) => ({ ...screen, theme, file: `${screen.name}-${theme}` }))),
  ...THEMES.map((theme) => ({
    name: `gallery-${theme}`,
    hash: '#/gallery',
    title: 'Gallery',
    gallery: true,
    theme,
    file: `gallery-${theme}`,
  })),
]

/**
 * The only cards that may scroll sideways: editors whose every column is an input, on a phone. Each
 * names its card, the widest viewport it may scroll at, and why.
 */
const SIDEWAYS_SCROLL_ALLOWED = [
  {
    card: 'settings.categories',
    upTo: Infinity,
    reason: 'Seven input columns at their narrowest are wider than the 100rem measure the Settings screen keeps.',
  },
  { card: 'settings.accounts', upTo: 1024, reason: 'Every column is an input, and they fit beside each other only from 1280 px.' },
  { card: 'invoicing.clients', upTo: Infinity, reason: 'Nine input columns, with the invoice details, are wider than any card.' },
  { card: 'year.asset-rows', upTo: Infinity, reason: 'Ten input columns are wider than the 100rem measure the Year screen keeps.' },
  { card: 'year.grant-rows', upTo: Infinity, reason: 'Twelve input columns are wider than the 100rem measure the Year screen keeps.' },
  { card: 'year.accountant-lines', upTo: Infinity, reason: 'Nine input columns are wider than the 100rem measure the Year screen keeps.' },
  { card: 'salaries.employees', upTo: Infinity, reason: 'Eleven input columns are wider than the 100rem measure the Salaries screen keeps.' },
]

const failures = []
/** Every card found wider than its content, allowed or not, listed at the end. */
const overflowSeen = []

function fail(scope, message) {
  failures.push(`[${scope}] ${message}`)
}

function watchForErrors(page) {
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  return errors
}

/** Fake mode never talks to Google, so any other origin is a leak, api.iconify.design included. */
function watchForForeignRequests(page) {
  const own = new URL(BASE).origin
  const foreign = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith('data:') || url.startsWith('blob:') || new URL(url).origin === own) return
    foreign.push(url)
  })
  return foreign
}

function readPage(page) {
  return page.evaluate((cardSelector) => {
    const doc = document.documentElement
    const name = (element) => `${element.tagName.toLowerCase()}.${element.className?.toString().split(' ')[0] ?? ''}`
    const overflowing = [...document.querySelectorAll('*')]
      .filter((element) => element.getBoundingClientRect().right > doc.clientWidth + 1)
      .map(name)
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowing: [...new Set(overflowing)].slice(0, 6),
      title: document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() ?? null,
      chartHeights: [...document.querySelectorAll('.chart-body canvas')].filter((canvas) => canvas.closest('.chart-body').getClientRects().length > 0).map((canvas) => canvas.getBoundingClientRect().height),
      donutHeights: [...document.querySelectorAll('[data-testid="donut-card"] canvas')].map((canvas) => canvas.getBoundingClientRect().height),
      iconCount: document.querySelectorAll('svg.iconify').length,
      unrenderedIcons: [...document.querySelectorAll('.iconify')].filter((icon) => icon.tagName.toLowerCase() !== 'svg').length,
      themeClass: doc.classList.contains('light') ? 'light' : doc.classList.contains('dark') ? 'dark' : 'none',
      text: document.body.innerText,
      raggedRows: raggedCardRows(cardSelector),
      cardOverflow: overflowingCards(cardSelector),
    }

    /**
     * Cards whose content is wider than the card: the card or a box in it that scrolls or clips
     * sideways, or a box that reaches past the card's edges. A line of text cut short with an
     * ellipsis is meant to clip, and a box inside one that scrolls is counted with it.
     */
    function overflowingCards(selector) {
      const clips = (style) => style.overflowX !== 'visible'
      const found = []
      for (const card of document.querySelectorAll(selector)) {
        if (card.parentElement?.closest(selector) || card.getClientRects().length === 0) continue
        const edge = card.getBoundingClientRect()
        let widest = null
        for (const element of [card, ...card.querySelectorAll('*')]) {
          if (element.getClientRects().length === 0) continue
          const style = getComputedStyle(element)
          if (style.position === 'fixed' || style.textOverflow === 'ellipsis') continue
          let content = 0
          if (element instanceof HTMLElement && element.clientWidth > 1 && clips(style) && element.scrollWidth > element.clientWidth + 1) {
            content = element.scrollWidth - element.clientWidth + edge.width
          } else if (element !== card) {
            const box = element.getBoundingClientRect()
            let inside = element.parentElement
            while (inside !== null && inside !== card && !clips(getComputedStyle(inside))) inside = inside.parentElement
            if (inside === card && box.width > 1 && (box.right > edge.right + 1 || box.left < edge.left - 1)) {
              content = Math.max(box.right, edge.right) - Math.min(box.left, edge.left)
            }
          }
          if (content > (widest?.content ?? 0)) widest = { content, element }
        }
        if (widest !== null) {
          found.push({
            card: card.dataset.card ?? null,
            title: (card.querySelector('h2, h3')?.textContent ?? card.getAttribute('aria-label') ?? card.dataset.testid ?? '').trim().replace(/\s+/g, ' ').slice(0, 48),
            width: Math.round(edge.width),
            content: Math.round(widest.content),
            by: `${widest.element.tagName.toLowerCase()}${widest.element.classList.length ? `.${[...widest.element.classList].slice(0, 2).join('.')}` : ''}`,
          })
        }
      }
      return found
    }

    /**
     * Pairs of side-by-side cards whose tops line up but whose bottoms are more than 1 px apart. A card
     * with a sibling card stacked right under it, beside one without, heads a column of cards beside a
     * single long card, so its bottom is not meant to line up.
     */
    function raggedCardRows(selector) {
      const cards = [...document.querySelectorAll(selector)]
        .filter((card) => !card.parentElement?.closest(selector) && card.getClientRects().length > 0)
        .map((card) => ({ card, box: card.getBoundingClientRect() }))
      const label = (card) => (card.querySelector('h2, h3, p, dt, span')?.textContent ?? card.textContent ?? '').trim().slice(0, 32)
      const headsColumn = ({ card, box }) =>
        cards.some(
          (other) =>
            other.card.parentElement === card.parentElement &&
            Math.abs(other.box.left - box.left) <= 1 &&
            Math.abs(other.box.right - box.right) <= 1 &&
            other.box.top >= box.bottom - 1 &&
            other.box.top - box.bottom <= 32,
        )
      const ragged = []
      for (const [index, left] of cards.entries()) {
        for (const right of cards.slice(index + 1)) {
          const sideBySide = left.box.right <= right.box.left + 1 || right.box.right <= left.box.left + 1
          if (!sideBySide || Math.abs(left.box.top - right.box.top) > 1) continue
          if (headsColumn(left) !== headsColumn(right)) continue
          const gap = Math.abs(left.box.bottom - right.box.bottom)
          if (gap > 1) ragged.push(`"${label(left.card)}" and "${label(right.card)}" end ${Math.round(gap)} px apart`)
        }
      }
      return ragged
    }
  }, CARD_SELECTOR)
}

/**
 * Runs in the page: the linked part sits just below the bars that stay at the top, or in view at
 * the foot of a page too short to scroll it higher, in a card that is open.
 */
function linkedPartLanded(id) {
  const part = document.getElementById(id)
  const card = part?.closest('[data-card]')
  if (part === null || card?.dataset.collapsed !== 'false') return false
  const band = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-band')) || 0
  const top = part.getBoundingClientRect().top
  const atFoot = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1
  return (top >= band && top <= band + 40) || (atFoot && top >= band && top < window.innerHeight)
}

/** Runs in the page: the linked row is in an open card and inside the window. */
function linkedRowShown(selector) {
  const row = document.querySelector(selector)
  if (row === null || row.closest('[data-card]')?.dataset.collapsed !== 'false') return false
  const box = row.getBoundingClientRect()
  return box.height > 0 && box.top >= 0 && box.bottom <= window.innerHeight
}

/**
 * Runs in the page: the side panel holds the linked rule, and its line in the list is marked and
 * starts just below the sticky search bar and its area's heading.
 */
function linkedRuleInView(ruleId) {
  const line = document.getElementById(`rule-${ruleId}`)
  const bar = document.querySelector('[data-testid="ruleset-bar"]')
  const panel = document.querySelector('[role="dialog"] [data-testid="rule-detail"]')
  const heading = line?.closest('section')?.querySelector('h3')
  if (line === null || bar === null || panel === null || heading == null || line.getAttribute('aria-current') !== 'true') return false
  const below = line.getBoundingClientRect().top - heading.getBoundingClientRect().bottom
  return heading.getBoundingClientRect().top >= bar.getBoundingClientRect().bottom - 1 && below >= -1 && below <= 24
}

/** Holds back every web font, as a slow runner does, so text reflows after the screen's first frames. */
async function slowWebFonts(page) {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (request.url().endsWith('.woff2')) setTimeout(() => request.continue(), 400)
    else request.continue()
  })
}

mkdirSync(SCREENSHOT_DIR, { recursive: true })
// Screenshots of a screen that no longer exists would otherwise survive and mislead a review. A limited run keeps the others.
if (!selection.limited) {
  for (const stale of readdirSync(SCREENSHOT_DIR).filter((file) => file.endsWith('.png'))) {
    rmSync(join(SCREENSHOT_DIR, stale))
  }
}

/** The fake workbook as an xlsx file, with a ledger row that has no amount and a setting the app does not know. */
function writeImportFile() {
  installHrDooPack()
  const tabs = tabsOfDocument(fakeWorkbookDocument('2026-10-16T08:00:00.000Z', 'browser'))
  const values = Object.fromEntries(
    Object.entries(tabs).map(([tab, rows]) => {
      const header = [...new Set([...templateColumnNames(tab), ...rows.flatMap((row) => Object.keys(row.cells))])]
      return [tab, [header, ...rows.map((row) => header.map((column) => row.cells[column] ?? ''))]]
    }),
  )
  const book = XLSX.utils.book_new()
  const ledger = [...values.ledger, [values.ledger[1][0], 'main', 'stray row without an amount']]
  const settings = [...values.settings, ['colour_scheme', 'teal']]
  for (const [tab, grid] of Object.entries({ ...values, ledger, settings })) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(grid), tab)
  }
  const path = join(SCREENSHOT_DIR, 'example-books.xlsx')
  writeFileSync(path, XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }))
  return path
}

const IMPORT_FILE = writeImportFile()
const IMPORT_SAMPLES = await writeImportSamples(SCREENSHOT_DIR)

/** The editors' flows, each on a fresh load, so the fake file on Drive and the workbook kept in this browser start from their seed. */
const FLOWS = [
  { name: 'page-tabs', hash: '#/settings', title: 'Settings', run: pageTabsFlow },
  { name: 'year-tab-link', hash: '#/year?tab=statements', title: 'Year', run: yearTabLinkFlow },
  { name: 'categories', hash: '#/settings?tab=categories', title: 'Settings', run: categoryFlow },
  { name: 'categories-filters', hash: '#/settings?tab=categories', title: 'Settings', run: categoryFiltersFlow },
  { name: 'settings-statements-folder', hash: '#/settings', title: 'Settings', run: statementsFolderFlow },
  { name: 'settings-card-ibans', hash: '#/settings', title: 'Settings', run: cardSettlementIbansFlow },
  { name: 'clients-ibans', hash: '#/invoicing?tab=clients', title: 'Invoicing', run: clientIbansFlow },
  { name: 'assets', hash: '#/year?tab=assets#asset-rows', title: 'Year', run: assetFlow },
  { name: 'employees', hash: '#/salaries#employee-rows', title: 'Salaries', run: employeeFlow },
  { name: 'advances', hash: '#/owner?tab=owed', title: 'Owner', run: advanceFlow },
  { name: 'invoices', hash: '#/invoicing?p=all', title: 'Invoicing', run: invoiceFlow },
  { name: 'invoice-run', hash: '#/invoicing?p=all', title: 'Invoicing', run: invoiceRunFlow },
  { name: 'scenarios', hash: '#/year?year=2027&tab=pay', title: 'Year', run: scenarioFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  {
    name: 'starting-scenarios',
    hash: '#/year?year=2027&tab=pay',
    title: 'Year',
    run: startingScenariosFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    queries: { drive: '&fake=no-scenarios', browser: '&fake=browser-no-scenarios' },
  },
  { name: 'plan', hash: '#/year?year=2027&tab=plan', title: 'Year', run: planFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  {
    name: 'plan-tab',
    hash: '#/year?year=2027&tab=plan',
    title: 'Year',
    run: planTabFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    queries: { drive: '&fake=no-plan', browser: '&fake=browser-no-plan' },
  },
  { name: 'split', hash: '#/transactions?p=all&q=GADGET', title: 'Transactions', run: splitFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'split-review', hash: '#/review', title: 'Review', run: reviewSplitFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'change-category', hash: '#/transactions?p=all&q=CODE%20HOST', title: 'Transactions', run: changeCategoryFlow },
  { name: 'owner-share', hash: '#/transactions?p=all&q=purchase%2C%20laptop', title: 'Transactions', run: ownerShareFlow },
  { name: 'share-fill', hash: '#/settings?tab=categories', title: 'Settings', run: shareFillFlow },
  { name: 'dismiss', hash: '#/review?tab=rules', title: 'Review', run: dismissFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'rules-editor', hash: '#/review?tab=rules', title: 'Review', run: rulesEditorFlow },
  { name: 'import-camt', hash: '#/transactions?tab=import', title: 'Transactions', run: importCamtFlow(IMPORT_SAMPLES.camt), viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'import-table', hash: '#/transactions?tab=import', title: 'Transactions', run: importTableFlow(IMPORT_SAMPLES.table), viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'statements-sync', hash: '#/', title: 'Overview', run: statementSyncFlow, modes: ['drive'] },
  { name: 'statements-held', hash: '#/', title: 'Overview', run: heldStatementFlow, modes: ['drive'], queries: { drive: '&fake=held-statement' } },
  { name: 'statements-access', hash: '#/', title: 'Overview', run: statementAccessFlow, modes: ['drive'] },
  { name: 'sync-running', hash: '#/', title: 'Overview', run: syncRunningFlow, modes: ['drive'], queries: { drive: '&fake=slow-statements' } },
  { name: 'mail-off', hash: '#/', title: 'Overview', run: mailOffFlow, modes: ['drive'] },
  { name: 'mail-filed', hash: '#/', title: 'Overview', run: mailFiledFlow, modes: ['drive'], queries: { drive: '&fake=mail' } },
  { name: 'mail-upload-failed', hash: '#/', title: 'Overview', run: mailUploadFailedFlow, modes: ['drive'], queries: { drive: '&fake=mail-upload-failed' } },
  { name: 'mail-nothing-new', hash: '#/', title: 'Overview', run: mailNothingNewFlow, modes: ['drive'], queries: { drive: '&fake=mail-nothing-new' } },
  { name: 'mail-failed', hash: '#/', title: 'Overview', run: mailFailedFlow, modes: ['drive'], queries: { drive: '&fake=mail-failed' } },
  { name: 'mail-access', hash: '#/', title: 'Overview', run: mailAccessFlow, modes: ['drive'], queries: { drive: '&fake=mail' } },
  { name: 'mail-save-asks', hash: '#/', title: 'Overview', run: mailSaveAsksFlow, modes: ['drive'] },
  { name: 'mail-switches-off', hash: '#/', title: 'Overview', run: mailSwitchesOffFlow, modes: ['drive'], queries: { drive: '&fake=mail-switches-off' } },
  { name: 'mail-no-sender', hash: '#/', title: 'Overview', run: mailNoSenderFlow, modes: ['drive'], queries: { drive: '&fake=mail-no-sender' } },
  { name: 'mail-rate-limited', hash: '#/', title: 'Overview', run: mailRateLimitedFlow, modes: ['drive'], queries: { drive: '&fake=mail-rate-limited' } },
  { name: 'mail-window', hash: '#/', title: 'Overview', run: mailWindowFlow, modes: ['drive'], queries: { drive: '&fake=mail-nothing-new' } },
  { name: 'sync-access-closed', hash: '#/', title: 'Overview', run: accessClosedFlow, modes: ['drive'], queries: { drive: '&fake=google-closed' } },
  { name: 'salaries', hash: '#/salaries', title: 'Salaries', run: salariesFlow, modes: ['drive'], queries: { drive: '&fake=five-employees' } },
  { name: 'onboarding-drive', hash: '#/', title: 'Ledgerboard', run: onboardingDriveFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-drive-read', hash: '#/', title: 'Ledgerboard', run: onboardingDriveReadFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-mail', hash: '#/', title: 'Ledgerboard', run: onboardingMailFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-browser', hash: '#/', title: 'Ledgerboard', run: onboardingBrowserFlow, modes: ['browser'], queries: { browser: '&fake=empty' } },
  { name: 'onboarding-bring', hash: '#/', title: 'Ledgerboard', run: onboardingBringFlow(IMPORT_FILE), modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-open', hash: '#/start?path=open', title: 'Ledgerboard', run: onboardingOpenFlow, modes: ['drive'] },
  { name: 'onboarding-statement-access', hash: '#/start?step=statement&statements=folder', title: 'Ledgerboard', run: onboardingStatementAccessFlow, modes: ['drive'] },
  { name: 'move-browser', hash: '#/settings?tab=device', title: 'Settings', run: moveFromBrowserFlow, modes: ['browser'] },
  { name: 'race', hash: '#/review', title: 'Review', run: raceFlow, modes: ['drive'], queries: { drive: '&fake=race' } },
]
const MODES = [
  { name: 'drive', query: '' },
  { name: 'browser', query: '&fake=browser' },
]

const visits = VISITS.filter((visit) => selection.takes(visit.name))
const flows = FLOWS.filter((flow) => selection.takes(flow.name))
const unmatched = selection.unmatched()
if (unmatched !== null) {
  console.error(unmatched)
  process.exit(2)
}

const browser = await launch({ executablePath: chromePath(), headless: true, args: ['--hide-scrollbars'] })
let checked = 0

for (const viewport of VIEWPORTS.filter((candidate) => selection.takesWidth(candidate.width))) {
  for (const visit of visits) {
    if (viewport.theme && visit.theme !== viewport.theme) continue
    const scope = `${viewport.name} ${visit.name}`
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    const errors = watchForErrors(page)
    const foreignRequests = watchForForeignRequests(page)

    if (visit.linkedRule || visit.linkedPart) await slowWebFonts(page)
    if (visit.collapsedBefore || visit.expandedBefore) {
      await page.evaluateOnNewDocument(
        (collapsed, expanded) => {
          for (const card of collapsed) localStorage.setItem(`ledgerboard.card.${card}`, 'collapsed')
          for (const card of expanded) localStorage.setItem(`ledgerboard.card.${card}`, 'expanded')
        },
        visit.collapsedBefore ?? [],
        visit.expandedBefore ?? [],
      )
    }
    await page.setViewport({ width: viewport.width, height: viewport.height })
    // Headless Chrome reports a light preference unless told otherwise. The pin makes the theme explicit.
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: visit.theme }])
    await page.goto(`${BASE}?theme=${visit.theme}${visit.query ? `&${visit.query}` : ''}${visit.hash}`, { waitUntil: 'networkidle0' })

    const drawsCharts = visit.gallery || visit.charts > 0
    const ready = visit.ready ?? (drawsCharts ? '.chart-body canvas' : '[data-testid="screen-title"]')
    let rendered = await page
      .waitForSelector(ready, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    if (visit.upload && rendered) {
      const input = await page.$('input[data-testid="onboarding-file"]')
      await input?.uploadFile(IMPORT_FILE)
      rendered = await page
        .waitForSelector('[data-testid="import-summary"] dl', { timeout: 10_000 })
        .then(() => true)
        .catch(() => false)
      await new Promise((resolve) => setTimeout(resolve, 600))
    }

    if (visit.linkedRule && rendered) {
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const shown = await page
        .waitForFunction(linkedRuleInView, { timeout: 5_000 }, visit.linkedRule)
        .then(() => true)
        .catch(() => false)
      if (!shown) fail(scope, `the deep link did not open ${visit.linkedRule} in the side panel and bring its line to just below the search bar, marked, once the fonts loaded`)
    }

    // ECharts animates bars in. The screenshot should show where they land.
    if (drawsCharts && rendered) await new Promise((resolve) => setTimeout(resolve, 1500))

    if (visit.linkedPart && rendered) {
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const landed = await page
        .waitForFunction(linkedPartLanded, { timeout: 5_000 }, visit.linkedPart)
        .then(() => true)
        .catch(() => false)
      if (!landed) fail(scope, `the deep link to #${visit.linkedPart} did not open its card and bring the part to just below the top`)
    }
    if (visit.linkedCard && rendered) {
      const opened = await page.evaluate((card) => document.querySelector(`[data-card="${card}"]`)?.getAttribute('data-collapsed') === 'false', visit.linkedCard)
      if (!opened) fail(scope, `the link to the tab did not open ${visit.linkedCard}, which this device keeps collapsed`)
    }
    if (visit.linkedRow && rendered) {
      const shown = await page
        .waitForFunction(linkedRowShown, { timeout: 5_000 }, visit.linkedRow)
        .then(() => true)
        .catch(() => false)
      if (!shown) fail(scope, `the deep link did not open the collapsed card and bring ${visit.linkedRow} into view`)
    }

    const report = await readPage(page)
    if (!rendered) fail(scope, `nothing matched ${ready} within 10 s`)
    if (report.title !== visit.title) fail(scope, `title was ${JSON.stringify(report.title)}, expected "${visit.title}"`)
    if (report.themeClass !== visit.theme) fail(scope, `rendered ${report.themeClass}, expected the ${visit.theme} theme`)
    for (const text of [visit.shows ?? []].flat()) {
      if (!report.text.includes(text)) fail(scope, `"${text}" is missing, so the fake workbook did not reach the screen`)
    }
    const expectedCharts = visit.gallery ? GALLERY_CHARTS : visit.charts
    if (report.chartHeights.length !== expectedCharts) fail(scope, `drew ${report.chartHeights.length} charts, expected ${expectedCharts}`)
    const collapsed = report.chartHeights.filter((height) => height < 100)
    if (collapsed.length) fail(scope, `${collapsed.length} chart(s) drew under 100px tall: ${collapsed.join(', ')}`)
    if (visit.gallery && report.iconCount < 10) fail(scope, `only ${report.iconCount} icons rendered as SVG`)
    if (visit.gallery && (report.donutHeights.length !== GALLERY_DONUTS || report.donutHeights.some((height) => height < 150))) {
      fail(scope, `drew donuts ${report.donutHeights.map(Math.round).join(', ')} px tall, expected ${GALLERY_DONUTS} of at least 150 px`)
    }
    if (viewport.alignedCards) for (const row of report.raggedRows) fail(scope, `ragged card row: ${row}`)
    for (const wide of report.cardOverflow) {
      const allowed = SIDEWAYS_SCROLL_ALLOWED.find((entry) => entry.card === wide.card && viewport.width <= entry.upTo)
      overflowSeen.push({ viewport: viewport.width, screen: visit.name, theme: visit.theme, ...wide, allowed: allowed !== undefined })
      if (!allowed) fail(scope, `"${wide.title}" is ${wide.content} px wide inside a ${wide.width} px card, by ${wide.by}`)
    }
    if (report.unrenderedIcons) fail(scope, `${report.unrenderedIcons} icon(s) did not render`)
    if (report.scrollWidth > report.clientWidth + 1) {
      fail(scope, `horizontal overflow: scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}`)
      if (report.overflowing.length) fail(scope, `overflowing: ${report.overflowing.join(', ')}`)
    }
    if (errors.length) fail(scope, `console errors: ${errors.slice(0, 3).join(' | ')}`)
    if (foreignRequests.length) fail(scope, `requests to other origins: ${foreignRequests.slice(0, 3).join(' | ')}`)

    await screenshotWholePage(page, join(SCREENSHOT_DIR, `${viewport.name}-${visit.file}.png`))
    if (visit.gallery && viewport.name === 'desktop') {
      const firstChart = await page.$('[data-testid="chart-card"]')
      await firstChart?.screenshot({ path: join(SCREENSHOT_DIR, `${viewport.name}-${visit.file}-chart.png`) })
    }

    // A linked rule opens its side panel over the screen, so the plain visit of that tab collapses its card instead.
    if (viewport.cardFlow && rendered && !visit.linkedRule) {
      const collapsible = (await page.$('[data-card]')) !== null
      if (visit.cards === false) {
        if (collapsible) fail(scope, 'has a collapsible card, so it should not say cards: false')
      } else if (!collapsible) {
        fail(scope, 'has no collapsible card. Say cards: false if none of its cards holds a long list or table')
      } else {
        await collapseAndExpand(
          page,
          (handle) => handle.click(),
          (card) => card.screenshot({ path: join(SCREENSHOT_DIR, `${viewport.name}-${visit.file}-collapsed.png`) }),
        ).catch((error) => fail(scope, error.message))
        const after = await readPage(page)
        if (after.scrollWidth > after.clientWidth + 1) fail(scope, `horizontal overflow after collapsing a card: scrollWidth ${after.scrollWidth}`)
      }
    }

    checked += 1
    console.log(
      `${`${scope} ${visit.theme}`.padEnd(34)} ${String(viewport.width).padStart(4)}px  ` +
        `scroll=${report.scrollWidth} client=${report.clientWidth}  errors=${errors.length}  ` +
        `foreign=${foreignRequests.length}  icons=${report.iconCount}`,
    )

    await context.close()
  }
}


for (const viewport of VIEWPORTS.filter((candidate) => ['phone', 'phone-large', 'desktop'].includes(candidate.name) && selection.takesWidth(candidate.width))) {
  for (const mode of MODES) {
    for (const theme of THEMES) {
      for (const flow of flows.filter((candidate) => (candidate.viewports ?? ['phone', 'desktop']).includes(viewport.name) && (candidate.modes ?? ['drive', 'browser']).includes(mode.name))) {
        const scope = `${viewport.name} ${mode.name} ${flow.name} ${theme}`
        const context = await browser.createBrowserContext()
        const page = await context.newPage()
        const errors = watchForErrors(page)
        const foreignRequests = watchForForeignRequests(page)
        await page.setViewport({ width: viewport.width, height: viewport.height })
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }])
        const file = (name) => join(SCREENSHOT_DIR, `${viewport.name}-${mode.name}-${name}-${theme}.png`)
        const overflowCheck = async (when) => {
          const report = await readPage(page)
          if (report.scrollWidth > report.clientWidth + 1) fail(scope, `${when}: horizontal overflow, scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}`)
        }
        try {
          await page.goto(`${BASE}?theme=${theme}${flow.queries?.[mode.name] ?? mode.query}${flow.hash}`, { waitUntil: 'networkidle0' })
          await page.waitForFunction((title) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === title, { timeout: 10_000 }, flow.title)
          await flow.run(page, {
            press: (handle) => handle.click(),
            shoot: async (name) => {
              await overflowCheck(name)
              await page.screenshot({ path: file(name) })
            },
            inspect: overflowCheck,
          })
          await overflowCheck('after the flow')
        } catch (error) {
          fail(scope, error.message)
          await page.screenshot({ path: file(`${flow.name}-failed`) }).catch(() => {})
        }
        if (errors.length) fail(scope, `console errors: ${errors.slice(0, 3).join(' | ')}`)
        if (foreignRequests.length) fail(scope, `requests to other origins: ${foreignRequests.slice(0, 3).join(' | ')}`)
        checked += 1
        console.log(`${scope.padEnd(44)} ${String(viewport.width).padStart(4)}px  errors=${errors.length}  foreign=${foreignRequests.length}`)
        await context.close()
      }
    }
  }
}

await browser.close()
if (checked === 0) fail(selection.summary(), 'checked nothing, since none of these screens or flows runs at these widths')

if (overflowSeen.length) {
  console.log('\ncards wider than their content:')
  for (const seen of overflowSeen) {
    console.log(`  ${String(seen.viewport).padStart(4)}px ${seen.screen} ${seen.theme}: "${seen.title}" ${seen.content} in ${seen.width} px, by ${seen.by}${seen.allowed ? ' (allowed)' : ''}`)
  }
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}
console.log(selection.limited ? `\nevery screen and flow of this limited run clean (${selection.summary()}). The full run without options is the check` : '\nall viewports clean')
