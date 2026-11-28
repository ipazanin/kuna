/**
 * What the flows of every app share: the words of each screen, shots scrolled into view, toasts and undo, pickers,
 * fields and the waits on what a page says. `press` clicks or taps an element handle. A failure throws with what was missing.
 */

import { en as companyEnglish, hr as companyCroatian } from '../../src/apps/company/words.ts'
import { en as companySettingsEnglish, hr as companySettingsCroatian } from '../../src/apps/company/settings/presentation/words.ts'
import { en as categoriesEnglish, hr as categoriesCroatian } from '../../src/apps/company/categories/presentation/words.ts'
import { en as companySortingEnglish, hr as companySortingCroatian } from '../../src/apps/company/sorting/presentation/words.ts'
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
import { en as invoicingEnglish, hr as invoicingCroatian } from '../../src/apps/company/invoicing/presentation/words.ts'
import { en as receivablesEnglish, hr as receivablesCroatian } from '../../src/apps/company/receivables/presentation/words.ts'
import { en as billingEnglish, hr as billingCroatian } from '../../src/apps/company/billingPlan/presentation/words.ts'
import { en as companyOverviewEnglish, hr as companyOverviewCroatian } from '../../src/apps/company/overview/presentation/words.ts'
import { en as ownerShareEnglish, hr as ownerShareCroatian } from '../../src/apps/company/owner-share/presentation/words.ts'
import { en as writesEnglish, hr as writesCroatian } from '../../src/shared/storage/presentation/words.ts'
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
import { en as sharedEnglish, hr as sharedCroatian } from '../../src/shared/app/words.ts'
import { en as homeEnglish, hr as homeCroatian } from '../../src/shell/home/words.ts'
import { en as uiEnglish, hr as uiCroatian } from '../../src/shared/ui/words.ts'
import { en as recipeEditorEnglish, hr as recipeEditorCroatian } from '../../src/shared/recipes/presentation/words.ts'
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
import { en as spendingScreensEnglish, hr as spendingScreensCroatian } from '../../src/apps/spending/screenWords.ts'
import { en as spendingEntriesEnglish, hr as spendingEntriesCroatian } from '../../src/apps/spending/entries/presentation/words.ts'
import { en as spendingLinksEnglish, hr as spendingLinksCroatian } from '../../src/apps/spending/links/presentation/words.ts'
import { en as spendingReceiptsEnglish, hr as spendingReceiptsCroatian } from '../../src/apps/spending/receipts/presentation/words.ts'
import { en as spendingReceiptNotesEnglish, hr as spendingReceiptNotesCroatian } from '../../src/apps/spending/receipts/domain/words.ts'
import { en as spendingStatementsEnglish, hr as spendingStatementsCroatian } from '../../src/apps/spending/statements/presentation/words.ts'
import { en as spendingStatementReadingEnglish, hr as spendingStatementReadingCroatian } from '../../src/apps/spending/statements/domain/words.ts'
import { en as spendingFileReadingEnglish, hr as spendingFileReadingCroatian } from '../../src/apps/spending/statements/presentation/readingWords.ts'
import { en as spendingAccountsEnglish, hr as spendingAccountsCroatian } from '../../src/apps/spending/accounts/presentation/words.ts'
import { en as spendingBankSyncEnglish, hr as spendingBankSyncCroatian } from '../../src/apps/spending/bankSync/presentation/words.ts'
import { en as spendingBankSyncReadingEnglish, hr as spendingBankSyncReadingCroatian } from '../../src/apps/spending/bankSync/domain/words.ts'
import { en as bankScriptEnglish, hr as bankScriptCroatian } from '../../src/shared/bank-sync/infrastructure/words.ts'
import { en as bankSyncSharedEnglish, hr as bankSyncSharedCroatian } from '../../src/shared/bank-sync/presentation/words.ts'
import { en as spendingBudgetsEnglish, hr as spendingBudgetsCroatian } from '../../src/apps/spending/budgets/presentation/words.ts'
import { en as spendingLabelsEnglish, hr as spendingLabelsCroatian } from '../../src/apps/spending/labels/presentation/words.ts'
import { en as companyLabelsEnglish, hr as companyLabelsCroatian } from '../../src/apps/company/labels/presentation/words.ts'
import { en as spendingEventsEnglish, hr as spendingEventsCroatian } from '../../src/apps/spending/events/presentation/words.ts'
import { en as spendingEventRulesEnglish, hr as spendingEventRulesCroatian } from '../../src/apps/spending/events/domain/words.ts'
import { en as spendingCategoriesEnglish, hr as spendingCategoriesCroatian } from '../../src/apps/spending/categories/presentation/words.ts'
import { en as spendingHomeEnglish, hr as spendingHomeCroatian } from '../../src/apps/spending/home/presentation/words.ts'
import { en as spendingOverviewEnglish, hr as spendingOverviewCroatian } from '../../src/apps/spending/overview/presentation/words.ts'
import { en as spendingFileEnglish, hr as spendingFileCroatian } from '../../src/apps/spending/workbook/presentation/words.ts'
import { starterCategories } from '../../src/apps/spending/categories/domain/starterCategories.ts'
import { textHolds } from './flowText.mjs'
import { openEachMenuIn } from './menuFlows.mjs'
import { delay, pressSelector, typeDay } from './pressing.mjs'
import { en as assistEnglish, hr as assistCroatian } from '../../src/shared/ai/presentation/words.ts'
import { en as secretsEnglish, hr as secretsCroatian } from '../../src/shared/secrets/presentation/words.ts'

