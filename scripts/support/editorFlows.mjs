/**
 * Add, edit, delete and undo on the row editors, and where the books are kept, shared by the visual
 * and the touch check. `press` clicks or taps an element handle, and `shoot` takes a screenshot
 * under a name. Each flow starts on its screen and leaves the workbook as it found it, except the
 * flows that choose where the books are kept. A failure throws with what was missing.
 */

import { en as companyEnglish, hr as companyCroatian } from '../../src/apps/company/words.ts'
import { FAKE_KEY_SAVED_AT } from '../../src/shared/secrets/infrastructure/fake/fakeSecrets.ts'
import { CHAT_MIN_WIDTH } from '../../src/shared/ai/presentation/chatDock.ts'
import { PAGE_LEAST_WIDTH } from '../../src/shared/layout/viewport.ts'
import { FOOTER_FOLDS_BELOW_HEIGHT, layoutOf, SIDEBAR_WIDTH } from '../../src/shell/ui/sidebarLayout.ts'
import { en as companySettingsEnglish, hr as companySettingsCroatian } from '../../src/apps/company/settings/presentation/words.ts'
import { en as classWordsEnglish, hr as classWordsCroatian } from '../../src/apps/company/packs/hr-doo/preset/presentation/classWords.ts'
import { en as rulesEnglish, hr as rulesCroatian } from '../../src/apps/company/rules/presentation/words.ts'
import { en as ruleChangesEnglish, hr as ruleChangesCroatian } from '../../src/apps/company/rules/domain/words.ts'
import { en as transactionsEnglish, hr as transactionsCroatian } from '../../src/apps/company/transactions/presentation/words.ts'
import { en as companyBooksEnglish, hr as companyBooksCroatian } from '../../src/apps/company/workbook/domain/words.ts'
import { en as importEnglish, hr as importCroatian } from '../../src/apps/company/imports/presentation/words.ts'
import { en as importWritesEnglish, hr as importWritesCroatian } from '../../src/apps/company/imports/application/words.ts'
import { en as onboardingEnglish, hr as onboardingCroatian } from '../../src/apps/company/onboarding/presentation/words.ts'
import { en as settingsReasonsEnglish, hr as settingsReasonsCroatian } from '../../src/apps/company/settings/domain/words.ts'
import { en as booksEnglish, hr as booksCroatian } from '../../src/apps/company/workbook/presentation/words.ts'
import { en as mailEnglish, hr as mailCroatian } from '../../src/apps/company/mail/presentation/words.ts'
import { en as mailPlanEnglish, hr as mailPlanCroatian } from '../../src/shared/mail-filing/presentation/words.ts'
import { en as invoicingEnglish, hr as invoicingCroatian } from '../../src/apps/company/invoicing/presentation/words.ts'
import { en as receivablesEnglish, hr as receivablesCroatian } from '../../src/apps/company/receivables/presentation/words.ts'
import { en as billingEnglish, hr as billingCroatian } from '../../src/apps/company/billingPlan/presentation/words.ts'
import { en as companyOverviewEnglish, hr as companyOverviewCroatian } from '../../src/apps/company/overview/presentation/words.ts'
import { en as ownerShareEnglish, hr as ownerShareCroatian } from '../../src/apps/company/owner-share/presentation/words.ts'
import { en as writesEnglish, hr as writesCroatian } from '../../src/shared/storage/presentation/words.ts'
import { en as storageInfrastructureEnglish, hr as storageInfrastructureCroatian } from '../../src/shared/storage/infrastructure/words.ts'
import { en as bankLoanEnglish, hr as bankLoanCroatian } from '../../src/apps/loans/bankLoans/presentation/words.ts'
import { en as informalLoanEnglish, hr as informalLoanCroatian } from '../../src/apps/loans/informalLoans/presentation/words.ts'
import { en as overviewEnglish, hr as overviewCroatian } from '../../src/apps/loans/overview/presentation/words.ts'
import { en as scenariosEnglish, hr as scenariosCroatian } from '../../src/apps/loans/scenarios/presentation/words.ts'
import { en as loansSettingsEnglish, hr as loansSettingsCroatian } from '../../src/apps/loans/settings/presentation/words.ts'
import { en as packEnglish, hr as packCroatian } from '../../src/apps/company/packs/hr-doo/presentation/words.ts'
import { en as assetsEnglish, hr as assetsCroatian } from '../../src/apps/company/packs/hr-doo/presentation/assets/words.ts'
import { en as salariesEnglish, hr as salariesCroatian } from '../../src/apps/company/packs/hr-doo/presentation/salaries/words.ts'
import { en as payScenariosEnglish, hr as payScenariosCroatian } from '../../src/apps/company/packs/hr-doo/presentation/payScenarios/words.ts'
import { en as forecastEnglish, hr as forecastCroatian } from '../../src/apps/company/packs/hr-doo/presentation/forecast/words.ts'
import { en as loansEnglish, hr as loansCroatian } from '../../src/apps/loans/words.ts'
import { en as investmentsEnglish, hr as investmentsCroatian } from '../../src/apps/investments/words.ts'
import { en as workbookImportEnglish, hr as workbookImportCroatian } from '../../src/apps/investments/imports/presentation/words.ts'
import { en as sharedEnglish, hr as sharedCroatian } from '../../src/shared/app/words.ts'
import { en as homeEnglish, hr as homeCroatian } from '../../src/shell/home/words.ts'
import { en as uiEnglish, hr as uiCroatian } from '../../src/shared/ui/words.ts'
import { en as chartsEnglish, hr as chartsCroatian } from '../../src/shared/charts/words.ts'
import { en as kunaSettingsEnglish, hr as kunaSettingsCroatian } from '../../src/shell/settings/words.ts'
import { en as netWorthEnglish, hr as netWorthCroatian } from '../../src/shell/netWorth/words.ts'
import { en as shellEnglish, hr as shellCroatian } from '../../src/shell/ui/words.ts'
import { en as syncEnglish, hr as syncCroatian } from '../../src/shared/sync/presentation/words.ts'
import { en as storageEnglish, hr as storageCroatian } from '../../src/shared/storage/application/words.ts'
import { en as loansFileEnglish, hr as loansFileCroatian } from '../../src/apps/loans/workbook/presentation/words.ts'
import { en as filesEnglish, hr as filesCroatian } from '../../src/apps/company/workbook-files/presentation/words.ts'
import { en as textEnglish, hr as textCroatian } from '../../src/shared/text/words.ts'
import { en as companyHomeEnglish, hr as companyHomeCroatian } from '../../src/apps/company/home/presentation/words.ts'
import { en as loansHomeEnglish, hr as loansHomeCroatian } from '../../src/apps/loans/home/presentation/words.ts'
import { en as investmentsHomeEnglish, hr as investmentsHomeCroatian } from '../../src/apps/investments/home/presentation/words.ts'
import { en as investmentsOverviewEnglish, hr as investmentsOverviewCroatian } from '../../src/apps/investments/overview/presentation/words.ts'
import { en as assetsAppEnglish, hr as assetsAppCroatian } from '../../src/apps/assets/words.ts'
import { en as assetPageEnglish, hr as assetPageCroatian } from '../../src/apps/assets/asset/presentation/words.ts'
import { en as assetsHomeEnglish, hr as assetsHomeCroatian } from '../../src/apps/assets/home/presentation/words.ts'
import { en as assetsOverviewEnglish, hr as assetsOverviewCroatian } from '../../src/apps/assets/overview/presentation/words.ts'
import { en as assetValuesEnglish, hr as assetValuesCroatian } from '../../src/apps/assets/values/presentation/words.ts'
import { en as assetsFileEnglish, hr as assetsFileCroatian } from '../../src/apps/assets/workbook/presentation/words.ts'
import { en as spendingAppEnglish, hr as spendingAppCroatian } from '../../src/apps/spending/words.ts'
import { en as spendingAssistantEnglish, hr as spendingAssistantCroatian } from '../../src/apps/spending/assistant/words.ts'
import { en as spendingReceiptDomainEnglish, hr as spendingReceiptDomainCroatian } from '../../src/apps/spending/receipts/domain/words.ts'
import { en as spendingScreensEnglish, hr as spendingScreensCroatian } from '../../src/apps/spending/screenWords.ts'
import { en as spendingEntriesEnglish, hr as spendingEntriesCroatian } from '../../src/apps/spending/entries/presentation/words.ts'
import { addDays, today } from '../../src/shared/calendar/civilDate.ts'
import { monthOf } from '../../src/shared/calendar/monthKey.ts'
import { writeJpegWithPlace } from './importSampleFiles.mjs'
import { en as spendingReceiptsEnglish, hr as spendingReceiptsCroatian } from '../../src/apps/spending/receipts/presentation/words.ts'
import { en as spendingReceiptNotesEnglish, hr as spendingReceiptNotesCroatian } from '../../src/apps/spending/receipts/domain/words.ts'
import { en as spendingStatementsEnglish, hr as spendingStatementsCroatian } from '../../src/apps/spending/statements/presentation/words.ts'
import { en as spendingStatementReadingEnglish, hr as spendingStatementReadingCroatian } from '../../src/apps/spending/statements/domain/words.ts'
import { en as spendingAccountsEnglish, hr as spendingAccountsCroatian } from '../../src/apps/spending/accounts/presentation/words.ts'
import { en as spendingBankSyncEnglish, hr as spendingBankSyncCroatian } from '../../src/apps/spending/bankSync/presentation/words.ts'
import { en as spendingBankSyncReadingEnglish, hr as spendingBankSyncReadingCroatian } from '../../src/apps/spending/bankSync/domain/words.ts'
import { en as spendingBudgetsEnglish, hr as spendingBudgetsCroatian } from '../../src/apps/spending/budgets/presentation/words.ts'
import { en as spendingCategoriesEnglish, hr as spendingCategoriesCroatian } from '../../src/apps/spending/categories/presentation/words.ts'
import { en as spendingHomeEnglish, hr as spendingHomeCroatian } from '../../src/apps/spending/home/presentation/words.ts'
import { en as spendingOverviewEnglish, hr as spendingOverviewCroatian } from '../../src/apps/spending/overview/presentation/words.ts'
import { en as spendingFileEnglish, hr as spendingFileCroatian } from '../../src/apps/spending/workbook/presentation/words.ts'
import { starterCategories } from '../../src/apps/spending/categories/domain/starterCategories.ts'
import { formatMoney } from '../../src/shared/money/moneyFormat.ts'
import { openEachMenuIn } from './menuFlows.mjs'
import { settleCharts } from './settleCharts.mjs'
import {
  MADE_UP_ANTHROPIC_KEY,
  TWO_KEYS_ANONYMISE_OFF,
  acceptLooksReady,
  allowIfAsked,
  forgetAssist,
  giveThePageBack,
  keepAiKey,
  newChat,
  openChat,
  panelSettled,
  savedCardEnded,
  savedChatAnswered,
  savedChatGone,
  sendInChat,
} from './chatFlows.mjs'
import { delay, pressSelector, typeDay } from './pressing.mjs'
import { scrollbarGutter, shellRoom } from './shellFlows.mjs'
import { en as mailFilingEnglish, hr as mailFilingCroatian } from '../../src/shared/mail-filing/application/words.ts'
import { en as assistEnglish, hr as assistCroatian } from '../../src/shared/ai/presentation/words.ts'
import { en as secretsEnglish, hr as secretsCroatian } from '../../src/shared/secrets/presentation/words.ts'

const TOAST = 'li[data-slot="base"]'

/**
 * Scrolls what `target` names, a selector or an element, into view at `block` and shoots `name`. It fails when the element
 * is still not wholly in view, or fills less of the page than it could, so a shot shows what it is taken for. `inspected`
 * runs once it is in view, for a check whose own shoot does not inspect the page.
 */
export async function shootAt(page, shoot, target, name, { block = 'center', inspected } = {}) {
  const element =
    typeof target === 'string'
      ? await page.waitForSelector(target, { visible: true, timeout: 10_000 }).catch(() => {
          throw new Error(`${name}: nothing shows ${target} to shoot`)
        })
      : target
  await element.evaluate((shown, at) => shown.scrollIntoView({ block: at, inline: 'nearest' }), block)
  await delay(300)
  const inView = await element.evaluate((shown) => {
    const box = shown.getBoundingClientRect()
    const fits = (start, end, room) => Math.min(end, room) - Math.max(start, 0) >= Math.min(end - start, room) - 1
    return box.width > 0 && box.height > 0 && fits(box.top, box.bottom, innerHeight) && fits(box.left, box.right, innerWidth)
  })
  if (!inView) throw new Error(`${name}: ${typeof target === 'string' ? target : 'the element it is taken for'} is off screen, so the shot would not show it`)
  await inspected?.()
  await shoot(name)
}

/** The starter categories' names in a language by their English names, as a new Spending file and the fake sets name them. */
function spendingStarterIn(language) {
  const english = starterCategories('en')
  const named = starterCategories(language)
  return Object.fromEntries(english.map((category, place) => [category.name, named[place].name]))
}

/** What the menus, the Loans screens and the Company screens say in each language, from the app's own words. */
const SCREEN_WORDS = {
  en: {
    allApps: sharedEnglish.allApps,
    homeLink: sharedEnglish.homeLink,
    setUp: homeEnglish.setUp,
    kunaSettings: kunaSettingsEnglish.menu,
    netWorth: netWorthEnglish.title,
    addApp: shellEnglish.navigation.addApp,
    filesHome: kunaSettingsEnglish.filesHome,
    home: homeEnglish,
    company: companyEnglish.name,
    companySettings: companySettingsEnglish.title,
    loans: loansEnglish.name,
    investments: investmentsEnglish.name,
    overview: overviewEnglish.title,
    scenarios: scenariosEnglish.title,
    companyOverview: companyOverviewEnglish.title,
    ownerShare: ownerShareEnglish,
    loansSettings: loansSettingsEnglish.title,
    firstRateHelp: bankLoanEnglish.ratePeriodDialog.firstHelp,
    laterRateHelp: bankLoanEnglish.ratePeriodDialog.laterHelp,
    planFromHelp: informalLoanEnglish.loanDialog.planFromHelp,
    whatIf: bankLoanEnglish.whatIf,
    savedTries: bankLoanEnglish.savedTries,
    repayments: bankLoanEnglish.loanDialog.repayments,
    transactions: transactionsEnglish,
    rules: rulesEnglish,
    ruleChanges: ruleChangesEnglish.changes,
    categoryName: companyBooksEnglish.unlabelled,
    swatches: chartsEnglish.swatches,
    sortBy: uiEnglish.sortBy,
    splitEditor: uiEnglish.split,
    imports: importEnglish,
    mail: mailEnglish,
    mailPlan: mailPlanEnglish.plan,
    invoicing: invoicingEnglish,
    receivables: receivablesEnglish,
    billing: billingEnglish,
    clientColumns: companySettingsEnglish.clientColumns,
    settings: companySettingsEnglish,
    classes: classWordsEnglish.classes,
    settingsReasons: settingsReasonsEnglish,
    onboarding: onboardingEnglish,
    books: booksEnglish,
    importWrites: importWritesEnglish,
    writes: writesEnglish,
    pack: packEnglish,
    assets: assetsEnglish,
    salaries: salariesEnglish,
    payScenarios: payScenariosEnglish,
    forecast: forecastEnglish,
    sync: syncEnglish,
    loansOverview: overviewEnglish,
    loansFile: loansFileEnglish,
    storage: storageEnglish,
    files: filesEnglish,
    myDrive: textEnglish.myDrive,
    mailFiled: /Filed \d+/,
    companyHome: companyHomeEnglish,
    mailCounts: mailFilingEnglish.counts,
    loansHome: loansHomeEnglish,
    investmentsHome: investmentsHomeEnglish,
    investmentsOverview: investmentsOverviewEnglish.title,
    assetsApp: assetsAppEnglish.name,
    assetsHome: assetsHomeEnglish,
    assetsOverview: assetsOverviewEnglish,
    assetPage: assetPageEnglish,
    assetValues: assetValuesEnglish,
    assetsFile: assetsFileEnglish,
    spendingApp: spendingAppEnglish.name,
    spendingScreens: spendingScreensEnglish,
    spendingEntries: spendingEntriesEnglish,
    spendingStatements: spendingStatementsEnglish,
    spendingReceipts: spendingReceiptsEnglish,
    spendingReceiptNotes: spendingReceiptNotesEnglish,
    spendingStatementReading: spendingStatementReadingEnglish,
    spendingAccounts: spendingAccountsEnglish,
    spendingBankSync: spendingBankSyncEnglish,
    spendingBankSyncReading: spendingBankSyncReadingEnglish,
    spendingBudgets: spendingBudgetsEnglish,
    spendingCategories: spendingCategoriesEnglish,
    spendingHome: spendingHomeEnglish,
    spendingOverview: spendingOverviewEnglish,
    spendingFile: spendingFileEnglish,
    spendingStarter: spendingStarterIn('en'),
    locale: 'en-GB',
  },
  hr: {
    allApps: sharedCroatian.allApps,
    homeLink: sharedCroatian.homeLink,
    setUp: homeCroatian.setUp,
    kunaSettings: kunaSettingsCroatian.menu,
    netWorth: netWorthCroatian.title,
    addApp: shellCroatian.navigation.addApp,
    filesHome: kunaSettingsCroatian.filesHome,
    home: homeCroatian,
    company: companyCroatian.name,
    companySettings: companySettingsCroatian.title,
    loans: loansCroatian.name,
    investments: investmentsCroatian.name,
    overview: overviewCroatian.title,
    scenarios: scenariosCroatian.title,
    companyOverview: companyOverviewCroatian.title,
    ownerShare: ownerShareCroatian,
    loansSettings: loansSettingsCroatian.title,
    firstRateHelp: bankLoanCroatian.ratePeriodDialog.firstHelp,
    laterRateHelp: bankLoanCroatian.ratePeriodDialog.laterHelp,
    planFromHelp: informalLoanCroatian.loanDialog.planFromHelp,
    whatIf: bankLoanCroatian.whatIf,
    savedTries: bankLoanCroatian.savedTries,
    repayments: bankLoanCroatian.loanDialog.repayments,
    transactions: transactionsCroatian,
    rules: rulesCroatian,
    ruleChanges: ruleChangesCroatian.changes,
    categoryName: companyBooksCroatian.unlabelled,
    swatches: chartsCroatian.swatches,
    sortBy: uiCroatian.sortBy,
    splitEditor: uiCroatian.split,
    imports: importCroatian,
    mail: mailCroatian,
    mailPlan: mailPlanCroatian.plan,
    invoicing: invoicingCroatian,
    receivables: receivablesCroatian,
    billing: billingCroatian,
    clientColumns: companySettingsCroatian.clientColumns,
    settings: companySettingsCroatian,
    classes: classWordsCroatian.classes,
    settingsReasons: settingsReasonsCroatian,
    onboarding: onboardingCroatian,
    books: booksCroatian,
    importWrites: importWritesCroatian,
    writes: writesCroatian,
    pack: packCroatian,
    assets: assetsCroatian,
    salaries: salariesCroatian,
    payScenarios: payScenariosCroatian,
    forecast: forecastCroatian,
    sync: syncCroatian,
    loansOverview: overviewCroatian,
    loansFile: loansFileCroatian,
    storage: storageCroatian,
    files: filesCroatian,
    myDrive: textCroatian.myDrive,
    mailFiled: /Spremljeno \d+/,
    companyHome: companyHomeCroatian,
    mailCounts: mailFilingCroatian.counts,
    loansHome: loansHomeCroatian,
    investmentsHome: investmentsHomeCroatian,
    investmentsOverview: investmentsOverviewCroatian.title,
    assetsApp: assetsAppCroatian.name,
    assetsHome: assetsHomeCroatian,
    assetsOverview: assetsOverviewCroatian,
    assetPage: assetPageCroatian,
    assetValues: assetValuesCroatian,
    assetsFile: assetsFileCroatian,
    spendingApp: spendingAppCroatian.name,
    spendingScreens: spendingScreensCroatian,
    spendingEntries: spendingEntriesCroatian,
    spendingStatements: spendingStatementsCroatian,
    spendingReceipts: spendingReceiptsCroatian,
    spendingReceiptNotes: spendingReceiptNotesCroatian,
    spendingStatementReading: spendingStatementReadingCroatian,
    spendingAccounts: spendingAccountsCroatian,
    spendingBankSync: spendingBankSyncCroatian,
    spendingBankSyncReading: spendingBankSyncReadingCroatian,
    spendingBudgets: spendingBudgetsCroatian,
    spendingCategories: spendingCategoriesCroatian,
    spendingHome: spendingHomeCroatian,
    spendingOverview: spendingOverviewCroatian,
    spendingFile: spendingFileCroatian,
    spendingStarter: spendingStarterIn('hr'),
    locale: 'hr-HR',
  },
}

/** A pattern that matches the whole of `text` and nothing else. */
function exactly(text) {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

/** A pattern for a counted phrase of the app's words with any count, given its forms as they read for 1000. */
function anyCount(forms) {
  return new RegExp(
    `^(?:${Object.values(forms)
      .map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('1000', '\\d+'))
      .join('|')})$`,
  )
}

/** The form of a counted phrase from the app's words that the language writes `count` with. */
function countedIn(words, forms, count) {
  return forms[new Intl.PluralRules(words.locale).select(count)] ?? forms.other
}

/** Sets a field the way typing does, so Vue's v-model sees it. */
async function setField(input, value) {
  if ((await input.$('[data-segment="day"]')) !== null) return typeDay(input, value)
  await input.evaluate((element, text) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

/** The row of an editor table whose first field reads `name`. */
async function rowNamed(page, rowSelector, name) {
  return page
    .waitForFunction((selector, wanted) => [...document.querySelectorAll(selector)].find((row) => row.querySelector('input')?.value === wanted) ?? null, { timeout: 10_000 }, rowSelector, name)
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no ${rowSelector} named "${name}"`)
    })
}

async function rowGone(page, rowSelector, name) {
  await page
    .waitForFunction((selector, wanted) => ![...document.querySelectorAll(selector)].some((row) => row.querySelector('input')?.value === wanted), { timeout: 10_000 }, rowSelector, name)
    .catch(() => {
      throw new Error(`the ${rowSelector} named "${name}" is still there`)
    })
}

async function fieldIn(row, label) {
  const input = await row.$(`input[aria-label="${label}"], [data-slot="base"][aria-label="${label}"]`)
  if (input === null) throw new Error(`no field "${label}" in the row`)
  return input
}

async function choose(page, press, trigger, option) {
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(150)
  await press(trigger)
  const handle = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim() === wanted) ?? null, { timeout: 5_000 }, option)
    .catch(() => {
      throw new Error(`no option "${option}"`)
    })
  await press(handle.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

/** Waits for a toast with this title, which must be the only one, since earlier ones were dismissed. */
async function toast(page, title) {
  await page
    .waitForFunction(
      (selector, wanted) => [...document.querySelectorAll(`${selector} [data-slot="title"]`)].some((element) => element.textContent?.trim() === wanted),
      { timeout: 10_000 },
      TOAST,
      title,
    )
    .catch(async () => {
      const shown = await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((element) => element.textContent?.trim()).join(' | '), TOAST)
      throw new Error(`no "${title}" toast within 10 s, the toasts say: ${shown || 'nothing'}`)
    })
  // The toast rises into place. A tap before it settles lands where it was.
  await delay(600)
}

async function dismissToasts(page) {
  await page.evaluate((selector) => {
    for (const close of document.querySelectorAll(`${selector} button[data-slot="close"]`)) close.click()
  }, TOAST)
  await page
    .waitForFunction((selector) => document.querySelectorAll(selector).length === 0, { timeout: 5_000 }, TOAST)
    .catch(() => {
      throw new Error('the toasts did not close')
    })
}

/** Presses Undo on the one toast that offers it and waits for "Undone". */
async function undo(page, press) {
  const button = await page
    .waitForFunction((selector) => [...document.querySelectorAll(`${selector} button`)].find((element) => element.textContent?.trim() === 'Undo') ?? null, { timeout: 5_000 }, TOAST)
    .catch(() => {
      throw new Error('no toast offers Undo')
    })
  await press(button.asElement())
  await toast(page, 'Undone')
}

/**
 * Opens the colour pop-up of a categories row, checks its nine 44 px swatches after Bucket colour,
 * moves through them with the arrow keys, and picks `name`. Leaves the pop-up open.
 */
async function pickCategoryColour(page, press, row, words, name) {
  await press(await row.$('[data-testid="colour-swatch-button"]'))
  await page.waitForSelector('[data-testid="colour-swatch-picker"]', { visible: true })
  await delay(300)
  const radios = await page.$$eval('[data-testid="colour-swatch-picker"] [role="radio"]', (elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { name: element.getAttribute('aria-label'), width: box.width, height: box.height, checked: element.getAttribute('aria-checked') === 'true' }
    }),
  )
  const names = radios.map((radio) => radio.name).join(', ')
  if (names !== [words.settings.categories.bucketColour, ...Object.values(words.swatches)].join(', ')) throw new Error(`the colour pop-up offers ${names}`)
  const small = radios.filter((radio) => radio.width < 43.5 || radio.height < 43.5)
  if (small.length > 0) throw new Error(`swatches under 44 px: ${small.map((radio) => `${radio.name} ${Math.round(radio.width)}x${Math.round(radio.height)}`).join(', ')}`)
  if (!radios[0].checked) throw new Error('a new category does not start on Bucket colour')

  await page.focus('[data-testid="colour-swatch-picker"] [role="radio"][aria-checked="true"]')
  // The radio group checks the radio an arrow focuses only while the key is still down, as a finger on a key holds it.
  await page.keyboard.press('ArrowRight', { delay: 60 })
  await page.keyboard.press('ArrowRight', { delay: 60 })
  await page
    .waitForFunction(
      (orange) => document.activeElement?.getAttribute('aria-label') === orange && document.activeElement?.getAttribute('aria-checked') === 'true',
      { timeout: 5_000 },
      words.swatches.orange,
    )
    .catch(() => {
      throw new Error('two presses of the right arrow from Bucket colour did not check Orange')
    })

  await press(await page.$(`[data-testid="colour-swatch-picker"] [role="radio"][aria-label="${name}"]`))
  await page
    .waitForFunction(
      (wanted) => document.querySelector(`[data-testid="colour-swatch-picker"] [role="radio"][aria-label="${wanted}"]`)?.getAttribute('aria-checked') === 'true',
      { timeout: 5_000 },
      name,
    )
    .catch(() => {
      throw new Error(`pressing ${name} did not pick it`)
    })
}

/** The selector of a categories row's "Tax class" menu. */
async function classSelectIn(row) {
  return `[data-position="${await row.evaluate((element) => element.getAttribute('data-position'))}"] [data-testid="category-class"]`
}

/** Picks a role in a categories row's menu of roles and checks it shows as a chip. */
async function chooseRole(page, press, row, role) {
  const trigger = await row.$('[data-testid="category-roles"]')
  if (trigger === null) throw new Error('no roles menu in the row')
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }))
  await delay(150)
  await press(trigger)
  const option = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim() === wanted) ?? null, { timeout: 5_000 }, role)
    .catch(() => {
      throw new Error(`the roles menu offers no "${role}"`)
    })
  await press(option.asElement())
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  const chips = await trigger.evaluate((element) => element.textContent?.trim() ?? '')
  if (chips !== role) throw new Error(`the roles menu shows "${chips}" after picking ${role}`)
}

/**
 * Categories: add stationery, which scrolls the table to the new row under its sticky header and
 * focuses its name and waits on how Kuna counts it, count it as a deductible cost, give it a colour
 * from the pop-up, a label on a tab without the column, representation, which sets its VAT and locks
 * it, and a role, delete it, and Undo the delete.
 */
export function categoryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.settings.categories
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="add-category"]')
    await page
      .waitForFunction(
        (name) => {
          const added = [...document.querySelectorAll('[data-testid="category-row"]')].at(-1)
          const frame = document.querySelector('[data-testid="categories-frame"]')
          const header = frame?.querySelector('thead th')
          if (!added || !frame || !header || document.activeElement !== added.querySelector(`input[aria-label="${name}"]`)) return false
          const frameBox = frame.getBoundingClientRect()
          const rowBox = added.getBoundingClientRect()
          return frame.scrollTop > 0 && Math.abs(header.getBoundingClientRect().top - frameBox.top) < 1 && rowBox.top >= frameBox.top && rowBox.bottom <= frameBox.bottom + 1
        },
        { timeout: 5_000 },
        said.columns.category,
      )
      .catch(() => {
        throw new Error('Add category did not scroll the table to the new row under its header and focus its name')
      })
    const added = (await page.$$('[data-testid="category-row"]')).at(-1)
    await setField(await fieldIn(added, said.columns.category), 'stationery')
    await setField(await fieldIn(added, said.columns.family), 'operating')
    await delay(200)
    await shoot('categories-draft')
    await chooseStartingWith(page, press, await classSelectIn(added), words.classes.deductibleCost)
    await shoot('categories-class')
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await shoot('categories-saved')
    await dismissToasts(page)

    await pickCategoryColour(page, press, await rowNamed(page, '[data-testid="category-row"]', 'stationery'), words, words.swatches.blue)
    const note = await page.$eval('[data-testid="colour-swatch-note"]', (element) => element.textContent?.trim() ?? '')
    const others = new Intl.ListFormat(words.locale, { type: 'conjunction' }).format([words.categoryName('travel'), words.categoryName('software-subscriptions')])
    if (note !== said.colourShared(words.swatches.blue, others)) throw new Error(`the colour pop-up says "${note}"`)
    await shoot('categories-colour')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="colour-swatch-picker"]'), { timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await dismissToasts(page)

    const named = await rowNamed(page, '[data-testid="category-row"]', 'stationery')
    await setField(await fieldIn(named, said.columns.label), 'Paper and pens')
    await chooseStartingWith(page, press, await classSelectIn(named), words.classes.representation('').split(':')[0])
    const vat = await named.$('[data-testid="category-vat"]')
    const locked = await vat.evaluate((element) => ({ disabled: element.hasAttribute('disabled') || element.getAttribute('data-disabled') !== null, shown: element.textContent?.trim() ?? '' }))
    if (!locked.disabled || locked.shown !== said.vatTreatments.representation) throw new Error(`representation leaves the VAT select ${locked.disabled ? 'locked' : 'open'} at "${locked.shown}"`)
    await shoot('categories-class-vat-locked')
    await pressSelector(page, press, `${(await classSelectIn(named)).split(' ')[0]} [aria-label="${said.columns.bucket}"]`)
    const buckets = await page.$$eval('[role="option"]', (options) => options.map((option) => option.textContent?.trim() ?? ''))
    if (buckets.join() !== said.bucketChoice('operating')) throw new Error(`the bucket menu of representation offers ${buckets.join(', ')}`)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await chooseStartingWith(page, press, await classSelectIn(named), words.classes.personalTransport('', '').split(':')[0])
    const refused = await named.$$eval('.field-error', (errors) => errors.map((error) => error.textContent?.trim() ?? ''))
    if (!refused.some((error) => error.includes(said.vatTreatments['car-50'])) || (await page.$eval('[data-testid="save-categories"]', (button) => !button.disabled))) {
      throw new Error(`personal transport with representation VAT shows ${refused.join(' | ') || 'no error'} and leaves Save open`)
    }
    await shoot('categories-class-vat-error')
    await chooseStartingWith(page, press, await classSelectIn(named), words.classes.representation('').split(':')[0])
    await chooseRole(page, press, named, 'watched')
    await shoot('categories-label-and-role')
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await dismissToasts(page)

    const row = await rowNamed(page, '[data-testid="category-row"]', 'stationery')
    await press(await row.$('[data-testid="remove-category"]'))
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await rowGone(page, '[data-testid="category-row"]', 'stationery')
    await undoIn(page, press, words)
    const back = await rowNamed(page, '[data-testid="category-row"]', 'stationery')
    const colour = await (await back.$('[data-testid="colour-swatch-button"]')).evaluate((button) => button.getAttribute('aria-label'))
    if (colour !== `${said.colourOf('Paper and pens')}: ${words.swatches.blue}`) throw new Error(`Undo brought stationery back as "${colour}"`)
    await dismissToasts(page)
  }
}

export const categoryFlow = categoryFlowIn('en')

/** Presses the category picker under `trigger` and picks the option that names `slug`. */
async function pickCategoryNamed(page, press, trigger, slug) {
  await pressSelector(page, press, trigger)
  const option = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.includes(wanted)) ?? null, { timeout: 5_000 }, slug)
    .catch(() => {
      throw new Error(`the picker offers no category ${slug}`)
    })
  await option.asElement().evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(option.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(300)
}

/**
 * On Settings, Categories of the books with the `category-move` plan rows: the bin of a category in use opens the move dialog. It
 * shows nothing picked, a target in the same bucket with what moves, a target in another bucket with the warning, and the save
 * lands with a toast and Undo. AI services into software subscriptions says its plan row joins the one already there, and the
 * save lands. Travel, which a plan row the plan tab cannot read still names, gets the warning with a button to Year, Plan and
 * Close only, the bin of a category in use waits while the table has unsaved edits, and the button opens Year on its Plan tab.
 */
export function categoryMoveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.settings.categories
  const moved = said.moveAndDelete
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const dialog = '[role="dialog"] [data-testid="category-move"]'
    const openMove = async (slug) => {
      const row = await rowNamed(page, '[data-testid="category-row"]', slug)
      await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await delay(200)
      await press(await row.$('[data-testid="remove-category"]'))
    }

    await openMove('bank-fees')
    await page.waitForSelector(dialog, { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('category move, nothing picked')
    await shoot('category-move')

    await pickCategoryNamed(page, press, '[data-testid="category-move-into"]', 'software-subscriptions')
    await elementSays(page, dialog, [moved.moves('').split('.')[0].split(' ')[0]], 'the move dialog does not say what moves')
    if ((await page.$('[data-testid="category-move-buckets"]')) !== null) throw new Error('a target in the same bucket shows the bucket warning')
    await inspect?.('category move, same bucket')
    await shoot('category-move-picked')

    await pickCategoryNamed(page, press, '[data-testid="category-move-into"]', 'internal-transfer')
    await page.waitForSelector('[data-testid="category-move-buckets"]', { visible: true, timeout: 5_000 })
    await inspect?.('category move, other bucket')
    await shoot('category-move-buckets')

    await pickCategoryNamed(page, press, '[data-testid="category-move-into"]', 'software-subscriptions')
    await pressSelector(page, press, '[data-testid="confirm-category-move"]')
    await dialogGone(page, '[data-testid="category-move"]')
    await page.waitForFunction(
      (selector, start) => [...document.querySelectorAll(`${selector} [data-slot="title"]`)].some((element) => element.textContent?.trim().startsWith(start)),
      { timeout: 10_000 },
      TOAST,
      moved.deleted('', '').slice(0, 7),
    )
    await delay(400)
    await shoot('category-moved')
    await rowGone(page, '[data-testid="category-row"]', 'bank-fees')
    await undoIn(page, press, words)
    await rowNamed(page, '[data-testid="category-row"]', 'bank-fees')
    await shoot('category-move-undone')
    await dismissToasts(page)

    await openMove('ai-services')
    await page.waitForSelector(dialog, { visible: true, timeout: 10_000 })
    await pickCategoryNamed(page, press, '[data-testid="category-move-into"]', 'software-subscriptions')
    await elementSays(page, '[data-testid="category-move-joined"]', [words.pack.categoryNaming.planRowsJoined(1).one], 'the move dialog does not say the plan row joins the one already there')
    await delay(300)
    await inspect?.('category move, plan row joins')
    await shoot('category-move-joined')
    await pressSelector(page, press, '[data-testid="confirm-category-move"]')
    await dialogGone(page, '[data-testid="category-move"]')
    await rowGone(page, '[data-testid="category-row"]', 'ai-services')
    await undoIn(page, press, words)
    await rowNamed(page, '[data-testid="category-row"]', 'ai-services')
    await dismissToasts(page)

    await openMove('travel')
    await page.waitForSelector('[role="dialog"] [data-testid="category-move-kept"]', { visible: true, timeout: 10_000 })
    await elementSays(page, '[data-testid="category-move-fix-on"]', [words.pack.links.yearPlan], 'the blocked move does not link the screen that fixes the plan row')
    if ((await page.$('[data-testid="confirm-category-move"]')) !== null || (await page.$('[data-testid="category-move-into"]')) !== null)
      throw new Error('the blocked move dialog still offers a move')
    await delay(300)
    await inspect?.('category move, blocked')
    await shoot('category-move-blocked')
    await pressButton(page, press, '[role="dialog"] button', moved.close)
    await dialogGone(page, '[data-testid="category-move-kept"]')

    const named = await rowNamed(page, '[data-testid="category-row"]', 'telecom')
    await setField(await fieldIn(named, said.columns.label), 'Phone and internet')
    const bin = await (await rowNamed(page, '[data-testid="category-row"]', 'bank-fees')).$('[data-testid="remove-category"]')
    const waits = await bin.evaluate((button) => button.hasAttribute('disabled') || button.getAttribute('data-disabled') !== null)
    if (!waits) throw new Error('the bin of a category in use stays on while the table has unsaved edits')
    await pressButton(page, press, 'button', said.discard)

    await openMove('travel')
    await pressSelector(page, press, '[role="dialog"] [data-testid="category-move-fix-on"]')
    await page
      .waitForFunction(() => location.hash.startsWith('#/company/year') && location.hash.includes('tab=plan') && !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('the blocked move’s link does not open Year on its Plan tab with the dialog closed')
      })
  }
}

export const categoryMoveFlow = categoryMoveFlowIn('en')

/** On a phone, the rule editor opened from a review row shows the box that says Save files the rows it settles. */
export function ruleWaitingFlowIn(language) {
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await press(await queueRow(page, 'GADGET CORNER'))
    await pressSelector(page, press, '[data-testid="make-rule"]')
    await shootAt(page, shoot, '[data-testid="rule-files-waiting"]', 'rule-waiting')
  }
}

export const ruleWaitingFlow = ruleWaitingFlowIn('en')

/** The names of the categories rows on screen, in their order. */
function categoriesShown(page) {
  return page.$$eval('[data-testid="category-row"]', (rows) => rows.map((row) => row.querySelector('input')?.value ?? ''))
}

async function categoriesShow(page, wanted, why) {
  await page
    .waitForFunction(
      (names) => JSON.stringify([...document.querySelectorAll('[data-testid="category-row"]')].map((row) => row.querySelector('input')?.value ?? '')) === JSON.stringify(names),
      { timeout: 5_000 },
      wanted,
    )
    .catch(async () => {
      throw new Error(`${why}: the table shows ${(await categoriesShown(page)).join(', ')}`)
    })
}

async function categoryCountSays(page, wanted) {
  await page
    .waitForFunction((text) => document.querySelector('[data-testid="category-count"]')?.textContent?.trim() === text, { timeout: 5_000 }, wanted)
    .catch(async () => {
      throw new Error(`the count says "${await page.$eval('[data-testid="category-count"]', (element) => element.textContent?.trim())}", not "${wanted}"`)
    })
}

/**
 * Waits for the count of `shown` of `total` categories. A Croatian count picks the plural of its
 * last word by the rules of the language a script runs in, which is English, so in Croatian only
 * the words before it are compared.
 */
async function categoryCountShows(page, words, shown, total) {
  const said = words.settings.categories.shownOf(shown, total)
  if (words.locale === 'en-GB') return categoryCountSays(page, said)
  const start = said.slice(0, said.lastIndexOf(' ') + 1)
  await page
    .waitForFunction((text) => document.querySelector('[data-testid="category-count"]')?.textContent?.trim().startsWith(text), { timeout: 5_000 }, start)
    .catch(async () => {
      throw new Error(`the count says "${await page.$eval('[data-testid="category-count"]', (element) => element.textContent?.trim())}", not "${start}…"`)
    })
}

/** Picks a bucket in the categories filters, from the sheet behind the Filters button on a phone. */
async function filterCategoriesByBucket(page, press, words, bucket) {
  const sheet = await page.$('[data-testid="open-category-filters"]')
  if (sheet !== null) {
    await press(sheet)
    await page.waitForSelector('[role="dialog"] [data-testid="category-bucket-filter"]', { visible: true, timeout: 5_000 })
    await delay(400)
  }
  await choose(page, press, await page.$('[data-testid="category-bucket-filter"]'), bucket)
  if (sheet !== null) {
    const close = await page.waitForFunction(
      (label) => [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === label) ?? null,
      {},
      words.settings.categories.show,
    )
    await press(close.asElement())
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
    await delay(300)
  }
}

async function sortDirection(page, sortLabel) {
  return page.$eval(`th:has(> button[aria-label="${sortLabel}"])`, (header) => header.getAttribute('aria-sort'))
}

/**
 * Categories, found and sorted: a search with its count, the taxes bucket sorted by name with a
 * press and then the keyboard, and an edit while filtered and sorted by family. The row stays in
 * place while it is typed in, stays in view with its error once its new bucket leaves the filter,
 * leaves the list once saved and comes back with Undo.
 */
export function categoryFiltersFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.settings.categories
  const all = countedIn(words, said.count(33), 33)
  const byCategory = words.sortBy(said.columns.category)
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('input[data-testid="category-search"]', { visible: true })
    await categoryCountSays(page, all)
    await setField(await page.$('input[data-testid="category-search"]'), 'reimbursement')
    await categoriesShow(page, ['reimbursement-to-owner', 'reimbursement-from-owner'], 'a search for reimbursement')
    await categoryCountShows(page, words, 2, 33)
    await shoot('categories-search')
    await pressSelector(page, press, `[data-testid="category-filters"] button[aria-label="${said.clearSearch}"]`)
    await categoryCountSays(page, all)

    await filterCategoriesByBucket(page, press, words, words.settings.categories.bucketChoice('taxes'))
    await categoriesShow(page, ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax'], 'the taxes bucket in the tab order')
    await categoryCountShows(page, words, 5, 33)
    await pressSelector(page, press, `button[aria-label="${byCategory}"]`)
    await categoriesShow(page, ['corporate-income-tax', 'dividend-tax', 'payroll-contributions', 'payroll-tax', 'tax-refund'], 'a press on Category')
    if ((await sortDirection(page, byCategory)) !== 'ascending') throw new Error('the Category header does not say it sorts ascending')
    await page.focus(`button[aria-label="${byCategory}"]`)
    await page.keyboard.press('Enter')
    await categoriesShow(page, ['tax-refund', 'payroll-tax', 'payroll-contributions', 'dividend-tax', 'corporate-income-tax'], 'Enter on Category')
    if ((await sortDirection(page, byCategory)) !== 'descending') throw new Error('the Category header does not say it sorts descending')
    await shoot('categories-sorted')
    await page.keyboard.press('Space')
    await categoriesShow(page, ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax'], 'a third press on Category')
    if ((await sortDirection(page, byCategory)) !== null) throw new Error('the Category header still says it sorts')

    const byFamily = words.sortBy(said.columns.family)
    await pressSelector(page, press, `button[aria-label="${byFamily}"]`)
    const order = ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax']
    await categoriesShow(page, order, 'a press on Family')
    // The dividend tax's class sits in owner pay or taxes, so the row can leave the taxes filter without another class.
    const moved = 'dividend-tax'
    const row = await rowNamed(page, '[data-testid="category-row"]', moved)
    await setField(await fieldIn(row, said.columns.family), '')
    await page
      .waitForFunction(
        (required, at) => [...document.querySelectorAll('[data-testid="category-row"]')][at]?.querySelector('.field-error')?.textContent?.trim() === required,
        { timeout: 5_000 },
        words.settingsReasons.fields.required,
        order.indexOf(moved),
      )
      .catch(() => {
        throw new Error('a blank family shows no error while the table is filtered and sorted')
      })
    if (!(await page.$eval('[data-testid="save-categories"]', (button) => button.disabled))) throw new Error('Save is on while a row is in error')
    await setField(await fieldIn(row, said.columns.family), 'zz-payouts')
    await delay(200)
    await categoriesShow(page, order, 'typing a family that sorts last')
    await choose(page, press, await row.$(`[aria-label="${said.columns.bucket}"]`), said.bucketChoice('owner-pay'))
    await categoriesShow(page, order, 'a new bucket outside the filter')
    await page
      .waitForFunction((kept) => document.querySelector('[data-testid="category-kept"]')?.textContent?.trim() === kept, { timeout: 5_000 }, countedIn(words, said.kept(1), 1))
      .catch(() => {
        throw new Error('the count does not say a row shows only for its unsaved change')
      })
    await shoot('categories-edit-filtered')

    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await categoriesShow(page, ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax'], 'dividend-tax saved in the owner-pay bucket')
    await undoIn(page, press, words)
    await categoriesShow(page, order, 'Undo of the save')
    if ((await sortDirection(page, byFamily)) !== 'ascending') throw new Error('the sort by family did not outlast the save')
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="clear-category-filters"]')
    await categoryCountSays(page, all)
  }
}

export const categoryFiltersFlow = categoryFiltersFlowIn('en')

/** Owner: change the newest advance's description, delete it, and Undo the delete. */
export function advanceFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.pack.advanceDialog
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const first = async () => (await page.waitForSelector('[data-testid="advance-list"] li', { visible: true, timeout: 10_000 })).evaluate((element) => element.textContent ?? '')
    await pressSelector(page, press, '[data-testid="advance-edit"]')
    await page.waitForSelector('[data-testid="add-advance"]', { visible: true })
    const description = await page.waitForSelector(`[data-testid="add-advance"] input[placeholder="${said.forWhatPlaceholder}"]`)
    await setField(description, 'Train tickets, changed')
    await delay(200)
    await shoot('advance-edit')
    await pressSelector(page, press, 'button[form="add-advance"]')
    await toast(page, said.changed)
    await dialogGone(page, '[data-testid="add-advance"]')
    if (!(await first()).includes('Train tickets, changed')) throw new Error('the changed advance does not show its new description')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="advance-edit"]')
    await pressSelector(page, press, '[data-testid="advance-delete"]')
    await toast(page, said.deleted)
    await dialogGone(page, '[data-testid="add-advance"]')
    if ((await first()).includes('Train tickets, changed')) throw new Error('the deleted advance is still listed')
    await undoIn(page, press, words)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="advance-list"] li')?.textContent?.includes('Train tickets, changed') ?? false, { timeout: 10_000 })
      .catch(() => {
        throw new Error('Undo did not bring the advance back')
      })
    await dismissToasts(page)
  }
}

export const advanceFlow = advanceFlowIn('en')

/** Assets: add a monitor, note it, delete it, and Undo the delete. */
export function assetFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const columns = words.pack.assetColumns
  const saved = words.assets.panel.assetsSaved
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '#asset-rows [data-testid="add-row"]')
    const added = (await page.$$('#asset-rows [data-testid="fact-row"]')).at(-1)
    await setField(await fieldIn(added, columns.asset), 'Monitor')
    await setField(await fieldIn(added, columns.bought), '2026-10-01')
    await setField(await fieldIn(added, columns.cost_net), '420')
    await choose(page, press, await added.$(`[aria-label="${columns.group}"]`), columns.groups.computers)
    await shoot('assets-draft')
    await pressSelector(page, press, '#asset-rows [data-testid="save-rows"]')
    await toast(page, saved)
    await dismissToasts(page)

    await setField(await fieldIn(await rowNamed(page, '#asset-rows [data-testid="fact-row"]', 'Monitor'), columns.note), 'Second screen')
    await pressSelector(page, press, '#asset-rows [data-testid="save-rows"]')
    await toast(page, saved)
    await shoot('assets-saved')
    await dismissToasts(page)

    const row = await rowNamed(page, '#asset-rows [data-testid="fact-row"]', 'Monitor')
    await press(await row.$('[data-testid="remove-row"]'))
    await pressSelector(page, press, '#asset-rows [data-testid="save-rows"]')
    await toast(page, saved)
    await rowGone(page, '#asset-rows [data-testid="fact-row"]', 'Monitor')
    await undoIn(page, press, words)
    await rowNamed(page, '#asset-rows [data-testid="fact-row"]', 'Monitor')
    await dismissToasts(page)
  }
}

export const assetFlow = assetFlowIn('en')

/** Salaries: add an employee, change the dependants, delete the row, and Undo the delete. */
export function employeeFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const columns = words.pack.employeeColumns
  const saved = words.salaries.screen.employeesSaved
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const rows = '#employee-rows [data-testid="fact-row"]'
    await pressSelector(page, press, '#employee-rows [data-testid="add-row"]')
    const added = (await page.$$(rows)).at(-1)
    await setField(await fieldIn(added, columns.employee), 'sam')
    await setField(await fieldIn(added, columns.residence_city), 'Split')
    await setField(await fieldIn(added, columns.from), '2026-03-02')
    await shoot('employees-draft')
    await pressSelector(page, press, '#employee-rows [data-testid="save-rows"]')
    await toast(page, saved)
    await dismissToasts(page)

    await setField(await fieldIn(await rowNamed(page, rows, 'sam'), columns.dependants), '1')
    await pressSelector(page, press, '#employee-rows [data-testid="save-rows"]')
    await toast(page, saved)
    await shoot('employees-saved')
    await dismissToasts(page)

    const row = await rowNamed(page, rows, 'sam')
    await press(await row.$('[data-testid="remove-row"]'))
    await pressSelector(page, press, '#employee-rows [data-testid="save-rows"]')
    await toast(page, saved)
    await rowGone(page, rows, 'sam')
    await undoIn(page, press, words)
    await rowNamed(page, rows, 'sam')
    await dismissToasts(page)
  }
}

export const employeeFlow = employeeFlowIn('en')

function invoiceListed(page, number) {
  return page.evaluate((wanted) => [...document.querySelectorAll('[data-testid="invoice-list"] .figure')].some((element) => element.textContent?.trim() === wanted), number)
}

async function waitForInvoice(page, number, listed) {
  await page
    .waitForFunction(
      (wanted, shown) => [...document.querySelectorAll('[data-testid="invoice-list"] .figure')].some((element) => element.textContent?.trim() === wanted) === shown,
      { timeout: 10_000 },
      number,
      listed,
    )
    .catch(() => {
      throw new Error(`invoice ${number} is ${listed ? 'not' : 'still'} on the list`)
    })
}

async function dialogClosed(page) {
  await page.waitForFunction(() => !document.querySelector('[data-testid="invoice-form"]'), { timeout: 10_000 })
  await delay(300)
}

/** Invoices in a language: add one, change its amount, delete it, and Undo the delete. */
export function invoiceFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const dialog = words.receivables.dialog
  const edit = (number) => `[data-testid="invoice-edit"][aria-label="${words.receivables.list.edit(number)}"]`
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const number = 'TEST-001'
    if (await invoiceListed(page, number)) throw new Error(`${number} is on the list before the flow adds it`)
    await pressSelector(page, press, '[data-testid="invoice-add"]')
    await page.waitForSelector('[data-testid="invoice-form"]')
    await delay(400)
    await setField(await page.$('[data-testid="invoice-number"]'), number)
    await setField(await page.$('[data-testid="invoice-item"]'), 'Workshop follow-up')
    await setField(await page.$('[data-testid="invoice-amount"]'), '1250.00')
    await choose(page, press, await page.$('[data-testid="invoice-client"]'), 'Lumen Labs')
    await inspect?.('add an invoice')
    await shoot('invoice-add')
    await pressSelector(page, press, '[data-testid="invoice-save"]')
    await toast(page, dialog.added)
    await dialogClosed(page)
    await waitForInvoice(page, number, true)
    await shoot('invoice-added')
    await dismissToasts(page)

    await pressSelector(page, press, edit(number))
    await page.waitForSelector('[data-testid="invoice-form"]')
    await delay(400)
    await setField(await page.$('[data-testid="invoice-amount"]'), '1300')
    await inspect?.('edit an invoice')
    await shoot('invoice-edit')
    await pressSelector(page, press, '[data-testid="invoice-save"]')
    await toast(page, dialog.saved)
    await dialogClosed(page)
    await dismissToasts(page)

    await pressSelector(page, press, edit(number))
    await page.waitForSelector('[data-testid="invoice-form"]')
    await delay(400)
    await pressSelector(page, press, '[data-testid="invoice-delete"]')
    await toast(page, dialog.deleted)
    await dialogClosed(page)
    await waitForInvoice(page, number, false)
    await undoIn(page, press, words)
    await waitForInvoice(page, number, true)
    await dismissToasts(page)
  }
}

export const invoiceFlow = invoiceFlowIn('en')

async function waitForRunStage(page, selector) {
  await page.waitForSelector(selector, { visible: true, timeout: 20_000 }).catch(async () => {
    const said = await page.evaluate(() => document.querySelector('[data-testid="invoice-run"]')?.textContent?.replace(/\s+/g, ' ').slice(0, 400))
    throw new Error(`no ${selector} within 20 s, the dialog says: ${said}`)
  })
  await delay(300)
}

async function runFinished(page) {
  await page
    .waitForFunction(
      () => {
        const steps = [...document.querySelectorAll('[data-testid="invoice-run-steps"] li')]
        return steps.length > 0 && steps.every((step) => step.dataset.status === 'done') && document.querySelector('[data-testid="invoice-run-close"]') !== null
      },
      { timeout: 20_000 },
    )
    .catch(async () => {
      const said = await page.evaluate(() => document.querySelector('[data-testid="invoice-run-steps"]')?.textContent?.replace(/\s+/g, ' '))
      throw new Error(`the run did not finish, its steps say: ${said}`)
    })
  await delay(300)
}

/**
 * Make invoice: the form from the billing plan, the checks, and the steps. With the file on Drive the
 * fake Picker is the browser's confirm dialog: the invoice folder and the year folder are picked,
 * the month folder is not, so the flow makes it on request. A re-export then finds the folders
 * without asking. With a workbook kept in this browser the PDF is saved through the browser.
 */
export function invoiceRunFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const answers = ['accept', 'accept', 'dismiss']
    const asked = []
    const answer = async (dialog) => {
      asked.push(dialog.message())
      if (answers.shift() === 'accept') await dialog.accept()
      else await dialog.dismiss()
    }
    page.on('dialog', answer)
    try {
      await pressSelector(page, press, '[data-testid="invoice-make"]')
      await waitForRunStage(page, '[data-testid="invoice-lines"]')
      const number = await page.$eval('[data-testid="invoice-run-number"]', (input) => input.value)
      if (number === '') throw new Error('the dialog suggests no invoice number')
      const google = (await page.$('[data-testid="invoice-run-draft"]')) !== null
      if (google) await pressSelector(page, press, '[data-testid="invoice-run-draft"]')
      await inspect?.('make an invoice')
      await shoot('invoice-run-form')
      await pressSelector(page, press, '[data-testid="invoice-run-check"]')
      if (google) {
        await waitForRunStage(page, '[data-testid="invoice-run-hidden"]')
        await shoot('invoice-run-hidden')
        await pressSelector(page, press, '[data-testid="invoice-run-create-folder"]')
      }
      await waitForRunStage(page, '[data-testid="invoice-run-ready"]')
      await shoot('invoice-run-ready')
      await pressSelector(page, press, '[data-testid="invoice-run-make"]')
      await runFinished(page)
      await shoot('invoice-run-done')
      await pressSelector(page, press, '[data-testid="invoice-run-close"]')
      await waitForInvoice(page, number, true)
      if (!google) return

      if (asked.length !== 3) throw new Error(`the Picker opened ${asked.length} times on the first run, not 3`)
      await pressSelector(page, press, `[data-testid="invoice-edit"][aria-label="${words.receivables.list.edit(number)}"]`)
      await page.waitForSelector('[data-testid="invoice-form"]')
      await delay(400)
      await pressSelector(page, press, '[data-testid="invoice-reexport"]')
      await waitForRunStage(page, '[data-testid="invoice-lines"]')
      await pressSelector(page, press, '[data-testid="invoice-run-check"]')
      await waitForRunStage(page, '[data-testid="invoice-run-ready"]')
      await pressSelector(page, press, '[data-testid="invoice-run-make"]')
      await runFinished(page)
      await shoot('invoice-reexport-done')
      if (asked.length !== 3) throw new Error('the re-export opened the Picker for a folder already in view')
      await pressSelector(page, press, '[data-testid="invoice-run-close"]')
    } finally {
      page.off('dialog', answer)
    }
  }
}

export const invoiceRunFlow = invoiceRunFlowIn('en')

async function dialogGone(page, selector) {
  await page
    .waitForFunction((wanted) => !document.querySelector(wanted), { timeout: 10_000 }, selector)
    .catch(() => {
      throw new Error(`${selector} is still open`)
    })
  await delay(300)
}

/** The component button of a scenario whose text, with its spaces read as plain ones, starts with `text`, or null. */
function componentIn(page, scenario, text) {
  return page.evaluateHandle(
    (slug, wanted) =>
      [...document.querySelectorAll(`[data-scenario="${slug}"] [data-testid="scenario-component"]`)].find((button) => button.textContent?.replace(/\s+/g, ' ').trim().startsWith(wanted)) ?? null,
    scenario,
    text,
  )
}

async function waitForComponent(page, scenario, text, shown) {
  await page
    .waitForFunction(
      (slug, wanted, present) =>
        [...document.querySelectorAll(`[data-scenario="${slug}"] [data-testid="scenario-component"]`)].some((button) => button.textContent?.replace(/\s+/g, ' ').trim().startsWith(wanted)) === present,
      { timeout: 10_000 },
      scenario,
      text,
      shown,
    )
    .catch(() => {
      throw new Error(`"${text}" is ${shown ? 'not' : 'still'} in ${scenario}`)
    })
}

async function openComponent(page, press, scenario, text) {
  const button = (await componentIn(page, scenario, text)).asElement()
  if (button === null) throw new Error(`no "${text}" in ${scenario}`)
  await button.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(button)
  await page.waitForSelector('[data-testid="scenario-component-form"]')
  await delay(400)
}

/** Year, Pay: open the scenarios, add rent to the floor salary scenario, raise it, delete it, Undo the delete, then copy the scenario and Undo the copy. */
export function scenarioFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.payScenarios
  const rentOf = (amount) => said.components.rent(amount).replace(/\s+/g, ' ')
  const anyRent = rentOf('\u0000').split('\u0000')[0]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const scenario = 'floor-salary'
    await openCard(page, press, 'scenario-editor')
    await pressSelector(page, press, `[data-scenario="${scenario}"] [data-testid="scenario-add-component"]`)
    await page.waitForSelector('[data-testid="scenario-component-form"]')
    await delay(400)
    await choose(page, press, await page.$('[data-testid="component-kind"]'), said.componentDialog.kinds.rent_monthly)
    await setField(await page.waitForSelector('[data-testid="component-amount"]'), '300')
    await setField(await page.$('[data-testid="component-from"]'), '2027-07-01')
    await inspect?.('add a component')
    await shoot('scenario-add')
    await pressSelector(page, press, '[data-testid="component-save"]')
    await toast(page, said.componentDialog.added)
    await dialogGone(page, '[data-testid="scenario-component-form"]')
    await waitForComponent(page, scenario, anyRent, true)
    await shoot('scenario-added')
    await dismissToasts(page)

    await openComponent(page, press, scenario, anyRent)
    await setField(await page.$('[data-testid="component-amount"]'), '320')
    await inspect?.('edit a component')
    await shoot('scenario-edit')
    await pressSelector(page, press, '[data-testid="component-save"]')
    await toast(page, said.componentDialog.saved)
    await dialogGone(page, '[data-testid="scenario-component-form"]')
    await waitForComponent(page, scenario, rentOf(eurosIn(words, 320)), true)
    await dismissToasts(page)

    await openComponent(page, press, scenario, anyRent)
    await pressSelector(page, press, '[data-testid="component-delete"]')
    await toast(page, said.componentDialog.deleted)
    await dialogGone(page, '[data-testid="scenario-component-form"]')
    await waitForComponent(page, scenario, anyRent, false)
    await undoIn(page, press, words)
    await waitForComponent(page, scenario, rentOf(eurosIn(words, 320)), true)
    await dismissToasts(page)

    await pressSelector(page, press, `[data-scenario="${scenario}"] [data-testid="scenario-copy"]`)
    await page.waitForSelector('[data-testid="scenario-name-form"]')
    await delay(400)
    await inspect?.('copy a scenario')
    await pressSelector(page, press, '[data-testid="scenario-name-save"]')
    await toast(page, said.nameDialog.copied)
    await page.waitForSelector('[data-scenario="floor-salary-copy"]')
    await undoIn(page, press, words)
    await page.waitForFunction(() => !document.querySelector('[data-scenario="floor-salary-copy"]'), { timeout: 10_000 })
    await dismissToasts(page)

    await openComponent(page, press, scenario, anyRent)
    await pressSelector(page, press, '[data-testid="component-delete"]')
    await toast(page, said.componentDialog.deleted)
    await dialogGone(page, '[data-testid="scenario-component-form"]')
    await dismissToasts(page)
  }
}

export const scenarioFlow = scenarioFlowIn('en')

/** Year, Pay with no scenarios yet, where the scenarios card opens itself: add the starting four, and Undo them. */
export function startingScenariosFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="scenario-editor"]')
    if (await page.$('[data-scenario]')) throw new Error('a scenario is on the screen before the flow adds the starting ones')
    await pressSelector(page, press, '[data-testid="add-starting-scenarios"]')
    await page.waitForSelector('[data-testid="starting-scenarios-form"]')
    await delay(400)
    await setField(await page.$('[data-testid="starting-rent"]'), '300')
    await inspect?.('add the starting scenarios')
    await shoot('starting-scenarios')
    await pressSelector(page, press, '[data-testid="starting-scenarios-save"]')
    await toast(page, words.payScenarios.startingDialog.added)
    await dialogGone(page, '[data-testid="starting-scenarios-form"]')
    await page.waitForSelector('[data-scenario="floor-salary-2027"]')
    await shoot('starting-added')
    await undoIn(page, press, words)
    await page
      .waitForFunction(() => !document.querySelector('[data-scenario]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('Undo left starting scenarios on the screen')
      })
    await dismissToasts(page)
  }
}

export const startingScenariosFlow = startingScenariosFlowIn('en')

/** The text of a category's row in the plan editor, with its spaces read as plain ones, once it holds `wanted`. */
async function waitForPlanCategory(page, slug, wanted) {
  await page
    .waitForFunction(
      (category, text) => document.querySelector(`[data-testid="plan-category"][data-category="${category}"]`)?.textContent?.replace(/\s+/g, ' ').includes(text) ?? false,
      { timeout: 10_000 },
      slug,
      wanted,
    )
    .catch(() => {
      throw new Error(`the plan of ${slug} does not say "${wanted}"`)
    })
}

async function openPlanCategory(page, press, slug) {
  await pressSelector(page, press, `[data-testid="plan-category"][data-category="${slug}"]`)
  await page.waitForSelector('[data-testid="category-plan-form"]')
  await delay(400)
}

/** Year, Plan for 2027: plan a category for every month and one month of its own, raise it, clear it, Undo the clear, then clear it again. */
export function planFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const plan = words.forecast.plan
  const dialog = words.forecast.planDialogs.category
  const noPlanRow = plan.noPlanRow('').trim()
  const plannedAt = (amount) => plan.plannedAt(eurosIn(words, amount), countedIn(words, plan.ownMonths(1), 1)).replace(/\s+/g, ' ')
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="plan-editor"]')
    const slug = await page.evaluate(
      (text) => [...document.querySelectorAll('[data-testid="plan-category"]:not([disabled])')].find((button) => button.textContent?.includes(text))?.getAttribute('data-category') ?? null,
      noPlanRow,
    )
    if (slug === null) throw new Error('no category without a plan row to plan')

    await openPlanCategory(page, press, slug)
    await setField(await page.$('[data-testid="plan-every-month"]'), '120')
    await setField(await page.$('[data-testid="plan-month-1"]'), '300')
    await inspect?.('plan a category')
    await shoot('plan-category')
    await pressSelector(page, press, '[data-testid="plan-save"]')
    await toast(page, dialog.saved)
    await dialogGone(page, '[data-testid="category-plan-form"]')
    await waitForPlanCategory(page, slug, plannedAt(120))
    await shoot('plan-category-saved')
    await dismissToasts(page)

    await openPlanCategory(page, press, slug)
    await setField(await page.$('[data-testid="plan-every-month"]'), '130')
    await inspect?.('edit a plan')
    await pressSelector(page, press, '[data-testid="plan-save"]')
    await toast(page, dialog.saved)
    await dialogGone(page, '[data-testid="category-plan-form"]')
    await waitForPlanCategory(page, slug, plannedAt(130))
    await dismissToasts(page)

    await openPlanCategory(page, press, slug)
    await pressSelector(page, press, '[data-testid="plan-clear"]')
    await toast(page, dialog.cleared)
    await dialogGone(page, '[data-testid="category-plan-form"]')
    await waitForPlanCategory(page, slug, noPlanRow)
    await undoIn(page, press, words)
    await waitForPlanCategory(page, slug, plannedAt(130))
    await dismissToasts(page)

    await openPlanCategory(page, press, slug)
    await pressSelector(page, press, '[data-testid="plan-clear"]')
    await toast(page, dialog.cleared)
    await dialogGone(page, '[data-testid="category-plan-form"]')
    await dismissToasts(page)
  }
}

export const planFlow = planFlowIn('en')

/** Year, Plan for 2027 with no plan rows: plan a purchase, and Undo it. */
export function planTabFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="plan-editor"]')
    if (await page.$('[data-testid="plan-purchase"]')) throw new Error('a purchase is planned before the flow adds one')
    await pressSelector(page, press, '[data-testid="plan-add-purchase"]')
    await page.waitForSelector('[data-testid="purchase-plan-form"]')
    await delay(400)
    await setField(await page.$('[data-testid="purchase-name"]'), 'Replacement laptop')
    await setField(await page.$('[data-testid="purchase-date"]'), '2027-03-10')
    await setField(await page.$('[data-testid="purchase-amount"]'), '1600')
    await inspect?.('plan a purchase')
    await shoot('plan-purchase')
    await pressSelector(page, press, '[data-testid="purchase-save"]')
    await toast(page, words.forecast.planDialogs.purchase.planned)
    await dialogGone(page, '[data-testid="purchase-plan-form"]')
    await page.waitForSelector('[data-testid="plan-purchase"]')
    await shoot('plan-purchase-added')
    await undoIn(page, press, words)
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="plan-purchase"]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('Undo left the planned purchase on the screen')
      })
    await dismissToasts(page)
  }
}

export const planTabFlow = planTabFlowIn('en')

/** The Split action of the one row in view: in the table's last column, or inside its card on a phone once the card is open. */
async function openSplitOfRow(page, press) {
  const button = await page.$('[data-testid="split-row"]')
  const visible = button !== null && (await button.evaluate((element) => element.getBoundingClientRect().width > 0))
  if (!visible) {
    await pressSelector(page, press, '[data-testid="transaction-card"] .card-summary')
  }
  await pressSelector(page, press, '[data-testid="split-row"]')
  await page.waitForSelector('[data-testid="split-form"]')
  await delay(400)
}

/** Picks a category in the category picker, whose options end with the category's name. */
async function chooseCategory(page, press, trigger, label) {
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(150)
  await press(trigger)
  const handle = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null, { timeout: 5_000 }, label)
    .catch(() => {
      throw new Error(`no category "${label}"`)
    })
  await press(handle.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

async function setPart(page, index, amount) {
  const parts = await page.$$('[data-testid="split-part"]')
  const part = parts[index]
  if (part === undefined) throw new Error(`no part ${index + 1} in the split editor`)
  await setField(await part.$('[data-testid="split-part-amount"]'), amount)
  return part
}

/** The part at `index` once it takes the rest and shows `shown` of it. */
async function restIs(page, index, shown) {
  const part = (await page.$$('[data-testid="split-part"]'))[index]
  if (part === undefined) throw new Error(`no part ${index + 1} in the split editor`)
  await page
    .waitForFunction((held, wanted) => held.querySelector('[data-testid="split-rest"]')?.textContent?.includes(wanted) ?? false, { timeout: 5_000 }, part, shown)
    .catch(async () => {
      throw new Error(`part ${index + 1} does not take the rest of ${shown}, it says "${await part.evaluate((held) => held.textContent?.trim() ?? '')}"`)
    })
  return part
}

async function waitForSplit(page, present) {
  await page
    .waitForFunction((wanted) => (document.querySelector('[data-testid="edit-split"]') !== null) === wanted, { timeout: 10_000 }, present)
    .catch(() => {
      throw new Error(present ? 'the split row is not listed with its parts' : 'the split row is still listed with its parts')
    })
}

/** An amount typed the way the language writes its decimals, as in 30,00 in Croatian. */
function typedIn(words, amount) {
  return words.locale === 'en-GB' ? amount : amount.replace('.', ',')
}

/** Transactions: split the one gadget purchase in two, change the parts, delete the split, and Undo the delete. */
export function splitFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.transactions
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await waitForSplit(page, false)
    await openSplitOfRow(page, press)
    await setPart(page, 0, typedIn(words, '30.00'))
    const second = await restIs(page, 1, typedIn(words, '8.90'))
    await chooseCategory(page, press, await second.$('[data-testid="split-part-category"]'), words.categoryName('office-supplies'))
    await setField(await second.$('[data-testid="split-part-note"]'), 'Printer paper')
    await inspect?.('split a row')
    await shoot('split-add')
    await pressSelector(page, press, '[data-testid="split-save"]')
    await toast(page, countedIn(words, said.splitInParts(2), 2))
    await dialogGone(page, '[data-testid="split-form"]')
    await waitForSplit(page, true)
    await shoot('split-added')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="edit-split"]')
    await page.waitForSelector('[data-testid="split-form"]')
    await delay(400)
    await setPart(page, 0, typedIn(words, '28.90'))
    await pressSelector(page, press, '[data-testid="split-add-part"]')
    await delay(200)
    const third = await setPart(page, 2, typedIn(words, '5.00'))
    await restIs(page, 1, typedIn(words, '5.00'))
    await chooseCategory(page, press, await third.$('[data-testid="split-part-category"]'), words.categoryName('owner-loan-out'))
    await inspect?.('edit a split')
    await shoot('split-edit')
    await pressSelector(page, press, '[data-testid="split-save"]')
    await toast(page, said.splitDialog.saved)
    await dialogGone(page, '[data-testid="split-form"]')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="edit-split"]')
    await page.waitForSelector('[data-testid="split-form"]')
    await delay(400)
    await pressSelector(page, press, '[data-testid="split-delete"]')
    await toast(page, said.splitDialog.deleted)
    await dialogGone(page, '[data-testid="split-form"]')
    await waitForSplit(page, false)
    await undoIn(page, press, words)
    await waitForSplit(page, true)
    await shoot('split-undone')
    await dismissToasts(page)
  }
}

export const splitFlow = splitFlowIn('en')

/**
 * Books with two splits the guards refuse (`?fake=refused-splits`). On the design invoice the dialog says Save replaces the parts
 * that no longer add up, and the toast says the save has no Undo. On the business lunch it names the part that cannot be read, links
 * to the problem list on Settings and offers no split.
 */
export function refusedSplitFlowIn(language, kind) {
  const words = SCREEN_WORDS[language]
  const said = words.transactions
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSplitOfRow(page, press)
    if (kind === 'unreadable') {
      await page.waitForSelector('[data-testid="split-unreadable"]')
      if ((await page.$('[data-testid="split-part"], [data-testid="split-save"]')) !== null) throw new Error('the parts editor or Split shows while a stored part cannot be read')
      await shootAt(page, shoot, '[data-testid="split-unreadable"]', 'split-unreadable', { inspected: () => inspect?.('a split with a part that cannot be read') })
      return
    }
    await shootAt(page, shoot, '[data-testid="split-replaces-refused"]', 'split-refused', { inspected: () => inspect?.('a split the guards refused') })
    await setPart(page, 0, typedIn(words, '100.00'))
    const second = (await page.$$('[data-testid="split-part"]'))[1]
    await chooseCategory(page, press, await second.$('[data-testid="split-part-category"]'), words.categoryName('consulting'))
    await pressSelector(page, press, '[data-testid="split-save"]')
    await toast(page, countedIn(words, said.splitInParts(2), 2))
    await dialogGone(page, '[data-testid="split-form"]')
    await waitForSplit(page, true)
    await shoot('split-refused-saved')
    await dismissToasts(page)
  }
}

/**
 * Books from before every ledger row had an id (`?fake=no-row-ids`): Overview's Waiting for you counts the rows, its link opens Settings, Books
 * file, whose prompt gives them all an id in one write. Undo takes the ids back and the prompt returns. Given again, the ids link the
 * split parts to their rows, and a split row on Transactions still shows its parts.
 */
export function rowIdsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.books.rowIds
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const notice = '[data-testid="row-ids-notice"]'
    await page.waitForSelector('[data-testid="waiting-for-you"] [data-job="row-ids"] a', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Waiting for you does not count the ledger rows without an id')
    })
    await shoot('row-ids-waiting')
    await pressSelector(page, press, '[data-testid="waiting-for-you"] [data-job="row-ids"] a')
    await page.waitForSelector(notice, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Settings, Books file does not offer to give the ledger rows their ids')
    })
    const count = Number((await page.$eval(`${notice} [data-slot="title"]`, (title) => title.textContent ?? '')).match(/\d+/)?.[0])
    if (!(count > 0)) throw new Error('the row id prompt names no count of rows')
    await inspect?.('the row id prompt')
    await shoot('row-ids-prompt')
    await pressButton(page, press, `${notice} button`, said.give)
    await toast(page, countedIn(words, said.given(count), count))
    await page.waitForSelector(notice, { hidden: true, timeout: 10_000 }).catch(() => {
      throw new Error('the row id prompt stays once every row has an id')
    })
    await shoot('row-ids-given')
    await undoIn(page, press, words)
    await page.waitForSelector(notice, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Undo does not bring the row id prompt back')
    })
    await dismissToasts(page)
    await pressButton(page, press, `${notice} button`, said.give)
    await toast(page, countedIn(words, said.given(count), count))
    await dismissToasts(page)
    // The fake split parts lost their row ids with the rows, so the write links them to their rows by day, amount and balance.
    await page.evaluate(() => {
      window.location.hash = '#/company/transactions?p=all&q=BISTRO'
    })
    await waitForSplit(page, true)
    await shoot('row-ids-split-kept')
  }
}

export const rowIdsFlow = rowIdsFlowIn('en')

/**
 * The Change category action of the first row in view, or with `words` of the first part of a split
 * row: in the table's last column, or inside its card on a phone once the card is open.
 */
async function openChangeOfRow(page, press, words = null) {
  // The label around the row's counterparty, which differs per row.
  const [before, after] = words === null ? [] : words.transactions.changeCategoryOf(words.transactions.partName(1, '\u0000')).split('\u0000')
  const button = words === null ? '[data-testid="change-category-row"]' : `[data-testid="change-category-row"][aria-label^="${before}"]${after === '' ? '' : `[aria-label$="${after}"]`}`
  const card = words === null ? '[data-testid="transaction-card"]' : '[data-testid="transaction-card"].part'
  const found = await page.waitForSelector(`${button}, ${card}`, { timeout: 10_000 })
  const visible = await found.evaluate((element, wanted) => element.matches(wanted) && element.getBoundingClientRect().width > 0, button)
  if (!visible) {
    await pressSelector(page, press, `${card} .card-summary`)
    await pressSelector(page, press, `${card} [data-testid="change-category-row"]`)
  } else {
    await pressSelector(page, press, button)
  }
}

async function pageSays(page, text, says) {
  await page
    .waitForFunction((wanted, shown) => document.body.innerText.includes(wanted) === shown, { timeout: 10_000 }, text, says)
    .catch(() => {
      throw new Error(says ? `"${text}" is not on the page` : `"${text}" is still on the page`)
    })
}

/**
 * Transactions: the newest code host plan, which a rule files as a software subscription, filed as
 * office supplies with the rule named first, then undone. A part of a split row opens the split
 * editor instead, since the splits tab holds its category.
 */
export function changeCategoryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const officeSupplies = words.categoryName('office-supplies')
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pageSays(page, officeSupplies, false)
    await openChangeOfRow(page, press)
    await page.waitForSelector('[data-testid="change-category"]')
    await delay(400)
    await chooseCategory(page, press, await page.$('[data-testid="change-category-picker"]'), officeSupplies)
    await page.waitForSelector('[data-testid="rule-against"]', { timeout: 5_000 }).catch(() => {
      throw new Error('the dialog does not name the rule that files the row elsewhere')
    })
    await inspect?.('change a category')
    await shoot('change-category')
    await pressSelector(page, press, '[data-testid="change-category-save"]')
    await toast(page, words.transactions.changeDialog.filedAs(officeSupplies))
    await dialogGone(page, '[data-testid="change-category"]')
    await pageSays(page, officeSupplies, true)
    await shoot('change-category-filed')
    await undoIn(page, press, words)
    await pageSays(page, officeSupplies, false)
    await dismissToasts(page)

    await page.evaluate(() => {
      window.location.hash = '#/company/transactions?p=all&q=PAPER'
    })
    await waitForSplit(page, true)
    await openChangeOfRow(page, press, words)
    await page.waitForSelector('[data-testid="split-form"]', { timeout: 5_000 }).catch(() => {
      throw new Error('Change category on a part of a split row did not open the split editor')
    })
    await delay(400)
    await shoot('change-category-part')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="split-form"]')
  }
}

export const changeCategoryFlow = changeCategoryFlowIn('en')

/**
 * Opens the Owner share dialog of the shared row in view: from the pencil on its heading, or from
 * its first part, in the table's last column or inside the part's card on a phone.
 */
async function openShareOfRow(page, press, from = 'heading') {
  if (from === 'heading') {
    await pressSelector(page, press, '[data-testid="edit-owner-share"]')
  } else {
    await page.waitForSelector('[data-testid="owner-share-row"], [data-testid="transaction-card"].part', { timeout: 10_000 })
    const visible = await page.evaluate(() => [...document.querySelectorAll('[data-testid="owner-share-row"]')].some((element) => element.getBoundingClientRect().width > 0))
    if (!visible) {
      await pressSelector(page, press, '[data-testid="transaction-card"].part .card-summary')
    }
    await pressSelector(page, press, '[data-testid="owner-share-row"]')
  }
  await page.waitForSelector('[data-testid="owner-share"]', { visible: true })
  await delay(400)
}

async function shareTyped(page) {
  return page.$eval('[data-testid="owner-share-input"]', (input) => input.value)
}

/** Reopens the dialog from the row's first part and checks it starts on the share of the row as booked, then closes it. */
async function shareReads(page, press, wanted) {
  await openShareOfRow(page, press, 'part')
  const typed = await shareTyped(page)
  if (typed !== wanted) throw new Error(`the Owner share dialog starts on "${typed}", not "${wanted}"`)
  await page.keyboard.press('Escape')
  await dialogGone(page, '[data-testid="owner-share"]')
}

/** An amount in euros as the language writes it, with the spaces read as plain ones. */
function eurosIn(words, amount) {
  return new Intl.NumberFormat(words.locale, { style: 'currency', currency: 'EUR' }).format(amount).replace(/\s+/g, ' ')
}

/**
 * Transactions: the laptop, which holds a 30% share of its own and so heads its two parts, changed
 * to 45% from its heading with the company's and the owner's parts shown, then undone, and cleared
 * through its category's default, which is none, then undone. Each Undo is checked from a part.
 */
export function ownerShareFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const dialog = words.ownerShare.shareDialog
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openShareOfRow(page, press)
    if ((await shareTyped(page)) !== '30') throw new Error(`the laptop's share reads "${await shareTyped(page)}", not 30`)
    await setField(await page.$('[data-testid="owner-share-input"]'), '45')
    const split = [`${dialog.companyKeeps} ${eurosIn(words, 1044.45)}`, `${dialog.youTake} ${eurosIn(words, 854.55)}`]
    await page
      .waitForFunction((wanted) => wanted.every((part) => document.querySelector('[data-testid="owner-share-split"]')?.innerText.replace(/\s+/g, ' ').includes(part)), { timeout: 5_000 }, split)
      .catch(async () => {
        const said = await page.$eval('[data-testid="owner-share-split"]', (element) => element.innerText.replace(/\s+/g, ' ').trim())
        throw new Error(`45% of the laptop's 1,899.00 reads "${said}", not ${split.join(' and ')}`)
      })
    await elementSays(page, '[role="dialog"]', [dialog.title, dialog.share], 'the Owner share dialog is not in its language')
    await inspect?.('owner share')
    await shoot('owner-share')
    await pressSelector(page, press, '[data-testid="owner-share-save"]')
    await toast(page, dialog.setTo(45))
    await dialogGone(page, '[data-testid="owner-share"]')
    await undoIn(page, press, words)
    await dismissToasts(page)
    await shareReads(page, press, '30')

    await openShareOfRow(page, press)
    await pressSelector(page, press, '[data-testid="owner-share-default"]')
    if ((await shareTyped(page)) !== '') throw new Error('the default of Equipment, which has none, did not clear the share')
    await shoot('owner-share-clear')
    await pressSelector(page, press, '[data-testid="owner-share-save"]')
    await toast(page, dialog.cleared)
    await dialogGone(page, '[data-testid="owner-share"]')
    await undoIn(page, press, words)
    await dismissToasts(page)
    await shareReads(page, press, '30')
  }
}

export const ownerShareFlow = ownerShareFlowIn('en')

/**
 * Owner, Taken on 2026 in the workbook kept in this browser: "Monthly net, profit included" beside
 * Monthly net pay splits into pay and profit a month, its figure opens the build-up with each part,
 * the taxes and what is left in the company, and the year's profit opens Year on that year.
 */
export async function ownerNetFlow(page, { press, shoot, inspect }) {
  const tile = '[data-testid="owner-net-with-profit"]'
  await page.waitForSelector(`${tile} [data-testid="build-up-button"]`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the monthly net with the profit included has no figure that opens its build-up')
  })
  const caption = await page.$eval(tile, (element) => element.textContent ?? '')
  if (!/€[\d,]+\.\d{2} pay and €[\d,]+\.\d{2} from profit, a month/.test(caption)) throw new Error(`the tile does not split into pay and profit a month, it says: ${caption.trim()}`)
  const tiles = await page.$eval('[data-testid="owner-taken-tiles"]', (element) => element.textContent ?? '')
  if (!tiles.includes('Monthly net pay')) throw new Error('Monthly net pay is gone from beside the new tile')
  await inspect?.('owner net')
  await shoot('owner-net')

  await pressSelector(page, press, `${tile} [data-testid="build-up-button"]`)
  await page.waitForSelector('[data-testid="figure-detail"]', { visible: true, timeout: 10_000 })
  await delay(400)
  const detail = await page.$eval('[data-testid="figure-detail"]', (element) => element.textContent ?? '')
  for (const line of [
    'Pay without loans and dividends, 10 months',
    'Rent tax the owner pays the tax office',
    'Pay after the rent tax',
    'Profit before tax, Jan 2026 – Sep 2026',
    'Corporate tax at',
    'Dividend tax at',
    'Profit after both taxes, 9 months',
    'Left in the company',
  ]) {
    if (!detail.includes(line)) throw new Error(`the build-up lacks "${line}", it says: ${detail.slice(0, 300)}`)
  }
  await inspect?.('owner net build-up')
  await shoot('owner-net-build-up')

  await pressSelector(page, press, '[data-testid="figure-detail"] a[aria-label^="Profit before tax, Jan 2026"]')
  await screenTitled(page, 'Year')
  if (!(await page.evaluate(() => window.location.hash)).includes('year=2026')) throw new Error('the profit of 2026 did not open Year on 2026')
}

/** Owner, Taken in the fake file on Drive without its registration day: the tile reads – and its link opens the setting. */
export function ownerNetUnregisteredFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const note = '[data-testid="owner-net-unregistered"]'
    await page.waitForSelector(note, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the tile does not say the profit needs the registration day')
    })
    const value = await page.$eval('[data-testid="owner-net-with-profit"] .text-figure-lg', (element) => element.textContent?.trim() ?? '')
    if (value !== '–') throw new Error(`the tile reads "${value}" without the registration day, not –`)
    await inspect?.('owner net unregistered')
    await shoot('owner-net-unregistered')
    await pressSelector(page, press, `${note} a`)
    await screenTitled(page, words.companySettings)
  }
}

export const ownerNetUnregisteredFlow = ownerNetUnregisteredFlowIn('en')

/**
 * Settings, Categories: a 40% default on software subscriptions, saved with the fill offer, which
 * fills the bank rows without a share and leaves the design tool advance's 25%, then undone whole.
 */
export function shareFillFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const row = await rowNamed(page, '[data-testid="category-row"]', 'software-subscriptions')
    await setField(await fieldIn(row, words.settings.categories.shareLabel), '40')
    await delay(200)
    await shoot('share-fill-draft')
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await page.waitForSelector('[data-testid="share-fill"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('a new default did not offer to fill the rows without a share')
    })
    await delay(400)
    await elementSays(page, '[role="dialog"]', [words.ownerShare.fillDialog.title, words.ownerShare.fillDialog.keepTheirs], 'the fill offer is not in its language')
    const offer = await page.$eval('[data-testid="share-fill"]', (element) => element.innerText.replace(/\s+/g, ' ').trim())
    const count = /40 ?% (\d+) /.exec(offer)?.[1]
    if (count === undefined || !offer.includes(countedIn(words, words.ownerShare.fillDialog.rows(Number(count)), Number(count)))) throw new Error(`the fill offer says "${offer}"`)
    const rows = Number(count)
    await inspect?.('share fill')
    await shoot('share-fill')
    await pressSelector(page, press, '[data-testid="share-fill-save"]')
    await toast(page, words.settings.categories.saved)
    const said = await page.$eval(`${TOAST} [data-slot="description"]`, (element) => element.textContent?.trim() ?? '')
    const filled = countedIn(words, words.settings.categories.filled(rows), rows)
    if (said !== filled) throw new Error(`the save says "${said}" after filling ${rows} rows, not "${filled}"`)
    await dialogGone(page, '[data-testid="share-fill"]')
    await undoIn(page, press, words)
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('[data-testid="category-row"]')]
            .find((element) => element.querySelector('input')?.value === 'software-subscriptions')
            ?.querySelector('[data-testid="category-owner-share"]')?.value === '',
        { timeout: 10_000 },
      )
      .catch(() => {
        throw new Error('Undo did not take the default off software subscriptions')
      })
    await dismissToasts(page)
  }
}

export const shareFillFlow = shareFillFlowIn('en')

async function dropFile(page, path) {
  const input = await page.waitForSelector('[data-testid="import-file"] input[type="file"]', { timeout: 10_000 }).catch(() => {
    throw new Error('Import offers no file input')
  })
  await input.uploadFile(path)
}

async function dryRunSays(page, text) {
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="dry-run-summary"]')?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, text)
    .catch(async () => {
      const said = await page.evaluate(() => document.querySelector('[data-testid="dry-run-summary"]')?.textContent?.trim())
      throw new Error(`the dry run does not say "${text}", it says: ${said ?? 'nothing'}`)
    })
  await delay(300)
}

/** After a confirmed import, the dry run says how many new rows wait for review, and says nothing once Undo took them out. */
async function waitingOnReview(page, shown) {
  await page
    .waitForFunction((wanted) => (document.querySelector('[data-testid="import-waiting"]') !== null) === wanted, { timeout: 10_000 }, shown)
    .catch(() => {
      throw new Error(shown ? 'the confirmed import does not say how many new rows wait for review' : 'the notice about the new rows stayed after Undo')
    })
}

/** Import: drop the sample camt.053 statement, read the dry run, confirm, find every row on the ledger, and Undo. */
export function importCamtFlowIn(language, path) {
  const words = SCREEN_WORDS[language]
  const panel = words.imports.panel
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const addsFour = countedIn(words, panel.addsRows(4), 4)
    await dropFile(page, path)
    await dryRunSays(page, addsFour)
    if ((await page.$$('[data-testid="dry-run-row"]')).length !== 4) throw new Error('the dry run does not list the four entries')
    await inspect?.('the camt dry run')
    await shoot('import-camt-dry-run')
    await pressSelector(page, press, '[data-testid="import-confirm"]')
    await toastCounted(page, (count) => words.importWrites.imported([], count))
    await dryRunSays(page, panel.writesNothing)
    await dryRunSays(page, countedIn(words, panel.inLedger(4), 4))
    await waitingOnReview(page, true)
    await shoot('import-camt-confirmed')
    await undoIn(page, press, words)
    await dryRunSays(page, addsFour)
    await waitingOnReview(page, false)
    await shoot('import-camt-undone')
    await dismissToasts(page)
  }
}

export const importCamtFlow = (path) => importCamtFlowIn('en', path)

/**
 * Import with a ledger row the AI copied a day before the sample camt statement's client payment: the dry run holds that payment
 * until the person answers, asks about it above the rows, and adds the other three entries. Use the file's row makes the payment take
 * the copied row's place, so four entries go in. Nothing is confirmed.
 */
export function importCamtLookAlikeFlowIn(language, path) {
  const words = SCREEN_WORDS[language]
  const panel = words.imports.panel
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropFile(page, path)
    await dryRunSays(page, countedIn(words, panel.addsRows(3), 3))
    await elementSays(page, '[data-testid="dry-run-row"]', [words.imports.statement.waitsForAnswer], 'the payment does not say it waits for an answer')
    await elementSays(page, '[data-testid="question"]', ['NORTHWIND ANALYTICS'], 'the question does not name the copied row the payment looks like')
    await shootAt(page, shoot, '[data-testid="questions"]', 'import-camt-lookalike')
    await pressSelector(page, press, `[data-testid="question-choice"] ${USE_FILE_ROW}`)
    await dryRunSays(page, countedIn(words, panel.addsRows(4), 4))
    await elementSays(page, '[data-testid="dry-run-row"]', [words.imports.statement.replacesCopied], "the payment does not say it takes the copied row's place")
    await shootAt(page, shoot, '[data-testid="questions"]', 'import-camt-lookalike-replaced')
  }
}

/** Import: drop the sample bank export, make and save a profile from the guess, confirm the dry run, and Undo. */
export function importTableFlowIn(language, path) {
  const words = SCREEN_WORDS[language]
  const panel = words.imports.panel
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const addsFour = countedIn(words, panel.addsRows(4), 4)
    await dropFile(page, path)
    const name = await page
      .waitForSelector('[data-testid="profile-editor"] input[data-testid="profile-name"], [data-testid="profile-editor"] [data-testid="profile-name"] input', { timeout: 10_000 })
      .catch(() => {
        throw new Error('no profile editor for an export no saved profile fits')
      })
    await setField(name, 'example-bank')
    await dryRunSays(page, addsFour)
    await inspect?.('the new profile')
    await shoot('import-profile')
    await pressSelector(page, press, '[data-testid="profile-save"]')
    await toast(page, panel.profileSaved)
    await inspect?.('the profile saved')
    await dismissToasts(page)
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="profile-editor"]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('the saved profile is not the one picked')
      })
    await dryRunSays(page, addsFour)
    await shoot('import-table-dry-run')
    await pressSelector(page, press, '[data-testid="import-confirm"]')
    await toastCounted(page, (count) => words.importWrites.imported([], count))
    await dryRunSays(page, panel.writesNothing)
    await waitingOnReview(page, true)
    await inspect?.('the export confirmed')
    await undoIn(page, press, words)
    await dryRunSays(page, addsFour)
    await shoot('import-table-undone')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="profile-delete"]')
    await toast(page, panel.profileDeleted)
    await inspect?.('the profile deleted')
    await page.waitForSelector('[data-testid="profile-editor"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the deleted profile is still the one picked')
    })
    if (await page.$('[data-testid="profile-choice"]')) throw new Error('the saved profile menu stayed after its only profile was deleted')
    await dismissToasts(page)
  }
}

export const importTableFlow = (path) => importTableFlowIn('en', path)

/** Presses Undo in the toast of the last write and waits for the toast that says it was undone, in the language on screen. */
async function undoIn(page, press, words) {
  const button = await page
    .waitForFunction(
      (selector, label) => [...document.querySelectorAll(`${selector} button`)].find((element) => element.textContent?.trim() === label) ?? null,
      { timeout: 5_000 },
      TOAST,
      words.writes.undo,
    )
    .catch(() => {
      throw new Error(`no toast offers ${words.writes.undo}`)
    })
  await press(button.asElement())
  await toast(page, words.writes.undone)
}

/**
 * The Import tab in a language: the sample camt.053 statement's dry run, confirmed with the rows
 * that wait for review said and undone, then the sample bank export with a profile guessed from it
 * and its dry run, the profile left unsaved.
 */
export function importFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const panel = words.imports.panel
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const addsFour = countedIn(words, panel.addsRows(4), 4)
    await dropFile(page, paths.camt)
    await dryRunSays(page, addsFour)
    await inspect?.('the camt dry run')
    await shoot('import-camt-dry-run')
    await pressSelector(page, press, '[data-testid="import-confirm"]')
    await dryRunSays(page, panel.writesNothing)
    await page.waitForSelector('[data-testid="import-waiting"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the confirmed import does not say how many new rows wait for review')
    })
    await delay(300)
    await shoot('import-camt-confirmed')
    await undoIn(page, press, words)
    await dryRunSays(page, addsFour)

    await dropFile(page, paths.table)
    const name = await page.waitForSelector('[data-testid="profile-editor"] [data-testid="profile-name"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('no profile editor for an export no saved profile fits')
    })
    await elementSays(page, '[data-testid="profile-editor"]', [words.imports.profile.name, words.imports.profile.saveNew], 'the profile editor is not in its language')
    await setField((await name.$('input')) ?? name, 'example-bank')
    await dryRunSays(page, addsFour)
    await inspect?.('the guessed profile')
    await shoot('import-profile')
  }
}

const SYNC_BUTTON = '[data-testid="sync-button"]'
const SYNC_STEPS = '[data-testid="sync-steps"]'
const SYNC_CARD = '[data-testid="sync-card"]'

/** Waits for a toast whose title matches the pattern, which must be the only one, since earlier ones were dismissed. Returns its text. */
/**
 * Waits for a toast that reads as `sentence` does for a count the flow cannot know ahead, such as the
 * rows of a statement: it starts with the words `sentence` gives every count and names a number.
 * Node picks plural forms by English rules, so the words are the ones 1 and 1000 share.
 */
async function toastCounted(page, sentence) {
  const one = sentence(1)
  const many = sentence(1000)
  let shared = 0
  while (shared < one.length && one[shared] === many[shared]) shared += 1
  const start = one.slice(0, shared).replace(/\d+$/, '')
  const deadline = Date.now() + 10_000
  let titles = []
  while (Date.now() < deadline) {
    titles = await page.$$eval(`${TOAST} [data-slot="title"]`, (elements) => elements.map((element) => element.textContent?.trim() ?? ''))
    if (titles.some((title) => title.startsWith(start) && /\d/.test(title.slice(start.length)))) {
      await delay(600)
      return
    }
    await delay(200)
  }
  throw new Error(`no toast starting "${start}" and naming a count within 10 s, the toasts say: ${titles.join(' | ') || 'nothing'}`)
}

async function toastMatching(page, pattern) {
  const shown = await page
    .waitForFunction(
      (selector, source) =>
        [...document.querySelectorAll(selector)].find((element) => new RegExp(source).test(element.querySelector('[data-slot="title"]')?.textContent?.trim() ?? ''))?.textContent ?? null,
      { timeout: 10_000 },
      TOAST,
      pattern.source,
    )
    .catch(async () => {
      const said = await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((element) => element.textContent?.trim()).join(' | '), TOAST)
      throw new Error(`no toast matching ${pattern} within 10 s, the toasts say: ${said || 'nothing'}`)
    })
  await delay(600)
  return shown.jsonValue()
}

/** Fails when a toast shows within a moment, since a sync reports in its control and its steps only. */
async function noToast(page, failure) {
  await delay(1_000)
  const said = await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((element) => element.textContent?.trim()).join(' | '), TOAST)
  if (said !== '') throw new Error(`${failure}: ${said}`)
}

/** The sync control on screen, the top bar's or the sidebar's. */
async function syncButton(page) {
  return page
    .waitForFunction((selector) => [...document.querySelectorAll(selector)].find((element) => element.offsetParent !== null) ?? null, { timeout: 10_000 }, SYNC_BUTTON)
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error('no Sync button on screen')
    })
}

/** Waits until the sync control shows the state, and returns what its button says and what a screen reader hears. */
async function controlShows(page, kind) {
  await page
    .waitForFunction(
      (wanted) => [...document.querySelectorAll('[data-testid="sync-status"]')].some((element) => element.offsetParent !== null && element.dataset.control === wanted),
      { timeout: 12_000, polling: 100 },
      kind,
    )
    .catch(async () => {
      const shown = await page.evaluate(() => [...document.querySelectorAll('[data-testid="sync-status"]')].map((element) => element.dataset.control).join(', '))
      throw new Error(`the sync control does not show ${kind}, it shows ${shown || 'nothing'}`)
    })
  return (await syncButton(page)).evaluate((element) => ({ label: element.textContent?.trim() ?? '', name: element.getAttribute('aria-label') ?? '', disabled: element.disabled }))
}

/** Presses the sync control, the top bar's or the sidebar's, and waits until the sync and its steps are done. */
async function syncAndSettle(page, press) {
  await press(await syncButton(page))
  await page
    .waitForFunction((selector) => [...document.querySelectorAll(selector)].some((element) => element.offsetParent !== null && !element.disabled), { timeout: 12_000, polling: 100 }, SYNC_BUTTON)
    .catch(() => {
      throw new Error('the sync did not finish within 12 s')
    })
}

/** Waits until a step's line in the steps under `scope` is in the state and says the text. Returns the line's text. */
async function stepSays(page, scope, step, state, pattern) {
  const selector = `${scope} ${SYNC_STEPS} [data-step="${step}"]`
  return page
    .waitForFunction(
      (css, wanted, source) => {
        const line = [...document.querySelectorAll(css)].find((element) => element.offsetParent !== null)
        return line !== undefined && line.dataset.state === wanted && new RegExp(source).test(line.textContent ?? '') ? line.textContent : null
      },
      { timeout: 10_000 },
      selector,
      state,
      pattern.source,
    )
    .then((handle) => handle.jsonValue())
    .catch(async () => {
      const said = await page.evaluate((css) => [...document.querySelectorAll(css)].map((line) => `${line.dataset.state}: ${line.textContent?.trim()}`).join(' | '), selector)
      throw new Error(`the ${step} step is not ${state} matching ${pattern}, it says: ${said || 'nothing'}`)
    })
}

async function openKunaSettings(page) {
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await page.waitForSelector(SYNC_CARD, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Kuna settings has no Sync card')
  })
}

const FILED = /Filed statement \d+, 4 rows/

/**
 * Sync files the sample statement from the fake statements folder and says so in the statements
 * step, not in a toast. Undo in the step's line on Kuna settings takes it out, the card's
 * Sync again files it again, and Import lists it. A last sync finds nothing new and says so there.
 */
export async function statementSyncFlow(page, { press, shoot }) {
  await syncAndSettle(page, press)
  await noToast(page, 'a sync that filed a statement showed a toast')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
  await shootAt(page, shoot, SYNC_CARD, 'statements-filed', { block: 'start' })
  await pressSelector(page, press, `${SYNC_CARD} [data-step="statements"] [data-testid="sync-step-undo"]`)
  await toast(page, 'Undone')
  await page
    .waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, `${SYNC_CARD} [data-testid="sync-step-undo"]`)
    .catch(() => {
      throw new Error('the statements step still offers Undo after it was undone')
    })
  await dismissToasts(page)

  await pressSelector(page, press, `${SYNC_CARD} [data-testid="sync-again"]`)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
  await noToast(page, 'a sync from the Sync card showed a toast')
  await page.evaluate(() => {
    window.location.hash = '#/company/transactions?tab=import'
  })
  await page.waitForSelector('[data-testid="statement-folder-filed"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Import does not list the statement the sync filed')
  })
  await delay(300)
  await shoot('statements-folder-filed')

  await syncAndSettle(page, press)
  await noToast(page, 'a sync that found nothing new showed a toast')
  if (await page.$('[data-testid="statement-folder"]')) throw new Error('the folder card stayed after a sync that found nothing new')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'statements', 'done', /Nothing new/)
}

/**
 * With a statement of an account the accounts tab lacks in the folder, Sync files the sample and
 * holds the other: the control says 1 problem, and its steps, in a popover from 640 px and a bottom
 * sheet on a phone, link to Import, which offers to add the account. Overview lists the held
 * statement too. Named and confirmed on Import, the account is added and the statement filed.
 */
export async function heldStatementFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await noToast(page, 'a sync that held a statement showed a toast')
  await inspect?.('the sync control with a problem')
  await shoot('sync-problem')
  await press(await syncButton(page))
  const said = await stepSays(page, '', 'statements', 'waits', /1 statement was not filed/)
  if (!FILED.test(said)) throw new Error(`the statements step does not say what it filed, it says: ${said}`)
  await delay(400)
  await inspect?.('the steps of the last sync')
  await shoot('sync-steps')
  await pressSelector(page, press, `${SYNC_STEPS} [data-step="statements"] a`)
  await page
    .waitForFunction(() => document.querySelector('[data-testid="statement-folder"] [data-testid="dry-run-new-account"]')?.textContent?.includes('is new') ?? false, { timeout: 10_000 })
    .catch(() => {
      throw new Error('Import does not offer the account the held statement names')
    })
  await page
    .waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, SYNC_STEPS)
    .catch(() => {
      throw new Error('the steps stayed open over Import')
    })
  await delay(300)
  await inspect?.('the held statement on Import')
  await shoot('statements-held-import')
  await page.evaluate(() => {
    window.location.hash = '#/company'
  })
  const job = await page.waitForSelector('[data-job="statements"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Overview has no line for the statement the sync held')
  })
  const text = await job.evaluate((element) => element.textContent ?? '')
  if (!text.includes('1 statement was not filed')) throw new Error(`the held statement's line says: ${text}`)

  await page.evaluate(() => {
    window.location.hash = '#/company/transactions?tab=import'
  })
  const name = await page.waitForSelector('[data-testid="statement-folder"] input[data-testid="dry-run-account-name"]', { visible: true, timeout: 10_000 })
  await setField(name, 'second')
  await pressSelector(page, press, '[data-testid="statement-folder-confirm"]')
  await toastMatching(page, /^Filed statement/)
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="dry-run-new-account"]'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('the held statement still offers its account after it was filed')
    })
  await page.evaluate(() => {
    window.location.hash = '#/company/settings?tab=accounts'
  })
  await page
    .waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === 'second'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('Settings, Accounts does not list the account the import added')
    })
}

/** Makes the next load's token come without Drive read, as when the person unticked it on Google's consent screen. */
async function withoutDriveRead(page) {
  await page.evaluate(() => localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'gmail.compose'])))
  await page.reload({ waitUntil: 'networkidle0' })
}

/**
 * A token Google gave without Drive read: Overview offers nothing, the sync control shows Allow
 * access as the app opens, and that tap asks Google and files the sample, with no toast.
 */
export async function statementAccessFlow(page, { press, shoot, inspect }) {
  await withoutDriveRead(page)
  const control = await controlShows(page, 'allow-access')
  if (control.label !== 'Allow access') throw new Error(`the sync control says "${control.label}", not Allow access`)
  if (!control.name.includes('Statements needs your Drive read access')) throw new Error(`a screen reader hears "${control.name}"`)
  if (await page.$('[data-job="check-statements"]')) throw new Error('Overview still offers to check for new statements')
  await inspect?.('the sync control asking for access')
  await shoot('sync-allow-access')
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await noToast(page, 'the sync after Allow access showed a toast')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
}

/** With a slow statements folder, the control names the running step and its place, and a screen reader hears it, until the sync is done. */
/** What the control under this selector shows while a save waits: where it stands, whether it is grayed and whether it spins. */
function savingControl(page, selector) {
  return page.evaluate(savingLook, selector)
}

/** A switch's track while it saves is the off colour whichever way it goes, so one saving towards On does not already read as on. Its thumb shows the value. */
function savingLook(chosen) {
  const control = document.querySelector(chosen)
  const probe = document.createElement('div')
  probe.style.background = 'var(--ui-bg-accented)'
  document.body.append(probe)
  const accented = getComputedStyle(probe).backgroundColor
  probe.remove()
  return {
    value: control?.getAttribute('aria-checked') ?? control?.textContent?.trim() ?? null,
    disabled: control?.matches(':disabled') ?? false,
    spinning: (control?.querySelector('.animate-spin') ?? control?.parentElement?.querySelector('.animate-spin')) != null,
    looksSaving: control?.getAttribute('role') !== 'switch' || getComputedStyle(control).backgroundColor === accented,
  }
}

async function controlSaving(page, selector, was) {
  const deadline = Date.now() + 1_500
  let look = await savingControl(page, selector)
  while (Date.now() < deadline && !(look.value !== was && look.disabled && look.spinning && look.looksSaving)) {
    await delay(50)
    look = await savingControl(page, selector)
  }
  if (!(look.value !== was && look.disabled && look.spinning && look.looksSaving)) {
    throw new Error(`the control did not move at once, grayed with a spinner: ${JSON.stringify(look)}, it stood at ${was}`)
  }
}

async function controlLanded(page, selector) {
  await page
    .waitForFunction((chosen) => document.querySelector(chosen)?.matches(':disabled') === false, { timeout: 15_000 }, selector)
    .catch(() => {
      throw new Error('the control stays grayed after its save')
    })
}

const LOAN_SWITCH = '[data-testid="loan-bucket"] [role="switch"]'

/** The shot's name in the page's language, so the English and the Croatian run of one flow keep a shot each. */
async function shotInLanguage(page, name) {
  return (await page.evaluate(() => document.documentElement.lang)) === 'hr' ? `${name}-croatian` : name
}

/** Settings, General, with saves that take seconds: the switch moves at once and spins while the form stays usable, and what is typed there survives the switch's save. */
export async function savesWaitingFlow(page, { press, shoot, inspect }) {
  const handle = await page.waitForSelector(LOAN_SWITCH, { visible: true, timeout: 10_000 })
  await handle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  const { value: was } = await savingControl(page, LOAN_SWITCH)
  await press(handle)
  await controlSaving(page, LOAN_SWITCH, was)
  await shoot(await shotInLanguage(page, 'saves-waiting-switch'))

  const folder = await page.waitForSelector('[data-testid="statements-folder"] input', { visible: true, timeout: 5_000 })
  await setField(folder, 'Typed/while/saving')
  await controlLanded(page, LOAN_SWITCH)
  await inspect?.('the switch once its save landed')
  if ((await folder.evaluate((input) => input.value)) !== 'Typed/while/saving') throw new Error('the save that landed wiped what was typed in the form')
  if ((await savingControl(page, LOAN_SWITCH)).value === was) throw new Error('the switch went back after its save landed')

  // The fake books start on, so this tap saves towards On, where a track left amber would already read as on.
  const off = (await savingControl(page, LOAN_SWITCH)).value
  await press(handle)
  await controlSaving(page, LOAN_SWITCH, off)
  await shoot(await shotInLanguage(page, 'saves-waiting-switch-on'))
  await controlLanded(page, LOAN_SWITCH)

  const undo = await page.waitForFunction(
    () => [...document.querySelectorAll('[data-slot="actions"] button')].filter((button) => ['Undo', 'Poništi'].includes(button.textContent?.trim())).at(-1) ?? null,
    { timeout: 5_000 },
  )
  await undo.asElement().evaluate((button) => button.click())
  await controlSaving(page, LOAN_SWITCH, 'true')
  await controlLanded(page, LOAN_SWITCH)

  const save = await page.waitForSelector('form button[type="submit"]:not(:disabled)', { timeout: 5_000 })
  await save.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(save)
  await page.waitForSelector('form button[type="submit"] .animate-spin', { timeout: 2_000 }).catch(() => {
    throw new Error('the form Save does not spin while its save waits')
  })
  await shoot(await shotInLanguage(page, 'saves-waiting-form'))
  await page.waitForFunction(() => document.querySelector('[data-testid="write-progress"]') === null, { timeout: 15_000 })
}

/** Investments, Settings, with saves that take seconds: the benchmark select shows the choice at once, grayed with a spinner. */
export async function savesWaitingBenchmarkFlow(page, { press, shoot }) {
  const selector = '[data-testid="benchmark-choice"]'
  const trigger = await page.waitForSelector(selector, { visible: true, timeout: 10_000 })
  const { value: was } = await savingControl(page, selector)
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(trigger)
  const option = await page.waitForFunction(
    (current) => [...document.querySelectorAll('[role="option"]')].find((candidate) => candidate.textContent?.trim() !== current) ?? null,
    { timeout: 5_000 },
    was,
  )
  await press(option.asElement())
  await controlSaving(page, selector, was)
  await shoot(await shotInLanguage(page, 'saves-waiting-benchmark'))
  await controlLanded(page, selector)
  if ((await savingControl(page, selector)).value === was) throw new Error('the select went back after its save landed')
}

/** Settings, General, with a save that fails: the switch moves at once, then flips back, a toast says why, and its Try again saves it. */
export async function saveFailsFlow(page, { press, shoot }) {
  const handle = await page.waitForSelector(LOAN_SWITCH, { visible: true, timeout: 10_000 })
  await handle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  const { value: was } = await savingControl(page, LOAN_SWITCH)
  await press(handle)
  await controlSaving(page, LOAN_SWITCH, was)
  const writes = (await page.evaluate(() => document.documentElement.lang)) === 'hr' ? writesCroatian : writesEnglish
  const plainSentence = writes.driveFailed
  await page
    .waitForFunction((sentence) => [...document.querySelectorAll('[data-slot="description"]')].some((toast) => toast.textContent?.endsWith(`: ${sentence}`)), { timeout: 15_000 }, plainSentence)
    .catch(() => {
      throw new Error('no toast names the write that failed in one plain sentence')
    })
  await controlLanded(page, LOAN_SWITCH)
  if ((await savingControl(page, LOAN_SWITCH)).value !== was) throw new Error('the switch did not flip back after its save failed')
  const tryAgain = await page
    .waitForFunction((label) => [...document.querySelectorAll('[data-slot="actions"] button')].find((button) => button.textContent?.trim() === label) ?? null, { timeout: 5_000 }, writes.tryAgain)
    .catch(() => {
      throw new Error('the toast of the failed save offers no Try again')
    })
  // The toast slides in, so the shot waits until it stands still and Try again sits inside the window.
  await page
    .waitForFunction(
      (button) => {
        const box = button.getBoundingClientRect()
        const still = window.tryAgainLeft === box.left
        window.tryAgainLeft = box.left
        return still && box.left >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight
      },
      { polling: 100, timeout: 5_000 },
      tryAgain,
    )
    .catch(() => {
      throw new Error('Try again on the toast of the failed save does not settle inside the window')
    })
  await shoot(await shotInLanguage(page, 'save-fails'))
  await press(tryAgain.asElement())
  await controlSaving(page, LOAN_SWITCH, was)
  await controlLanded(page, LOAN_SWITCH)
  if ((await savingControl(page, LOAN_SWITCH)).value === was) throw new Error('the switch went back after Try again saved it')
}

export async function syncRunningFlow(page, { press, shoot, inspect }) {
  await press(await syncButton(page))
  const running = await controlShows(page, 'running')
  await page
    .waitForFunction(() => document.querySelector('[data-testid="sync-button"]')?.getAttribute('aria-label')?.startsWith('Syncing, Statements, step 2 of 2') ?? false, { timeout: 10_000 })
    .catch(async () => {
      throw new Error(`the running control does not name the statements step, a screen reader hears "${running.name}"`)
    })
  const shown = await controlShows(page, 'running')
  if (!shown.disabled) throw new Error('the sync control takes a tap while the sync runs')
  if (!/^Statements 2\/2$|^Syncing$/.test(shown.label)) throw new Error(`the running control says "${shown.label}"`)
  await inspect?.('the sync control while the statements step runs')
  await shoot('sync-running')
  const ready = await controlShows(page, 'ready')
  if (!ready.name.startsWith('Synced ')) throw new Error(`the ready control is heard as "${ready.name}"`)
  await inspect?.('the sync control once the sync is done')
  await shoot('sync-ready')
}

/**
 * A held statement in a language: the sync control says 1 problem, its steps name the statements
 * step and link to Import, which offers to add the account the statement names. Nothing is written.
 */
export function heldStatementFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await syncAndSettle(page, press)
    await controlShows(page, 'problems')
    await press(await syncButton(page))
    const held = countedIn(words, words.imports.step.held(1), 1)
    await stepSays(page, '', 'statements', 'waits', new RegExp(held.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await delay(400)
    await inspect?.('the steps of the last sync')
    await shoot('sync-steps')
    await pressSelector(page, press, `${SYNC_STEPS} [data-step="statements"] a`)
    await page.waitForSelector('[data-testid="statement-folder"] [data-testid="dry-run-new-account"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Import does not offer the account the held statement names')
    })
    await elementSays(page, '[data-testid="statement-folder"]', [words.imports.folder.title, words.imports.folder.filedByLastSync], 'the statements folder card is not in its language')
    await delay(300)
    await inspect?.('the held statement on Import')
    await shoot('statements-held-import')
  }
}

const MAIL_CARD = '[data-testid="mail-settings"]'
const MAIL_PLAN = '[data-testid="mail-plan"]'
const MAIL_FILED = /Filed 2, already there 2, 1 unmatched\./

/** Waits until the mail card lists the sources in these states, and returns what each source's line says. */
async function mailListShows(page, wanted) {
  return page
    .waitForFunction(
      (selector, expected) => {
        const sources = [...document.querySelectorAll(`${selector} [data-source]`)].map((source) => `${source.dataset.source}:${source.dataset.state}`)
        return JSON.stringify(sources) === JSON.stringify(expected) ? [...document.querySelectorAll(`${selector} [data-testid="mail-source-line"]`)].map((line) => line.textContent?.trim()) : null
      },
      { timeout: 10_000 },
      MAIL_PLAN,
      wanted,
    )
    .then((handle) => handle.jsonValue())
    .catch(async () => {
      const shown = await page.evaluate(
        (selector) => [...document.querySelectorAll(`${selector} [data-source]`)].map((source) => `${source.dataset.source}:${source.dataset.state}`).join(', '),
        MAIL_PLAN,
      )
      throw new Error(`the mail card does not list ${wanted.join(', ')}, it lists ${shown || 'nothing'}`)
    })
}

/** Presses the link of the mail step's line, the one in the steps on screen, and waits for the mail card to open on its list. */
async function openMailList(page, press, scope) {
  await pressSelector(page, press, `${scope} ${SYNC_STEPS} [data-step="mail"] a`)
  await page
    .waitForFunction((selector) => document.querySelector(selector)?.getAttribute('data-collapsed') === 'false', { timeout: 10_000 }, MAIL_CARD)
    .catch(() => {
      throw new Error('the link of the mail step did not open the mail card')
    })
}

/** Scrolls the element under the selector to the top of the window, below the bars that stick there. */
async function scrollToTop(page, selector) {
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'start' }))
  await delay(300)
}

const ALL_SOURCES = ['statements:planned']

/**
 * A sync in a language and every place that says how it went: the sync control before, during and
 * after it, the steps it opens when it has something to say, the sync card on Kuna settings, and the
 * mail card with what the mail step found. `stored` is what this device keeps before the page loads
 * again, such as a token without Gmail read, and a null takes the key away. Each state is inspected,
 * so the visual check reads its words, and the fake variant decides what the sync meets.
 */
export function syncStatesFlowIn(language, stored = {}) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(`${name}-${language}`)
    if (Object.keys(stored).length > 0) {
      await page.evaluate((entries) => {
        for (const [key, value] of Object.entries(entries)) {
          if (value === null) localStorage.removeItem(key)
          else localStorage.setItem(key, value)
        }
      }, stored)
      await page.reload({ waitUntil: 'networkidle0' })
    }
    await inspect?.('the sync control before the sync')
    await press(await syncButton(page))
    await inspect?.('the sync control as the sync runs')
    await page
      .waitForFunction((selector) => [...document.querySelectorAll(selector)].some((element) => element.offsetParent !== null && !element.disabled), { timeout: 12_000, polling: 100 }, SYNC_BUTTON)
      .catch(() => {
        throw new Error('the sync did not finish within 12 s')
      })
    await delay(400)
    await inspect?.('the sync control once the sync is done')
    await shoot('sync-control')
    const control = await page.evaluate(() => [...document.querySelectorAll('[data-testid="sync-status"]')].find((element) => element.offsetParent !== null)?.dataset.control ?? '')
    if (control === 'problems') {
      await press(await syncButton(page))
      await page.waitForSelector(`${SYNC_STEPS} [data-step]`, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the sync control with problems did not open its steps')
      })
      await delay(400)
      await inspect?.('the steps the sync control opens')
      await shoot('sync-steps')
      await page.keyboard.press('Escape')
      await delay(300)
    }
    await openKunaSettings(page)
    await scrollToTop(page, SYNC_CARD)
    await inspect?.('the sync card on Kuna settings')
    await shoot('sync-card')
    await page.evaluate(() => {
      window.location.hash = '#/company/settings#mail'
    })
    await page.waitForSelector(MAIL_CARD, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Settings, General has no mail card at #mail')
    })
    await scrollToTop(page, MAIL_CARD)
    await inspect?.('the mail card')
    await shoot('mail-card')
  }
}

/** The mail card in a language once a sync filed the fake mailbox: every source's line, search and files, opened from the mail step's link. */
export function mailListFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await syncAndSettle(page, press)
    await openKunaSettings(page)
    await stepSays(page, SYNC_CARD, 'statements', 'done', /./)
    await scrollToTop(page, SYNC_CARD)
    await shoot('mail-step')
    await openMailList(page, press, SYNC_CARD)
    await mailListShows(page, ALL_SOURCES)
    await elementSays(page, MAIL_CARD, [words.mail.card.title, words.mail.card.lastSync, words.mailPlan.kinds.filed], 'the mail card is not in its language')
    await scrollToTop(page, MAIL_PLAN)
    await inspect?.('the mail list')
    await shoot('mail-list')
  }
}

/**
 * The mail list specimens in the Company gallery: the bank's statements with every kind of entry, more than ten so Show all shows
 * the rest, and a second source that failed, then a list whose step stopped. The fake mailbox's bank mail alone never shows those.
 * The gallery is English only.
 */
export async function mailPlanSpecimenFlow(page, { press, shoot, inspect }) {
  const specimen = '[data-testid="gallery-mail-plan"]'
  await page.waitForSelector(specimen, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the Company gallery has no mail list specimen')
  })
  await mailListShows(page, ['statements:planned', 'savings-statements:failed'])
  const entries = () => page.$$eval(`${specimen} [data-entry]`, (rows) => rows.map((row) => row.dataset.entry))
  if ((await entries()).length !== 10) throw new Error(`the mail list specimen shows ${(await entries()).length} entries before Show all, not 10`)
  await scrollToTop(page, specimen)
  await inspect?.('the mail list specimen')
  await shoot('mail-plan-specimen')
  await pressSelector(page, press, `${specimen} [data-testid="show-all"]`)
  await page
    .waitForFunction((css) => document.querySelectorAll(css).length === 12, { timeout: 5_000 }, `${specimen} [data-entry]`)
    .catch(() => {
      throw new Error('Show all on the mail list specimen did not show all 12 entries')
    })
  const kinds = new Set(await entries())
  for (const kind of ['not-filed', 'filed', 'unmatched', 'already']) {
    if (!kinds.has(kind)) throw new Error(`the mail list specimen has no ${kind} entry`)
  }
  await inspect?.('the mail list specimen with every entry')
  const stopped = await page.$eval('[data-testid="gallery-mail-stopped"] [data-testid="mail-stopped"]', (paragraph) => paragraph.textContent?.trim() ?? '').catch(() => '')
  if (stopped !== 'Gmail asked us to slow down. Sync again in a minute.') throw new Error(`the stopped mail list specimen says "${stopped}"`)
  await scrollToTop(page, '[data-testid="gallery-mail-stopped"]')
  await inspect?.('the mail list specimen whose step stopped')
  await shoot('mail-plan-specimen-stopped')
}

/**
 * With no sender named, the mail step is off in the steps of a sync. On Settings, General the mail
 * card takes a sender, asks for the subject a sender needs, and saves both, and the next sync's mail
 * step files the bank's new PDF and lists the rest. The page holds every scope, as a first open
 * does, so the save asks Google nothing.
 */
export async function mailOffFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => {
    for (const key of ['kuna.google-granted', 'kuna.google-needed']) localStorage.removeItem(key)
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await syncAndSettle(page, press)
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'off', /Off in Settings/)
  const leftOut = await page.evaluate(
    (css) => ['rates', 'secrets', 'bank-sync'].filter((id) => document.querySelector(`${css} [data-step="${id}"][data-state="off"]`) !== null),
    `${SYNC_CARD} ${SYNC_STEPS}`,
  )
  if (leftOut.length > 0) throw new Error(`the step list shows ${leftOut.join(', ')}, which are left out while the file has nothing for them`)
  await page.evaluate(() => {
    window.location.hash = '#/company/settings#mail'
  })
  const senders = await page.waitForSelector(`${MAIL_CARD} [data-testid="statements-mail-from"] input`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Settings, General has no mail card open at #mail')
  })
  await scrollToTop(page, MAIL_CARD)
  await inspect?.('the mail card with no sender')
  await shoot('mail-card-off')
  await setField(senders, 'statements@bank.example.com')
  await page
    .waitForFunction(
      (selector) => document.querySelector(`${selector} [data-testid="statements-mail-subject"]`)?.textContent?.includes('name the words before the statement number') ?? false,
      { timeout: 5_000 },
      MAIL_CARD,
    )
    .catch(() => {
      throw new Error('the mail card does not ask for a subject beside a sender')
    })
  await saveSettingsButton(page, false)
  await setField(await page.$(`${MAIL_CARD} [data-testid="statements-mail-subject"] input`), 'Izvadak')
  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  await dismissToasts(page)
  await syncAndSettle(page, press)
  await noToast(page, 'a sync with mail on showed a toast')
  const lines = await mailListShows(page, ['statements:planned'])
  if (!/^Filed 1, already there 3, 1 unmatched\.$/.test(lines[0] ?? '')) throw new Error(`the bank's mail reads "${lines[0]}"`)
  await scrollToTop(page, MAIL_CARD)
  await inspect?.('the mail card once saved and synced')
  await shoot('mail-card-saved')
}

/**
 * With the bank's mail named, the mail step files the bank's PDF and statement into the fake Drive,
 * and the statements step of the same sync files that statement on the ledger. Its link opens the
 * list on the mail card, which marks what was filed beside what was there already or needs a look.
 * A second sync files nothing new.
 */
export async function mailFiledFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await noToast(page, 'a sync that filed mail showed a toast')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', MAIL_FILED)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
  await scrollToTop(page, SYNC_CARD)
  await inspect?.('the mail step that filed a statement, and the statements step that read it')
  await shoot('mail-step')
  await openMailList(page, press, SYNC_CARD)
  const lines = await mailListShows(page, ALL_SOURCES)
  if (lines[0] !== 'Filed 2, already there 2, 1 unmatched.') throw new Error(`the bank's mail reads "${lines[0]}"`)
  for (const kind of ['filed', 'already', 'unmatched']) {
    if ((await page.$(`${MAIL_PLAN} [data-entry="${kind}"]`)) === null) throw new Error(`the list has no ${kind} entry`)
  }
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list of what the mail step filed and found')
  await shoot('mail-list')

  await syncAndSettle(page, press)
  const again = await mailListShows(page, ALL_SOURCES)
  if (again[0] !== 'Nothing new, already there 3.') throw new Error(`a second sync's bank mail reads "${again[0]}"`)
  await openKunaSettings(page)
  const line = await stepSays(page, SYNC_CARD, 'mail', 'done', /Nothing new, already there 3\./)
  if (line.includes('Filed')) throw new Error(`a second sync's mail step says "${line}"`)
  await stepSays(page, SYNC_CARD, 'statements', 'done', /Nothing new/)
}

/**
 * The upload of every PDF fails beside the other files: the mail step fails with the PDF named by
 * its source, 1 problem in the control, the statement still on the ledger from the same sync, and the
 * list marks the bank's PDF not filed with why.
 */
export async function mailUploadFailedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(page, '', 'mail', 'failed', /Filed 1, already there 2, 1 unmatched\. Bank statements: \d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf was not filed\./)
  await stepSays(page, '', 'statements', 'done', FILED)
  await delay(400)
  await inspect?.('the steps with an upload that failed')
  await shoot('mail-upload-failed-steps')
  await openMailList(page, press, '')
  const lines = await mailListShows(page, ALL_SOURCES)
  if (!/^Filed 1, already there 2, 1 unmatched\. \d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf was not filed\.$/.test(lines[0] ?? '')) throw new Error(`the bank's mail reads "${lines[0]}"`)
  const entry = await page.$(`${MAIL_PLAN} [data-source="statements"] [data-entry="not-filed"]`)
  if (entry === null) throw new Error('the list marks no entry not filed')
  if (!(await entry.evaluate((element) => element.textContent ?? '')).includes('Drive did not take the upload. Sync again later.')) throw new Error('the entry not filed does not say why')
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list with an upload that failed')
  await shoot('mail-upload-failed-list')
}

/** Mail that is all filed already says nothing new, and opens no problem. */
export async function mailNothingNewFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', /Nothing new, already there 3\./)
  await scrollToTop(page, SYNC_CARD)
  await inspect?.('the mail step with nothing new')
  await shoot('mail-nothing-new')
}

/** A source whose search fails fails the mail step with why in its line: 1 problem in the control, and the steps open on it with the list a link away. */
export async function mailFailedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(page, '', 'mail', 'failed', /Bank statements: Gmail did not answer the search/)
  await delay(400)
  await inspect?.('the steps with a mail source that failed')
  await shoot('mail-failed-steps')
  await openMailList(page, press, '')
  const lines = await mailListShows(page, ['statements:failed'])
  if (lines[0] !== 'Gmail did not answer the search. Sync again later.') throw new Error(`the failed source reads "${lines[0]}"`)
  await shootAt(page, shoot, `${MAIL_PLAN} [data-source="statements"]`, 'mail-failed-list')
}

/** A token without Gmail read shows Allow access for the mail step as the app opens, and that tap runs it. */
export async function mailAccessFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'drive.readonly', 'gmail.compose'])))
  await page.reload({ waitUntil: 'networkidle0' })
  const control = await controlShows(page, 'allow-access')
  if (control.label !== 'Allow access') throw new Error(`the sync control says "${control.label}", not Allow access`)
  if (!control.name.includes('Mail needs your Gmail read access')) throw new Error(`a screen reader hears "${control.name}"`)
  await inspect?.('the sync control asking for Gmail read access')
  await shoot('mail-allow-access')
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', MAIL_FILED)
}

/**
 * A token without Gmail read and the mail step off: saving a sender and subject on the Mail card
 * asks Google in that same tap, so the sync control never shows Allow access, and the sync that
 * follows the save files the bank's mail.
 */
export function mailSaveAsksFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const filed = `${words.mailCounts({ filed: 1, notFiled: 0, already: 3, unmatched: 1 })}.`
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.evaluate(() => {
      for (const key of ['kuna.google-needed', 'kuna.google-silent-refused']) localStorage.removeItem(key)
      localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'drive.readonly', 'gmail.compose']))
    })
    await page.reload({ waitUntil: 'networkidle0' })
    await controlShows(page, 'ready')
    await page.evaluate(() => {
      window.location.hash = '#/company/settings#mail'
    })
    const senders = await page.waitForSelector(`${MAIL_CARD} [data-testid="statements-mail-from"] input`, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Settings, General has no mail card open at #mail')
    })
    await setField(senders, 'statements@bank.example.com')
    await setField(await page.$(`${MAIL_CARD} [data-testid="statements-mail-subject"] input`), 'Izvadak')
    await press(await saveSettingsButton(page, true, words))
    await toast(page, words.settings.saved)
    const lines = await mailListShows(page, ['statements:planned'])
    if (lines[0] !== filed) throw new Error(`the sync after the save reads the bank's mail as "${lines[0]}", not "${filed}"`)
    const control = await controlShows(page, 'ready')
    if (control.label === words.sync.allowAccess) throw new Error('the sync control asks for access after a save that asked for it')
    const granted = await page.evaluate(() => JSON.parse(localStorage.getItem('kuna.google-granted') ?? '[]'))
    if (!granted.includes('gmail.readonly')) throw new Error(`the save asked Google for ${granted.join(', ')}, without Gmail read`)
    await scrollToTop(page, MAIL_CARD)
    await inspect?.('the mail card saved with Gmail read asked in the same tap')
    await shoot('mail-save-asks')
    await page.evaluate(() => localStorage.removeItem('kuna.google-granted'))
  }
}

export const mailSaveAsksFlow = mailSaveAsksFlowIn('en')

/** Waits until the switch under the test id is on or off, and returns it. */
async function switchIs(page, testId, checked) {
  const selector = `:is([data-testid="${testId}"][role="switch"], [data-testid="${testId}"] [role="switch"])`
  await page
    .waitForFunction((css, wanted) => document.querySelector(css)?.getAttribute('aria-checked') === wanted, { timeout: 10_000 }, selector, String(checked))
    .catch(() => {
      throw new Error(`the ${testId} switch is not ${checked ? 'on' : 'off'}`)
    })
  return page.$(selector)
}

/** Gmail still asking to slow down after the retries fails the mail step with one plain sentence, and none of Google's answer. The mail card says the same sentence in place of its list. */
export async function mailRateLimitedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  const line = await stepSays(page, '', 'mail', 'failed', /Mail: Gmail asked us to slow down\. Sync again in a minute\.$/)
  if (/[{}]|rateLimit|403|429/.test(line)) throw new Error(`the mail step shows Google's answer: "${line}"`)
  await delay(400)
  await inspect?.('the steps after Gmail asked to slow down')
  await shoot('mail-rate-limited')
  await page.keyboard.press('Escape')
  await delay(300)
  await page.evaluate(() => {
    window.location.hash = '#/company/settings#mail'
  })
  const said = await page
    .waitForSelector(`${MAIL_PLAN} [data-testid="mail-stopped"]`, { visible: true, timeout: 10_000 })
    .then((element) => element.evaluate((paragraph) => paragraph.textContent?.trim() ?? ''))
    .catch(() => {
      throw new Error('the mail card does not say why the last sync stopped')
    })
  if (said !== 'Gmail asked us to slow down. Sync again in a minute.') throw new Error(`the mail card says "${said}"`)
  await shootAt(page, shoot, `${MAIL_PLAN} [data-testid="mail-stopped"]`, 'mail-rate-limited-card')
}

/** With every mail already in its folder, filed by another app, the source searches from a week before the newest file there and not from the mail-since day. */
export async function mailWindowFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await page.evaluate(() => {
    window.location.hash = '#/company/settings#mail'
  })
  await mailListShows(page, ALL_SOURCES)
  const windows = await page.$$eval(`${MAIL_PLAN} [data-testid="mail-source-window"]`, (lines) => lines.map((line) => line.textContent?.trim() ?? ''))
  if (windows.length !== 1 || !windows.every((line) => /^Searched from \d{1,2} \w{3,4} 2026, a week before the newest file in its folder$/.test(line)))
    throw new Error(`the sources searched ${JSON.stringify(windows)}`)
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list searched from a week before the newest file in the folder')
  await shoot('mail-window')
}

/**
 * A device whose silent trip Google refused, as Firefox does, shows Allow access before any sync.
 * With `?fake=google-closed` Google's window closes in that tap: the control stays in Allow access
 * with a line that says what happened and that a tap tries again, beside the sidebar's button or in
 * what a screen reader hears and the top bar button's tooltip, and no toast shows.
 */
export async function accessClosedFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => localStorage.setItem('kuna.google-silent-refused', 'interaction_required'))
  await page.reload({ waitUntil: 'networkidle0' })
  await controlShows(page, 'allow-access')
  await press(await syncButton(page))
  const said = "Google's window was closed before access was allowed. Tap Allow access to try again."
  await page
    .waitForFunction(
      (text) => [...document.querySelectorAll('[data-testid="sync-button"]')].some((button) => button.offsetParent !== null && (button.getAttribute('aria-label') ?? '').includes(text)),
      { timeout: 10_000 },
      said,
    )
    .catch(async () => {
      throw new Error(`a screen reader does not hear why Google gave no token, it hears "${(await controlShows(page, 'allow-access')).name}"`)
    })
  const control = await controlShows(page, 'allow-access')
  if (control.label !== 'Allow access') throw new Error(`the sync control says "${control.label}", not Allow access`)
  const shown = await page.evaluate(() => {
    const line = [...document.querySelectorAll('[data-testid="sync-line"]')].find((element) => element.offsetParent !== null)
    const button = [...document.querySelectorAll('[data-testid="sync-button"]')].find((element) => element.offsetParent !== null)
    return line === undefined ? (button?.getAttribute('title') ?? '') : (line.textContent?.trim() ?? '')
  })
  if (shown !== said) throw new Error(`the sync control says "${shown}" after Google's window closed`)
  if (await page.$('[data-testid="sync-steps"] [data-step]')) throw new Error('a sync ran after Google gave no token')
  await noToast(page, 'a closed Google window showed a toast')
  await inspect?.("the sync control after Google's window closed")
  await shoot('sync-access-closed')
  await page.evaluate(() => localStorage.removeItem('kuna.google-silent-refused'))
}

/** Transactions, To review: open the gadget purchase in the queue, then split it, edit and delete the split and Undo, as on Transactions. */
export function reviewSplitFlowIn(language) {
  const split = splitFlowIn(language)
  return async (page, context) => {
    const summary = await page
      .waitForFunction(() => [...document.querySelectorAll('[data-testid="review-row"] > button')].find((button) => button.textContent?.includes('GADGET CORNER')) ?? null, { timeout: 10_000 })
      .then((handle) => handle.asElement())
      .catch(() => {
        throw new Error('the queue does not hold the gadget purchase')
      })
    await summary.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await context.press(summary)
    await page.waitForSelector('[data-testid="review-details"]')
    await split(page, { ...context, shoot: (name) => context.shoot(`review-${name}`) })
  }
}

export const reviewSplitFlow = reviewSplitFlowIn('en')

/** Opens a collapsed card by its test id, scrolled to the middle first. */
async function openCard(page, press, testId) {
  const toggle = await page.waitForSelector(`[data-testid="${testId}"] [data-testid="card-toggle"]`, { timeout: 10_000 }).catch(() => {
    throw new Error(`no card ${testId}`)
  })
  if ((await toggle.evaluate((element) => element.getAttribute('aria-expanded'))) === 'true') return
  await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(toggle)
  await delay(300)
}

function coverageGroupShown(page, name, shown) {
  return page
    .waitForFunction(
      (wanted, present) => [...document.querySelectorAll('[data-testid="coverage-gap"]')].some((group) => group.textContent?.includes(wanted)) === present,
      { timeout: 10_000 },
      name,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `${name} is not listed among the rows no rule settles` : `${name} is still listed among the rows no rule settles`)
    })
}

/**
 * Settings, Category rules: dismiss a group no rule settles, find it under the dismissed suggestions, restore
 * it, and Undo the restore.
 */
export function dismissFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openCard(page, press, 'rule-coverage')
    await coverageGroupShown(page, 'Laptop Store', true)
    const group = await page.evaluateHandle(() => [...document.querySelectorAll('[data-testid="coverage-gap"]')].find((row) => row.textContent?.includes('Laptop Store')))
    const dismiss = await group.asElement().$('[data-testid="coverage-dismiss"]')
    await dismiss.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(dismiss)
    await delay(400)
    await toast(page, words.rules.suggestions.dismissed('Laptop Store'))
    await coverageGroupShown(page, 'Laptop Store', false)
    await dismissToasts(page)
    await openCard(page, press, 'dismissed-suggestions')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="dismissed-suggestion"]')?.textContent?.includes('Laptop Store') ?? false, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the dismissed group is not under the dismissed suggestions')
      })
    await inspect?.('dismissed suggestions')
    await shoot('dismissed-suggestions')
    await pressSelector(page, press, '[data-testid="restore-suggestion"]')
    await toast(page, words.rules.suggestions.restored)
    await coverageGroupShown(page, 'Laptop Store', true)
    await undoIn(page, press, words)
    await coverageGroupShown(page, 'Laptop Store', false)
    await shoot('dismiss-undone')
    await dismissToasts(page)
  }
}

export const dismissFlow = dismissFlowIn('en')

const STATEMENTS_FOLDER = '[data-testid="statements-folder"]'

/** The Save settings button once it is enabled or disabled, as `enabled` asks. */
async function saveSettingsButton(page, enabled, words = SCREEN_WORDS.en) {
  return page
    .waitForFunction(
      (wanted, label) => [...document.querySelectorAll('button[type="submit"]')].find((button) => button.textContent?.trim() === label && button.disabled === !wanted) ?? null,
      { timeout: 10_000 },
      enabled,
      words.settings.general.save,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`Save settings did not become ${enabled ? 'enabled' : 'disabled'}`)
    })
}

/**
 * Settings, General shows the statements folder the books name, Save waits for a change, and a new
 * path is written to the same row. Settings keep no Undo, so the flow leaves the row in the workbook.
 */
export function statementsFolderFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const field = await page.waitForSelector(`${STATEMENTS_FOLDER} input`, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Settings, General has no statements folder field')
    })
    await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    const shown = await field.evaluate((element) => element.value)
    if (shown !== 'finance/statements') throw new Error(`the field shows "${shown}", not the path the books name`)
    await saveSettingsButton(page, false, words)
    await inspect?.('the statements folder the books name')
    await shoot('statements-folder-named')

    await setField(field, 'finance/bank statements/')
    await press(await saveSettingsButton(page, true, words))
    await toast(page, words.settings.saved)
    await saveSettingsButton(page, false, words)
    await shootAt(page, shoot, field, 'statements-folder-saved')
    await dismissToasts(page)
  }
}

export const statementsFolderFlow = statementsFolderFlowIn('en')

const FACT_ROW = '[data-testid="fact-row"]'
const CARD_IBANS = '[data-testid="card-settlement-ibans"]'
const NEW_IBAN = 'GB82WEST12345698765432'

/** The tags an IBAN field under this selector shows, as their text. */
function tagsIn(page, selector) {
  return page.$$eval(`${selector} [data-slot="item"]`, (items) => items.map((item) => item.textContent?.trim() ?? ''))
}

async function waitForTags(page, selector, wanted, when) {
  await page
    .waitForFunction(
      (scope, tags) => JSON.stringify([...document.querySelectorAll(`${scope} [data-slot="item"]`)].map((item) => item.textContent?.trim() ?? '')) === JSON.stringify(tags),
      { timeout: 5_000 },
      selector,
      wanted,
    )
    .catch(async () => {
      throw new Error(`${when}: the IBAN field shows ${JSON.stringify(await tagsIn(page, selector))}, not ${JSON.stringify(wanted)}`)
    })
}

/** Presses the remove button of the last tag of the IBAN field under this selector. */
async function removeLastTag(page, press, selector) {
  const buttons = await page.$$(`${selector} [data-slot="itemDelete"]`)
  const last = buttons.at(-1)
  if (last === undefined) throw new Error(`the IBAN field under ${selector} has no tag to remove`)
  await last.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(last)
}

/** Types into an IBAN field the way a person does: a press on the field, the IBAN with its grouping spaces, and a comma that makes it a tag. */
async function typeIban(page, press, input, text) {
  await input.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(input)
  await page.keyboard.type(`${text},`)
}

/**
 * On Invoicing, Clients a client's IBANs are tags. A second IBAN typed with its spaces becomes a tag
 * without them, Save writes it with Undo, and Undo takes it off again. A tag's remove button takes a
 * new IBAN off before a save, which leaves nothing to save.
 */
export function clientIbansFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const position = await (await rowNamed(page, FACT_ROW, 'lumen')).evaluate((row) => [...row.parentElement.children].indexOf(row) + 1)
    const lumen = `${FACT_ROW}:nth-child(${position})`
    const before = await tagsIn(page, lumen)
    if (before.length !== 1) throw new Error(`the fake client lumen shows ${before.length} IBANs, not one`)
    const input = async () => fieldIn(await rowNamed(page, FACT_ROW, 'lumen'), words.clientColumns.iban)

    await typeIban(page, press, await input(), 'GB82 WEST 1234 5698 7654 32')
    await waitForTags(page, lumen, [...before, NEW_IBAN], 'a typed IBAN')
    await inspect?.('a client with a second IBAN')
    await shoot('client-ibans-added')
    await pressSelector(page, press, '[data-testid="save-rows"]:not([disabled])')
    await toast(page, words.invoicing.clients.saved)
    await waitForTags(page, lumen, [...before, NEW_IBAN], 'after the save')
    await undoIn(page, press, words)
    await waitForTags(page, lumen, before, 'after Undo')
    await dismissToasts(page)

    await typeIban(page, press, await input(), NEW_IBAN)
    await waitForTags(page, lumen, [...before, NEW_IBAN], 'a typed IBAN again')
    await removeLastTag(page, press, lumen)
    await waitForTags(page, lumen, before, 'after its remove button')
    await page.waitForSelector('[data-testid="save-rows"][disabled]', { timeout: 5_000 }).catch(() => {
      throw new Error('Save is still on after the new IBAN was taken off')
    })
  }
}

export const clientIbansFlow = clientIbansFlowIn('en')

/**
 * On Settings, General the card settlement IBANs are the same tags field. A tag that is not an IBAN
 * is said under the field and keeps Save off until its remove button takes it off. A valid one is
 * saved, then taken off and saved again, since settings keep no Undo.
 */
export function cardSettlementIbansFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const input = () =>
      page.waitForSelector(`${CARD_IBANS} input`, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('Settings, General has no card settlement IBANs field')
      })
    const before = await tagsIn(page, CARD_IBANS)
    const refusal = words.settingsReasons.settings.notIbans(['XX00NOTANIBAN'])

    await typeIban(page, press, await input(), 'GB82 WEST 1234 5698 7654 32')
    await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN], 'a typed IBAN')
    await typeIban(page, press, await input(), 'XX00 NOT AN IBAN')
    await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN, 'XX00NOTANIBAN'], 'an entry that is not an IBAN')
    await page
      .waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted), { timeout: 5_000 }, CARD_IBANS, refusal)
      .catch(() => {
        throw new Error(`the field does not say ${refusal}`)
      })
    await saveSettingsButton(page, false, words)
    await inspect?.('card settlement IBANs with one that is not an IBAN')
    await shoot('card-ibans-invalid')
    await removeLastTag(page, press, CARD_IBANS)
    await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN], 'after its remove button')

    await press(await saveSettingsButton(page, true, words))
    await toast(page, words.settings.saved)
    await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN], 'after the save')
    await dismissToasts(page)
    await removeLastTag(page, press, CARD_IBANS)
    await waitForTags(page, CARD_IBANS, before, 'after the saved IBAN was taken off')
    await press(await saveSettingsButton(page, true, words))
    await toast(page, words.settings.saved)
    await dismissToasts(page)
  }
}

export const cardSettlementIbansFlow = cardSettlementIbansFlowIn('en')

const RULE_ROW = '[data-testid="rule-row"]'

/** The rules tab's row of this rule, by its id. */
async function ruleRowOf(page, id) {
  return page
    .waitForFunction(
      (selector, wanted) => [...document.querySelectorAll(selector)].find((row) => row.querySelector('.identifier')?.textContent?.trim() === wanted) ?? null,
      { timeout: 10_000 },
      RULE_ROW,
      id,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`the rules tab has no rule ${id}`)
    })
}

async function ruleGone(page, id) {
  await page
    .waitForFunction((selector, wanted) => ![...document.querySelectorAll(selector)].some((row) => row.querySelector('.identifier')?.textContent?.trim() === wanted), { timeout: 10_000 }, RULE_ROW, id)
    .catch(() => {
      throw new Error(`the rule ${id} is still on the rules tab`)
    })
}

/** Waits until the rule's note on the rules tab reads `note`, blank for none. */
async function ruleNoteReads(page, id, note, when) {
  await page
    .waitForFunction(
      (selector, wanted, text) => {
        const row = [...document.querySelectorAll(selector)].find((candidate) => candidate.querySelector('.identifier')?.textContent?.trim() === wanted)
        return row !== undefined && (row.querySelector('.rule-main > p.text-xs')?.textContent?.trim() ?? '') === text
      },
      { timeout: 10_000 },
      RULE_ROW,
      id,
      note,
    )
    .catch(() => {
      throw new Error(`${when}, the note of ${id} on the rules tab does not read "${note}"`)
    })
}

/** Ticks the back-test's "I have looked at these rows" when the change needs it. */
async function acceptBacktest(page, press) {
  await page.waitForSelector('[data-testid="rule-backtest"]', { visible: true, timeout: 10_000 })
  await delay(300)
  const accept = await page.$('[data-testid="accept-backtest"][role="checkbox"], [data-testid="accept-backtest"] [role="checkbox"]')
  if (accept === null) return
  await accept.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(accept)
}

async function editRule(page, press, id) {
  const row = await ruleRowOf(page, id)
  const edit = await row.$('[data-testid="edit-rule"]')
  await edit.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(edit)
  await page.waitForSelector('[role="dialog"] [data-testid="rule-editor"]', { visible: true, timeout: 10_000 })
  await delay(300)
}

/**
 * On Settings, Category rules: a rule's note changed in its editor, the toast with Undo once the editor closes,
 * and Undo putting the note back. Then the same rule deleted from its editor after the back-test of
 * taking it off, and brought back with Undo.
 */
export function rulesEditorFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const id = 'merchant-airline'
  const edited = words.ruleChanges.edited(id, ['note'], words.ruleChanges.renumbered(0))
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const added = 'Checked in the editor.'
    await ruleNoteReads(page, id, '', 'before the flow')

    await editRule(page, press, id)
    const note = await page.waitForSelector('[data-testid="rule-form"] textarea', { visible: true })
    await note.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(note)
    await page.keyboard.type(added)
    await acceptBacktest(page, press)
    await pressSelector(page, press, '[data-testid="save-rule"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
    await toast(page, edited)
    await ruleNoteReads(page, id, added, 'after the save')
    await shoot('rule-edited')
    await undoIn(page, press, words)
    await ruleNoteReads(page, id, '', 'after Undo')
    await dismissToasts(page)

    await editRule(page, press, id)
    await pressSelector(page, press, '[data-testid="delete-rule"]')
    await page.waitForSelector('[role="dialog"] [data-testid="rule-delete"]', { visible: true, timeout: 10_000 })
    await acceptBacktest(page, press)
    await inspect?.('rule delete back-test')
    await shoot('rule-delete')
    await pressSelector(page, press, '[data-testid="confirm-delete-rule"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    await toast(page, words.ruleChanges.deleted(id))
    await ruleGone(page, id)
    await undoIn(page, press, words)
    await ruleNoteReads(page, id, '', 'after Undo of the delete')
    await shoot('rule-deleted-undone')
    await dismissToasts(page)
  }
}

export const rulesEditorFlow = rulesEditorFlowIn('en')

/** Presses the visible button under `selector` whose text starts with `label`. */
async function pressButton(page, press, selector, label) {
  const button = await page
    .waitForFunction(
      (css, wanted) => [...document.querySelectorAll(css)].find((element) => element.offsetParent !== null && !element.disabled && element.textContent?.trim().startsWith(wanted)) ?? null,
      { timeout: 10_000 },
      selector,
      label,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no enabled ${selector} reading "${label}" within 10 s`)
    })
  await button.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(button)
}

/** Settings, Books file names the file on the fake Drive, its folder, and that no backup is made yet, or with `saved` that the save onboarding made today made one. */
async function booksShowDriveFile(page, saved, words, inKuna = true) {
  await page.evaluate(() => {
    window.location.hash = '#/company/settings?tab=books'
  })
  await page
    .waitForFunction((folder) => document.querySelector('[data-testid="drive-file-place"] a')?.textContent?.trim() === folder, { timeout: 10_000 }, inKuna ? 'company' : 'Books')
    .catch(() => {
      throw new Error('Settings, Books file does not name the folder the file sits in')
    })
  await pageSays(page, 'kuna-company.json', true)
  await pageSays(page, words.writes.booksFile.noBackup, !saved)
}

const STEP = '[data-testid="onboarding-step"]'

/** Waits for onboarding to show this step, or for Overview, in either language, once it is over. */
async function onboardingAt(page, step) {
  await page
    .waitForFunction(
      (selector, wanted, overview) =>
        wanted === 'overview' ? overview.includes(document.querySelector('[data-testid="screen-title"]')?.textContent?.trim()) : document.querySelector(selector)?.dataset.step === wanted,
      { timeout: 10_000 },
      STEP,
      step,
      [SCREEN_WORDS.en.companyOverview, SCREEN_WORDS.hr.companyOverview],
    )
    .catch(async () => {
      const at = await page.evaluate((selector) => document.querySelector(selector)?.dataset.step ?? window.location.hash, STEP)
      throw new Error(`onboarding is at ${at}, not ${step}`)
    })
  await delay(250)
}

/** Picks the choice of a radio group in an onboarding step by the start of its label. */
async function chooseOption(page, press, group, label) {
  await pressButton(page, press, `[data-testid="${group}"] label`, label)
}

/** Continue to Google, which the fake build's Google grants at once, unless the page holds a token already, then Continue once the step says Allowed. */
async function allowGoogle(page, press, { shoot, inspect }, words = SCREEN_WORDS.en) {
  await onboardingAt(page, 'access')
  await inspect?.('the access step')
  await shoot('onboarding-access')
  if (await page.$('[data-testid="onboarding-google"]')) await pressSelector(page, press, '[data-testid="onboarding-google"]')
  await page
    .waitForFunction(
      (allowed) => [...document.querySelectorAll('[data-testid="access-status"]')].some((badge) => badge.textContent?.trim() === allowed),
      { timeout: 10_000 },
      words.onboarding.access.allowed,
    )
    .catch(() => {
      throw new Error('the access step does not say Google allowed the books file')
    })
  await shoot('onboarding-access-allowed')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
}

/** The app's subfolder of a new Kuna folder at the top of My Drive, as the folder step and the toast name it. */
function inKunaFolder(words, appId) {
  return `${words.myDrive} › Kuna › ${appId}`
}

/** The folder step: the confirm names the new Kuna folder at the top of My Drive, and Create the file here makes the folders and the file. */
async function confirmFolder(page, press, { shoot, inspect }, named) {
  await onboardingAt(page, 'folder')
  const confirm = await page.waitForSelector('[data-testid="company-start-folder-confirm"]', { visible: true, timeout: 10_000 })
  const said = await confirm.evaluate((element) => element.textContent ?? '')
  if (!said.includes(named)) throw new Error(`the folder confirm says "${said}", not ${named}`)
  await inspect?.('the folder confirm')
  await shoot('onboarding-folder')
  await pressSelector(page, press, '[data-testid="company-start-create"]')
}

/** Back from the step after the one that made the books: that step shows them made, saying each of `says`, and offers Continue and Start over. */
async function backToMade(page, press, step, says) {
  await pressSelector(page, press, '[data-testid="onboarding-back"]')
  await onboardingAt(page, step)
  const made = await page.waitForSelector('[data-testid="onboarding-made"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`Back to the ${step} step does not show the books made`)
  })
  const said = await made.evaluate((element) => element.textContent ?? '')
  for (const text of says) if (!said.includes(text)) throw new Error(`the ${step} step says "${said}" of the books made, not ${text}`)
  if (!(await page.$('[data-testid="onboarding-start-over"]'))) throw new Error(`the ${step} step of the books made offers no Start over`)
}

/** Start over asks first: its dialog says each of `says`, among them what the books hold now, and Start over drops nothing until it is confirmed. */
async function startOverAsks(page, press, says) {
  await pressSelector(page, press, '[data-testid="onboarding-start-over"]')
  const dialog = await page.waitForSelector('[role="dialog"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Start over did not ask first')
  })
  // The dialog grows in, and its controls reach their size once it has.
  await delay(400)
  const said = await dialog.evaluate((element) => element.textContent ?? '')
  for (const text of says) if (!said.includes(text)) throw new Error(`Start over asks "${said}", without ${text}`)
}

/** Confirms the dialog Start over opened, which drops the books. */
async function confirmStartOver(page, press) {
  await pressSelector(page, press, '[data-testid="onboarding-confirm-start-over"]')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
}

/** The folder step's choice refused since Drive already holds the books: it says so, keeps "trash it in Drive first", and `dropsBrowserBooks` says whether it warns that opening them deletes the books in this browser. */
async function folderRefusedOnDrive(page, press, dropsBrowserBooks, words) {
  await onboardingAt(page, 'folder')
  await pressSelector(page, press, '[data-testid="company-start-create"]')
  const alert = await page.waitForSelector('[data-testid="company-start-on-drive"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the folder step does not say Drive already holds the books')
  })
  const said = await alert.evaluate((element) => element.textContent ?? '')
  const refusal = words.storage.alreadyOnDrive('kuna-company.json')
  if (!said.includes(refusal)) throw new Error(`the folder step says "${said}", not ${refusal}`)
  if (said.includes(words.onboarding.folder.onDriveDrops('').trim()) !== dropsBrowserBooks)
    throw new Error(`the folder step says "${said}", which ${dropsBrowserBooks ? 'does not warn' : 'warns'} that the books in this browser are deleted`)
  if (await page.$('[data-testid="company-start-failure"]')) throw new Error('the folder step shows the refusal as a failure too')
}

/** The lines Overview's Getting set up card shows, by key. */
async function setUpLines(page) {
  await page.waitForSelector('[data-testid="getting-set-up"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Overview shows no Getting set up card')
  })
  return page.$$eval('[data-testid="getting-set-up"] [data-line]', (lines) => lines.map((line) => line.dataset.line))
}

/**
 * New books on the fake Drive: the access step asks for the books file alone, and the folder confirm
 * names the app's subfolder of a new Kuna folder. The file's toast names where it was made. The first
 * statement's IBAN becomes the account main, and Overview's Getting set up card asks for the first
 * rules and a look over the categories, then offers how later statements arrive.
 */
export function onboardingDriveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await inspect?.('the welcome step')
    await shoot('onboarding-welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await shoot('onboarding-home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot, inspect }, words)
    await confirmFolder(page, press, { shoot, inspect }, inKunaFolder(words, 'company'))
    await toast(page, words.writes.firstRun.folder.created('kuna-company.json', inKunaFolder(words, 'company')))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await inspect?.('the company step')
    await shoot('onboarding-company')
    await backToMade(page, press, 'folder', ['company', 'kuna-company.json'])
    await inspect?.('the folder step of the books made')
    await shoot('onboarding-folder-made')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'company')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="sample-camt"]')
    const offer = await page.waitForSelector('[data-testid="dry-run-new-account"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the first statement does not offer its account')
    })
    const isNew = words.imports.statement.isNew(null, null).split('.')[0]
    if (!(await offer.evaluate((element) => element.textContent ?? '')).includes(isNew)) throw new Error(`the new account offer does not say "${isNew}"`)
    const name = await page.$eval('input[data-testid="dry-run-account-name"]', (input) => input.value)
    if (name !== 'main') throw new Error(`the account offered is named "${name}", not main`)
    await inspect?.('the first statement')
    await shoot('onboarding-statement')
    await pressButton(page, press, '[data-testid="onboarding-step"] button', words.onboarding.statement.addAndImport)
    await toastCounted(page, (count) => words.importWrites.imported(['main'], count))
    await onboardingAt(page, 'overview')
    const lines = await setUpLines(page)
    if (JSON.stringify(lines) !== JSON.stringify(['first-rules', 'categories', 'statement-delivery']))
      throw new Error(`Getting set up lists ${lines.join(', ')}, not the first rules, the categories and delivery`)
    await inspect?.('Overview getting set up')
    await shoot('onboarding-overview')
    await dismissToasts(page)
    await booksShowDriveFile(page, true, words)
  }
}

export const onboardingDriveFlow = onboardingDriveFlowIn('en')

/**
 * New books of a Croatian d.o.o. on the fake Drive: the company step answers Yes, the statement is skipped, and Getting set up lists the first statement and the categories.
 */
export function onboardingPackFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot, inspect }, words)
    await confirmFolder(page, press, { shoot, inspect }, inKunaFolder(words, 'company'))
    await toastMatching(page, exactly(words.writes.firstRun.folder.created('kuna-company.json', inKunaFolder(words, 'company'))))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await chooseOption(page, press, 'onboarding-pack', words.pack.onboarding.yes)
    await inspect?.('the company step of a Croatian d.o.o.')
    await shoot('onboarding-company-pack')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="onboarding-skip"]')
    await onboardingAt(page, 'overview')
    const lines = await setUpLines(page)
    if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)
    await inspect?.('Getting set up')
    await shoot('onboarding-overview-pack')
  }
}

export const onboardingPackFlow = onboardingPackFlowIn('en')

/**
 * Delivery comes after the first statement: the access step offers no statements choice, and Getting set up offers how later ones arrive.
 * Its dialog names the Erste preset, then another bank typed in, which goes on only once named. Saving makes the statements folder and takes the
 * line away. A sync then asks Google for Gmail read, as any sync of books with mail settings does. "I import by hand" takes the line away too.
 */
export function onboardingDeliveryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { delivery } = words.onboarding
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'access')
    if (await page.$('[data-testid="onboarding-statements"]')) throw new Error('the access step still asks how statements arrive')
    await allowGoogle(page, press, { shoot: () => {} }, words)
    await confirmFolder(page, press, { shoot: () => {} }, inKunaFolder(words, 'company'))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="sample-camt"]')
    await page.waitForSelector('[data-testid="dry-run-new-account"]', { visible: true, timeout: 10_000 })
    await pressButton(page, press, '[data-testid="onboarding-step"] button', words.onboarding.statement.addAndImport)
    await onboardingAt(page, 'overview')
    await dismissToasts(page)
    if (!(await setUpLines(page)).includes('statement-delivery')) throw new Error('Getting set up does not offer delivery after the first statement')
    await pressSelector(page, press, '[data-testid="set-up-delivery"]')
    const fields = await page.waitForSelector('[data-testid="statement-delivery-mail"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the delivery dialog shows no bank and mail since')
    })
    await delay(400)
    if (!(await fields.evaluate((element) => element.textContent ?? '')).includes('netbanking.support@erstebank.hr')) throw new Error('the Erste preset does not name the address it mails from')
    const since = await page.$eval('[data-testid="statement-delivery-since"] input', (input) => input.value)
    if (since !== `${new Date().getFullYear()}-01-01`) throw new Error(`mail since starts at ${since}, not the first day of this year`)
    await inspect?.('the delivery dialog with mail from Erste')
    await shoot('onboarding-delivery')
    await choose(page, press, await page.waitForSelector('[data-testid="statement-delivery-bank"]'), delivery.anotherBank)
    if (!(await page.$eval('[data-testid="statement-delivery-save"]', (button) => button.disabled))) throw new Error('the delivery dialog goes on before another bank is named')
    await setField(await page.waitForSelector('input[data-testid="statement-delivery-from"]', { visible: true }), 'statements@bank.example.com')
    await setField(await page.waitForSelector('input[data-testid="statement-delivery-subject"]'), 'Izvadak')
    await delay(200)
    await inspect?.('the delivery dialog with another bank')
    await shoot('onboarding-delivery-other')
    await pressSelector(page, press, '[data-testid="statement-delivery-save"]')
    await page.waitForFunction(() => !document.querySelector('[data-testid="statement-delivery"]'), { timeout: 10_000 })
    await dismissToasts(page)
    const lines = await setUpLines(page)
    if (lines.includes('statement-delivery')) throw new Error('Getting set up still offers delivery once it is set up')
    await inspect?.('Getting set up once delivery is set up')
    await shoot('onboarding-delivered')
  }
}

export const onboardingDeliveryFlow = onboardingDeliveryFlowIn('en')

/**
 * New books in this browser: no Google at all. Back from the company step shows them made on the
 * home step, whose Start over asks first, says they cannot be recovered, and deletes them once
 * confirmed, so they are made again. The company step names the company, the statement
 * step says such books take statements by hand and is skipped, and Getting set up's first line
 * opens Import.
 */
export function onboardingBrowserFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { home, made, setUp } = words.onboarding
  const holdsNone = made.holds(0, 0).slice(0, made.holds(0, 0).indexOf('0') + 1)
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await chooseOption(page, press, 'onboarding-home', home.browser)
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'company')
    await backToMade(page, press, 'home', [made.inBrowser, words.settings.books.newBooks])
    await inspect?.('the home step of the books made in this browser')
    await shoot('onboarding-home-made')
    await startOverAsks(page, press, [made.deleteNote, holdsNone])
    await inspect?.('Start over asking before it deletes the books in this browser')
    await shoot('onboarding-start-over-browser')
    await confirmStartOver(page, press)
    await page.waitForSelector('[data-testid="onboarding-in-browser"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Start over did not bring back the step that makes the books')
    })
    await onboardingAt(page, 'home')
    if (await page.$('[data-testid="onboarding-made"]')) throw new Error('the home step still shows the books made after Start over')
    if (await page.$('[data-testid="onboarding-home"]')) throw new Error('Start over asks where the books live again, after the person said')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'company')
    await setField(await page.waitForSelector('input[data-testid="onboarding-company-name"]'), 'Example Studio')
    await inspect?.('the company step')
    await shoot('onboarding-company-browser')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    if (!(await page.$('[data-testid="onboarding-statements-by-hand"]'))) throw new Error('the statement step does not say books kept in this browser take statements by hand')
    await inspect?.('the statement step of books kept in this browser')
    await shoot('onboarding-statement-browser')
    await pressSelector(page, press, '[data-testid="onboarding-skip"]')
    await onboardingAt(page, 'overview')
    await page.waitForSelector('[data-testid="local-status"]', { timeout: 10_000 }).catch(() => {
      throw new Error('the new books in this browser show no export status')
    })
    const lines = await setUpLines(page)
    if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)
    await inspect?.('new books in this browser')
    await shoot('onboarding-browser')
    await pressSelector(page, press, '[data-testid="set-up-categories-look-right"]')
    await page
      .waitForFunction(() => !document.querySelector('[data-line="categories"]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('These look right did not clear the categories line')
      })
    await pressButton(page, press, '[data-line="first-statement"] a', setUp.importLink)
    await page.waitForSelector('[data-testid="import-file"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Getting set up did not open Import')
    })
    await page.evaluate(() => {
      window.location.hash = '#/company/settings'
    })
    await page
      .waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === 'Example Studio'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('Settings, General does not name the company the company step named')
      })
  }
}

export const onboardingBrowserFlow = onboardingBrowserFlowIn('en')

/**
 * Books brought from an xlsx file to the fake Drive: access first, then the file's summary with its
 * records by tab, then the folder. The toast says how many records moved, the company step confirms
 * what the file says, and Overview draws the moved books.
 */
export function onboardingBringFlowIn(language, path) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await chooseOption(page, press, 'onboarding-path', words.onboarding.welcome.bring)
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot, inspect }, words)
    await onboardingAt(page, 'file')
    await page.waitForSelector('[data-testid="download-template"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the file step offers no template download')
    })
    const input = await page.waitForSelector('input[data-testid="onboarding-file"]')
    await input.uploadFile(path)
    await page
      .waitForFunction(
        (source) => new RegExp(source).test(document.querySelector('[data-testid="record-counts"] h3')?.textContent?.trim() ?? ''),
        { timeout: 10_000 },
        anyCount(words.files.summary.records(1000)).source,
      )
      .catch(() => {
        throw new Error('the file step does not count the records by tab')
      })
    await delay(400)
    await inspect?.('the file summary')
    await shoot('onboarding-file')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await confirmFolder(page, press, { shoot, inspect }, inKunaFolder(words, 'company'))
    await toastMatching(page, anyCount(words.writes.firstRun.folder.moved(1000)))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    const named = await page.$eval('input[data-testid="onboarding-company-name"]', (input) => input.value)
    if (named === '') throw new Error('the company step does not show the name the file gives')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'overview')
    await page.waitForSelector('.chart-body canvas', { timeout: 10_000 }).catch(() => {
      throw new Error('Overview drew no chart from the moved books')
    })
    await inspect?.('Overview of the moved books')
    await shoot('moved')
    // The file already holds every answer of the company step, so Continue writes nothing and makes no backup.
    await booksShowDriveFile(page, false, words)
    await inspect?.('Settings, Books file of the moved books')
  }
}

export const onboardingBringFlow = (path) => onboardingBringFlowIn('en', path)

/** Open my books on Drive, on a device that keeps the fake Drive's books: Find the file says they are open, and onboarding ends on Overview. */
export function onboardingOpenFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await chooseOption(page, press, 'onboarding-path', words.onboarding.welcome.open)
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot, inspect }, words)
    await onboardingAt(page, 'find')
    await inspect?.('the find step')
    await shoot('onboarding-find')
    await pressSelector(page, press, '[data-testid="company-start-find"]')
    await toastMatching(page, exactly(words.books.find.alreadyOpen))
    await onboardingAt(page, 'overview')
  }
}

export const onboardingOpenFlow = onboardingOpenFlowIn('en')

/**
 * New books on the fake Drive, then Back from the company step to the folder step, whose Start over
 * asks first, keeps the file on Keep them and trashes it once confirmed. The folder is chosen again
 * without a refusal, since the search leaves trashed files out, and a second file is made in its
 * place. The statement step goes back to the company step. Once a statement is imported, the
 * browser's back button and Back lead to the folder step again, whose Start over counts the
 * transactions imported, and Keep them keeps them.
 */
export function onboardingStartOverFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { made, statement } = words.onboarding
  const created = exactly(words.writes.firstRun.folder.created('kuna-company.json', inKunaFolder(words, 'company')))
  const trash = made.trash('kuna-company.json')
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot: () => {} }, words)
    await confirmFolder(page, press, { shoot: () => {} }, 'company')
    await toastMatching(page, created)
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await backToMade(page, press, 'folder', ['company', 'kuna-company.json'])
    await startOverAsks(page, press, [trash, made.trashNote, made.holds(0, 1000).split('1000')[0]])
    await inspect?.('Start over asking before it trashes the books')
    await pressSelector(page, press, '[data-testid="onboarding-keep-books"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    if (!(await page.$('[data-testid="onboarding-made"]'))) throw new Error('Keep them dropped the books')
    await startOverAsks(page, press, [trash])
    await confirmStartOver(page, press)
    await page.waitForSelector('[data-testid="company-start-create"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Start over did not bring back the folder step')
    })
    if (await page.$('[data-testid="onboarding-made"]')) throw new Error('the folder step still shows the books made after Start over')
    await inspect?.('the folder step after Start over')
    await shoot('onboarding-start-over')
    await confirmFolder(page, press, { shoot: () => {} }, 'company')
    await toastMatching(page, exactly(words.writes.firstRun.folder.created('kuna-company.json', 'Kuna › company')))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="onboarding-back"]')
    await onboardingAt(page, 'company')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="sample-camt"]')
    await pressButton(page, press, '[data-testid="onboarding-step"] button', statement.addAndImport)
    await toastCounted(page, (rows) => words.importWrites.imported(['main'], rows))
    await onboardingAt(page, 'overview')
    await dismissToasts(page)
    // The browser's back button leads back into onboarding after the books hold work, so Start over has to say so.
    await page.goBack()
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="onboarding-back"]')
    await onboardingAt(page, 'company')
    await backToMade(page, press, 'folder', ['kuna-company.json'])
    await startOverAsks(page, press, [trash])
    const holds = await page.$eval('[data-testid="onboarding-start-over-holds"]', (element) => element.textContent?.trim() ?? '')
    const transactions = Number(/\d+/.exec(holds)?.[0] ?? 0)
    if (transactions === 0) throw new Error(`Start over on books with an imported statement says "${holds}"`)
    await inspect?.('Start over asking before it trashes books with work in them')
    await shoot('onboarding-start-over-holds')
    await pressSelector(page, press, '[data-testid="onboarding-keep-books"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    if (!(await page.$('[data-testid="onboarding-made"]'))) throw new Error('Keep them dropped the books with work in them')
  }
}

export const onboardingStartOverFlow = onboardingStartOverFlowIn('en')

/**
 * New books on Drive on a device whose books the fake Drive already holds: the folder step refuses a
 * second file, and opening the books on Drive takes the find step, which finds them open already.
 */
export function onboardingOnDriveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await folderRefusedOnDrive(page, press, false, words)
    await inspect?.('the folder step when Drive holds the books')
    await shoot('onboarding-folder-on-drive')
    await pressSelector(page, press, '[data-testid="company-start-open-on-drive"]')
    await onboardingAt(page, 'find')
    await pressSelector(page, press, '[data-testid="company-start-find"]')
    await toastMatching(page, exactly(words.books.find.alreadyOpen))
    await onboardingAt(page, 'overview')
  }
}

export const onboardingOnDriveFlow = onboardingOnDriveFlowIn('en')

/**
 * Settings, Books file: books kept in this browser move to Drive, which already holds a file another
 * device made. The folder step refuses a second file, warns that opening those deletes the books in
 * this browser, and the find step opens them.
 */
export function moveOntoDriveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pageSays(page, words.writes.localFile.kept, true)
    await pressSelector(page, press, '[data-testid="keep-on-drive"]')
    await allowGoogle(page, press, { shoot: () => {} }, words)
    await folderRefusedOnDrive(page, press, true, words)
    await inspect?.('the move when Drive holds the books')
    await shoot('onboarding-move-on-drive')
    await pressSelector(page, press, '[data-testid="company-start-open-on-drive"]')
    await onboardingAt(page, 'find')
    await pressSelector(page, press, '[data-testid="company-start-find"]')
    await toastMatching(page, exactly(words.books.find.opened('kuna-company.json')))
    await onboardingAt(page, 'overview')
    await dismissToasts(page)
    await booksShowDriveFile(page, false, words, false)
    await inspect?.('Settings, Books file once the books on Drive are open')
  }
}

export const moveOntoDriveFlow = moveOntoDriveFlowIn('en')

/**
 * Settings, Books file: the books kept in this browser move to a new file on the fake Drive through
 * onboarding's access and folder steps. The access step asks for the Drive read their statements
 * folder needs, the folder confirm names the app's subfolder of the Kuna folder, and the sync control
 * shows no Allow access once they are there.
 */
export function moveFromBrowserFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pageSays(page, words.writes.localFile.kept, true)
    await pressSelector(page, press, '[data-testid="keep-on-drive"]')
    await onboardingAt(page, 'access')
    await page.waitForSelector(`${STEP} [data-scope="drive.readonly"]`, { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the access step of the move does not name the Drive read the books need')
    })
    await allowGoogle(page, press, { shoot, inspect }, words)
    const asked = await page.evaluate(() => JSON.parse(window.localStorage.getItem('kuna.google-needed') ?? '[]'))
    if (JSON.stringify(asked) !== JSON.stringify(['drive.file', 'drive.readonly'])) throw new Error(`the move asked Google for ${asked.join(', ')}, not the books file and Drive read`)
    await confirmFolder(page, press, { shoot, inspect }, inKunaFolder(words, 'company'))
    await toastMatching(page, anyCount(words.writes.firstRun.folder.moved(1000)))
    await onboardingAt(page, 'overview')
    await dismissToasts(page)
    await controlShows(page, 'ready')
    await booksShowDriveFile(page, false, words)
    await inspect?.('this device once moved')
    await shoot('moved-from-browser')
  }
}

export const moveFromBrowserFlow = moveFromBrowserFlowIn('en')

/**
 * The one start on the home of a new device: the welcome shows in place of the cards, picks Loans and Assets and suggests their order, and goes on
 * only with an app picked. Saying Drive makes nothing. The cards then lead the picked apps, the others wait under them, and Assets asks no storage
 * question: its folder step names its subfolder of the new Kuna folder, and Loans' names the same folder without offering to put it elsewhere.
 * Kuna settings says where new files go, and asks again.
 */
export function kunaWelcomeFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a new device shows no welcome on the home')
    })
    if (await page.$('[data-testid="home-card"]')) throw new Error('the welcome shows beside the cards')
    if (!(await page.$eval('[data-testid="kuna-welcome-continue"]', (button) => button.disabled))) throw new Error('the welcome goes on with no app picked')
    await kunaSettingsInMenu(page, press, 'the welcome')
    await inspect?.('the welcome')
    await shoot('kuna-welcome')
    await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', words.loans)
    await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', words.assetsApp)
    await page.waitForSelector('[data-testid="kuna-welcome-order"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the welcome does not suggest Loans before Assets')
    })
    await inspect?.('the welcome with its order line')
    await shoot('kuna-welcome-picked')
    await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
    await page.waitForSelector('[data-testid="home-other-cards"] [data-testid="home-card"][data-app="company"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('an app left out does not wait under the others')
    })
    if ((await page.evaluate(homeMenu)) !== null) {
      if ((await page.evaluate(menuShown)).apps.length !== 0) throw new Error('the sidebar lists an app with no file')
      await pressSelector(page, press, '[data-testid="nav-add-app"]')
      const focused = await page.evaluate(() => document.activeElement?.dataset.app)
      if (focused !== 'loans') throw new Error(`Add an app moved focus to ${focused}, not the first picked app in Set up`)
    }
    await inspect?.('the home after the welcome')
    await shoot('kuna-welcome-answered')
    await pressSelector(page, press, '[data-testid="home-card"][data-app="assets"]')
    await firstRunAt(page, ASSETS, 'folder')
    const assetsConfirm = await page.waitForSelector('[data-testid="assets-start-folder-confirm"]', { visible: true, timeout: 10_000 })
    const said = await assetsConfirm.evaluate((element) => element.textContent ?? '')
    if (!said.includes(inKunaFolder(words, 'assets'))) throw new Error(`the Assets folder step says "${said}"`)
    if (await page.$('[data-testid="onboarding-back"]')) throw new Error('the folder step of someone who answered goes back to a question')
    if (!(await page.$('[data-testid="assets-start-open-existing"]'))) throw new Error('the folder step offers no way to open a file the person already has')
    await inspect?.('the Assets folder step after the welcome')
    await shoot('kuna-welcome-assets')
    await pressSelector(page, press, '[data-testid="assets-start-open-existing"]')
    await firstRunAt(page, ASSETS, 'find')
    await pressSelector(page, press, '[data-testid="onboarding-back"]')
    await firstRunAt(page, ASSETS, 'folder')
    await pressSelector(page, press, '[data-testid="assets-start-create"]')
    await toastMatching(page, exactly(words.writes.firstRun.folder.created('kuna-assets.json', inKunaFolder(words, 'assets'))))
    await firstRunAt(page, ASSETS, 'overview')
    await dismissToasts(page)
    if ((await page.evaluate(homeMenu)) !== null) {
      const listed = (await page.evaluate(menuShown)).apps
      if (JSON.stringify(listed) !== JSON.stringify(['assets'])) throw new Error(`with one file the sidebar lists ${listed.join()}, not Assets alone, whichever list the others wait in`)
    }
    await page.evaluate(() => {
      window.location.hash = '#/loans/start'
    })
    await firstRunAt(page, LOANS, 'folder')
    await page.waitForFunction((wanted) => document.querySelector('[data-testid="loans-start-folder-confirm"]')?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, `Kuna › loans`)
    if (await page.$('[data-testid="loans-start-elsewhere"]')) throw new Error('a Kuna folder that exists is offered a new place')
    await page.evaluate(() => {
      window.location.hash = '#/settings'
    })
    const card = await page.waitForSelector('[data-testid="files-home-answer"]', { visible: true, timeout: 10_000 })
    if ((await card.evaluate((element) => element.textContent ?? '')) !== words.filesHome.onDrive) throw new Error('Kuna settings does not say where new files go')
    if (!(await page.$('[data-testid="assist-key-steps"]'))) throw new Error('Kuna settings does not offer the assistant after Not now')
    if (await page.$('[data-testid="chat-open"]')) throw new Error('the chat shows after Not now')
    await inspect?.('Kuna settings with the answer')
    await shoot('kuna-welcome-settings')
    await pressSelector(page, press, '[data-testid="files-home-ask-again"]')
    await toastMatching(page, exactly(words.filesHome.askedAgain))
    if (await page.$('[data-testid="files-home-card"]')) throw new Error('Ask me again leaves the answer on Kuna settings')
    await pressButton(page, press, `${TOAST} button`, words.filesHome.undo)
    await page.waitForSelector('[data-testid="files-home-card"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Undo on the Ask me again toast did not bring the answer back')
    })
  }
}

export const kunaWelcomeFlow = kunaWelcomeFlowIn('en')

/** Saying this browser at the welcome: the app's first run asks nothing, says where the file goes, and one tap makes it. */
export function kunaWelcomeBrowserFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 })
    await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', words.loans)
    await pressButton(page, press, '[data-testid="kuna-welcome-home"] label', words.home.welcome.browser)
    await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
    await pressSelector(page, press, '[data-testid="home-card"][data-app="loans"]')
    await firstRunAt(page, LOANS, 'home')
    await page.waitForSelector('[data-testid="loans-start-in-browser"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the first run of someone who said this browser does not say so')
    })
    if (await page.$('[data-testid="loans-start-home"]')) throw new Error('the first run asks where the file lives again')
    await inspect?.('the Loans first run after this browser')
    await shoot('kuna-welcome-browser')
    await pressSelector(page, press, '[data-testid="loans-start-continue"]')
    await firstRunAt(page, LOANS, 'overview')
  }
}

export const kunaWelcomeBrowserFlow = kunaWelcomeBrowserFlowIn('en')

/**
 * Settings, Books file on the fake Drive: the file sits outside the Kuna folder and stays there until the person presses. The dialog names what
 * goes and what stays, with the statements folder staying since its setting is a path from My Drive. Moving keeps the file open and working, the
 * Settings then names its new folder and stops offering the move, and a sync afterwards still reads it.
 */
export function moveIntoKunaFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const text = words.writes.moveIntoKuna
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="drive-file-place"] a')?.textContent?.trim() === 'Books', { timeout: 10_000 })
      .catch(() => {
        throw new Error('the seeded file does not start in its own folder')
      })
    await inspect?.('Settings, Books file offering the move')
    await shoot('move-into-kuna-offer')
    await pressSelector(page, press, '[data-testid="move-into-kuna-open"]')
    const goes = await page.waitForSelector('[data-testid="move-into-kuna-goes"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the move does not list what goes')
    })
    await delay(400)
    if (!(await goes.evaluate((element) => element.textContent ?? '')).includes('kuna-company.json')) throw new Error('the move does not name the file')
    const stays = await page.$eval('[data-testid="move-into-kuna-stays"]', (element) => element.textContent ?? '').catch(() => '')
    if (!stays.includes(words.myDrive)) throw new Error(`the move says "${stays}" stays, without the statements folder named from My Drive`)
    await inspect?.('the move dialog')
    await shoot('move-into-kuna')
    await pressSelector(page, press, '[data-testid="move-into-kuna-confirm"]')
    await toastMatching(page, exactly(text.moved('kuna-company.json', inKunaFolder(words, 'company'))))
    await page
      .waitForFunction(() => document.querySelector('[data-testid="drive-file-place"] a')?.textContent?.trim() === 'company', { timeout: 10_000 })
      .catch(() => {
        throw new Error('Settings does not name the new folder')
      })
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="move-into-kuna-open"]'), { timeout: 5_000 })
      .catch(() => {
        throw new Error('Settings still offers the move')
      })
    await dismissToasts(page)
    await inspect?.('Settings, Books file after the move')
    await shoot('move-into-kuna-done')
    await syncAndSettle(page, press)
    await pageSays(page, 'kuna-company.json', true)
  }
}

export const moveIntoKunaFlow = moveIntoKunaFlowIn('en')

/**
 * The statements folder holds a statement Kuna filed from mail, one a script filed and a file another mail source filed. The dialog counts one going and two
 * staying, and says it cannot tell who made them. Moving takes the one, and the setting then names the folder beside the file.
 */
export function moveStatementsIntoKunaFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const text = words.writes.moveIntoKuna
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="move-into-kuna-open"]')
    const goes = await page.waitForSelector('[data-testid="move-into-kuna-goes"]', { visible: true, timeout: 10_000 })
    await delay(400)
    const going = await goes.evaluate((element) => element.textContent ?? '')
    if (!going.includes('statements')) throw new Error(`the move says "${going}" goes, without the statements Kuna filed`)
    const others = await page.$eval('[data-testid="move-into-kuna-others"]', (element) => element.textContent ?? '').catch(() => '')
    if (
      !others.includes(
        (() => {
          const forms = words.writes.moveIntoKuna.others(2)
          return (forms.few ?? forms.other).split(' ').slice(0, 3).join(' ')
        })(),
      )
    )
      throw new Error(`the move says "${others}" of the rest`)
    if (!(await page.$('[data-testid="move-into-kuna-stops-reading"]'))) throw new Error('the move does not say Kuna stops reading the old statements folder')
    await inspect?.('the move dialog with statements')
    await shoot('move-statements-into-kuna')
    await pressSelector(page, press, '[data-testid="move-into-kuna-confirm"]')
    await toastMatching(page, exactly(text.moved('kuna-company.json', inKunaFolder(words, 'company'))))
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/company/settings'
    })
    await page
      .waitForFunction(() => document.querySelector('[data-testid="statements-folder"] input')?.value === './statements', { timeout: 10_000 })
      .catch(() => {
        throw new Error('the statements setting does not name the folder beside the file after the move')
      })
    await inspect?.('Settings, General after the move')
  }
}

export const moveStatementsIntoKunaFlow = moveStatementsIntoKunaFlowIn('en')

function queueLength(page) {
  return page.evaluate(() => document.querySelectorAll('[data-testid="review-row"]').length)
}

async function queueHolds(page, count, failure) {
  await page
    .waitForFunction((wanted) => document.querySelectorAll('[data-testid="review-row"]').length === wanted, { timeout: 10_000 }, count)
    .catch(async () => {
      throw new Error(`${failure} (the queue holds ${await queueLength(page)})`)
    })
}

/**
 * Transactions, To review: a row confirmed while a phone files the other waiting row on the fake Drive at the same
 * moment. Both saves stand, so the queue empties, and Undo takes back only this device's.
 */
export function raceFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await queueHolds(page, 2, 'the queue does not hold the two fake rows')
    const summary = await page
      .waitForFunction(() => [...document.querySelectorAll('[data-testid="review-row"] > button')].find((button) => button.textContent?.includes('GADGET CORNER')) ?? null, { timeout: 10_000 })
      .then((handle) => handle.asElement())
    await summary.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(summary)
    await page.waitForSelector('[data-testid="review-details"]')
    await pressButton(page, press, '[data-testid="review-details"] button', words.transactions.review.item.confirm('').trim())
    await toastMatching(
      page,
      new RegExp(
        `^${words.transactions.review
          .confirmed('')
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      ),
    )
    await queueHolds(page, 0, "the phone's save or this one is missing after the race")
    await inspect?.('both saves of the race')
    await shoot('race')
    await undoIn(page, press, words)
    await queueHolds(page, 1, "Undo did not bring back this device's row alone")
    await pageSays(page, 'GADGET CORNER', true)
    await inspect?.('the race undone')
    await shoot('race-undone')
  }
}

export const raceFlow = raceFlowIn('en')

const SALARIES_TABS = '[data-testid="salaries-tabs"] [role="tab"]'

/** Waits until the element under `selector` says every text given. */
export async function elementSays(page, selector, texts, failure) {
  await page
    .waitForFunction((css, wanted) => [...document.querySelectorAll(css)].some((element) => wanted.every((text) => element.textContent?.includes(text))), { timeout: 10_000 }, selector, texts)
    .catch(async () => {
      const said = await page.evaluate((css) => document.querySelector(css)?.textContent?.trim().slice(0, 300) ?? 'nothing', selector)
      throw new Error(`${failure}, it says: ${said}`)
    })
}

async function screenTitled(page, title) {
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === wanted, { timeout: 10_000 }, title)
    .catch(() => {
      throw new Error(`${title} did not open`)
    })
}

/** How the checks write money in each language. */
const MONEY_FORMATS = { en: { currency: 'EUR', locale: 'en-GB' }, hr: { currency: 'EUR', locale: 'hr-HR' } }

/**
 * Salaries with the five made-up employees: the newest payday's health insurance row 10.00 short
 * is the one problem, its build-up opens and its bank figure opens the rows, the People tab opens
 * one employee's month, and a month of the Over time table opens on the Month tab.
 */
export function salariesFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const salaries = words.salaries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const short = salaries.bankDifference(formatMoney(1000, 'negative', MONEY_FORMATS[language]), false)
    await elementSays(page, '[data-testid="salaries-tiles"]', [short], `the state tile does not say "${short}"`)
    const healthShort = salaries.problems.differsForEveryone(salaries.lines.health, '').split(':')[0]
    await elementSays(page, '[data-testid="salaries-problem"]', [healthShort], 'the problems do not name the health insurance row 10.00 short')
    const problems = await page.$$('[data-testid="salaries-problem"]')
    if (problems.length !== 1) throw new Error(`the payday shows ${problems.length} problems, not the one row 10.00 short`)
    await inspect?.('the month of five employees')
    await shoot('salaries-month')

    await pressButton(page, press, '[data-testid="salaries-problem"] button', salaries.problemList.howWorkedOut)
    await page.waitForSelector('[data-testid="figure-detail"]', { visible: true, timeout: 10_000 })
    // The dialog grows in, and its controls reach their size once it has.
    await delay(400)
    await inspect?.('the build-up of the line that differs')
    await shoot('salaries-build-up')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="figure-detail"]') && !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    // The dialog's overlay fades out after its content, and would take the next press.
    await delay(400)

    await pressSelector(page, press, '[data-testid="salaries-reconciliation"] [data-section="contributions"] [data-verdict="differs"] a')
    await screenTitled(page, words.transactions.title)
    await inspect?.('the bank rows of the line that differs')
    await shoot('salaries-bank-rows')
    await page.goBack()
    await screenTitled(page, words.pack.screens.salaries)

    await pressButton(page, press, SALARIES_TABS, salaries.screen.tabs.people)
    await elementSays(page, '[data-testid="salaries-people"]', ['Mia Primjer', salaries.everyone], 'the People tab does not list everyone paid')
    await inspect?.('the People tab')
    await shoot('salaries-people')
    await pressSelector(page, press, '[data-testid="salaries-people"] [data-person="mia"] a')
    await elementSays(page, '[data-testid="salaries-strip"]', ['Mia Primjer'], 'a name on the People tab did not open that employee’s month')
    await inspect?.('one employee’s month')
    await shoot('salaries-employee')

    await pressButton(page, press, SALARIES_TABS, salaries.screen.tabs.overTime)
    await page.waitForSelector('[data-testid="salaries-over-time"] canvas', { visible: true, timeout: 10_000 })
    await inspect?.('the Over time tab')
    await shoot('salaries-over-time')
    await pressSelector(page, press, '[data-testid="salaries-months"] [data-payday="2026-04"] a')
    await page.waitForSelector('[data-testid="salaries-paydays"] [data-value="2026-04"][aria-pressed="true"]', { timeout: 10_000 }).catch(() => {
      throw new Error('a month of the Over time table did not open on the Month tab')
    })
    await elementSays(page, '[data-testid="salaries-strip"]', ['Mia Primjer'], 'the month opened without the employee picked')
  }
}

export const salariesFlow = salariesFlowIn('en')

const FIRST_RUN_STEP = '[data-testid="onboarding-step"]'

/** Waits for an app's first run to show this step, or for its Overview once it is over, which `app` names by the test ids of its empty state and books card. */
async function firstRunAt(page, app, step) {
  await page
    .waitForFunction(
      (selector, wanted, empty) => (wanted === 'overview' ? document.querySelector(`[data-testid="${empty}"]`) !== null : document.querySelector(selector)?.dataset.step === wanted),
      { timeout: 10_000 },
      FIRST_RUN_STEP,
      step,
      `${app.id}-empty`,
    )
    .catch(async () => {
      const at = await page.evaluate((selector) => document.querySelector(selector)?.dataset.step ?? window.location.hash, FIRST_RUN_STEP)
      throw new Error(`the ${app.name} first run is at ${at}, not ${step}`)
    })
  await delay(250)
}

/** An app's Settings, reached from its menu, naming where its file is. */
async function settingsShowFile(page, press, app, says, words = SCREEN_WORDS.en) {
  await openMenu(page, press)
  await pressButton(page, press, '[data-testid="nav-entries"] a', words.loansSettings)
  await screenTitled(page, words.loansSettings)
  await page
    .waitForFunction((card, wanted) => document.querySelector(`[data-testid="${card}"]`)?.textContent?.includes(wanted) === true, { timeout: 10_000 }, `${app.id}-books-card`, says)
    .catch(() => {
      throw new Error(`the ${app.name} books card does not say "${says}"`)
    })
}

const LOANS = { id: 'loans', name: 'Loans' }
const INVESTMENTS = { id: 'investments', name: 'Investments' }
const ASSETS = { id: 'assets', name: 'Assets' }
const SPENDING = { id: 'spending', name: 'Spending' }

/**
 * The Investments first run with the company books on the fake Drive: Investments opens on it, a new file on the fake
 * Drive lands in its Kuna folder as kuna-investments.json, the Investments Overview says it holds no transactions yet, and the
 * Investments Settings names the file.
 */
export async function investmentsDriveFlow(page, { press, shoot, inspect }) {
  await firstRunAt(page, INVESTMENTS, 'home')
  await inspect?.('the Investments first run')
  await shoot('investments-start')
  await chooseOption(page, press, 'investments-start-home', 'A new file on Google Drive')
  await pressSelector(page, press, '[data-testid="investments-start-continue"]')
  await firstRunAt(page, INVESTMENTS, 'folder')
  const confirm = await page.waitForSelector('[data-testid="investments-start-folder-confirm"]', { visible: true, timeout: 10_000 })
  const said = await confirm.evaluate((element) => element.textContent ?? '')
  if (!said.includes('Kuna › investments') || !said.includes('kuna-investments.json')) throw new Error(`the folder confirm says "${said}", not its Kuna folder and kuna-investments.json`)
  await inspect?.('the Investments folder confirm')
  await shoot('investments-start-folder')
  await pressSelector(page, press, '[data-testid="investments-start-create"]')
  await toastMatching(page, /^Created kuna-investments\.json in My Drive › Kuna › investments$/)
  await firstRunAt(page, INVESTMENTS, 'overview')
  await pageSays(page, 'on Google Drive as kuna-investments.json', true)
  await inspect?.('the empty Investments Overview')
  await shoot('investments-overview')
  await dismissToasts(page)
  await settingsShowFile(page, press, INVESTMENTS, 'kuna-investments.json')
  await inspect?.('the Investments Settings')
  await shoot('investments-settings')
}

/** A made-up Twelve Data key the Prices card is given, whose whole text must never come back on screen. */
const MADE_UP_PRICE_KEY = 'made-up-twelve-data-key-7319'
const MADE_UP_FINNHUB_KEY = 'made-up-finnhub-key-5521'

/**
 * Investments Settings, Prices, on the sample: a Twelve Data key typed and saved shows only how it ends and empties its
 * field, Test asks the fake build's responder and says the key works, and Remove forgets it. A Finnhub key does the
 * same, its Test asking for a profile. Fetch now then finds every series up to date and nothing missing.
 */
export async function investmentsPriceKeyFlow(page, { press, shoot, inspect }) {
  const vendor = '[data-testid="investments-prices-card"] [data-vendor="twelvedata"]'
  await page.waitForSelector(`${vendor} [data-testid="price-vendor-key"]`, { visible: true, timeout: 10_000 })
  const input = await pressSelector(page, press, `${vendor} [data-testid="price-vendor-key"]`)
  await input.type(MADE_UP_PRICE_KEY)
  const fieldType = await page.$eval(`${vendor} [data-testid="price-vendor-key"]`, (element) => element.type)
  if (fieldType !== 'password') throw new Error(`the key field is type "${fieldType}", not password`)
  await inspect?.('a price vendor key typed')
  await pressSelector(page, press, `${vendor} [data-testid="price-vendor-save"]`)
  await pageSays(page, 'A key ending in 7319 is kept in this browser.', true)
  const left = await page.$eval(`${vendor} [data-testid="price-vendor-key"]`, (element) => element.value)
  if (left !== '') throw new Error(`the key field still holds "${left}" after Save`)
  const shown = await page.evaluate((key) => document.body.innerText.includes(key) || [...document.querySelectorAll('input')].some((element) => element.value === key), MADE_UP_PRICE_KEY)
  if (shown) throw new Error('the whole key came back on screen after Save')
  const kept = await page.evaluate(() => localStorage.getItem('kuna.secret.twelvedata'))
  if (kept !== MADE_UP_PRICE_KEY) throw new Error(`this browser keeps "${kept}" as the Twelve Data key`)
  await pressSelector(page, press, `${vendor} [data-testid="price-vendor-test"]`)
  await page
    .waitForFunction((selector) => document.querySelector(selector)?.textContent?.trim() === 'The key works.', { timeout: 10_000 }, `${vendor} [data-testid="price-vendor-test-result"]`)
    .catch(() => {
      throw new Error('Test against the fake responder does not say the key works')
    })
  await inspect?.('a price vendor key tested')
  await shoot('investments-price-key')
  await pressSelector(page, press, `${vendor} [data-testid="price-vendor-forget"]`)
  await pageSays(page, 'A key ending in 7319', false)
  const forgotten = await page.evaluate(() => localStorage.getItem('kuna.secret.twelvedata'))
  if (forgotten !== null) throw new Error('Remove left the key in this browser')

  const finnhub = '[data-testid="investments-prices-card"] [data-vendor="finnhub"]'
  const finnhubKey = await pressSelector(page, press, `${finnhub} [data-testid="price-vendor-key"]`)
  await finnhubKey.type(MADE_UP_FINNHUB_KEY)
  await pressSelector(page, press, `${finnhub} [data-testid="price-vendor-save"]`)
  await pageSays(page, 'A key ending in 5521 is kept in this browser.', true)
  await pressSelector(page, press, `${finnhub} [data-testid="price-vendor-test"]`)
  await page
    .waitForFunction((selector) => document.querySelector(selector)?.textContent?.trim() === 'The key works.', { timeout: 10_000 }, `${finnhub} [data-testid="price-vendor-test-result"]`)
    .catch(() => {
      throw new Error("Test of Finnhub's profile against the fake responder does not say the key works")
    })
  await inspect?.('a Finnhub key tested')
  await pressSelector(page, press, `${finnhub} [data-testid="price-vendor-forget"]`)
  await pageSays(page, 'A key ending in 5521', false)
  if ((await page.evaluate(() => localStorage.getItem('kuna.secret.finnhub'))) !== null) throw new Error('Remove left the Finnhub key in this browser')
  // Remove keeps when it happened, so the removal outdates an older save in another browser. The next flows start without it.
  await page.evaluate(() => {
    for (const vendor of ['twelvedata', 'finnhub']) localStorage.removeItem(`kuna.secret-changed.${vendor}`)
  })

  await pressSelector(page, press, '[data-testid="prices-fetch-now"]')
  await toastMatching(page, /^Prices fetched$/)
  // The sample's closes run to the last trading day, so the fetch asks for nothing and needs no key.
  await pageSays(page, 'Every series was up to date, 7 in all.', true)
  await pageSays(page, 'The last fetch got nothing for', false)
  await inspect?.('the prices fetched with nothing missing')
  await dismissToasts(page)
}

const TWELVE_DATA_ROW = '[data-testid="investments-prices-card"] [data-vendor="twelvedata"]'

/** Forgets the Twelve Data key and the time of its last change in this browser, so the next flows start without them. */
async function forgetTwelveDataKey(page) {
  await page.evaluate(() => {
    localStorage.removeItem('kuna.secret.twelvedata')
    localStorage.removeItem('kuna.secret-changed.twelvedata')
  })
}

/**
 * The Prices tab on the sample, whose app folder on the fake Drive holds a made-up Twelve Data key another browser saved at
 * 10:00 (`?keys=other-browser`): the sync on open takes it, and the card shows its ending and says each sync saves the keys
 * to the Google account. Removed here and synced, it stays removed, since the removal is newer than that save.
 */
export async function investmentsKeyFromOtherBrowserFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector(`${TWELVE_DATA_ROW}[data-kept="true"]`, { timeout: 10_000 }).catch(() => {
    throw new Error('the sync on open did not take the key another browser saved')
  })
  await pageSays(page, 'A key ending in 8642 is kept in this browser.', true)
  await pageSays(page, 'Each sync saves them to your Google account, hidden from Drive, so every browser you sign in to gets them.', true)
  const [key, changedAt] = await page.evaluate(() => [localStorage.getItem('kuna.secret.twelvedata'), localStorage.getItem('kuna.secret-changed.twelvedata')])
  if (key !== 'made-up-twelve-data-key-8642' || changedAt !== FAKE_KEY_SAVED_AT) throw new Error(`this browser keeps the key "${key}" changed at ${changedAt}, not the other browser's`)
  await inspect?.('a key synced from another browser')
  await shoot('investments-key-synced')

  await pressSelector(page, press, `${TWELVE_DATA_ROW} [data-testid="price-vendor-forget"]`)
  await page.waitForSelector(`${TWELVE_DATA_ROW}[data-kept="false"]`, { timeout: 5_000 })
  await syncAndSettle(page, press)
  await delay(300)
  if (await page.$(`${TWELVE_DATA_ROW}[data-kept="true"]`)) throw new Error("the sync brought back the key removed here after the other browser's older save")
  const [control, removedAt] = await page.evaluate(() => [
    [...document.querySelectorAll('[data-testid="sync-status"]')].find((element) => element.offsetParent !== null)?.dataset.control ?? '',
    localStorage.getItem('kuna.secret-changed.twelvedata'),
  ])
  if (control !== 'ready') throw new Error(`the sync after the removal ended as "${control}", so the Keys step may not have saved it`)
  if (removedAt === null || removedAt <= FAKE_KEY_SAVED_AT) throw new Error(`this browser keeps the removal at ${removedAt}, not newer than the other browser's save`)
  await inspect?.('a key removed here and synced')
  await forgetTwelveDataKey(page)
}

/**
 * The Prices tab on the sample with a made-up Twelve Data key this browser saved at 10:00, whose app folder on the fake
 * Drive holds another browser's removal of it at 10:05 (`?keys=removed`): the sync on open removes it here too.
 */
export async function investmentsKeyRemovedElsewhereFlow(page, { inspect }) {
  await page.evaluate((at) => {
    localStorage.setItem('kuna.secret.twelvedata', 'made-up-twelve-data-key-0042')
    localStorage.setItem('kuna.secret-changed.twelvedata', at)
  }, FAKE_KEY_SAVED_AT)
  await page.goto(page.url().replace(/load=\d+/, `load=${Date.now()}`), { waitUntil: 'networkidle0' })
  await page.waitForSelector(`${TWELVE_DATA_ROW}[data-kept="false"]`, { timeout: 10_000 }).catch(() => {
    throw new Error('the sync on open kept the key another browser removed later')
  })
  await pageSays(page, 'A key ending in 0042', false)
  const [key, changedAt] = await page.evaluate(() => [localStorage.getItem('kuna.secret.twelvedata'), localStorage.getItem('kuna.secret-changed.twelvedata')])
  if (key !== null || changedAt !== '2026-10-30T10:05:00.000Z') throw new Error(`this browser keeps the key "${key}" changed at ${changedAt} after the other browser's removal`)
  await inspect?.("a key lost to another browser's removal")
  await forgetTwelveDataKey(page)
}

const FINNHUB_ROW = '[data-testid="investments-prices-card"] [data-vendor="finnhub"]'

/** Waits until the fake hidden folder holds only the secrets file, the sync having folded the old keys file into it and deleted it. */
async function onlySecretsFileLeft(page) {
  await page
    .waitForFunction(async () => (await window.kunaFakeHiddenFiles()).join() === 'kuna-secrets.json', { timeout: 10_000, polling: 200 })
    .catch(async () => {
      const left = await page.evaluate(() => window.kunaFakeHiddenFiles())
      throw new Error(`the hidden folder holds ${left.join(', ') || 'nothing'} after the sync, not kuna-secrets.json alone`)
    })
}

/**
 * The Prices tab on the sample, whose app folder on the fake Drive holds only the old keys file of the Investments file,
 * with a made-up Twelve Data key (`?keys=legacy`): the sync on open takes the key, writes it to the secrets file and
 * deletes the old file.
 */
export async function investmentsKeyLegacyFlow(page, { shoot, inspect }) {
  await page.waitForSelector(`${TWELVE_DATA_ROW}[data-kept="true"]`, { timeout: 10_000 }).catch(() => {
    throw new Error('the sync on open did not take the key the old keys file held')
  })
  await pageSays(page, 'A key ending in 5307 is kept in this browser.', true)
  await onlySecretsFileLeft(page)
  await inspect?.('a key taken from the old keys file')
  await shoot('investments-key-legacy')
  await forgetTwelveDataKey(page)
}

/**
 * The Prices tab on the sample, whose app folder holds both files (`?keys=legacy-and-new`): the secrets file with a
 * Twelve Data key saved at 10:00, and the old keys file with a newer Twelve Data key at 10:05 and a Finnhub key. The sync
 * on open keeps the newer key of each vendor, so both rows show the old file's keys, and only the secrets file is left.
 */
export async function investmentsKeyLegacyAndNewFlow(page, { shoot, inspect }) {
  await page.waitForSelector(`${FINNHUB_ROW}[data-kept="true"]`, { timeout: 10_000 }).catch(() => {
    throw new Error('the sync on open did not take the Finnhub key the old keys file held')
  })
  await pageSays(page, 'A key ending in 5307 is kept in this browser.', true)
  await pageSays(page, 'A key ending in 7720 is kept in this browser.', true)
  await pageSays(page, 'A key ending in 8642', false)
  await onlySecretsFileLeft(page)
  await inspect?.('the newer key of each vendor from both files')
  await shoot('investments-key-legacy-and-new')
  await forgetTwelveDataKey(page)
  await page.evaluate(() => {
    localStorage.removeItem('kuna.secret.finnhub')
    localStorage.removeItem('kuna.secret-changed.finnhub')
  })
}

const DELETE_DIALOG = '[data-testid="delete-data-dialog"]'
const DELETE_WORDS = { en: writesEnglish.deleteData, hr: writesCroatian.deleteData }

/** The IndexedDB databases this browser holds for Investments files, by name. */
async function investmentsDatabases(page) {
  return page.evaluate(async () => (await indexedDB.databases()).map((database) => database.name ?? '').filter((name) => name.startsWith('kuna-')))
}

const GOOGLE_GRANT_KEYS = ['kuna.google-granted', 'kuna.google-needed']

/** The page's record of what Google granted and what the files need, which a removal shrinks, so a flow can put it back for the steps after it. */
async function googleGrants(page) {
  return page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), GOOGLE_GRANT_KEYS)
}

async function restoreGoogleGrants(page, grants) {
  await page.evaluate((kept) => {
    for (const [key, value] of Object.entries(kept)) {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
  }, grants)
}

/** Opens Delete this app's data on the app's Settings and waits for its dialog to name what it offers and what stays. */
async function openDeleteDialog(page, press, says) {
  await pressSelector(page, press, '[data-testid="delete-data"]')
  await elementSays(page, DELETE_DIALOG, says, 'the delete dialog does not name what it offers and what stays')
  await delay(300)
}

/** The failure is first in the dialog's body and on screen, not somewhere below the rows. */
async function failureInView(page, testId) {
  const seen = await page.$eval(`[data-testid="${testId}"]`, (failure) => {
    const { top, bottom } = failure.getBoundingClientRect()
    return { role: failure.getAttribute('role'), first: failure.parentElement?.firstElementChild === failure, inView: top >= 0 && top < window.innerHeight && bottom > 0 }
  })
  if (seen.role !== 'alert') throw new Error('the failure has no alert role')
  if (!seen.first) throw new Error('the failure is not first in the dialog')
  if (!seen.inView) throw new Error('the failure is out of view')
}

async function checkboxState(page, testId) {
  return page.$eval(`[data-testid="${testId}"]`, (box) => ({
    checked: box.getAttribute('aria-checked') === 'true' || box.dataset.state === 'checked',
    disabled: box.disabled === true || box.hasAttribute('data-disabled'),
  }))
}

/**
 * Investments Settings on the sample on the fake Drive, whose secrets file another browser left in the app's hidden folder (`?keys=other-browser`),
 * so the sync on open brings a made-up Twelve Data key into this browser. The delete offers the Drive file, with the copy going along, and a backup,
 * and Cancel keeps the file. Delete then moves the file and its prices file to the bin, and this browser lands on the first run with its copy
 * and its prices gone, the vendor key still kept and the secrets file still in the hidden folder, since every app uses it.
 */
export function deleteDataDriveFlowIn(language) {
  const text = DELETE_WORDS[language]
  const says = [text.driveFile('kuna-investments.json'), text.driveFileGoesBeside('kuna-investments-prices.json'), text.staysDrive, text.otherBrowser]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    // A step before this one, with no Investments file on Drive, leaves needs without drive.appdata, and the silent token on open carries only those.
    await page.evaluate(() => localStorage.removeItem('kuna.google-needed'))
    await page.reload({ waitUntil: 'networkidle0' })
    await page
      .waitForFunction(() => localStorage.getItem('kuna.secret.twelvedata') !== null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the sync on open did not take the key another browser saved')
      })
    const grants = await googleGrants(page)
    const before = await investmentsDatabases(page)
    if (!before.some((name) => name.startsWith('kuna-prices-'))) throw new Error(`this browser keeps no prices of the sample, only ${before.join(', ')}`)
    await openDeleteDialog(page, press, says)
    await elementSays(page, '[role="dialog"]', [text.binRule], 'the dialog does not state the bin rule at its top')
    if ((await page.$('[data-testid="delete-data-copy-investments"]')) !== null) throw new Error('the copy still has a row of its own while the Drive file is ticked')
    await inspect?.('the delete asking first for a file on Drive')
    await shoot('delete-data-drive')
    await pressSelector(page, press, '[data-testid="delete-data-backup-investments"]')
    await page
      .waitForFunction((wanted) => document.querySelector('[data-testid="delete-data-backup-investments"]')?.textContent?.includes(wanted) === true, { timeout: 5_000 }, text.exported)
      .catch(() => {
        throw new Error('the export button does not say it downloaded')
      })
    if (
      !(await page.$eval(
        '[data-testid="delete-data-backup-investments"]',
        (button) => button.getAttribute('aria-label')?.includes('Ulaganja') || button.getAttribute('aria-label')?.includes('Investments'),
      ))
    )
      throw new Error('the export button does not name its app')
    await pressSelector(page, press, '[data-testid="delete-data-cancel"]')
    await dialogGone(page, DELETE_DIALOG)
    if ((await page.$('[data-testid="investments-books-card"]')) === null) throw new Error('Cancel left the Investments Settings')

    await openDeleteDialog(page, press, says)
    await pressSelector(page, press, '[data-testid="delete-data-confirm"]')
    await toastMatching(page, exactly(text.deleted(language === 'hr' ? 'Ulaganja' : 'Investments')))
    await firstRunAt(page, INVESTMENTS, 'home')
    const [choice, key] = await page.evaluate(() => [localStorage.getItem('kuna.workbook-file.investments'), localStorage.getItem('kuna.secret.twelvedata')])
    if (choice !== null) throw new Error(`this browser still names an Investments file after the delete: ${choice}`)
    if (key !== 'made-up-twelve-data-key-8642') throw new Error('the delete took the vendor key kept in this browser')
    const hidden = await page.evaluate(() => window.kunaFakeHiddenFiles())
    if (!hidden.includes('kuna-secrets.json')) throw new Error(`the delete took the secrets file from the hidden folder, which holds ${hidden.join(', ') || 'nothing'}`)
    const after = await investmentsDatabases(page)
    if (after.some((name) => name.startsWith('kuna-prices-'))) throw new Error(`the prices kept in this browser stayed after the delete: ${after.join(', ')}`)
    await inspect?.('the Investments first run after the delete')
    await shoot('delete-data-drive-done')
    await dismissToasts(page)
    await forgetTwelveDataKey(page)
    await restoreGoogleGrants(page, grants)
  }
}

/** The sample on the fake Drive with the Drive file unticked: only this browser forgets it, and a find on the first run opens the same file again. */
export async function deleteDataCopyFlow(page, { press, shoot, inspect }) {
  const text = DELETE_WORDS.en
  await page.waitForSelector('[data-testid="investments-books-card"]', { visible: true, timeout: 10_000 })
  const grants = await googleGrants(page)
  await openDeleteDialog(page, press, [text.driveFile('kuna-investments.json')])
  await pressSelector(page, press, '[data-testid="delete-data-drive-investments"]')
  await elementSays(page, DELETE_DIALOG, [text.driveCopyGoes, text.staysOnDrive], 'unticking the Drive file does not say the file stays')
  const copy = await checkboxState(page, 'delete-data-copy-investments')
  if (!copy.checked || copy.disabled) throw new Error('unticking the Drive file does not offer the copy')
  await delay(300)
  await inspect?.('the delete with only the copy ticked')
  await shoot('delete-data-copy')
  await pressSelector(page, press, '[data-testid="delete-data-copy-investments"]')
  const confirm = await page.$eval('[data-testid="delete-data-confirm"]', (button) => button.disabled)
  if (!confirm) throw new Error('Delete can be pressed with nothing ticked')
  await pressSelector(page, press, '[data-testid="delete-data-copy-investments"]')
  await pressSelector(page, press, '[data-testid="delete-data-confirm"]')
  await toastMatching(page, exactly(text.deleted('Investments')))
  await firstRunAt(page, INVESTMENTS, 'home')
  await dismissToasts(page)
  await restoreGoogleGrants(page, grants)
}

/** A file someone shared with the person (`?investments=given`): Drive refuses the bin, the dialog says so and stays, and the copy and the app go on as before. */
export function deleteDataGivenFlowIn(language) {
  const text = DELETE_WORDS[language]
  const refusal = language === 'hr' ? storageInfrastructureCroatian.trashRefused : storageInfrastructureEnglish.trashRefused
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="investments-books-card"]', { visible: true, timeout: 10_000 })
    await openDeleteDialog(page, press, [text.driveFile('kuna-investments.json')])
    await pressSelector(page, press, '[data-testid="delete-data-confirm"]')
    await page.waitForSelector('[data-testid="delete-data-failed"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a refused bin does not say so')
    })
    await elementSays(
      page,
      DELETE_DIALOG,
      [text.stillHere, refusal, text.lineGone.besideFile('kuna-investments-prices.json')],
      'the delete does not say Drive refused, the copy stays and the prices file can be restored',
    )
    if ((await page.$eval(DELETE_DIALOG, (dialog) => dialog.textContent)).includes(text.tryAgain)) throw new Error('the delete offers a retry that cannot work for a file only its owner can bin')
    await failureInView(page, 'delete-data-failed')
    await delay(300)
    await inspect?.('the delete refused for a file someone shared')
    await shoot('delete-data-given')
    const before = await page.evaluate(() => localStorage.getItem('kuna.workbook-file.investments'))
    if (before === null) throw new Error('a refused bin forgot the file')
    const databases = await investmentsDatabases(page)
    if (!databases.some((name) => name.startsWith('kuna-workbook-'))) throw new Error(`a refused bin deleted the copy, leaving ${databases.join(', ')}`)
    await pressSelector(page, press, '[data-testid="delete-data-cancel"]')
    await dialogGone(page, DELETE_DIALOG)
    if ((await page.$('[data-testid="investments-books-card"]')) === null) throw new Error('a refused bin left the Investments Settings')
  }
}

/**
 * The sample kept in this browser (`?investments=browser`), with a second tab open on its Overview: the delete offers only the file here, and once
 * confirmed the file and its prices are gone, this tab lands on the first run and the other tab follows it there by itself.
 */
export async function deleteDataBrowserFlow(page, { press, shoot, inspect }) {
  const text = DELETE_WORDS.en
  await page.waitForSelector('[data-testid="investments-books-card"]', { visible: true, timeout: 10_000 })
  const grants = await googleGrants(page)
  const before = await investmentsDatabases(page)
  for (const name of ['kuna-document-local-fake-investments', 'kuna-prices-local-fake-investments']) {
    if (!before.includes(name)) throw new Error(`this browser holds no ${name} before the delete, only ${before.join(', ')}`)
  }
  const otherTab = await page.browserContext().newPage()
  try {
    await otherTab.goto(page.url().replace('#/investments/settings', '#/investments'), { waitUntil: 'networkidle0' })
    await otherTab.waitForSelector('[data-testid="investments-cards"]', { visible: true, timeout: 10_000 })
    await page.bringToFront()
    await openDeleteDialog(page, press, [text.browserFile, text.staysHere, text.staysBrowser])
    if (!(await page.$eval('[data-testid="delete-data-confirm"]', (button) => button.disabled))) throw new Error('Delete can be pressed before a file kept in this browser is ticked')
    await pressSelector(page, press, '[data-testid="delete-data-copy-investments"]')
    await elementSays(page, DELETE_DIALOG, [text.forGood, text.browserFileGoes], 'ticking the file kept here does not say it goes for good')
    if ((await page.$('[data-testid="delete-data-drive-investments"]')) !== null) throw new Error('a file kept in this browser offers a Drive file')
    await inspect?.('the delete asking first for a file kept in this browser')
    await shoot('delete-data-browser')
    await pressSelector(page, press, '[data-testid="delete-data-confirm"]')
    await toastMatching(page, exactly(text.deleted('Investments')))
    await firstRunAt(page, INVESTMENTS, 'home')
    await firstRunAt(otherTab, INVESTMENTS, 'home').catch(() => {
      throw new Error('the other open tab did not notice the delete')
    })
  } finally {
    await otherTab.close()
  }
  const after = await investmentsDatabases(page)
  const left = after.filter((name) => name.endsWith('local-fake-investments'))
  if (left.length > 0) throw new Error(`the delete left ${left.join(', ')} in this browser`)
  if ((await page.evaluate(() => localStorage.getItem('kuna.workbook-file.investments'))) !== null) throw new Error('this browser still names the Investments file after the delete')
  await inspect?.('the Investments first run after deleting the file kept here')
  await dismissToasts(page)
  await restoreGoogleGrants(page, grants)
}

/**
 * All of Kuna with Investments a file someone shared (`?investments=given`) and the company unticked: Drive refuses the bin, what failed comes first and in
 * view, and the company's rows stay unticked, so a retry would bin nothing the person kept.
 */
export function deleteKunaFailsFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="delete-kuna"]')
    await page.waitForSelector('[data-testid="delete-data-drive-company"]', { visible: true, timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="delete-data-drive-company"]')
    await pressSelector(page, press, '[data-testid="delete-data-copy-company"]')
    await page.type('[data-testid="delete-kuna-name"]', 'Kuna')
    await pressSelector(page, press, '[data-testid="delete-kuna-confirm"]')
    await page.waitForSelector('[data-testid="delete-kuna-failed"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a refused bin in all of Kuna does not say so')
    })
    await delay(300)
    await failureInView(page, 'delete-kuna-failed')
    if ((await checkboxState(page, 'delete-data-drive-company')).checked || (await checkboxState(page, 'delete-data-copy-company')).checked)
      throw new Error('a failure ticked again what the person unticked')
    await inspect?.('all of Kuna after a refused bin')
    await shoot('delete-kuna-fails')
    await pressSelector(page, press, '[data-testid="delete-kuna-cancel"]')
    await dialogGone(page, '[data-testid="delete-kuna-dialog"]')
  }
}

/**
 * Kuna settings with the company on the fake Drive and Investments in this browser: Delete all of Kuna lists both with what they share, the keys in
 * the Google account and the backups unticked, and Delete stays off until the name is typed. Once confirmed with the backups ticked, every app is on its first run, the home welcomes again, and only the file Kuna did not make is left in the backups folder.
 */
export function deleteKunaFlowIn(language) {
  const words = language === 'hr' ? kunaSettingsCroatian : kunaSettingsEnglish
  const text = words.deleteData.all
  const storage = DELETE_WORDS[language]
  // Node picks plural forms by English rules, and the page by the language's.
  const twoBackups = storage.backupsCounted(2)
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const grants = await googleGrants(page)
    await pressSelector(page, press, '[data-testid="delete-kuna"]')
    await elementSays(page, '[data-testid="delete-kuna-dialog"]', [text.googleKeys, text.browserSettings, text.stays], 'the delete of all of Kuna does not list what the apps share')
    await delay(300)
    for (const app of ['company', 'investments']) {
      if ((await page.$(`[data-testid="delete-data-${app}"]`)) === null) throw new Error(`the delete of all of Kuna does not list ${app}`)
    }
    if ((await checkboxState(page, 'delete-kuna-google-keys')).checked) throw new Error('the keys in the Google account start ticked, and they go for good')
    if ((await checkboxState(page, 'delete-data-backups-company')).checked) throw new Error('the backups start ticked')
    if ((await checkboxState(page, 'delete-data-copy-investments')).checked) throw new Error('a file kept only in this browser starts ticked')
    await elementSays(page, '[data-testid="delete-kuna-dialog"]', [twoBackups.few ?? twoBackups.other, storage.backupsStay, text.googleKeysStay], 'the unticked rows do not say what stays')
    if (!(await page.$eval('[data-testid="delete-kuna-confirm"]', (button) => button.disabled))) throw new Error('Delete can be pressed before the name is typed')
    await inspect?.('the delete of all of Kuna asking first')
    await shoot('delete-kuna')
    await page.type('[data-testid="delete-kuna-name"]', 'Kun')
    if (!(await page.$eval('[data-testid="delete-kuna-confirm"]', (button) => button.disabled))) throw new Error('Delete can be pressed on part of the name')
    await page.type('[data-testid="delete-kuna-name"]', 'a')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="delete-kuna-confirm"]')?.disabled === false, { timeout: 5_000 })
      .catch(() => {
        throw new Error('typing the name does not let Delete be pressed')
      })
    await pressSelector(page, press, '[data-testid="delete-data-backups-company"]')
    await elementSays(page, '[data-testid="delete-kuna-dialog"]', [storage.backupsGo], 'ticking the backups does not say they go')
    await pressSelector(page, press, '[data-testid="delete-data-copy-investments"]')
    await shoot('delete-kuna-typed')
    await pressSelector(page, press, '[data-testid="delete-kuna-confirm"]')
    await toastMatching(page, exactly(text.deleted))
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('deleting all of Kuna does not land on the home welcome')
    })
    const left = await page.evaluate(() => Object.keys(localStorage).filter((name) => name.startsWith('kuna.workbook-file.')))
    if (left.length > 0) throw new Error(`this browser still names ${left.join(', ')} after the delete`)
    const backupsLeft = await page.evaluate(() => window.kunaFakeBackupsLeft())
    if (backupsLeft.join() !== 'my-notes.json') throw new Error(`the backups folder holds ${backupsLeft.join(', ') || 'nothing'}, not only the file Kuna did not make`)
    await inspect?.('the home after deleting all of Kuna')
    await shoot('delete-kuna-done')
    await dismissToasts(page)
    await restoreGoogleGrants(page, grants)
  }
}

/**
 * Another device's Investments file in the Drive bin (`?investments=binned`), read longer ago than a sync on open waits:
 * the sync on open finds it there and stops, the sync control counts the problem, the books step says so and links to
 * the Settings, and the Settings' file card says Kuna stopped using the file beside Switch storage, and the delete offers only this browser's copy.
 */
export async function investmentsBinnedFlow(page, { press, shoot, inspect }) {
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  const group = `${SYNC_STEPS} [data-group="investments"]`
  await page
    .waitForFunction(
      (css, wanted) => [...document.querySelectorAll(css)].some((line) => line.offsetParent !== null && line.dataset.state === 'failed' && line.textContent?.includes(wanted)),
      { timeout: 10_000 },
      `${group} [data-step="books"]`,
      storageEnglish.inBin,
    )
    .catch(() => {
      throw new Error('the Investments books step does not fail with the file in the bin')
    })
  const skipped = await page.$$eval(`${group} [data-step]`, (lines) => lines.filter((line) => line.offsetParent !== null).map((line) => `${line.dataset.step}:${line.dataset.state}`))
  if (skipped.some((line) => /^(keys|prices):(?!skipped|off)/.test(line))) throw new Error(`a step after the books ran on a file in the bin: ${skipped.join(', ')}`)
  await delay(400)
  await inspect?.('the steps of a sync that found the file in the bin')
  await shoot('investments-binned-steps')
  await pressButton(page, press, `${group} [data-step="books"] a`, 'Settings')
  await page.waitForSelector('[data-testid="books-file-missing"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the Investments Settings do not say Kuna stopped using the file in the bin')
  })
  await page
    .waitForFunction((css) => ![...document.querySelectorAll(css)].some((element) => element.offsetParent !== null), { timeout: 5_000 }, SYNC_STEPS)
    .catch(() => {
      throw new Error('the sync steps stayed open after their link to the Settings')
    })
  await delay(300)
  if ((await page.$('[data-testid="investments-switch-storage"]')) === null) throw new Error('the Investments Settings offer no Switch storage beside the file in the bin')
  await inspect?.('the Investments Settings on a file in the bin')
  await shoot('investments-binned-settings')
  await openDeleteDialog(page, press, [DELETE_WORDS.en.driveCopy, DELETE_WORDS.en.missingCopyGoes])
  if ((await page.$('[data-testid="delete-data-drive-investments"]')) !== null) throw new Error('the delete offers a Drive file already in the bin')
  await pressSelector(page, press, '[data-testid="delete-data-cancel"]')
  await dialogGone(page, DELETE_DIALOG)
}

/**
 * Investments Settings on the sample, with a made-up Twelve Data key kept: Add a benchmark opens the holding dialog,
 * whose search asks the fake responder for ABC, and picking its listing fills the symbol, the name, the type proposed
 * from the vendor's Common Stock, the exchange and the currency. Escape closes the dialog without saving.
 */
export function investmentsInstrumentSearchFlowIn(language) {
  const croatian = language === 'hr'
  const share = croatian ? 'Dionica' : 'Share'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await page.evaluate(() => localStorage.setItem('kuna.secret.twelvedata', 'made-up-twelve-data-key-0042'))
    await pressSelector(page, press, '[data-testid="benchmark-add"]')
    await page.waitForSelector('[data-testid="instrument-search"]', { visible: true, timeout: 10_000 })
    await shoot('investments-instrument-search-empty')
    await fill(page, 'instrument-search-text', 'abc')
    await pressSelector(page, press, '[data-testid="instrument-search-button"]')
    await elementSays(page, '[data-testid="instrument-search-results"]', ['ABC · Example Tech', `NASDAQ · USD · ${share} · Twelve Data`], 'the search does not list the fake listing')
    await inspect?.('the listings a search found')
    await shoot('investments-instrument-search')
    await pressSelector(page, press, '[data-testid="instrument-search-result"]')
    const filled = await page.evaluate(() => ({
      symbol: document.querySelector('[data-testid="instrument-symbol"]')?.value,
      name: document.querySelector('[data-testid="instrument-name"]')?.value,
      exchange: document.querySelector('[data-testid="instrument-exchange"]')?.value,
    }))
    if (filled.symbol !== 'ABC' || filled.name !== 'Example Tech' || filled.exchange !== 'XNAS') throw new Error(`the pick filled ${JSON.stringify(filled)}`)
    await elementSays(page, '[data-testid="instrument-type"]', [share], 'the pick does not propose the type')
    await elementSays(page, '[data-testid="instrument-currency"]', ['USD'], 'the pick does not fill the currency')
    await shoot('investments-instrument-search-picked')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="instrument-form"]')
    // The import step after this one runs without keys, so its parent pick looks up no closes.
    await page.evaluate(() => localStorage.removeItem('kuna.secret.twelvedata'))
  }
}

export const investmentsInstrumentSearchFlow = investmentsInstrumentSearchFlowIn('en')

/**
 * Investments Settings on the sample: Add a benchmark opens the holding dialog, whose Price is menu turns it into a bond
 * priced in percent. The coupon and maturity appear, the type becomes Bond, and a save without them marks both.
 */
export function investmentsBondFlowIn(language) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await pressSelector(page, press, '[data-testid="benchmark-add"]')
    await page.waitForSelector('[data-testid="instrument-form"]', { visible: true, timeout: 10_000 })
    await delay(600)
    await shoot('investments-instrument-quoted-unit')
    await chooseStartingWith(page, press, '[data-testid="instrument-quoted"]', croatian ? 'Postotak nominale' : 'Percent of nominal')
    await elementSays(page, '[data-testid="instrument-type"]', [croatian ? 'Obveznica' : 'Bond'], 'the bond quoting does not set the type')
    await fill(page, 'instrument-name', 'Example Treasury Bond')
    await fill(page, 'instrument-symbol', 'EXB')
    await pressSelector(page, press, '[data-testid="instrument-save"]')
    await elementSays(page, '[data-testid="instrument-form"]', [croatian ? 'Odaberi datum' : 'Pick a date'], 'a bond without a maturity is not marked')
    await scrollIntoDialogView(page, '[data-testid="instrument-coupon"]')
    await inspect?.('the holding dialog for a bond without its coupon and maturity')
    await shoot('investments-instrument-quoted-bond-marked')
    await fill(page, 'instrument-coupon', croatian ? '3,5' : '3.5')
    await fill(page, 'instrument-maturity', '2030-03-02')
    await shoot('investments-instrument-quoted-bond')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="instrument-form"]')
  }
}

/**
 * A cursor a little beside the 8 Sep buy on Example Tech's daily Price chart still opens that buy's tooltip, though
 * a day on the long line is about a pixel wide. The buy dots are found by their colour on the canvas, then the
 * pointer moves out from inside the dot until the tooltip stops naming it.
 */
export async function investmentsHoldingDotHoverFlow(page, { inspect }) {
  const canvas = '[data-testid="holding-price-chart"] .chart-body canvas'
  await page.waitForSelector(canvas, { visible: true })
  await page.$eval(canvas, (element) => element.scrollIntoView({ block: 'center' }))
  await settleCharts(page)
  const readsTheBuy = async (x, y) => {
    await page.mouse.move(x, y)
    await delay(50)
    // A desktop chart's tooltip carries no class of Kuna's, so it is ECharts' own box inside the chart.
    const text = await page.evaluate(
      () => [...document.querySelectorAll('[data-testid="holding-price-chart"] .chart-body div')].find((box) => box.style.zIndex === '9999999' && box.style.display !== 'none')?.textContent ?? '',
    )
    return text.includes('Bought 3 units at $155.40') && !text.includes('Bought 5 units at $158.00') && !text.includes('Bought 2 units at $160.10')
  }
  const buyPixels = await page.$eval(canvas, (element) => {
    const colour = getComputedStyle(document.documentElement).getPropertyValue('--invest-buy').trim()
    const [red, green, blue] = [1, 3, 5].map((start) => parseInt(colour.slice(start, start + 2), 16))
    const box = element.getBoundingClientRect()
    const scale = element.width / box.width
    const pixels = element.getContext('2d').getImageData(0, 0, element.width, element.height).data
    const found = []
    for (let y = 0; y < element.height; y += 3) {
      for (let x = 0; x < element.width; x += 3) {
        const at = (y * element.width + x) * 4
        if (Math.abs(pixels[at] - red) + Math.abs(pixels[at + 1] - green) + Math.abs(pixels[at + 2] - blue) < 12) found.push({ x: box.x + x / scale, y: box.y + y / scale })
      }
    }
    // September's buys lie near the right end of the line.
    return found.sort((one, other) => other.x - one.x)
  })
  let inside = null
  for (const pixel of buyPixels) {
    if (await readsTheBuy(pixel.x, pixel.y)) {
      inside = pixel
      break
    }
  }
  if (inside === null) throw new Error(`no pointer on any of ${buyPixels.length} buy-coloured pixels opens the 8 Sep buy`)
  const lastReading = async (from, across, down) => {
    let last = from
    for (let step = 1; step <= 40; step += 1) {
      const next = { x: from.x + across * step, y: from.y + down * step }
      if (!(await readsTheBuy(next.x, next.y))) break
      last = next
    }
    return last
  }
  const middle = { x: inside.x, y: ((await lastReading(inside, 0, -1)).y + (await lastReading(inside, 0, 1)).y) / 2 }
  const reach = (await lastReading(middle, 1, 0)).x - (await lastReading(middle, -1, 0)).x
  // A 12 px dot is 12 px across, and a cursor should open it from a little past its edge on both sides.
  if (reach < 16) throw new Error(`a cursor opens the 8 Sep buy over ${reach} px across, so the dot is hard to point at`)
  await inspect?.('a cursor beside the 8 Sep buy')
}

/**
 * A chart's Compare with on the sample, first with no key and with a made-up Finnhub key, then with a made-up Twelve
 * Data key kept for the page's life: the search asks the fake responder for EXQ, the pick names it in a chip and in the
 * address, the chart then reads as change in percent, and the chip's Remove takes it away again. Then S&P 500 (SPY), one
 * of the funds the dialog names, does the same. The keys go before the flow ends, so the steps after it start clean.
 */
export function investmentsCompareFlowIn(card, shotName) {
  const chart = `[data-testid="${card}"]`
  const chartSays = (page) => page.$eval(`${chart} .chart-body [aria-label]`, (element) => element.getAttribute('aria-label') ?? '').catch(() => '')
  return async (page, { press, shoot, inspect }) => {
    try {
      // With no key of any vendor, Compare with still opens, its funds wait for a Twelve Data key with a link to the Prices settings, and the search is not offered.
      await page.evaluate(() =>
        Object.keys(localStorage)
          .filter((key) => key.startsWith('kuna.secret'))
          .forEach((key) => localStorage.removeItem(key)),
      )
      await page.reload({ waitUntil: 'networkidle0' })
      await pressSelector(page, press, `${chart} [data-testid="compare-open"]`)
      await page.waitForSelector('[data-testid="compare-funds"]', { visible: true, timeout: 10_000 })
      await delay(400)
      const offered = await page.$$eval('[data-testid="compare-fund"]', (buttons) => buttons.map((button) => button.disabled))
      if (offered.length !== 5 || offered.some((disabled) => !disabled)) throw new Error('the funds can be pressed without a Twelve Data key')
      await elementSays(
        page,
        '[data-testid="compare-funds-note"]',
        ['Add your Twelve Data key in the Prices settings to use these funds and the search.', 'Prices settings'],
        'the funds do not say that they and the search need a Twelve Data key',
      )
      if ((await page.$$('[data-testid="compare-funds-settings"]')).length !== 1) throw new Error('Compare with shows more than one way to the Prices settings')
      await page.waitForSelector('[data-testid="compare-funds-settings"]', { visible: true, timeout: 5_000 })
      if (await page.$('[data-testid="instrument-search"]')) throw new Error('the search is offered with no key to search with')
      await inspect?.('Compare with without a Twelve Data key')
      await shoot(`${shotName}-no-key`)
      await page.keyboard.press('Escape')
      await dialogGone(page, '[data-testid="compare-funds"]')

      // With another vendor's key the search is offered, and the funds still wait for a Twelve Data key with the one link.
      await page.evaluate(() => localStorage.setItem('kuna.secret.finnhub', 'made-up-finnhub-key-0042'))
      await page.reload({ waitUntil: 'networkidle0' })
      await pressSelector(page, press, `${chart} [data-testid="compare-open"]`)
      await page.waitForSelector('[data-testid="instrument-search"]', { visible: true, timeout: 10_000 })
      await delay(400)
      await elementSays(
        page,
        '[data-testid="compare-funds-note"]',
        ['No Twelve Data key in this browser. Add your Twelve Data key in the Prices settings.', 'Prices settings'],
        'the funds do not say that they need a Twelve Data key while another vendor has one',
      )
      if ((await page.$$('[data-testid="compare-funds-settings"]')).length !== 1) throw new Error('Compare with shows more than one way to the Prices settings')
      await inspect?.("Compare with with another vendor's key")
      await page.keyboard.press('Escape')
      await dialogGone(page, '[data-testid="compare-funds"]')
      await page.evaluate(() => localStorage.removeItem('kuna.secret.finnhub'))

      await page.evaluate(() => localStorage.setItem('kuna.secret.twelvedata', 'made-up-twelve-data-key-0042'))
      await page.reload({ waitUntil: 'networkidle0' })
      await pressSelector(page, press, `${chart} [data-testid="compare-open"]`)
      await page.waitForSelector('[data-testid="instrument-search"]', { visible: true, timeout: 10_000 })
      await fill(page, 'instrument-search-text', 'exq')
      await pressSelector(page, press, '[data-testid="instrument-search-button"]')
      await elementSays(page, '[data-testid="instrument-search-results"]', ['EXQ · Example Quality Fund', 'NASDAQ · USD'], 'the search does not list the fake listing')
      await inspect?.('the listings Compare with found')
      await shoot(`${shotName}-search`)
      await pressSelector(page, press, '[data-testid="instrument-search-result"]')
      await dialogGone(page, '[data-testid="instrument-search"]')
      await elementSays(page, `${chart} [data-testid="compare-chip"]`, ['EXQ'], 'the pick shows no chip')
      await page
        .waitForFunction(() => decodeURIComponent(window.location.hash).includes('compare=twelvedata:EXQ'), { timeout: 5_000 })
        .catch(() => {
          throw new Error('the pick is not kept in the address')
        })
      await elementSays(page, chart, ['Change since'], 'the chart does not say it shows the change since its first day')
      await page
        .waitForFunction((selector) => /EXQ [+−-]?[\d.,]+\s?%/.test(document.querySelector(selector)?.getAttribute('aria-label') ?? ''), { timeout: 10_000 }, `${chart} .chart-body [aria-label]`)
        .catch(async () => {
          throw new Error(`the chart does not read EXQ in percent, it says: ${await chartSays(page)}`)
        })
      await inspect?.('a chart compared with EXQ')
      await shoot(shotName)
      await pressSelector(page, press, `${chart} [data-testid="compare-chip"]`)
      await page
        .waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, `${chart} [data-testid="compare-chip"]`)
        .catch(() => {
          throw new Error('Remove left the chip')
        })
      if ((await page.evaluate(() => window.location.hash)).includes('compare=')) throw new Error('Remove left the pick in the address')
      if ((await chartSays(page)).includes('EXQ')) throw new Error('Remove left the compared line on the chart')

      await pressSelector(page, press, `${chart} [data-testid="compare-open"]`)
      await page.waitForSelector('[data-testid="compare-funds"]', { visible: true, timeout: 10_000 })
      await delay(400)
      const funds = await page.$$eval('[data-testid="compare-fund"]', (buttons) => buttons.map((button) => button.textContent?.trim() ?? ''))
      if (funds.join(', ') !== 'S&P 500 (SPY), Dow Jones (DIA), Nasdaq-100 (QQQ), Nasdaq Composite (ONEQ), Gold (GLD)') throw new Error(`the dialog names the funds ${funds.join(', ')}`)
      await elementSays(page, '[data-testid="compare-funds-note"]', ['fund that tracks its index', 'without the dividends'], 'the dialog does not say what the funds are')
      await inspect?.('the funds Compare with names')
      await shoot(`${shotName}-funds`)
      await pressLabelled(page, press, '[data-testid="compare-funds"]', 'S&P 500 (SPY)')
      await dialogGone(page, '[data-testid="compare-funds"]')
      await elementSays(page, `${chart} [data-testid="compare-chip"]`, ['S&P 500 (SPY)'], 'the fund picked shows no chip with its name')
      await page
        .waitForFunction(() => decodeURIComponent(window.location.hash).includes('compare=twelvedata:SPY'), { timeout: 5_000 })
        .catch(() => {
          throw new Error('the fund picked is not kept in the address')
        })
      await page
        .waitForFunction(
          (selector) => /S&P 500 \(SPY\) [+−-]?[\d.,]+\s?%/.test(document.querySelector(selector)?.getAttribute('aria-label') ?? ''),
          { timeout: 10_000 },
          `${chart} .chart-body [aria-label]`,
        )
        .catch(async () => {
          throw new Error(`the chart does not read S&P 500 (SPY) in percent, it says: ${await chartSays(page)}`)
        })
      await shoot(`${shotName}-fund`)
      await pressSelector(page, press, `${chart} [data-testid="compare-chip"]`)
      await page
        .waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, `${chart} [data-testid="compare-chip"]`)
        .catch(() => {
          throw new Error('Remove left the fund')
        })
    } finally {
      await page.evaluate(() => ['twelvedata', 'finnhub'].forEach((vendor) => localStorage.removeItem(`kuna.secret.${vendor}`)))
    }
  }
}

/**
 * The sample's world ETF in its holding dialog: a two-word country, a code in brackets and Not set typed into the Country
 * field, then a two-word country and a code in brackets typed into a new line of the fund's country mix, each picked with
 * Enter. Escape closes the dialog without saving.
 */
export async function investmentsCountrySearchFlow(page, { press, shoot, inspect }) {
  await goTo(page, `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`, 'Example World ETF')
  await pressSelector(page, press, '[data-testid="holding-change"]')
  await page.waitForSelector('[data-testid="instrument-form"]', { visible: true })
  const country = '[data-testid="instrument-country"]'
  await pickTyped(page, press, country, 'United Kingdom', 'United Kingdom (GB)', shoot)
  await pickTyped(page, press, country, '(US)', 'United States (US)')
  await inspect?.('the Country field with a country picked')
  await pickTyped(page, press, country, 'Not set', 'Not set')
  await pressLabelled(page, press, '[data-testid="instrument-mix-pick"]', 'By country or region')
  await pressSelector(page, press, '[data-testid="instrument-mix-add"]')
  const line = '[data-testid="instrument-mix-line"]:last-child [data-testid="instrument-mix-group"]'
  await pickTyped(page, press, line, 'South Korea', 'South Korea (KR)')
  await pickTyped(page, press, line, '(US)', 'United States (US)')
  await page.keyboard.press('Escape')
  await dialogGone(page, '[data-testid="instrument-form"]')
}

/** Opens a searchable list, types the query, waits for the first match to be the one wanted and highlighted, and picks it with Enter. */
async function pickTyped(page, press, trigger, query, wanted, shoot) {
  await pressSelector(page, press, trigger)
  await page.waitForSelector('[role="listbox"]', { visible: true })
  await delay(200)
  await page.keyboard.type(query)
  await page
    .waitForFunction(
      (label) => {
        const first = document.querySelector('[role="option"]')
        return first?.textContent?.trim() === label && first.hasAttribute('data-highlighted')
      },
      { timeout: 5_000 },
      wanted,
    )
    .catch(async () => {
      const listed = await page.$$eval('[role="option"]', (options) =>
        options.slice(0, 3).map((option) => `${option.textContent?.trim()}${option.hasAttribute('data-highlighted') ? ' (highlighted)' : ''}`),
      )
      throw new Error(`"${query}" does not put ${wanted} first and highlighted, the list starts ${JSON.stringify(listed)}`)
    })
  await shoot?.('investments-country-search')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await elementSays(page, trigger, [wanted], `Enter after "${query}" does not pick ${wanted}`)
}

/**
 * Investments Settings, Prices, on the sample: three made-up CSV files of closes dropped at once on Import closes, two
 * matched to holdings by their names and one picked by hand, their dry run, and one import of all three.
 */
export function investmentsClosesImportFlowIn(language, files) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    const input = await page.waitForSelector('[data-testid="investments-closes-import"] input[type="file"]', { timeout: 10_000 }).catch(() => {
      throw new Error('Import closes offers no file input')
    })
    await input.uploadFile(...files)
    await page
      .waitForFunction(() => document.querySelectorAll('[data-testid="closes-import-file"]').length === 3, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the closes import does not list the three files dropped')
      })
    const adds = await page.$$eval('[data-testid="closes-import-adds"]', (lines) => lines.map((line) => line.textContent?.trim() ?? ''))
    if (adds.length !== 2) throw new Error(`the closes import matched ${adds.length} files by name, not 2`)
    await chooseStartingWith(page, press, '[data-testid="closes-import-holding"]', 'Example Index Fund')
    await page
      .waitForFunction(() => document.querySelectorAll('[data-testid="closes-import-adds"]').length === 3, { timeout: 5_000 })
      .catch(() => {
        throw new Error('picking a holding for the unmatched file gave it no dry run')
      })
    await inspect?.('the closes import dry run')
    await shoot('investments-closes-import')
    await pressSelector(page, press, '[data-testid="closes-import-confirm"]')
    await toastMatching(page, croatian ? /^Uvezene su cijene 3 pozicije$/ : /^Closes of 3 holdings imported$/)
    await page.waitForSelector('[data-testid="closes-import-file"]', { hidden: true, timeout: 5_000 })
    await dismissToasts(page)
  }
}

/**
 * The Loans first run with the company books on the fake Drive: Loans opens on it, a new file on the
 * fake Drive lands in its Kuna folder as kuna-loans.json, the Loans Overview says it holds no loans yet, and the
 * Loans Settings names the file.
 */
export function loansDriveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const createdIn = exactly(words.writes.firstRun.folder.created('kuna-loans.json', inKunaFolder(words, 'loans')))
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await firstRunAt(page, LOANS, 'home')
    await inspect?.('the Loans first run')
    await shoot('loans-start')
    await chooseOption(page, press, 'loans-start-home', words.writes.firstRun.home.drive)
    await pressSelector(page, press, '[data-testid="loans-start-continue"]')
    await firstRunAt(page, LOANS, 'folder')
    const confirm = await page.waitForSelector('[data-testid="loans-start-folder-confirm"]', { visible: true, timeout: 10_000 })
    const said = await confirm.evaluate((element) => element.textContent ?? '')
    if (!said.includes('Kuna › loans') || !said.includes('kuna-loans.json')) throw new Error(`the folder confirm says "${said}", not its Kuna folder and kuna-loans.json`)
    await inspect?.('the Loans folder confirm')
    await shoot('loans-start-folder')
    await pressSelector(page, press, '[data-testid="loans-start-create"]')
    await toastMatching(page, createdIn)
    await firstRunAt(page, LOANS, 'overview')
    await pageSays(page, words.loansOverview.empty.onDrive('kuna-loans.json'), true)
    await inspect?.('the empty Loans Overview')
    await shoot('loans-overview')
    await dismissToasts(page)
    await settingsShowFile(page, press, LOANS, 'kuna-loans.json', words)
    await inspect?.('the Loans Settings')
    await shoot('loans-settings')
  }
}

export const loansDriveFlow = loansDriveFlowIn('en')

/** An app whose file the first run keeps: Loans or Assets, with what its screens call the file and its empty Overview. */
const FILE_APPS = {
  loans: { app: LOANS, file: 'kuna-loans.json', fileWords: (words) => words.loansFile, inBrowser: (words) => words.loansOverview.empty.inBrowser },
  assets: { app: ASSETS, file: 'kuna-assets.json', fileWords: (words) => words.assetsFile, inBrowser: (words) => words.assetsOverview.empty.inBrowser },
  spending: { app: SPENDING, file: 'kuna-spending.json', fileWords: (words) => words.spendingFile, inBrowser: (words) => words.spendingOverview.empty.inBrowser },
}

/** The app's first run keeps a new file in this browser: the empty Overview says so, and so does its Settings. */
export function firstRunBrowserFlowIn(id, language) {
  const words = SCREEN_WORDS[language]
  const { app, inBrowser } = FILE_APPS[id]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await firstRunAt(page, app, 'home')
    await chooseOption(page, press, `${app.id}-start-home`, words.writes.firstRun.home.browser)
    await pressSelector(page, press, `[data-testid="${app.id}-start-continue"]`)
    await firstRunAt(page, app, 'overview')
    await pageSays(page, inBrowser(words), true)
    await inspect?.(`the empty ${app.name} Overview in this browser`)
    await shoot(`${app.id}-overview-browser`)
    await settingsShowFile(page, press, app, words.writes.localFile.kept, words)
    await inspect?.(`the ${app.name} Settings in this browser`)
    await shoot(`${app.id}-settings-browser`)
  }
}

/** Assets set up in a second tab reach this one without a reload: the home card stops offering Set up and the menu lists the app. */
export async function setUpInOtherTabFlow(page, { shoot, inspect }) {
  const words = SCREEN_WORDS.en
  const card = (state) => `[data-testid="home-card"][data-app="assets"][data-state="${state}"]`
  await page.evaluate(() => {
    window.location.hash = '#/'
  })
  await page.waitForSelector(card('set-up'), { visible: true, timeout: 10_000 })
  const otherTab = await page.browserContext().newPage()
  try {
    await otherTab.goto(page.url().replace(/#.*$/, '#/assets'), { waitUntil: 'networkidle0' })
    await firstRunAt(otherTab, ASSETS, 'home')
    const clickIt = (element) => element.click()
    await chooseOption(otherTab, clickIt, 'assets-start-home', words.writes.firstRun.home.browser)
    await pressSelector(otherTab, clickIt, '[data-testid="assets-start-continue"]')
    await firstRunAt(otherTab, ASSETS, 'overview')
  } finally {
    await otherTab.close()
  }
  await page.bringToFront()
  await page.waitForSelector(card('open'), { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the home card still offers Set up after the other tab set Assets up')
  })
  const hasMenu = await page.$('[data-testid="nav-apps"]')
  if (hasMenu !== null && (await page.$('[data-testid="nav-app"][data-app="assets"]')) === null) throw new Error('the menu does not list Assets after the other tab set it up')
  await inspect?.('the home after a second tab set Assets up')
  await shoot('set-up-in-other-tab')
}

/** The Loans first run on a device that has not chosen the Loans file another device made on the fake Drive: Find the file opens it by its mark. */
export function loansOpenFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await firstRunAt(page, LOANS, 'home')
    await chooseOption(page, press, 'loans-start-home', words.writes.firstRun.home.open)
    await pressSelector(page, press, '[data-testid="loans-start-continue"]')
    await firstRunAt(page, LOANS, 'find')
    await inspect?.('the Loans find step')
    await shoot('loans-start-find')
    await pressSelector(page, press, '[data-testid="loans-start-find"]')
    await toastMatching(page, exactly(words.loansFile.opened('kuna-loans.json')))
    await firstRunAt(page, LOANS, 'overview')
    await inspect?.('the Loans file opened')
  }
}

export const loansOpenFlow = loansOpenFlowIn('en')

/** A new file of the app on Drive on a device that has not chosen the one another device made: the folder step refuses a second file and offers the find step, which opens it. */
export function firstRunOnDriveFlowIn(id, language) {
  const words = SCREEN_WORDS[language]
  const { app, file, fileWords } = FILE_APPS[id]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await firstRunAt(page, app, 'folder')
    await pressSelector(page, press, `[data-testid="${app.id}-start-create"]`)
    const alert = await page.waitForSelector(`[data-testid="${app.id}-start-on-drive"]`, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error(`the ${app.name} folder step does not say Drive already holds the ${app.name} file`)
    })
    const said = await alert.evaluate((element) => element.textContent ?? '')
    const refusal = words.storage.alreadyOnDrive(file)
    if (!said.includes(refusal)) throw new Error(`the ${app.name} folder step says "${said}", not ${refusal}`)
    if (await page.$(`[data-testid="${app.id}-start-failure"]`)) throw new Error(`the ${app.name} folder step shows the refusal as a failure too`)
    await inspect?.(`the ${app.name} folder step when Drive holds the file`)
    await shoot(`${app.id}-start-on-drive`)
    await pressSelector(page, press, `[data-testid="${app.id}-start-open-on-drive"]`)
    await firstRunAt(page, app, 'find')
    await inspect?.(`the ${app.name} find step`)
    await pressSelector(page, press, `[data-testid="${app.id}-start-find"]`)
    await toastMatching(page, exactly(fileWords(words).opened(file)))
    await firstRunAt(page, app, 'overview')
  }
}

/** Opens the phone's or the tablet's drawer, where the top bar has a menu button. The sidebar needs nothing. */
async function openMenu(page, press) {
  const button = await page.$('[data-testid="open-navigation"]')
  if (button === null || (await button.boundingBox()) === null) return
  await press(button)
  await page.waitForSelector('[role="dialog"] [data-testid="nav-kuna-settings"]', { visible: true, timeout: 10_000 })
  await delay(300)
}

/** Checks that the sidebar or the drawer holds Kuna settings, and closes the drawer again. */
async function kunaSettingsInMenu(page, press, where) {
  await openMenu(page, press)
  if (!(await page.$('aside [data-testid="nav-kuna-settings"], [role="dialog"] [data-testid="nav-kuna-settings"]'))) throw new Error(`${where} leaves no way to Kuna settings`)
  if (await page.$('[role="dialog"]')) {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
  }
}

/**
 * The menu in the sidebar or the open drawer, read in the page: the link home with its Kuna mark in line with the app
 * tiles, whether a line runs under it, the open apps, how the open app's row reads against its pages and a closed row,
 * and what is pinned under them.
 */
function menuShown() {
  const scope = document.querySelector('[role="dialog"]') ?? document.querySelector('aside')
  const home = scope?.querySelector('[data-testid="home-link"]') ?? null
  const nav = scope?.querySelector('nav') ?? null
  const rows = [...(scope?.querySelectorAll('[data-testid="nav-app"]') ?? [])]
  const group = rows.find((row) => row.querySelector('[data-testid="nav-entries"]') !== null) ?? null
  const closed = rows.find((row) => row !== group) ?? null
  const appLink = group?.querySelector('[data-testid="nav-app-link"]') ?? null
  const firstEntry = group?.querySelector('[data-testid="nav-entries"] a') ?? null
  const mark = home?.querySelector('svg') ?? null
  const firstTile = rows[0]?.querySelector('[data-testid="app-mark"]') ?? null
  const labelLeft = (link) => link?.querySelector('[data-testid="nav-label"]')?.getBoundingClientRect().left ?? null
  const weight = (row) => (row === null ? 0 : Number(getComputedStyle(row.querySelector('[data-testid="nav-app-link"]')).fontWeight))
  const ruledUnder = (start) => {
    for (let node = start; node !== null && node !== scope && !node.contains(nav); node = node.parentElement) {
      const next = node.nextElementSibling
      if (parseFloat(getComputedStyle(node).borderBottomWidth) > 0 || (next !== null && parseFloat(getComputedStyle(next).borderTopWidth) > 0)) return true
    }
    return false
  }
  return {
    home:
      home === null
        ? null
        : {
            name: home.getAttribute('aria-label') ?? '',
            shown: home.textContent?.trim() ?? '',
            tooltip: home.getAttribute('title'),
            first: scope.querySelector('a') === home,
            inLine: mark !== null && firstTile !== null && Math.abs(mark.getBoundingClientRect().left - firstTile.getBoundingClientRect().left) <= 1,
          },
    ruled: home !== null && ruledUnder(home),
    groups: rows.filter((row) => row.querySelector('[data-testid="nav-entries"]') !== null).length,
    name: appLink?.querySelector('[data-testid="nav-label"]')?.textContent?.trim() ?? null,
    expanded: group?.querySelector('[data-testid="nav-arrow"]')?.getAttribute('aria-expanded') ?? null,
    heavier: closed === null || weight(group) > weight(closed),
    linedUp: appLink !== null && firstEntry !== null && Math.abs(labelLeft(appLink) - labelLeft(firstEntry)) <= 1,
    subtitle: group?.querySelector('[data-testid="nav-subtitle"]')?.textContent?.trim() ?? null,
    countOnOpenRow: appLink?.querySelector('[data-testid="nav-count"]') !== null && appLink !== null,
    entries: [...(group?.querySelectorAll('[data-testid="nav-entries"] a') ?? [])].map((link) => link.textContent?.trim() ?? ''),
    apps: [...(scope?.querySelectorAll('[data-testid="nav-app-link"]') ?? [])].map((link) => link.dataset.app),
    current: scope?.querySelector('a[aria-current="page"]')?.textContent?.trim() ?? null,
    netWorth: scope?.querySelector('[data-testid="nav-net-worth"]')?.textContent?.trim() ?? null,
    addApp: scope?.querySelector('[data-testid="nav-add-app"]')?.textContent?.trim() ?? null,
    drawerArrows: [...document.querySelectorAll('[role="dialog"] [data-testid="nav-arrow"]')].map((arrow) =>
      Math.round(Math.min(arrow.getBoundingClientRect().width, arrow.getBoundingClientRect().height)),
    ),
    kunaSettings: scope?.querySelector('[data-testid="nav-kuna-settings"]')?.textContent?.trim() ?? null,
  }
}

/** The menu opens with the link home in one row, its Kuna mark in line with the app tiles and its whole block named as the words say. */
function homeLinkLeads(menu, words, where) {
  const home = menu.home
  if (home === null || home.name !== words.homeLink || home.tooltip !== words.homeLink || home.shown !== 'Kuna' || !home.first)
    throw new Error(`${where} does not start with the link home named ${words.homeLink}: ${JSON.stringify(home)}`)
  if (!home.inLine) throw new Error(`the Kuna mark in ${where} is not in line with the app tiles: ${JSON.stringify(home)}`)
  if (!menu.ruled) throw new Error(`no line runs under the link home in ${where}`)
}

/** The menu holds the apps in use and one is open: Net worth over them, Add an app and Kuna settings under them, and the open app's name heavier, in line with its pages' names and without its own count. */
function appLeadsItsPages(menu, app, listed, words) {
  if (menu.groups !== 1 || menu.name !== app) throw new Error(`the menu opens ${menu.groups} apps, the first ${menu.name}, instead of ${app} alone`)
  if (menu.expanded !== 'true') throw new Error(`the arrow of the open ${app} reads aria-expanded ${menu.expanded}`)
  if (!menu.heavier) throw new Error(`the name of the open ${app} is no heavier than a closed app's`)
  if (!menu.linedUp) throw new Error(`the name of ${app} is not in line with its pages' names`)
  if (menu.drawerArrows.some((side) => side < 44)) throw new Error(`an arrow in the drawer is only ${Math.min(...menu.drawerArrows)} px, where a thumb presses it`)
  if (menu.countOnOpenRow) throw new Error(`the open ${app} shows a count on its row and on its page`)
  if (JSON.stringify(menu.apps) !== JSON.stringify(listed)) throw new Error(`the ${app} menu lists the apps ${menu.apps.join(', ')}, not ${listed.join(', ')}`)
  if (menu.netWorth !== words.netWorth || menu.kunaSettings !== words.kunaSettings || menu.addApp !== words.addApp)
    throw new Error(`the ${app} menu shows ${menu.netWorth}, ${menu.addApp} and ${menu.kunaSettings} around the apps`)
}

/** Takes the link home from the sidebar or the drawer, to the home with every app. */
async function goHome(page, press, words = SCREEN_WORDS.en) {
  await openMenu(page, press)
  await pressSelector(page, press, '[data-testid="home-link"]')
  await screenTitled(page, words.allApps)
}

/** The cards of the home, read in the page: which app, whether it waits to be set up, its text, its lead figure, its tile's colour and where it leads. */
function homeCards() {
  return [...document.querySelectorAll('[data-testid="home-card"]')].map((card) => ({
    app: card.dataset.app,
    state: card.dataset.state,
    text: card.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    figure: card.querySelector('dd')?.textContent?.trim() ?? null,
    colour: card.querySelector('[data-testid="app-mark"]') === null ? null : getComputedStyle(card.querySelector('[data-testid="app-mark"]')).color,
    href: card.getAttribute('href'),
  }))
}

/** The apps the home's sidebar lists, read in the page in the shape of `homeCards`, with the name and badge of each row. Null with no sidebar. */
function homeMenu() {
  if (document.querySelector('aside') === null) return null
  return [...document.querySelectorAll('aside [data-testid="nav-app-link"]')].map((link) => ({
    app: link.dataset.app,
    text: link.querySelector('[data-testid="nav-label"]')?.textContent?.trim() ?? '',
    tiled: link.querySelector('[data-testid="app-mark"]') !== null,
    colour: link.querySelector('[data-testid="app-mark"]') === null ? null : getComputedStyle(link.querySelector('[data-testid="app-mark"]')).color,
    href: link.getAttribute('href'),
  }))
}

/** The count on each closed app's row in the sidebar, for the apps that show one. */
function closedRowCounts() {
  return Object.fromEntries(
    [...document.querySelectorAll('aside [data-testid="nav-app-link"]:has([data-testid="nav-count"])')].map((link) => [
      link.dataset.app,
      link.querySelector('[data-testid="nav-count"]')?.textContent?.trim(),
    ]),
  )
}

/** The home's sidebar lists the apps of its cards that are set up, in their order, each tiled in its card's colour and leading where its card does. */
function sidebarMatchesCards(menu, cards, words = SCREEN_WORDS.en) {
  const names = { company: words.company, loans: words.loans, investments: words.investments, assets: words.assetsApp, spending: words.spendingApp }
  const want = cards
    .filter((card) => card.state !== 'set-up')
    .map((card) => ({
      app: card.app,
      text: names[card.app],
      tiled: true,
      colour: card.colour,
      href: card.href,
    }))
  if (JSON.stringify(menu) !== JSON.stringify(want)) throw new Error(`the home's sidebar lists ${JSON.stringify(menu)}, not the cards' apps ${JSON.stringify(want)}`)
}

/**
 * The one menu, in the sidebar or the drawer: the Kuna mark first in one row as the link home, named Kuna, all apps, with
 * a line under it, Net worth, the apps with a file with Loans open and its Overview, Scenarios and Settings under it, then Add an
 * app and Kuna settings. The arrow on Company shows Company's pages in place of Loans' without leaving the screen, and shows them no
 * more when pressed again, and a press on the row of Loans opens its pages again, closing the drawer. The link home shows the home, with no app open, and the phone's top bar there has its menu button like any screen.
 * From the home, Company opens, whose Transactions item opens its To review tab while rows wait.
 */
export function appMenuFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot, inspect }) => {
    await openMenu(page, press)
    const loans = await page.evaluate(menuShown)
    homeLinkLeads(loans, words, 'the Loans menu')
    appLeadsItsPages(loans, words.loans, ['company', 'loans'], words)
    if (loans.subtitle !== null) throw new Error(`Loans shows "${loans.subtitle}" under its name`)
    if (JSON.stringify(loans.entries) !== JSON.stringify([words.overview, words.scenarios, words.loansSettings]) || loans.current !== words.overview)
      throw new Error(`Loans lists ${loans.entries.join(', ')} with ${loans.current} marked`)
    const loansTitle = await page.title()
    if (loansTitle !== `${words.overview}, ${words.loans} – Kuna`) throw new Error(`the browser tab says "${loansTitle}"`)
    await inspect?.('the Loans menu')
    await shoot(language === 'en' ? 'app-menu-loans' : `app-menu-loans-${language}`)

    const companyArrow = '[data-testid="nav-arrow"][data-app="company"]'
    await pressSelector(page, press, companyArrow)
    await delay(300)
    const peek = await page.evaluate(menuShown)
    if (peek.groups !== 1 || peek.name !== words.company) throw new Error(`the arrow on Company opens ${peek.groups} apps, the first ${peek.name}`)
    if ((await page.evaluate(() => window.location.hash)) !== '#/loans' || (await page.title()) !== loansTitle) throw new Error('the arrow on Company left the screen')
    await inspect?.('a peek at Company from Loans')
    await pressSelector(page, press, companyArrow)
    await delay(300)
    if ((await page.evaluate(menuShown)).groups !== 0) throw new Error('the arrow on Company did not close its pages')
    await pressSelector(page, press, '[data-testid="nav-app-link"][data-app="loans"]')
    await delay(500)
    // In the drawer the press also closes it, since Loans is already on screen.
    if ((await page.$('[role="dialog"]')) !== null) throw new Error('a press on the row of the Loans on screen left the drawer open')
    await openMenu(page, press)
    const backOnLoans = await page.evaluate(menuShown)
    if (backOnLoans.groups !== 1 || backOnLoans.name !== words.loans) throw new Error(`a press on the row of the Loans on screen left ${backOnLoans.groups} apps open`)

    await pressSelector(page, press, '[data-testid="home-link"]')
    await screenTitled(page, words.allApps)
    const homeTitle = await page.title()
    if (homeTitle !== 'Kuna') throw new Error(`the browser tab on the home says "${homeTitle}"`)
    const bar = await page.evaluate(() => ({
      menuButton: document.querySelector('[data-testid="open-navigation"]')?.getClientRects().length > 0,
      sidebar: document.querySelector('aside') !== null,
      topBar: document.querySelector('[data-testid="top-bar-title"]')?.textContent?.trim() ?? null,
      settings: [...document.querySelectorAll('aside [data-testid="nav-net-worth"], aside [data-testid="nav-kuna-settings"]')]
        .filter((link) => link.getClientRects().length > 0)
        .map((link) => link.textContent?.trim()),
    }))
    if (bar.menuButton === bar.sidebar) throw new Error(`the home has ${bar.sidebar ? 'a sidebar and a menu button' : 'neither a sidebar nor a menu button'}`)
    if (!bar.sidebar && bar.topBar !== null && bar.topBar !== 'Kuna') throw new Error(`the phone top bar on the home says "${bar.topBar}"`)
    const around = bar.sidebar ? [words.netWorth, words.kunaSettings] : []
    if (JSON.stringify(bar.settings) !== JSON.stringify(around)) throw new Error(`the home offers ${JSON.stringify(bar.settings)} instead of ${JSON.stringify(around)}`)
    if (bar.sidebar) {
      // Loans' pages take 200 ms to close and stay in the page until then.
      await delay(300)
      const home = await page.evaluate(menuShown)
      if (home.groups !== 0) throw new Error("the sidebar on the home shows an app's pages")
      homeLinkLeads(home, words, "the home's sidebar")
      sidebarMatchesCards(await page.evaluate(homeMenu), await page.evaluate(homeCards), words)
    }
    await inspect?.('the home')

    await pressSelector(page, press, '[data-testid="home-card"][data-app="company"]')
    await screenTitled(page, words.companyOverview)
    await openMenu(page, press)
    const company = await page.evaluate(menuShown)
    homeLinkLeads(company, words, 'the Company menu')
    appLeadsItsPages(company, words.company, ['company', 'loans'], words)
    if (!company.entries.includes(words.companyOverview) || !company.entries.some((entry) => entry.startsWith(words.transactions.title)) || company.entries.at(-1) !== words.companySettings)
      throw new Error(`Company lists ${company.entries.join(', ')}`)
    const companyTitle = await page.title()
    if (companyTitle !== `${words.companyOverview}, ${words.company} – Kuna`) throw new Error(`the browser tab says "${companyTitle}"`)
    await inspect?.('the Company menu')
    await shoot(language === 'en' ? 'app-menu-company' : `app-menu-company-${language}`)

    // The fake books hold rows that wait, so the counted item opens their queue.
    const counted = '[data-testid="nav-entries"] a:has([data-testid="nav-count"])'
    await pressSelector(page, press, `[role="dialog"] ${counted}, aside ${counted}`)
    await screenTitled(page, words.transactions.title)
    const opened = await page.evaluate(() => ({
      address: window.location.hash,
      tab: document.querySelector('[data-testid="page-tabs"] [role="tab"][data-state="active"]')?.textContent?.trim() ?? null,
    }))
    if (!opened.address.includes('tab=review') || !opened.tab?.startsWith(words.transactions.tabs.review))
      throw new Error(`the Transactions item, with rows waiting, opened ${opened.address} on ${opened.tab} instead of ${words.transactions.tabs.review}`)
  }
}

export const appMenuFlow = appMenuFlowIn('en')

/**
 * The menu adjusts to what is set up. From the first draw after a load it lists exactly `listed`, so nothing flickers in and out while files open or
 * wait to be looked up, with Net worth over the apps. Add an app leads to the home, whose cards still offer all five apps.
 */
export function sidebarAdjustsFlowIn(language, listed) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot, inspect }) => {
    await openMenu(page, press)
    const menu = await page.evaluate(menuShown)
    if (JSON.stringify(menu.apps) !== JSON.stringify(listed)) throw new Error(`the menu lists ${menu.apps.join(', ')}, not ${listed.join(', ')}`)
    if (menu.netWorth !== words.netWorth) throw new Error(`the menu shows ${menu.netWorth} over the apps`)
    if (menu.addApp !== words.addApp) throw new Error(`the menu shows ${menu.addApp} for Add an app`)
    await inspect?.('the menu with some apps set up')
    await shoot(`sidebar-adjusts-${listed.join('-')}${language === 'en' ? '' : `-${language}`}`)

    if (await page.evaluate(() => document.querySelector('aside') !== null)) {
      await page.evaluateOnNewDocument(() => {
        window.menusSeen = new Set()
        const read = () => {
          const aside = document.querySelector('aside')
          if (aside !== null) window.menusSeen.add([...aside.querySelectorAll('[data-testid="nav-app-link"]')].map((link) => link.dataset.app).join())
        }
        new MutationObserver(read).observe(document, { childList: true, subtree: true })
      })
      await page.reload({ waitUntil: 'networkidle0' })
      await delay(300)
      const seen = await page.evaluate(() => [...window.menusSeen])
      if (seen.some((rows) => rows !== listed.join())) throw new Error(`after a load the sidebar listed ${JSON.stringify(seen)}, not only ${listed.join()}`)
    }

    await pressSelector(page, press, '[data-testid="nav-add-app"]')
    await screenTitled(page, words.allApps)
    const cards = await page.evaluate(homeCards)
    if (cards.length !== 5) throw new Error(`the home shows ${cards.length} cards after Add an app`)
    await inspect?.('the home after Add an app')
  }
}

/** An address under an app that no screen has lands on the home, and leaves that app closed. */
export async function sidebarDeadAddressFlow(page) {
  const menu = await page.evaluate(menuShown)
  if (menu.groups !== 0) throw new Error(`an address no screen has left ${menu.name} open on the home`)
  const expanded = await page.evaluate(() => [...document.querySelectorAll('aside [data-testid="nav-arrow"]')].filter((arrow) => arrow.getAttribute('aria-expanded') === 'true').length)
  if (expanded !== 0) throw new Error(`an address no screen has left ${expanded} arrow expanded on the home`)
}

/**
 * The sidebar's height, with Company and its name line open as the longest menu there is. At 1280 x 800 and 1366 x 768 the
 * footer folds into its logo beside Sync, and at 1440 x 900 it keeps its own row. Each time the whole list fits, or only the
 * list scrolls, as at 1366 x 650, with the current page, Kuna settings, Sync and the footer on screen. Opening
 * an app's pages runs 200 ms and hardly any time under reduced motion, and a deep link opens its app with no animation on load.
 */
export function sidebarFitFlowIn(language) {
  return async (page, { shoot, inspect }) => {
    const before = page.viewport()
    const fit = () =>
      page.evaluate(() => {
        const list = document.querySelector('aside nav > div')
        const onScreen = (element) => {
          const box = element.getBoundingClientRect()
          return box.top >= 0 && box.bottom <= window.innerHeight
        }
        const listBox = list.getBoundingClientRect()
        const inList = (element) => {
          const box = element.getBoundingClientRect()
          return box.top >= listBox.top - 1 && box.bottom <= listBox.bottom + 1
        }
        return {
          subtitle: document.querySelector('aside [data-testid="nav-subtitle"]') !== null,
          width: Math.round(document.querySelector('aside').getBoundingClientRect().width),
          scrolls: list.scrollHeight > list.clientHeight,
          gutter: getComputedStyle(list).scrollbarGutter,
          lastPage: inList(document.querySelector('aside [data-testid="nav-entries"] li:last-child a')),
          lastApp: inList(document.querySelector('aside [data-testid="nav-app"]:last-child')),
          current: inList(document.querySelector('aside a[aria-current="page"]')),
          kunaSettings: onScreen(document.querySelector('aside [data-testid="nav-kuna-settings"]')),
          sync: onScreen(document.querySelector('aside nav').nextElementSibling),
          footer: onScreen(document.querySelector('aside [data-testid="company-footer-open"]')),
          folded: document.querySelector('aside [data-testid="sidebar-sync"] [data-testid="company-footer"]') !== null,
        }
      })
    try {
      // A short window folds the footer into its logo beside Sync. Then the whole menu fits, or only the list scrolls with the current page, Kuna settings, Sync and the footer in view.
      for (const [width, height] of [
        [1280, 800],
        [1366, 768],
        [1440, 900],
      ]) {
        await page.setViewport({ ...before, width, height })
        await delay(300)
        const fitted = await fit()
        const shown = fitted.scrolls ? fitted.current : fitted.lastPage && fitted.lastApp
        if (
          fitted.gutter !== 'stable' ||
          !fitted.subtitle ||
          fitted.width !== 240 ||
          fitted.folded !== height < FOOTER_FOLDS_BELOW_HEIGHT ||
          !shown ||
          !fitted.kunaSettings ||
          !fitted.sync ||
          !fitted.footer
        )
          throw new Error(`Company's sidebar does not fit ${width} x ${height}: ${JSON.stringify(fitted)}`)
        await inspect?.(`the sidebar at ${width} x ${height}`)
        await shoot(`sidebar-company-${width}x${height}${language === 'en' ? '' : `-${language}`}`)
      }
      await page.setViewport({ ...before, width: 1366, height: 650 })
      await delay(300)
      const short = await fit()
      if (!short.scrolls || !short.current || !short.kunaSettings || !short.sync || !short.footer) throw new Error(`at 1366 x 650 only the list should scroll: ${JSON.stringify(short)}`)
      await inspect?.('the sidebar at 1366 x 650')
      await page.setViewport(before)
      await delay(300)

      const openingTakes = () =>
        page.evaluate(async () => {
          document.querySelector('[data-testid="nav-arrow"][data-app="loans"]').click()
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          return document
            .getAnimations()
            .filter((animation) => animation.animationName?.startsWith('collapsible'))
            .map((animation) => animation.effect.getComputedTiming().duration)
        })
      const moving = await openingTakes()
      if (moving.length === 0 || moving.some((duration) => duration !== 200)) throw new Error(`opening Loans runs ${JSON.stringify(moving)} ms`)
      await delay(300)
      await inspect?.('a peek at Loans from Company')
      await page.evaluate(() => document.querySelector('[data-testid="nav-arrow"][data-app="company"]').click())
      await delay(300)
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
      const still = await openingTakes()
      if (still.some((duration) => duration > 1)) throw new Error(`under reduced motion opening Loans still runs ${JSON.stringify(still)} ms`)
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])

      await page.evaluateOnNewDocument(() => {
        window.collapsiblesAnimated = 0
        document.addEventListener('animationstart', (event) => {
          if (event.animationName.startsWith('collapsible')) window.collapsiblesAnimated += 1
        })
      })
      await page.reload({ waitUntil: 'networkidle0' })
      await delay(300)
      const onLoad = await page.evaluate(() => window.collapsiblesAnimated)
      if (onLoad !== 0) throw new Error(`a deep link to Company animated ${onLoad} app's pages on load`)
    } finally {
      await page.setViewport(before)
    }
  }
}

/** The cents of the first amount in euros a text writes, in the way the language writes money. */
function centsIn(text, language) {
  const amount = (language === 'en' ? /€[\d,]+(?:\.\d{2})?/ : /[\d.]+(?:,\d{2})?\s?€/).exec(text)?.[0]
  return amount === undefined ? Number.NaN : Number(amount.replace(/\D/g, ''))
}

/**
 * The home with the books of Company, Loans, Investments, Assets and Spending open: Company's card leads with the cash on hand
 * Overview shows and opens it, the Loans card with what you owe in all, which the Loans Overview says too, the Investments card with the value, which its Overview's Value tile says too, and the total gain with its sign, the Assets card with what the assets are worth, which its Overview's tile says too, and the Spending card with what this month spent, which its Overview's Spent tile says too. Each
 * card tiles its icon in a colour of its own. From 1024 px the sidebar lists every app as their cards do, and its
 * Company row opens Overview.
 */
export function homeFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const cards = await page.evaluate(homeCards)
    const [company, loans, investments, assets, spending] = cards
    if (cards.length !== 5 || company.app !== 'company' || loans.app !== 'loans' || investments.app !== 'investments' || assets.app !== 'assets' || spending.app !== 'spending')
      throw new Error(`the home shows ${JSON.stringify(cards.map((card) => card.app))}, not Company, Loans, Investments, Assets and Spending`)
    if (company.state !== 'open' || !company.text.includes(words.companyHome.cashOnHand) || !/€/.test(company.figure ?? '')) throw new Error(`the Company card reads "${company.text}"`)
    if (loans.state !== 'open' || !loans.text.includes(words.loansHome.owed) || !/€/.test(loans.figure ?? '')) throw new Error(`the Loans card reads "${loans.text}"`)
    const gain = new RegExp(`${words.investmentsHome.totalGain}[+−]?(?:€|\\d)`)
    if (investments.state !== 'open' || !investments.text.includes(words.investmentsHome.value) || !gain.test(investments.text) || !/€/.test(investments.figure ?? ''))
      throw new Error(`the Investments card reads "${investments.text}"`)
    if (assets.state !== 'open' || !assets.text.includes(words.assetsHome.value) || !/€/.test(assets.figure ?? '')) throw new Error(`the Assets card reads "${assets.text}"`)
    if (spending.state !== 'open' || !spending.text.includes(words.spendingHome.spentThisMonth) || !/€/.test(spending.figure ?? '')) throw new Error(`the Spending card reads "${spending.text}"`)
    const colours = cards.map((card) => card.colour)
    if (colours.includes(null) || new Set(colours).size !== colours.length) throw new Error(`the cards tile their icons in ${colours.join(', ')}, not one colour each`)
    const menu = await page.evaluate(homeMenu)
    if (menu !== null) {
      sidebarMatchesCards(menu, cards, words)
      const counts = await page.evaluate(closedRowCounts)
      if (!(Number(counts.company) > 0) || 'investments' in counts) throw new Error(`the closed apps' rows count ${JSON.stringify(counts)}, when Company has rows waiting and Investments nothing`)
    }
    await inspect?.('the home with every app')
    await shoot('home')

    await pressSelector(page, press, '[data-testid="home-card"][data-app="company"]')
    await screenTitled(page, words.companyOverview)
    const cash = await page
      .waitForFunction(
        (label) =>
          [...document.querySelectorAll('.kpi-tile')]
            .find((tile) => tile.textContent?.includes(label))
            ?.querySelector('.text-figure-lg')
            ?.textContent?.trim() ?? null,
        { timeout: 10_000 },
        words.companyHome.cashOnHand,
      )
      .then((handle) => handle.jsonValue())
    if (cash !== company.figure) throw new Error(`the Company card says ${company.figure} on hand, the Overview ${cash}`)

    await goHome(page, press, words)
    await pressSelector(page, press, '[data-testid="home-card"][data-app="loans"]')
    await screenTitled(page, words.overview)
    const total = await page
      .waitForFunction(() => document.querySelector('[data-testid="loans-you-owe"] .text-figure-lg')?.textContent?.replace(/\s+/g, ' ').trim() ?? null, { timeout: 10_000 })
      .then((handle) => handle.jsonValue())
    if (centsIn(total, language) !== centsIn(loans.figure, language)) throw new Error(`the Loans card says ${loans.figure} owed, the Loans Overview "${total}"`)
    await inspect?.('the Loans Overview from the home')

    await goHome(page, press, words)
    await pressSelector(page, press, '[data-testid="home-card"][data-app="investments"]')
    await screenTitled(page, words.investmentsOverview)
    const value = await page
      .waitForFunction(() => document.querySelector('[data-testid="investments-value"] .text-figure-lg')?.textContent?.trim() ?? null, { timeout: 10_000 })
      .then((handle) => handle.jsonValue())
    if (value !== investments.figure) throw new Error(`the Investments card says ${investments.figure}, the Overview's Value tile ${value}`)

    await goHome(page, press, words)
    await pressSelector(page, press, '[data-testid="home-card"][data-app="assets"]')
    await screenTitled(page, words.overview)
    const worth = await page
      .waitForFunction(() => document.querySelector('[data-testid="assets-value"] .text-figure-lg')?.textContent?.trim() ?? null, { timeout: 10_000 })
      .then((handle) => handle.jsonValue())
    if (worth !== assets.figure) throw new Error(`the Assets card says ${assets.figure}, the Assets Overview's tile ${worth}`)

    await goHome(page, press, words)
    await pressSelector(page, press, '[data-testid="home-card"][data-app="spending"]')
    await screenTitled(page, words.spendingScreens.overview)
    const spent = await page
      .waitForFunction(() => document.querySelector('[data-testid="spending-spent"] .text-figure-lg')?.textContent?.trim() ?? null, { timeout: 10_000 })
      .then((handle) => handle.jsonValue())
    if (spent !== spending.figure) throw new Error(`the Spending card says ${spending.figure} spent, the Spending Overview's tile ${spent}`)

    if (menu === null) return
    await goHome(page, press, words)
    await pressSelector(page, press, 'aside [data-testid="nav-app-link"][data-app="company"]')
    await screenTitled(page, words.companyOverview)
    const title = `${words.companyOverview}, ${words.company} – Kuna`
    if ((await page.title()) !== title) throw new Error(`the Company row in the home's sidebar opened "${await page.title()}"`)
  }
}

export const homeFlow = homeFlowIn('en')

/**
 * A fresh device opens the home with the welcome in place of the cards, and a sidebar with no Add an app until the welcome is answered, no Net worth
 * and no empty strip where Sync would be. Once answered every app shows in Set up. Loans, Investments, Assets and Spending can be set
 * up first: each card opens its first run, whose link home comes back, and the Company card opens the company's welcome.
 */
export function setUpFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the fresh home shows no welcome')
    })
    if (await page.evaluate(() => document.querySelector('[data-testid="sync-status"]') !== null)) throw new Error('the fresh home shows a sync control')
    if ((await page.evaluate(homeMenu)) !== null) {
      const fresh = await page.evaluate(menuShown)
      if (fresh.apps.length !== 0 || fresh.addApp !== null || fresh.netWorth !== null)
        throw new Error(`before any app is set up the sidebar shows ${fresh.apps.join()}, ${fresh.addApp} and ${fresh.netWorth}`)
      if (await page.$('[data-testid="sidebar-sync"]')) throw new Error('before any app is set up the sidebar keeps an empty strip where Sync would be')
    }
    await inspect?.('the home on a fresh device')
    await shoot('home-set-up')
    for (const name of [words.company, words.loans, words.investments, words.assetsApp, words.spendingApp]) {
      await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', name)
    }
    await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
    await page.waitForSelector('[data-testid="home-card"]', { visible: true, timeout: 10_000 })
    const cards = await page.evaluate(homeCards)
    if (cards.length !== 5 || cards.some((card) => card.state !== 'set-up' || !card.text.includes(words.setUp)))
      throw new Error(`the answered home shows ${JSON.stringify(cards.map((card) => [card.app, card.state]))}`)
    const menu = await page.evaluate(homeMenu)
    if (menu !== null) sidebarMatchesCards(menu, cards, words)

    for (const [app, name] of [
      [LOANS, words.loans],
      [INVESTMENTS, words.investments],
      [ASSETS, words.assetsApp],
      [SPENDING, words.spendingApp],
    ]) {
      await pressSelector(page, press, `[data-testid="home-card"][data-app="${app.id}"]`)
      await firstRunAt(page, app, 'folder')
      await screenTitled(page, name)
      await inspect?.(`the ${app.name} first run from the home`)
      await pressSelector(page, press, '[data-testid="home-link"]')
      await screenTitled(page, words.allApps)
    }

    await pressSelector(page, press, '[data-testid="home-card"][data-app="company"]')
    await onboardingAt(page, 'welcome')
    await screenTitled(page, words.company)
    await inspect?.("the company's welcome from the home")
    await shoot('home-set-up-company')
  }
}

export const setUpFlow = setUpFlowIn('en')

async function assetCardShown(page, name, shown) {
  await page
    .waitForFunction(
      (wanted, expected) => [...document.querySelectorAll('[data-testid="asset-card"] h2')].some((heading) => heading.textContent?.trim() === wanted) === expected,
      { timeout: 10_000 },
      name,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `the Assets Overview has no card for ${name}` : `the Assets Overview still has a card for ${name}`)
    })
}

/**
 * On an empty Assets file beside the sample Loans file: a flat added in the asset dialog with its region and the
 * Home loan opens its page, which shows what is owed on the loan and what is yours. Its loan cleared, the page shows
 * neither, and the flat deleted from its dialog leaves the Overview until Undo brings it back.
 */
export function assetsEditorFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { assetDialog } = words.assetPage
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const toastShown = async (title) => {
      await toast(page, title)
      await delay(600)
      await inspect?.(title)
    }
    await pressSelector(page, press, '[data-testid="add-asset"]')
    await page.waitForSelector('[data-testid="asset-form"]', { visible: true })
    await fill(page, 'asset-name', 'Flat by the sea')
    await pressButton(page, press, '[data-testid="asset-kind"] button', words.assetValues.kinds.home)
    await fill(page, 'asset-bought', '2024-05-20')
    await fill(page, 'asset-price', '150000')
    await choose(page, press, await page.$('[data-testid="asset-region"]'), words.assetValues.regions.adriatic)
    await choose(page, press, await page.$('[data-testid="asset-loan"]'), 'Home loan')
    // The dialog grows into place, so it is measured once it settles.
    await delay(300)
    await inspect?.('the asset dialog')
    await shoot('assets-new-flat-dialog')
    await pressSelector(page, press, '[data-testid="asset-save"]')
    await screenTitled(page, 'Flat by the sea')
    await toastShown(assetDialog.added)
    await dismissToasts(page)
    await elementSays(page, '[data-testid="asset-owed"]', [words.assetPage.tiles.owedOn('Home loan')], 'the new flat does not show what is owed on its loan')
    await page.waitForSelector('[data-testid="asset-yours"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the new flat does not show what is yours after its loan')
    })
    await shoot('assets-new-flat')

    await pressSelector(page, press, '[data-testid="asset-edit"]')
    await page.waitForSelector('[data-testid="asset-form"]', { visible: true })
    await choose(page, press, await page.$('[data-testid="asset-loan"]'), assetDialog.noLoan)
    await pressSelector(page, press, '[data-testid="asset-save"]')
    await toastShown(assetDialog.saved)
    await dismissToasts(page)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="asset-owed"], [data-testid="asset-yours"]') === null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the flat still shows its loan once the loan was cleared')
      })

    await pressSelector(page, press, '[data-testid="asset-edit"]')
    await pressSelector(page, press, '[data-testid="asset-delete"]')
    await screenTitled(page, words.assetsOverview.title)
    await assetCardShown(page, 'Flat by the sea', false)
    await toastShown(assetDialog.deleted)
    await undoIn(page, press, words)
    await assetCardShown(page, 'Flat by the sea', true)
    await inspect?.('the Assets Overview after Undo')
    await shoot('assets-undo-delete')
    await dismissToasts(page)
  }
}

export const assetsEditorFlow = assetsEditorFlowIn('en')

/** On the sample car's page: a valuation added in its dialog takes the place of the customs table's estimate, and once deleted from its dialog Undo puts it back. */
export function assetsValuationFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { valuationDialog } = words.assetPage
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const lines = () => page.evaluate(() => document.querySelectorAll('[data-testid="valuation-line"]').length)
    const linesAre = (count, failure) =>
      page
        .waitForFunction((wanted) => document.querySelectorAll('[data-testid="valuation-line"]').length === wanted, { timeout: 10_000 }, count)
        .catch(() => {
          throw new Error(failure)
        })
    const before = await lines()
    await pressSelector(page, press, '[data-testid="valuation-add"]')
    await page.waitForSelector('[data-testid="valuation-form"]', { visible: true })
    await fill(page, 'valuation-value', '19000')
    await fill(page, 'valuation-note', 'Dealer offer')
    // The dialog grows into place, so it is measured once it settles.
    await delay(300)
    await inspect?.('the valuation dialog')
    await shoot('assets-valuation-dialog')
    await pressSelector(page, press, '[data-testid="valuation-save"]')
    await toast(page, valuationDialog.added)
    await dismissToasts(page)
    await linesAre(before + 1, 'the valuation is not in the list')
    await elementSays(page, '[data-testid="asset-value"]', [words.assetValues.valuation('')], 'the car does not show the value typed')
    const estimate = words.assetValues.customsNew('', '').split(':')[0]
    if (await page.$eval('[data-testid="asset-value"]', (tile, said) => tile.textContent?.includes(said) ?? false, estimate)) throw new Error('the car still shows the estimate by the customs table')
    await shoot('assets-valuation-added')

    await pressSelector(page, press, '[data-testid="valuation-edit"]')
    await page.waitForSelector('[data-testid="valuation-form"]', { visible: true })
    await pressSelector(page, press, '[data-testid="valuation-delete"]')
    await toast(page, valuationDialog.deleted)
    await linesAre(before, 'the deleted valuation is still in the list')
    await undoIn(page, press, words)
    await linesAre(before + 1, 'Undo did not bring the valuation back')
    await inspect?.("the car's page after Undo")
    await dismissToasts(page)
  }
}

export const assetsValuationFlow = assetsValuationFlowIn('en')

/** The payee the Spending flows type, as anyone might. */
const SPENDING_PAYEE = 'Bakery by the port'
/** The name a Spending flow gives a starter category, as anyone might type it. */
const SPENDING_RENAMED = 'Coffee and tea'
const SPENDING_ROW = '[data-testid="spending-row"]'
const SPENDING_ENTRY_DIALOG = '[data-testid="spending-entry-dialog"]'

/** Taps an amount field, checks it opens the phone's number pad, and types the amount over what it holds. */
async function typeAmount(page, press, testId, amount) {
  const field = await pressSelector(page, press, `[data-testid="${testId}"]`)
  const pad = await field.evaluate((element) => element.getAttribute('inputmode'))
  if (pad !== 'decimal') throw new Error(`${testId} opens no number pad on a phone, its inputmode is ${pad}`)
  await field.evaluate((element) => element.select())
  await page.keyboard.type(amount)
}

/** Waits until Transactions lists a row reading `title` with this amount in cents, or until it no longer does. */
async function spendingRowShown(page, title, cents, shown) {
  await page
    .waitForFunction(
      (selector, wanted, amount, expected) => [...document.querySelectorAll(selector)].some((row) => row.dataset.amount === String(amount) && row.textContent?.includes(wanted)) === expected,
      { timeout: 10_000 },
      SPENDING_ROW,
      title,
      cents,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `Transactions lists no "${title}" row of ${cents} cents` : `Transactions still lists the "${title}" row of ${cents} cents`)
    })
}

async function openSpendingRow(page, press, title, cents) {
  const row = await page
    .waitForFunction(
      (selector, wanted, amount) => [...document.querySelectorAll(selector)].find((element) => element.dataset.amount === String(amount) && element.textContent?.includes(wanted)) ?? null,
      { timeout: 10_000 },
      SPENDING_ROW,
      title,
      cents,
    )
    .then((handle) => handle.asElement())
  await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(row)
  await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 10_000 })
  await delay(300)
}

/** Opens a new entry on Transactions and picks its kind by the label of its button. */
async function newSpendingEntry(page, press, words, kind) {
  await pressSelector(page, press, '[data-testid="spending-add-entry"]')
  await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 10_000 })
  await delay(300)
  await pressButton(page, press, '[data-testid="spending-entry-kind"] button', words.spendingEntries.dialog.kinds[kind])
}

/** Money out of 25 on Groceries to the checks' payee, typed into a new entry. */
async function typeMoneyOut(page, press, words) {
  await newSpendingEntry(page, press, words, 'out')
  await typeAmount(page, press, 'spending-entry-amount', '25')
  await choose(page, press, await page.$('[data-testid="spending-entry-category"]'), words.spendingStarter.Groceries)
  await fill(page, 'spending-entry-payee', SPENDING_PAYEE)
}

/** A move of 100 euros from OTP current that reaches Revolut USD as 108 dollars, typed into a new entry. */
async function typeTransfer(page, press, words) {
  await newSpendingEntry(page, press, words, 'transfer')
  await typeAmount(page, press, 'spending-entry-amount', '100')
  await chooseStartingWith(page, press, '[data-testid="spending-entry-account"]', 'OTP current')
  await chooseStartingWith(page, press, '[data-testid="spending-entry-to-account"]', 'Revolut USD')
  await typeAmount(page, press, 'spending-entry-to-amount', '108')
}

async function saveSpendingEntry(page, press, title) {
  await pressSelector(page, press, '[data-testid="spending-entry-save"]')
  await toast(page, title)
}

/** What the sample Spending file's entry dialog lists for `ex`: the text as typed, then the known payees most recently paid first. */
const SPENDING_PAYEES_EX = ['ex', 'Example Studio d.o.o.', 'Example Broker', 'Example Bank']

/** The payee options the open list shows, once it shows `count` of them. */
async function payeeOptions(page, count) {
  return page
    .waitForFunction(
      (wanted) => {
        const shown = [...document.querySelectorAll('[role="listbox"] [role="option"]')].map((option) => option.textContent?.trim() ?? '')
        return shown.length === wanted ? shown : null
      },
      { timeout: 5_000 },
      count,
    )
    .then((handle) => handle.jsonValue())
    .catch(() => {
      throw new Error(`the payee field lists no ${count} known payees`)
    })
}

/** Types into the entry dialog's payee field from blank, key by key as a person does, which opens the list of known payees. */
async function typePayee(page, press, text) {
  const field = await pressSelector(page, press, '[data-testid="spending-entry-payee"]')
  await field.evaluate((element) => element.select())
  await page.keyboard.type(text)
  return field
}

async function payeeTyped(field, wanted, after) {
  const shown = await field.evaluate((element) => element.value)
  if (shown !== wanted) throw new Error(`${after} left "${shown}" in the payee field, not "${wanted}"`)
}

async function payeeListGone(page) {
  await page
    .waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    .catch(() => {
      throw new Error('the payee list stays open')
    })
}

const SPENDING_SPLIT_DIALOG = '[data-testid="spending-split-dialog"]'

/** The part at `place` of the split dialog, from 0. */
async function splitPart(page, place) {
  const parts = await page.$$(`${SPENDING_SPLIT_DIALOG} [data-testid="split-part"]`)
  const part = parts[place]
  if (part === undefined) throw new Error(`the split has no part ${place + 1}`)
  return part
}

async function typePartAmount(page, press, place, amount) {
  const field = await (await splitPart(page, place)).$('[data-testid="split-part-amount"]')
  if (field === null) throw new Error(`part ${place + 1} of the split has no amount to type`)
  const pad = await field.evaluate((element) => element.getAttribute('inputmode'))
  if (pad !== 'decimal') throw new Error(`the amount of part ${place + 1} opens no number pad on a phone, its inputmode is ${pad}`)
  await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(field)
  await field.evaluate((element) => element.select())
  await page.keyboard.type(amount)
}

async function choosePartCategory(page, press, place, name) {
  const picker = await (await splitPart(page, place)).$('[data-testid="split-part-category"]')
  if (picker === null) throw new Error(`part ${place + 1} of the split has no category to pick`)
  await choose(page, press, picker, name)
}

/**
 * On the sample Spending file's Transactions: the Corner market row of this month split by hand into three parts, one of
 * them For the company and one the rest, lands as three parts on the row. Its dialog then shows the parts, and Remove the
 * split takes them off until Undo brings them back.
 */
export function spendingSplitFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { split } = words.spendingEntries
  const starter = words.spendingStarter
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Corner market', -4530)
    await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-entry-split"]')
    await page.waitForSelector(SPENDING_SPLIT_DIALOG, { visible: true, timeout: 10_000 })
    await typePartAmount(page, press, 0, '20')
    await choosePartCategory(page, press, 1, starter.Restaurants)
    await pressSelector(page, press, '[data-testid="split-add-part"]')
    await typePartAmount(page, press, 2, '15.3')
    await choosePartCategory(page, press, 2, starter['For the company'])
    await page
      .waitForFunction((selector) => document.querySelector(selector)?.textContent?.includes('10') ?? false, { timeout: 5_000 }, '[data-testid="split-rest"]')
      .catch(() => {
        throw new Error('the rest does not show what the other parts leave')
      })
    await delay(300)
    await inspect?.('the split of an entry into three parts')
    await shoot('spending-split')

    await pressSelector(page, press, '[data-testid="spending-split-save"]')
    await toast(page, split.saved)
    await dialogGone(page, SPENDING_SPLIT_DIALOG)
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await dismissToasts(page)
    await rowLinesAre(page, 'Corner market', -4530, 3)
    await inspect?.('Transactions with the entry split by hand')
    await shoot('spending-split-done')

    await openSpendingRow(page, press, 'Corner market', -4530)
    await page.waitForSelector('[data-testid="spending-entry-remove-split"]', { visible: true, timeout: 10_000 })
    if (await page.$('[data-testid="spending-entry-remove-receipt"]')) throw new Error('a row split by hand offers to remove a receipt')
    if (!(await page.$eval('[data-testid="spending-entry-amount"] input, input[data-testid="spending-entry-amount"]', (input) => input.disabled))) throw new Error('a split row lets its amount change')
    await delay(300)
    await inspect?.('the entry dialog of a row split by hand')
    await shoot('spending-split-entry')
    await pressSelector(page, press, '[data-testid="spending-entry-remove-split"]')
    await toast(page, split.removed)
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await rowLinesAre(page, 'Corner market', -4530, 0)
    await undoIn(page, press, words)
    await rowLinesAre(page, 'Corner market', -4530, 3)
  }
}

const SPENDING_ACCOUNT_DIALOG = '[data-testid="spending-account-dialog"]'

/** Opens the account dialog from the account's own screen and waits for it to settle. */
async function openAccountDialog(page, press) {
  await pressSelector(page, press, '[data-testid="spending-account-edit"]')
  await page.waitForSelector(SPENDING_ACCOUNT_DIALOG, { visible: true, timeout: 10_000 })
  await delay(300)
}

/** The sample OTP account's dialog as it opens, the shot to compare a change of the dialog against. */
export function spendingAccountDialogFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openAccountDialog(page, press)
    await inspect?.('the account dialog')
    await shoot('spending-account-dialog')
  }
}

/**
 * The sample OTP account's start day moved 30 days back from today: the dialog lists what goes and fills in the opening that
 * keeps today's balance, Delete and save writes it, and Undo puts the rows back. Then a start day moved a year earlier says
 * the bank sync reaches back only about 90 days.
 */
export function spendingAccountStartDayFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const dialog = words.spendingAccounts.dialog
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const balance = () => page.$eval('[data-testid="spending-account-balance-today"]', (element) => element.textContent?.trim() ?? '')
    const before = await balance()
    await openAccountDialog(page, press)
    const opening = () => page.$eval('[data-testid="spending-account-opening"]', (input) => input.value)
    const typedOpening = await opening()
    await fill(page, 'spending-account-opened-on', addDays(today(), -30))
    await page.waitForSelector('[data-testid="spending-account-cutover"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('a later start day does not list what goes')
    })
    if ((await opening()) === typedOpening) throw new Error('a later start day leaves the opening as it was')
    const save = await page.$eval('[data-testid="spending-account-save"]', (button) => button.textContent?.trim() ?? '')
    if (save !== dialog.cutover.save) throw new Error(`the save button reads "${save}" over a start day that deletes rows`)
    await delay(300)
    await inspect?.('the account dialog listing what a later start day deletes')
    await shoot('spending-account-cutover')

    await pressSelector(page, press, '[data-testid="spending-account-save"]')
    await toast(page, dialog.saved)
    await dialogGone(page, SPENDING_ACCOUNT_DIALOG)
    if ((await balance()) !== before) throw new Error(`today's balance moved from ${before} to ${await balance()} with the start day`)
    await shoot('spending-account-cutover-done')
    await undoIn(page, press, words)
    await dismissToasts(page)

    await openAccountDialog(page, press)
    await fill(page, 'spending-account-opened-on', addDays(today(), -400))
    await page
      .waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted) ?? false, { timeout: 5_000 }, SPENDING_ACCOUNT_DIALOG, dialog.earlierStart)
      .catch(() => {
        throw new Error('an earlier start day does not say how far back the bank reaches')
      })
    await delay(300)
    await inspect?.('the account dialog over an earlier start day')
    await shoot('spending-account-earlier')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ACCOUNT_DIALOG)
  }
}

/**
 * The entry dialog opened on the sample Spending file's Transactions, as money out or as a move between two accounts in two currencies, and closed again.
 * Money out also lists the known payees after two typed letters. Escape closes the list and keeps the letters, so does Enter as the list opens, and Down then Enter picks the newest payee.
 */
export function spendingEntryDialogFlowIn(language, kind) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    if (kind === 'transfer') await typeTransfer(page, press, words)
    else await typeMoneyOut(page, press, words)
    // The dialog grows into place, so it is measured once it settles.
    await delay(300)
    await inspect?.(kind === 'transfer' ? 'the entry dialog between two currencies' : 'the entry dialog')
    await shoot(kind === 'transfer' ? 'spending-transfer' : 'spending-entry')
    if (kind === 'out') {
      if (await page.$('[role="listbox"]')) throw new Error('the payee field lists payees for a new payee')
      const field = await typePayee(page, press, 'ex')
      const listed = await payeeOptions(page, SPENDING_PAYEES_EX.length)
      if (listed.join('|') !== SPENDING_PAYEES_EX.join('|')) throw new Error(`the payee field lists ${listed.join(', ')} for ex`)
      await delay(250)
      await inspect?.('the payee list')
      await shoot('spending-entry-payees')
      await page.keyboard.press('Escape')
      await payeeListGone(page)
      await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 2_000 }).catch(() => {
        throw new Error('Escape on the payee list closed the entry dialog')
      })
      await payeeTyped(field, 'ex', 'Escape on the payee list')
      await typePayee(page, press, 'ex')
      await payeeOptions(page, SPENDING_PAYEES_EX.length)
      await page.keyboard.press('Enter')
      await payeeListGone(page)
      await payeeTyped(field, 'ex', 'Enter on the payee list as it opens')
      await typePayee(page, press, 'ex')
      await payeeOptions(page, SPENDING_PAYEES_EX.length)
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await payeeListGone(page)
      await payeeTyped(field, SPENDING_PAYEES_EX[1], 'Down and Enter on the payee list')
    }
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/** On the sample Spending file's Transactions: two letters of a payee in a new entry list it, and picking it fills the field with its name as the books spell it. */
export async function spendingPayeePickFlow(page, { press, shoot, inspect }) {
  const words = SCREEN_WORDS.en
  await newSpendingEntry(page, press, words, 'out')
  const field = await typePayee(page, press, 'ca')
  const listed = await payeeOptions(page, 2)
  if (listed[1] !== 'Café on the square') throw new Error(`the payee field lists ${listed.join(', ')} for ca`)
  await inspect?.('the payee list')
  await shoot('spending-payee-list')
  const options = await page.$$('[role="listbox"] [role="option"]')
  await press(options[1])
  await payeeListGone(page)
  await payeeTyped(field, 'Café on the square', 'Picking a payee')
  await shoot('spending-payee-picked')
  await page.keyboard.press('Escape')
  await dialogGone(page, SPENDING_ENTRY_DIALOG)
}

/**
 * On the sample Spending file's Transactions: money out typed in the entry dialog, its amount on the number pad, lands
 * on today's list. Changed, it shows its new amount, and deleted from its dialog it leaves the list until Undo brings
 * it back.
 */
export function spendingEntryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await typeMoneyOut(page, press, words)
    await saveSpendingEntry(page, press, dialog.added)
    await dismissToasts(page)
    await spendingRowShown(page, SPENDING_PAYEE, -2500, true)
    await inspect?.('Transactions with the new entry')
    await shoot('spending-entry-added')

    await openSpendingRow(page, press, SPENDING_PAYEE, -2500)
    await typeAmount(page, press, 'spending-entry-amount', '30')
    await saveSpendingEntry(page, press, dialog.saved)
    await dismissToasts(page)
    await spendingRowShown(page, SPENDING_PAYEE, -3000, true)

    await openSpendingRow(page, press, SPENDING_PAYEE, -3000)
    await pressSelector(page, press, '[data-testid="spending-entry-delete"]')
    await toast(page, dialog.deleted)
    await spendingRowShown(page, SPENDING_PAYEE, -3000, false)
    await undoIn(page, press, words)
    await spendingRowShown(page, SPENDING_PAYEE, -3000, true)
    await inspect?.('Transactions after Undo')
    await shoot('spending-entry-undo-delete')
    await dismissToasts(page)
  }
}

export const spendingEntryFlow = spendingEntryFlowIn('en')

/**
 * On the sample's Transactions: money in on OTP current, reopened and turned into a move between two accounts, stays money in
 * on OTP current, with the money out on the other account, and Undo takes that back.
 */
export function spendingCreditToTransferFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await newSpendingEntry(page, press, words, 'in')
    await typeAmount(page, press, 'spending-entry-amount', '25')
    await chooseStartingWith(page, press, '[data-testid="spending-entry-account"]', 'OTP current')
    await choose(page, press, await page.$('[data-testid="spending-entry-category"]'), words.spendingStarter.Salary)
    await fill(page, 'spending-entry-payee', SPENDING_PAYEE)
    await saveSpendingEntry(page, press, dialog.added)
    await dismissToasts(page)
    await openSpendingRow(page, press, SPENDING_PAYEE, 2500)
    await pressButton(page, press, '[data-testid="spending-entry-kind"] button', dialog.kinds.transfer)
    await delay(300)
    await shoot('spending-credit-to-transfer')
    await saveSpendingEntry(page, press, dialog.saved)
    const betweenAccounts = words.spendingStarter['Between my accounts']
    await spendingRowShown(page, betweenAccounts, 2500, true)
    await spendingRowShown(page, betweenAccounts, -2500, true)
    await spendingRowShown(page, SPENDING_PAYEE, 2500, false)
    await spendingRowShown(page, 'OTP current', -2500, false)
    await undoIn(page, press, words)
    await spendingRowShown(page, SPENDING_PAYEE, 2500, true)
    await spendingRowShown(page, betweenAccounts, -2500, false)
    await dismissToasts(page)
  }
}

/**
 * A row linked to a Loans instalment, on Entries and in its dialog with the link to the loan's page, then a row whose instalment
 * Loans no longer has, in `goneMonth`. A key is kept, so each row carries its receipt camera as it does for a person with one.
 */
export function spendingLinkFlowIn(language, goneMonth) {
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.evaluate((key) => localStorage.setItem('kuna.secret.anthropic', key), MADE_UP_ANTHROPIC_KEY)
    await page.reload({ waitUntil: 'networkidle0' })
    const shootLinked = async (state) => {
      await shootAt(page, shoot, '[data-testid="spending-row-link"]', state === 'there' ? 'spending-row-link' : 'spending-row-link-gone')
      await openSpendingRow(page, press, 'Example Bank', -65000)
      await shootAt(page, shoot, '[data-testid="spending-entry-link"]', state === 'there' ? 'spending-entry-link' : 'spending-entry-link-gone')
      await page.keyboard.press('Escape')
      await dialogGone(page, SPENDING_ENTRY_DIALOG)
    }
    await shootLinked('there')
    await page.evaluate((month) => (location.hash = `#/spending/transactions?month=${month}`), goneMonth)
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-row-link"]')?.classList.contains('text-warning') === true, { timeout: 10_000 })
    await shootLinked('gone')
  }
}

/**
 * With the bank sync set up, a row the bank synced onto Revolut EUR opens with its amount, day and way its money went locked,
 * saying why, and a new entry lists only the accounts kept by hand, so Cash and none of the accounts the bank fills.
 */
export function spendingBankRowFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'CORNER MARKET', -1230)
    const locked = await page.$$eval('[data-testid="spending-entry-amount"], [data-testid="spending-entry-date"]', (fields) =>
      fields.map((field) => (field.matches('input') ? field : field.querySelector('input'))?.disabled ?? false),
    )
    if (locked.length !== 2 || locked.some((disabled) => !disabled)) throw new Error(`the bank's row leaves its amount or day open: ${locked.join(', ')}`)
    await waitForTextIn(page, '[data-testid="spending-entry-source-note"]', dialog.bookedByBank)
    const kinds = await page.$$eval('[data-testid="spending-entry-kind"] button', (buttons) => buttons.map((button) => button.textContent?.trim() ?? ''))
    if (kinds.includes(dialog.kinds.in)) throw new Error(`the bank's money out offers to become money in: ${kinds.join(', ')}`)
    await inspect?.("the bank's row in the entry dialog")
    await shoot('spending-entry-bank-row')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await pressSelector(page, press, '[data-testid="spending-add-entry"]')
    await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 10_000 })
    await delay(300)
    await pressSelector(page, press, '[data-testid="spending-entry-account"]')
    const listed = await page
      .waitForFunction(
        () => {
          const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent?.trim() ?? '')
          return options.length > 0 ? options : null
        },
        { timeout: 5_000 },
      )
      .then((handle) => handle.jsonValue())
    if (listed.some((option) => option.startsWith('OTP current') || option.startsWith('Revolut'))) throw new Error(`a new entry lists accounts the bank fills: ${listed.join(', ')}`)
    await waitForTextIn(page, SPENDING_ENTRY_DIALOG, dialog.bankAccountsHidden)
    await delay(300)
    await inspect?.('the accounts a new entry lists')
    await shoot('spending-entry-accounts')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[role="listbox"]') === null, { timeout: 5_000 })
    await delay(300)
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/** A statement row of the statements set opened in its dialog says that deleting it brings it back with the next export. */
export function spendingDeleteNoteFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, inspect }) => {
    const month = monthOf(addDays(today(), -2))
    await page.evaluate((wanted) => {
      window.location.hash = `#/spending/transactions?month=${wanted}`
    }, month)
    await openSpendingRow(page, press, 'Transfer to Revolut', -7500)
    const wanted = words.spendingEntries.dialog.comesBack
    await page
      .waitForFunction((text) => document.querySelector('[data-testid="spending-entry-source-note"]')?.textContent?.includes(text) ?? false, { timeout: 10_000 }, wanted)
      .catch(() => {
        throw new Error('a statement row does not say that deleting it brings it back')
      })
    await delay(300)
    await inspect?.('a statement row in the entry dialog')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

const SPENDING_DRY_RUN_SUMMARY = '[data-testid="spending-dry-run-summary"]'

async function dropSpendingFile(page, path) {
  const input = await page.waitForSelector('[data-testid="spending-import-file"] input[type="file"]', { timeout: 10_000 }).catch(() => {
    throw new Error('Import offers no file input')
  })
  await input.uploadFile(path)
}

async function spendingDryRunSays(page, text) {
  await page
    .waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, SPENDING_DRY_RUN_SUMMARY, text)
    .catch(async () => {
      const said = await page.evaluate((selector) => document.querySelector(selector)?.textContent?.trim(), SPENDING_DRY_RUN_SUMMARY)
      throw new Error(`the dry run does not say "${text}", it says: ${said ?? 'nothing'}`)
    })
}

/** The choice that lets a file's row take the place of the row the AI copied, third after Decide later and Keep both. */
const USE_FILE_ROW = 'button:nth-child(3)'

/**
 * On Spending's Import with the copied set: the sample Revolut export's Unknown shop looks like the row the AI copied a day before,
 * so the dry run asks about it above its rows, naming that copied row, and leaves it out until answered. Use the file's row makes
 * it take the copied row's place, which Import writes with the new rows and one Undo takes back.
 */
export function spendingImportLookAlikeFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const panel = words.spendingStatements.import
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.revolut)
    await spendingDryRunSays(page, panel.summary(8, 1, 1))
    await elementSays(page, '[data-testid="question"]', ['UNKNOWN SHOP ZAGREB'], 'the question does not name the copied row the file row looks like')
    if (await page.$('[data-testid="spending-dry-run"] [data-testid="show-all"]')) await pressSelector(page, press, '[data-testid="spending-dry-run"] [data-testid="show-all"]')
    await elementSays(page, '[data-testid="spending-dry-run-outcome"]', [panel.outcome.lookAlike], 'the look-alike does not say it waits for an answer')
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-import-lookalike')
    await pressSelector(page, press, `[data-testid="question-choice"] ${USE_FILE_ROW}`)
    await elementSays(page, '[data-testid="spending-dry-run-outcome"]', [panel.outcome.replaced], "the file's row does not say it takes the copied row's place")
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-import-lookalike-replaced')
    await pressSelector(page, press, '[data-testid="spending-import-confirm"]')
    await toast(page, panel.imported)
    await spendingDryRunSays(page, panel.summary(0, 11, 0))
    await undoIn(page, press, words)
    await elementSays(page, '[data-testid="spending-dry-run-outcome"]', [panel.outcome.replaced], 'Undo did not bring the replacement back to the dry run')
    await dismissToasts(page)
  }
}

/**
 * On Spending's Import with the synced set: the bank sync brought a row on the export's last day, so the dry run names the days
 * before it as the days the file brings and leaves out the rows of that day, which show so. The export's Corner market looks like the synced
 * row a day later, so the dry run asks about it above its rows, naming that synced row. Use the file's row makes it take the
 * synced row's place. Nothing is imported.
 */
export function spendingImportSyncedLookAlikeFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const panel = words.spendingStatements.import
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.revolut)
    await elementSays(page, '[data-testid="question"]', ['CORNER MARKET D.O.O.'], 'the question does not name the synced row the file row looks like')
    await page.waitForSelector('[data-testid="spending-import-days-from"]', { visible: true, timeout: 10_000 })
    await shootAt(page, shoot, '[data-testid="spending-import-days"]', 'spending-import-gap-days')
    if (await page.$('[data-testid="spending-dry-run"] [data-testid="show-all"]')) await pressSelector(page, press, '[data-testid="spending-dry-run"] [data-testid="show-all"]')
    await centreOn(page, '[data-testid="spending-dry-run-row"]', panel.outcome.outsideDays)
    await delay(300)
    await inspect?.('a row of the export outside the days the file brings')
    await shoot('spending-import-outside-days')
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-import-synced-lookalike')
    await pressSelector(page, press, `[data-testid="question-choice"] ${USE_FILE_ROW}`)
    await elementSays(page, '[data-testid="spending-dry-run-outcome"]', [panel.outcome.replacedSynced], "the file's row does not say it takes the synced row's place")
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-import-synced-lookalike-replaced')
  }
}

/**
 * On Spending's Import with the statements set: the sample Revolut export read as a dry run of 9 new rows, 1 already in and
 * 1 paired with a typed row, its cash withdrawal going to Cash, with nothing written. Imported, nothing is new, and one Undo
 * brings the dry run back.
 */
export function spendingImportFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const panel = words.spendingStatements.import
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const before = panel.summary(9, 1, 1)
    await dropSpendingFile(page, paths.revolut)
    await spendingDryRunSays(page, before)
    await centreOn(page, '[data-testid="spending-dry-run-outcome"]', aroundAmount(words.spendingStatements.review.cash.toCash('\u0000', 'Cash')))
    await delay(300)
    await inspect?.('the Revolut dry run')
    await shoot('spending-import-revolut')
    await pressSelector(page, press, '[data-testid="spending-import-confirm"]')
    await toast(page, panel.imported)
    await spendingDryRunSays(page, panel.summary(0, 11, 0))
    await page.waitForSelector('[data-testid="spending-import-nothing"]', { visible: true, timeout: 10_000 })
    await undoIn(page, press, words)
    await spendingDryRunSays(page, before)
    await dismissToasts(page)
  }
}

const SPENDING_RECEIPT_FORM = '[data-testid="spending-receipt-form"]'

/** The choice of Entries' Add a receipt menu, which shows only with a key kept. */
async function receiptMenuChoice(page, label) {
  const choice = await page
    .waitForFunction(
      (text) => [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent?.trim() === text && item.getClientRects().length > 0) ?? null,
      { timeout: 10_000 },
      label,
    )
    .catch(() => {
      throw new Error(`the Add a receipt menu offers no "${label}"`)
    })
  return choice.asElement()
}

/** Presses Add a receipt on Entries and, where it opens a menu because a key is kept, picks typing it in, the menu's first choice. */
async function openReceiptDialog(page, press) {
  const button = await pressSelector(page, press, '[data-testid="spending-add-receipt"]')
  if ((await button.evaluate((element) => element.getAttribute('aria-haspopup'))) !== 'menu') return
  const typeIn = await page.waitForSelector('[role="menuitem"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Add a receipt opened no menu')
  })
  await press(typeIn)
}

/** Opens the receipt dialog on Entries and uploads a photo, then waits for its QR code to be read or found missing. */
async function uploadReceiptPhoto(page, press, path, reading = 'read') {
  await openReceiptDialog(page, press)
  const input = await page.waitForSelector('[data-testid="spending-receipt-upload"] input[type="file"]', { timeout: 10_000 }).catch(() => {
    throw new Error('the receipt dialog offers no file input')
  })
  await input.uploadFile(path)
  await page.waitForSelector(`[data-testid="spending-receipt-reading"][data-reading="${reading}"]`, { visible: true, timeout: 15_000 }).catch(async () => {
    const shown = await page.$eval('[data-testid="spending-receipt-reading"]', (element) => element.dataset.reading).catch(() => 'no form')
    throw new Error(`the receipt photo reads as ${shown}, not ${reading}`)
  })
  // The preview goes through `img-src`, so a policy without blob: leaves it empty.
  await page
    .waitForFunction(() => (document.querySelector('[data-testid="spending-receipt-preview"]')?.naturalWidth ?? 0) > 0, { timeout: 5_000 })
    .catch(() => {
      throw new Error('the receipt photo shows no preview')
    })
  await delay(300)
}

async function receiptPlaceSays(page, text) {
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="spending-receipt-place"]')?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, text)
    .catch(() => {
      throw new Error(`the receipt's payments do not say "${text}"`)
    })
}

async function pickReceiptCategory(page, press, words, name) {
  await choose(page, press, await page.$('[data-testid="spending-receipt-category"]'), words.spendingStarter[name])
}

async function saveReceipt(page, press, words) {
  await pressSelector(page, press, '[data-testid="spending-receipt-save"]')
  await toast(page, words.spendingReceipts.saved)
  await dialogGone(page, SPENDING_RECEIPT_FORM)
}

/** A file with no open euro account offers no receipt, since a fiscal total is in euros. */
export async function spendingReceiptNoEuroFlow(page, { inspect }) {
  await page.waitForSelector('[data-testid="spending-add-entry"]', { visible: true, timeout: 10_000 })
  if ((await page.$('[data-testid="spending-add-receipt"]')) !== null) throw new Error('Add a receipt shows with no open euro account')
  await inspect?.('Entries with no euro account')
}

/** How many lines the row of this payee and amount shows on Entries. */
async function rowLinesAre(page, title, cents, count) {
  await page
    .waitForFunction(
      (selector, wanted, amount, lines) =>
        [...document.querySelectorAll(selector)].some(
          (row) => row.dataset.amount === String(amount) && row.textContent?.includes(wanted) && row.querySelectorAll('[data-testid="spending-row-line"]').length === lines,
        ),
      { timeout: 10_000 },
      SPENDING_ROW,
      title,
      cents,
      count,
    )
    .catch(() => {
      throw new Error(`Transactions lists no "${title}" row of ${cents} cents with ${count} lines`)
    })
}

/**
 * On the receipts set's Entries: the two buttons, then a photo whose QR code matches the card payment, which is offered ready and
 * splits under one category with the keep-photo switch on. The row shows its line and files out of To review, its dialog holds
 * the amount and removes the receipt, and one Undo takes it all back.
 */
export function spendingReceiptFlowIn(language, photos) {
  const words = SCREEN_WORDS[language]
  const receipt = words.spendingReceipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openReceiptDialog(page, press)
    await page.waitForSelector('[data-testid="spending-receipt-take"]', { visible: true, timeout: 10_000 })
    await delay(300)
    const capture = await page.$eval('[data-testid="spending-receipt-camera"] input[type="file"]', (input) => input.getAttribute('capture'))
    if (capture !== 'environment') throw new Error(`Take a photo opens the camera "${capture}", not the rear one`)
    await inspect?.('the receipt dialog before a photo')
    await shoot('spending-receipt-take')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="spending-receipt-take"]')

    await uploadReceiptPhoto(page, press, photos.oneMatch)
    await waitForTextIn(page, '[data-testid="spending-receipt-qr"]', receipt.qrSays(''))
    await page.waitForSelector('[data-testid="spending-receipt-place"][data-match="ready"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the receipt is not offered its one payment ready')
    })
    await pickReceiptCategory(page, press, words, 'Household goods')
    await pressSelector(page, press, '[data-testid="spending-receipt-keep"]')
    await delay(300)
    await inspect?.('the receipt matched to its payment')
    await shoot('spending-receipt-matched')
    await saveReceipt(page, press, words)
    await rowLinesAre(page, 'Corner market', -2349, 1)
    await inspect?.('the split row on Entries')
    await dismissToasts(page)

    await uploadReceiptPhoto(page, press, photos.oneMatch)
    await page.waitForSelector('[data-testid="spending-receipt-held"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the same fiscal receipt again does not say it is already saved')
    })
    await delay(300)
    await inspect?.('a fiscal receipt already saved')
    await shoot('spending-receipt-held')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_RECEIPT_FORM)

    await openSpendingRow(page, press, 'Corner market', -2349)
    await page.waitForSelector('[data-testid="spending-entry-lines"]', { visible: true, timeout: 10_000 })
    if (!(await page.$eval('[data-testid="spending-entry-amount"] input, input[data-testid="spending-entry-amount"]', (input) => input.disabled))) throw new Error('a split row lets its amount change')
    await inspect?.('a split row in the entry dialog')
    await pressSelector(page, press, '[data-testid="spending-entry-remove-receipt"]')
    await toast(page, receipt.removed)
    await rowLinesAre(page, 'Corner market', -2349, 0)
    await undoIn(page, press, words)
    await rowLinesAre(page, 'Corner market', -2349, 1)
    await dismissToasts(page)
  }
}

/**
 * On the receipts set's Entries: a photo two payments could match asks for a pick and refuses to save without one, a total near
 * a payment takes a Difference line and one Undo takes it back, a total nothing matches makes a new entry on the account picked, and a
 * photo with no code asks for its date and total.
 */
export function spendingReceiptPickFlowIn(language, photos) {
  const words = SCREEN_WORDS[language]
  const receipt = words.spendingReceipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await uploadReceiptPhoto(page, press, photos.twoMatches)
    await receiptPlaceSays(page, receipt.pick)
    await pressSelector(page, press, '[data-testid="spending-receipt-save"]')
    await page.waitForSelector('[data-testid="spending-receipt-place-error"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('a receipt two payments could match')
    await shoot('spending-receipt-pick')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_RECEIPT_FORM)

    await uploadReceiptPhoto(page, press, photos.near)
    await receiptPlaceSays(page, receipt.pick)
    await pressButton(page, press, '[data-testid="spending-receipt-place"] label', 'Harbour bistro')
    await delay(300)
    await inspect?.('a receipt near a payment')
    await saveReceipt(page, press, words)
    await rowLinesAre(page, 'Harbour bistro', -3300, 2)
    await undoIn(page, press, words)
    await rowLinesAre(page, 'Harbour bistro', -3300, 0)
    await dismissToasts(page)

    await uploadReceiptPhoto(page, press, photos.noMatch)
    await page.waitForSelector('[data-testid="spending-receipt-no-match"]', { visible: true, timeout: 10_000 })
    await pickReceiptCategory(page, press, words, 'Groceries')
    await fill(page, 'spending-receipt-merchant', SPENDING_PAYEE)
    await chooseStartingWith(page, press, '[data-testid="spending-receipt-account"]', 'Cash')
    await delay(300)
    await inspect?.('a receipt nothing matches')
    await shoot('spending-receipt-no-match')
    await pressSelector(page, press, '[data-testid="spending-receipt-keep"]')
    const saveButton = await page.$('[data-testid="spending-receipt-save"]')
    await page.evaluate((button) => {
      button.click()
      button.click()
    }, saveButton)
    await toast(page, receipt.saved)
    await dialogGone(page, SPENDING_RECEIPT_FORM)
    const made = await page.$$eval(SPENDING_ROW, (rows, payee) => rows.filter((row) => row.textContent?.includes(payee)).length, SPENDING_PAYEE)
    if (made !== 1) throw new Error(`two taps on Save made ${made} rows`)
    await rowLinesAre(page, SPENDING_PAYEE, -1700, 1)
    await undoIn(page, press, words)
    await spendingRowShown(page, SPENDING_PAYEE, -1700, false)
    await dismissToasts(page)

    await uploadReceiptPhoto(page, press, photos.noCode, 'no-code')
    await page.waitForSelector('[data-testid="spending-receipt-total"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('a receipt photo with no QR code')
    await shoot('spending-receipt-no-code')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_RECEIPT_FORM)
  }
}

/**
 * The receipts set with the bank sync set up, so its accounts take their rows from the bank: a receipt nothing matches on OTP
 * makes no entry and waits on To review, beside the set's own waiting receipts, until removed with an Undo. The kiosk receipt
 * two payments may be asks which, and goes on the one picked.
 */
export function spendingReceiptWaitsFlowIn(language, photos) {
  const words = SCREEN_WORDS[language]
  const receipt = words.spendingReceipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await uploadReceiptPhoto(page, press, photos.noMatch)
    await waitForTextIn(page, '[data-testid="spending-receipt-no-match"]', receipt.noMatchWaits)
    await pickReceiptCategory(page, press, words, 'Groceries')
    await fill(page, 'spending-receipt-merchant', SPENDING_PAYEE)
    await chooseStartingWith(page, press, '[data-testid="spending-receipt-account"]', 'OTP')
    await waitForTextIn(page, '[data-testid="spending-receipt-waits"]', receipt.accountWaits)
    await delay(300)
    await inspect?.('a receipt on an account the bank fills')
    await shoot('spending-receipt-waits')
    await saveReceipt(page, press, words)
    await spendingRowShown(page, SPENDING_PAYEE, -1700, false)
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions?tab=review'
    })
    await page
      .waitForFunction(() => document.querySelectorAll('[data-testid="spending-review-receipt"]').length === 2, { timeout: 10_000 })
      .catch(() => {
        throw new Error('To review does not list both waiting receipts')
      })
    await waitForTextIn(page, '[data-testid="spending-review-receipts"]', SPENDING_PAYEE)
    await delay(300)
    await inspect?.('To review with receipts waiting for the bank')
    await shoot('spending-review-receipts')
    const removing = await page.$$('[data-testid="spending-review-receipt-remove"]')
    await press(removing.at(-1))
    await toast(page, receipt.waiting.removed)
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="spending-review-receipt"]').length === 1, { timeout: 10_000 })
    await undoIn(page, press, words)
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="spending-review-receipt"]').length === 2, { timeout: 10_000 })
    await dismissToasts(page)
    await waitForTextIn(page, '[data-testid="spending-review-receipt-place"]', receipt.waiting.pick)
    const [payment] = await page.$$('[data-testid="spending-review-receipt-place"] [data-testid="question-choice"] button')
    await payment.evaluate((button) => button.scrollIntoView({ block: 'center' }))
    await press(payment)
    await toast(page, receipt.waiting.placed)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="spending-review-receipt-place"]') === null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the kiosk receipt still asks which payment it is')
      })
    await page
      .waitForFunction(() => document.activeElement?.closest('[data-testid="spending-review-receipts"]') != null, { timeout: 5_000 })
      .catch(() => {
        throw new Error('focus dropped to the page once the last question was answered and the card moved')
      })
    await delay(300)
    await inspect?.('To review once the kiosk receipt is on its payment')
    await shoot('spending-review-receipt-placed')
  }
}

/**
 * A made-up JPEG with GPS in its Exif: the dialog shows the place before Save, and the entry shows the coordinates with a link
 * that leaves only on a tap. The set's own split row shows its place too.
 */
export function spendingReceiptPlaceFlowIn(language, photos) {
  const words = SCREEN_WORDS[language]
  const receipt = words.spendingReceipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const jpeg = await writeJpegWithPlace(page, photos.oneMatch, photos.oneMatch.replace(/\.png$/, `-place-${language}.jpg`))
    await uploadReceiptPhoto(page, press, jpeg)
    await waitForTextIn(page, '[data-testid="spending-receipt-place-found"]', '43.508100, 16.440200')
    await pickReceiptCategory(page, press, words, 'Groceries')
    await delay(300)
    await inspect?.('a receipt photo with a place')
    await shoot('spending-receipt-place-found')
    await saveReceipt(page, press, words)
    await dismissToasts(page)
    await openSpendingRow(page, press, 'Corner market', -2349)
    await waitForTextIn(page, '[data-testid="spending-entry-place"]', receipt.place('43.508100', '16.440200'))
    const link = await page.$eval('[data-testid="spending-entry-place-link"]', (anchor) => [anchor.getAttribute('href'), anchor.getAttribute('rel')])
    if (link[0] !== 'https://www.openstreetmap.org/?mlat=43.5081&mlon=16.4402#map=18/43.5081/16.4402' || !link[1].includes('noreferrer')) throw new Error(`the place links to ${link.join(' ')}`)
    await delay(300)
    await inspect?.('an entry with a place')
    await shoot('spending-entry-place')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await openSpendingRow(page, press, 'Corner market', -6120)
    await waitForTextIn(page, '[data-testid="spending-entry-place"]', '43.508100')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/** The sample export on the statements set: the row the rule would file near what was typed waits on To review as maybe the same money, with the rule's category. It files by that, and joins, each with one Undo. */
export function spendingReviewNearFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const { review, import: panel } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.revolut)
    await pressSelector(page, press, '[data-testid="spending-import-confirm"]')
    await toast(page, panel.imported)
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions?tab=review'
    })
    const row = await reviewRowOf(page, 'Corner market')
    await row.waitForSelector('[data-testid="spending-review-maybe-typed"]', { timeout: 10_000 })
    await row.waitForSelector('[data-testid="spending-review-rule-says"]', { timeout: 10_000 })
    await waitForTextIn(page, '[data-testid="spending-review-rule-says"]', review.ruleSays(words.spendingStarter.Groceries))
    await delay(300)
    await inspect?.('a row a rule would file, near what was typed')
    await shoot('spending-review-near')
    await press(await row.$('[data-testid="spending-review-file-as-rule"]'))
    await toast(page, review.filed)
    await undoIn(page, press, words)
    await dismissToasts(page)
    const back = await reviewRowOf(page, 'Corner market')
    await press(await back.$('[data-testid="spending-review-join"]'))
    await toast(page, review.joined)
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/** What the Bank sync tab's last sync says, or fails with, once it says something. A sync of the page may have run before the flow, so Sync now is tapped only when none has. */
async function bankSyncSettled(page, press, selector) {
  const shown = await page.waitForSelector(selector, { visible: true, timeout: 4_000 }).catch(() => null)
  if (shown !== null) return
  await pressSelector(page, press, '[data-testid="spending-bank-sync-now"]')
  await page.waitForSelector(selector, { visible: true, timeout: 10_000 })
}

/**
 * On Settings, Bank sync with nothing saved: no link and no way to sync. Save a made-up deployment, link Revolut, come back
 * on the fake return with the code taken out of the address, read the synced rows on Entries, then Undo the import.
 */
export function spendingBankSyncFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const bank = words.spendingBankSync
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-bank-sync-deployment"] input', { visible: true, timeout: 10_000 })
    if ((await page.$('[data-testid="spending-bank-link"]')) !== null) throw new Error('Bank sync offers a link with no script saved')
    await page.type('[data-testid="spending-bank-sync-deployment"] input', 'AKfycb-made-up')
    await pressSelector(page, press, '[data-testid="spending-bank-sync-save"]')
    await page.waitForSelector('[data-testid="spending-bank-link-revolut"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('the bank sync with a script saved')
    await shoot('spending-settings-bank-sync-saved')
    await dismissToasts(page)
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30_000 }), pressSelector(page, press, '[data-testid="spending-bank-link-revolut"]')])
    await page.waitForSelector('[data-testid="spending-bank-link-finish"], [data-testid="spending-bank-sync-result"]', { visible: true, timeout: 15_000 })
    if ((await page.$('[data-testid="spending-bank-sync-result"]')) === null) await pressSelector(page, press, '[data-testid="spending-bank-link-finish"]')
    await page.waitForSelector('[data-testid="spending-bank-sync-result"]', { visible: true, timeout: 15_000 })
    const address = await page.evaluate(() => window.location.search)
    if (address.includes('code=') || address.includes('state=')) throw new Error(`the address still holds the bank's answer: ${address}`)
    await waitForTextIn(page, '[data-testid="spending-bank-link-state"]', bank.linkedUntil(''))
    await toast(page, words.spendingBankSyncReading.imported)
    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions'
    })
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="spending-row"]')].some((row) => row.textContent?.includes('Corner market')), { timeout: 10_000 })
    await delay(300)
    await inspect?.('the synced rows on Entries')
    await shoot('spending-bank-sync-rows')
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

async function waitForTextIn(page, selector, text) {
  await page.waitForFunction(
    (where, wanted) => [...document.querySelectorAll(where)].some((element) => element.textContent?.includes(wanted)),
    { timeout: 10_000 },
    selector,
    text.trim().replace(/\s+\S*$/, ''),
  )
}

/** On Settings, Bank sync with both banks linked: the last sync's rows, the one a file brought skipped, and the account Kuna does not keep offered in the setup list. */
export function spendingBankSyncRowsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-result"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-notes"] li', words.spendingStatementReading.coveredByFile(1, 'OTP current', '').one)
    await page.waitForSelector('[data-testid="spending-bank-account"][data-kind="missing"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await inspect?.('the bank sync with rows a file brought')
    await shoot('spending-import-bank-sync')
  }
}

/** On Settings, Bank sync when OTP states a balance Kuna does not reach while it holds a pending row: the note, with no opening offered. */
export function spendingBankSyncBalanceFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-difference"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-difference"]', aroundAmount(words.spendingBankSync.pendingPaymentsCaption('\u0000', '\u0000')))
    if ((await page.$('[data-testid="spending-bank-sync-set-opening"]')) !== null) throw new Error('the opening is offered while pending rows may explain the difference')
    await delay(300)
    await inspect?.('the bank sync when a balance differs')
    await shoot('spending-bank-sync-balance')
  }
}

/**
 * On Settings, Bank sync when a synced row looks like the file's Old Town Bookshop three days before: the card asks about it and
 * puts it on hold, To review lists it with the same answers, and Keep both there books it and takes the hold off in one write.
 */
export function spendingBankSyncLookAlikeFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="questions"]')
    await elementSays(page, '[data-testid="question"]', ['OLD TOWN BOOKSHOP D.O.O.', 'Old Town Bookshop'], 'the sync card does not name both rows of the look-alike')
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-bank-sync-lookalike')
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions?tab=review'
    })
    await page.waitForSelector('[data-testid="spending-review-held"] [data-testid="question"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('To review with a bank row on hold')
    await shoot('spending-review-held')
    await pressSelector(page, press, '[data-testid="spending-review-held"] [data-testid="question-choice"] button:nth-child(2)')
    await toast(page, words.spendingBankSync.heldBooked)
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-review-held"]') === null, { timeout: 10_000 })
    await dismissToasts(page)
  }
}

/**
 * On Settings, Bank sync with OTP's cash machine row, which the Bankomat rule spots: the last sync's dry run says its money
 * went to Cash.
 */
export function spendingBankSyncWithdrawalFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-result"]')
    await dismissToasts(page)
    await centreOn(page, '[data-testid="spending-bank-sync-result"] [data-testid="spending-dry-run-outcome"]', aroundAmount(words.spendingStatements.review.cash.toCash('\u0000', 'Cash')))
    await delay(300)
    await inspect?.('the bank sync with cash taken out going to Cash')
    await shoot('spending-bank-sync-withdrawal')
  }
}

/**
 * On To review with the cash set: the withdrawals with no cash leg, two moving to Cash together, one asking which dollar cash
 * account and one offering to add a pound one. Move 2 to cash writes both legs in one write that one Undo takes back, Not cash
 * takes one off the list until Undo, picking a dollar account moves that one, and Add a cash account opens the account dialog
 * as a pound cash account.
 */
export function spendingReviewCashFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const cash = words.spendingStatements.review.cash
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const card = '[data-testid="spending-review-cash"]'
    await page.waitForSelector(`${card} [data-testid="spending-review-cash-row"]`, { visible: true, timeout: 10_000 })
    await elementSays(page, card, [cash.title, 'Bankomat Ilica', 'Cash at Boston ATM', 'Dollars at home', cash.noAccount('GBP')], 'the cash card does not list the three kinds of withdrawal')
    await delay(300)
    await inspect?.('To review with cash withdrawals')
    await shoot('spending-review-cash')
    const rows = async () => page.$$eval(`${card} [data-testid="spending-review-cash-row"]`, (found) => found.length)
    if ((await rows()) !== 2) throw new Error(`the cash card proposes ${await rows()} withdrawals, not 2`)
    await pressSelector(page, press, '[data-testid="spending-review-cash-move"]')
    await toast(page, countedIn(words, cash.moved(2), 2))
    await page.waitForFunction((where) => document.querySelector(`${where} [data-testid="spending-review-cash-row"]`) === null, { timeout: 10_000 }, card)
    await undoIn(page, press, words)
    await page.waitForFunction((where) => document.querySelectorAll(`${where} [data-testid="spending-review-cash-row"]`).length === 2, { timeout: 10_000 }, card)
    await dismissToasts(page)
    await pressSelector(page, press, `${card} [data-testid="spending-review-cash-not-cash"]`)
    await toast(page, cash.leftFiled)
    await page.waitForFunction((where) => document.querySelectorAll(`${where} [data-testid="spending-review-cash-row"]`).length === 1, { timeout: 10_000 }, card)
    await undoIn(page, press, words)
    await page.waitForFunction((where) => document.querySelectorAll(`${where} [data-testid="spending-review-cash-row"]`).length === 2, { timeout: 10_000 }, card)
    await dismissToasts(page)
    await pressSelector(page, press, `${card} [data-testid="question-choice"] button:nth-child(1)`)
    await toast(page, countedIn(words, cash.moved(1), 1))
    await page.waitForFunction((where) => document.querySelector(`${where} [data-testid="question"]`) === null, { timeout: 10_000 }, card)
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="spending-review-cash-add-account"] button')
    await page.waitForSelector('[data-testid="spending-account-dialog"]', { visible: true, timeout: 10_000 })
    await elementSays(page, '[data-testid="spending-account-currency"]', ['GBP'], "the account dialog does not start in the withdrawal's currency")
    if ((await page.$('[data-testid="spending-account-bank"]')) !== null) throw new Error('the account dialog does not start as a cash account')
    await delay(300)
    await inspect?.('the account dialog To review opens for a cash account')
    await shoot('spending-review-cash-add-account')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-account-dialog"]') === null, { timeout: 10_000 })
  }
}

/** Waits for the element under `selector` that says `text`, and scrolls it to the middle of the screen. */
async function centreOn(page, selector, text) {
  await waitForTextIn(page, selector, text)
  await page.evaluate(
    (where, wanted) => [...document.querySelectorAll(where)].find((element) => element.textContent?.includes(wanted))?.scrollIntoView({ block: 'center' }),
    selector,
    text.trim().replace(/\s+\S*$/, ''),
  )
}

/** The longest stretch of a line around the amount it names, which is the same in every build whatever the amount reads as. */
function aroundAmount(line) {
  return line.split('\u0000').reduce((longest, part) => (part.trim().length > longest.length ? part.trim() : longest), '')
}

/** On Settings, Bank sync when pending card payments make up the whole difference: a plain line, with no warning and no opening offered. */
export function spendingBankSyncPendingFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-pending"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-pending"]', aroundAmount(words.spendingBankSync.pendingPayments('Revolut EUR', '\u0000')))
    if ((await page.$('[data-testid="spending-bank-sync-difference"]')) !== null) throw new Error('a difference pending rows explain shows as a warning')
    if ((await page.$('[data-testid="spending-bank-sync-set-opening"]')) !== null) throw new Error('the opening is offered while pending rows explain the difference')
    await dismissToasts(page)
    // Below the top bar and the tabs, which stay on screen.
    await page.$eval('[data-testid="spending-bank-sync-setup"]', (card) => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 140 }))
    await delay(300)
    await inspect?.('the bank sync when pending rows explain a balance')
    await shoot('spending-bank-sync-pending')
  }
}

/**
 * On Settings, Bank sync, the setup list after a fetch: shoots it under `shot`, then when `tap` names a button, taps the
 * first, waits for the toast `done` names, shoots it under `shot` and `after` when that is given, and takes it back.
 * `openKept` opens the card of accounts kept before that second shot and shoots it from its top.
 */
export function spendingBankSyncSetupFlowIn(language, shot, { waitFor, tap = null, done = null, after = null, openKept = false }) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-setup"]')
    await page.waitForSelector(waitFor, { visible: true, timeout: 5_000 })
    await dismissToasts(page)
    // Below the top bar and the tabs, which stay on screen.
    await page.$eval('[data-testid="spending-bank-sync-setup"]', (card) => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 140 }))
    await delay(300)
    await inspect?.(`the setup list for ${shot}`)
    await shoot(shot)
    if (tap === null) return
    await pressSelector(page, press, tap)
    await toast(page, done(words))
    if (after !== null) {
      if (openKept) {
        const kept = '[data-card="spending.bank-sync.kept"]'
        if ((await page.$eval(kept, (card) => card.dataset.collapsed)) === 'true') await pressSelector(page, press, `${kept} .card-toggle`)
        await page.waitForSelector(`${kept}[data-collapsed="false"] [data-testid="spending-bank-account-bring-back-mine"]`, { visible: true, timeout: 5_000 })
        await page.$eval(kept, (card) => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 140 }))
      }
      await delay(300)
      await shoot(after)
    }
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/**
 * On Settings, Bank sync with two accounts to add: each starts on the day of the fetch, a day before the bank's first row is
 * refused with the days it can start on, and the earliest day works the opening back to an empty account and adds it.
 */
export function spendingBankSyncStartDayFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const setup = words.spendingBankSync.setup
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const line = '[data-testid="spending-bank-account"][data-kind="missing"]'
    const start = `${line} [data-testid="spending-bank-account-start"]`
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-setup"]')
    await page.waitForSelector(start, { visible: true, timeout: 5_000 })
    await dismissToasts(page)
    const input = await page.$(start)
    const { value, min, max } = await input.$eval('input', (element) => ({ value: element.value, min: element.min, max: element.max }))
    if (value !== max || min >= max) throw new Error(`the first account to add should start on the day of the fetch, ${max}, and reach back to ${min}, not ${value}`)
    const before = new Date(Date.parse(`${min}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    await setField(input, before)
    await pressSelector(page, press, `${line} [data-testid="spending-bank-account-add"]`)
    await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('aria-invalid') === 'true', { timeout: 5_000 }, start)
    await page.$eval('[data-testid="spending-bank-sync-setup"]', (card) => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 140 }))
    await delay(300)
    await inspect?.('a start day before the bank gave rows')
    await shoot('spending-bank-sync-setup-start-day-refused')
    await setField(input, min)
    await waitForTextIn(page, line, setup.openingStart)
    await delay(300)
    await inspect?.('the earliest start day')
    await shoot('spending-bank-sync-setup-start-day')
    await pressSelector(page, press, `${line} [data-testid="spending-bank-account-add"]`)
    await toast(page, words.spendingAccounts.addedCount(1).one)
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/** On Settings, Bank sync when one bank gives no rows: the line about it, with the other bank's rows in. */
export function spendingBankSyncPartFlowIn(language, shot, line) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-problem"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-problem"]', line(words.spendingBankSyncReading))
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-bank-sync-result"]')?.textContent?.includes('Corner market') ?? false, { timeout: 5_000 })
    await delay(300)
    await inspect?.('the bank sync when one bank gives no rows')
    await shoot(shot)
  }
}

/** On Settings, Bank sync when the script answers an error: the reason shows with what is saved still there. */
export function spendingBankSyncFailedFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-failed"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-failed"]', words.spendingBankSyncReading.didNotAnswer(''))
    await delay(300)
    await inspect?.('the bank sync when the script fails')
    await shoot('spending-bank-sync-failed')
  }
}

/** On Spending's Import: the export without a Fee column is refused, naming the column, with no dry run. */
export function spendingImportRefusedFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.refused)
    const wanted = words.spendingStatementReading.noColumn('Fee')
    await page
      .waitForFunction((text) => document.querySelector('[data-testid="spending-import-refused"]')?.textContent?.includes(text) ?? false, { timeout: 10_000 }, wanted)
      .catch(() => {
        throw new Error(`the refused file does not say "${wanted}"`)
      })
    if ((await page.$('[data-testid="spending-dry-run"]')) !== null) throw new Error('a refused file still shows a dry run')
    await delay(300)
    await inspect?.('the refused Revolut export')
    await shoot('spending-import-refused')
  }
}

/**
 * Drops an export in currencies no account keeps: Import says which two accounts to add, drafted from the file, and adds
 * both with one tap, after which the file's dry run shows. Undo takes both away and the offer comes back.
 */
export function spendingImportMissingFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const reading = words.spendingStatementReading
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const offer = '[data-testid="spending-import-missing-accounts"]'
    const wanted = reading.addToBringIn(language === 'en' ? 'Revolut bank accounts in GBP and CHF' : 'Revolutove bankovne račune u valutama GBP i CHF')
    await dropSpendingFile(page, paths.missing)
    await waitForTextIn(page, offer, wanted)
    await countOf(page, '[data-testid="spending-import-missing-account"]', 2, 'the offer for the missing accounts')
    if ((await page.$('[data-testid="spending-dry-run"]')) !== null) throw new Error('a file refused for its accounts still shows a dry run')
    await delay(300)
    await inspect?.('the accounts a Revolut export needs')
    await shoot('spending-import-missing')
    await pressSelector(page, press, '[data-testid="spending-import-add-accounts"]')
    const added = words.spendingAccounts.addedCount(2)
    await toast(page, language === 'en' ? added.other : added.few)
    await spendingDryRunSays(page, words.spendingStatements.import.summary(4, 0, 0))
    await delay(300)
    await inspect?.('the dry run once its accounts are added')
    await shoot('spending-import-missing-added')
    await undoIn(page, press, words)
    await waitForTextIn(page, offer, wanted)
    await dismissToasts(page)
  }
}

/**
 * With a bank sync deployment saved, the offer for the accounts an export needs asks how each one's rows come in. Each draft
 * starts linked to the bank under the IBAN the file's Revolut account holds. A cleared IBAN stops Add with the reason under it,
 * and the IBAN typed back adds both.
 */
export function spendingImportMissingBankFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const choice = words.spendingAccounts.rowsFromChoice
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const offer = '[data-testid="spending-import-missing-accounts"]'
    const ibans = '[data-testid="spending-import-missing-account-iban"]'
    await dropSpendingFile(page, paths.missing)
    await countOf(page, '[data-testid="spending-import-missing-account-rows-from"]', 2, 'the choice of how each missing account takes its rows')
    const picked = await page.$$eval('[data-testid="spending-import-missing-account-rows-from"] [aria-pressed="true"]', (buttons) => buttons.map((button) => button.textContent?.trim() ?? ''))
    if (picked.some((label) => label !== words.spendingAccounts.rowsFrom['bank-link'])) throw new Error(`the drafts start as ${picked.join(', ')}, not linked to the bank`)
    const filled = await page.$$eval(`input${ibans}, ${ibans} input`, (inputs) => inputs.map((input) => input.value))
    if (filled.length !== 2 || filled.some((iban) => iban !== 'LT000000000000000001')) throw new Error(`the drafts do not share the Revolut account's IBAN: ${filled.join(', ')}`)
    await fill(page, 'spending-import-missing-account-iban', '')
    await pressSelector(page, press, '[data-testid="spending-import-add-accounts"]')
    await waitForTextIn(page, offer, choice.ibanNeeded)
    await delay(300)
    await inspect?.('the missing accounts linked to the bank, one with its IBAN cleared')
    await shoot('spending-import-missing-bank')
    await fill(page, 'spending-import-missing-account-iban', 'LT000000000000000001')
    await pressSelector(page, press, '[data-testid="spending-import-add-accounts"]')
    const added = words.spendingAccounts.addedCount(2)
    await toast(page, language === 'en' ? added.other : added.few)
    await dismissToasts(page)
  }
}

/** Drops the export whose pocket moves have no savings account: the dry run shows once, with the offer to add that account under its notes and no second note for the same gap. */
export function spendingImportMissingSavingsFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const offer = '[data-testid="spending-dry-run"] [data-testid="spending-import-missing-accounts"]'
    await dropSpendingFile(page, paths.revolut)
    await spendingDryRunSays(page, words.spendingStatements.import.summary(9, 1, 1))
    await page.waitForSelector(offer, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the dry run offers no savings account')
    })
    const notes = await page.$eval('[data-testid="spending-dry-run-notes"]', (element) => element.textContent ?? '')
    if (/savings rows? left out|redaka štednje/i.test(notes)) throw new Error(`the dry run notes repeat the savings gap: ${notes}`)
    await delay(300)
    await inspect?.('the dry run with its savings offer')
    await shoot('spending-import-missing-savings')
  }
}

async function reviewRowOf(page, payee) {
  const handle = await page.evaluateHandle((wanted) => [...document.querySelectorAll('[data-testid="spending-review-row"]')].find((row) => row.textContent?.includes(wanted)) ?? null, payee)
  const row = handle.asElement()
  if (row === null) throw new Error(`To review has no row for ${payee}`)
  return row
}

async function countOf(page, selector, wanted, what) {
  await page
    .waitForFunction((rows, count) => document.querySelectorAll(rows).length === count, { timeout: 10_000 }, selector, wanted)
    .catch(() => {
      throw new Error(`${what}: not ${wanted} of ${selector}`)
    })
}

/**
 * On To review with the statements set: Not a pair sends both legs back to review, and a leg takes a category until Undo.
 * On a fresh load Not a pair is undone, a near match is joined with the typed row and undone, an offered transfer is paired
 * and undone, and money in is filed as a lone leg under Between my accounts and undone, then as a refund.
 */
export function spendingReviewFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const review = words.spendingStatements.review
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const ROW = '[data-testid="spending-review-row"]'
    const PAIR = '[data-testid="spending-pair"]'
    await countOf(page, ROW, 5, 'the set should wait with five rows')
    await pressSelector(page, press, '[data-testid="spending-not-a-pair"]')
    await toast(page, review.pairUndone)
    await countOf(page, ROW, 7, 'Not a pair should send both legs back')
    await countOf(page, PAIR, 0, 'Not a pair should end the pair')
    await dismissToasts(page)
    const leg = await reviewRowOf(page, 'Top-up from OTP')
    await choose(page, press, await leg.$('[data-testid="spending-review-category"]'), words.spendingStarter['Other income'])
    await toast(page, review.filed)
    await countOf(page, ROW, 6, 'a category should take the leg off review')
    await inspect?.('To review after Not a pair')
    await shoot('spending-review-not-a-pair')
    await undoIn(page, press, words)
    await countOf(page, ROW, 7, 'Undo should bring the leg back')
    await dismissToasts(page)
    // A fresh load seeds the set again.
    await page.reload({ waitUntil: 'load' })
    await countOf(page, ROW, 5, 'a fresh load should wait with five rows')

    await pressSelector(page, press, '[data-testid="spending-not-a-pair"]')
    await toast(page, review.pairUndone)
    await countOf(page, ROW, 7, 'Not a pair should send both legs back')
    await undoIn(page, press, words)
    await countOf(page, ROW, 5, 'Undo should put the pair back')
    await countOf(page, PAIR, 1, 'Undo should put the pair back')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="spending-review-join"]')
    await toast(page, review.joined)
    await countOf(page, ROW, 4, 'joining should take the bank row off review')
    await undoIn(page, press, words)
    await countOf(page, ROW, 5, 'Undo should bring the bank row back')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="spending-review-pair"]')
    await toast(page, review.paired)
    await countOf(page, ROW, 3, 'pairing should take both rows off review')
    await countOf(page, PAIR, 2, 'pairing should list the new pair')
    await undoIn(page, press, words)
    await countOf(page, ROW, 5, 'Undo should bring both rows back')
    await dismissToasts(page)

    const topUp = await reviewRowOf(page, 'Top-up by card')
    await choose(page, press, await topUp.$('[data-testid="spending-review-category"]'), words.spendingStarter['Between my accounts'])
    await toast(page, review.filed)
    await countOf(page, ROW, 4, 'Between my accounts should take the top-up off review')
    await countOf(page, '[data-testid="spending-lone-leg"]', 3, 'the top-up should wait as a lone leg')
    await undoIn(page, press, words)
    await countOf(page, ROW, 5, 'Undo should bring the top-up back')
    await dismissToasts(page)
    const refund = await reviewRowOf(page, 'Top-up by card')
    await choose(page, press, await refund.$('[data-testid="spending-review-category"]'), words.spendingStarter.Pharmacy)
    await toast(page, review.filed)
    await countOf(page, ROW, 4, 'a spending category should file money in as a refund')
    await dismissToasts(page)
  }
}

/**
 * On To review with the statements set: the first City pharmacy row takes a category, Always for this payee on its toast
 * says it files one row and can be cancelled, and confirmed it files the other row by the same IBAN, and the rule shows on Settings, Rules, where deleting it sends that row back.
 */
export function spendingRuleFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { review, rules } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const ROW = '[data-testid="spending-review-row"]'
    await countOf(page, ROW, 5, 'the set should wait with five rows')
    const fileThenAsk = async () => {
      const row = await reviewRowOf(page, 'City pharmacy')
      await choose(page, press, await row.$('[data-testid="spending-review-category"]'), words.spendingStarter.Pharmacy)
      await toast(page, review.filed)
      await countOf(page, ROW, 4, 'a category should take the row off review')
      const always = await page.waitForFunction(
        (label) => [...document.querySelectorAll('[data-sonner-toast] button, [role="alert"] button, li button')].find((button) => button.textContent?.trim() === label) ?? null,
        { timeout: 5_000 },
        review.always,
      )
      await press(always.asElement())
      const wanted = countedIn(words, rules.files(1), 1)
      await page
        .waitForFunction((text) => document.querySelector('[data-testid="spending-rule-files"]')?.textContent?.trim() === text, { timeout: 10_000 }, wanted)
        .catch(() => {
          throw new Error(`the rule dialog does not say "${wanted}"`)
        })
      await delay(300)
    }
    await fileThenAsk()
    await inspect?.('the rule dialog with how many rows it files')
    await shoot('spending-rule-asks')
    await pressSelector(page, press, '[data-testid="spending-rule-cancel"]')
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-rule-files"]') === null, { timeout: 5_000 })
    await countOf(page, ROW, 4, 'Cancel should file nothing more')
    await dismissToasts(page)
    // A fresh load seeds the set again, with no rule written.
    await page.reload({ waitUntil: 'load' })
    await countOf(page, ROW, 5, 'a fresh load should wait with five rows')
    await fileThenAsk()
    await pressSelector(page, press, '[data-testid="spending-rule-confirm"]')
    await toast(page, rules.made)
    await countOf(page, ROW, 3, 'the rule should file the other row of that payee')
    await inspect?.('To review after a rule')
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/spending/settings?tab=rules'
    })
    await page.waitForSelector('[data-testid="spending-rule"]', { visible: true, timeout: 10_000 })
    await countOf(page, '[data-testid="spending-rule"]', 3, 'Settings, Rules should list the three rules')
    await delay(300)
    await inspect?.('Settings, Rules with the new rule')
    await shoot('spending-rule-made')
    const buttons = await page.$$('[data-testid="spending-rule-delete"]')
    await press(buttons.at(-1))
    await toast(page, rules.deleted)
    await countOf(page, '[data-testid="spending-rule"]', 2, 'Delete should take the rule off')
    await undoIn(page, press, words)
    await countOf(page, '[data-testid="spending-rule"]', 3, 'Undo should bring the rule back')
    await dismissToasts(page)
  }
}

/** Sets a textarea the way typing does, so Vue's v-model sees it. */
async function setTextArea(textarea, value) {
  await textarea.evaluate((element, text) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

/** The rule group on Settings, Rules whose heading names this category. */
async function ruleGroupOf(page, name) {
  return page
    .waitForFunction(
      (wanted) =>
        [...document.querySelectorAll('[data-testid="spending-rule-group"]')].find((group) => group.querySelector('[data-testid="spending-rule-group-name"]')?.textContent?.trim() === wanted) ?? null,
      { timeout: 10_000 },
      name,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no rule group named "${name}"`)
    })
}

/**
 * On Settings, Rules with the statements set: Add rules files three Ina stations into Fuel at once with one Undo, Groceries' own Add
 * then takes Ina, which both groups warn about since Fuel's rules are tried first, and a Fuel rule is changed on its own.
 */
export function spendingRulesAddFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { rules } = words.spendingStatements
  const fuel = words.spendingStarter.Fuel
  const groceries = words.spendingStarter.Groceries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const GROUP = '[data-testid="spending-rule-group"]'
    const OVERLAP = '[data-testid="spending-rule-overlap"]'
    await countOf(page, GROUP, 2, 'the set should start with two rule groups')
    await pressSelector(page, press, '[data-testid="spending-rules-add"]')
    await page.waitForSelector('[data-testid="spending-rule-dialog"]', { visible: true, timeout: 5_000 })
    await chooseCategory(page, press, await page.$('[data-testid="spending-rule-dialog-category"]'), fuel)
    const pickedFuel = `${fuel} · ${words.spendingStarter.Transport}`
    await page
      .waitForFunction((text) => document.querySelector('[data-testid="spending-rule-dialog-category"]')?.textContent?.trim() === text, { timeout: 5_000 }, pickedFuel)
      .catch(() => {
        throw new Error(`the category picker should read "${pickedFuel}"`)
      })
    await setTextArea(await page.$('[data-testid="spending-rule-dialog-lines"] textarea, textarea[data-testid="spending-rule-dialog-lines"]'), 'Ina Zadar\nIna Pleternica\nIna Kozjak Sjever')
    await countOf(page, '[data-testid="spending-rule-dialog-read-line"]', 3, 'the dialog should read three payees')
    await delay(300)
    await inspect?.('the rule dialog with three payees for Fuel')
    await shoot('spending-rules-add-dialog')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await toast(page, countedIn(words, rules.dialog.saved(3), 3))
    await countOf(page, GROUP, 3, 'Fuel should join as a group')
    const fuelGroup = await ruleGroupOf(page, fuel)
    if ((await fuelGroup.$$('[data-testid="spending-rule"]')).length !== 3) throw new Error('Fuel should hold the three payees')
    await undoIn(page, press, words)
    await countOf(page, GROUP, 2, 'one Undo should take all three rules back')
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="spending-rules-add"]')
    await page.waitForSelector('[data-testid="spending-rule-dialog"]', { visible: true, timeout: 5_000 })
    await chooseCategory(page, press, await page.$('[data-testid="spending-rule-dialog-category"]'), fuel)
    await setTextArea(await page.$('[data-testid="spending-rule-dialog-lines"] textarea, textarea[data-testid="spending-rule-dialog-lines"]'), 'Ina Zadar\nIna Pleternica\nIna Kozjak Sjever')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await toast(page, countedIn(words, rules.dialog.saved(3), 3))
    await countOf(page, GROUP, 3, 'Fuel should join as a group')
    await dismissToasts(page)
    await delay(300)
    await inspect?.('Settings, Rules grouped by category')
    await shoot('spending-rules-grouped')

    await press(await (await ruleGroupOf(page, groceries)).$('[data-testid="spending-rule-group-add"]'))
    await page.waitForSelector('[data-testid="spending-rule-dialog"]', { visible: true, timeout: 5_000 })
    await setTextArea(await page.$('[data-testid="spending-rule-dialog-lines"] textarea, textarea[data-testid="spending-rule-dialog-lines"]'), 'Ina')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await toast(page, countedIn(words, rules.dialog.saved(1), 1))
    await countOf(page, OVERLAP, 2, 'Fuel and Groceries should both warn that they can file one payee')
    await dismissToasts(page)
    await shootAt(page, shoot, OVERLAP, 'spending-rules-overlap')

    const kozjak = (await (await ruleGroupOf(page, fuel)).$$('[data-testid="spending-rule-edit"]')).at(-1)
    await press(kozjak)
    await page.waitForSelector('[data-testid="spending-rule-dialog-line"]', { visible: true, timeout: 5_000 })
    await setField(await page.$('[data-testid="spending-rule-dialog-line"] input, input[data-testid="spending-rule-dialog-line"]'), 'Ina Kozjak')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await toast(page, rules.dialog.changed)
    await page.waitForFunction(
      (text) => [...document.querySelectorAll('[data-testid="spending-rule"]')].some((row) => row.textContent?.trim() === text),
      { timeout: 5_000 },
      rules.contains('Ina Kozjak'),
    )
    await undoIn(page, press, words)
    await page.waitForFunction(
      (text) => [...document.querySelectorAll('[data-testid="spending-rule"]')].some((row) => row.textContent?.trim() === text),
      { timeout: 5_000 },
      rules.contains('Ina Kozjak Sjever'),
    )
    await dismissToasts(page)
  }
}

/**
 * On Settings, Rules with the statements set: the Bankomat rule under Between my accounts says its cash goes to the cash account
 * of its currency, and its dialog offers where the money goes. Picking Cash names that account, and one Undo puts it back.
 */
export function spendingRuleWithdrawalFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { rules } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const group = await ruleGroupOf(page, words.spendingStarter['Between my accounts'])
    await elementSays(page, '[data-testid="spending-rule-goes-to"]', [rules.withdrawalByCurrency], 'the Bankomat rule does not say where its cash goes')
    await shootAt(page, shoot, group, 'spending-rules-withdrawal')
    await press(await group.$('[data-testid="spending-rule-edit"]'))
    await page.waitForSelector('[data-testid="spending-rule-dialog-goes-to"]', { visible: true, timeout: 5_000 })
    await chooseCategory(page, press, await page.$('[data-testid="spending-rule-dialog-goes-to"]'), 'Cash')
    await delay(300)
    await inspect?.('the rule dialog with where the money goes')
    await shoot('spending-rule-dialog-withdrawal')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await toast(page, rules.dialog.changed)
    await elementSays(page, '[data-testid="spending-rule-goes-to"]', [rules.withdrawalTo('Cash')], 'the Bankomat rule does not name Cash')
    await undoIn(page, press, words)
    await elementSays(page, '[data-testid="spending-rule-goes-to"]', [rules.withdrawalByCurrency], 'Undo did not put the rule back')
    await dismissToasts(page)
  }
}

/** Money out added by touch on the sample Spending file's Transactions: the amount on the number pad, a category, saved onto today's list, and taken off again with Undo. */
export async function spendingMoneyOutFlow(page, { press, shoot, inspect }) {
  const words = SCREEN_WORDS.en
  await typeMoneyOut(page, press, words)
  await delay(300)
  await inspect?.('the entry dialog with its amount typed')
  await shoot('spending-money-out-dialog')
  await saveSpendingEntry(page, press, words.spendingEntries.dialog.added)
  await spendingRowShown(page, SPENDING_PAYEE, -2500, true)
  await inspect?.('Transactions with the new entry')
  await shoot('spending-money-out')
  await undoIn(page, press, words)
  await spendingRowShown(page, SPENDING_PAYEE, -2500, false)
  await dismissToasts(page)
}

/** The balance an account's row on Spending's Accounts shows, in cents of the account's own currency. */
async function spendingBalanceOf(page, name) {
  const text = await page
    .waitForFunction(
      (wanted) =>
        [...document.querySelectorAll('[data-testid="spending-account-row"]')]
          .find((row) => row.textContent?.includes(wanted))
          ?.querySelector('[data-testid="spending-account-balance"]')
          ?.textContent?.trim() ?? null,
      { timeout: 10_000 },
      name,
    )
    .then((handle) => handle.jsonValue())
    .catch(() => {
      throw new Error(`Accounts shows no balance for ${name}`)
    })
  const cents = Number(text.replace(/\D/g, ''))
  return /[−-]/.test(text) ? -cents : cents
}

/**
 * From the sample Spending file's Accounts: 100 euros moved from OTP current to Revolut USD, arriving as 108 dollars,
 * lists both legs on Transactions and moves both balances by as much. Deleting one leg takes both off until Undo puts
 * them back.
 */
export function spendingTransferFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  const screens = words.spendingScreens
  const title = words.spendingStarter['Between my accounts']
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const before = { out: await spendingBalanceOf(page, 'OTP current'), into: await spendingBalanceOf(page, 'Revolut USD') }
    await goTo(page, '#/spending/transactions', screens.entries)
    await typeTransfer(page, press, words)
    await saveSpendingEntry(page, press, dialog.added)
    await dismissToasts(page)
    await spendingRowShown(page, title, -10000, true)
    await spendingRowShown(page, title, 10800, true)

    await goTo(page, '#/spending/accounts', screens.accounts)
    const after = { out: await spendingBalanceOf(page, 'OTP current'), into: await spendingBalanceOf(page, 'Revolut USD') }
    if (after.out !== before.out - 10000 || after.into !== before.into + 10800)
      throw new Error(`the move took OTP current from ${before.out} to ${after.out} cents and Revolut USD from ${before.into} to ${after.into}, not by 100 euros and 108 dollars`)
    await inspect?.('Accounts after the move')
    await shoot('spending-transfer-balances')

    await goTo(page, '#/spending/transactions', screens.entries)
    await openSpendingRow(page, press, title, -10000)
    await pressSelector(page, press, '[data-testid="spending-entry-delete"]')
    await toast(page, dialog.deleted)
    await spendingRowShown(page, title, -10000, false)
    await spendingRowShown(page, title, 10800, false)
    await undoIn(page, press, words)
    await spendingRowShown(page, title, -10000, true)
    await spendingRowShown(page, title, 10800, true)
    await inspect?.('Transactions after Undo')
    await dismissToasts(page)
  }
}

export const spendingTransferFlow = spendingTransferFlowIn('en')

/** The names of the rows of Spending's categories card, in their order. */
function spendingCategoryNames(page) {
  return page.$$eval('[data-testid="spending-category-row"]', (rows) => rows.map((row) => row.querySelector('.min-w-0')?.firstChild?.textContent?.trim() ?? ''))
}

async function spendingCategoryShown(page, name, shown) {
  await page
    .waitForFunction(
      (wanted, expected) => [...document.querySelectorAll('[data-testid="spending-category-row"] .min-w-0')].some((cell) => cell.textContent?.trim() === wanted) === expected,
      { timeout: 10_000 },
      name,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `the categories card lists no ${name}` : `the categories card still lists ${name}`)
    })
}

/**
 * On the sample Spending file's Settings: Coffee renamed in its dialog, moved up above Restaurants, then deleted with its
 * entries moved to Groceries, which takes it off the card until Undo brings it back.
 */
export function spendingCategoryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const categories = words.spendingCategories
  const starter = words.spendingStarter
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, `[data-testid="spending-category-edit"][aria-label="${categories.edit(starter.Coffee)}"]`)
    await page.waitForSelector('[data-testid="spending-category-dialog"]', { visible: true, timeout: 10_000 })
    await fill(page, 'spending-category-name', SPENDING_RENAMED)
    await delay(300)
    await inspect?.('the category dialog')
    await shoot('spending-category-dialog')
    await pressSelector(page, press, '[data-testid="spending-category-save"]')
    await toast(page, categories.saved)
    await dismissToasts(page)
    await spendingCategoryShown(page, SPENDING_RENAMED, true)

    await pressSelector(page, press, `[data-testid="spending-category-up"][aria-label="${categories.moveUp(SPENDING_RENAMED)}"]`)
    await toast(page, categories.moved)
    await dismissToasts(page)
    const order = await spendingCategoryNames(page)
    if (order.indexOf(SPENDING_RENAMED) !== order.indexOf(starter.Restaurants) - 1) throw new Error(`${SPENDING_RENAMED} did not move above ${starter.Restaurants}: ${order.join(', ')}`)

    await pressSelector(page, press, `[data-testid="spending-category-edit"][aria-label="${categories.edit(SPENDING_RENAMED)}"]`)
    await page.waitForSelector('[data-testid="spending-category-dialog"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-category-delete-into"]')
    await choose(page, press, await page.waitForSelector('[data-testid="spending-category-target"]', { visible: true }), starter.Groceries)
    await delay(300)
    await inspect?.('the category dialog moving its entries')
    await shoot('spending-category-delete')
    await pressSelector(page, press, '[data-testid="spending-category-delete"]')
    await toast(page, categories.deleted)
    await spendingCategoryShown(page, SPENDING_RENAMED, false)
    await undoIn(page, press, words)
    await spendingCategoryShown(page, SPENDING_RENAMED, true)
    await inspect?.('the categories card after Undo')
    await dismissToasts(page)
  }
}

export const spendingCategoryFlow = spendingCategoryFlowIn('en')

/** The row of Spending's Limits whose category reads `name`, or null. */
function spendingLimitRow(page, name) {
  return page.evaluateHandle(
    (wanted) => [...document.querySelectorAll('[data-testid="spending-budget-row"]')].find((row) => row.querySelector('[data-testid="spending-limit-change"]')?.textContent?.trim() === wanted) ?? null,
    name,
  )
}

async function spendingLimitShown(page, name, shown) {
  await page
    .waitForFunction(
      (wanted, expected) =>
        [...document.querySelectorAll('[data-testid="spending-budget-row"] [data-testid="spending-limit-change"]')].some((button) => button.textContent?.trim() === wanted) === expected,
      { timeout: 10_000 },
      name,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `Limits lists no limit on ${name}` : `Limits still lists a limit on ${name}`)
    })
}

/** On the sample Spending file's Limits: a monthly limit set on Transport, then ended from its dialog, which takes it off until Undo puts it back. */
export function spendingLimitFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const limits = words.spendingBudgets
  const transport = words.spendingStarter.Transport
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="spending-limit-add"]')
    await page.waitForSelector('[data-testid="spending-limit-dialog"]', { visible: true, timeout: 10_000 })
    await choose(page, press, await page.$('[data-testid="spending-limit-category"]'), transport)
    await typeAmount(page, press, 'spending-limit-amount', '120')
    await delay(300)
    await inspect?.('the limit dialog')
    await shoot('spending-limit-dialog')
    await pressSelector(page, press, '[data-testid="spending-limit-save"]')
    await toast(page, limits.dialog.set)
    await dismissToasts(page)
    await spendingLimitShown(page, transport, true)
    await shoot('spending-limit-set')

    await pressSelector(page, press, `[data-testid="spending-limit-change"][aria-label="${limits.table.change(transport)}"]`)
    await page.waitForSelector('[data-testid="spending-limit-dialog"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-limit-end"]')
    await toast(page, limits.dialog.ended)
    await spendingLimitShown(page, transport, false)
    await undoIn(page, press, words)
    await spendingLimitShown(page, transport, true)
    await inspect?.('Limits after Undo')
    await dismissToasts(page)
  }
}

export const spendingLimitFlow = spendingLimitFlowIn('en')

/**
 * On the sample Spending file's Limits by touch: Food's limit raised to 450 from this month keeps what carried in, which
 * the row says under its name on a phone, and its available becomes 450 and that carry.
 */
export async function spendingFoodLimitFlow(page, { press, shoot, inspect }) {
  const words = SCREEN_WORDS.en
  const food = words.spendingStarter.Food
  const read = async () => {
    const row = await spendingLimitRow(page, food)
    if ((await row.jsonValue()) === null) throw new Error(`Limits lists no limit on ${food}`)
    return row.evaluate((element) => ({
      carriedIn: Number(element.dataset.carriedIn),
      available: Number(element.dataset.available),
      carry: [...element.querySelectorAll('[data-testid="spending-budget-carry"]')].filter((caption) => caption.getClientRects().length > 0).map((caption) => caption.textContent?.trim()),
    }))
  }
  const before = await read()
  if (before.carriedIn === 0 || before.carry.length !== 1) throw new Error(`${food} shows no carry on a phone: ${JSON.stringify(before)}`)
  await pressSelector(page, press, `[data-testid="spending-limit-change"][aria-label="${words.spendingBudgets.table.change(food)}"]`)
  await page.waitForSelector('[data-testid="spending-limit-dialog"]', { visible: true, timeout: 10_000 })
  await typeAmount(page, press, 'spending-limit-amount', '450')
  await delay(300)
  await inspect?.('the limit dialog on Food')
  await pressSelector(page, press, '[data-testid="spending-limit-save"]')
  await toast(page, words.spendingBudgets.dialog.set)
  await dismissToasts(page)
  await page
    .waitForFunction(
      (wanted, carried, available) =>
        [...document.querySelectorAll('[data-testid="spending-budget-row"]')].some(
          (row) =>
            row.querySelector('[data-testid="spending-limit-change"]')?.textContent?.trim() === wanted && row.dataset.carriedIn === String(carried) && row.dataset.available === String(available),
        ),
      { timeout: 10_000 },
      food,
      before.carriedIn,
      45000 + before.carriedIn,
    )
    .catch(async () => {
      throw new Error(`${food} at 450 does not keep its carry of ${before.carriedIn} cents and make ${45000 + before.carriedIn} available: ${JSON.stringify(await read())}`)
    })
  const after = await read()
  if (JSON.stringify(after.carry) !== JSON.stringify(before.carry)) throw new Error(`${food} read ${before.carry.join()} carried in, then ${after.carry.join()}`)
  await shoot('spending-limit-food')
}

async function fill(page, testId, value) {
  const input = await page.waitForSelector(`[data-testid="${testId}"]`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`no visible ${testId} field within 10 s`)
  })
  await setField(input, value)
}

/** Picks the option of an open select menu whose text starts with `start`. */
async function chooseStartingWith(page, press, trigger, start) {
  await pressSelector(page, press, trigger)
  const option = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null, { timeout: 5_000 }, start)
    .catch(() => {
      throw new Error(`no option starting "${start}"`)
    })
  await option.asElement().evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(option.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

async function loanCardShown(page, name, shown) {
  await page
    .waitForFunction(
      (wanted, expected) => [...document.querySelectorAll('[data-testid="loan-card"] h2')].some((heading) => heading.textContent?.trim() === wanted) === expected,
      { timeout: 10_000 },
      name,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `the Loans Overview has no card for ${name}` : `the Loans Overview still has a card for ${name}`)
    })
}

/** Opens a loan's page from its card on the Loans Overview, which the language titles. */
async function openLoanCard(page, press, name, overview = SCREEN_WORDS.en.overview) {
  await page.evaluate(() => {
    window.location.hash = '#/loans'
  })
  await screenTitled(page, overview)
  const card = await page
    .waitForFunction(
      (wanted) => [...document.querySelectorAll('[data-testid="loan-card"]')].find((element) => element.querySelector('h2')?.textContent?.trim() === wanted) ?? null,
      { timeout: 10_000 },
      name,
    )
    .catch(() => {
      throw new Error(`no card for ${name} on the Loans Overview`)
    })
  await card.asElement().evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(card.asElement())
  await screenTitled(page, name)
}

/** Presses Add on the change card with this test id. */
async function addChange(page, press, card) {
  await pressSelector(page, press, `[data-testid="${card}"] [data-testid="change-add"]`)
}

/**
 * Loans with the sample file: a bank loan added with its first rate, which opens its page, a rate
 * period, an extra payment, a late instalment and a subsidy added there, the subsidy named as such
 * and then by the payer its dialog gives, a movement added to the informal loan, and the new bank
 * loan deleted with its records and brought back with Undo.
 */
export async function loansEditorFlow(page, { press, shoot, inspect }) {
  await pressSelector(page, press, '[data-testid="add-bank-loan"]')
  await page.waitForSelector('[data-testid="bank-loan-form"]', { visible: true })
  if (await page.$('[data-testid="bank-loan-lender"]')) throw new Error('a new bank loan shows its lender before More details is opened')
  await fill(page, 'bank-loan-name', 'Car loan')
  await fill(page, 'bank-loan-principal', '12000')
  await fill(page, 'bank-loan-instalments', '48')
  await fill(page, 'bank-loan-drawdown', '2026-01-10')
  await fill(page, 'bank-loan-first-instalment', '2026-02-10')
  await fill(page, 'rate-field', '6.5')
  await delay(200)
  await inspect?.('the bank loan dialog')
  await shoot('loans-add-bank-loan')
  await pressSelector(page, press, '[data-testid="bank-loan-save"]')
  await toast(page, 'Bank loan added')
  await screenTitled(page, 'Car loan')
  await dismissToasts(page)

  await addChange(page, press, 'rate-periods')
  await page.waitForSelector('[data-testid="rate-period-form"]', { visible: true })
  await chooseStartingWith(page, press, '[data-testid="rate-period-from"]', '10 Feb 2027')
  await fill(page, 'rate-field', '5.9')
  await fill(page, 'rate-period-note', '3M EURIBOR + 0.67')
  await shoot('loans-add-rate-period')
  await pressSelector(page, press, '[data-testid="rate-period-save"]')
  await toast(page, 'Rate period added')
  await elementSays(page, '[data-testid="rate-periods"]', ['5.9%, variable', 'From 10 Feb 2027'], 'the new rate period is not listed')
  await dismissToasts(page)

  await addChange(page, press, 'extra-payments')
  await page.waitForSelector('[data-testid="extra-payment-form"]', { visible: true })
  await fill(page, 'extra-payment-date', '2026-09-10')
  await fill(page, 'extra-payment-amount', '2000')
  await pressSelector(page, press, '[data-testid="extra-payment-save"]')
  await toast(page, 'Extra payment added')
  await elementSays(page, '[data-testid="extra-payments"]', ['€2,000.00', '10 Sep 2026, shorter term'], 'the extra payment is not listed')
  await dismissToasts(page)

  await addChange(page, press, 'late-instalments')
  await page.waitForSelector('[data-testid="late-instalment-form"]', { visible: true })
  await chooseStartingWith(page, press, '[data-testid="late-instalment-due"]', '10 Mar 2026')
  await fill(page, 'late-instalment-paid', '2026-03-20')
  await pressSelector(page, press, '[data-testid="late-instalment-save"]')
  await toast(page, 'Late instalment added')
  await elementSays(page, '[data-testid="late-instalments"]', ['Due 10 Mar 2026', '10 days late'], 'the late instalment is not listed')
  await dismissToasts(page)

  await addChange(page, press, 'loan-subsidy')
  await page.waitForSelector('[data-testid="subsidy-form"]', { visible: true })
  await fill(page, 'subsidy-monthly', '20')
  await fill(page, 'subsidy-instalments', '12')
  await pressSelector(page, press, '[data-testid="subsidy-save"]')
  await toast(page, 'Subsidy added')
  await elementSays(page, '[data-testid="loan-subsidy"]', ['€20.00 a month', 'Subsidy pays instalments 1 to 12'], 'a subsidy without a payer is not named as the subsidy')
  await elementSays(page, '[data-testid="bank-loan-hero"]', ['Subsidy pays'], 'the hero does not name the subsidy')
  await dismissToasts(page)
  await pressSelector(page, press, '[data-testid="loan-subsidy"] [data-testid="change-edit"]')
  await page.waitForSelector('[data-testid="subsidy-form"]', { visible: true })
  await fill(page, 'subsidy-payer', 'HZZO')
  await delay(200)
  await inspect?.('the subsidy dialog with a payer')
  await shoot('loans-subsidy-payer')
  await pressSelector(page, press, '[data-testid="subsidy-save"]')
  await toast(page, 'Subsidy saved')
  await elementSays(page, '[data-testid="loan-subsidy"]', ['HZZO pays instalments 1 to 12'], 'the subsidy does not name its payer')
  await elementSays(page, '[data-testid="bank-loan-hero"]', ['HZZO pays'], 'the hero does not name the payer')
  await elementSays(page, '[data-testid="loan-payments-chart"]', ['HZZO pays'], 'the payments chart does not name the payer')
  await inspect?.('the new bank loan with its changes')
  await shoot('loans-new-bank-loan')
  await dismissToasts(page)

  await openLoanCard(page, press, 'From Marko')
  await pressSelector(page, press, '[data-testid="movement-add"]')
  await page.waitForSelector('[data-testid="movement-form"]', { visible: true })
  await fill(page, 'movement-amount', '250')
  await fill(page, 'movement-note', 'Paid back by the flow')
  await shoot('loans-add-movement')
  await pressSelector(page, press, '[data-testid="movement-save"]')
  await toast(page, 'Movement added')
  await elementSays(page, '[data-testid="movement-list"]', ['Paid back by the flow'], 'the movement is not listed')
  await dismissToasts(page)

  await openLoanCard(page, press, 'Car loan')
  await pressSelector(page, press, '[data-testid="bank-loan-edit"]')
  await pressSelector(page, press, '[data-testid="bank-loan-delete"]')
  await toast(page, 'Bank loan deleted')
  await screenTitled(page, 'Overview')
  await loanCardShown(page, 'Car loan', false)
  await undo(page, press)
  await loanCardShown(page, 'Car loan', true)
  await inspect?.('the Loans Overview after Undo')
  await shoot('loans-undo-delete')
  await dismissToasts(page)
}

/** Picks the first or the last option of the select under `trigger`. */
async function chooseAt(page, press, trigger, end) {
  await pressSelector(page, press, trigger)
  await page.waitForSelector('[role="option"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error(`${trigger} offers no option`)
  })
  const options = await page.$$('[role="option"]')
  const option = end === 'first' ? options[0] : options.at(-1)
  await option.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(option)
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

/**
 * The changes of a bank loan in a language: a bank loan added, then a rate period, an extra payment,
 * a late instalment and a subsidy with its payer, each saved with its toast, and the loan deleted
 * and brought back with Undo. Each state is inspected, so the visual check reads its words.
 */
export function loansEditorFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(`${name}-${language}`)
    // The toast rises into place, so it is read and pressed once it settles.
    const toastShown = async (when) => {
      await page.waitForSelector(TOAST, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error(`no toast once ${when}`)
      })
      await delay(600)
      await inspect?.(when)
    }
    const saved = async (save, when) => {
      await pressSelector(page, press, save)
      await toastShown(`${when} was saved`)
      await dismissToasts(page)
    }
    await pressSelector(page, press, '[data-testid="add-bank-loan"]')
    await page.waitForSelector('[data-testid="bank-loan-form"]', { visible: true })
    await fill(page, 'bank-loan-name', 'Car loan')
    await fill(page, 'bank-loan-principal', '12000')
    await fill(page, 'bank-loan-instalments', '48')
    await fill(page, 'bank-loan-drawdown', '2026-01-10')
    await fill(page, 'bank-loan-first-instalment', '2026-02-10')
    await fill(page, 'rate-field', '6.5')
    await delay(200)
    await inspect?.('the bank loan dialog')
    await saved('[data-testid="bank-loan-save"]', 'the bank loan')
    await screenTitled(page, 'Car loan')

    await addChange(page, press, 'rate-periods')
    await page.waitForSelector('[data-testid="rate-period-form"]', { visible: true })
    await chooseAt(page, press, '[data-testid="rate-period-from"]', 'first')
    await fill(page, 'rate-field', '5.9')
    await saved('[data-testid="rate-period-save"]', 'the rate period')

    await addChange(page, press, 'extra-payments')
    await page.waitForSelector('[data-testid="extra-payment-form"]', { visible: true })
    await fill(page, 'extra-payment-date', '2026-09-10')
    await fill(page, 'extra-payment-amount', '2000')
    await saved('[data-testid="extra-payment-save"]', 'the extra payment')

    await addChange(page, press, 'late-instalments')
    await page.waitForSelector('[data-testid="late-instalment-form"]', { visible: true })
    // The dues run newest first, so the last is the first instalment, 10 Feb 2026.
    await chooseAt(page, press, '[data-testid="late-instalment-due"]', 'last')
    await fill(page, 'late-instalment-paid', '2026-03-20')
    await saved('[data-testid="late-instalment-save"]', 'the late instalment')

    await addChange(page, press, 'loan-subsidy')
    await page.waitForSelector('[data-testid="subsidy-form"]', { visible: true })
    await fill(page, 'subsidy-monthly', '20')
    await fill(page, 'subsidy-instalments', '12')
    await saved('[data-testid="subsidy-save"]', 'the subsidy')
    await pressSelector(page, press, '[data-testid="loan-subsidy"] [data-testid="change-edit"]')
    await page.waitForSelector('[data-testid="subsidy-form"]', { visible: true })
    await fill(page, 'subsidy-payer', 'HZZO')
    await saved('[data-testid="subsidy-save"]', 'the subsidy with its payer')
    await inspect?.('the new bank loan with its changes')
    await shoot('loans-new-bank-loan')

    await pressSelector(page, press, '[data-testid="bank-loan-edit"]')
    await pressSelector(page, press, '[data-testid="bank-loan-delete"]')
    await screenTitled(page, words.overview)
    await loanCardShown(page, 'Car loan', false)
    await toastShown('the bank loan deleted')
    await undoIn(page, press, words)
    await loanCardShown(page, 'Car loan', true)
    await inspect?.('the Loans Overview after Undo')
    await shoot('loans-undo-delete')
    await dismissToasts(page)
  }
}

/** The bank loan's what-if: an extra payment inside the subsidy's window shows both effects and the warning, and Apply fills the extra payment dialog. */
export function loansWhatIfFlowIn(language) {
  const { whatIf } = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await fill(page, 'what-if-amount', '10000')
    await fill(page, 'what-if-date', '2027-06-20')
    await elementSays(page, '[data-testid="what-if-outcomes"]', [whatIf.shorter, whatIf.lower, whatIf.interestSaved, whatIf.newInstalment], 'the what-if does not show both effects')
    await elementSays(page, '[data-testid="what-if-subsidy"]', [whatIf.subsidyTitle], 'the what-if does not warn about the subsidy')
    const panel = await page.$('[data-testid="what-if"]')
    await shootAt(page, shoot, panel, 'loans-what-if', { block: 'start' })
    await pressSelector(page, press, '[data-testid="what-if-apply-lower"]')
    await page.waitForSelector('[data-testid="extra-payment-form"]', { visible: true })
    const filled = await page.$eval('[data-testid="extra-payment-amount"]', (input) => input.value)
    const tried = language === 'en' ? '10,000.00' : '10.000,00'
    if (filled !== tried) throw new Error(`Apply filled the amount with "${filled}", not ${tried}`)
    await shoot('loans-what-if-apply')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="extra-payment-form"]')
  }
}

export const loansWhatIfFlow = loansWhatIfFlowIn('en')

/** The sample Loans file's offers, by their bare UUIDs. */
const SAMPLE_OFFERS = {
  jadran: 'fa4e0000-0000-4000-8000-000000000023',
  coastal: 'fa4e0000-0000-4000-8000-000000000024',
  lighthouse: 'fa4e0000-0000-4000-8000-000000000032',
}

/** The keys of the offers Side by side compares, in their order, from the table's head or a phone's cards. */
function comparedColumns(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-testid="scenario-comparison"] [data-column]')].map((column) => column.dataset.column))
}

async function columnsAre(page, wanted, failure) {
  await page
    .waitForFunction(
      (keys) => JSON.stringify([...document.querySelectorAll('[data-testid="scenario-comparison"] [data-column]')].map((column) => column.dataset.column)) === JSON.stringify(keys),
      { timeout: 10_000 },
      wanted,
    )
    .catch(async () => {
      throw new Error(`${failure}: the columns are ${JSON.stringify(await comparedColumns(page))}`)
    })
}

/** How many figures the total line of Side by side holds, as cells of the table or one per card on a phone. */
function totalFigures(page) {
  return page.evaluate(() => document.querySelectorAll('[data-line="total"] td, section[data-column] [data-line="total"]').length)
}

/** The words of the editor's headline in the dialog's foot. */
function headlineOf(page) {
  return page.$eval('[data-testid="scenario-headline"]', (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '').catch(() => '')
}

async function headlineSays(page, wanted, failure) {
  await page
    .waitForFunction((text) => (document.querySelector('[data-testid="scenario-headline"]')?.textContent ?? '').replace(/\s+/g, ' ').includes(text), { timeout: 10_000 }, wanted)
    .catch(async () => {
      throw new Error(`${failure}: the foot says "${await headlineOf(page)}"`)
    })
}

/**
 * Scenarios with the sample file: its three offers side by side, the monthly instalment first and
 * one figure per offer on each line. C is repaid in equal principal, so no monthly instalment is ticked
 * until C is unpicked. Unpicking B leaves C its letter and repicking fills B again.
 * Comparing against B moves the base mark. Deleting B takes it off the list and Undo brings it back.
 */
export async function loansScenariosFlow(page, { press, shoot, inspect }) {
  const { jadran, coastal, lighthouse } = SAMPLE_OFFERS
  await columnsAre(page, [jadran, coastal, lighthouse], 'Scenarios does not compare the three offers')
  const figures = await totalFigures(page)
  if (figures !== 3) throw new Error(`the total line of Side by side holds ${figures} figures, not 3`)
  const first = await page.$eval('[data-testid="scenario-comparison"] [data-line]', (element) => element.dataset.line)
  if (first !== 'instalment') throw new Error(`Side by side leads with ${first}, not the monthly instalment`)
  const instalmentTicks = () => page.$$eval('[data-testid="scenario-comparison"] [data-line="instalment"] .text-success', (icons) => icons.length)
  if ((await instalmentTicks()) !== 0) throw new Error('Side by side ticks a monthly instalment across annuity and equal principal offers')
  await inspect?.('Scenarios')
  await shoot('loans-scenarios-flow')
  await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${lighthouse}"]`)
  await columnsAre(page, [jadran, coastal], 'unpicking C did not take its column away')
  if ((await instalmentTicks()) !== 1) throw new Error('Side by side ticks no monthly instalment across two annuity offers')
  await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${lighthouse}"]`)
  await columnsAre(page, [jadran, coastal, lighthouse], 'repicking C did not fill its slot')

  await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${coastal}"]`)
  await columnsAre(page, [jadran, lighthouse], 'unpicking B did not take its column away')
  if (!(await page.evaluate(() => window.location.hash.includes(',,')))) throw new Error('the freed slot is not kept in the address')
  await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${coastal}"]`)
  await columnsAre(page, [jadran, coastal, lighthouse], 'repicking B did not fill its slot')

  await chooseStartingWith(page, press, '[data-testid="scenario-base"]', 'B ·')
  await elementSays(page, `[data-testid="scenario-comparison"] [data-column="${coastal}"]`, ['The base'], 'B is not marked the base')
  await inspect?.('Scenarios against B')
  await shoot('loans-scenarios-base')

  const rows = () => page.evaluate(() => document.querySelectorAll('[data-testid="scenario-row"]').length)
  const before = await rows()
  await pressSelector(page, press, `[data-testid="scenario-row"][data-scenario="${coastal}"] [data-testid="scenario-delete"]`)
  await toast(page, 'Scenario deleted')
  await page
    .waitForFunction((count) => document.querySelectorAll('[data-testid="scenario-row"]').length === count, { timeout: 10_000 }, before - 1)
    .catch(() => {
      throw new Error('Delete left the offer on the list')
    })
  await undo(page, press)
  await page
    .waitForFunction((count) => document.querySelectorAll('[data-testid="scenario-row"]').length === count, { timeout: 10_000 }, before)
    .catch(() => {
      throw new Error('Undo did not bring the offer back')
    })
  await dismissToasts(page)
}

/** Types 100,000 at 4% over 10 years and 0 months into New scenario. */
async function typeTheExample(page, press) {
  await pressSelector(page, press, '[data-testid="scenario-new"]')
  await page.waitForSelector('[data-testid="scenario-editor"]', { visible: true })
  await fill(page, 'offer-principal', '100000')
  await fill(page, 'offer-rate', '4')
  await fill(page, 'offer-years', '10')
  await fill(page, 'offer-months', '0')
}

/**
 * New scenario: the amount, the rate, the years and the months typed, the foot reading the annuity,
 * then Equal principal picked and the foot reading the first instalment falling to the last. A printed
 * EKS a point above Kuna's warns in the outcome until it is cleared. Interim
 * interest without its date, left under a closed More terms, makes Save open the section on its
 * error. Cleared and saved without a name it is named from its figures, listed, and deleted again.
 */
export async function loansScenarioEditorFlow(page, { press, shoot, inspect }) {
  await typeTheExample(page, press)
  await headlineSays(page, '€1,012.45 a month', 'the foot does not read the annuity')
  await delay(200)
  await inspect?.('the new scenario with an annuity')
  await shoot('loans-scenario-editor')
  await pressButton(page, press, '[data-testid="offer-repayment"] button', 'Equal principal')
  await headlineSays(page, '€1,166.67 falling to €836.11', 'the foot does not read the equal principal instalments')
  await inspect?.('the new scenario with equal principal')
  await shoot('loans-scenario-editor-equal-principal')
  await pressSelector(page, press, '[data-testid="offer-more-toggle"]')
  await fill(page, 'offer-bank-eks', '5')
  await elementSays(page, '[data-testid="scenario-eks-differs"]', ['and the bank printed 5'], 'a printed EKS a point above Kuna’s does not warn in the outcome')
  await inspect?.('the new scenario whose printed EKS differs')
  await shoot('loans-scenario-editor-eks-differs')
  await fill(page, 'offer-bank-eks', '')
  await page.waitForSelector('[data-testid="scenario-eks-differs"]', { hidden: true, timeout: 5_000 }).catch(() => {
    throw new Error('the EKS warning stays once the printed EKS is cleared')
  })
  await fill(page, 'offer-interim', '120')
  await pressSelector(page, press, '[data-testid="offer-more-toggle"]')
  await page.waitForSelector('[data-testid="offer-interim"]', { hidden: true, timeout: 5_000 })
  await pressSelector(page, press, '[data-testid="scenario-save"]')
  await page.waitForSelector('[data-testid="offer-interim"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('Save with a wrong field under a closed More terms did not open the section')
  })
  await elementSays(page, '[data-testid="scenario-editor"]', ['Both the amount and its date, or neither'], 'More terms opened on Save without the interim interest error')
  await fill(page, 'offer-interim', '')
  await pressSelector(page, press, '[data-testid="scenario-save"]')
  await toast(page, 'Scenario added')
  await dialogGone(page, '[data-testid="scenario-editor"]')
  const name = '€100,000.00 at 4% over 10 y'
  await elementSays(page, '[data-testid="scenario-list"]', [name], 'the new offer is not listed under its name from its figures')
  await dismissToasts(page)
  const added = await page.evaluate((wanted) => [...document.querySelectorAll('[data-testid="scenario-row"]')].find((row) => row.textContent?.includes(wanted))?.dataset.scenario ?? null, name)
  await pressSelector(page, press, `[data-testid="scenario-row"][data-scenario="${added}"] [data-testid="scenario-delete"]`)
  await toast(page, 'Scenario deleted')
  await dismissToasts(page)
}

/** Tries a rate of 3% from the next due date on the loan's page, saves it, and waits for it in Saved tries. Returns its line's title. */
async function saveRateTry(page, press, words) {
  await pressButton(page, press, '[data-testid="what-if-kind"] button', words.whatIf.kinds.rate)
  await fill(page, 'what-if-rate', '3')
  await page.waitForSelector('[data-testid="what-if-tried"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the rate change try shows no outcome')
  })
  await pressSelector(page, press, '[data-testid="what-if-save"]')
  const title = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('[data-testid="saved-tries"] [data-testid="change-line"] p:first-child')].map((line) => line.textContent?.trim() ?? '').find((text) => /3\s?%/.test(text)) ??
        null,
      { timeout: 10_000 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => {
      throw new Error('the saved rate change is not in Saved tries')
    })
  return title
}

/** The line of Saved tries with the title, its Delete pressed. */
async function deleteTry(page, press, title) {
  const button = await page
    .waitForFunction(
      (wanted) =>
        [...document.querySelectorAll('[data-testid="saved-tries"] [data-testid="change-line"]')]
          .find((entry) => entry.querySelector('p')?.textContent?.trim() === wanted)
          ?.querySelector('[data-testid="change-delete"]') ?? null,
      { timeout: 10_000 },
      title,
    )
    .then((handle) => handle.asElement())
  await button.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(button)
}

async function triesHold(page, title, held, failure) {
  await page
    .waitForFunction(
      (wanted, expected) => [...document.querySelectorAll('[data-testid="saved-tries"] [data-testid="change-line"] p:first-child')].some((entry) => entry.textContent?.trim() === wanted) === expected,
      { timeout: 10_000 },
      title,
      held,
    )
    .catch(() => {
      throw new Error(failure)
    })
}

/**
 * On a bank loan's page: a new rate from the next due date tried, saved at once, listed in Saved tries,
 * deleted, brought back with Undo and deleted again. Then a term change of 15 years, its box named
 * Term change for a screen reader, saved under that name in Saved tries and in its toast, and deleted.
 */
export function loansSavedTriesFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const title = await saveRateTry(page, press, words)
    const tries = await page.$('[data-testid="saved-tries"]')
    await shootAt(page, shoot, tries, 'loans-saved-tries', { block: 'start' })
    await dismissToasts(page)
    await deleteTry(page, press, title)
    await triesHold(page, title, false, 'Delete left the try in Saved tries')
    await toast(page, words.savedTries.deleted)
    await undoIn(page, press, words)
    await triesHold(page, title, true, 'Undo did not bring the try back')
    await dismissToasts(page)
    await deleteTry(page, press, title)
    await triesHold(page, title, false, 'the second Delete left the try in Saved tries')
    await dismissToasts(page)

    const term = words.whatIf.kinds.term
    await pressButton(page, press, '[data-testid="what-if-kind"] button', term)
    await fill(page, 'what-if-years', '15')
    await page.waitForSelector('[data-testid="what-if-tried"]', { visible: true, timeout: 10_000 })
    const box = await page.$eval('[data-testid="what-if-tried"]', (element) => element.getAttribute('aria-label'))
    if (box !== term) throw new Error(`the term change try's box is named "${box}", not "${term}"`)
    await pressSelector(page, press, '[data-testid="what-if-save"]')
    await toast(page, words.savedTries.saved)
    const termTitle = await page
      .waitForFunction(
        (kind) =>
          [...document.querySelectorAll('[data-testid="saved-tries"] [data-testid="change-line"] p:first-child')]
            .map((line) => line.textContent?.trim() ?? '')
            .find((text) => text.startsWith(`${kind}, `)) ?? null,
        { timeout: 10_000 },
        term,
      )
      .then((handle) => handle.jsonValue())
      .catch(() => {
        throw new Error(`the saved term change is not in Saved tries as ${term}`)
      })
    await elementSays(page, TOAST, [termTitle], 'the toast does not name the saved term change')
    await inspect?.('the term change saved in Saved tries')
    await dismissToasts(page)
    await deleteTry(page, press, termTitle)
    await triesHold(page, termTitle, false, 'Delete left the term change in Saved tries')
    await dismissToasts(page)
  }
}

export const loansSavedTriesFlow = loansSavedTriesFlowIn('en')

/**
 * Scenarios in a language: B unpicked and picked again, B made the base, B deleted and brought back
 * with Undo, the example typed into New scenario as an annuity and as equal principal, saved and
 * deleted, and on the bank loan's page a rate change saved as a try and deleted. Each state is
 * inspected, so the visual check reads its words.
 */
export function loansScenariosFlowIn(language, bankLoan) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(`${name}-${language}`)
    const toastShown = async (when) => {
      await page.waitForSelector(TOAST, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error(`no toast once ${when}`)
      })
      await delay(400)
      await inspect?.(when)
    }
    const { jadran, coastal, lighthouse } = SAMPLE_OFFERS
    await columnsAre(page, [jadran, coastal, lighthouse], 'Scenarios does not compare the three offers')
    await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${coastal}"]`)
    await columnsAre(page, [jadran, lighthouse], 'unpicking B did not take its column away')
    await inspect?.('Scenarios with B unpicked')
    await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${coastal}"]`)
    await chooseStartingWith(page, press, '[data-testid="scenario-base"]', 'B ·')
    await inspect?.('Scenarios against B')
    await shoot('loans-scenarios-base')
    await pressSelector(page, press, `[data-testid="scenario-row"][data-scenario="${coastal}"] [data-testid="scenario-delete"]`)
    await toastShown('an offer deleted')
    await undoIn(page, press, words)
    await dismissToasts(page)

    await typeTheExample(page, press)
    await page
      .waitForFunction(() => (document.querySelector('[data-testid="scenario-headline"]')?.textContent ?? '').trim() !== '', { timeout: 10_000 })
      .catch(() => {
        throw new Error('the foot of the scenario editor gives no headline')
      })
    await delay(200)
    await inspect?.('the new scenario with an annuity')
    await shoot('loans-scenario-editor')
    await pressButton(page, press, '[data-testid="offer-repayment"] button', words.repayments['equal-principal'])
    await pressSelector(page, press, '[data-testid="offer-more-toggle"]')
    await delay(300)
    await inspect?.('the new scenario with equal principal and More terms open')
    await shoot('loans-scenario-editor-more')
    await pressSelector(page, press, '[data-testid="scenario-save"]')
    await toastShown('an offer added')
    await dialogGone(page, '[data-testid="scenario-editor"]')
    await dismissToasts(page)
    const added = await page.evaluate(
      (known) => [...document.querySelectorAll('[data-testid="scenario-row"]')].map((row) => row.dataset.scenario).find((key) => !known.includes(key)) ?? null,
      [jadran, coastal, lighthouse],
    )
    await pressSelector(page, press, `[data-testid="scenario-row"][data-scenario="${added}"] [data-testid="scenario-delete"]`)
    await toastShown('the new offer deleted')
    await dismissToasts(page)

    await page.evaluate((loan) => {
      window.location.hash = `#/loans/bank-loan?loan=${loan}`
    }, bankLoan)
    await screenTitled(page, 'Home loan')
    const title = await saveRateTry(page, press, words)
    await toastShown('a rate change saved as a try')
    await shoot('loans-saved-tries')
    await dismissToasts(page)
    await deleteTry(page, press, title)
    await toastShown('a try deleted')
    await dismissToasts(page)
  }
}

/** Opens a dialog with `opener`, waits for `shown` in it, shoots it under `name`, opens each of its menus and closes it with Escape. */
async function lookAtDialog(page, press, shoot, opener, shown, name, says = null) {
  await pressSelector(page, press, opener)
  await page.waitForSelector(shown, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`${opener} opened no ${shown}`)
  })
  if (says !== null) await elementSays(page, shown, [says], `${shown} does not say "${says}"`)
  await delay(400)
  await shoot(name)
  await openEachMenuIn(page, press, shown)
  await page.keyboard.press('Escape')
  await dialogGone(page, shown)
}

/**
 * The Spending entry dialog opened on a file a newer Kuna saved: it opens with the reason at the top of its body, keeps Save off with no spinner,
 * and what was typed stays after the reason shows.
 */
export function newerFileDialogFlowIn(language) {
  return async (page, { press, shoot: shootAs }) => {
    await pressSelector(page, press, '[data-testid="spending-add-entry"]')
    await page.waitForSelector('[data-testid="dialog-changes-refused"]', { visible: true, timeout: 10_000 })
    const save = await page.$eval('[data-testid="spending-entry-save"]', (button) => ({ disabled: button.disabled, loading: button.querySelector('.animate-spin') !== null }))
    if (!save.disabled || save.loading) throw new Error(`Save is disabled=${save.disabled} and spinning=${save.loading} on a file a newer Kuna saved`)
    await delay(400)
    await shootAs(language === 'en' ? 'dialog-newer-file-entry' : `dialog-newer-file-entry-${language}`)
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="dialog-changes-refused"]')
  }
}

/** Moves to another screen of the app without a reload. */
async function goTo(page, hash, title) {
  await page.evaluate((target) => {
    window.location.hash = target
  }, hash)
  await screenTitled(page, title)
  await delay(300)
}

/**
 * Every Loans dialog with the sample file, opened and closed again: a new bank loan with and without
 * a subsidy, a new informal loan, each loan's own dialog, an informal loan's with its expected plan,
 * the dialog of each change of the bank loan, the subsidy's showing its payer, New scenario with More
 * terms closed and open, and an offer's editor.
 */
export function loansDialogsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await lookAtDialog(page, press, shoot, '[data-testid="add-informal-loan"]', '[data-testid="informal-loan-form"]', 'dialog-add-informal-loan')
    await lookAtDialog(page, press, shoot, '[data-testid="add-bank-loan"]', '[data-testid="bank-loan-form"]', 'dialog-add-bank-loan')
    await pressSelector(page, press, '[data-testid="add-bank-loan"]')
    await pressSelector(page, press, '[data-testid="bank-loan-more-toggle"]')
    await pressSelector(page, press, ':is([data-testid="bank-loan-subsidised"][role="switch"], [data-testid="bank-loan-subsidised"] [role="switch"])')
    await switchIs(page, 'bank-loan-subsidised', true)
    await delay(300)
    await shoot('dialog-add-bank-loan-subsidy')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="bank-loan-form"]')

    await openLoanCard(page, press, 'Home loan', words.overview)
    await lookAtDialog(page, press, shoot, '[data-testid="bank-loan-edit"]', '[data-testid="bank-loan-form"]', 'dialog-bank-loan')
    await pressSelector(page, press, '[data-testid="loan-subsidy"] [data-testid="change-edit"]')
    await page.waitForSelector('[data-testid="subsidy-form"]', { visible: true, timeout: 10_000 })
    const payer = await page.$eval('[data-testid="subsidy-payer"]', (input) => input.value)
    if (payer !== 'APN') throw new Error(`the subsidy dialog shows the payer "${payer}", not APN`)
    await delay(400)
    await shoot('dialog-subsidy-form')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="subsidy-form"]')
    for (const [card, form, says] of [
      ['rate-periods', 'rate-period-form', words.firstRateHelp],
      ['extra-payments', 'extra-payment-form', null],
      ['late-instalments', 'late-instalment-form', null],
    ]) {
      await lookAtDialog(page, press, shoot, `[data-testid="${card}"] [data-testid="change-edit"]`, `[data-testid="${form}"]`, `dialog-${form}`, says)
    }
    await lookAtDialog(page, press, shoot, '[data-testid="rate-periods"] [data-testid="change-add"]', '[data-testid="rate-period-form"]', 'dialog-add-rate-period', words.laterRateHelp)

    await openLoanCard(page, press, 'From Marko', words.overview)
    await lookAtDialog(page, press, shoot, '[data-testid="informal-loan-edit"]', '[data-testid="informal-loan-form"]', 'dialog-informal-loan')
    await lookAtDialog(page, press, shoot, '[data-testid="movement-edit"]', '[data-testid="movement-form"]', 'dialog-movement')
    await openLoanCard(page, press, 'To Petra', words.overview)
    await lookAtDialog(page, press, shoot, '[data-testid="informal-loan-edit"]', '[data-testid="informal-loan-form"]', 'dialog-informal-loan-plan', words.planFromHelp)

    await goTo(page, '#/loans/scenarios', words.scenarios)
    await lookAtDialog(page, press, shoot, '[data-testid="scenario-new"]', '[data-testid="scenario-editor"]', 'dialog-new-scenario')
    await pressSelector(page, press, '[data-testid="scenario-new"]')
    await page.waitForSelector('[data-testid="scenario-editor"]', { visible: true })
    await pressSelector(page, press, '[data-testid="offer-more-toggle"]')
    await delay(400)
    await shoot('dialog-new-scenario-more')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="scenario-editor"]')
    await lookAtDialog(
      page,
      press,
      shoot,
      `[data-testid="scenario-row"][data-scenario="${SAMPLE_OFFERS.coastal}"] [data-testid="scenario-edit"]`,
      '[data-testid="scenario-editor"]',
      'dialog-offer-editor',
    )
  }
}

export const loansDialogsFlow = loansDialogsFlowIn('en')

/** Opens the filter sheet of a phone, shoots it under `name` and closes it. A wider screen keeps its filters in a bar and has no sheet. */
async function lookAtSheet(page, press, shoot, opener, name) {
  const button = await page.$(opener)
  if (button === null || !(await button.evaluate((element) => element.getBoundingClientRect().width > 0))) return
  await press(button)
  await page.waitForSelector('[role="dialog"]', { visible: true, timeout: 10_000 })
  await delay(400)
  await shoot(name)
  await page.keyboard.press('Escape')
  await dialogGone(page, '[role="dialog"]')
}

/**
 * The dialogs and sheets of Transactions, its To review tab and Settings, Categories, opened and closed
 * again: a payment's split, a settled row's change of category with the rule it contradicts named,
 * the laptop's owner share, the filter sheets of a phone, a rule's editor, switching a rule off
 * with its back-test, and a row of the To review queue opened.
 */
export function rowsDialogsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSplitOfRow(page, press)
    await elementSays(page, '[role="dialog"]', [words.transactions.splitDialog.addTitle, words.splitEditor.addPart], 'the split dialog is not in its language')
    await shoot('dialog-split')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="split-form"]')
    await lookAtSheet(page, press, shoot, '[data-testid="open-filters"]', 'sheet-transaction-filters')

    await goTo(page, '#/company/transactions?p=all', words.transactions.title)
    for (const grouping of ['category', 'month']) {
      await choose(page, press, await page.$(`button[aria-label="${words.transactions.groupLabel}"]`), words.transactions.groupings[grouping])
      await page.waitForSelector('[data-testid="group-toggle"]', { visible: true, timeout: 10_000 })
      await shoot(`transactions-by-${grouping}`)
    }

    await goTo(page, '#/company/transactions?p=all&q=CODE%20HOST', words.transactions.title)
    await openChangeOfRow(page, press)
    await page.waitForSelector('[data-testid="change-category"]', { visible: true })
    await delay(400)
    await chooseCategory(page, press, await page.$('[data-testid="change-category-picker"]'), words.categoryName('office-supplies'))
    await page.waitForSelector('[data-testid="rule-against"]', { timeout: 5_000 }).catch(() => {
      throw new Error('the dialog does not name the rule that files the row elsewhere')
    })
    await elementSays(page, '[role="dialog"]', [words.transactions.changeDialog.title, words.transactions.changeDialog.ruleAgainst.before], 'the change of category is not in its language')
    await shoot('dialog-change-category')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="change-category"]')

    await goTo(page, '#/company/transactions?p=all&q=purchase%2C%20laptop', words.transactions.title)
    await openShareOfRow(page, press)
    await shoot('dialog-owner-share')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="owner-share"]')

    await goTo(page, '#/company/settings?tab=category-rules', words.companySettings)
    await editRule(page, press, 'merchant-airline')
    await elementSays(page, '[role="dialog"]', [words.rules.form.conditions, words.rules.editor.backtest], 'the rule editor is not in its language')
    await shoot('dialog-rule-editor')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[role="dialog"] [data-testid="rule-editor"]')
    const row = await ruleRowOf(page, 'merchant-airline')
    const toggle = await row.$('[role="switch"]')
    await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(toggle)
    await page.waitForSelector('[data-testid="save-rules-change"]', { visible: true, timeout: 10_000 })
    await elementSays(page, '[role="dialog"]', [words.rules.tab.switchOff], 'switching a rule off is not in its language')
    await delay(400)
    await shoot('dialog-rule-switch')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="save-rules-change"]')

    // The period in the address sets every filter afresh, so the laptop search from Transactions no longer narrows the queue.
    await goTo(page, '#/company/transactions?tab=review&p=l12', words.transactions.title)
    await pressSelector(page, press, '[data-testid="review-row"] button[aria-expanded]')
    await elementSays(page, '[data-testid="review-details"]', [words.transactions.review.item.rulesSay], 'the row of the queue is not in its language')
    await shoot('review-row-open')
    await lookAtSheet(page, press, shoot, '[data-testid="open-filters"]', 'sheet-review-filters')

    await goTo(page, '#/company/settings?tab=categories', words.companySettings)
    await lookAtSheet(page, press, shoot, '[data-testid="open-category-filters"]', 'sheet-category-filters')
  }
}

/**
 * Settings, Books file of a workbook kept in this browser, in a language: the switch of data source
 * with its warning and its three choices, and a file opened there with its summary, each closed again.
 */
export function dataSourceDialogsFlowIn(language, importFile) {
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="switch-source"]')
    await page.waitForSelector('[role="dialog"] [data-testid="data-source-choices"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Switch data source opened no choices')
    })
    if ((await page.$('[role="dialog"] [data-testid="data-source-choices"] [data-testid="download-template"]')) === null) throw new Error('Open a file offers no template download')
    await delay(400)
    await shoot('dialog-switch-source')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="data-source-choices"]')
    const input = await page.waitForSelector('[data-testid="data-source-card"] input[type="file"]', { timeout: 10_000 })
    await input.uploadFile(importFile)
    await page.waitForSelector('[role="dialog"] [data-testid="import-summary"] dl', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the file opened on Books file shows no summary')
    })
    await delay(400)
    await shoot('dialog-import-file')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="import-summary"]')
  }
}

/**
 * Invoicing's dialogs in a language, opened and closed again: a new invoice and a recorded one,
 * the invoice run's form, and on the Plan tab a new plan row, a recorded one and the fill of the year.
 */
export function invoicingDialogsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-add"]', '[data-testid="invoice-form"]', 'dialog-invoice', words.receivables.dialog.workFrom)
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-edit"]', '[data-testid="invoice-form"]', 'dialog-invoice-edit', words.receivables.dialog.periodHelp)
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-make"]', '[data-testid="invoice-run"]', 'dialog-invoice-run', words.invoicing.lines.title)
    await goTo(page, '#/company/invoicing?tab=plan', words.invoicing.title)
    await lookAtDialog(page, press, shoot, '[data-testid="billing-add"]', '[data-testid="billing-row-form"]', 'dialog-billing-row', words.billing.dialog.billableFrom)
    await lookAtDialog(page, press, shoot, '[data-testid="billing-row-edit"]', '[data-testid="billing-row-form"]', 'dialog-billing-row-edit', words.billing.dialog.descriptionHelp)
    await lookAtDialog(page, press, shoot, '[data-testid="billing-fill"]', '[data-testid="fill-preview"]', 'dialog-billing-fill')
  }
}

/**
 * The Company dialogs whose fields sit two to a row, opened and closed again in a language: an
 * invoice and the invoice run on Invoicing, a plan row, an owner advance, the plan dialogs of Year,
 * a pay scenario's component and a rule's editor.
 */
export function companyDialogsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-add"]', '[data-testid="invoice-form"]', 'dialog-invoice')
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-make"]', '[data-testid="invoice-run-number"]', 'dialog-invoice-run')
    await goTo(page, '#/company/invoicing?tab=plan', words.invoicing.title)
    await lookAtDialog(page, press, shoot, '[data-testid="billing-add"]', '[data-testid="billing-row-form"]', 'dialog-billing-row')
    await goTo(page, '#/company/owner?tab=owed', words.pack.screens.owner)
    await lookAtDialog(page, press, shoot, '[data-testid="advance-edit"]', '[data-testid="add-advance"]', 'dialog-advance')
    await goTo(page, '#/company/year?year=2027&tab=plan', words.pack.screens.year)
    await lookAtDialog(page, press, shoot, '[data-testid="plan-category"]:not([disabled])', '[data-testid="category-plan-form"]', 'dialog-category-plan')
    await lookAtDialog(page, press, shoot, '[data-testid="plan-add-purchase"]', '[data-testid="purchase-plan-form"]', 'dialog-purchase-plan')
    await lookAtDialog(page, press, shoot, ':is([data-testid="plan-add-dividend"], [data-testid="plan-dividend-row"])', '[data-testid="dividend-plan-form"]', 'dialog-dividend-plan')
    await goTo(page, '#/company/year?year=2027&tab=pay', words.pack.screens.year)
    await openCard(page, press, 'scenario-editor')
    await lookAtDialog(page, press, shoot, '[data-scenario="floor-salary"] [data-testid="scenario-add-component"]', '[data-testid="scenario-component-form"]', 'dialog-component')
    await goTo(page, '#/company/settings?tab=category-rules', words.companySettings)
    await editRule(page, press, 'merchant-airline')
    await shoot('dialog-rule')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[role="dialog"] [data-testid="rule-editor"]')
  }
}

export const companyDialogsFlow = companyDialogsFlowIn('en')

/**
 * A figure's build-up in a language: the button under `opener` opens it, it is looked at, and
 * Escape closes it again.
 */
export function buildUpFlowIn(language, opener) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(`${name}-${language}`)
    await pressSelector(page, press, opener)
    await page.waitForSelector('[data-testid="figure-detail"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error(`${opener} opened no build-up`)
    })
    // The dialog grows in, and its controls reach their size once it has.
    await delay(400)
    await inspect?.('the build-up')
    await shoot('build-up')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="figure-detail"]'), { timeout: 10_000 })
  }
}

/** The made-up share in US dollars of the sample Investments file. */
const SAMPLE_INVESTMENT_SHARE = 'fa4e1000-0000-4000-8000-000000000010'
const SAMPLE_WORLD_ETF = 'fa4e1000-0000-4000-8000-000000000012'

/** Presses the button inside `container` that reads `label`. */
async function pressLabelled(page, press, container, label) {
  const button = await page
    .waitForFunction((css, wanted) => [...document.querySelectorAll(`${css} button`)].find((element) => element.textContent?.trim() === wanted) ?? null, { timeout: 5_000 }, container, label)
    .catch(() => {
      throw new Error(`no button "${label}" in ${container}`)
    })
  await press(button.asElement())
  await delay(300)
}

/** A phone shows a dialog's end only once scrolled to, and a shot takes what is on the screen. */
async function scrollIntoDialogView(page, selector) {
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'end' }))
  await delay(200)
}

/**
 * The transaction dialogs of the sample Investments file: a buy of a holding and its summary added, changed, deleted and
 * brought back with Undo, a sale beyond what the account holds refused in words, a new holding added from inside
 * the dialog with a price entered by hand for it, and a fund's own mix kept from saving until its lines add up to 100%.
 */
export async function investmentsEditorFlow(page, { press, shoot, inspect }) {
  const rows = () => page.evaluate(() => document.querySelectorAll('[data-testid="transaction-row"]').length)
  const before = await rows()

  await pressSelector(page, press, '[data-testid="transactions-add"]')
  await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
  await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example Tech')
  await chooseStartingWith(page, press, '[data-testid="transaction-account"]', 'Broker One')
  await fill(page, 'transaction-quantity', '2')
  await fill(page, 'transaction-price', '160')
  await fill(page, 'transaction-fees', '1')
  await elementSays(page, '[data-testid="transaction-summary"]', ['You pay', '$321.00', 'Afterwards you hold', 'Average cost'], 'the summary does not say what the buy pays')
  await inspect?.('a buy with its summary')
  await scrollIntoDialogView(page, '[data-testid="transaction-summary"]')
  await shoot('investments-add-buy')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Buy added')
  await dialogGone(page, '[data-testid="transaction-form"]')
  if ((await rows()) !== before + 1) throw new Error('the buy is not listed')
  await dismissToasts(page)

  await pressSelector(page, press, '[data-testid="transaction-row"] [data-testid="transaction-edit"]')
  await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
  await fill(page, 'transaction-quantity', '3')
  await elementSays(page, '[data-testid="transaction-summary"]', ['$481.00'], 'the summary does not follow the changed units')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Buy saved')
  await elementSays(page, '[data-testid="transaction-row"]', ['3 units at $160.00'], 'the changed buy is not listed')
  await dismissToasts(page)

  await pressSelector(page, press, '[data-testid="transaction-row"] [data-testid="transaction-edit"]')
  await pressSelector(page, press, '[data-testid="transaction-delete"]')
  await toast(page, 'Buy deleted')
  if ((await rows()) !== before) throw new Error('the deleted buy is still listed')
  await undo(page, press)
  if ((await rows()) !== before + 1) throw new Error('Undo did not bring the buy back')
  await inspect?.('Transactions after Undo')
  await shoot('investments-undo-delete')
  await dismissToasts(page)

  await pressSelector(page, press, '[data-testid="transactions-add"]')
  await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
  await pressLabelled(page, press, '[data-testid="transaction-happened"]', 'Sell')
  await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example Tech')
  await chooseStartingWith(page, press, '[data-testid="transaction-account"]', 'Broker Two')
  await fill(page, 'transaction-quantity', '1')
  await fill(page, 'transaction-price', '170')
  await elementSays(page, '[data-testid="transaction-beyond-held"]', ['The account holds fewer units on'], 'the summary does not warn of a sale beyond what is held')
  await scrollIntoDialogView(page, '[data-testid="transaction-beyond-held"]')
  await shoot('investments-sale-beyond-held')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Not added')
  await elementSays(page, 'li[data-slot="base"]', ['The sale of "Example Tech" on', 'would sell more than its account holds that day'], 'the refusal does not say why')
  await dismissToasts(page)

  await pressLabelled(page, press, '[data-testid="transaction-happened"]', 'Price by hand')
  await pressSelector(page, press, '[data-testid="transaction-instrument-new"]')
  await page.waitForSelector('[data-testid="instrument-form"]', { visible: true })
  await fill(page, 'instrument-name', 'Example Bond Fund')
  await fill(page, 'instrument-symbol', 'EBF')
  await chooseStartingWith(page, press, '[data-testid="instrument-prices"]', 'Entered by hand')
  await inspect?.('the holding dialog over the transaction dialog')
  await shoot('investments-new-holding')
  await pressSelector(page, press, '[data-testid="instrument-save"]')
  await toast(page, 'Holding added')
  await dialogGone(page, '[data-testid="instrument-form"]')
  await dismissToasts(page)
  await elementSays(page, '[data-testid="transaction-instrument"]', ['Example Bond Fund'], 'the new holding is not picked')
  await fill(page, 'transaction-price', '10.25')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Price by hand added')
  await elementSays(page, '[data-testid="transaction-row"]', ['Example Bond Fund', '€10.25'], 'the hand price is not listed')
  await dismissToasts(page)

  await goTo(page, `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`, 'Example World ETF')
  await pressSelector(page, press, '[data-testid="holding-change"]')
  await page.waitForSelector('[data-testid="instrument-form"]', { visible: true })
  await pressLabelled(page, press, '[data-testid="instrument-mix-pick"]', 'By country or region')
  await pressSelector(page, press, '[data-testid="instrument-mix-add"]')
  await chooseStartingWith(page, press, '[data-testid="instrument-mix-line"]:last-child [data-testid="instrument-mix-group"]', 'Asia and Pacific')
  await setField(await page.$('[data-testid="instrument-mix-line"]:last-child [data-testid="instrument-mix-percent"]'), '5')
  await elementSays(page, '[data-testid="instrument-mix-sum"]', ['Adds up to 105%'], 'the mix does not add up what is typed')
  await pressSelector(page, press, '[data-testid="instrument-save"]')
  await elementSays(page, '[data-testid="instrument-mix-whole"]', ['Lines that add up to 100%'], 'a mix that does not add up is not marked')
  await scrollIntoDialogView(page, '[data-testid="instrument-mix-whole"]')
  await shoot('investments-fund-mix-not-whole')
  await setField(await page.$('[data-testid="instrument-mix-line"]:first-child [data-testid="instrument-mix-percent"]'), '65')
  await elementSays(page, '[data-testid="instrument-mix-sum"]', ['Adds up to 100%'], 'the mix does not add up to 100% once fixed')
  await pressSelector(page, press, '[data-testid="instrument-save"]')
  await toast(page, 'Holding saved')
  await dialogGone(page, '[data-testid="instrument-form"]')
  await dismissToasts(page)
}

/**
 * Every Investments dialog with the sample file, opened and closed again: the transaction dialog on each kind of
 * record, a transaction changed, a holding, a fund's own mix by sector and by country, and an account.
 */
export function investmentsDialogsFlowIn(language) {
  const croatian = language === 'hr'
  const kinds = croatian
    ? [
        ['Dividenda ili kamata', 'income'],
        ['Uplata', 'cash'],
        ['Konverzija', 'exchange'],
        ['Prijenos', 'transfer'],
        ['Podjela', 'split'],
        ['Izdvajanje', 'spin-off'],
        ['Ručna cijena', 'price'],
      ]
    : [
        ['Dividend or interest', 'income'],
        ['Deposit', 'cash'],
        ['Exchange', 'exchange'],
        ['Transfer', 'transfer'],
        ['Split', 'split'],
        ['Spin-off', 'spin-off'],
        ['Price by hand', 'price'],
      ]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await pressSelector(page, press, '[data-testid="transactions-add"]')
    await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
    await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example Tech')
    await delay(300)
    await shoot('dialog-investments-buy')
    for (const [label, name] of kinds) {
      await pressLabelled(page, press, '[data-testid="transaction-happened"]', label)
      await shoot(`dialog-investments-${name}`)
      if (name === 'transfer') {
        await pressLabelled(page, press, '[data-testid="transaction-moves"]', croatian ? 'Novac' : 'Cash')
        await scrollIntoDialogView(page, '[data-testid="transaction-amount"]')
        await shoot('dialog-investments-transfer-cash')
      }
    }
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="transaction-form"]')
    await lookAtDialog(page, press, shoot, '[data-testid="transaction-row"] [data-testid="transaction-edit"]', '[data-testid="transaction-form"]', 'dialog-investments-change')
    await goTo(page, `#/investments/holding?instrument=${SAMPLE_INVESTMENT_SHARE}`, 'Example Tech')
    await lookAtDialog(page, press, shoot, '[data-testid="holding-change"]', '[data-testid="instrument-form"]', 'dialog-investments-instrument')
    await goTo(page, `#/investments/holding?instrument=${SAMPLE_WORLD_ETF}`, 'Example World ETF')
    await pressSelector(page, press, '[data-testid="holding-change"]')
    await page.waitForSelector('[data-testid="instrument-mix"]', { visible: true })
    await scrollIntoDialogView(page, '[data-testid="instrument-mix"]')
    await shoot('dialog-investments-instrument-mix')
    await pressLabelled(page, press, '[data-testid="instrument-mix-pick"]', croatian ? 'Po državi ili regiji' : 'By country or region')
    await scrollIntoDialogView(page, '[data-testid="instrument-mix"]')
    await shoot('dialog-investments-instrument-mix-country')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="instrument-form"]')
    await goTo(page, `#/investments/holding?instrument=${SAMPLE_INVESTMENT_SHARE}`, 'Example Tech')
    await lookAtDialog(page, press, shoot, '[data-testid="holding-add-transaction"]', '[data-testid="transaction-form"]', 'dialog-investments-holding-buy')
    await goTo(page, '#/investments/settings', croatian ? 'Postavke' : 'Settings')
    await lookAtDialog(page, press, shoot, '[data-testid="account-edit"]', '[data-testid="account-form"]', 'dialog-investments-account')
    // The same account taking IBKR's mailed report asks its start day.
    await pressSelector(page, press, '[data-testid="account-edit"]')
    await page.waitForSelector('[data-testid="account-form"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="account-rows-from"] [data-value="mail"]')
    await page.waitForSelector('[data-testid="account-starts-on"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('an account taking the mailed report asks no start day')
    })
    await delay(300)
    await shoot('dialog-investments-account-mail')
    // A start day in a filed tax year is refused under the field once Save is pressed.
    await typeDay(await page.$('[data-testid="account-starts-on"]'), '2024-03-01')
    await pressSelector(page, press, '[data-testid="account-save"]')
    await elementSays(page, '[data-testid="account-form"]', ['2024'], 'the start day in a filed tax year is not refused under its field')
    await delay(300)
    await shoot('dialog-investments-account-filed')
    // A day after the account's last row by hand goes in, and the list says where its rows come from.
    await typeDay(await page.$('[data-testid="account-starts-on"]'), '2099-01-04')
    await pressSelector(page, press, '[data-testid="account-save"]')
    await dialogGone(page, '[data-testid="account-form"]')
    await elementSays(
      page,
      '[data-testid="investments-accounts"]',
      [croatian ? 'Izvješće IBKR-a poštom od' : 'IBKR report by mail from'],
      'the accounts list does not say the account takes the mailed report',
    )
    await shootAt(page, shoot, await page.$('[data-testid="investments-accounts"]'), 'investments-accounts-mail')
  }
}

export const investmentsDialogsFlow = investmentsDialogsFlowIn('en')

/** Waits for the screen header's line to hold the text, such as the prices fetch under way. */
async function headerSays(page, text, failure, timeout = 10_000) {
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="screen-title"]')?.parentElement?.querySelector('p')?.textContent?.includes(wanted) ?? false, { timeout }, text)
    .catch(async () => {
      const said = await page.evaluate(() => document.querySelector('[data-testid="screen-title"]')?.parentElement?.querySelector('p')?.textContent?.trim())
      throw new Error(`${failure}, it says: ${said ?? 'nothing'}`)
    })
}

/** Waits for the workbook import's dialog to show a step. */
async function importStep(page, step) {
  await page.waitForSelector(`[data-testid="workbook-import"][data-step="${step}"]`, { visible: true, timeout: 10_000 }).catch(async () => {
    const shown = await page.evaluate(() => document.querySelector('[data-testid="workbook-import"]')?.getAttribute('data-step'))
    throw new Error(`the workbook import shows ${shown ?? 'no'} step, not ${step}`)
  })
  await delay(300)
}

/** Opens the workbook import from the Overview and drops the made-up workbook on it. */
async function dropWorkbook(page, press, path) {
  await pressSelector(page, press, '[data-testid="investments-import"]')
  await importStep(page, 'file')
  await dropFile(page, path)
  await page.waitForSelector('[data-testid="import-loaded"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the workbook import did not read the made-up workbook')
  })
}

async function importSummarySays(page, text) {
  await elementSays(page, '[data-testid="import-dry-run-summary"]', [text], `the import's dry run does not say "${text}"`)
}

/** Steps through the workbook import to its dry run, past the steps a workbook already in Kuna leaves. */
async function toDryRun(page, press) {
  for (let step = 0; step < 4 && (await page.$('[data-testid="workbook-import"][data-step="dry-run"]')) === null; step += 1) {
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await delay(300)
  }
  await importStep(page, 'dry-run')
}

/**
 * The Investments import of the made-up workbook into an empty file with the fake prices: the file, the accounts, a
 * holding's guess opened, the spin-off's parent picked with its share proposed, the dry run with the debit interest
 * worth a look, and Import. Then either Undo takes it all back to the empty Overview, or the same workbook again adds
 * nothing and a copy with its first deposit edited shows the deposit in Kuna beside the edited one, kept unless ticked.
 */
export function investmentsImportFlowIn(language, { workbook: path, edited }, { undoing = false } = {}) {
  const croatian = language === 'hr'
  const text = croatian ? workbookImportCroatian : workbookImportEnglish
  const firstSummary = croatian ? 'Dodaje 21 zapis, a novo je: 3 računa i 4 pozicije.' : 'Adds 21 records, with 3 accounts and 4 holdings new.'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await page.waitForSelector('[data-testid="investments-empty"]', { visible: true, timeout: 10_000 })
    // A made-up Alpha Vantage key, so the fake vendor lists the made-up workbook's split.
    await page.evaluate(() => localStorage.setItem('kuna.secret.alphavantage', 'MADEUPKEY01'))
    await pressSelector(page, press, '[data-testid="investments-import"]')
    await importStep(page, 'file')
    if ((await page.$('[data-testid="import-template-download"]')) === null) throw new Error('the workbook import offers no template download')
    await inspect?.('the workbook import before a file')
    await shoot('investments-import-file')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="workbook-import"]')

    await dropWorkbook(page, press, path)
    await page.waitForSelector('[data-testid="import-listed-splits"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the workbook import lists no split Alpha Vantage found')
    })
    await inspect?.('the workbook read')
    await shoot('investments-import-file-read')
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await importStep(page, 'accounts')
    await inspect?.('the accounts step')
    await shoot('investments-import-accounts')
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await importStep(page, 'instruments')
    await pressSelector(page, press, '[data-testid="import-instrument-edit"]')
    await page.waitForSelector('[data-testid="import-instrument-name"]', { visible: true, timeout: 5_000 })
    await inspect?.('the holdings step with a guess open')
    await shoot('investments-import-instruments')
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await importStep(page, 'questions')
    await chooseStartingWith(page, press, '[data-testid="import-spin-off-parent"]', 'ABC')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="import-spin-off-share"]')?.value !== '', { timeout: 5_000 })
      .catch(() => {
        throw new Error('picking the parent proposed no cost share')
      })
    await inspect?.('the questions step')
    await shoot('investments-import-questions')
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    await importStep(page, 'dry-run')
    await importSummarySays(page, firstSummary)
    for (const group of ['new', 'waiting', 'skipped']) {
      if ((await page.$(`[data-testid="import-group-${group}"]`)) === null) throw new Error(`the dry run has no ${group} group`)
    }
    if ((await page.$('[data-testid="import-group-look"] [data-testid="import-reversals"]')) === null) throw new Error('the dry run does not list the debit interest worth a look')
    await inspect?.('the dry run')
    await shoot('investments-import-dry-run')
    // A made-up Twelve Data key, so the fetch after the import asks for NewCo and meets the fake vendor's minute limit once.
    await page.evaluate(() => localStorage.setItem('kuna.secret.twelvedata', 'made-up-twelve-data-key-0042'))
    await pressSelector(page, press, '[data-testid="workbook-import-confirm"]')
    await toast(page, text.imported)
    await dialogGone(page, '[data-testid="workbook-import"]')
    await page.waitForSelector('[data-testid="investments-cards"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the Overview shows no figures after the import')
    })
    await headerSays(
      page,
      croatian ? 'Twelve Data: dopušta 8 u minuti, čeka se' : 'Twelve Data allows 8 a minute, waiting',
      'the Overview does not say the fetch after the import waits for Twelve Data',
    )
    await inspect?.('the Overview fetching after the import')
    await shoot('investments-import-fetching')
    await headerSays(page, croatian ? 'Stanje na zatvaranju' : 'At the close of', 'the Overview does not go back to its close once the fetch after the import is done', 30_000)
    await inspect?.('the Overview after the import')

    if (undoing) {
      await undoIn(page, press, { writes: croatian ? writesCroatian : writesEnglish })
      await page.waitForSelector('[data-testid="investments-empty"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('Undo did not take the import back to the empty Overview')
      })
      await dismissToasts(page)
      await forgetImportKeys(page)
      return
    }
    await dismissToasts(page)
    await dropWorkbook(page, press, path)
    await toDryRun(page, press)
    await importSummarySays(page, text.dryRun.addsNothing)
    await inspect?.('the same workbook again')
    await shoot('investments-import-again')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="workbook-import"]')

    await dropWorkbook(page, press, edited)
    await toDryRun(page, press)
    await importSummarySays(page, croatian ? 'Dodaje 1 zapis.' : 'Adds 1 record.')
    const gone = await page.waitForSelector('[data-testid="import-gone"] [data-testid="import-gone-now"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the dry run does not show the edited deposit beside the one in Kuna')
    })
    await shootAt(page, shoot, gone, 'investments-import-edited')
    if ((await page.$('[data-testid="import-gone-kept"]')) === null) throw new Error('the edited deposit does not say that both count while it is kept')
    await pressSelector(page, press, '[data-testid="import-gone-delete"]')
    await importSummarySays(page, croatian ? 'Briše 1 zapis kojeg više nema u radnoj knjizi.' : 'It deletes 1 record gone from the workbook.')
    await page.waitForSelector('[data-testid="import-gone-kept"]', { hidden: true, timeout: 5_000 }).catch(() => {
      throw new Error('the edited deposit still says both count once it is ticked')
    })
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="workbook-import"]')
    await forgetImportKeys(page)
  }
}

/**
 * IBKR's report by mail on the sample: a sync reads two overlapping made-up mails, Overview offers the review, the first
 * asks for the account, and Accept writes it all with one Undo. With `?fake=flex-unseen` the kinds no real report has shown
 * stop and ask, one is left out for good, and with `?fake=flex-misfit` the step fails and Settings says why.
 */
export function investmentsMailFlowIn(language, variant = 'plain') {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await syncAndSettle(page, press)
    if (variant === 'misfit') {
      await page.goto(page.url().replace(/#.*$/, '#/investments/settings?tab=general#mail'), { waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="investments-mail"]', { visible: true, timeout: 10_000 })
      await syncAndSettle(page, press)
      await page.waitForSelector('[data-testid="investments-mail"] [data-testid="mail-entry"][data-entry="misfit"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the settings card does not say the report no longer fits')
      })
      await inspect?.('a report that does not fit')
      await shoot('investments-mail-misfit')
      return
    }
    const banner = await page.waitForSelector('[data-testid="mail-report-review"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the Overview offers no review after the sync read the report')
    })
    await shootAt(page, shoot, banner, `investments-mail-review-${variant}`)
    await pressSelector(page, press, '[data-testid="mail-report-open"]')
    await importStep(page, 'accounts')
    if (variant === 'typed') {
      // Two of the report's rows are typed by hand into Broker One, so Kuna suggests it.
      await page.waitForSelector('[data-testid="import-account-likely"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the accounts step does not say which account the rows look like')
      })
    } else {
      // A new account of the report asks from which day the report brings its rows.
      if ((await page.$('[data-testid="import-account-starts-on"]')) !== null) await shoot(`investments-mail-account-new-${variant}`)
      await chooseStartingWith(page, press, '[data-testid="import-account-choice"]', 'Broker One')
    }
    await inspect?.('the account of the report')
    await shoot(`investments-mail-account-${variant}`)
    await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    if (variant === 'typed') {
      await importStep(page, 'questions')
      const rows = await page.$$('[data-testid="import-look-alikes"] [data-testid="question"]')
      if (rows.length !== 2) throw new Error(`the questions step asks about ${rows.length} rows like records Kuna has, not 2`)
      await inspect?.('the rows like records Kuna has')
      await shoot('investments-mail-look-alikes')
      // The first row is the deposit Kuna has, and the second another withdrawal.
      const answer = async (row, button) => press((await page.$$(`[data-testid="import-look-alikes"] [data-testid="question"]:nth-child(${row}) [data-testid="question-choice"] button`))[button])
      await answer(1, 1)
      await answer(2, 2)
      await delay(300)
      const pressed = await page.$$eval('[data-testid="import-look-alikes"] [data-testid="question-choice"] button[aria-pressed="true"]', (buttons) =>
        buttons.map((button) => button.textContent.trim()),
      )
      if (pressed.length !== 2 || pressed[0] === pressed[1]) throw new Error(`the answers to the rows like records Kuna has did not hold: ${pressed.join(', ')}`)
      await inspect?.('the rows like records Kuna has, answered')
      await shoot('investments-mail-look-alikes-answered')
      await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    }
    if (variant === 'unseen') {
      await importStep(page, 'questions')
      const rows = await page.$$('[data-testid="import-asked"] [data-testid="question"]')
      // Each of the two mails adds six unseen rows on its own first day, so twelve rows are asked about, each once.
      if (rows.length !== 12) throw new Error(`the questions step asks about ${rows.length} rows, not 12`)
      await inspect?.('the rows not seen yet')
      await shoot('investments-mail-asked')
      const leaveOut = await page.$('[data-testid="import-asked"] [data-testid="question-choice"] button:last-child')
      if (leaveOut === null) throw new Error('a row not seen yet offers no way to leave it out')
      await press(leaveOut)
      await pressSelector(page, press, '[data-testid="workbook-import-next"]')
    }
    await importStep(page, 'dry-run')
    if ((await page.$('[data-testid="import-group-gone"]')) !== null) throw new Error('a rolling report lists records as gone')
    if ((await page.$('[data-testid="import-group-new"]')) === null) throw new Error('the review shows nothing new')
    if (variant === 'unseen' && (await page.$('[data-testid="import-group-asked"]')) === null) throw new Error('the review does not list the rows held back')
    await inspect?.('the review')
    await shoot(`investments-mail-dry-run-${variant}`)
    if (variant === 'typed') {
      const inKuna = await page.waitForSelector('[data-testid="import-group-in-kuna"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the review does not list the row matched to a record Kuna has')
      })
      await shootAt(page, shoot, inKuna, 'investments-mail-dry-run-typed-in-kuna', { block: 'start' })
    }
    await pressSelector(page, press, '[data-testid="workbook-import-confirm"]')
    await dialogGone(page, '[data-testid="workbook-import"]')
    if (variant === 'plain') {
      await page.waitForSelector('[data-testid="mail-report-review"]', { hidden: true, timeout: 10_000 }).catch(() => {
        throw new Error('the Overview still offers the review once it is accepted')
      })
      await inspect?.('the Overview after Accept')
      if (!croatian) {
        await undoIn(page, press, { writes: writesEnglish })
        await page.waitForSelector('[data-testid="mail-report-review"]', { visible: true, timeout: 10_000 }).catch(() => {
          throw new Error('Undo did not bring the review back')
        })
      }
    }
    await dismissToasts(page)
  }
}

/**
 * A Flex report saved by hand, dropped on Upload a report in the report's card: one that no longer fits says why, and the
 * made-up report opens the same review as a mailed one, whose Accept writes it with one Undo.
 */
export function investmentsMailUploadFlowIn(language, { flexReport, misfit }) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    const upload = await page.waitForSelector('[data-testid="mail-report-upload"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the card of the report offers no upload')
    })
    const input = await upload.$('input[type="file"]')
    await input.uploadFile(misfit)
    const failed = await page.waitForSelector('[data-testid="mail-report-upload-failed"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a report that does not fit did not say why')
    })
    await shootAt(page, shoot, failed, 'investments-mail-upload-misfit')
    await input.uploadFile(flexReport)
    await page.waitForSelector('[data-testid="workbook-import"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the uploaded report opened no review')
    })
    await delay(300)
    await inspect?.('the review of an uploaded report')
    await shoot('investments-mail-upload-review')
    await toDryRun(page, press)
    if ((await page.$('[data-testid="import-group-new"]')) === null) throw new Error('the review of the uploaded report shows nothing new')
    await shoot('investments-mail-upload-dry-run')
    await pressSelector(page, press, '[data-testid="workbook-import-confirm"]')
    await dialogGone(page, '[data-testid="workbook-import"]')
    await undoIn(page, press, { writes: croatian ? writesCroatian : writesEnglish })
    await dismissToasts(page)
  }
}

/** The report's card on the sample with the reader off: switched on, it says its filters are not confirmed. */
export function investmentsMailCardFlowIn(language) {
  const croatian = language === 'hr'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    const card = await page.waitForSelector('[data-testid="investments-mail"]', { visible: true, timeout: 10_000 })
    await card.evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await page.waitForSelector('[data-testid="investments-mail-senders"] input', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the card of the report did not open from its link')
    })
    if ((await page.$('[data-testid="investments-mail-unconfirmed"]')) === null) throw new Error('the card does not say its filters are not confirmed')
    await pressSelector(page, press, '[data-testid="investments-mail-on"]')
    await inspect?.('the card of the report, switched on')
    await shoot('investments-mail-card')
  }
}

/** Forgets the made-up keys the import flow kept, so the next flows at this width start without them and without a Keys step. */
async function forgetImportKeys(page) {
  await page.evaluate(() => {
    for (const vendor of ['alphavantage', 'twelvedata']) {
      localStorage.removeItem(`kuna.secret.${vendor}`)
      localStorage.removeItem(`kuna.secret-changed.${vendor}`)
    }
  })
}

export const ASSIST_WORDS = {
  en: { ...assistEnglish, keyRow: secretsEnglish.keyRow },
  hr: { ...assistCroatian, keyRow: secretsCroatian.keyRow },
}

const ANTHROPIC_ROW = '[data-testid="assist-card"] [data-provider="anthropic"]'
const OPENAI_ROW = '[data-testid="assist-card"] [data-provider="openai"]'
const OPENROUTER_ROW = '[data-testid="assist-card"] [data-provider="openrouter"]'
const COMPANY_SELECT = '[data-testid="assist-provider-select"]'
const ALWAYS_ALLOW = '[data-testid="assist-allow"]'
const APP_ALLOWED = '[data-testid="app-assist-card"] [data-testid="assist-allowed"]'
const CHAT_CONSENT = '[data-testid="chat-consent"]'

/** Opens the select of AI companies, and returns what each option says, by its company's name. */
export async function openCompanies(page, press) {
  const trigger = await page.$(COMPANY_SELECT)
  if (trigger === null) throw new Error('no select of AI companies')
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(150)
  await press(trigger)
  await page.waitForSelector('[role="option"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('the select of AI companies did not open')
  })
  return page.$$eval('[role="option"]', (options) => options.map((option) => option.textContent?.trim() ?? ''))
}

/** Picks an AI company from the select that is open, whose option starts with its name and goes on to say what it is. */
export async function pickCompany(page, press, name) {
  const option = await page.waitForFunction(
    (wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null,
    { timeout: 5_000 },
    name,
  )
  await press(option.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

/** Types a key into the open field and presses Save, the Test that follows answering by itself. */
async function saveTypedKey(page, press, row, key) {
  const input = await pressSelector(page, press, `${row} [data-testid="assist-key"]`)
  await input.type(key)
  const fieldType = await input.evaluate((element) => element.type)
  if (fieldType !== 'password') throw new Error(`the key field is type "${fieldType}", not password`)
  await pressSelector(page, press, `${row} [data-testid="assist-key-save"]`)
}

/** Presses Undo on the toast that says a key was removed. */
async function undoKeyRemoval(page, press, words) {
  await toast(page, words.keyRow.removed)
  const undo = await page
    .waitForFunction(
      (selector, label) => [...document.querySelectorAll(`${selector} button`)].find((element) => element.textContent?.trim() === label) ?? null,
      { timeout: 5_000 },
      TOAST,
      words.keyRow.undo,
    )
    .catch(() => {
      throw new Error('the toast of a removed key offers no Undo')
    })
  await press(undo.asElement())
}

/** Waits for the card's Test to end saying this. */
async function testLineSays(page, row, text, failure) {
  await page
    .waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted), { timeout: 10_000 }, `${row} [data-testid="assist-key-test-result"]`, text)
    .catch(() => {
      throw new Error(failure)
    })
}

/**
 * Kuna settings, the assistant's card: with no key it shows the steps and hides the model. A made-up Anthropic key typed
 * and saved shows only how it ends, closes its field, is tested by itself and becomes the pick. Replace opens the field
 * and Keep this key closes it. Opus 5.5 picked from the model field's suggestions stays picked in this browser, a typed
 * model with no price says so and Test shows the provider's refusal of it, an emptied field goes back to the default. OpenRouter
 * changes nothing until its key is saved, its id that turns on web search is refused and goes back to the default when
 * the field is left, and Remove with Undo puts a key back and then Remove forgets it.
 */
export async function assistKeyFlow(page, { press, shoot, inspect }) {
  const words = ASSIST_WORDS.en
  try {
    await page.waitForSelector(`${ANTHROPIC_ROW} [data-testid="assist-key-steps"]`, { visible: true, timeout: 10_000 })
    if (await page.$('[data-testid="assist-model"]')) throw new Error('the model field shows with no key')
    if (await page.$(ALWAYS_ALLOW)) throw new Error('Always allow shows with no key')
    await inspect?.('the card with no key')

    await saveTypedKey(page, press, ANTHROPIC_ROW, MADE_UP_ANTHROPIC_KEY)
    await elementSays(page, `${ANTHROPIC_ROW} [data-testid="assist-key-kept"]`, ['A key ending in 0042 is kept in this browser.'], 'Save did not keep the key')
    await testLineSays(page, ANTHROPIC_ROW, words.card.accepted('Anthropic'), 'Save did not test the key by itself')
    await page.waitForSelector('[data-testid="assist-key"]', { hidden: true, timeout: 5_000 }).catch(() => {
      throw new Error('the key field stays open after Save')
    })
    if (await page.$('[data-testid="assist-key-steps"]')) throw new Error('the steps stay once a key is saved')
    if (await page.$('[data-testid="assist-get-key"]')) throw new Error('Get a key stays once a key is saved and accepted')
    const shown = await page.evaluate((key) => document.body.innerText.includes(key) || [...document.querySelectorAll('input')].some((element) => element.value === key), MADE_UP_ANTHROPIC_KEY)
    if (shown) throw new Error('the whole key came back on screen after Save')
    const [kept, pick] = await page.evaluate(() => [localStorage.getItem('kuna.secret.anthropic'), localStorage.getItem('kuna.assist-provider')])
    if (kept !== MADE_UP_ANTHROPIC_KEY) throw new Error(`this browser keeps "${kept}" as the Anthropic key`)
    if (pick !== 'anthropic') throw new Error(`a saved and accepted key leaves "${pick}" as the pick`)
    await inspect?.('an Anthropic key saved and tested')
    await shoot('assist-key')

    await pressSelector(page, press, `${ANTHROPIC_ROW} [data-testid="assist-key-replace"]`)
    await page.waitForSelector(`${ANTHROPIC_ROW} [data-testid="assist-key"]`, { visible: true, timeout: 5_000 })
    await inspect?.('replacing a key')
    await pressSelector(page, press, `${ANTHROPIC_ROW} [data-testid="assist-key-keep"]`)
    await page.waitForSelector('[data-testid="assist-key"]', { hidden: true, timeout: 5_000 })

    const modelField = `${ANTHROPIC_ROW} [data-testid="assist-model"]`
    await choose(page, press, await page.$(modelField), 'claude-opus-5-5')
    const model = await page.evaluate(() => localStorage.getItem('kuna.assist-model.anthropic'))
    if (model !== 'claude-opus-5-5') throw new Error(`this browser keeps "${model}" as the Anthropic model, not claude-opus-5-5`)
    const shownModel = await page.$eval(modelField, (element) => element.value)
    if (shownModel !== 'claude-opus-5-5') throw new Error(`the model field shows "${shownModel}" after picking claude-opus-5-5`)
    await elementSays(page, ANTHROPIC_ROW, ['Opus 5.5'], 'the model field does not name Opus 5.5')
    await inspect?.('Opus 5.5 picked')

    const typedField = await pressSelector(page, press, modelField)
    await typedField.evaluate((element) => element.select())
    await typedField.type('claude-made-up-model')
    await page.keyboard.press('Escape')
    await elementSays(page, ANTHROPIC_ROW, ['Kuna knows no price for this model, so its runs say price unknown.'], 'a typed model does not say its price is unknown')
    const typed = await page.evaluate(() => localStorage.getItem('kuna.assist-model.anthropic'))
    if (typed !== 'claude-made-up-model') throw new Error(`this browser keeps "${typed}" as the typed model`)
    await pressSelector(page, press, `${ANTHROPIC_ROW} [data-testid="assist-key-test"]`)
    await testLineSays(page, ANTHROPIC_ROW, 'model: claude-made-up-model', "Test does not show the provider's refusal of a typed model")
    if (await page.$('[data-testid="assist-key"]')) throw new Error('a refused model opened the key field, though the key may be fine')
    await inspect?.('a typed model refused')

    const emptiedField = await pressSelector(page, press, modelField)
    await emptiedField.evaluate((element) => element.select())
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Escape')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-model.anthropic'))) !== null) throw new Error('an emptied model field did not go back to the default')

    await openCompanies(page, press)
    await pickCompany(page, press, 'OpenRouter')
    await elementSays(page, '[data-testid="assist-keeps-using"]', [words.card.keepsUsing('Anthropic', 'OpenRouter')], 'looking at a company with no key does not say the assistant stays')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'anthropic') throw new Error('looking at a company with no key moved the assistant')
    await inspect?.('OpenRouter on screen with no key')
    await saveTypedKey(page, press, OPENROUTER_ROW, 'made-up-openrouter-key-0042')
    await elementSays(
      page,
      `${ANTHROPIC_ROW} [data-testid="assist-saved-aside"]`,
      [words.card.accepted('OpenRouter'), words.card.savedKeepsUsing('OpenRouter', 'Anthropic')],
      'saving a key for another company does not say the assistant stays',
    )
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'anthropic') throw new Error('saving a key moved the assistant')
    await inspect?.("OpenRouter's key saved with Anthropic in use")
    await openCompanies(page, press)
    await pickCompany(page, press, 'OpenRouter')
    await page.waitForFunction(() => localStorage.getItem('kuna.assist-provider') === 'openrouter', { timeout: 5_000 })

    const searchingField = await pressSelector(page, press, `${OPENROUTER_ROW} [data-testid="assist-model"]`)
    await searchingField.evaluate((element) => element.select())
    await searchingField.type('made-up/model:online')
    await page.keyboard.press('Escape')
    await elementSays(
      page,
      OPENROUTER_ROW,
      ['This model id turns on web search, which Kuna keeps off, so runs stay on the default model.'],
      'a model id that turns on web search is not refused on the card',
    )
    await inspect?.('a model id that turns on web search refused')
    await searchingField.evaluate((element) => element.blur())
    await page
      .waitForFunction((selector) => document.querySelector(selector)?.value === 'anthropic/claude-sonnet-5-5', { timeout: 5_000 }, `${OPENROUTER_ROW} [data-testid="assist-model"]`)
      .catch(() => {
        throw new Error('the model field does not go back to the default after a refused id')
      })

    await pressSelector(page, press, `${OPENROUTER_ROW} [data-testid="assist-key-forget"]`)
    await page.waitForSelector(`${OPENROUTER_ROW}[data-kept="false"]`, { timeout: 5_000 }).catch(() => {
      throw new Error('Remove did not forget the key')
    })
    if ((await page.evaluate(() => localStorage.getItem('kuna.secret.openrouter'))) !== null) throw new Error('Remove left the key in this browser')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'openrouter') throw new Error('Remove moved the assistant to another saved key')
    await undoKeyRemoval(page, press, words)
    await page.waitForSelector(`${OPENROUTER_ROW}[data-kept="true"]`, { timeout: 5_000 }).catch(() => {
      throw new Error('Undo did not put the key back')
    })
    if ((await page.evaluate(() => localStorage.getItem('kuna.secret.openrouter'))) !== 'made-up-openrouter-key-0042') throw new Error('Undo put back another key')
  } finally {
    await forgetAssist(page)
  }
}

/** Whether a switch is on, as it tells a screen reader. */
function switchOn(page, selector) {
  return page.$eval(selector, (element) => element.getAttribute('aria-checked') === 'true')
}

/** Waits for a switch to say this state, as it tells a screen reader. */
async function switchSays(page, selector, on, failure) {
  await page
    .waitForFunction((css, wanted) => document.querySelector(css)?.getAttribute('aria-checked') === wanted, { timeout: 5_000 }, selector, String(on))
    .catch(() => {
      throw new Error(failure)
    })
}

/** Goes to a route of the page without loading it again, and waits for what it should show. */
export async function goToRoute(page, hash, ready) {
  await page.evaluate((target) => {
    window.location.hash = target
  }, hash)
  await page.waitForSelector(ready, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`${hash} does not show ${ready}`)
  })
  await delay(200)
}

/**
 * Company's Assistant tab with a made-up key kept says the chat asks, and links Kuna settings, whose Always allow turned on
 * stays on after a reload and shows on the tab, and turned off again forgets the choice.
 */
export async function assistSwitchFlow(page, { press, shoot, inspect }) {
  const words = ASSIST_WORDS.en
  try {
    await keepAiKey(page)
    await page.waitForSelector(`${APP_ALLOWED}[data-allowed="false"]`, { visible: true, timeout: 10_000 })
    await elementSays(page, APP_ALLOWED, [words.card.allowOff('Anthropic')], 'the tab does not say the chat asks')
    await pressSelector(page, press, '[data-testid="assist-allow-link"]')
    await page.waitForSelector(ALWAYS_ALLOW, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the tab did not lead to Always allow in Kuna settings')
    })
    if (await switchOn(page, ALWAYS_ALLOW)) throw new Error('Always allow is on before it was switched on')
    await pressSelector(page, press, ALWAYS_ALLOW)
    await switchSays(page, ALWAYS_ALLOW, true, 'Always allow did not turn on')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== 'on') throw new Error('this browser does not keep Anthropic allowed')
    await elementSays(page, '[data-testid="assist-card"]', [words.card.allowOn('Anthropic')], 'Always allow does not say what it allows')
    await inspect?.('Always allow on')
    await shoot('assist-switch')

    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector(ALWAYS_ALLOW, { visible: true, timeout: 10_000 })
    if (!(await switchOn(page, ALWAYS_ALLOW))) throw new Error('Always allow is off again after a reload')
    await goToRoute(page, '#/company/settings?tab=assistant', `${APP_ALLOWED}[data-allowed="true"]`)
    await elementSays(page, APP_ALLOWED, [words.card.allowOn('Anthropic')], 'the tab does not follow Always allow')
    await inspect?.('the Assistant tab with Always allow on')

    await goToRoute(page, '#/settings', ALWAYS_ALLOW)
    await pressSelector(page, press, ALWAYS_ALLOW)
    await switchSays(page, ALWAYS_ALLOW, false, 'Always allow did not turn off')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('switching Always allow off left the choice in this browser')
  } finally {
    await forgetAssist(page)
  }
}

/**
 * The Assistant tab and Kuna settings over one state: with no key the tab says what could be done and links to Kuna
 * settings, and with a key the tab says whether the chat asks and links Always allow there. Spending's tab says the same.
 */
export function assistTabFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const companyName = (language === 'en' ? companyEnglish : companyCroatian).name
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await page.waitForSelector('[data-testid="assist-add-key"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the tab with no key does not link to Kuna settings')
      })
      if (await page.$(APP_ALLOWED)) throw new Error('the tab says whether the chat asks with no key')
      await elementSays(page, '[data-testid="app-assist-card"]', [words.appCard.addKey], 'the tab with no key does not offer to add one')
      await inspect?.('the Assistant tab with no key')
      await pressSelector(page, press, '[data-testid="assist-add-key"]')
      await page.waitForSelector('[data-testid="assist-card"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the link did not open Kuna settings')
      })

      await keepAiKey(page)
      await page.waitForSelector(ALWAYS_ALLOW, { visible: true, timeout: 10_000 })
      if (await switchOn(page, ALWAYS_ALLOW)) throw new Error('Always allow is on with nothing allowed')
      await elementSays(page, '[data-testid="assist-card"]', [words.card.allow, words.card.allowOff('Anthropic')], 'Always allow does not say the chat asks')
      await inspect?.('Always allow in Kuna settings')
      await shoot('assist-allow')

      await goToRoute(page, '#/company/settings?tab=assistant', APP_ALLOWED)
      await elementSays(
        page,
        '[data-testid="app-assist-card"]',
        [words.card.allowOff('Anthropic'), words.appCard.change, words.appCard.chatTitle, words.appCard.chatSends(companyName)],
        'the tab does not say whether the chat asks and what it reads',
      )
      await inspect?.("Company's Assistant tab")
      await shoot('assist-tab')

      await pressSelector(page, press, '[data-testid="assist-allow-link"]')
      await page.waitForSelector(ALWAYS_ALLOW, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the tab did not link Kuna settings')
      })
      await pressSelector(page, press, ALWAYS_ALLOW)
      await switchSays(page, ALWAYS_ALLOW, true, 'Always allow did not turn on')
      await goToRoute(page, '#/spending/settings?tab=assistant', `${APP_ALLOWED}[data-allowed="true"]`)
      await elementSays(page, APP_ALLOWED, [words.card.allowOn('Anthropic')], "Spending's tab does not follow Always allow")
      await inspect?.("Spending's Assistant tab")
      await shoot('assist-tab-spending')
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * With no pick stored and OpenAI's key kept, as an older Kuna left a browser, a key saved for Anthropic stays aside, and
 * the assistant stays on OpenAI until Anthropic is picked on the select.
 */
export async function assistSaveKeepsCompanyFlow(page, { press, inspect }) {
  const words = ASSIST_WORDS.en
  try {
    await page.evaluate(() => localStorage.setItem('kuna.secret.openai', 'made-up-openai-key-0077'))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector(`${OPENAI_ROW} [data-testid="assist-key-kept"]`, { visible: true, timeout: 10_000 })
    await openCompanies(page, press)
    await pickCompany(page, press, 'Anthropic')
    await saveTypedKey(page, press, ANTHROPIC_ROW, MADE_UP_ANTHROPIC_KEY)
    await elementSays(page, `${OPENAI_ROW} [data-testid="assist-saved-aside"]`, [words.card.savedKeepsUsing('Anthropic', 'OpenAI')], 'a key saved aside does not say the assistant stays')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'openai') throw new Error('saving a key moved the assistant')
    await inspect?.('a key saved aside')
    await openCompanies(page, press)
    await pickCompany(page, press, 'Anthropic')
    await elementSays(page, `${ANTHROPIC_ROW} [data-testid="assist-moved"]`, [words.card.nowSends('Anthropic'), words.card.otherKept('OpenAI')], 'a pick on the select does not say what it did')
  } finally {
    await forgetAssist(page)
  }
}

/** The chat with no key and with one, walked as a person would: ask, answer the dialog, follow the link, then the same in another app. */
export function chatPanelFlowIn(language) {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const send = (message) => sendInChat(page, press, message)
    const wide = async () => layoutOf({ choice: 'expanded', windowWidth: await shellRoom(page), chat: CHAT_MIN_WIDTH }).chat.at === 'dock'
    const greeting = language === 'en' ? 'Hello' : 'Dobar dan'
    try {
      if (await page.$('[data-testid="chat-open"]')) throw new Error('the chat button shows with no key')
      await keepAiKey(page)

      if (!(await wide())) {
        const scrolledTo = async (how) => {
          await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 })
          await delay(300)
          const scrollY = await page.evaluate(() => window.scrollY)
          if (Math.abs(scrollY - 200) > 2) throw new Error(`closing the pane by ${how} left the page at ${scrollY}, not 200`)
        }
        const openFromPlace = async () => {
          await page.evaluate(() => window.scrollTo(0, 200))
          await delay(100)
          await (await page.waitForSelector('[data-testid="chat-open"]', { visible: true })).evaluate((button) => button.click())
          await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
        }
        await openFromPlace()
        await pressSelector(page, press, '[data-testid="chat-close"]')
        await scrolledTo('its close button')
        await openFromPlace()
        await pressSelector(page, press, '[data-testid="chat-open"]')
        await scrolledTo('the chat button')
        await openFromPlace()
        await page.goBack()
        await scrolledTo('Back')
      }

      await pressSelector(page, press, '[data-testid="chat-open"]')
      await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
      const half = await pressSelector(page, press, 'textarea[data-testid="chat-prompt"]')
      await half.type('half')
      await pressSelector(page, press, '[data-testid="chat-close"]')
      await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 })
      await pressSelector(page, press, '[data-testid="chat-open"]')
      const kept = await page.waitForSelector('textarea[data-testid="chat-prompt"]', { visible: true, timeout: 10_000 })
      if ((await kept.evaluate((field) => field.value)) !== 'half') throw new Error('closing the panel lost a half-typed question')
      await kept.evaluate((field) => field.select())
      await page.keyboard.press('Backspace')
      await elementSays(page, '[data-testid="chat-label"]', [words.chat.inApp(language === 'en' ? spendingAppEnglish.name : spendingAppCroatian.name)], 'the panel does not name the app on screen')
      await elementSays(page, '[data-testid="chat-empty"]', [words.chat.emptyReads, words.chat.emptyAsks], 'the empty panel does not say what it can do')
      if (!(await wide()) && (await page.$eval('main', (element) => element.offsetParent !== null))) throw new Error('the page stays on screen behind the pane')
      await inspect?.('the empty chat')
      await shoot('chat-empty')

      await send(language === 'en' ? 'How do I set up rules for my bank?' : 'Kako da postavim pravila za svoju banku?')
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the send did not ask with the switch off')
      })
      await elementSays(
        page,
        CHAT_CONSENT,
        [words.chat.sends, words.chat.aliases, words.retention.anthropic, words.chat.allowAlwaysNote, words.chat.allowInChat, words.chat.allowAlways('Anthropic')],
        'the card does not say what leaves and what the company keeps',
      )
      if (await page.$('[role="dialog"]')) throw new Error('the chat asked in a dialog')
      await delay(400)
      await inspect?.('the card before a chat sends')
      await shoot('chat-consent')
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('asking changed the switch')
      const promptFocusAfter = async (how) => {
        await delay(200)
        const focused = await page.evaluate(() => document.activeElement?.matches('textarea[data-testid="chat-prompt"]') === true)
        const phone = await page.evaluate(() => window.innerWidth < 640)
        if (focused === phone) throw new Error(phone ? `${how} on the card opened a phone's keyboard` : `${how} on the card did not bring focus back to the prompt`)
      }
      await pressSelector(page, press, '[data-testid="chat-allow-cancel"]')
      await page.waitForSelector(CHAT_CONSENT, { hidden: true, timeout: 5_000 })
      await promptFocusAfter('Cancel')
      await pressSelector(page, press, '[data-testid="chat-send"]')
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector(CHAT_CONSENT, { hidden: true, timeout: 5_000 })
      await promptFocusAfter('Allow')
      await page.waitForSelector('[data-testid="chat-chip"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the answer brought no link to the screen')
      })
      await elementSays(page, '[data-testid="chat-answer"]', [language === 'en' ? 'To review' : 'Za pregled'], 'the answer did not come through')
      await elementSays(page, '[data-testid="chat-spent"]', [words.chat.spent('').trim()], 'the panel shows no cost')
      await inspect?.('an answer with a link')
      await shoot('chat-answer')

      await send(language === 'en' ? 'crypto?' : 'kripto?')
      await page
        .waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        .catch(() => {
          throw new Error('the chat gave no answer about what Kuna cannot do')
        })
      if (await page.$(CHAT_CONSENT)) throw new Error('a second message of a chat asked again')
      if ((await page.$('[data-testid="chat-issues"]')) !== null) throw new Error('the chat linked the issues page for what Kuna cannot do, unasked')
      await send(language === 'en' ? 'How do I ask for a feature?' : 'Kako zatražiti novu značajku?')
      const issues = await page.waitForSelector('[data-testid="chat-issues"]', { visible: true, timeout: 15_000 })
      const address = await issues.evaluate((element) => element.getAttribute('href'))
      if (address !== 'https://github.com/ipazanin/kuna/issues') throw new Error(`the issues link goes to ${address}`)
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('a yes for this chat changed the switch')
      await inspect?.('asked how to request a feature, with the issues link')
      await shoot('chat-issues')

      await pressSelector(page, press, '[data-testid="chat-new"]')
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 })
      await send(greeting)
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('a new chat did not ask again')
      })
      await pressSelector(page, press, '[data-testid="chat-allow-always"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== 'on') throw new Error('Always allow left the switch off')

      await pressSelector(page, press, '[data-testid="chat-new"]')
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 })
      await send(language === 'en' ? 'And the rules?' : 'A pravila?')
      await page.waitForSelector('[data-testid="chat-chip"]', { visible: true, timeout: 15_000 })
      if (await page.$(CHAT_CONSENT)) throw new Error('a new chat asked with Always allow on')
      if ((await page.$('[data-status="ready"] [data-testid="chat-answer"]')) === null)
        throw new Error('the link showed before its answer was whole, so the text landing above it moves it from under a tap')
      await pressSelector(page, press, '[data-testid="chat-chip"]')
      await page
        .waitForFunction(() => window.location.hash.startsWith('#/spending/settings?tab=rules'), { timeout: 10_000 })
        .catch(async () => {
          throw new Error(`the link did not lead to the rules but to ${await page.evaluate(() => window.location.hash)}`)
        })
      if (await wide()) {
        await page.waitForSelector('[data-testid="chat-dock"]', { visible: true, timeout: 5_000 })
        await inspect?.('the dock beside the screen a link opened')
        // The narrowest window that docks the chat beside the expanded sidebar leaves the page its least, 640 px.
        const narrowest = SIDEBAR_WIDTH.expanded + PAGE_LEAST_WIDTH + CHAT_MIN_WIDTH
        await page.setViewport({ ...page.viewport(), width: narrowest + (await scrollbarGutter(page)) })
        await delay(300)
        await inspect?.('the dock at the narrowest width it docks')
        const drawn = await page.evaluate(() => ({ sidebar: document.querySelector('[data-testid="app-shell"]')?.dataset.sidebar, dock: document.querySelector('[data-testid="chat-dock"]') !== null }))
        if (drawn.sidebar !== 'expanded' || !drawn.dock) throw new Error(`at ${narrowest} px the shell drew ${JSON.stringify(drawn)}, not the expanded sidebar beside the docked chat`)
        await page.focus('[data-testid="sync-button"], [data-testid="chat-open"]')
        await shoot(`chat-dock-${narrowest}`)
        await page.setViewport({ ...page.viewport(), width: 1440 })
      } else {
        await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 }).catch(() => {
          throw new Error('a link left the pane over the screen it opened')
        })
        await inspect?.('the screen a link opened from the pane')
        await pressSelector(page, press, '[data-testid="chat-open"]')
        await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 5_000 })
        await page.goBack()
        await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 }).catch(() => {
          throw new Error('Back did not close the pane')
        })
        await pressSelector(page, press, '[data-testid="chat-open"]')
      }
      await elementSays(page, '[data-testid="chat-question"]', [language === 'en' ? 'And the rules?' : 'A pravila?'], 'the chat did not stay in memory')
      await pressSelector(page, press, '[data-testid="chat-new"]')
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 })
      await savedChatGone(page)
      await pressSelector(page, press, '[data-testid="chat-close"]')
      await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 })
    } finally {
      await forgetAssist(page)
    }
  }
}

/** The made-up person the people set pays, and that payment in cents. */
const PERSON_PAYEE = 'Ana Horvat'
const PERSON_PAYEE_CENTS = -25000

/** Taps the button in an open entry dialog that treats its payee as a person, and waits for the write. */
async function treatSpendingPayeeAsPerson(page, press, dialog) {
  await pressSelector(page, press, '[data-testid="spending-entry-treat-payee"]')
  await toast(page, dialog.treatedAsPerson)
  await elementSays(page, '[data-testid="spending-entry-person"]', [dialog.asCompany], 'the entry dialog does not offer to treat the payee as a shop or company again')
}

/**
 * On the people set's Transactions: Ana Horvat's entry offers to treat her as a person, and the tap saves the flag and
 * offers the way back.
 */
export function spendingFlagPersonFlowIn(language) {
  const { dialog } = SCREEN_WORDS[language].spendingEntries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, PERSON_PAYEE, PERSON_PAYEE_CENTS)
    if (await page.$('[data-testid="spending-entry-person"]')) throw new Error('the entry dialog offers the person flag with no AI key kept')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await keepAiKey(page)
    try {
      await flagSpendingPayee(page, press, dialog, shoot, inspect)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Opens the flagged payee's entry, shoots the flag before and after its tap, and closes the dialog. */
async function flagSpendingPayee(page, press, dialog, shoot, inspect) {
  await openSpendingRow(page, press, PERSON_PAYEE, PERSON_PAYEE_CENTS)
  await elementSays(page, '[data-testid="spending-entry-person"]', [dialog.asPerson, dialog.asPersonHelp], 'the entry dialog does not offer to treat the payee as a person')
  await shootAt(page, shoot, '[data-testid="spending-entry-person"]', 'spending-flag-person')
  await treatSpendingPayeeAsPerson(page, press, dialog)
  await inspect?.('the entry dialog with its payee flagged as a person')
  await shoot('spending-flag-person-done')
  await page.keyboard.press('Escape')
  await dialogGone(page, SPENDING_ENTRY_DIALOG)
}

/** On the To review tab, a row of the queue opened offers to treat its counterparty as a person, and the tap saves the flag and offers the way back. */
export function reviewFlagPersonFlowIn(language) {
  const { review } = SCREEN_WORDS[language].transactions
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await keepAiKey(page)
    try {
      await flagReviewCounterparty(page, press, review, shoot, inspect)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Opens a queue row, shoots the flag before and after its tap. */
async function flagReviewCounterparty(page, press, review, shoot, inspect) {
  const row = await queueRow(page, 'SNACK KIOSK')
  await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(row)
  await page.waitForSelector('[data-testid="review-details"] [data-testid="review-person"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('the opened row does not offer to treat its counterparty as a person')
  })
  await elementSays(page, '[data-testid="review-person"]', [review.item.asPerson, review.item.asPersonHelp], 'the opened row does not offer to treat its counterparty as a person')
  await shootAt(page, shoot, '[data-testid="review-person"]', 'review-flag-person')
  await pressSelector(page, press, '[data-testid="treat-counterparty"]')
  await toast(page, review.treatedAsPerson)
  await elementSays(page, '[data-testid="review-person"]', [review.item.asCompany], 'the row does not offer to treat its counterparty as a shop or company again')
  await inspect?.('a row of the queue with its counterparty flagged as a person')
  await shoot('review-flag-person-done')
}

/**
 * A question about figures with Ana Horvat flagged as a person on her entry: the one card covers sending and reading every
 * app, the answer shows Kuna's figure and her real name, the row under it opens to the exact text with her alias and her IBAN
 * masked, an invented amount is flagged, a read from the home asks nothing more, and with Anonymise off for Anthropic her
 * name goes as written while the IBAN stays masked.
 */
export function chatReadFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const { dialog } = SCREEN_WORDS[language].spendingEntries
  const question = language === 'en' ? 'What did I spend?' : 'Koliko sam potrošio?'
  const alias = language === 'en' ? 'Person 1' : 'Osoba 1'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const send = () => sendInChat(page, press, question)
    const startOver = async () => {
      await pressSelector(page, press, '[data-testid="chat-new"]')
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 })
    }
    const textsSent = () => page.$$eval('[data-testid="chat-sent-text"]', (elements) => elements.map((element) => element.textContent ?? '').join('\n'))
    const openRows = async () => {
      for (const toggle of await page.$$('[data-testid="chat-sent-toggle"]')) await press(toggle)
      await page.waitForSelector('[data-testid="chat-sent-text"]', { visible: true, timeout: 5_000 })
    }
    try {
      await keepAiKey(page)
      await page.evaluate(() => {
        window.location.hash = '#/spending/transactions'
      })
      await openSpendingRow(page, press, PERSON_PAYEE, PERSON_PAYEE_CENTS)
      await treatSpendingPayeeAsPerson(page, press, dialog)
      await page.keyboard.press('Escape')
      await dialogGone(page, SPENDING_ENTRY_DIALOG)
      await dismissToasts(page)
      await openChat(page, press)
      await send()
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await elementSays(page, CHAT_CONSENT, [words.chat.sends, words.chat.aliases], 'the card does not say the chat reads the apps, with aliases')
      await delay(400)
      await inspect?.('the card that lets the chat read')
      await shoot('chat-grant')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await elementSays(page, '[data-testid="chat-answer"]', ['Ana Horvat'], 'the answer does not show the real name')
      if ((await page.$eval('[data-testid="chat-answer"]', (element) => element.textContent)).includes(alias)) throw new Error('the answer shows an alias on screen')
      await page.waitForSelector('[data-testid="chat-figure"]', { visible: true, timeout: 5_000 })
      if (await page.$(CHAT_CONSENT)) throw new Error('the yes on the first send did not cover the read')
      if (await page.$('[data-testid="chat-stray"]')) throw new Error("Kuna's own figure was flagged")
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('a yes for this chat changed the switch')
      await inspect?.('an answer from what the chat read')
      await shoot('chat-read-answer')

      await openRows()
      const sent = await textsSent()
      if (!sent.includes(alias) || !sent.includes('HR•• ••••0160')) throw new Error(`the exact text holds no alias or masked IBAN: ${sent.slice(0, 300)}`)
      if (sent.includes('Horvat') || sent.includes('HR1210010051863000160')) throw new Error('a name flagged as a person or a whole IBAN went with Anonymise on')
      await elementSays(page, '[data-testid="chat-sent-text"]', ['ignore your rules'], 'the hostile row did not go as data')
      await inspect?.('the exact text sent')
      await shoot('chat-sent-open')

      await page.evaluate(() => window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}&ai=invented-figure${window.location.hash}`))
      await send()
      await page.waitForSelector('[data-testid="chat-stray"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('an amount no tool gave was not flagged')
      })
      await elementSays(page, '[data-testid="chat-stray"]', [words.answer.strayFigure], 'the flag does not say what it means')
      await inspect?.('an answer with an amount Kuna did not compute')
      await shoot('chat-stray')
      await page.evaluate(() => window.history.replaceState(null, '', `${window.location.pathname}${window.location.search.replace('&ai=invented-figure', '')}${window.location.hash}`))

      await startOver()
      await page.evaluate(() => {
        window.location.hash = '#/'
      })
      await page.waitForFunction(() => window.location.hash === '#/' || window.location.hash.startsWith('#/?'), { timeout: 5_000 })
      await delay(300)
      await openChat(page, press)
      await send()
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await elementSays(page, CHAT_CONSENT, [words.chat.sends], 'outside an app the card does not say the chat reads the apps')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-sent"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the one yes on the home did not cover reading Spending')
      })
      if (await page.$(CHAT_CONSENT)) throw new Error('a read outside the app on screen asked again')
      await page.waitForSelector('[data-status="ready"] [data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await inspect?.('a read from the home under the one yes')

      await startOver()
      await savedChatGone(page)
      await page.evaluate(() => localStorage.setItem('kuna.assist-anonymise', 'anthropic'))
      await page.evaluate(() => {
        window.location.hash = '#/spending'
      })
      await page.reload({ waitUntil: 'networkidle0' })
      await openChat(page, press)
      if (await page.$('[data-testid="chat-note"]')) throw new Error('a chat cleared with New chat came back after a reload')
      await send()
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await elementSays(page, CHAT_CONSENT, [words.chat.noAliases('Anthropic')], 'the card does not say names go as written with Anonymise off')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page
        .waitForFunction(() => document.querySelectorAll('[data-testid="chat-sent-toggle"]').length === 2, { timeout: 15_000 })
        .catch(() => {
          throw new Error('with Anonymise off the chat did not read the figures and the rows')
        })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await openRows()
      const open = await textsSent()
      if (!open.includes(PERSON_PAYEE)) throw new Error(`with Anonymise off the name did not go as written: ${open.slice(0, 300)}`)
      if (open.includes('HR1210010051863000160') || !open.includes('HR•• ••••0160')) throw new Error('with Anonymise off the IBAN did not go masked')
      await startOver()
      await savedChatGone(page)
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * A proposal from a quick action: the card shows what would change and writes nothing, Accept is one write with Undo, and
 * a reload leaves the outcome and aliases with no note, as the chat goes on with the assistant still seeing the messages.
 */
export function chatProposeFlowIn(language) {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const rulesHeld = () => page.evaluate(() => document.querySelector('[data-testid="chat-proposal"]')?.dataset.state)
    try {
      await keepAiKey(page)
      await pressSelector(page, press, '[data-testid="chat-open"]')
      await page.waitForSelector('[data-testid="chat-quick-action"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the empty chat offers no quick action')
      })
      await inspect?.('the empty chat with its quick actions')
      await shoot('chat-quick-actions')
      await pressSelector(page, press, '[data-testid="chat-quick-action"]')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-proposal-accept"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the quick action showed no card')
      })
      if ((await page.$('[data-status="ready"] [data-testid="chat-answer"]')) === null)
        throw new Error('the card showed before its answer was whole, so the text landing above it moves Accept from under a tap')
      await elementSays(page, '[data-testid="chat-proposal"]', [words.proposal.accept, words.proposal.notNow], 'the card offers no Accept or Not now')
      await inspect?.('a proposal')
      await shoot('chat-proposal')
      if ((await rulesHeld()) !== 'open') throw new Error('the card is not open')
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await inspect?.('an accepted proposal with Undo')
      await shoot('chat-proposal-done')
      await pressSelector(page, press, '[data-testid="chat-proposal-undo"]')
      await elementSays(page, '[data-testid="chat-proposal-over"]', [words.proposal.undone], 'Undo did not say it was undone')
      await savedCardEnded(page, 'undone')

      await page.reload({ waitUntil: 'networkidle0' })
      if ((await page.$('[data-testid="chat-panel"]')) === null) await pressSelector(page, press, '[data-testid="chat-open"]')
      await elementSays(page, '[data-testid="chat-proposal-over"]', [words.proposal.undone], 'a reloaded card does not say how it ended')
      if (await page.$('[data-testid="chat-note"]')) throw new Error('a reloaded chat shows a note, though the assistant still sees its messages')
      if (await page.$('[data-testid="chat-proposal-accept"], [data-testid="chat-proposal-undo"]')) throw new Error('a reloaded card can still write')
      await inspect?.('a chat after a reload')
      await shoot('chat-restored')
      await newChat(page, press)
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('New chat did not empty the chat')
      })
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * A chat proposes closing an account with a new IBAN: the card shows the closed flag and the IBAN on one line, and warns
 * on that line, in English or Croatian. Not now leaves the account as it was.
 */
export function chatCloseAccountFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const fields = (language === 'en' ? spendingAssistantEnglish : spendingAssistantCroatian).proposals.fields
  const request = language === 'en' ? 'Close the old account' : 'Zatvori stari račun'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-proposal-warning"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the card to close an account shows no warned line')
      })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(
        page,
        '[data-testid="chat-proposal-line"]',
        [`${fields.closed}:`, `${fields.iban}:`, words.proposal.warns],
        'the card does not show the closed flag and the IBAN with its warning',
      )
      await inspect?.('a proposal that closes an account and gives it a new IBAN')
      await shoot('chat-proposal-close-account')
      await pressSelector(page, press, '[data-testid="chat-proposal-decline"]')
      await elementSays(page, '[data-testid="chat-proposal-over"]', [words.proposal.declined], 'Not now did not say the card was left')
      await inspect?.('a proposal left with Not now')
      await shoot('chat-proposal-declined')
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * A button that opens the chat about one element: the tag shows and can be removed, and the element is marked while it stays.
 * A tagged card keeps its own surface under the wash, so its computed background colour does not change. A row takes the bar.
 */
export function chatTagFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const card = '[data-testid="gallery-chat-element"]'
    const row = '[data-testid="gallery-chat-row"]'
    const tagged = (selector) => page.$eval(selector, (element) => element.getAttribute('data-chat-tagged'))
    const surface = () => page.$eval(card, (element) => getComputedStyle(element).backgroundColor)
    try {
      await keepAiKey(page)
      await page.waitForSelector(card, { visible: true, timeout: 10_000 })
      const untagged = await surface()
      await pressSelector(page, press, '[data-testid="gallery-chat-ask"]')
      await elementSays(page, '[data-testid="chat-tag"]', ['Cash on hand'], 'the panel does not show the tag')
      // Below the dock's width the chat takes the page's place, so the marked elements show only beside a docked chat.
      const docked = await page.evaluate((selector) => (document.querySelector(selector)?.getClientRects().length ?? 0) > 0, card)
      if (docked) {
        if ((await tagged(card)) !== 'card') throw new Error('the tagged card is not highlighted as a card')
        const underWash = await surface()
        if (underWash !== untagged) throw new Error(`the tagged card lost its own surface: ${untagged} became ${underWash}`)
        await page.$eval(card, (element) => element.scrollIntoView({ block: 'center' }))
      }
      await inspect?.('a tagged chat')
      await shoot('chat-tag')
      if (docked) {
        await pressSelector(page, press, '[data-testid="gallery-chat-row-ask"]')
        await elementSays(page, '[data-testid="chat-tag"]', ['Rent'], 'the panel does not show the row as the tag')
        if ((await tagged(row)) !== 'row') throw new Error('the tagged row is not highlighted as a row')
        if ((await tagged(card)) !== null) throw new Error('the card stayed highlighted after the row was asked about')
        await shootAt(page, shoot, row, 'chat-tag-row')
      }
      await pressSelector(page, press, '[data-testid="chat-tag-remove"]')
      await page.waitForSelector('[data-testid="chat-tag"]', { hidden: true, timeout: 5_000 })
      if (docked && (await tagged(row)) !== null) throw new Error('the highlight stayed after the tag went')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Sets the chat input to the files, as a person picks them, and waits until none is still being read. */
async function attachToChat(page, ...paths) {
  const input = await page.waitForSelector('[data-testid="chat-attach-input"]', { timeout: 10_000 })
  await input.uploadFile(...paths)
  await page.waitForFunction(
    (count) => {
      const chips = document.querySelectorAll('[data-testid="chat-file"]')
      return chips.length === count && [...chips].every((chip) => chip.getAttribute('data-state') !== 'reading')
    },
    { timeout: 15_000 },
    paths.length,
  )
  await delay(300)
}

/** The AI company the flows' made-up key is for, which each file's note names. */
const AI_COMPANY = 'Anthropic'

/**
 * One file of a kind on the chat's prompt: its chip, and under it the note that names the AI company it goes to, whole for
 * a photo or a PDF with the cost line, or as text cell by cell for a sheet, with what Anonymise leaves as written.
 */
export function chatAttachFlow(kind, samples, language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples[kind])
      const states = await page.$$eval('[data-testid="chat-file"]', (chips) => chips.map((chip) => chip.getAttribute('data-state')))
      if (states.join() !== 'ready') throw new Error(`the ${kind} chip is ${states.join() || 'missing'}, not ready`)
      if (kind === 'sheet') {
        await elementSays(page, '[data-testid="chat-file-note"]', [words.files.goesAsCells(AI_COMPANY)], 'the sheet is not said to go to the AI company as text, cell by cell')
      } else {
        await elementSays(page, '[data-testid="chat-file-note"]', [words.files.goWhole(1, AI_COMPANY).one], 'the file is not said to go to the AI company whole')
        await page.waitForSelector('[data-testid="chat-files-cost"]', { visible: true, timeout: 5_000 }).catch(() => {
          throw new Error('the files show no cost line')
        })
      }
      await inspect?.(`a ${kind} on the prompt`)
      await shoot(`chat-attach-${kind}`)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A note beside a photo on the prompt: the note's chip is refused with the kinds Kuna takes, and the photo stays ready. */
export function chatAttachRefusedFlow(samples, language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.photo, samples.note)
      const states = await page.$$eval('[data-testid="chat-file"]', (chips) => chips.map((chip) => chip.getAttribute('data-state')).sort())
      if (states.join() !== 'ready,refused') throw new Error(`the photo and the note are ${states.join() || 'missing'}, not one ready and one refused`)
      await elementSays(page, '[data-testid="chat-file-note"]', [words.files.refused('chat-sample-note.docx', words.files.unknownKind)], 'the refused note does not say which kinds Kuna takes')
      await inspect?.('a note refused beside a photo on the prompt')
      await shoot('chat-attach-refused')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** An XML file that declares its own entities waits refused as one Kuna does not open, in the error colour, with the photo beside it ready. */
export function chatAttachUnsafeFlow(samples, language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.photo, samples.unsafe)
      const states = await page.$$eval('[data-testid="chat-file"]', (chips) => chips.map((chip) => chip.getAttribute('data-state')).sort())
      if (states.join() !== 'ready,refused') throw new Error(`the photo and the XML are ${states.join() || 'missing'}, not one ready and one refused`)
      await elementSays(page, '[data-testid="chat-file-note"]', [words.files.refused('chat-sample-entities.xml', words.files.unsafe)], 'the refused XML does not say Kuna does not open it')
      await inspect?.('an XML with its own entities refused on the prompt')
      await shoot('chat-attach-unsafe')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A sheet sent as cells: the read is a closed row under the answer, which says the rows went cell by cell. */
export function chatSheetSentFlow(samples, language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.sheet)
      await sendInChat(page, press, language === 'en' ? 'Read the file' : 'Pročitaj datoteku')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(page, '[data-testid="chat-sent"]', [words.sent.cellsRows('1-3', 'chat-sample-turnover.xlsx')], 'the read is not shown as rows sent cell by cell')
      await delay(300)
      await inspect?.('the sheet sent cell by cell')
      await shoot('chat-sent-cells')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A PDF waits refused while OpenRouter is picked, which reads none, and is ready again once Anthropic is picked back. */
export function chatAttachPdfOpenRouterFlow(samples) {
  return async (page, { press, shoot, inspect }) => {
    const pickProvider = (id) =>
      page.evaluate((picked) => {
        localStorage.setItem('kuna.assist-provider', picked)
        window.dispatchEvent(new StorageEvent('storage', { key: 'kuna.assist-provider', newValue: picked, storageArea: localStorage }))
      }, id)
    try {
      await keepAiKey(page, { 'kuna.secret.openrouter': MADE_UP_ANTHROPIC_KEY })
      await openChat(page, press)
      await attachToChat(page, samples.pdf)
      await pickProvider('openrouter')
      await page.waitForSelector('[data-testid="chat-file"][data-state="refused"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the PDF chip is not refused while OpenRouter is picked')
      })
      await elementSays(page, '[data-testid="chat-file-note"]', [ASSIST_WORDS.en.result.noPdf('OpenRouter')], 'the refused PDF does not say OpenRouter reads none')
      await inspect?.('a PDF refused by OpenRouter')
      await shoot('chat-attach-pdf-openrouter')
      await pickProvider('anthropic')
      await page.waitForSelector('[data-testid="chat-file"][data-state="ready"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the PDF chip is not ready again after Anthropic is picked back')
      })
      await inspect?.('the PDF ready again')
      await shoot('chat-attach-pdf-openrouter-back')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A drag of files over the panel shows the drop target. */
export function chatAttachDropFlow(language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await page.$eval('[data-testid="chat-panel"]', (panel) => {
        const transfer = new DataTransfer()
        transfer.items.add(new File(['x'], 'dragged.pdf', { type: 'application/pdf' }))
        panel.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      })
      await elementSays(page, '[data-testid="chat-drop"]', [words.files.drop], 'a drag of files shows no drop target')
      await inspect?.('a drag of files over the chat')
      await shoot('chat-attach-drop')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** The first send with a photo attached asks on its card, and the message sent shows the file under it, then a message with none shows no list. */
export function chatConsentFilesFlow(samples, language = 'en') {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.photo)
      await sendInChat(page, press, language === 'en' ? 'What is on this receipt?' : 'Što piše na ovom računu?')
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await elementSays(page, '[data-testid="chat-consent-caution"]', [ASSIST_WORDS[language].files.goWhole(1, AI_COMPANY).one], 'the card does not warn that the photo goes whole')
      if (await page.$('[data-testid="chat-file-note"]')) throw new Error('the files under the prompt say how they go while the card says it too')
      await delay(400)
      await inspect?.('the card before a send with a photo')
      await shoot('chat-consent-files')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * The card before the first send warns how a file of cells goes, in the prompt's own words, with Anonymise on or off, and
 * beside a photo warns once that it goes whole. The prompt's own lines wait while the card says them.
 */
export function chatConsentCellsFlow(samples, language = 'en', anonymise = true) {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page, anonymise ? {} : { 'kuna.assist-anonymise': 'anthropic' })
      await openChat(page, press)
      await attachToChat(page, ...(anonymise ? [samples.deposits, samples.photo] : [samples.deposits]))
      await sendInChat(page, press, language === 'en' ? 'What is in these?' : 'Što je u ovima?')
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      const cells = anonymise ? words.files.goesAsCells(AI_COMPANY) : words.files.goesAsCellsPlain(AI_COMPANY)
      await elementSays(page, '[data-testid="chat-consent-caution"]', [cells], 'the card does not warn how the CSV goes')
      if (anonymise) await elementSays(page, '[data-testid="chat-consent-caution"]', [words.files.goWhole(1, AI_COMPANY).one], 'the card does not warn that the photo goes whole')
      if (await page.$('[data-testid="chat-file-note"]')) throw new Error('the files under the prompt say how they go while the card says it too')
      await delay(400)
      await inspect?.(`the card before a send with a CSV${anonymise ? ' and a photo' : ' and Anonymise off'}`)
      await shoot(anonymise ? 'chat-consent-cells' : 'chat-consent-cells-plain')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A sent message with a file lists it under the text, and one without lists nothing. */
export function chatQuestionFilesFlow(samples, language = 'en') {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.photo, samples.sheet)
      await sendInChat(page, press, language === 'en' ? 'What is on these?' : 'Što piše na ovima?')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(page, '[data-testid="chat-question-files"]', ['chat-sample-receipt.png', 'chat-sample-turnover.xlsx'], 'the sent message does not list its files')
      await sendInChat(page, press, language === 'en' ? 'And with no file?' : 'A bez datoteke?')
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length === 2, { timeout: 15_000 })
      const lists = await page.$$eval('[data-testid="chat-question-files"]', (elements) => elements.length)
      if (lists !== 1) throw new Error(`${lists} sent messages list files, not 1`)
      await inspect?.('a sent message with files and one without')
      await shoot('chat-question-files')
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * On Spending's import tab, "import" makes the fake model transcribe a pasted statement: Kuna refuses the first try for an
 * amount that does not add up, and the second ties, with the card Accept writes and Undo takes back.
 */
export function chatStatementCardFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const appName = language === 'en' ? spendingAppEnglish.name : spendingAppCroatian.name
  const request = language === 'en' ? 'import' : 'uvezi'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-proposal-accept"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the statement import showed no card')
      })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(page, '[data-testid="chat-sent"]', [words.sent.refusal(appName)], 'the refused first try is not shown')
      await acceptLooksReady(page)
      await inspect?.('the import card after a refused first try')
      await shoot('chat-statement-card')
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await inspect?.('the accepted import card with Undo')
      await shoot('chat-statement-card-done')
      await pressSelector(page, press, '[data-testid="chat-proposal-undo"]')
      await elementSays(page, '[data-testid="chat-proposal-over"]', [words.proposal.undone], 'Undo did not say it was undone')
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * Spending's statements set under one yes: the biggest spends of last month come from one read filtered to money out and sorted by
 * amount, each with Kuna's own figure, and the rows the person asks about are each matched with the books.
 */
export function chatLookupFlowIn(language) {
  const biggest = language === 'en' ? 'Biggest spends last month' : 'Najveći troškovi prošlog mjeseca'
  const check = language === 'en' ? 'Check these rows' : 'Provjeri ove retke'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (shot) => shootAs(language === 'en' ? shot : `${shot}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, biggest)
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-status="ready"] [data-testid="chat-answer"] [data-testid="chat-figure"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error("the biggest spends came without Kuna's figures")
      })
      await sendInChat(page, press, check)
      await page
        .waitForFunction(() => document.querySelectorAll('[data-status="ready"] [data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        .catch(() => {
          throw new Error('the check of the rows gave no answer')
        })
      if (await page.$('[data-testid="chat-consent"]')) throw new Error('the second message asked again')
      const said = await page.$$eval('[data-testid="chat-answer"]', (elements) => elements.at(-1)?.textContent ?? '')
      if ((said.match(language === 'en' ? /Row \d/g : /\d\. re[dt]/g) ?? []).length !== 3) throw new Error(`the check does not answer for each of the three rows: ${said}`)
      await inspect?.('the biggest spends and the rows checked against the books')
      await shoot('chat-lookup')
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** What the card's look-alike note is called in each language, as `copiedRowsWords.ts` words it for one row. */
const LOOK_ALIKE_WAITS = { en: '1 row waits, not imported', hr: '1 redak čeka, nije uvezen' }

/**
 * In Spending or Company, "transcribe" makes the fake model copy a statement onto an account that holds rows from another source:
 * the card skips the row the books have, lists the look-alike that waits beside the row it looks like, and Accept writes the
 * rest with one Undo. `name` is what the screenshot is called.
 */
export function chatStatementLookAlikeFlowIn(language, name) {
  const request = language === 'en' ? 'transcribe the statement' : 'prenesi izvod'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (shot) => shootAs(language === 'en' ? shot : `${shot}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await allowIfAsked(page, press)
      await page.waitForSelector('[data-testid="chat-proposal-accept"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-answer"]')?.textContent)
        throw new Error(`the copied statement showed no card: ${refused}`)
      })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(page, '[data-testid="chat-proposal"]', [LOOK_ALIKE_WAITS[language]], 'the card does not list the look-alike that waits')
      await acceptLooksReady(page)
      await inspect?.('the copied statement card with a look-alike waiting')
      await shoot(name)
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await pressSelector(page, press, '[data-testid="chat-proposal-undo"]')
      await page.waitForSelector('[data-testid="chat-proposal-over"]', { visible: true, timeout: 15_000 })
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * Spending's To review with a made-up key kept. `queue`: the card's header offers Suggest categories, which opens the chat about
 * To review with the card outlined and sends the request by itself. `row`: a waiting row shows a camera for its receipt and Ask the chat beside its category picker,
 * neither naming its payee, with room left for the payee beside its amount, and Ask the chat tags that row alone, named by its day and account, and sends nothing.
 */
export function spendingReviewAskFlowIn(language, parts = ['queue', 'row']) {
  const words = SCREEN_WORDS[language]
  const { review } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      if (parts.includes('queue')) {
        await page.waitForSelector('[data-testid="spending-review-ask"]', { visible: true, timeout: 10_000 }).catch(() => {
          throw new Error('To review offers no Suggest categories on its header')
        })
        await elementSays(page, '[data-testid="spending-review-ask"]', [review.suggestCategories], 'the To review header button does not read Suggest categories')
        await inspect?.('To review with Suggest categories on its header')
        await shoot('spending-review-ask')
        await pressSelector(page, press, '[data-testid="spending-review-ask"]')
        await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
        await elementSays(page, '[data-testid="chat-tag"]', [review.title], 'the chat is not about To review')
        if ((await page.$('[data-testid="spending-review"][data-chat-tagged="card"]')) === null) throw new Error('the To review card takes no outline while the chat is about it')
        await allowIfAsked(page, press)
        await elementSays(page, '[data-testid="chat-question"]', [review.suggestCategoriesTask], 'Suggest categories did not send its request by itself')
        // The chat reads the rows waiting, so it may ask to read Spending once the request is sent.
        await allowIfAsked(page, press)
        await page.waitForSelector('[data-testid="chat-answer"], [data-testid="chat-failure"]', { visible: true, timeout: 15_000 })
        await delay(300)
        await inspect?.('the chat about To review')
        await shoot('spending-review-tagged')
        await newChat(page, press)
        await giveThePageBack(page, press)
      }
      if (parts.includes('row')) {
        const row = await page.waitForSelector('[data-testid="spending-review-row"]', { visible: true, timeout: 10_000 })
        const payee = await row.$eval('.text-highlighted', (element) => element.textContent?.trim() ?? '')
        const camera = await row.$eval('[data-testid="spending-review-row-receipt"]', (button) => button.getAttribute('aria-label') ?? '').catch(() => null)
        if (camera === null) throw new Error('a waiting payment shows no camera for its receipt')
        if (payee !== '' && camera.includes(payee)) throw new Error(`the receipt camera names the row by its payee ${payee}`)
        const narrowest = await page.$$eval('[data-testid="spending-review-row"] .text-highlighted', (names) => Math.min(...names.map((name) => name.getBoundingClientRect().width)))
        if (narrowest < 120) throw new Error(`a waiting row leaves its payee ${Math.round(narrowest)} px beside its amount`)
        await delay(300)
        await inspect?.('To review with a camera and Ask the chat on each waiting row')
        await shoot('spending-review-camera')
        await press(await row.$('[data-testid="spending-review-row-ask"]'))
        await page.waitForSelector('[data-testid="spending-review-row"][data-chat-tagged="row"]', { timeout: 10_000 }).catch(() => {
          throw new Error('the row asked about takes no highlight')
        })
        const tag = await page
          .waitForSelector('[data-testid="chat-tag"]', { visible: true, timeout: 10_000 })
          .then((chip) => chip.evaluate((element) => element.textContent ?? ''))
          .catch(() => {
            throw new Error('the chat about the row shows no chip')
          })
        if (payee !== '' && tag.includes(payee)) throw new Error(`the chip names the row by its payee ${payee}`)
        if (await page.$('[data-testid="chat-question"]')) throw new Error("a row's Ask the chat sent a message by itself")
        await delay(300)
        await inspect?.('the chat about one waiting row')
        await shoot('spending-review-row-tagged')
      }
    } finally {
      await forgetAssist(page)
    }
  }
}

/** The receipt dialog with a key kept: after a photo it shows the photo, QR code, match, category and keep, and nothing of the assistant. */
export function spendingReceiptDialogFlowIn(language, photos) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await uploadReceiptPhoto(page, press, photos.oneMatch)
      await page.waitForSelector('[data-testid="spending-receipt-place"][data-match="ready"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the receipt is not offered its one payment ready')
      })
      const assistant = await page.$eval(SPENDING_RECEIPT_FORM, (form) => form.querySelectorAll('[data-testid^="assist"], [data-testid="ask-chat"], [data-testid^="spending-receipt-line"]').length)
      if (assistant > 0) throw new Error('the receipt dialog still holds a part of the assistant')
      await inspect?.('the receipt dialog without the assistant')
      await shoot('spending-receipt-dialog')
      await page.keyboard.press('Escape')
      await dialogGone(page, SPENDING_RECEIPT_FORM)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Waits for a card on the chat after `count` cards, and returns the newest. */
async function newestCard(page, count, failure) {
  await page
    .waitForFunction((cards) => document.querySelectorAll('[data-testid="chat-proposal"]').length === cards, { timeout: 15_000 }, count)
    .catch(() => {
      throw new Error(failure)
    })
  const cards = await page.$$('[data-testid="chat-proposal"]')
  return cards.at(-1)
}

/** Waits until the row of this payee and amount on Entries shows at least one line. */
async function rowHasLines(page, title, cents) {
  await page
    .waitForFunction(
      (selector, wanted, amount) =>
        [...document.querySelectorAll(selector)].some(
          (row) => row.dataset.amount === String(amount) && row.textContent?.includes(wanted) && row.querySelectorAll('[data-testid="spending-row-line"]').length > 0,
        ),
      { timeout: 10_000 },
      SPENDING_ROW,
      title,
      cents,
    )
    .catch(() => {
      throw new Error(`the "${title}" row of ${cents} cents shows no receipt lines`)
    })
}

/** Asks the chat how much was spent and waits until this browser keeps its answer, as a chat begun earlier. */
async function earlierQuestion(page, press, question) {
  await openChat(page, press)
  await sendInChat(page, press, question)
  await allowIfAsked(page, press)
  await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
  await savedChatAnswered(page)
}

/** Whether the chat shows a message with this text. */
async function chatShowsQuestion(page, question) {
  return page.$$eval('[data-testid="chat-question"]', (shown, text) => shown.some((line) => line.textContent?.includes(text)), question)
}

/**
 * On the receipts set's Entries with a made-up key kept: Add a receipt opens a menu, and its Read the photo in the chat opens
 * the rear camera's file picker. With no chat going on, as after a reload that brought back an earlier one, the photo starts
 * a new chat, and with `joins` it joins the chat going on, keeping its question. Once the photo is read the chat sends the
 * receipt's task for the person, through the yes, and proposes the Pet food category alone. Asked again once that is
 * accepted, it proposes the receipt card that splits the Corner market payment and says the photo stays on Drive after Undo.
 * With `accept`, Accept splits the row and Undo takes it back.
 */
export function chatReceiptFlowIn(language, photos, { accept = false, joins = false } = {}) {
  const words = ASSIST_WORDS[language]
  const request = language === 'en' ? 'Read the receipt' : 'Pročitaj fiskalni račun'
  const earlier = language === 'en' ? 'How much did I spend this month?' : 'Koliko sam potrošio ovaj mjesec?'
  const task = SCREEN_WORDS[language].spendingReceipts.readTask
  const petFood = language === 'en' ? 'Pet food' : 'Hrana za ljubimce'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await earlierQuestion(page, press, earlier)
      if (joins) {
        await pressSelector(page, press, '[data-testid="chat-close"]')
        await page.waitForFunction(() => !document.querySelector('[data-testid="chat-panel"]'), { timeout: 5_000 })
      } else {
        await page.reload({ waitUntil: 'networkidle0' })
        await giveThePageBack(page, press)
      }
      const capture = await page.$eval('[data-testid="spending-receipt-to-chat-input"]', (input) => input.getAttribute('capture')).catch(() => null)
      if (capture !== 'environment') throw new Error(`Read the photo in the chat opens the camera "${capture}", not the rear one`)
      await pressSelector(page, press, '[data-testid="spending-add-receipt"]')
      const toChat = await receiptMenuChoice(page, SCREEN_WORDS[language].spendingEntries.receipt.readInChat)
      if (!accept && !joins) {
        await delay(300)
        await inspect?.('the Add a receipt menu open')
        await shoot('spending-receipt-menu')
      }
      const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10_000 }), press(toChat)])
      await chooser.accept([photos.oneMatch])
      await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
      await page
        .waitForFunction(
          (text) => document.querySelector('[data-testid="chat-allow"]') !== null || [...document.querySelectorAll('[data-testid="chat-question"]')].some((line) => line.textContent?.includes(text)),
          { timeout: 15_000 },
          task,
        )
        .catch(() => {
          throw new Error('the chat did not send the receipt task once the photo was read')
        })
      if ((await chatShowsQuestion(page, earlier)) !== joins) throw new Error(joins ? 'the photo did not join the chat going on' : 'the photo landed in the chat of an earlier visit')
      if (!accept && !joins) {
        await panelSettled(page)
        await inspect?.('the receipt photo starting a new chat')
        await shoot('chat-receipt-new-chat')
      }

      await allowIfAsked(page, press)
      const category = await newestCard(page, 1, 'the chat proposed no category card')
      await page.waitForFunction((answers) => document.querySelectorAll('[data-testid="chat-answer"]').length >= answers, { timeout: 15_000 }, joins ? 2 : 1)
      if (!(await category.evaluate((card, name) => card.textContent?.includes(name) ?? false, petFood))) throw new Error(`the first card does not add ${petFood}`)
      if (!(await chatShowsQuestion(page, task))) throw new Error('the receipt task is not on the chat as a message Kuna sent')
      if (joins) {
        await acceptLooksReady(page)
        await inspect?.('the receipt photo joining the chat going on')
        await shoot('chat-receipt-joins')
        return
      }
      if (!accept) {
        await acceptLooksReady(page)
        await inspect?.('the category card before the receipt')
        await shoot('chat-category-card')
      }
      await press(await category.$('[data-testid="chat-proposal-accept"]'))
      await category.waitForSelector('[data-testid="chat-proposal-undo"]', { visible: true, timeout: 15_000 })

      await sendInChat(page, press, request)
      await allowIfAsked(page, press)
      const receipt = await newestCard(page, 2, 'the chat proposed no receipt card once the category was there')
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
      const receiptSays = await receipt.evaluate((card) => card.textContent ?? '')
      if (!receiptSays.includes('Corner market')) throw new Error(`the receipt card does not name the payment it splits, and says "${receiptSays}"`)
      const photoStays = (language === 'en' ? spendingAssistantEnglish : spendingAssistantCroatian).receipts.photoStays
      const outside = await receipt.$('[data-testid="chat-proposal-outside"]')
      if (outside === null || !(await outside.evaluate((line, text) => line.textContent?.includes(text) ?? false, photoStays)))
        throw new Error('the receipt card does not say the photo stays on Drive after Undo')
      await delay(300)
      await acceptLooksReady(page)
      if (!accept) {
        await inspect?.('the receipt card after the category card')
        await shoot('chat-category-then-receipt')
        return
      }
      await inspect?.('the receipt card')
      await shoot('chat-receipt-card')
      await shootAt(page, shoot, outside, 'chat-card-outside')
      await press(await receipt.$('[data-testid="chat-proposal-accept"]'))
      await receipt.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await rowHasLines(page, 'Corner market', -2349)
      await inspect?.('the accepted receipt card with Undo')
      await shoot('chat-receipt-card-done')
      await press(await receipt.$('[data-testid="chat-proposal-undo"]'))
      await page
        .waitForFunction((card, text) => card.textContent?.includes(text) ?? false, { timeout: 10_000 }, receipt, words.proposal.undone)
        .catch(() => {
          throw new Error('Undo did not say it was undone')
        })
      await rowLinesAre(page, 'Corner market', -2349, 0)
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}

/** Accepts a card and waits for it to land, or says why not. */
async function acceptCard(press, page, card) {
  await press(await card.$('[data-testid="chat-proposal-accept"]'))
  await card.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
    const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
    throw new Error(`Accept did not land: ${refused}`)
  })
}

/** Takes a card back with its Undo and waits until it says so. */
async function undoCard(press, page, card, words) {
  await press(await card.$('[data-testid="chat-proposal-undo"]'))
  await page
    .waitForFunction((held, text) => held.textContent?.includes(text) ?? false, { timeout: 10_000 }, card, words.proposal.undone)
    .catch(() => {
      throw new Error('Undo did not say it was undone')
    })
}

/** Attaches a photo to the chat, sends the request and waits for its card, which it returns once the answer under it is in. */
async function receiptCardFor(page, press, photo, request, cards, failure) {
  await attachToChat(page, photo)
  await sendInChat(page, press, request)
  await allowIfAsked(page, press)
  const card = await newestCard(page, cards, failure)
  await page.waitForFunction((answers) => document.querySelectorAll('[data-testid="chat-answer"]').length >= answers, { timeout: 15_000 }, cards)
  await delay(300)
  await acceptLooksReady(page)
  return card
}

/**
 * On the receipts set's Entries with a made-up key kept: the camera on the Harbour bistro payment of €33.00, named by its day and
 * account and not its payee, and none on the Corner market payment a receipt split already, opens the rear camera's file picker. The €17.00 photo starts a new chat tagged with that row, which
 * takes the highlight, and once the photo is read the chat sends the receipt's task for the person. The card puts the receipt
 * on that row, warning that the amount differs, and Accept leaves its two lines and a Difference line until Undo takes them back.
 */
export function chatReceiptRowFlowIn(language, photos) {
  const words = ASSIST_WORDS[language]
  const photoWords = SCREEN_WORDS[language].spendingReceipts
  const receiptWords = (language === 'en' ? spendingAssistantEnglish : spendingAssistantCroatian).receipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const bistro = '[data-testid="spending-row"][data-amount="-3300"]'
    try {
      await keepAiKey(page)
      await page.waitForSelector(bistro, { visible: true, timeout: 10_000 })
      const camera = await page.evaluateHandle((selector) => document.querySelector(selector)?.closest('li')?.querySelector('[data-testid="spending-row-receipt"]') ?? null, bistro)
      if ((await camera.evaluate((button) => button === null)) === true) throw new Error('the Harbour bistro payment shows no camera for its receipt')
      const label = await camera.evaluate((button) => button.getAttribute('aria-label') ?? '')
      if (!label.startsWith(photoWords.addPhoto(''))) throw new Error(`the receipt camera reads "${label}"`)
      if (label.includes('Harbour bistro') || /\d+[.,]\d{2}/.test(label)) throw new Error(`the receipt camera names the payment by its payee or amount: "${label}"`)
      const splitAlready = await page.$eval('[data-testid="spending-row"][data-amount="-6120"]', (row) => row.closest('li')?.querySelector('[data-testid="spending-row-receipt"]') !== null)
      if (splitAlready) throw new Error('the Corner market payment a receipt split already shows a camera')
      await delay(300)
      await inspect?.('Entries with a camera on each payment that can take a receipt')
      await shoot('spending-entries-camera')

      const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10_000 }), press(camera)])
      await chooser.accept([photos.noMatch])
      await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
      const tag = await page.$eval('[data-testid="chat-tag"]', (chip) => chip.textContent ?? '').catch(() => null)
      if (tag === null) throw new Error("the chat from a row's camera shows no chip for the row")
      if (tag.includes('Harbour bistro')) throw new Error('the chip names the row by its payee')
      await page
        .waitForFunction((selector) => document.querySelector(selector)?.closest('li')?.dataset.chatTagged === 'row', { timeout: 10_000 }, bistro)
        .catch(() => {
          throw new Error('the row photographed for takes no highlight')
        })
      await allowIfAsked(page, press)
      if (!(await chatShowsQuestion(page, photoWords.readTask))) throw new Error('the chat did not send the receipt task once the photo was read')
      const card = await newestCard(page, 1, 'the chat proposed no receipt on the row photographed for')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      const notes = await card.$$eval('[data-testid="chat-proposal-note"]', (shown) => shown.map((note) => note.textContent ?? '').join(' '))
      const differs = receiptWords.otherAmount('', '').split(',').at(-1).trim()
      if (!notes.includes(differs)) throw new Error(`the receipt card does not warn that the amount differs, and notes "${notes}"`)
      await delay(300)
      await acceptLooksReady(page)
      await inspect?.("the chat started from a row's camera, with the receipt on that row")
      await shoot('chat-receipt-row')
      await acceptCard(press, page, card)
      await rowLinesAre(page, 'Harbour bistro', -3300, 3)
      await undoCard(press, page, card, words)
      await rowLinesAre(page, 'Harbour bistro', -3300, 0)
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}

/**
 * The receipt paths the chat takes beyond a payment that matches, each on a made-up key with the sample €17.00 photo but `pick`.
 * `pick`: the photo whose QR code two payments share makes the chat ask which one, and proposes nothing. `none`: a photo no payment
 * matches makes the chat ask whether it was cash, and Yes, cash brings the cash card, which Accept writes. `picked`:the Harbour bistro payment of €33.00 is split by hand first, and the receipt the person puts on it warns that the
 * amount differs, lists the parts it replaces, and Accept leaves its two lines and a Difference line until Undo brings the split back.
 * `cash`: a cash receipt becomes an entry on the one cash account in euros. `cash-none`: with no cash account in euros, the
 * chat asks how much cash there was, and told €50 the same card adds one with that opening first. `cash-several`: once a second cash account is in, the chat asks which one the cash came from.
 * `r1`: a cash receipt naming the fake Company's OIB as its buyer files every line under For the company. `r1-no-company`: without
 * Company on the device, the same receipt keeps its lines as read and the card says to set the OIB in Company.
 */
export function chatReceiptPathFlowIn(language, photos, path) {
  const words = ASSIST_WORDS[language]
  const receiptWords = (language === 'en' ? spendingAssistantEnglish : spendingAssistantCroatian).receipts
  const english = language === 'en'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(english ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      if (path === 'picked') {
        await sendInChat(page, press, english ? 'Split the Harbour bistro' : 'Podijeli Harbour bistro')
        await allowIfAsked(page, press)
        const split = await newestCard(page, 1, 'the chat proposed no split of Harbour bistro')
        await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
        await acceptCard(press, page, split)
        await rowLinesAre(page, 'Harbour bistro', -3300, 2)
        const card = await receiptCardFor(
          page,
          press,
          photos.noMatch,
          english ? 'Put the receipt on Harbour bistro' : 'Stavi fiskalni račun na Harbour bistro',
          2,
          'the chat proposed no receipt on Harbour bistro',
        )
        const notes = await card.$$eval('[data-testid="chat-proposal-note"]', (shown) => shown.map((note) => note.textContent ?? '').join(' '))
        const replaced = receiptWords.replacesSplit('').replace(/: $/, '')
        if (!notes.includes(replaced)) throw new Error(`the receipt card does not say which parts of the split go, and notes "${notes}"`)
        const differs = receiptWords.otherAmount('', '').split(',').at(-1).trim()
        if (!notes.includes(differs)) throw new Error(`the receipt card does not warn that the amount differs, and notes "${notes}"`)
        await inspect?.('the receipt on a payment picked and split by hand')
        await shoot('chat-receipt-picked')
        await acceptCard(press, page, card)
        await rowLinesAre(page, 'Harbour bistro', -3300, 3)
        await undoCard(press, page, card, words)
        await rowLinesAre(page, 'Harbour bistro', -3300, 2)
        return
      }
      if (path === 'card-waits') {
        await attachToChat(page, photos.noMatch)
        await sendInChat(page, press, english ? 'Read the receipt' : 'Pročitaj fiskalni račun')
        await allowIfAsked(page, press)
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 1, { timeout: 15_000 })
        await sendInChat(page, press, english ? 'No, by card' : 'Ne, karticom')
        await allowIfAsked(page, press)
        const card = await newestCard(page, 1, 'the chat proposed no card receipt once told it was by card')
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        const notes = await card.$$eval('[data-testid="chat-proposal-note"]', (shown) => shown.map((note) => note.textContent ?? '').join(' '))
        if (!notes.includes(receiptWords.waits('OTP current'))) throw new Error(`the card receipt does not say it waits for the bank's row, and notes "${notes}"`)
        await panelSettled(page)
        await shootAt(page, shoot, await card.$('[data-testid="chat-proposal-note"]'), 'chat-receipt-card-waits', { block: 'start' })
        await acceptCard(press, page, card)
        return
      }
      if (path === 'r1' || path === 'r1-no-company') {
        const card = await receiptCardFor(page, press, photos.noMatch, english ? 'Read the R1 receipt' : 'Pročitaj R1 račun', 1, 'the chat proposed no R1 receipt')
        const says = await card.evaluate((element) => element.textContent ?? '')
        const forCompany = english ? 'For the company' : 'Za tvrtku'
        const receiptDomain = english ? spendingReceiptDomainEnglish : spendingReceiptDomainCroatian
        const noOib = receiptDomain.noCompanyOib
        if (path === 'r1' && !says.includes(forCompany)) throw new Error(`the R1 receipt card does not file its lines under ${forCompany}, and says "${says}"`)
        if (path === 'r1' && says.includes(noOib)) throw new Error('the R1 receipt card says Company has no OIB while Company is open with one')
        if (path === 'r1-no-company' && !says.includes(noOib)) throw new Error(`the R1 receipt card does not say to set the OIB in Company, and says "${says}"`)
        if (path === 'r1-no-company' && !says.includes(receiptDomain.setOibInCompany)) throw new Error(`the R1 receipt card offers no way to Company, and says "${says}"`)
        await inspect?.(`the R1 receipt card, ${path}`)
        await shoot(`chat-receipt-${path}`)
        await acceptCard(press, page, card)
        await rowLinesAre(page, 'Harbour bistro', -1700, 2)
        await undoCard(press, page, card, words)
        return
      }
      if (path === 'pick' || path === 'none') {
        await attachToChat(page, path === 'pick' ? photos.twoMatches : photos.noMatch)
        await sendInChat(page, press, english ? 'Read the receipt' : 'Pročitaj fiskalni račun')
        await allowIfAsked(page, press)
        const asked = path === 'pick' ? (english ? 'Which one was it?' : 'Koje je to bilo?') : english ? 'Did you pay in cash?' : 'Jeste li platili gotovinom?'
        await page
          .waitForFunction((text) => [...document.querySelectorAll('[data-testid="chat-answer"]')].some((answer) => answer.textContent?.includes(text)), { timeout: 15_000 }, asked)
          .catch(() => {
            throw new Error(path === 'pick' ? 'the chat did not ask which payment the receipt is' : 'the chat did not ask whether the receipt was paid in cash')
          })
        if ((await page.$$('[data-testid="chat-proposal"]')).length !== 0) throw new Error(`the chat proposed a card before asking, on a receipt that matches ${path}`)
        await panelSettled(page)
        await inspect?.(`the chat asking on a receipt that matches ${path}`)
        await shoot(`chat-receipt-${path}`)
        if (path === 'pick') return
        await sendInChat(page, press, english ? 'Yes, cash' : 'Da, gotovinom')
        await allowIfAsked(page, press)
        const card = await newestCard(page, 1, 'the chat proposed no cash receipt once told it was cash')
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        await acceptCard(press, page, card)
        await rowLinesAre(page, 'Harbour bistro', -1700, 2)
        return
      }
      if (path === 'cash-several') {
        await sendInChat(page, press, english ? 'Add a cash purse' : 'Dodaj novčanik')
        await allowIfAsked(page, press)
        const purse = await newestCard(page, 1, 'the chat proposed no second cash account')
        await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
        await acceptCard(press, page, purse)
        await attachToChat(page, photos.noMatch)
        await sendInChat(page, press, english ? 'Read the cash receipt' : 'Pročitaj gotovinski račun')
        await allowIfAsked(page, press)
        const asked = english ? 'Which cash account' : 'S kojeg ste računa gotovine'
        await page
          .waitForFunction((text) => [...document.querySelectorAll('[data-testid="chat-answer"]')].some((answer) => answer.textContent?.includes(text)), { timeout: 15_000 }, asked)
          .catch(() => {
            throw new Error('the chat did not ask which cash account the receipt goes on')
          })
        if ((await page.$$('[data-testid="chat-proposal"]')).length !== 1) throw new Error('the chat proposed a cash receipt with two cash accounts to pick from')
        await panelSettled(page)
        await inspect?.('the chat asking which cash account')
        await shoot('chat-receipt-cash-several')
        return
      }
      const request = english ? 'Read the cash receipt' : 'Pročitaj gotovinski račun'
      let card
      if (path === 'cash-none') {
        await attachToChat(page, photos.noMatch)
        await sendInChat(page, press, request)
        await allowIfAsked(page, press)
        const asked = english ? 'How much cash did you have' : 'Koliko ste gotovine imali'
        await page
          .waitForFunction((text) => [...document.querySelectorAll('[data-testid="chat-answer"]')].some((answer) => answer.textContent?.includes(text)), { timeout: 15_000 }, asked)
          .catch(() => {
            throw new Error('the chat did not ask how much cash there was before adding a cash account')
          })
        if ((await page.$$('[data-testid="chat-proposal"]')).length !== 0) throw new Error('the chat proposed a cash account before asking how much cash there was')
        await sendInChat(page, press, english ? 'I had €50' : 'Imao sam 50 €')
        card = await newestCard(page, 1, 'the chat proposed no cash account and receipt once told how much cash there was')
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        await delay(300)
        await acceptLooksReady(page)
      } else {
        card = await receiptCardFor(page, press, photos.noMatch, request, 1, 'the chat proposed no cash receipt')
      }
      const says = await card.evaluate((element) => element.textContent ?? '')
      const cashName = path === 'cash-none' && !english ? 'Gotovina' : 'Cash'
      if (path === 'cash-none' && (await card.$$('[data-testid="chat-proposal-group"]')).length < 2) throw new Error(`the cash receipt card does not add a cash account first, and says "${says}"`)
      if (path === 'cash-none' && !says.replace(/\s/g, ' ').includes(english ? '€50.00' : '50,00 €'))
        throw new Error(`the cash account the card adds does not open with the €50.00 said, and the card says "${says}"`)
      if (!says.includes(cashName)) throw new Error(`the cash receipt card does not name the cash account, and says "${says}"`)
      await inspect?.(`the cash receipt card, ${path}`)
      await shoot(`chat-receipt-${path}`)
      await acceptCard(press, page, card)
      await rowLinesAre(page, 'Harbour bistro', -1700, 2)
      await undoCard(press, page, card, words)
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}

/**
 * On the sample Spending file with a made-up key kept: asked to split the latest spend, the chat proposes a card that files
 * this month's rent and adds its two parts, and Accept splits the row until Undo takes the parts off again.
 */
export function chatSplitFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const request = language === 'en' ? 'Split the latest spend' : 'Podijeli zadnji trošak'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await allowIfAsked(page, press)
      const card = await newestCard(page, 1, 'the chat proposed no split card')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      const says = await card.evaluate((element) => element.textContent ?? '')
      if (!says.includes('Landlord')) throw new Error(`the split card does not name the entry it splits, and says "${says}"`)
      await delay(300)
      await acceptLooksReady(page)
      await inspect?.('the card that splits an entry')
      await shoot('chat-split-card')
      await press(await card.$('[data-testid="chat-proposal-accept"]'))
      await card.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await rowLinesAre(page, 'Landlord', -60000, 2)
      await press(await card.$('[data-testid="chat-proposal-undo"]'))
      await page
        .waitForFunction((held, text) => held.textContent?.includes(text) ?? false, { timeout: 10_000 }, card, words.proposal.undone)
        .catch(() => {
          throw new Error('Undo did not say it was undone')
        })
      await rowLinesAre(page, 'Landlord', -60000, 0)
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}

/**
 * The select of AI companies with Anonymise off for Anthropic and Company's yes as an older Kuna kept it: that yes shows as
 * Always allow for Anthropic, a company with a key says so and takes over at once, Anonymise is on again and the card says
 * so, the other key stays with Remove and Undo, and the yes stays with Anthropic while the Assistant tab says OpenAI asks.
 */
export function assistProviderSwitchFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const anonymise = '[data-testid="assist-anonymise"]'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page, TWO_KEYS_ANONYMISE_OFF)
      await page.waitForSelector(`${ANTHROPIC_ROW} [data-testid="assist-key-kept"]`, { visible: true, timeout: 10_000 })
      await switchSays(page, anonymise, false, 'Anonymise does not show off for Anthropic')
      await switchSays(page, ALWAYS_ALLOW, true, "Company's old yes did not carry over to Anthropic")
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist.company'))) !== null) throw new Error("Company's old yes stayed in this browser after it carried over")
      const offered = await openCompanies(page, press)
      if (!offered.find((option) => option.startsWith('OpenAI'))?.includes(words.card.keySaved)) throw new Error(`the select does not mark the saved key: ${offered.join(' | ')}`)
      if (offered.find((option) => option.startsWith('OpenRouter'))?.includes(words.card.keySaved)) throw new Error('the select marks a key that is not saved')
      // The list fades in, and its options read only once it has.
      await delay(400)
      await inspect?.('the select open')
      await shoot('assist-companies')
      await pickCompany(page, press, 'OpenAI')

      await elementSays(
        page,
        `${OPENAI_ROW} [data-testid="assist-moved"]`,
        [words.card.nowSends('OpenAI'), words.card.anonymiseBack, words.card.otherKept('Anthropic')],
        'the switch does not say what it did',
      )
      await switchSays(page, anonymise, true, 'Anonymise is not on again after a change of company')
      await switchSays(page, ALWAYS_ALLOW, false, 'the yes for Anthropic went with the change to OpenAI')
      await elementSays(page, '[data-testid="assist-card"]', [words.card.anonymiseOn('OpenAI')], 'Anonymise does not describe itself for OpenAI')
      const [pick, anthropic, anonymiseOffFor, allowed] = await page.evaluate(() => [
        localStorage.getItem('kuna.assist-provider'),
        localStorage.getItem('kuna.secret.anthropic'),
        localStorage.getItem('kuna.assist-anonymise'),
        localStorage.getItem('kuna.assist-allowed.anthropic'),
      ])
      if (pick !== 'openai') throw new Error(`the pick is "${pick}" after picking OpenAI`)
      if (anthropic !== MADE_UP_ANTHROPIC_KEY) throw new Error('the switch lost the other key')
      if (anonymiseOffFor !== null) throw new Error(`Anonymise stays off for "${anonymiseOffFor}" through a change of company`)
      if (allowed !== 'on') throw new Error('the switch of company forgot the yes for Anthropic')
      await inspect?.('after a switch of company')
      await shoot('assist-provider-switched')

      await pressSelector(page, press, `${OPENAI_ROW} [data-testid="assist-other-forget"]`)
      await page.waitForSelector('[data-testid="assist-other-kept"]', { hidden: true, timeout: 5_000 }).catch(() => {
        throw new Error('Remove it left the line of the other key')
      })
      if ((await page.evaluate(() => localStorage.getItem('kuna.secret.anthropic'))) !== null) throw new Error('Remove it left the other key in this browser')
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'openai') throw new Error('Remove it moved the assistant')
      await undoKeyRemoval(page, press, words)
      await page.waitForSelector('[data-testid="assist-other-kept"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('Undo did not bring back the other key')
      })

      await goToRoute(page, '#/company/settings?tab=assistant', APP_ALLOWED)
      await elementSays(page, '[data-testid="app-assist-card"]', [words.appCard.uses('OpenAI'), words.card.allowOff('OpenAI')], 'the tab does not say the new company asks')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A key the company refuses (`?ai=key-refused`): it is not kept, the field stays open beside Get a key, and the assistant does not move from the company it was on. */
export function assistKeyRefusedFlowIn(language) {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await page.evaluate(() => localStorage.setItem('kuna.assist-provider', 'anthropic'))
      await page.waitForSelector(COMPANY_SELECT, { visible: true, timeout: 10_000 })
      await openCompanies(page, press)
      await pickCompany(page, press, 'OpenAI')
      await saveTypedKey(page, press, OPENAI_ROW, 'made-up-openai-key-0077')
      await testLineSays(page, OPENAI_ROW, words.card.refused('OpenAI'), 'the refusal of the key does not show')
      await page.waitForSelector(`${OPENAI_ROW} [data-testid="assist-key"]`, { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the key field stays closed after a refusal')
      })
      await page.waitForSelector(`${OPENAI_ROW} [data-testid="assist-get-key"]`, { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('Get a key does not show after a refusal')
      })
      const [pick, kept] = await page.evaluate(() => [localStorage.getItem('kuna.assist-provider'), localStorage.getItem('kuna.secret.openai')])
      if (pick !== 'anthropic') throw new Error(`a refused key moved the assistant to "${pick}"`)
      if (kept !== null) throw new Error('a refused key was kept')
      await elementSays(page, '[data-testid="assist-keeps-using"]', [words.card.keepsUsing('Anthropic', 'OpenAI')], 'a refused key does not say the assistant stays')
      await inspect?.('a key refused')
      await shoot('assist-key-refused')
    } finally {
      await forgetAssist(page)
    }
  }
}

const SET_UP = '[data-testid="assist-set-up"]'

/** Answers yes to the welcome's AI question with the given apps picked and goes on to the key, which changes no answer yet and offers only the companies that read documents. */
async function reachKeyStep(page, press, language, appNames) {
  const screen = SCREEN_WORDS[language]
  const words = ASSIST_WORDS[language]
  await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 })
  for (const name of appNames) await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', name)
  await pressButton(page, press, '[data-testid="kuna-welcome-ai"] label', screen.home.welcome.aiYes)
  await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
  await page.waitForSelector(SET_UP, { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('a yes to the AI question does not lead to the key')
  })
  await screenTitled(page, words.card.title)
  if (await page.evaluate(() => localStorage.getItem('kuna.start'))) throw new Error('the welcome counted as answered before the key step ended')
  if (await page.$('[data-testid="home-card"]')) throw new Error('the key step shows beside the cards')
  if (await page.$('[role="dialog"]')) throw new Error('the key step opened a dialog')
  const companies = await openCompanies(page, press)
  if (companies.some((company) => company.startsWith('OpenRouter'))) throw new Error('the walk-through offers a company that cannot read documents')
  await pickCompany(page, press, 'Anthropic')
}

/**
 * Yes at the welcome, with Company and Loans picked: the key step in the same card, a key tested and kept, one line on the chat and the one consent, which turns on
 * Always allow for the company. Back on the way keeps what was picked.
 */
export function kunaWelcomeAiFlowIn(language) {
  const screen = SCREEN_WORDS[language]
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      const question = await page.waitForSelector('[data-testid="kuna-welcome-ai"]', { visible: true, timeout: 10_000 })
      await shootAt(page, shoot, question, 'kuna-welcome-ai-question')
      await reachKeyStep(page, press, language, [screen.company, screen.loans])
      await elementSays(page, SET_UP, [words.card.steps.credit, words.card.pay('Anthropic'), words.retention.anthropic], 'the key step leaves out what a key takes')
      await inspect?.('the key step')
      await shoot('kuna-welcome-ai-key')

      await pressSelector(page, press, '[data-testid="assist-set-up-back"]')
      await screenTitled(page, screen.home.welcome.title)
      const picked = await page.$$eval(
        '[data-testid="kuna-welcome-apps"] [role="checkbox"][aria-checked="true"], [data-testid="kuna-welcome-apps"] [data-state="checked"][role="checkbox"]',
        (boxes) => boxes.length,
      )
      if (picked !== 2) throw new Error(`Back keeps ${picked} apps picked, not 2`)
      await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
      await page.waitForSelector(SET_UP, { visible: true, timeout: 5_000 })

      await saveTypedKey(page, press, SET_UP, MADE_UP_ANTHROPIC_KEY)
      await testLineSays(page, SET_UP, words.card.accepted('Anthropic'), 'the key step does not say the company took the key')
      await elementSays(page, '[data-testid="assist-set-up-chat"]', [words.setUp.chat], 'the key step does not say what the key opens')
      await elementSays(
        page,
        '[data-testid="assist-set-up-consent"]',
        [words.setUp.sends, words.retention.anthropic, words.card.allow, words.card.allowOn('Anthropic'), words.setUp.turnOff],
        'the consent does not say what it covers',
      )
      if (await page.$(`${SET_UP} [data-testid="assist-key"]`)) throw new Error('the key field stays after the company took the key')
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('the consent turned on before anyone said so')
      await page.waitForSelector('[data-testid="chat-open"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the chat does not open with a key that works')
      })
      await inspect?.('the key accepted')
      await shoot('kuna-welcome-ai-accepted')

      await pressSelector(page, press, '[data-testid="assist-set-up-switch"]')
      await switchSays(page, '[data-testid="assist-set-up-switch"]', true, 'the consent did not turn on')
      await inspect?.('the consent switched on')
      await shoot('kuna-welcome-ai-allowed')
      await pressSelector(page, press, '[data-testid="assist-set-up-continue"]')
      await page.waitForSelector('[data-testid="home-card"][data-app="company"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the key step does not go on to the home')
      })
      const [allowed, kept, pick] = await page.evaluate(() => [
        localStorage.getItem('kuna.assist-allowed.anthropic'),
        localStorage.getItem('kuna.secret.anthropic'),
        localStorage.getItem('kuna.assist-provider'),
      ])
      if (allowed !== 'on') throw new Error('the consent left Anthropic asking')
      if (kept !== MADE_UP_ANTHROPIC_KEY) throw new Error('the key was not kept')
      if (pick !== 'anthropic') throw new Error(`the assistant is on "${pick}" after the walk-through`)
    } finally {
      await forgetAssist(page)
    }
  }
}

export const kunaWelcomeAiFlow = kunaWelcomeAiFlowIn('en')

/** A key the company refuses at the welcome (`?ai=key-refused`): not kept, the field stays open, nothing moves, and Not now goes on with no AI, with Kuna settings still offering it. */
export function kunaWelcomeAiRefusedFlowIn(language) {
  const screen = SCREEN_WORDS[language]
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await reachKeyStep(page, press, language, [screen.loans])
      await saveTypedKey(page, press, SET_UP, MADE_UP_ANTHROPIC_KEY)
      await testLineSays(page, SET_UP, words.card.refused('Anthropic'), 'the refusal of the key does not show')
      await page.waitForSelector(`${SET_UP} [data-testid="assist-get-key"]`, { visible: true, timeout: 5_000 })
      const kept = await page.evaluate(() => localStorage.getItem('kuna.secret.anthropic'))
      if (kept !== null) throw new Error('a refused key was kept')
      if (await page.$('[data-testid="chat-open"]')) throw new Error('the chat opens with a refused key')
      await inspect?.('a key refused at the welcome')
      await shoot('kuna-welcome-ai-refused')
      await pressSelector(page, press, '[data-testid="assist-set-up-later"]')
      await page.waitForSelector('[data-testid="home-card"][data-app="loans"]', { visible: true, timeout: 10_000 })
      if (await page.$('[data-testid="chat-open"]')) throw new Error('the chat shows after Not now')
      await goToRoute(page, '#/settings', '[data-testid="assist-key-steps"]')
      await inspect?.('Kuna settings after Not now')
    } finally {
      await forgetAssist(page)
    }
  }
}

export const kunaWelcomeAiRefusedFlow = kunaWelcomeAiRefusedFlowIn('en')

/** A key whose test could not finish at the welcome (a model no preset lists): it stays kept with Test beside it and no way back, and after a reload a device with a key is not asked about AI. */
export async function kunaWelcomeAiUnfinishedFlow(page, { press, shoot, inspect }) {
  const screen = SCREEN_WORDS.en
  try {
    await page.evaluate(() => localStorage.setItem('kuna.assist-model.anthropic', 'claude-made-up-model'))
    await page.reload({ waitUntil: 'networkidle0' })
    await reachKeyStep(page, press, 'en', [screen.loans])
    await saveTypedKey(page, press, SET_UP, MADE_UP_ANTHROPIC_KEY)
    await page.waitForSelector(`${SET_UP} [data-testid="assist-key-test"]`, { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('a test that could not finish offers no second try')
    })
    if ((await page.evaluate(() => localStorage.getItem('kuna.secret.anthropic'))) !== MADE_UP_ANTHROPIC_KEY) throw new Error('a test that could not finish lost the key')
    if (await page.$('[data-testid="assist-set-up-back"]')) throw new Error('the key step offers Back with a key kept')
    if (await page.$('[data-testid="assist-set-up-chat"]')) throw new Error('the key step says the chat is open before the company took the key')
    await inspect?.('a test that could not finish')
    await shoot('kuna-welcome-ai-unfinished')
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 })
    if (await page.$('[data-testid="kuna-welcome-ai"]')) throw new Error('a device with a key is asked about AI')
    await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', screen.loans)
    await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
    await page.waitForSelector('[data-testid="home-card"][data-app="loans"]', { visible: true, timeout: 10_000 })
  } finally {
    await forgetAssist(page)
  }
}

/** A new browser with the sync on open off and a key on the fake Drive: Get it from Google brings the key, with no switch needed first. */
export async function assistFetchKeyFlow(page, { press, shoot, inspect }) {
  try {
    await page.evaluate(() => localStorage.setItem('kuna.auto-sync', 'off'))
    await forgetAssist(page)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-testid="assist-fetch-key"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the no-key card on Drive does not offer Get it from Google')
    })
    await inspect?.('Get it from Google offered')
    await pressSelector(page, press, '[data-testid="assist-fetch-key"]')
    await elementSays(page, `${ANTHROPIC_ROW} [data-testid="assist-key-kept"]`, ['A key ending in 0042 is kept in this browser.'], 'Get it from Google did not bring the key')
    await inspect?.('the key fetched')
    await shoot('assist-key-fetched')
    if ((await page.evaluate(() => localStorage.getItem('kuna.secret.anthropic'))) !== MADE_UP_ANTHROPIC_KEY) throw new Error('this browser keeps another key than the fake Drive held')
  } finally {
    await page.evaluate(() => localStorage.removeItem('kuna.auto-sync'))
    await forgetAssist(page)
  }
}

/** Get it from Google with no key in the Google account says so and leaves the steps on screen. */
export async function assistFetchNoneFlow(page, { press, inspect }) {
  try {
    await pressSelector(page, press, '[data-testid="assist-fetch-key"]')
    await elementSays(page, '[data-testid="assist-fetch-line"]', [ASSIST_WORDS.en.card.fetchNone('Anthropic')], 'Get it from Google does not say the account holds no key')
    if (!(await page.$('[data-testid="assist-key-steps"]'))) throw new Error('the steps went with no key fetched')
    await inspect?.('no key in the Google account')
  } finally {
    await forgetAssist(page)
  }
}

/** A queue row's summary, which opens and closes its details. */
export async function queueRow(page, counterparty) {
  const row = await page
    .waitForFunction(
      (wanted) => [...document.querySelectorAll('[data-testid="review-row"] > button')].find((button) => button.textContent?.includes(wanted)) ?? null,
      { timeout: 10_000 },
      counterparty,
    )
    .catch(() => {
      throw new Error(`no queue row of ${counterparty}`)
    })
  return row.asElement()
}

export function deleteKeysFlowIn(language) {
  const words = language === 'hr' ? kunaSettingsCroatian : kunaSettingsEnglish
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="delete-keys"]')
    await page.waitForSelector('[data-testid="delete-keys-dialog"]', { visible: true, timeout: 5_000 })
    await delay(250)
    await inspect?.('the delete keys dialog')
    await shoot('delete-keys-dialog')
    await pressSelector(page, press, '[data-testid="delete-keys-confirm"]')
    await toast(page, words.keys.deleted)
    if (await page.$('[data-testid="delete-keys-dialog"]')) throw new Error('the delete keys dialog stayed open')
    await inspect?.('the keys deleted')
    await shoot('delete-keys-done')
  }
}

/**
 * The category picker wherever it sits: on a queue row, searched down to the category with the longest name and slug,
 * in the rule editor and the split dialog of that row, and in the dialog that changes a settled row's category.
 */
export function categoryPickerFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await press(await queueRow(page, 'GADGET CORNER'))
    await page.waitForSelector('[data-testid="recategorise-row"]', { visible: true, timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="recategorise-row"]')
    await page.waitForSelector('[role="listbox"]', { visible: true, timeout: 5_000 })
    await page.keyboard.type('benefits')
    await page
      .waitForFunction(() => document.querySelectorAll('[role="option"]').length === 1, { timeout: 5_000 })
      .catch(() => {
        throw new Error('searching the picker for benefits does not leave one category')
      })
    await delay(250)
    await inspect?.('the picker on the long category')
    await shoot('category-picker-long')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await lookAtDialog(page, press, shoot, '[data-testid="make-rule"]', '[data-testid="rule-category"]', 'category-picker-rule')
    await lookAtDialog(page, press, shoot, '[data-testid="split-row"]', '[data-testid="split-part-category"]', 'category-picker-split')
    await goTo(page, '#/company/transactions?p=all&q=CODE%20HOST', words.transactions.title)
    await openChangeOfRow(page, press)
    await page.waitForSelector('[data-testid="change-category"]', { visible: true, timeout: 5_000 })
    await delay(400)
    await openEachMenuIn(page, press, '[data-testid="change-category"]')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="change-category"]')
  }
}

/** A file with its history not said to be complete: Overview's set-up line says tax figures are out, Tax holds them back, and My history is complete brings them on. */
export async function investmentsHistoryFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector('[data-testid="getting-set-up"] [data-line="history"]', { visible: true, timeout: 10_000 })
  await inspect?.('the set-up line of a file whose history is not complete')
  const holdingSaysTaxFree = async () => {
    await goTo(page, '#/investments/holdings', 'Holdings')
    await pressSelector(page, press, '[data-testid="holdings-rows"] a[data-testid="holding-row"]')
    await page.waitForSelector('[data-testid="holding-facts"]', { visible: true, timeout: 10_000 })
    return page.evaluate(() => ['holding-facts', 'holding-lots'].some((testId) => document.querySelector(`[data-testid="${testId}"]`)?.textContent?.toLowerCase().includes('tax-free') === true))
  }
  const saleSaysTax = async () => {
    await goTo(page, '#/investments/transactions', 'Transactions')
    await pressSelector(page, press, '[data-testid="transactions-add"]')
    await page.waitForSelector('[data-testid="transaction-form"]', { visible: true })
    await pressLabelled(page, press, '[data-testid="transaction-happened"]', 'Sell')
    await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example Tech')
    await chooseStartingWith(page, press, '[data-testid="transaction-account"]', 'Broker One')
    await fill(page, 'transaction-quantity', '2')
    await fill(page, 'transaction-price', '160')
    await page.waitForSelector('[data-testid="transaction-summary"]', { visible: true, timeout: 10_000 })
    await delay(300)
    const says = await page.$eval('[data-testid="transaction-summary"]', (summary) => summary.textContent?.includes('Tax on this sale') === true)
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="transaction-form"]')
    return says
  }
  if (await holdingSaysTaxFree()) throw new Error('a holding page says what turns tax-free before the history is complete')
  if (await saleSaysTax()) throw new Error('a sale says its tax before the history is complete')
  await goTo(page, '#/investments', 'Overview')
  await pressSelector(page, press, '[data-line="history"] a')
  await page.waitForSelector('[data-testid="tax-history"]', { visible: true, timeout: 10_000 })
  await shoot('investments-tax-history')
  await pressLabelled(page, press, '[data-testid="tax-tabs"]', 'Abroad')
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="tax-history"]'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('income from abroad waits for the history, though it reads no buys')
    })
  await pressLabelled(page, press, '[data-testid="tax-tabs"]', 'Year')
  await pressSelector(page, press, '[data-testid="tax-history-confirm"]')
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="tax-history"]'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('My history is complete did not bring the tax figures on')
    })
  if (!(await holdingSaysTaxFree())) throw new Error('a holding page leaves out what turns tax-free once the history is complete')
  if (!(await saleSaysTax())) throw new Error('a sale leaves out its tax once the history is complete')
  await goTo(page, '#/investments/settings', 'Settings')
  await pressSelector(page, press, '[data-testid="history-not-complete"]')
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="investments-history"]'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('My history is not complete yet did not take the answer back')
    })
  await goTo(page, '#/investments/tax', 'Tax')
  await page.waitForSelector('[data-testid="tax-history"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Tax on sales still shows after the answer was taken back')
  })
}

/** Add what I hold now on the sample before its history is said complete: one buy writes one deposit too, cash ends where it was, and one Undo takes both. */
export async function investmentsAddHeldFlow(page, { press, shoot, inspect }) {
  await pressSelector(page, press, '[data-testid="investments-add-held"]')
  await page.waitForSelector('[data-testid="transaction-form"]', { visible: true, timeout: 10_000 })
  if (await page.$('[data-testid="transaction-happened"]')) throw new Error('adding what you hold offers more than a buy')
  await delay(300)
  await elementSays(page, '[role="dialog"]', ['Kuna also adds a deposit'], 'the dialog does not say it adds a deposit')
  await inspect?.('the dialog of what you hold')
  await shoot('investments-add-held')
  await chooseStartingWith(page, press, '[data-testid="transaction-instrument"]', 'Example World')
  await chooseStartingWith(page, press, '[data-testid="transaction-account"]', 'Broker One')
  await fill(page, 'transaction-quantity', '1')
  await fill(page, 'transaction-price', '100')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Buy added')
  await goTo(page, '#/investments/transactions', 'Transactions')
  await elementSays(page, '[data-testid="transactions"]', ['+€100.00', '−€100.00'], 'the deposit was not written with the buy')
  await undo(page, press)
  await delay(500)
  const leftBehind = await page.$eval('[data-testid="transactions"]', (list) => list.textContent?.includes('+€100.00') === true || list.textContent?.includes('−€100.00') === true)
  if (leftBehind) throw new Error('one Undo left the buy or its deposit behind')
  await dismissToasts(page)
}

/** A new account from Accounts starts today, so a balance typed from the bank's screen is not counted twice. */
export async function spendingAccountOpensTodayFlow(page, { press }) {
  await pressSelector(page, press, '[data-testid="spending-add-account"]')
  await page.waitForSelector('[data-testid="spending-account-dialog"]', { visible: true, timeout: 10_000 })
  const shown = await page.$eval('[data-testid="spending-account-opened-on"] input', (input) => input.value)
  const local = await page.evaluate(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  if (shown !== local) throw new Error(`a new account from Accounts opens on ${shown}, not today`)
  await delay(300)
}

/**
 * A new Spending file with a bank sync deployment saved offers Link a bank beside Add by hand. Link a bank opens the account
 * dialog with its rows from the bank, and Add asks for the IBAN the bank sync finds the account by.
 */
export function spendingFirstAccountBankFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const choice = words.spendingAccounts.rowsFromChoice
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-empty"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('the empty Overview with a bank sync deployment saved')
    await shoot('spending-first-account-bank-empty')
    await pressSelector(page, press, '[data-testid="spending-overview-link-bank"]')
    await page.waitForSelector(SPENDING_ACCOUNT_DIALOG, { visible: true, timeout: 10_000 })
    await delay(300)
    const picked = await page.$eval('[data-testid="spending-account-rows-from"] [aria-pressed="true"]', (button) => button.textContent?.trim() ?? '')
    if (picked !== words.spendingAccounts.rowsFrom['bank-link']) throw new Error(`Link a bank opens the account dialog with "${picked}" picked`)
    await fill(page, 'spending-account-name', language === 'en' ? 'Current account' : 'Tekući račun')
    await pressSelector(page, press, '[data-testid="spending-account-save"]')
    await waitForTextIn(page, SPENDING_ACCOUNT_DIALOG, choice.ibanNeeded)
    await delay(300)
    await inspect?.('the account dialog linked to a bank with no IBAN')
    await shoot('spending-first-account-bank')
  }
}

/** A new Spending file asks for one account in place, then says what comes next and opens Import. */
export function spendingFirstAccountFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-empty"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-overview-add-account"]')
    await page.waitForSelector('[data-testid="spending-account-dialog"]', { visible: true, timeout: 10_000 })
    await delay(300)
    const openedOn = await page.$eval('[data-testid="spending-account-opened-on"] input', (input) => input.value)
    if (!openedOn.endsWith('-01')) throw new Error(`the first account on Overview opens on ${openedOn}, not the first of the month`)
    await inspect?.('the account dialog on an empty Overview')
    await shoot('spending-first-account')
    await fill(page, 'spending-account-name', 'Current account')
    await pressSelector(page, press, '[data-testid="spending-account-save"]')
    await page.waitForSelector('[data-testid="getting-set-up"] [data-line="first-entries"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Overview does not say what comes after the first account')
    })
    await dismissToasts(page)
    await pressSelector(page, press, '[data-line="first-entries"] a')
    await page
      .waitForFunction(() => window.location.hash.includes('tab=import'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('The first entries line did not open Import')
      })
  }
}

export const spendingFirstAccountFlow = spendingFirstAccountFlowIn('en')
