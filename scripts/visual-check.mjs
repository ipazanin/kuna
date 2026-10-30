/**
 * Renders every screen of the fake-mode build in real Chrome at nine widths, from 360 to 2560 px,
 * in the dark and the light theme at 360, 430 and 1440 and in one theme at the others. It asserts
 * what a screenshot cannot: no horizontal overflow, no card whose content is wider than the card
 * outside the editors allowed to scroll sideways, no console errors (CSP violations included), no
 * request to another origin, that each screen rendered its title, and that it drew as many charts as
 * it has from the fake workbook. Every chart on the gallery must draw and every icon must come from
 * the bundle. From 768 px, cards whose tops line up in a row must end at the same height. Two fields
 * side by side in a form, a dialog or a card must have their inputs at the same height, on every
 * screen and in every flow, and every DashboardGrid must rearrange from 768 to 1440 px and again to
 * 1920 px, unless its cards already sit in one row at the wider width. Cards side by side in a grid
 * that is not a DashboardGrid fail, outside the gallery. A deep
 * link to a rule on Settings, Ruleset must open that rule in the side panel and bring its line to
 * just below the search bar, marked, and keep it there once slow web fonts swap in. Deep links into
 * a collapsed card must open it and land on their row. At 360, 430 and 1440 px each screen
 * collapses and expands one card. The total and the label in the middle of every donut must sit
 * inside the ring's hole with 2 px to spare.
 *
 * Beyond the screens of the fake workbook on Drive, it renders the home with every app in Set up and
 * onboarding's first steps on a first run (`?fake=empty`), each tab of the company's Settings and the
 * Year page's editors for a workbook kept in this browser (`?fake=browser`), Settings, Books file for
 * a file a newer app saved (`?fake=newer-file`), the Loans Settings, the Loans Overview with one loan
 * (`?loans=one-loan`), with a house loan and a car loan (`?loans=house-and-car`) and while its file opens (`?loans=opening`), the home, Kuna settings, the Loans first run and every Loans screen in Croatian (`?lang=hr`), Salaries for one
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
 * On Owner, Taken, at 360, 430 and 1440 px, the monthly net with the profit included opens its build-up and
 * Year from it in the workbook kept in this browser, and reads – with a link to the setting in the fake file on Drive.
 * On Year a link to the Statements tab alone keeps the year it opened through two tabs and Back.
 * It also makes an invoice through the checks and every step, with the fake Picker picking the
 * invoice and year folders and the month folder made on request, then re-exports it.
 * At 360, 430 and 1440 px it does the same with a pay scenario's component, copies a scenario, and
 * adds the starting scenarios to a workbook without any. At every width it opens each Loans dialog
 * in English and Croatian, the Company dialogs whose fields sit two to a row, the app menu in Croatian
 * and the bank loan's what-if in Croatian.
 * It plans a category for 2027 on Year, Plan, edits, clears and undoes it, and plans a purchase in a
 * workbook without plan rows. On Transactions it splits a payment, edits the split, deletes it and
 * undoes the delete. On Review it does the same from a row of the queue, and dismisses a group of
 * confirmed rows no rule repeats, restores it and undoes the restore. On its Rules tab it changes a rule's note in the rule's editor and undoes it,
 * then deletes the rule from its editor and brings it back with Undo. On the Import tab of Transactions it drops the sample camt.053 statement and the
 * sample bank export, makes a profile for the export, reads each dry run, confirms it, reads how many
 * new rows wait on Review and undoes it, then deletes the profile, at 360, 430 and 1440 px. With the
 * file on Drive, from Overview, Sync files the fake statements folder's sample statement with no
 * toast, its step on Kuna settings says so with Undo, which takes it out, Import lists it,
 * and a last sync finds nothing new. With a held statement in the folder, the sync control says 1
 * problem and opens its steps, a popover at 1440 and a bottom sheet at 360, whose link opens Import,
 * which says why. A tab Google gave no Drive read token gets Allow access in the sync control, which
 * files the sample, and a slow statements folder shows the control while its step runs and once it
 * is ready. On Salaries with five employees the one problem opens its build-up and its bank rows,
 * the People tab opens one employee's month and a month of the Over time table opens on the Month
 * tab.
 * The mail step is off until the Mail card on Settings, General saves a sender with the subject it
 * asks for, and the next sync files the bank's new mail. With the fake mailbox it files the bank's
 * PDF and statement and the accountant's new mail, the statements step of the same sync files the statement on the ledger, its
 * link opens the list on the Mail card, a second sync files nothing new, and the facts card shows the
 * accountant's mail. Mail all filed already says nothing new, a source that fails and an upload that
 * fails each give 1 problem with the steps open, and a token without Gmail read gets Allow access,
 * which runs the step. Saving a sender on the Mail card without Gmail read asks for it in the same
 * tap and syncs, and Allow access whose Google window closed says so beside the button. With the
 * accountant's kinds switched off the step reads the bank's mail alone, the payroll switched on
 * without a sender fails with what it lacks in the line and under its switch, Gmail asking to slow
 * down fails the step with one plain sentence, which the Mail card says too, and mail all filed by another app moves every
 * source's search to a week before the newest file in its folder.
 * The first run keeps an empty workbook on the fake Drive and one in this browser, goes back to the
 * step that made them, which shows them made and starts over, and offers to open the books the fake
 * Drive already holds when new books, a move from this browser or the Loans file would make a
 * second file. New books
 * on the fake Drive with statements from mail name the bank, make the statements folder beside the
 * books file and file the bank's mail there on the first sync. The statement step asks for Drive
 * read before the Picker when the page lacks it. An xlsx file
 * moves to the fake Drive through its summary, Settings, Books file moves a workbook kept in this
 * browser there with the Drive read its folders need asked up front, and a row confirmed on Review while another device files the other row keeps both.
 *
 * Run against a preview of the fake build:
 *   npm run build:fake && npm run preview:fake -- --port 4173
 *   npm run check:visual -- http://localhost:4173/kuna/
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

import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook.ts'
import { tabsOfDocument } from '../src/apps/company/workbook/infrastructure/spreadsheetDocument.ts'
import { templateColumnNames } from '../src/apps/company/workbook/infrastructure/workbookTemplate.ts'
import { installHrDooPack } from './support/installPack.mjs'
import { chromePath, ENGLISH_CHROME_ARG } from './support/browsers.mjs'
import { collapseAndExpand } from './support/cardFlows.mjs'
import { pageTabsFlow, yearTabLinkFlow } from './support/pageTabFlows.mjs'
import {
  accessClosedFlow,
  advanceFlow,
  appMenuFlow,
  appMenuFlowIn,
  assetFlow,
  employeeFlow,
  cardSettlementIbansFlow,
  categoryFiltersFlow,
  categoryFlow,
  changeCategoryFlow,
  clientIbansFlow,
  companyDialogsFlow,
  dismissFlow,
  heldStatementFlow,
  homeFlow,
  importCamtFlow,
  importTableFlow,
  invoiceFlow,
  invoiceRunFlow,
  loansBrowserFlow,
  loansDialogsFlow,
  loansDialogsFlowIn,
  loansDriveFlow,
  loansEditorFlow,
  loansOpenFlow,
  loansStartOnDriveFlow,
  loansWhatIfFlow,
  loansWhatIfFlowIn,
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
  moveOntoDriveFlow,
  onboardingBringFlow,
  onboardingBrowserFlow,
  onboardingDriveFlow,
  onboardingDriveReadFlow,
  onboardingMailFlow,
  onboardingOnDriveFlow,
  onboardingOpenFlow,
  onboardingStartOverFlow,
  onboardingStatementAccessFlow,
  ownerNetFlow,
  ownerNetUnregisteredFlow,
  ownerShareFlow,
  salariesFlow,
  planFlow,
  planTabFlow,
  raceFlow,
  reviewSplitFlow,
  rulesEditorFlow,
  scenarioFlow,
  setUpFlow,
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
const CARD_SELECTOR = '.rounded-card'

/**
 * `charts` is how many charts the screen draws from the fake workbook. `shows` is the text, or the
 * texts, that only appear once the fake workbook's rows reached the screen. `linkedRule` is the rule a deep link names.
 * `linkedPart` is the element a deep link's hash names, and `linkedRow` the row a deep link's query
 * marks, each inside a card that has to open for it. `linkedCard` is a card a link from another
 * screen points at, which has to open. `collapsedBefore` names the cards this device
 * remembers as collapsed, and `expandedBefore` those it remembers as open. `cards: false` marks a screen with no collapsible card.
 */