export const TOAST = 'li[data-slot="base"]'

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
export const SCREEN_WORDS = {
  en: {
    homeTitle: homeEnglish.title,
    homeLink: sharedEnglish.homeLink,
    setUp: homeEnglish.setUp,
    kunaSettings: kunaSettingsEnglish.menu,
    netWorth: netWorthEnglish.title,
    addApp: shellEnglish.navigation.addApp,
    filesHome: kunaSettingsEnglish.filesHome,
    home: homeEnglish,
    company: companyEnglish.name,
    companySettings: companySettingsEnglish.title,
    companySorting: companySortingEnglish.title,
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
    planStatus: bankLoanEnglish.status,
    transactions: transactionsEnglish,
    rules: rulesEnglish,
    ruleChanges: ruleChangesEnglish.changes,
    categoryName: companyBooksEnglish.unlabelled,
    editorFields: companyBooksEnglish.fields,
    notAnIban: companyBooksEnglish.notAnIban,
    swatches: chartsEnglish.swatches,
    sortBy: uiEnglish.sortBy,
    splitEditor: uiEnglish.split,
    filterChips: uiEnglish.chips,
    labelName: uiEnglish.labelName,
    recipeEditor: recipeEditorEnglish,
    imports: importEnglish,
    mail: mailEnglish,
    invoicing: invoicingEnglish,
    receivables: receivablesEnglish,
    billing: billingEnglish,
    clientColumns: companySettingsEnglish.clientColumns,
    settings: { ...companySettingsEnglish, categories: categoriesEnglish.categories },
    categoriesToSort: categoriesEnglish.categoriesToSort,
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
    companyHome: companyHomeEnglish,
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
    spendingLinks: spendingLinksEnglish,
    spendingStatements: spendingStatementsEnglish,
    spendingReceipts: spendingReceiptsEnglish,
    spendingReceiptNotes: spendingReceiptNotesEnglish,
    spendingStatementReading: spendingStatementReadingEnglish,
    spendingFileReading: spendingFileReadingEnglish,
    spendingAccounts: spendingAccountsEnglish,
    spendingBankSync: spendingBankSyncEnglish,
    spendingBankSyncReading: spendingBankSyncReadingEnglish,
    bankScript: bankScriptEnglish,
    bankSyncShared: bankSyncSharedEnglish,
    spendingBudgets: spendingBudgetsEnglish,
    spendingLabels: spendingLabelsEnglish,
    companyLabels: companyLabelsEnglish,
    spendingEvents: spendingEventsEnglish,
    spendingEventRules: spendingEventRulesEnglish,
    spendingCategories: spendingCategoriesEnglish,
    spendingHome: spendingHomeEnglish,
    spendingOverview: spendingOverviewEnglish,
    spendingFile: spendingFileEnglish,
    spendingStarter: spendingStarterIn('en'),
    locale: 'en-GB',
  },
  hr: {
    homeTitle: homeCroatian.title,
    homeLink: sharedCroatian.homeLink,
    setUp: homeCroatian.setUp,
    kunaSettings: kunaSettingsCroatian.menu,
    netWorth: netWorthCroatian.title,
    addApp: shellCroatian.navigation.addApp,
    filesHome: kunaSettingsCroatian.filesHome,
    home: homeCroatian,
    company: companyCroatian.name,
    companySettings: companySettingsCroatian.title,
    companySorting: companySortingCroatian.title,
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
    planStatus: bankLoanCroatian.status,
    transactions: transactionsCroatian,
    rules: rulesCroatian,
    ruleChanges: ruleChangesCroatian.changes,
    categoryName: companyBooksCroatian.unlabelled,
    editorFields: companyBooksCroatian.fields,
    notAnIban: companyBooksCroatian.notAnIban,
    swatches: chartsCroatian.swatches,
    sortBy: uiCroatian.sortBy,
    splitEditor: uiCroatian.split,
    filterChips: uiCroatian.chips,
    labelName: uiCroatian.labelName,
    recipeEditor: recipeEditorCroatian,
    imports: importCroatian,
    mail: mailCroatian,
    invoicing: invoicingCroatian,
    receivables: receivablesCroatian,
    billing: billingCroatian,
    clientColumns: companySettingsCroatian.clientColumns,
    settings: { ...companySettingsCroatian, categories: categoriesCroatian.categories },
    categoriesToSort: categoriesCroatian.categoriesToSort,
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
    companyHome: companyHomeCroatian,
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
    spendingLinks: spendingLinksCroatian,
    spendingStatements: spendingStatementsCroatian,
    spendingReceipts: spendingReceiptsCroatian,
    spendingReceiptNotes: spendingReceiptNotesCroatian,
    spendingStatementReading: spendingStatementReadingCroatian,
    spendingFileReading: spendingFileReadingCroatian,
    spendingAccounts: spendingAccountsCroatian,
    spendingBankSync: spendingBankSyncCroatian,
    spendingBankSyncReading: spendingBankSyncReadingCroatian,
    bankScript: bankScriptCroatian,
    bankSyncShared: bankSyncSharedCroatian,
    spendingBudgets: spendingBudgetsCroatian,
    spendingLabels: spendingLabelsCroatian,
    companyLabels: companyLabelsCroatian,
    spendingEvents: spendingEventsCroatian,
    spendingEventRules: spendingEventRulesCroatian,
    spendingCategories: spendingCategoriesCroatian,
    spendingHome: spendingHomeCroatian,
    spendingOverview: spendingOverviewCroatian,
    spendingFile: spendingFileCroatian,
    spendingStarter: spendingStarterIn('hr'),
    locale: 'hr-HR',
  },
}