/** The ids of the sample Loans file's two loans, `?loans=sample`. */
const SAMPLE_BANK_LOAN = 'fa4e0000-0000-4000-8000-000000000001'
const SAMPLE_INFORMAL_LOAN = 'fa4e0000-0000-4000-8000-000000000006'

const SCREENS = [
  { name: 'overview', hash: '#/company', title: 'Overview', charts: 2, shows: ['Waiting for you', 'A typical month', 'Every euro earned', 'Balance at month end'] },
  { name: 'transactions', hash: '#/company/transactions', title: 'Transactions', charts: 0, shows: 'Northwind Analytics', cards: false },
  { name: 'transactions-owner-part', hash: '#/company/transactions?p=all&cat=equipment', title: 'Transactions', charts: 0, shows: ['30% to owner, from Equipment', 'Laptop Store'], cards: false },
  { name: 'import', hash: '#/company/transactions?tab=import', title: 'Transactions', charts: 0, shows: 'Drop a statement file here', cards: false },
  { name: 'analysis', hash: '#/company/analysis', title: 'Analysis', charts: 0, shows: ['External contractors', 'Who the company paid most'] },
  { name: 'analysis-over-time', hash: '#/company/analysis?tab=over-time', title: 'Analysis', charts: 2, shows: ['Rolling net', 'Cumulative net'] },
  { name: 'analysis-compare', hash: '#/company/analysis?tab=compare', title: 'Analysis', charts: 0, shows: ['Revenue', 'Show all'] },
  { name: 'invoicing', hash: '#/company/invoicing', title: 'Invoicing', charts: 1, shows: ['Next invoice', 'Every invoice', 'Show all'] },
  { name: 'invoicing-plan', hash: '#/company/invoicing?tab=plan', title: 'Invoicing', charts: 0, shows: ['Plan rows, 2026', 'Month by month, 2026', 'Totals over every client'] },
  {
    name: 'invoicing-month',
    hash: '#/company/invoicing?tab=plan&year=2026&month=2026-10#billing-month-2026-10',
    title: 'Invoicing',
    charts: 0,
    shows: "of the month's rows is not invoiced yet",
    linkedPart: 'billing-month-2026-10',
  },
  { name: 'invoicing-plan-2025', hash: '#/company/invoicing?tab=plan&year=2025', title: 'Invoicing', charts: 0, shows: 'Month by month, 2025' },
  { name: 'invoicing-clients', hash: '#/company/invoicing?tab=clients', title: 'Invoicing', charts: 0, shows: 'Add client' },
  {
    name: 'invoicing-terms',
    hash: '#/company/invoicing?tab=clients#invoicing-terms',
    title: 'Invoicing',
    charts: 0,
    shows: 'Save terms',
    linkedPart: 'invoicing-terms',
  },
  {
    name: 'year',
    hash: '#/company/year?tab=taxes',
    title: 'Year',
    charts: 0,
    shows: ['Corporate income tax, expected against paid', 'Payroll cadence', 'Tax by type'],
  },
  { name: 'year-forecast', hash: '#/company/year', title: 'Year', charts: 0, shows: 'The forecast needs the day the company was registered', cards: false },
  { name: 'year-plan', hash: '#/company/year?tab=plan', title: 'Year', charts: 0, shows: ['Plan for 2026', 'Revenue comes from the billing plan'], cards: false },
  { name: 'year-pay', hash: '#/company/year?year=2027&tab=pay', title: 'Year', charts: 0, shows: ['The figures need hr_company_registered', 'Scenarios for 2027'] },
  { name: 'year-accountant', hash: '#/company/year?year=2025', title: 'Year', charts: 1, shows: ['Lines at a glance', 'From the cash net to profit, 2025'] },
  { name: 'year-statements', hash: '#/company/year?tab=statements', title: 'Year', charts: 0, shows: ['Profit and loss', 'Konto lines', "The accountant's lines"] },
  { name: 'year-assets', hash: '#/company/year?tab=assets', title: 'Year', charts: 0, shows: ['Workstation', 'Asset rows', 'Grant rows'] },
  { name: 'year-assets-doubled', hash: '#/company/year?tab=assets&rates=doubled', title: 'Year', charts: 0, shows: 'What doubled rates would change' },
  {
    name: 'year-grant-rows',
    hash: '#/company/year?tab=assets#grant-rows',
    title: 'Year',
    charts: 0,
    shows: 'Save grants',
    collapsedBefore: ['year.grant-rows'],
    linkedPart: 'grant-rows',
  },
  { name: 'salaries', hash: '#/company/salaries', title: 'Salaries', charts: 0, shows: ["No row is the director's yet", 'No employees yet.', 'Add employee'] },
  {
    name: 'owner',
    hash: '#/company/owner',
    title: 'Owner',
    charts: 2,
    shows: [
      'Owner take by type',
      'Loans, net',
      'Rent tax the owner pays the tax office',
      'Owed by the owner at each month end',
      'Net share of gross cost',
      'Monthly net pay',
      'Monthly net, profit included',
      'Benefits from company costs',
      'of it from company costs',
      'needs hr_company_registered',
    ],
    cards: false,
  },
  { name: 'owner-2025', hash: '#/company/owner?p=2025', title: 'Owner', charts: 2, shows: ['Jan 2025 – Dec 2025', 'Owner take by type', 'Monthly net pay', 'over 8 months'], cards: false },
  {
    name: 'owner-owed',
    hash: '#/company/owner?tab=owed',
    title: 'Owner',
    charts: 0,
    shows: ['Costs the owner paid privately', 'with no cost on file waits on Review', 'The owner owes the company on 8 Oct 2026', 'Owed at the end'],
  },
  {
    name: 'owner-owed-2025',
    hash: '#/company/owner?tab=owed&p=2025',
    title: 'Owner',
    charts: 0,
    shows: ['The owner owes the company on 31 Dec 2025', 'No cost the owner paid privately was owed in Jan 2025 – Dec 2025'],
  },
  {
    name: 'owner-owed-filtered',
    hash: '#/company/owner?tab=owed&p=all&cat=equipment',
    title: 'Owner',
    charts: 0,
    shows: ['Who owes whom follows the period only', 'The owner owes the company on 8 Oct 2026'],
  },
  { name: 'review', hash: '#/company/review', title: 'Review', charts: 0, shows: ['GADGET CORNER', 'Refund of a parking fee'] },
  { name: 'review-rules', hash: '#/company/review?tab=rules', title: 'Review', charts: 0, shows: ['merchant-airline', 'Confirmed rows no rule repeats'] },
  {
    name: 'review-rule-linked',
    hash: '#/company/review?tab=rules&rule=merchant-airline',
    title: 'Review',
    charts: 0,
    shows: 'merchant-airline',
    collapsedBefore: ['review.rules'],
    linkedRow: '[data-testid="rule-row"][aria-current="true"]',
  },
  { name: 'home', hash: '#/', title: 'All apps', charts: 0, shows: ['Company', 'Cash on hand', '2 rows to review', 'Loans', 'Set up', 'Kuna settings'], cards: false },
  { name: 'home-croatian', query: 'lang=hr', hash: '#/', title: 'Sve aplikacije', charts: 0, shows: ['Tvrtka', 'Novac na računima', 'Krediti', 'Postavi'], cards: false },
  { name: 'company-settings', hash: '#/company/settings', title: 'Settings', charts: 0, shows: ['The workbook', 'Mail', 'Company and owner facts', 'Bucket labels', 'Loans to the owner'] },
  {
    name: 'company-settings-loan-rate',
    hash: '#/company/settings#owner-loan-interest',
    title: 'Settings',
    charts: 0,
    shows: "Interest the owner's loans carry",
    collapsedBefore: ['settings.facts'],
    linkedPart: 'owner-loan-interest',
  },
  {
    name: 'company-settings-categories',
    hash: '#/company/settings?tab=categories',
    title: 'Settings',
    charts: 0,
    shows: 'The bucket decides where a row counts',
    collapsedBefore: ['settings.categories'],
    linkedCard: 'settings.categories',
  },
  { name: 'company-settings-accounts', hash: '#/company/settings?tab=accounts', title: 'Settings', charts: 0, shows: 'Your bank accounts' },
  { name: 'company-settings-ruleset', hash: '#/company/settings?tab=ruleset', title: 'Settings', charts: 0, shows: ['Watch list', 'Rules by area', 'hr.cit.rate'] },
  {
    name: 'company-settings-ruleset-linked',
    hash: '#/company/settings?tab=ruleset&rule=hr.contrib.director-floor',
    title: 'Settings',
    charts: 0,
    shows: 'Contribution base floor for an employed',
    linkedRule: 'hr.contrib.director-floor',
  },
  {
    name: 'company-settings-books',
    hash: '#/company/settings?tab=books',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="drive-file-place"] a',
    shows: ['kuna-company.json', 'Books', 'None yet. The first save of a day makes one.', 'Open in Drive'],
    cards: false,
  },
  {
    name: 'kuna-settings',
    hash: '#/settings',
    title: 'Kuna settings',
    charts: 0,
    ready: '[data-testid="sync-card"]',
    shows: ['Sync as the app opens', 'Sign out of Google', 'Appearance and privacy'],
    cards: false,
  },
  {
    name: 'kuna-settings-croatian',
    query: 'lang=hr',
    hash: '#/settings',
    title: 'Postavke Kune',
    charts: 0,
    ready: '[data-testid="sync-card"]',
    shows: ['Sinkronizacija, izgled i jezik', 'Jezik preglednika', 'Hrvatski', 'Kad promijenite jezik, aplikacija se ponovno učita.'],
    cards: false,
  },
]

/** The gallery's chart cards that draw a chart. The loading card counts, the empty one does not. */
const GALLERY_CHARTS = 7

/** The gallery's donut cards, each of which must draw its ring. */
const GALLERY_DONUTS = 2

/** Screens outside the fake workbook on Drive. `query` picks the fake variant, `upload` drops the import file on the page. */
const SOURCE_SCREENS = [
  {
    name: 'home-fresh',
    query: 'fake=empty',
    hash: '#/',
    title: 'All apps',
    charts: 0,
    shows: ['Set up', "Your company's books from its bank statements", 'Your loans in a file of their own'],
    cards: false,
  },
  {
    name: 'home-fresh-croatian',
    query: 'fake=empty&lang=hr',
    hash: '#/',
    title: 'Sve aplikacije',
    charts: 0,
    shows: ['Postavi', 'Knjige vaše tvrtke iz bankovnih izvoda', 'Vaši krediti u zasebnoj datoteci'],
    cards: false,
  },
  { name: 'home-loans', query: 'loans=sample', hash: '#/', title: 'All apps', charts: 0, shows: ['Cash on hand', 'You owe in all'], cards: false },
  { name: 'home-loans-croatian', query: 'loans=sample&lang=hr', hash: '#/', title: 'Sve aplikacije', charts: 0, shows: ['Novac na računima', 'Ukupno dugujete'], cards: false },
  { name: 'welcome', query: 'fake=empty', hash: '#/company/start', title: 'Company', charts: 0, shows: ['What brings you here?', 'Start new books', 'Open my books on Google Drive'], cards: false },
  {
    name: 'onboarding-access',
    query: 'fake=empty',
    hash: '#/company/start?step=access&statements=folder',
    title: 'Company',
    charts: 0,
    shows: ['What the app may do in your Google account', 'From a folder in my Drive', 'Continue to Google'],
    cards: false,
  },
  { name: 'onboarding-find', query: 'fake=empty', hash: '#/company/start?path=open&step=find', title: 'Company', charts: 0, shows: ['Find your books on Drive', 'Pick another file'], cards: false },
  { name: 'company-settings-browser', query: 'fake=browser', hash: '#/company/settings', title: 'Settings', charts: 0, shows: 'Save settings' },
  { name: 'company-settings-categories-browser', query: 'fake=browser', hash: '#/company/settings?tab=categories', title: 'Settings', charts: 0, shows: 'Save categories' },
  { name: 'company-settings-accounts-browser', query: 'fake=browser', hash: '#/company/settings?tab=accounts', title: 'Settings', charts: 0, shows: 'Save accounts' },
  { name: 'company-settings-books-browser', query: 'fake=browser', hash: '#/company/settings?tab=books', title: 'Settings', charts: 0, shows: ['Import a file', 'Keep on Google Drive'], cards: false },
  {
    name: 'company-settings-books-newer',
    query: 'fake=newer-file',
    hash: '#/company/settings?tab=books',
    title: 'Settings',
    charts: 0,
    shows: 'A newer version of Kuna saved this file',
    cards: false,
  },
  { name: 'kuna-settings-browser', query: 'fake=browser', hash: '#/settings', title: 'Kuna settings', charts: 0, shows: ['Appearance and privacy', 'Browser language'], cards: false },
  { name: 'kuna-settings-browser-croatian', query: 'fake=browser&lang=hr', hash: '#/settings', title: 'Postavke Kune', charts: 0, shows: ['Izgled i privatnost', 'Jezik preglednika'], cards: false },
  { name: 'year-accountant-browser', query: 'fake=browser', hash: '#/company/year?year=2025', title: 'Year', charts: 1, shows: 'Loans to the owner carry 2.5%' },
  { name: 'year-statements-browser', query: 'fake=browser', hash: '#/company/year?year=2025&tab=statements', title: 'Year', charts: 0, shows: 'Balance paid on', expandedBefore: ['year.tax'] },
  {
    name: 'year-accountant-lines-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2025&tab=statements#accountant-lines',
    title: 'Year',
    charts: 0,
    shows: 'Save year-end lines',
    linkedPart: 'accountant-lines',
  },
  { name: 'year-asset-rows-browser', query: 'fake=browser', hash: '#/company/year?tab=assets#asset-rows', title: 'Year', charts: 0, shows: 'Save assets', linkedPart: 'asset-rows' },
  {
    name: 'salaries-browser',
    query: 'fake=browser',
    hash: '#/company/salaries#employee-rows',
    title: 'Salaries',
    charts: 1,
    shows: 'Save employees',
    collapsedBefore: ['salaries.employees'],
    linkedPart: 'employee-rows',
  },
  {
    name: 'salaries-one-employee',
    query: 'fake=one-employee',
    hash: '#/company/salaries',
    title: 'Salaries',
    charts: 1,
    shows: ['Where the company’s money goes', 'Gross to net', 'App and bank', 'Pension savings', 'The app and the bank agree on every line they both state'],
  },
  {
    name: 'salaries-one-employee-over-time',
    query: 'fake=one-employee',
    hash: '#/company/salaries?tab=over-time',
    title: 'Salaries',
    charts: 1,
    shows: ['Cost to the company by payday, 2026', 'Paydays of 2026'],
  },
  {
    name: 'salaries-five-employees',
    query: 'fake=five-employees',
    hash: '#/company/salaries',
    title: 'Salaries',
    charts: 1,
    shows: ['Paid to the employees', 'Health insurance, everyone paid', 'Everyone'],
  },
  { name: 'salaries-five-employees-people', query: 'fake=five-employees', hash: '#/company/salaries?tab=people', title: 'Salaries', charts: 0, shows: ['Everyone paid in Sep 2026', 'Niko Test'] },
  { name: 'salaries-five-employees-one', query: 'fake=five-employees', hash: '#/company/salaries?employee=lea', title: 'Salaries', charts: 1, shows: ['Lea Proba', 'Paid to the employee'] },
  {
    name: 'owner-browser',
    query: 'fake=browser',
    hash: '#/company/owner',
    title: 'Owner',
    charts: 2,
    shows: ['Tax avoided against a dividend', 'As a dividend you would net', 'Set the defaults', 'Monthly net pay', 'from profit, a month'],
    cards: false,
  },
  { name: 'owner-owed-browser', query: 'fake=browser', hash: '#/company/owner?tab=owed&p=all', title: 'Owner', charts: 0, shows: ['Costs the owner paid privately', 'Net owed'] },
  {
    name: 'year-forecast-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2026',
    title: 'Year',
    charts: 1,
    shows: ['Month by month, 2026', 'plan rows of 2026 are not invoiced yet', 'Plan against actual, 2026'],
  },
  {
    name: 'year-forecast-2027-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2027',
    title: 'Year',
    charts: 1,
    shows: ['Month by month, 2027', 'Values the ruleset only estimates for 2027'],
  },
  {
    name: 'year-pay-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Year',
    charts: 1,
    shows: ['Dividend capacity', 'Where the profit before owner pay goes, 2027', '1 warning', 'Side by side'],
  },
  {
    name: 'year-pay-interim-browser',
    query: 'fake=browser',
    hash: '#/company/year?year=2027&tab=pay&payout=interim',
    title: 'Year',
    charts: 1,
    shows: 'An interim payout in 2027',
    expandedBefore: ['year.comparison'],
  },
  { name: 'year-pay-2026-browser', query: 'fake=browser', hash: '#/company/year?year=2026&tab=pay', title: 'Year', charts: 0, shows: ['No scenario for 2026 to compare yet', 'Dividend capacity'] },
  { name: 'year-pay-no-scenarios', query: 'fake=no-scenarios', hash: '#/company/year?year=2027&tab=pay', title: 'Year', charts: 0, shows: 'No scenario is for 2027 yet' },
  { name: 'year-taxes-browser', query: 'fake=browser', hash: '#/company/year?tab=taxes', title: 'Year', charts: 0, shows: ['For 2026', '1 payment is overdue', 'Less tax refund'] },
  { name: 'invoicing-plan-browser', query: 'fake=browser', hash: '#/company/invoicing?tab=plan', title: 'Invoicing', charts: 0, shows: 'Fill the rest of 2026' },
  { name: 'invoicing-clients-browser', query: 'fake=browser', hash: '#/company/invoicing?tab=clients', title: 'Invoicing', charts: 0, shows: 'Save clients' },
  { name: 'invoicing-empty-plan-browser', query: 'fake=browser-no-billing-plan', hash: '#/company/invoicing?tab=plan', title: 'Invoicing', charts: 0, shows: 'Add the first row', cards: false },
  { name: 'loans-start', hash: '#/loans', title: 'Loans', charts: 0, shows: ['Where the Loans file lives', 'A new file on Google Drive', 'My file on Google Drive'], cards: false },
  {
    name: 'loans-start-croatian',
    query: 'lang=hr',
    hash: '#/loans',
    title: 'Krediti',
    charts: 0,
    shows: ['Gdje se čuva datoteka kredita', 'Nova datoteka na Google Driveu', 'Moja datoteka na Google Driveu', 'Sve aplikacije'],
    cards: false,
  },
  { name: 'loans-start-folder', hash: '#/loans/start?step=folder', title: 'Loans', charts: 0, shows: ['Where the Loans file is saved', 'Choose a folder in Google Drive'], cards: false },
  {
    name: 'loans-start-folder-croatian',
    query: 'lang=hr',
    hash: '#/loans/start?step=folder',
    title: 'Krediti',
    charts: 0,
    shows: ['Gdje se sprema datoteka kredita', 'Odaberi mapu na Google Driveu', 'Natrag'],
    cards: false,
  },
  { name: 'loans-start-find', hash: '#/loans/start?step=find', title: 'Loans', charts: 0, shows: ['Find your Loans file on Drive', 'Pick another file', 'kuna-loans.json'], cards: false },
  {
    name: 'loans-start-find-croatian',
    query: 'lang=hr',
    hash: '#/loans/start?step=find',
    title: 'Krediti',
    charts: 0,
    shows: ['Pronađite datoteku kredita na Driveu', 'Odaberi drugu datoteku', 'kuna-loans.json'],
    cards: false,
  },
  { name: 'loans-overview', query: 'loans=drive', hash: '#/loans', title: 'Overview', charts: 0, shows: ['No loans yet', 'on Google Drive as kuna-loans.json'], cards: false },
  {
    name: 'loans-overview-croatian',
    query: 'loans=drive&lang=hr',
    hash: '#/loans',
    title: 'Pregled',
    charts: 0,
    shows: ['Još nema kredita ni pozajmica', 'na Google Driveu kao kuna-loans.json', 'Dodaj pozajmicu'],
    cards: false,
  },
  {
    name: 'loans-sample',
    query: 'loans=sample',
    hash: '#/loans',
    title: 'Overview',
    charts: 0,
    shows: ['Home loan', 'From Marko', 'Owed in all', 'Subsidy ends', 'APN pays', 'paid back'],
    cards: false,
  },
  {
    name: 'loans-sample-croatian',
    query: 'loans=sample&lang=hr',
    hash: '#/loans',
    title: 'Pregled',
    charts: 0,
    shows: ['Home loan', 'Ukupno dugujete', 'Plaća APN', 'otplaćeno'],
    cards: false,
  },
  { name: 'loans-one-loan', query: 'loans=one-loan', hash: '#/loans', title: 'Overview', charts: 0, shows: ['Home loan', 'owed today', 'paid back', 'Subsidy ends'], cards: false },
  {
    name: 'loans-one-loan-croatian',
    query: 'loans=one-loan&lang=hr',
    hash: '#/loans',
    title: 'Pregled',
    charts: 0,
    shows: ['Home loan', 'dug danas', 'otplaćeno', 'Subvencija završava'],
    cards: false,
  },
  {
    name: 'loans-house-and-car',
    query: 'loans=house-and-car',
    hash: '#/loans',
    title: 'Overview',
    charts: 2,
    shows: ['Home loan', 'Car loan', 'Interest still to pay', 'Free of all debt', 'Owed over time', 'What goes out each month', 'Upcoming payments', 'Every payment of Car loan'],
    cards: false,
  },
  {
    name: 'loans-house-and-car-croatian',
    query: 'loans=house-and-car&lang=hr',
    hash: '#/loans',
    title: 'Pregled',
    charts: 2,
    shows: ['Car loan', 'Preostala kamata', 'Svi dugovi otplaćeni', 'Dug kroz vrijeme', 'Koliko plaćate svaki mjesec', 'Sljedeće uplate'],
    cards: false,
  },
  { name: 'loans-opening', query: 'loans=opening', hash: '#/loans', title: 'Overview', charts: 0, ready: '[data-testid="loans-loading"]', cards: false },
  { name: 'loans-opening-croatian', query: 'loans=opening&lang=hr', hash: '#/loans', title: 'Pregled', charts: 0, ready: '[data-testid="loans-loading"]', cards: false },
  {
    name: 'loans-bank-loan-opening',
    query: 'loans=opening',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: null,
    charts: 0,
    ready: '[data-testid="screen-skeleton"]',
    cards: false,
  },
  {
    name: 'loans-bank-loan-opening-croatian',
    query: 'loans=opening&lang=hr',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: null,
    charts: 0,
    ready: '[data-testid="screen-skeleton"]',
    cards: false,
  },
  {
    name: 'loans-informal-loan-opening',
    query: 'loans=opening',
    hash: `#/loans/informal-loan?loan=${SAMPLE_INFORMAL_LOAN}`,
    title: null,
    charts: 0,
    ready: '[data-testid="screen-skeleton"]',
    cards: false,
  },
  {
    name: 'loans-informal-loan-opening-croatian',
    query: 'loans=opening&lang=hr',
    hash: `#/loans/informal-loan?loan=${SAMPLE_INFORMAL_LOAN}`,
    title: null,
    charts: 0,
    ready: '[data-testid="screen-skeleton"]',
    cards: false,
  },
  {
    name: 'loans-bank-loan',
    query: 'loans=sample',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: 'Home loan',
    charts: 2,
    shows: ['Owed today', 'Total owed', 'APN pays', 'Owed over time', 'Where the payments go', 'Over the whole loan', 'What if I pay extra', 'Estimate', '6M EURIBOR', 'days late'],
  },
  {
    name: 'loans-bank-loan-croatian',
    query: 'loans=sample&lang=hr',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: 'Home loan',
    charts: 2,
    shows: ['Dug danas', 'Ukupno za otplatu', 'Plaća APN', 'Dug kroz vrijeme', 'Kamo idu uplate', 'Što ako uplatim više', 'Procjena', '6M EURIBOR', 'dana nakon dospijeća', 'Razdoblja kamatne stope'],
  },
  {
    name: 'loans-informal-loan',
    query: 'loans=sample',
    hash: `#/loans/informal-loan?loan=${SAMPLE_INFORMAL_LOAN}`,
    title: 'From Marko',
    charts: 1,
    shows: ['You owe Marko', 'Borrowed since', 'Borrowed in kind', 'Repaid in kind', 'Forgiven', 'He bought a boat battery for me'],
  },
  {
    name: 'loans-informal-loan-croatian',
    query: 'loans=sample&lang=hr',
    hash: `#/loans/informal-loan?loan=${SAMPLE_INFORMAL_LOAN}`,
    title: 'From Marko',
    charts: 1,
    shows: ['Dugujete: Marko', 'Posuđeno nakon toga', 'Posuđeno u naravi', 'Vraćeno u naravi', 'Oprošteno', 'Promjene'],
  },
  {
    name: 'loans-settings',
    query: 'loans=drive',
    hash: '#/loans/settings',
    title: 'Settings',
    charts: 0,
    ready: '[data-testid="loans-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Loans books', 'kuna-loans.json', 'Switch storage'],
    cards: false,
  },
  {
    name: 'loans-settings-croatian',
    query: 'loans=drive&lang=hr',
    hash: '#/loans/settings',
    title: 'Postavke',
    charts: 0,
    ready: '[data-testid="loans-books-card"] [data-testid="drive-file-place"] a',
    shows: ['Datoteka kredita', 'kuna-loans.json', 'Promijeni mjesto', 'Zadnja sinkronizacija'],
    cards: false,
  },
  {
    name: 'loans-settings-browser',
    query: 'fake=browser&loans=browser',
    hash: '#/loans/settings',
    title: 'Settings',
    charts: 0,
    shows: ['Loans books', 'Fake Loans file', 'Some changes are in no exported file yet'],
    cards: false,
  },
  {
    name: 'loans-settings-browser-croatian',
    query: 'fake=browser&loans=browser&lang=hr',
    hash: '#/loans/settings',
    title: 'Postavke',
    charts: 0,
    shows: ['Datoteka kredita', 'Fake Loans file', 'Neke promjene još nisu ni u jednoj izvezenoj datoteci'],
    cards: false,
  },
  {
    name: 'import-summary',
    query: 'fake=empty',
    hash: '#/company/start?path=bring&home=browser&step=file',
    title: 'Company',
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

/** The screens whose cards may sit side by side in a grid of their own, each with why. */
const HAND_BUILT_GRIDS_ALLOWED = [{ screen: 'gallery', reason: 'The gallery sets specimens side by side to compare their states.' }]

const failures = []
/** Every card found wider than its content, allowed or not, listed at the end. */
const overflowSeen = []

/**
 * A dashboard grid has to rearrange as the screen widens from one of these widths to the next, unless
 * all its cards already sit in one row at the wider one.
 */
const REFLOW_WIDTHS = [768, 1440, 1920]
/** The dashboard grids each screen showed, by its name and the width, such as `overview 1440`. */
const dashboardGridsSeen = new Map()

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
    const overflowing = [...document.querySelectorAll('*')].filter((element) => element.getBoundingClientRect().right > doc.clientWidth + 1).map(name)
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflowing: [...new Set(overflowing)].slice(0, 6),
      title: document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() ?? null,
      chartHeights: [...document.querySelectorAll('.chart-body canvas')]
        .filter((canvas) => canvas.closest('.chart-body').getClientRects().length > 0)
        .map((canvas) => canvas.getBoundingClientRect().height),
      donutHeights: [...document.querySelectorAll('[data-testid="donut-card"] canvas')].map((canvas) => canvas.getBoundingClientRect().height),
      iconCount: document.querySelectorAll('svg.iconify').length,
      unrenderedIcons: [...document.querySelectorAll('.iconify')].filter((icon) => icon.tagName.toLowerCase() !== 'svg').length,
      themeClass: doc.classList.contains('light') ? 'light' : doc.classList.contains('dark') ? 'dark' : 'none',
      text: document.body.innerText,
      raggedRows: raggedCardRows(cardSelector),
      cardOverflow: overflowingCards(cardSelector),
      unevenFieldRows: unevenFieldRows(),
      dashboardGrids: dashboardGrids(),
      handBuiltGrids: handBuiltGrids(cardSelector),
      crowdedDonuts: crowdedDonuts(cardSelector),
    }

    /**
     * Donuts whose middle reaches past the hole: a corner of a line of the total or its label sits
     * farther from the ring's centre than the hole's radius less 2 px. The hole's radius is how far
     * the ring's canvas stays clear from its centre, read in 32 directions, so a ring that has not
     * drawn has no hole to check.
     */
    function crowdedDonuts(selector) {
      const found = []
      for (const ring of document.querySelectorAll('.donut-ring')) {
        const canvas = ring.querySelector('canvas')
        const middle = ring.querySelector('.ring-middle')
        if (canvas === null || middle === null || canvas.width === 0 || ring.getClientRects().length === 0) continue
        const box = canvas.getBoundingClientRect()
        const scale = canvas.width / box.width
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
        const painted = (x, y) => pixels[(Math.round(y * scale) * canvas.width + Math.round(x * scale)) * 4 + 3] > 128
        let hole = Infinity
        for (let step = 0; step < 32; step++) {
          const angle = (step / 32) * 2 * Math.PI
          for (let radius = 0; radius < box.width / 2; radius += 0.5) {
            if (painted(box.width / 2 + Math.cos(angle) * radius, box.height / 2 + Math.sin(angle) * radius)) {
              hole = Math.min(hole, radius)
              break
            }
          }
        }
        if (hole === Infinity) continue
        const centreX = box.left + box.width / 2
        const centreY = box.top + box.height / 2
        const walker = document.createTreeWalker(middle, NodeFilter.SHOW_TEXT)
        for (let text = walker.nextNode(); text !== null; text = walker.nextNode()) {
          const range = document.createRange()
          range.selectNodeContents(text)
          for (const line of range.getClientRects()) {
            const reach = Math.max(...[line.left, line.right].flatMap((x) => [line.top, line.bottom].map((y) => Math.hypot(x - centreX, y - centreY))))
            if (reach > hole - 2) {
              const title = (ring.closest(selector)?.querySelector('h2, h3')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 48)
              found.push(`"${text.textContent.trim()}" in the middle of "${title}" reaches ${reach.toFixed(1)} px from the centre, past the ring's ${hole.toFixed(1)} px hole`)
            }
          }
        }
      }
      return found
    }

    /**
     * Pairs of side-by-side fields in one form, dialog or card whose tops line up but whose controls
     * start more than 1 px apart, as when a label that wraps pushes its input below its neighbour's.
     * A field without an input, a select or a text area, such as a radio group or a switch, has no
     * control to line up.
     */
    function unevenFieldRows() {
      const control = 'input:not([type="hidden"], [type="checkbox"], [type="radio"], [type="file"]), select, textarea, [role="combobox"]'
      const fields = [...document.querySelectorAll('[data-slot="root"]:has(> [data-slot="wrapper"])')].flatMap((field) => {
        const input = [...field.querySelectorAll(control)].find((element) => element.getClientRects().length > 0)
        if (input === undefined) return []
        // An input inside a Nuxt UI input box starts where its box does, past the box's icon or tags.
        const box = input.parentElement.closest('[data-slot="root"]')
        const measured = box !== field && field.contains(box) ? box : input
        return [{ field, frame: field.closest('form, [role="dialog"], .rounded-card'), box: field.getBoundingClientRect(), control: measured.getBoundingClientRect().top }]
      })
      const label = ({ field }) => (field.querySelector('[data-slot="label"]')?.textContent ?? '').trim().slice(0, 32)
      const uneven = []
      for (const [index, left] of fields.entries()) {
        for (const right of fields.slice(index + 1)) {
          const sideBySide = left.box.right <= right.box.left + 1 || right.box.right <= left.box.left + 1
          if (left.frame !== right.frame || !sideBySide || Math.abs(left.box.top - right.box.top) > 1) continue
          const gap = Math.abs(left.control - right.control)
          if (gap > 1) uneven.push(`"${label(left)}" and "${label(right)}" have their inputs ${Math.round(gap)} px apart`)
        }
      }
      return uneven
    }

    /**
     * Each dashboard grid laid out as a grid, in page order, with how many of its parts sit in each
     * of its rows. Below 3xl a pair is not a grid, its parts stacking in the screen's column.
     */
    function dashboardGrids() {
      const grids = []
      for (const grid of document.querySelectorAll('[data-layout]')) {
        if (getComputedStyle(grid).display !== 'grid') continue
        const rows = new Map()
        for (const part of [...grid.children].filter((child) => child.getClientRects().length > 0)) {
          const top = Math.round(part.getBoundingClientRect().top)
          const row = [...rows.keys()].find((start) => Math.abs(start - top) <= 1) ?? top
          rows.set(row, (rows.get(row) ?? 0) + 1)
        }
        const name = (grid.dataset.testid ?? grid.querySelector('h2, h3, p')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32)
        grids.push({ name, layout: grid.dataset.layout, rows: [...rows.entries()].sort(([first], [second]) => first - second).map(([, count]) => count) })
      }
      return grids
    }

    /**
     * Grids on the screen that set two of their cards side by side without being a DashboardGrid, so
     * they rearrange by breakpoints of their own. A grid inside a card is part of that card.
     */
    function handBuiltGrids(selector) {
      const found = []
      for (const grid of new Set([...document.querySelectorAll(`main ${selector}`)].map((card) => card.parentElement))) {
        if (grid.dataset.layout !== undefined || grid.closest(selector) !== null || getComputedStyle(grid).display !== 'grid') continue
        const tops = [...grid.children].filter((child) => child.matches(selector) && child.getClientRects().length > 0).map((card) => Math.round(card.getBoundingClientRect().top))
        if (!tops.some((top, index) => tops.slice(index + 1).some((other) => Math.abs(other - top) <= 1))) continue
        found.push((grid.dataset.testid ?? grid.querySelector('h2, h3, p')?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32))
      }
      return found
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

/** The dialog flows run at every width, so the uneven form row rule sees each dialog as every width lays it out. */
const EVERY_VIEWPORT = VIEWPORTS.map((viewport) => viewport.name)

/** The editors' flows, each on a fresh load, so the fake file on Drive and the workbook kept in this browser start from their seed. */
const FLOWS = [
  { name: 'page-tabs', hash: '#/company/settings', title: 'Settings', run: pageTabsFlow },
  { name: 'year-tab-link', hash: '#/company/year?tab=statements', title: 'Year', run: yearTabLinkFlow },
  { name: 'categories', hash: '#/company/settings?tab=categories', title: 'Settings', run: categoryFlow },
  { name: 'categories-filters', hash: '#/company/settings?tab=categories', title: 'Settings', run: categoryFiltersFlow },
  { name: 'settings-statements-folder', hash: '#/company/settings', title: 'Settings', run: statementsFolderFlow },
  { name: 'settings-card-ibans', hash: '#/company/settings', title: 'Settings', run: cardSettlementIbansFlow },
  { name: 'clients-ibans', hash: '#/company/invoicing?tab=clients', title: 'Invoicing', run: clientIbansFlow },
  { name: 'assets', hash: '#/company/year?tab=assets#asset-rows', title: 'Year', run: assetFlow },
  { name: 'employees', hash: '#/company/salaries#employee-rows', title: 'Salaries', run: employeeFlow },
  { name: 'advances', hash: '#/company/owner?tab=owed', title: 'Owner', run: advanceFlow },
  { name: 'invoices', hash: '#/company/invoicing?p=all', title: 'Invoicing', run: invoiceFlow },
  { name: 'invoice-run', hash: '#/company/invoicing?p=all', title: 'Invoicing', run: invoiceRunFlow },
  { name: 'scenarios', hash: '#/company/year?year=2027&tab=pay', title: 'Year', run: scenarioFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  {
    name: 'starting-scenarios',
    hash: '#/company/year?year=2027&tab=pay',
    title: 'Year',
    run: startingScenariosFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    queries: { drive: '&fake=no-scenarios', browser: '&fake=browser-no-scenarios' },
  },
  { name: 'plan', hash: '#/company/year?year=2027&tab=plan', title: 'Year', run: planFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  {
    name: 'plan-tab',
    hash: '#/company/year?year=2027&tab=plan',
    title: 'Year',
    run: planTabFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    queries: { drive: '&fake=no-plan', browser: '&fake=browser-no-plan' },
  },
  { name: 'split', hash: '#/company/transactions?p=all&q=GADGET', title: 'Transactions', run: splitFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'split-review', hash: '#/company/review', title: 'Review', run: reviewSplitFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'change-category', hash: '#/company/transactions?p=all&q=CODE%20HOST', title: 'Transactions', run: changeCategoryFlow },
  { name: 'owner-share', hash: '#/company/transactions?p=all&q=purchase%2C%20laptop', title: 'Transactions', run: ownerShareFlow },
  { name: 'owner-net', hash: '#/company/owner?p=2026', title: 'Owner', run: ownerNetFlow, viewports: ['phone', 'phone-large', 'desktop'], modes: ['browser'] },
  { name: 'owner-net-unregistered', hash: '#/company/owner?p=2026', title: 'Owner', run: ownerNetUnregisteredFlow, viewports: ['phone', 'phone-large', 'desktop'], modes: ['drive'] },
  { name: 'share-fill', hash: '#/company/settings?tab=categories', title: 'Settings', run: shareFillFlow },
  { name: 'dismiss', hash: '#/company/review?tab=rules', title: 'Review', run: dismissFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'rules-editor', hash: '#/company/review?tab=rules', title: 'Review', run: rulesEditorFlow },
  { name: 'import-camt', hash: '#/company/transactions?tab=import', title: 'Transactions', run: importCamtFlow(IMPORT_SAMPLES.camt), viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'import-table', hash: '#/company/transactions?tab=import', title: 'Transactions', run: importTableFlow(IMPORT_SAMPLES.table), viewports: ['phone', 'phone-large', 'desktop'] },
  { name: 'statements-sync', hash: '#/company', title: 'Overview', run: statementSyncFlow, modes: ['drive'] },
  { name: 'statements-held', hash: '#/company', title: 'Overview', run: heldStatementFlow, modes: ['drive'], queries: { drive: '&fake=held-statement' } },
  { name: 'statements-access', hash: '#/company', title: 'Overview', run: statementAccessFlow, modes: ['drive'] },
  { name: 'sync-running', hash: '#/company', title: 'Overview', run: syncRunningFlow, modes: ['drive'], queries: { drive: '&fake=slow-statements' } },
  { name: 'mail-off', hash: '#/company', title: 'Overview', run: mailOffFlow, modes: ['drive'] },
  { name: 'mail-filed', hash: '#/company', title: 'Overview', run: mailFiledFlow, modes: ['drive'], queries: { drive: '&fake=mail' } },
  { name: 'mail-upload-failed', hash: '#/company', title: 'Overview', run: mailUploadFailedFlow, modes: ['drive'], queries: { drive: '&fake=mail-upload-failed' } },
  { name: 'mail-nothing-new', hash: '#/company', title: 'Overview', run: mailNothingNewFlow, modes: ['drive'], queries: { drive: '&fake=mail-nothing-new' } },
  { name: 'mail-failed', hash: '#/company', title: 'Overview', run: mailFailedFlow, modes: ['drive'], queries: { drive: '&fake=mail-failed' } },
  { name: 'mail-access', hash: '#/company', title: 'Overview', run: mailAccessFlow, modes: ['drive'], queries: { drive: '&fake=mail' } },
  { name: 'mail-save-asks', hash: '#/company', title: 'Overview', run: mailSaveAsksFlow, modes: ['drive'] },
  { name: 'mail-switches-off', hash: '#/company', title: 'Overview', run: mailSwitchesOffFlow, modes: ['drive'], queries: { drive: '&fake=mail-switches-off' } },
  { name: 'mail-no-sender', hash: '#/company', title: 'Overview', run: mailNoSenderFlow, modes: ['drive'], queries: { drive: '&fake=mail-no-sender' } },
  { name: 'mail-rate-limited', hash: '#/company', title: 'Overview', run: mailRateLimitedFlow, modes: ['drive'], queries: { drive: '&fake=mail-rate-limited' } },
  { name: 'mail-window', hash: '#/company', title: 'Overview', run: mailWindowFlow, modes: ['drive'], queries: { drive: '&fake=mail-nothing-new' } },
  { name: 'sync-access-closed', hash: '#/company', title: 'Overview', run: accessClosedFlow, modes: ['drive'], queries: { drive: '&fake=google-closed' } },
  { name: 'salaries', hash: '#/company/salaries', title: 'Salaries', run: salariesFlow, modes: ['drive'], queries: { drive: '&fake=five-employees' } },
  { name: 'onboarding-drive', hash: '#/company/start', title: 'Company', run: onboardingDriveFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-drive-read', hash: '#/company/start', title: 'Company', run: onboardingDriveReadFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-mail', hash: '#/company/start', title: 'Company', run: onboardingMailFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-browser', hash: '#/company/start', title: 'Company', run: onboardingBrowserFlow, modes: ['browser'], queries: { browser: '&fake=empty' } },
  { name: 'onboarding-bring', hash: '#/company/start', title: 'Company', run: onboardingBringFlow(IMPORT_FILE), modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-open', hash: '#/company/start?path=open', title: 'Company', run: onboardingOpenFlow, modes: ['drive'] },
  { name: 'onboarding-start-over', hash: '#/company/start', title: 'Company', run: onboardingStartOverFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'onboarding-on-drive', hash: '#/company/start?step=folder', title: 'Company', run: onboardingOnDriveFlow, modes: ['drive'] },
  { name: 'onboarding-move-on-drive', hash: '#/company/settings?tab=books', title: 'Settings', run: moveOntoDriveFlow, modes: ['browser'], queries: { browser: '&fake=browser-beside-drive' } },
  { name: 'onboarding-statement-access', hash: '#/company/start?step=statement&statements=folder', title: 'Company', run: onboardingStatementAccessFlow, modes: ['drive'] },
  { name: 'loans-drive', hash: '#/loans', title: 'Loans', run: loansDriveFlow, modes: ['drive'] },
  { name: 'loans-browser', hash: '#/loans', title: 'Loans', run: loansBrowserFlow, modes: ['browser'] },
  { name: 'loans-open', hash: '#/loans', title: 'Loans', run: loansOpenFlow, modes: ['drive'], queries: { drive: '&loans=other-device' } },
  { name: 'loans-start-on-drive', hash: '#/loans/start?step=folder', title: 'Loans', run: loansStartOnDriveFlow, modes: ['drive'], queries: { drive: '&loans=other-device' } },
  { name: 'loans-editor', hash: '#/loans', title: 'Overview', run: loansEditorFlow, modes: ['drive'], queries: { drive: '&loans=sample' } },
  { name: 'loans-what-if', hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`, title: 'Home loan', run: loansWhatIfFlow, modes: ['drive'], queries: { drive: '&loans=sample' } },
  {
    name: 'loans-what-if-croatian',
    hash: `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`,
    title: 'Home loan',
    run: loansWhatIfFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    modes: ['drive'],
    queries: { drive: '&loans=sample&lang=hr' },
  },
  { name: 'dialogs-loans', hash: '#/loans', title: 'Overview', run: loansDialogsFlow, viewports: EVERY_VIEWPORT, modes: ['drive'], queries: { drive: '&loans=sample' } },
  { name: 'dialogs-loans-croatian', hash: '#/loans', title: 'Pregled', run: loansDialogsFlowIn('hr'), viewports: EVERY_VIEWPORT, modes: ['drive'], queries: { drive: '&loans=sample&lang=hr' } },
  { name: 'dialogs-company', hash: '#/company/invoicing?p=all', title: 'Invoicing', run: companyDialogsFlow, viewports: EVERY_VIEWPORT, modes: ['drive'] },
  { name: 'app-menu', hash: '#/loans', title: 'Overview', run: appMenuFlow, queries: { drive: '&loans=drive', browser: '&fake=browser&loans=browser' } },
  {
    name: 'app-menu-croatian',
    hash: '#/loans',
    title: 'Pregled',
    run: appMenuFlowIn('hr'),
    viewports: EVERY_VIEWPORT,
    queries: { drive: '&loans=drive&lang=hr', browser: '&fake=browser&loans=browser&lang=hr' },
  },
  { name: 'home', hash: '#/', title: 'All apps', run: homeFlow, modes: ['drive'], queries: { drive: '&loans=sample' } },
  { name: 'home-browser', hash: '#/', title: 'All apps', run: homeFlow, modes: ['browser'], queries: { browser: '&fake=browser&loans=sample' } },
  { name: 'home-set-up', hash: '#/', title: 'All apps', run: setUpFlow, modes: ['drive'], queries: { drive: '&fake=empty' } },
  { name: 'move-browser', hash: '#/company/settings?tab=books', title: 'Settings', run: moveFromBrowserFlow, modes: ['browser'] },
  { name: 'race', hash: '#/company/review', title: 'Review', run: raceFlow, modes: ['drive'], queries: { drive: '&fake=race' } },
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

const browser = await launch({ executablePath: chromePath(), headless: true, args: ['--hide-scrollbars', ENGLISH_CHROME_ARG] })
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
          for (const card of collapsed) localStorage.setItem(`kuna.card.${card}`, 'collapsed')
          for (const card of expanded) localStorage.setItem(`kuna.card.${card}`, 'expanded')
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

    // ECharts animates bars and rings in. The screenshot and the hole of a donut should show where they land.
    if (rendered && (drawsCharts || (await page.$('.donut-ring canvas')) !== null)) await new Promise((resolve) => setTimeout(resolve, 1500))

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
    for (const row of report.unevenFieldRows) fail(scope, `uneven form row: ${row}`)
    for (const donut of report.crowdedDonuts) fail(scope, donut)
    if (REFLOW_WIDTHS.includes(viewport.width)) dashboardGridsSeen.set(`${visit.name} ${viewport.width}`, report.dashboardGrids)
    if (!HAND_BUILT_GRIDS_ALLOWED.some((entry) => visit.name.startsWith(entry.screen))) {
      for (const grid of report.handBuiltGrids) fail(scope, `the grid "${grid}" sets cards side by side without DashboardGrid`)
    }
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

if (REFLOW_WIDTHS.every((width) => selection.takesWidth(width))) {
  // Two grids of one screen may open with the same title, so each is known by its title and how many came before it with that title.
  const keyed = (grids) => grids.map((grid, index) => [`${grid.name} ${grids.slice(0, index).filter((other) => other.name === grid.name).length}`, grid])
  for (const name of new Set(visits.map((visit) => visit.name))) {
    for (const [narrow, wide] of REFLOW_WIDTHS.slice(1).map((width, index) => [REFLOW_WIDTHS[index], width])) {
      const before = new Map(keyed(dashboardGridsSeen.get(`${name} ${narrow}`) ?? []))
      for (const [key, grid] of keyed(dashboardGridsSeen.get(`${name} ${wide}`) ?? [])) {
        if (grid.rows.length > 1 && before.get(key)?.rows.join() === grid.rows.join()) {
          fail(`${name} ${wide}px`, `the ${grid.layout} grid "${grid.name}" keeps ${grid.rows.join(', ')} cards a row from ${narrow} px, so it does not rearrange for the wider screen`)
        }
      }
    }
  }
} else {
  console.log(`\nthe dashboard grids were not compared, which needs the widths ${REFLOW_WIDTHS.join(', ')}`)
}

for (const viewport of VIEWPORTS.filter((candidate) => selection.takesWidth(candidate.width))) {
  for (const mode of MODES) {
    for (const theme of THEMES) {
      if (viewport.theme && theme !== viewport.theme) continue
      for (const flow of flows.filter((candidate) => (candidate.viewports ?? ['phone', 'desktop']).includes(viewport.name) && (candidate.modes ?? ['drive', 'browser']).includes(mode.name))) {
        const scope = `${viewport.name} ${mode.name} ${flow.name} ${theme}`
        const context = await browser.createBrowserContext()
        const page = await context.newPage()
        const errors = watchForErrors(page)
        const foreignRequests = watchForForeignRequests(page)
        await page.setViewport({ width: viewport.width, height: viewport.height })
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }])
        const file = (name) => join(SCREENSHOT_DIR, `${viewport.name}-${mode.name}-${name}-${theme}.png`)
        const stateCheck = async (when) => {
          const report = await readPage(page)
          if (report.scrollWidth > report.clientWidth + 1) fail(scope, `${when}: horizontal overflow, scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}`)
          for (const row of report.unevenFieldRows) fail(scope, `${when}: uneven form row: ${row}`)
        }
        try {
          await page.goto(`${BASE}?theme=${theme}${flow.queries?.[mode.name] ?? mode.query}${flow.hash}`, { waitUntil: 'networkidle0' })
          await page.waitForFunction((title) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === title, { timeout: 10_000 }, flow.title)
          await flow.run(page, {
            press: (handle) => handle.click(),
            shoot: async (name) => {
              await stateCheck(name)
              await page.screenshot({ path: file(name) })
            },
            inspect: stateCheck,
          })
          await stateCheck('after the flow')
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