/** A pattern that matches the whole of `text` and nothing else. */
export function exactly(text) {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
}

/** The form of a counted phrase from the app's words that the language writes `count` with. */
export function countedIn(words, forms, count) {
  return forms[new Intl.PluralRules(words.locale).select(count)] ?? forms.other
}

/** Sets a field the way typing does, so Vue's v-model sees it. */
export async function setField(input, value) {
  if ((await input.$('[data-segment="day"]')) !== null) return typeDay(input, value)
  await input.evaluate((element, text) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

export async function choose(page, press, trigger, option) {
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
export async function toast(page, title) {
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

export async function dismissToasts(page) {
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
export async function undo(page, press) {
  const button = await page
    .waitForFunction((selector) => [...document.querySelectorAll(`${selector} button`)].find((element) => element.textContent?.trim() === 'Undo') ?? null, { timeout: 5_000 }, TOAST)
    .catch(() => {
      throw new Error('no toast offers Undo')
    })
  await press(button.asElement())
  await toast(page, 'Undone')
}

export async function dialogGone(page, selector) {
  await page
    .waitForFunction((wanted) => !document.querySelector(wanted), { timeout: 10_000 }, selector)
    .catch(() => {
      throw new Error(`${selector} is still open`)
    })
  await delay(300)
}

/** Picks a category in the category picker, whose options end with the category's name. */
export async function chooseCategory(page, press, trigger, label) {
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

export async function pageSays(page, text, says) {
  await page
    .waitForFunction((wanted, shown) => document.body.innerText.includes(wanted) === shown, { timeout: 10_000 }, text, says)
    .catch(() => {
      throw new Error(says ? `"${text}" is not on the page` : `"${text}" is still on the page`)
    })
}

export async function dropFile(page, path) {
  const input = await page.waitForSelector('[data-testid="import-file"] input[type="file"]', { timeout: 10_000 }).catch(() => {
    throw new Error('Import offers no file input')
  })
  await input.uploadFile(path)
}

/** Presses Undo in the toast of the last write and waits for the toast that says it was undone, in the language on screen. */
export async function undoIn(page, press, words) {
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

export const SYNC_BUTTON = '[data-testid="sync-button"]'
export const SYNC_STEPS = '[data-testid="sync-steps"]'
export const SYNC_CARD = '[data-testid="sync-card"]'

export async function toastMatching(page, pattern) {
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
export async function noToast(page, failure) {
  await delay(1_000)
  const said = await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((element) => element.textContent?.trim()).join(' | '), TOAST)
  if (said !== '') throw new Error(`${failure}: ${said}`)
}

/** The sync control on screen, the top bar's or the sidebar's. */
export async function syncButton(page) {
  return page
    .waitForFunction((selector) => [...document.querySelectorAll(selector)].find((element) => element.offsetParent !== null) ?? null, { timeout: 10_000 }, SYNC_BUTTON)
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error('no Sync button on screen')
    })
}

/** Waits until the sync control shows the state, and returns what its button says and what a screen reader hears. */
export async function controlShows(page, kind) {
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
export async function syncAndSettle(page, press) {
  await press(await syncButton(page))
  await page
    .waitForFunction((selector) => [...document.querySelectorAll(selector)].some((element) => element.offsetParent !== null && !element.disabled), { timeout: 12_000, polling: 100 }, SYNC_BUTTON)
    .catch(() => {
      throw new Error('the sync did not finish within 12 s')
    })
}

/** Waits until a step's line in the steps under `scope` is in the state and says the text. Returns the line's text. */
export async function stepSays(page, scope, step, state, pattern) {
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

export async function openKunaSettings(page) {
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await page.waitForSelector(SYNC_CARD, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Kuna settings has no Sync card')
  })
}

/** What the control under this selector shows while a save waits: where it stands, whether it takes taps, whether it spins and whether it keeps its full colour. */
export function savingControl(page, selector) {
  return page.evaluate(savingLook, selector)
}

/**
 * A switch's track while it saves is the off colour whichever way it goes, so one saving towards On does not already read as on. Its thumb shows the value.
 * A saving control keeps its full colour, as a loading button does, since its spinner already says it is busy.
 */
function savingLook(chosen) {
  const control = document.querySelector(chosen)
  const probe = document.createElement('div')
  probe.style.background = 'var(--ui-bg-accented)'
  document.body.append(probe)
  const accented = getComputedStyle(probe).backgroundColor
  probe.remove()
  let opacity = 1
  for (let at = control; at != null; at = at.parentElement) opacity *= parseFloat(getComputedStyle(at).opacity)
  return {
    value: control?.getAttribute('aria-checked') ?? control?.textContent?.trim() ?? null,
    disabled: control?.matches(':disabled') ?? false,
    spinning: (control?.querySelector('.animate-spin') ?? control?.parentElement?.querySelector('.animate-spin')) != null,
    looksSaving: control?.getAttribute('role') !== 'switch' || getComputedStyle(control).backgroundColor === accented,
    fullColour: control != null && opacity === 1,
  }
}

export async function controlSaving(page, selector, was) {
  const deadline = Date.now() + 1_500
  const saving = (look) => look.value !== was && look.disabled && look.spinning && look.looksSaving && look.fullColour
  let look = await savingControl(page, selector)
  while (Date.now() < deadline && !saving(look)) {
    await delay(50)
    look = await savingControl(page, selector)
  }
  if (!saving(look)) {
    throw new Error(`the control did not move at once, at full colour with a spinner and taking no taps: ${JSON.stringify(look)}, it stood at ${was}`)
  }
}

export async function controlLanded(page, selector) {
  await page
    .waitForFunction((chosen) => document.querySelector(chosen)?.matches(':disabled') === false, { timeout: 15_000 }, selector)
    .catch(() => {
      throw new Error('the control still takes no taps after its save')
    })
}

/** The shot's name in the page's language, so the English and the Croatian run of one flow keep a shot each. */
export async function shotInLanguage(page, name) {
  return (await page.evaluate(() => document.documentElement.lang)) === 'hr' ? `${name}-croatian` : name
}

/** What the fake bank's mail gives a sync: the sample statement mailed twice, PDFs and an HTML copy passed over, and a notice that is no statement. */
export const ALL_KINDS = ['read', 'passed-over', 'not-read']

/** Scrolls the element under the selector to the top of the window, below the bars that stick there. */
export async function scrollToTop(page, selector) {
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'start' }))
  await delay(300)
}

/** Opens a collapsed card by its test id, scrolled to the middle first. */
export async function openCard(page, press, testId) {
  const toggle = await page.waitForSelector(`[data-testid="${testId}"] [data-testid="card-toggle"]`, { timeout: 10_000 }).catch(() => {
    throw new Error(`no card ${testId}`)
  })
  if ((await toggle.evaluate((element) => element.getAttribute('aria-expanded'))) === 'true') return
  await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(toggle)
  await delay(300)
}

/** Presses the visible button under `selector` whose text starts with `label`. */
export async function pressButton(page, press, selector, label) {
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

export const STEP = '[data-testid="onboarding-step"]'

/** Waits for onboarding to show this step, or for Overview, in either language, once it is over. */
export async function onboardingAt(page, step) {
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
export async function chooseOption(page, press, group, label) {
  await pressButton(page, press, `[data-testid="${group}"] label`, label)
}

/** The app's subfolder of a new Kuna folder at the top of My Drive, as the folder step and the toast name it. */
export function inKunaFolder(words, appId) {
  return `${words.myDrive} › Kuna › ${appId}`
}

/** Waits until the element under `selector` says every text given. */
export async function elementSays(page, selector, texts, failure) {
  await page
    .waitForFunction((css, wanted) => [...document.querySelectorAll(css)].some((element) => wanted.every((text) => element.textContent?.includes(text))), { timeout: 10_000 }, selector, texts)
    .catch(async () => {
      const said = await page.evaluate((css) => document.querySelector(css)?.textContent?.trim().slice(0, 300) ?? 'nothing', selector)
      throw new Error(`${failure}, it says: ${said}`)
    })
}

export async function screenTitled(page, title) {
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === wanted, { timeout: 10_000 }, title)
    .catch(() => {
      throw new Error(`${title} did not open`)
    })
}

/** How the checks write money in each language. */
export const MONEY_FORMATS = { en: { currency: 'EUR', locale: 'en-GB' }, hr: { currency: 'EUR', locale: 'hr-HR' } }

const FIRST_RUN_STEP = '[data-testid="onboarding-step"]'

/** Waits for an app's first run to show this step, or for its Overview once it is over, which `app` names by the test ids of its empty state and books card. */
export async function firstRunAt(page, app, step) {
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
export async function settingsShowFile(page, press, app, says, words = SCREEN_WORDS.en) {
  await openMenu(page, press)
  await pressButton(page, press, '[data-testid="nav-entries"] a', words.loansSettings)
  await screenTitled(page, words.loansSettings)
  await page
    .waitForFunction((card, wanted) => document.querySelector(`[data-testid="${card}"]`)?.textContent?.includes(wanted) === true, { timeout: 10_000 }, `${app.id}-books-card`, says)
    .catch(() => {
      throw new Error(`the ${app.name} books card does not say "${says}"`)
    })
}

export const LOANS = { id: 'loans', name: 'Loans' }
export const INVESTMENTS = { id: 'investments', name: 'Investments' }
export const ASSETS = { id: 'assets', name: 'Assets' }
export const SPENDING = { id: 'spending', name: 'Spending' }

export const DELETE_WORDS = { en: writesEnglish.deleteData, hr: writesCroatian.deleteData }

const GOOGLE_GRANT_KEYS = ['kuna.google-granted', 'kuna.google-needed']

/** The page's record of what Google granted and what the files need, which a removal shrinks, so a flow can put it back for the steps after it. */
export async function googleGrants(page) {
  return page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), GOOGLE_GRANT_KEYS)
}

export async function restoreGoogleGrants(page, grants) {
  await page.evaluate((kept) => {
    for (const [key, value] of Object.entries(kept)) {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
  }, grants)
}

/** The failure is first in the dialog's body and on screen, not somewhere below the rows. */
export async function failureInView(page, testId) {
  const seen = await page.$eval(`[data-testid="${testId}"]`, (failure) => {
    const { top, bottom } = failure.getBoundingClientRect()
    return { role: failure.getAttribute('role'), first: failure.parentElement?.firstElementChild === failure, inView: top >= 0 && top < window.innerHeight && bottom > 0 }
  })
  if (seen.role !== 'alert') throw new Error('the failure has no alert role')
  if (!seen.first) throw new Error('the failure is not first in the dialog')
  if (!seen.inView) throw new Error('the failure is out of view')
}

export async function checkboxState(page, testId) {
  return page.$eval(`[data-testid="${testId}"]`, (box) => ({
    checked: box.getAttribute('aria-checked') === 'true' || box.dataset.state === 'checked',
    disabled: box.disabled === true || box.hasAttribute('data-disabled'),
  }))
}

/** Opens the phone's or the tablet's drawer, where the top bar has a menu button. The sidebar needs nothing. */
export async function openMenu(page, press) {
  const button = await page.$('[data-testid="open-navigation"]')
  if (button === null || (await button.boundingBox()) === null) return
  await press(button)
  await page.waitForSelector('[role="dialog"] [data-testid="nav-kuna-settings"]', { visible: true, timeout: 10_000 })
  await delay(300)
}

/**
 * The menu in the sidebar or the open drawer, read in the page: the link home with its Kuna mark in line with the app
 * tiles, whether a line runs under it, the open apps, how the open app's row reads against its pages and a closed row,
 * and what is pinned under them.
 */
export function menuShown() {
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
    homeEntry: scope?.querySelector('[data-testid="nav-home"]')?.textContent?.trim() ?? null,
    homeEntryCurrent: scope?.querySelector('[data-testid="nav-home"]')?.getAttribute('aria-current') === 'page',
    netWorth: scope?.querySelector('[data-testid="nav-net-worth"]')?.textContent?.trim() ?? null,
    addApp: scope?.querySelector('[data-testid="nav-add-app"]')?.textContent?.trim() ?? null,
    drawerArrows: [...document.querySelectorAll('[role="dialog"] [data-testid="nav-arrow"]')].map((arrow) =>
      Math.round(Math.min(arrow.getBoundingClientRect().width, arrow.getBoundingClientRect().height)),
    ),
    kunaSettings: scope?.querySelector('[data-testid="nav-kuna-settings"]')?.textContent?.trim() ?? null,
  }
}

/** The cards of the home, read in the page: which app, whether it waits to be set up, its text, its lead figure and its tone, its tile's colour and where it leads. */
export function homeCards() {
  return [...document.querySelectorAll('[data-testid="home-card"]')].map((card) => ({
    app: card.dataset.app,
    state: card.dataset.state,
    text: card.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    lead: card.querySelector('dt')?.textContent?.trim() ?? null,
    figure: card.querySelector('dd')?.textContent?.trim() ?? null,
    tone: ['text-success', 'text-error'].find((tone) => card.querySelector('dd .figure')?.classList.contains(tone)) ?? null,
    colour: card.querySelector('[data-testid="app-mark"]') === null ? null : getComputedStyle(card.querySelector('[data-testid="app-mark"]')).color,
    href: card.querySelector('[data-testid="home-card-link"]')?.getAttribute('href') ?? null,
  }))
}

/** The apps the home's sidebar lists, read in the page in the shape of `homeCards`, with the name and badge of each row. Null with no sidebar. */
export function homeMenu() {
  if (document.querySelector('aside') === null) return null
  return [...document.querySelectorAll('aside [data-testid="nav-app-link"]')].map((link) => ({
    app: link.dataset.app,
    text: link.querySelector('[data-testid="nav-label"]')?.textContent?.trim() ?? '',
    tiled: link.querySelector('[data-testid="app-mark"]') !== null,
    colour: link.querySelector('[data-testid="app-mark"]') === null ? null : getComputedStyle(link.querySelector('[data-testid="app-mark"]')).color,
    href: link.getAttribute('href'),
  }))
}

/** The home's sidebar lists the apps of its cards that are set up, in their order, each tiled in its card's colour and leading where its card does. */
export function sidebarMatchesCards(menu, cards, words = SCREEN_WORDS.en) {
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

/** Picks a label in a labels field, the existing one by its name or, with `create`, a new one typed into its search, and closes the list. */
export async function pickLabel(page, press, field, name, create, dialog = SPENDING_ENTRY_DIALOG) {
  await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(150)
  await press(field)
  await page.waitForSelector('[role="listbox"]', { visible: true, timeout: 5_000 })
  if (create) await page.keyboard.type(name)
  const option = await page
    .waitForFunction(
      (wanted, typed) => [...document.querySelectorAll('[role="option"]')].find((element) => (typed ? element.textContent?.includes(`"${wanted}"`) : element.textContent?.trim() === wanted)) ?? null,
      { timeout: 5_000 },
      name,
      create,
    )
    .catch(() => {
      throw new Error(create ? `the labels field offers no way to add "${name}"` : `the labels field offers no "${name}"`)
    })
  await press(option.asElement())
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await page.waitForSelector(dialog, { visible: true, timeout: 2_000 }).catch(() => {
    throw new Error('Escape on the labels list closed its dialog')
  })
  const shown = await field.evaluate((element) => element.textContent ?? '')
  if (!shown.includes(name)) throw new Error(`the labels field shows "${shown.trim()}" after picking ${name}`)
  if (!create) return
  await press(field)
  await page.waitForSelector('[role="listbox"]', { visible: true, timeout: 5_000 })
  const typed = await page.evaluate(() => document.querySelector('[role="listbox"]')?.parentElement?.querySelector('input')?.value ?? null)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  if (typed !== '') throw new Error(`the labels list keeps "${typed}" in its search after "${name}" was added`)
}

export const SPENDING_ENTRY_DIALOG = '[data-testid="spending-entry-dialog"]'

/** The choice that lets a file's row take the place of the row the AI copied, third after Decide later and Keep both. */
export const USE_FILE_ROW = 'button:nth-child(3)'

/** Waits for the first element under `selector` whose text holds all of `text`, and returns it. */
export async function waitForTextIn(page, selector, text) {
  if (text.trim() === '') throw new Error(`no text given to wait for under ${selector}`)
  const found = await page
    .waitForFunction(`[...document.querySelectorAll(${JSON.stringify(selector)})].find((element) => (${textHolds})(element.textContent ?? '', ${JSON.stringify(text)})) ?? null`, { timeout: 10_000 })
    .catch(() => {
      throw new Error(`nothing under ${selector} says "${text}" within 10 s`)
    })
  return found.asElement()
}

export async function countOf(page, selector, wanted, what) {
  await page
    .waitForFunction((rows, count) => document.querySelectorAll(rows).length === count, { timeout: 10_000 }, selector, wanted)
    .catch(() => {
      throw new Error(`${what}: not ${wanted} of ${selector}`)
    })
}

export async function fill(page, testId, value) {
  const input = await page.waitForSelector(`[data-testid="${testId}"]`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`no visible ${testId} field within 10 s`)
  })
  await setField(input, value)
}

/** Picks the option of an open select menu whose text starts with `start`. */
export async function chooseStartingWith(page, press, trigger, start) {
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

/** Picks the first or the last option of the select under `trigger`. */
export async function chooseAt(page, press, trigger, end) {
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

/** Opens a dialog with `opener`, waits for `shown` in it, shoots it under `name`, opens each of its menus and closes it with Escape. */
export async function lookAtDialog(page, press, shoot, opener, shown, name, says = null) {
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

/** Moves to another screen of the app without a reload. */
export async function goTo(page, hash, title) {
  await page.evaluate((target) => {
    window.location.hash = target
  }, hash)
  await screenTitled(page, title)
  await delay(300)
}

/** Presses the button inside `container` that reads `label`. */
export async function pressLabelled(page, press, container, label) {
  const button = await page
    .waitForFunction((css, wanted) => [...document.querySelectorAll(`${css} button`)].find((element) => element.textContent?.trim() === wanted) ?? null, { timeout: 5_000 }, container, label)
    .catch(() => {
      throw new Error(`no button "${label}" in ${container}`)
    })
  await press(button.asElement())
  await delay(300)
}

/** Waits for the focus to sit inside the element the selector finds, on the screen without scrolling, as a dialog opened at a field leaves it. */
export async function focusIsIn(page, selector, problem) {
  await page
    .waitForFunction(
      (within) => {
        const focused = document.activeElement
        if (focused?.closest(within) == null) return false
        const box = focused.getBoundingClientRect()
        return box.top >= 0 && box.bottom <= innerHeight
      },
      { timeout: 5_000 },
      selector,
    )
    .catch(() => {
      throw new Error(problem)
    })
}

/**
 * Takes the keyboard's focus to the element by Shift+Tab and Tab and fails unless its focus ring is drawn inside its edge,
 * as a row of a list or a menu needs, since the card or list around it crops what sticks out and its neighbours cover it.
 */
export async function ringSitsInside(page, element, name) {
  await element.evaluate((target) => target.scrollIntoView({ block: 'center' }))
  await element.evaluate((target) => target.focus())
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  await page.keyboard.press('Tab')
  const ring = await element.evaluate((target) => {
    const style = getComputedStyle(target)
    return { focused: document.activeElement === target && target.matches(':focus-visible'), offset: parseFloat(style.outlineOffset), width: parseFloat(style.outlineWidth) }
  })
  if (!ring.focused) throw new Error(`${name} did not take the keyboard's focus back by Tab`)
  if (ring.offset + ring.width > 0) throw new Error(`${name} draws its focus ring ${ring.offset + ring.width}px outside its edge, not inside it`)
}

/** A phone shows a dialog's end only once scrolled to, and a shot takes what is on the screen. */
export async function scrollIntoDialogView(page, selector) {
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'end' }))
  await delay(200)
}

export const ASSIST_WORDS = {
  en: { ...assistEnglish, keyRow: secretsEnglish.keyRow },
  hr: { ...assistCroatian, keyRow: secretsCroatian.keyRow },
}

export const COMPANY_SELECT = '[data-testid="assist-provider-select"]'
export const ALWAYS_ALLOW = '[data-testid="assist-allow"]'
export const APP_ALLOWED = '[data-testid="app-assist-card"] [data-testid="assist-allowed"]'
export const CHAT_CONSENT = '[data-testid="chat-consent"]'

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

/** Waits for a switch to say this state, as it tells a screen reader. */
export async function switchSays(page, selector, on, failure) {
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

/** Sets the chat input to the files, as a person picks them, and waits until none is still being read. */
export async function attachToChat(page, ...paths) {
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

/** Presses a pick box on the list row that names the text, while rows are being picked. */
export async function pickRowNamed(page, press, rows, text) {
  const handle = await page.evaluateHandle(
    (selector, wanted) => [...document.querySelectorAll(selector)].find((row) => row.textContent?.includes(wanted))?.querySelector('[data-testid="list-row-pick"]') ?? null,
    rows,
    text,
  )
  const box = handle.asElement()
  if (box === null) throw new Error(`no row of ${text} to pick`)
  await box.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(150)
  await press(box)
}

/** Opens the select under the selector, searches it for the text and presses the option that holds it, as a long list on a phone needs. */
export async function chooseBySearch(page, press, selector, text) {
  await pressSelector(page, press, selector)
  await page.waitForSelector('[role="listbox"]', { visible: true, timeout: 5_000 })
  await page.keyboard.type(text)
  await delay(300)
  const option = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.includes(wanted)) ?? null, { timeout: 5_000 }, text)
    .catch(() => {
      throw new Error(`searching the select for ${text} offers nothing`)
    })
  await press(option.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

export async function pickedCountIs(page, wanted, what) {
  await page
    .waitForFunction((count) => document.querySelectorAll('[data-testid="list-row-pick"][aria-checked="true"]').length === count, { timeout: 5_000 }, wanted)
    .catch(() => {
      throw new Error(`${what}: not ${wanted} rows picked`)
    })
}

/** Presses the cross that clears an OptionalSelect, found inside its trigger by its own word, which the field's label follows for a screen reader. */
export async function clearChoice(page, press, trigger, language) {
  const label = (language === 'en' ? uiEnglish : uiCroatian).clearChoice
  const cross = await page.waitForSelector(`${trigger} [aria-label="${label}"]`, { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error(`${trigger} shows no ${label} cross`)
  })
  await press(cross)
  await page.waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, `${trigger} [aria-label="${label}"]`)
  await delay(200)
}

/** Waits until a select's trigger reads exactly this text. */
export async function triggerReads(page, trigger, wanted) {
  await page
    .waitForFunction((selector, text) => document.querySelector(selector)?.textContent?.trim() === text, { timeout: 5_000 }, trigger, wanted)
    .catch(async () => {
      throw new Error(`${trigger} reads "${await page.$eval(trigger, (element) => element.textContent?.trim())}", not "${wanted}"`)
    })
}
