/**
 * Add, edit, delete and undo on the row editors, and where the books are kept, shared by the visual
 * and the touch check. `press` clicks or taps an element handle, and `shoot` takes a screenshot
 * under a name. Each flow starts on its screen and leaves the workbook as it found it, except the
 * flows that choose where the books are kept. A failure throws with what was missing.
 */

import { en as companyEnglish, hr as companyCroatian } from '../../src/apps/company/words.ts'
import { en as companySettingsEnglish, hr as companySettingsCroatian } from '../../src/apps/company/settings/presentation/words.ts'
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
import { en as kunaSettingsEnglish, hr as kunaSettingsCroatian } from '../../src/shell/settings/words.ts'
import { en as syncEnglish, hr as syncCroatian } from '../../src/shared/sync/presentation/words.ts'
import { en as storageEnglish, hr as storageCroatian } from '../../src/shared/storage/application/words.ts'
import { en as loansFileEnglish, hr as loansFileCroatian } from '../../src/apps/loans/workbook/presentation/words.ts'
import { en as filesEnglish, hr as filesCroatian } from '../../src/apps/company/workbook-files/presentation/words.ts'
import { en as textEnglish, hr as textCroatian } from '../../src/shared/text/words.ts'
import { en as companyHomeEnglish, hr as companyHomeCroatian } from '../../src/apps/company/home/presentation/words.ts'
import { en as loansHomeEnglish, hr as loansHomeCroatian } from '../../src/apps/loans/home/presentation/words.ts'
import { en as investmentsHomeEnglish, hr as investmentsHomeCroatian } from '../../src/apps/investments/home/presentation/words.ts'
import { en as investmentsOverviewEnglish, hr as investmentsOverviewCroatian } from '../../src/apps/investments/overview/presentation/words.ts'
import { formatMoney } from '../../src/shared/money/moneyFormat.ts'
import { en as mailDomainEnglish, hr as mailDomainCroatian } from '../../src/apps/company/mail/domain/words.ts'

const TOAST = 'li[data-slot="base"]'

/** What the menus, the Loans screens and the Company screens say in each language, from the app's own words. */
const SCREEN_WORDS = {
  en: {
    allApps: sharedEnglish.allApps,
    homeLink: sharedEnglish.homeLink,
    setUp: homeEnglish.setUp,
    kunaSettings: kunaSettingsEnglish.menu,
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
    whatIf: bankLoanEnglish.whatIf,
    transactions: transactionsEnglish,
    rules: rulesEnglish,
    ruleChanges: ruleChangesEnglish.changes,
    categoryName: companyBooksEnglish.unlabelled,
    swatches: companyBooksEnglish.swatches,
    sortBy: uiEnglish.sortBy,
    imports: importEnglish,
    mail: mailEnglish,
    invoicing: invoicingEnglish,
    receivables: receivablesEnglish,
    billing: billingEnglish,
    clientColumns: companySettingsEnglish.clientColumns,
    settings: companySettingsEnglish,
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
    mailCounts: mailDomainEnglish.counts,
    loansHome: loansHomeEnglish,
    investmentsHome: investmentsHomeEnglish,
    investmentsOverview: investmentsOverviewEnglish.title,
    locale: 'en-GB',
  },
  hr: {
    allApps: sharedCroatian.allApps,
    homeLink: sharedCroatian.homeLink,
    setUp: homeCroatian.setUp,
    kunaSettings: kunaSettingsCroatian.menu,
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
    whatIf: bankLoanCroatian.whatIf,
    transactions: transactionsCroatian,
    rules: rulesCroatian,
    ruleChanges: ruleChangesCroatian.changes,
    categoryName: companyBooksCroatian.unlabelled,
    swatches: companyBooksCroatian.swatches,
    sortBy: uiCroatian.sortBy,
    imports: importCroatian,
    mail: mailCroatian,
    invoicing: invoicingCroatian,
    receivables: receivablesCroatian,
    billing: billingCroatian,
    clientColumns: companySettingsCroatian.clientColumns,
    settings: companySettingsCroatian,
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
    mailCounts: mailDomainCroatian.counts,
    loansHome: loansHomeCroatian,
    investmentsHome: investmentsHomeCroatian,
    investmentsOverview: investmentsOverviewCroatian.title,
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

export function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function pressSelector(page, press, selector) {
  const handle = await page.waitForSelector(selector, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`no visible ${selector} within 10 s`)
  })
  await handle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(handle)
  return handle
}

/** Sets a field the way typing does, so Vue's v-model sees it. */
async function setField(input, value) {
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
  const input = await row.$(`input[aria-label="${label}"]`)
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
 * focuses its name, give it a colour from the pop-up, a label on a tab without the column and a
 * role, delete it, and Undo the delete.
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
    await chooseRole(page, press, named, 'representation')
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
    const row = await rowNamed(page, '[data-testid="category-row"]', 'tax-refund')
    await setField(await fieldIn(row, said.columns.family), '')
    await page
      .waitForFunction(
        (required) => [...document.querySelectorAll('[data-testid="category-row"]')][0]?.querySelector('.field-error')?.textContent?.trim() === required,
        { timeout: 5_000 },
        words.settingsReasons.fields.required,
      )
      .catch(() => {
        throw new Error('a blank family shows no error while the table is filtered and sorted')
      })
    if (!(await page.$eval('[data-testid="save-categories"]', (button) => button.disabled))) throw new Error('Save is on while a row is in error')
    await setField(await fieldIn(row, said.columns.family), 'zz-refunds')
    await delay(200)
    await categoriesShow(page, order, 'typing a family that sorts last')
    await choose(page, press, await row.$(`[aria-label="${said.columns.bucket}"]`), said.bucketChoice('income'))
    await categoriesShow(page, order, 'a new bucket outside the filter')
    await page
      .waitForFunction((kept) => document.querySelector('[data-testid="category-kept"]')?.textContent?.trim() === kept, { timeout: 5_000 }, countedIn(words, said.kept(1), 1))
      .catch(() => {
        throw new Error('the count does not say a row shows only for its unsaved change')
      })
    await shoot('categories-edit-filtered')

    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await categoriesShow(page, ['payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax'], 'tax-refund saved in the income bucket')
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
    const second = await setPart(page, 1, typedIn(words, '8.90'))
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
    await setPart(page, 1, typedIn(words, '5.00'))
    await pressSelector(page, press, '[data-testid="split-add-part"]')
    await delay(200)
    const third = (await page.$$('[data-testid="split-part"]'))[2]
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

/** Owner, Taken in the fake file on Drive, which has no hr_company_registered: the tile reads – and its link opens the setting. */
export function ownerNetUnregisteredFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const note = '[data-testid="owner-net-unregistered"]'
    await page.waitForSelector(note, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the tile does not say the profit needs hr_company_registered')
    })
    const value = await page.$eval('[data-testid="owner-net-with-profit"] .text-figure-lg', (element) => element.textContent?.trim() ?? '')
    if (value !== '–') throw new Error(`the tile reads "${value}" without hr_company_registered, not –`)
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
export async function statementSyncFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await noToast(page, 'a sync that filed a statement showed a toast')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
  await page.$eval(SYNC_CARD, (element) => element.scrollIntoView({ block: 'start' }))
  await delay(300)
  await inspect?.('the statements filed')
  await shoot('statements-filed')
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
const MAIL_FILED = /Filed 9, already there 4, 1 correction, 1 not compared, 2 unmatched\./

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

const ALL_SOURCES = ['statements:planned', 'hr-doo.payroll:planned', 'hr-doo.vat-returns:planned', 'hr-doo.invoices:planned']

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
    await elementSays(page, MAIL_CARD, [words.mail.card.title, words.mail.card.lastSync, words.mail.plan.kinds.filed], 'the mail card is not in its language')
    await scrollToTop(page, MAIL_PLAN)
    await inspect?.('the mail list')
    await shoot('mail-list')
  }
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
 * With the bank's and the accountant's mail named, the mail step files the bank's PDF and statement
 * and the accountant's new mail into the fake Drive, and the statements step of the same sync files
 * that statement on the ledger. Its link opens the list on the mail card, which marks what was filed
 * beside what was there already or needs a look, with the accountant's mail fields on the facts card.
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
  const expected = ['Filed 2, already there 2, 1 unmatched.', 'Filed 5, already there 1, 1 unmatched.', 'Filed 1, 1 correction, 1 not compared.', 'Filed 1, already there 1.']
  if (JSON.stringify(lines) !== JSON.stringify(expected)) throw new Error(`the sources read ${JSON.stringify(lines)}`)
  for (const kind of ['filed', 'already', 'correction', 'unchecked', 'unmatched']) {
    if ((await page.$(`${MAIL_PLAN} [data-entry="${kind}"]`)) === null) throw new Error(`the list has no ${kind} entry`)
  }
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list of what the mail step filed and found')
  await shoot('mail-list')

  await syncAndSettle(page, press)
  const again = await mailListShows(page, ALL_SOURCES)
  if (again[0] !== 'Nothing new, already there 3.') throw new Error(`a second sync's bank mail reads "${again[0]}"`)
  await openKunaSettings(page)
  const line = await stepSays(page, SYNC_CARD, 'mail', 'done', /Nothing new, already there 10, 1 unmatched\./)
  if (line.includes('Filed')) throw new Error(`a second sync's mail step says "${line}"`)
  await stepSays(page, SYNC_CARD, 'statements', 'done', /Nothing new/)

  await page.evaluate(() => {
    window.location.hash = '#/company/settings#accountant-mail'
  })
  const sender = await page.waitForSelector('[data-testid="accountant-mail-from"] input', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the facts card has no accountant mail fields at #accountant-mail')
  })
  if ((await sender.evaluate((element) => element.value)) !== 'office@accountant.example.com') throw new Error('the accountant mail field does not show the sender the books name')
  await scrollToTop(page, '[data-testid="accountant-mail"]')
  await inspect?.("the accountant's mail fields")
  await shoot('accountant-mail-fields')
}

/**
 * The upload of every PDF fails beside the other files: the mail step fails with each PDF named by
 * its source, 1 problem in the control, the statement still on the ledger from the same sync, and the
 * list marks the bank's PDF not filed with why.
 */
export async function mailUploadFailedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(
    page,
    '',
    'mail',
    'failed',
    /Filed 5, already there 4, 1 correction, 1 not compared, 2 unmatched\. Bank statements: \d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf was not filed\. Payroll: 2026-09-payment-order-salary\.pdf and 2026-09-payment-order-rent\.pdf were not filed\. Accountant's invoices: 2026-10-03-accounting\.pdf was not filed\./,
  )
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
  await stepSays(page, SYNC_CARD, 'mail', 'done', /Nothing new, already there 5\./)
  await scrollToTop(page, SYNC_CARD)
  await inspect?.('the mail step with nothing new')
  await shoot('mail-nothing-new')
}

/** A source whose search fails fails the mail step with the others' counts in its line: 1 problem in the control, and the steps open on it with the list a link away. */
export async function mailFailedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(page, '', 'mail', 'failed', /Filed 8, already there 4, 2 unmatched\. VAT returns: Gmail did not answer the search/)
  await delay(400)
  await inspect?.('the steps with a mail source that failed')
  await shoot('mail-failed-steps')
  await openMailList(page, press, '')
  const lines = await mailListShows(page, ['statements:planned', 'hr-doo.payroll:planned', 'hr-doo.vat-returns:failed', 'hr-doo.invoices:planned'])
  if (lines[2] !== 'Gmail did not answer the search. Sync again later.') throw new Error(`the failed source reads "${lines[2]}"`)
  await page.$eval(`${MAIL_PLAN} [data-source="hr-doo.vat-returns"]`, (element) => element.scrollIntoView({ block: 'center' }))
  await delay(300)
  await shoot('mail-failed-list')
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
  const filed = `${words.mailCounts({ filed: 1, notFiled: 0, already: 3, corrections: 0, unchecked: 0, unmatched: 1 })}.`
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

/** Opens the facts card on the accountant's mail and scrolls to it. */
async function openAccountantMail(page) {
  await page.evaluate(() => {
    window.location.hash = '#/company/settings#accountant-mail'
  })
  await page.waitForSelector('[data-testid="accountant-mail-from"] input', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the facts card has no accountant mail fields at #accountant-mail')
  })
  await scrollToTop(page, '[data-testid="accountant-mail"]')
}

/**
 * With every kind of the accountant's mail switched off, as new books have them, the mail step reads
 * the bank's mail alone, and the facts card shows the three switches off above their subjects and
 * folders.
 */
export async function mailSwitchesOffFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', /Filed 2, already there 2, 1 unmatched\./)
  await page.evaluate(() => {
    window.location.hash = '#/company/settings#mail'
  })
  await mailListShows(page, ['statements:planned'])
  await openAccountantMail(page)
  for (const kind of ['payroll', 'vat', 'invoices']) await switchIs(page, `${kind}-mail-sync`, false)
  if (await page.$('[data-testid="mail-kind-missing"]')) throw new Error('a kind switched off says what it lacks')
  await inspect?.("the accountant's mail switched off")
  await shoot('mail-switches-off')
}

/**
 * The payroll switched on without the accountant's address fails the mail step with what it lacks:
 * 1 problem in the control, the step's line naming the sender, the list marking the payroll failed,
 * and the facts card saying it under the switch.
 */
export async function mailNoSenderFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(page, '', 'mail', 'failed', /Filed 2, already there 2, 1 unmatched\. Payroll: It is on, but has no sender on Settings, General\./)
  await delay(400)
  await inspect?.('the steps with the payroll switched on without a sender')
  await shoot('mail-no-sender-steps')
  await openMailList(page, press, '')
  const lines = await mailListShows(page, ['statements:planned', 'hr-doo.payroll:failed'])
  if (lines[1] !== 'It is on, but has no sender on Settings, General.') throw new Error(`the payroll reads "${lines[1]}"`)
  await openAccountantMail(page)
  await switchIs(page, 'payroll-mail-sync', true)
  const missing = await page.$eval('[data-testid="payroll-mail-kind"] [data-testid="mail-kind-missing"]', (element) => element.textContent?.trim()).catch(() => null)
  if (missing !== 'It is on, but has no sender.') throw new Error(`the payroll switch says "${missing}" under it`)
  await inspect?.("the payroll switched on without the accountant's address")
  await shoot('mail-no-sender-card')
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
  await page.$eval(`${MAIL_PLAN} [data-testid="mail-stopped"]`, (paragraph) => paragraph.scrollIntoView({ block: 'center' }))
  await delay(300)
  await inspect?.('the mail card after Gmail asked to slow down')
  await shoot('mail-rate-limited-card')
}

/** With every mail already in its folder, filed by another app, each source searches from a week before the newest file there and not from the mail-since day. */
export async function mailWindowFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await page.evaluate(() => {
    window.location.hash = '#/company/settings#mail'
  })
  await mailListShows(page, ALL_SOURCES)
  const windows = await page.$$eval(`${MAIL_PLAN} [data-testid="mail-source-window"]`, (lines) => lines.map((line) => line.textContent?.trim() ?? ''))
  if (windows.length !== 4 || !windows.every((line) => /^Searched from \d{1,2} \w{3,4} 2026, a week before the newest file in its folder$/.test(line)))
    throw new Error(`the sources searched ${JSON.stringify(windows)}`)
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list searched from a week before the newest file in each folder')
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
    await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await inspect?.('the statements folder saved')
    await shoot('statements-folder-saved')
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
    await page.waitForSelector('[role="dialog"] [data-testid="rule-saved"]', { visible: true, timeout: 10_000 })
    await inspect?.('rule saved')
    const early = await page.evaluate((selector) => [...document.querySelectorAll(`${selector} [data-slot="title"]`)].map((title) => title.textContent?.trim()), TOAST)
    if (early.includes(edited)) throw new Error('the save toast shows while the saved rule editor is still open')
    const done = await page.waitForFunction(
      (label) => [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === label) ?? null,
      {},
      words.rules.editor.done,
    )
    await press(done.asElement())
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
async function booksShowDriveFile(page, saved, words) {
  await page.evaluate(() => {
    window.location.hash = '#/company/settings?tab=books'
  })
  await page
    .waitForFunction(() => document.querySelector('[data-testid="drive-file-place"] a')?.textContent?.trim() === 'Books', { timeout: 10_000 })
    .catch(() => {
      throw new Error('Settings, Books file does not name the Books folder the file sits in')
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

/** The folder step: the fake Picker picks Books, the confirm names it as `named`, and Create the file here makes the file. */
async function confirmFolder(page, press, { shoot, inspect }, named) {
  await onboardingAt(page, 'folder')
  await pressSelector(page, press, '[data-testid="company-start-choose-folder"]')
  const confirm = await page.waitForSelector('[data-testid="company-start-folder-confirm"]', { visible: true, timeout: 10_000 })
  const said = await confirm.evaluate((element) => element.textContent ?? '')
  if (!said.includes(named)) throw new Error(`the folder confirm says "${said}", not ${named}`)
  if (!(await page.$('[data-testid="company-start-folder-link"]'))) throw new Error('the folder confirm has no link to the folder in Drive')
  await inspect?.('the folder confirm')
  await shoot(named.includes(' › ') ? 'onboarding-folder-path' : 'onboarding-folder-name')
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
  await pressSelector(page, press, '[data-testid="company-start-choose-folder"]')
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
 * New books on the fake Drive with statements by hand: the access step asks for the books file
 * alone, so the folder confirm names Books with no path, as `drive.file` cannot read its parents.
 * The file's toast names where it was made. The first statement's IBAN becomes the account main,
 * and Overview's Getting set up card asks only for a look over the categories.
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
    await confirmFolder(page, press, { shoot, inspect }, `Books${words.writes.firstRun.folder.unseen}`)
    await toast(page, words.writes.firstRun.folder.created('kuna-company.json', 'Books'))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await inspect?.('the company step')
    await shoot('onboarding-company')
    await backToMade(page, press, 'folder', ['Books', 'kuna-company.json'])
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
    if (JSON.stringify(lines) !== JSON.stringify(['categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}, not the categories alone`)
    await inspect?.('Overview getting set up')
    await shoot('onboarding-overview')
    await dismissToasts(page)
    await booksShowDriveFile(page, true, words)
  }
}

export const onboardingDriveFlow = onboardingDriveFlowIn('en')

/**
 * New books on the fake Drive with statements from a Drive folder: the token carries Drive read, so
 * the folder confirm names the full path, and the toast does too. A Croatian d.o.o. answers Yes in
 * the company step, which asks for no folder of the accountant's, chooses the statements folder in
 * the statement step, skips the statement, and Getting set up lists the first statement and the
 * categories.
 */
export function onboardingDriveReadFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const trail = `${words.myDrive} › Books`
  const { access, statement } = words.onboarding
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'access')
    await chooseOption(page, press, 'onboarding-statements', access.folder)
    await page
      .waitForFunction(() => window.location.hash.includes('statements=folder'), { timeout: 5_000 })
      .catch(() => {
        throw new Error('the statements choice did not reach the address, so a trip to Google would lose it')
      })
    await allowGoogle(page, press, { shoot, inspect }, words)
    await confirmFolder(page, press, { shoot, inspect }, trail)
    await toastMatching(page, exactly(words.writes.firstRun.folder.created('kuna-company.json', trail)))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await chooseOption(page, press, 'onboarding-pack', words.pack.onboarding.yes)
    const asksFolder = await page.$$eval('[data-testid="onboarding-step"] button', (buttons, choose) => buttons.some((button) => button.textContent?.trim() === choose), statement.chooseFolder)
    if (asksFolder) throw new Error('the company step of a Croatian d.o.o. still asks for a folder')
    await inspect?.('the company step of a Croatian d.o.o.')
    await shoot('onboarding-company-pack')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressButton(page, press, '[data-testid="onboarding-statements-folder"] button', statement.chooseFolder)
    await page
      .waitForFunction((wanted) => document.querySelector('[data-testid="onboarding-statements-folder"]')?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, trail)
      .catch(() => {
        throw new Error('the statement step does not show the statements folder chosen')
      })
    await inspect?.('the statement step with the folder chosen')
    await shoot('onboarding-statements-folder')
    await pressSelector(page, press, '[data-testid="onboarding-skip"]')
    await onboardingAt(page, 'overview')
    const lines = await setUpLines(page)
    if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)
    await inspect?.('Getting set up')
    await shoot('onboarding-overview-pack')
  }
}

export const onboardingDriveReadFlow = onboardingDriveReadFlowIn('en')

/**
 * New books on the fake Drive with statements from mail: the access step offers Erste with its
 * sender and mail since at the first day of this year, then another bank typed in, all kept in the
 * address, and asks Google for Gmail read beside the books file and never for Drive read. The folder
 * confirm names the statements folder the app makes beside the books, and the statement step says
 * each sync files the mail there. A sync then files the bank's mail into that folder, and the same
 * sync holds the statement of the account the new books lack, with 1 problem in the sync control.
 */
export function onboardingMailFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { access } = words.onboarding
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const shootMail = (name) => shoot(name.replace(/^onboarding-/, 'onboarding-mail-'))
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'access')
    await chooseOption(page, press, 'onboarding-statements', access.mail)
    const fields = await page.waitForSelector('[data-testid="onboarding-mail"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('From my mail shows no bank and mail since')
    })
    if (!(await fields.evaluate((element) => element.textContent ?? '')).includes('netbanking.support@erstebank.hr')) throw new Error('the Erste preset does not name the address it mails from')
    const since = await page.$eval('input[data-testid="onboarding-mail-since"]', (input) => input.value)
    if (since !== `${new Date().getFullYear()}-01-01`) throw new Error(`mail since starts at ${since}, not the first day of this year`)
    await inspect?.('the access step with mail from Erste')
    await shoot('onboarding-access-mail')
    await choose(page, press, await page.waitForSelector('[data-testid="onboarding-bank"]'), access.anotherBank)
    if (!(await page.$eval('[data-testid="onboarding-google"], [data-testid="onboarding-continue"]', (button) => button.disabled)))
      throw new Error('the access step goes on before another bank is named')
    await setField(await page.waitForSelector('input[data-testid="onboarding-mail-from"]', { visible: true }), 'statements@bank.example.com')
    await setField(await page.waitForSelector('input[data-testid="onboarding-mail-subject"]'), 'Izvadak')
    await page
      .waitForFunction(() => /statements=mail/.test(window.location.hash) && /bank=other/.test(window.location.hash) && /subject=Izvadak/.test(window.location.hash), { timeout: 5_000 })
      .catch(() => {
        throw new Error('the mail typed did not reach the address, so a trip to Google would lose it')
      })
    await shoot('onboarding-access-mail-other')
    await allowGoogle(page, press, { shoot: shootMail, inspect }, words)
    const asked = await page.evaluate(() => JSON.parse(window.localStorage.getItem('kuna.google-needed') ?? '[]'))
    if (JSON.stringify(asked) !== JSON.stringify(['drive.file', 'gmail.readonly'])) throw new Error(`the access step asked Google for ${asked.join(', ')}, not Gmail read beside the books file alone`)
    await onboardingAt(page, 'folder')
    await pressSelector(page, press, '[data-testid="company-start-choose-folder"]')
    await page.waitForSelector('[data-testid="company-start-folder-confirm"] [data-testid="onboarding-folder-statements"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the folder confirm does not name the statements folder the app makes')
    })
    await inspect?.('the folder confirm with the statements folder')
    await shoot('onboarding-folder-mail')
    await pressSelector(page, press, '[data-testid="company-start-create"]')
    await toastMatching(page, exactly(words.writes.firstRun.folder.created('kuna-company.json', 'Books')))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await page.waitForSelector('[data-testid="onboarding-statements-mail"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the statement step does not say where each sync files the mail')
    })
    if (await page.$('[data-testid="onboarding-statements-folder"]')) throw new Error('statements from mail are offered a Drive folder to choose')
    await inspect?.('the statement step with statements from mail')
    await shoot('onboarding-statement-mail')
    await pressSelector(page, press, '[data-testid="onboarding-skip"]')
    await onboardingAt(page, 'overview')
    const lines = await setUpLines(page)
    if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)

    await syncAndSettle(page, press)
    const control = await controlShows(page, 'problems')
    const problems = countedIn(words, words.sync.problems(1), 1)
    if (control.label !== problems) throw new Error(`the sync control says "${control.label}", not ${problems}`)
    await press(await syncButton(page))
    await stepSays(page, '', 'mail', 'done', words.mailFiled)
    await stepSays(page, '', 'statements', 'waits', new RegExp(countedIn(words, words.imports.step.held(1), 1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await delay(400)
    await inspect?.('the first sync of books whose statements come from mail')
    await shoot('onboarding-mail-sync')
  }
}

export const onboardingMailFlow = onboardingMailFlowIn('en')

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
    await page.waitForSelector('[data-testid="onboarding-home"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Start over did not bring back the choice of where the books live')
    })
    await onboardingAt(page, 'home')
    if (await page.$('[data-testid="onboarding-made"]')) throw new Error('the home step still shows the books made after Start over')
    await chooseOption(page, press, 'onboarding-home', home.browser)
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'company')
    await setField(await page.waitForSelector('input[data-testid="onboarding-company-name"]'), 'Example Studio')
    await inspect?.('the company step')
    await shoot('onboarding-company-browser')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    if (await page.$('[data-testid="onboarding-statements-folder"]')) throw new Error('books kept in this browser are offered a statements folder')
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
  const unseen = `Books${words.writes.firstRun.folder.unseen.split('.')[0]}`
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
    await confirmFolder(page, press, { shoot, inspect }, unseen)
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
  const unseen = `Books${words.writes.firstRun.folder.unseen.split('.')[0]}`
  const created = exactly(words.writes.firstRun.folder.created('kuna-company.json', 'Books'))
  const trash = made.trash('kuna-company.json')
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot: () => {} }, words)
    await confirmFolder(page, press, { shoot: () => {} }, unseen)
    await toastMatching(page, created)
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await backToMade(page, press, 'folder', ['Books', 'kuna-company.json'])
    await startOverAsks(page, press, [trash, made.trashNote, made.holds(0, 1000).split('1000')[0]])
    await inspect?.('Start over asking before it trashes the books')
    await pressSelector(page, press, '[data-testid="onboarding-keep-books"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    if (!(await page.$('[data-testid="onboarding-made"]'))) throw new Error('Keep them dropped the books')
    await startOverAsks(page, press, [trash])
    await confirmStartOver(page, press)
    await page.waitForSelector('[data-testid="company-start-choose-folder"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Start over did not bring back the choice of a folder')
    })
    if (await page.$('[data-testid="onboarding-made"]')) throw new Error('the folder step still shows the books made after Start over')
    await inspect?.('the folder step after Start over')
    await shoot('onboarding-start-over')
    await confirmFolder(page, press, { shoot: () => {} }, unseen)
    await toastMatching(page, created)
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
    await booksShowDriveFile(page, false, words)
    await inspect?.('Settings, Books file once the books on Drive are open')
  }
}

export const moveOntoDriveFlow = moveOntoDriveFlowIn('en')

/**
 * Settings, Books file: the books kept in this browser move to a new file on the fake Drive through
 * onboarding's access and folder steps. The access step asks for the Drive read their statements
 * folder needs, so the folder confirm names the full path, and the sync control
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
    await confirmFolder(page, press, { shoot, inspect }, `${words.myDrive} › Books`)
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
 * The statement step of statements from a Drive folder on a page whose token lacks Drive read, as
 * after a reload: Choose folder asks Google in the same tap before the Picker, so the folder comes
 * back with its path, and nothing points to a sync control onboarding does not show.
 */
export function onboardingStatementAccessFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const trail = `${words.myDrive} › Books`
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.evaluate(() => localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'gmail.compose'])))
    await page.reload({ waitUntil: 'networkidle0' })
    await onboardingAt(page, 'statement')
    await pressButton(page, press, '[data-testid="onboarding-statements-folder"] button', words.onboarding.statement.chooseFolder)
    await page
      .waitForFunction((wanted) => document.querySelector('[data-testid="onboarding-statements-folder"]')?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, trail)
      .catch(async () => {
        const said = await page.$eval(STEP, (element) => element.textContent ?? '')
        throw new Error(`the statement step does not show the folder chosen with its path, it says: ${said}`)
      })
    const syncControl = { en: 'sync control', hr: 'Gumb za sinkronizaciju' }[language]
    if ((await page.$eval(STEP, (element) => element.textContent ?? '')).includes(syncControl)) throw new Error('the statement step points to the sync control')
    const granted = await page.evaluate(() => JSON.parse(localStorage.getItem('kuna.google-granted') ?? '[]'))
    if (!granted.includes('drive.readonly')) throw new Error(`Choose folder asked Google for ${granted.join(', ')}, without Drive read`)
    await inspect?.('the statement step once Drive read was asked in the tap')
    await shoot('onboarding-statement-access')
    await page.evaluate(() => localStorage.removeItem('kuna.google-granted'))
  }
}

export const onboardingStatementAccessFlow = onboardingStatementAccessFlowIn('en')

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
async function elementSays(page, selector, texts, failure) {
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
    await page.waitForSelector('[data-testid="salaries-paydays"] [data-payday="2026-04"][aria-pressed="true"]', { timeout: 10_000 }).catch(() => {
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
  await pressButton(page, press, '[data-testid="nav-apart"] a', words.loansSettings)
  await screenTitled(page, words.loansSettings)
  await page
    .waitForFunction((card, wanted) => document.querySelector(`[data-testid="${card}"]`)?.textContent?.includes(wanted) === true, { timeout: 10_000 }, `${app.id}-books-card`, says)
    .catch(() => {
      throw new Error(`the ${app.name} books card does not say "${says}"`)
    })
}

const LOANS = { id: 'loans', name: 'Loans' }
const INVESTMENTS = { id: 'investments', name: 'Investments' }

/**
 * The Investments first run with the company books on the fake Drive: Investments opens on it, a new file on the fake
 * Drive lands in Books as kuna-investments.json, the Investments Overview says it holds no transactions yet, and the
 * Investments Settings names the file.
 */
export async function investmentsDriveFlow(page, { press, shoot, inspect }) {
  await firstRunAt(page, INVESTMENTS, 'home')
  await inspect?.('the Investments first run')
  await shoot('investments-start')
  await chooseOption(page, press, 'investments-start-home', 'A new file on Google Drive')
  await pressSelector(page, press, '[data-testid="investments-start-continue"]')
  await firstRunAt(page, INVESTMENTS, 'folder')
  await pressSelector(page, press, '[data-testid="investments-start-choose-folder"]')
  const confirm = await page.waitForSelector('[data-testid="investments-start-folder-confirm"]', { visible: true, timeout: 10_000 })
  const said = await confirm.evaluate((element) => element.textContent ?? '')
  if (!said.includes('Books') || !said.includes('kuna-investments.json')) throw new Error(`the folder confirm says "${said}", not Books and kuna-investments.json`)
  await inspect?.('the Investments folder confirm')
  await shoot('investments-start-folder')
  await pressSelector(page, press, '[data-testid="investments-start-create"]')
  await toastMatching(page, /^Created kuna-investments\.json in (My Drive › )?Books$/)
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

/**
 * Investments Settings, Prices, on the sample: a Twelve Data key typed and saved shows only how it ends and empties its
 * field, Test asks the fake build's responder and says the key works, and Remove forgets it. Fetch now then fetches
 * the ECB's rates from the responder and lists the listings it got nothing for without their keys.
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
  const kept = await page.evaluate(() => localStorage.getItem('kuna.price-vendor-key.twelvedata'))
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
  const forgotten = await page.evaluate(() => localStorage.getItem('kuna.price-vendor-key.twelvedata'))
  if (forgotten !== null) throw new Error('Remove left the key in this browser')
  await pressSelector(page, press, '[data-testid="prices-fetch-now"]')
  await toastMatching(page, /^Prices fetched$/)
  await pageSays(page, 'The last fetch got nothing for 4 series', true)
  await pageSays(page, 'No Twelve Data key in this browser.', true)
  await inspect?.('the prices fetched without a listing key')
  await dismissToasts(page)
}

/**
 * The Loans first run with the company books on the fake Drive: Loans opens on it, a new file on the
 * fake Drive lands in Books as kuna-loans.json, the Loans Overview says it holds no loans yet, and the
 * Loans Settings names the file.
 */
export function loansDriveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { created } = words.writes.firstRun.folder
  const createdIn = new RegExp(`${exactly(created('kuna-loans.json', 'Books')).source}|${exactly(created('kuna-loans.json', `${words.myDrive} › Books`)).source}`)
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await firstRunAt(page, LOANS, 'home')
    await inspect?.('the Loans first run')
    await shoot('loans-start')
    await chooseOption(page, press, 'loans-start-home', words.writes.firstRun.home.drive)
    await pressSelector(page, press, '[data-testid="loans-start-continue"]')
    await firstRunAt(page, LOANS, 'folder')
    await pressSelector(page, press, '[data-testid="loans-start-choose-folder"]')
    const confirm = await page.waitForSelector('[data-testid="loans-start-folder-confirm"]', { visible: true, timeout: 10_000 })
    const said = await confirm.evaluate((element) => element.textContent ?? '')
    if (!said.includes('Books') || !said.includes('kuna-loans.json')) throw new Error(`the folder confirm says "${said}", not Books and kuna-loans.json`)
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

/** The Loans first run with the company books in this browser: a new Loans file in this browser, which the Loans Settings offers to export. */
export function loansBrowserFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await firstRunAt(page, LOANS, 'home')
    await chooseOption(page, press, 'loans-start-home', words.writes.firstRun.home.browser)
    await pressSelector(page, press, '[data-testid="loans-start-continue"]')
    await firstRunAt(page, LOANS, 'overview')
    await pageSays(page, words.loansOverview.empty.inBrowser, true)
    await inspect?.('the empty Loans Overview in this browser')
    await shoot('loans-overview-browser')
    await settingsShowFile(page, press, LOANS, words.writes.localFile.kept, words)
    await inspect?.('the Loans Settings in this browser')
    await shoot('loans-settings-browser')
  }
}

export const loansBrowserFlow = loansBrowserFlowIn('en')

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

/** A new Loans file on Drive on a device that has not chosen the one another device made: the folder step refuses a second file and offers the find step, which opens it. */
export function loansStartOnDriveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await firstRunAt(page, LOANS, 'folder')
    await pressSelector(page, press, '[data-testid="loans-start-choose-folder"]')
    const alert = await page.waitForSelector('[data-testid="loans-start-on-drive"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the Loans folder step does not say Drive already holds the Loans file')
    })
    const said = await alert.evaluate((element) => element.textContent ?? '')
    const refusal = words.storage.alreadyOnDrive('kuna-loans.json')
    if (!said.includes(refusal)) throw new Error(`the Loans folder step says "${said}", not ${refusal}`)
    if (await page.$('[data-testid="loans-start-failure"]')) throw new Error('the Loans folder step shows the refusal as a failure too')
    await inspect?.('the Loans folder step when Drive holds the file')
    await shoot('loans-start-on-drive')
    await pressSelector(page, press, '[data-testid="loans-start-open-on-drive"]')
    await firstRunAt(page, LOANS, 'find')
    await inspect?.('the Loans find step')
    await pressSelector(page, press, '[data-testid="loans-start-find"]')
    await toastMatching(page, exactly(words.loansFile.opened('kuna-loans.json')))
    await firstRunAt(page, LOANS, 'overview')
  }
}

export const loansStartOnDriveFlow = loansStartOnDriveFlowIn('en')

/** Opens the phone's or the tablet's drawer, where the top bar has a menu button. The sidebar needs nothing. */
async function openMenu(page, press) {
  const button = await page.$('[data-testid="open-navigation"]')
  if (button === null || (await button.boundingBox()) === null) return
  await press(button)
  await page.waitForSelector('[role="dialog"] [data-testid="nav-apart"]', { visible: true, timeout: 10_000 })
  await delay(300)
}

/**
 * The menu in the sidebar or the open drawer, read in the page: the link home, whether its Kuna mark is
 * centred and larger than every app tile, and whether a line runs under it, the app's heading with its
 * size against a menu item's and its tile in line with the items' icons, its entries and what is set apart.
 */
function menuShown() {
  const shown = (element) => element.getClientRects().length > 0
  const scope = document.querySelector('[role="dialog"]') ?? document.querySelector('aside')
  const home = scope?.querySelector('[data-testid="home-link"]') ?? null
  const groups = [...(scope?.querySelectorAll('[data-testid="nav-group"]') ?? [])].filter(shown)
  const group = groups[0] ?? null
  const heading = group?.querySelector('[data-testid="nav-heading"]') ?? null
  const firstEntry = group?.querySelector('a') ?? null
  const mark = home?.querySelector('svg') ?? null
  const tile = group?.querySelector('[data-testid="app-mark"]') ?? null
  const middle = (element) => {
    const box = element.getBoundingClientRect()
    return box.left + box.width / 2
  }
  const ruledUnder = (start) => {
    for (let node = start; node !== null && node !== scope && !node.contains(group); node = node.parentElement) {
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
            centred: mark !== null && Math.abs(middle(mark) - middle(scope)) <= 2,
            largest: mark !== null && [...scope.querySelectorAll('[data-testid="app-mark"]')].every((other) => other.getBoundingClientRect().width < mark.getBoundingClientRect().width),
          },
    ruled: home !== null && group !== null && ruledUnder(home),
    groups: groups.length,
    name: heading?.textContent?.trim() ?? null,
    tiled: tile !== null,
    tileInLine:
      tile !== null && firstEntry !== null && Math.abs(tile.getBoundingClientRect().left - firstEntry.getBoundingClientRect().left - parseFloat(getComputedStyle(firstEntry).paddingLeft)) <= 1,
    subtitle: group?.querySelectorAll('p')[1]?.textContent?.trim() ?? null,
    sizes:
      heading === null || firstEntry === null
        ? null
        : {
            heading: parseFloat(getComputedStyle(heading).fontSize),
            entry: parseFloat(getComputedStyle(firstEntry).fontSize),
            gap: Math.round(firstEntry.getBoundingClientRect().top - heading.parentElement.parentElement.getBoundingClientRect().bottom),
          },
    entries: [...(group?.querySelectorAll('a') ?? [])].map((link) => link.textContent?.trim() ?? ''),
    apps: [...(scope?.querySelectorAll('[data-testid="nav-apps"] a') ?? [])].filter(shown).map((link) => link.dataset.app),
    current: scope?.querySelector('a[aria-current="page"]')?.textContent?.trim() ?? null,
    apart: [...(scope?.querySelectorAll('[data-testid="nav-apart"] a') ?? [])].map((link) => link.textContent?.trim() ?? ''),
  }
}

/** The menu opens with the link home: the Kuna mark centred over Kuna and larger than every app tile, the whole block named as the words say. */
function markLeads(menu, words, where) {
  const home = menu.home
  if (home === null || home.name !== words.homeLink || home.tooltip !== words.homeLink || home.shown !== 'Kuna' || !home.first)
    throw new Error(`${where} does not start with the link home named ${words.homeLink}: ${JSON.stringify(home)}`)
  if (!home.centred || !home.largest) throw new Error(`the Kuna mark in ${where} is not centred and larger than every app tile: ${JSON.stringify(home)}`)
}

/** The menu of the app on screen leads with its name as a heading, larger than its items and clear of them, its tile in line with their icons, under a line below the link home. */
function headingStandsOut(menu, app) {
  if (!menu.ruled) throw new Error(`no line runs under the link home over the ${app} menu`)
  if (!menu.tileInLine) throw new Error(`the ${app} heading's tile is not in line with its menu items' icons`)
  if (menu.sizes === null || menu.sizes.heading <= menu.sizes.entry) throw new Error(`the ${app} heading is not larger than its menu items: ${JSON.stringify(menu.sizes)}`)
  if (menu.sizes.gap < 10) throw new Error(`the ${app} heading sits ${menu.sizes.gap} px over its first menu item`)
  if (menu.apps.length > 0) throw new Error(`the ${app} menu also lists the apps ${menu.apps.join(', ')}`)
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
  return [...document.querySelectorAll('aside [data-testid="nav-apps"] a')].map((link) => ({
    app: link.dataset.app,
    state: link.dataset.state,
    text: [...link.children]
      .map((part) => part.textContent?.trim() ?? '')
      .filter((part) => part !== '')
      .join(' '),
    tiled: link.querySelector('[data-testid="app-mark"]') !== null,
    colour: link.querySelector('[data-testid="app-mark"]') === null ? null : getComputedStyle(link.querySelector('[data-testid="app-mark"]')).color,
    href: link.getAttribute('href'),
  }))
}

/** The home's sidebar lists the apps of its cards in their order, each tiled in its card's colour, leading where its card does, and named with the badge its state calls for. */
function sidebarMatchesCards(menu, cards, words = SCREEN_WORDS.en) {
  const names = { company: words.company, loans: words.loans, investments: words.investments }
  const want = cards.map((card) => ({
    app: card.app,
    state: card.state,
    text: card.state === 'set-up' ? `${names[card.app]} ${words.setUp}` : names[card.app],
    tiled: true,
    colour: card.colour,
    href: card.href,
  }))
  if (JSON.stringify(menu) !== JSON.stringify(want)) throw new Error(`the home's sidebar lists ${JSON.stringify(menu)}, not the cards' apps ${JSON.stringify(want)}`)
}

/**
 * Inside an app only its own menu, in the sidebar or the drawer: the Kuna mark centred first as the link
 * home, named Kuna, all apps, with a line under it, then Loans as a heading larger than Overview,
 * Overview and Scenarios under it, Settings set apart, and the browser tab naming the app. The link home shows the
 * home, whose sidebar lists every app over Kuna settings, and the phone's top bar there has no menu
 * button. From the home, Company shows only its own menu.
 */
export function appMenuFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot, inspect }) => {
    await openMenu(page, press)
    const loans = await page.evaluate(menuShown)
    markLeads(loans, words, 'the Loans menu')
    if (!loans.tiled) throw new Error('the Loans menu heading has no icon tile')
    if (loans.groups !== 1 || loans.name !== words.loans) throw new Error(`the Loans menu shows ${loans.groups} groups, the first ${loans.name}`)
    headingStandsOut(loans, words.loans)
    if (loans.subtitle !== null) throw new Error(`Loans shows "${loans.subtitle}" under its heading`)
    if (JSON.stringify(loans.entries) !== JSON.stringify([words.overview, words.scenarios]) || loans.current !== words.overview)
      throw new Error(`Loans lists ${loans.entries.join(', ')} with ${loans.current} marked`)
    if (JSON.stringify(loans.apart) !== JSON.stringify([words.loansSettings])) throw new Error(`Loans sets apart ${loans.apart.join(', ')}`)
    const loansTitle = await page.title()
    if (loansTitle !== `${words.overview}, ${words.loans} – Kuna`) throw new Error(`the browser tab says "${loansTitle}"`)
    await inspect?.('the Loans menu')
    await shoot(language === 'en' ? 'app-menu-loans' : `app-menu-loans-${language}`)

    await pressSelector(page, press, '[data-testid="home-link"]')
    await screenTitled(page, words.allApps)
    const homeTitle = await page.title()
    if (homeTitle !== 'Kuna') throw new Error(`the browser tab on the home says "${homeTitle}"`)
    const bar = await page.evaluate(() => ({
      menuButton: document.querySelector('[data-testid="open-navigation"]') !== null,
      sidebar: document.querySelector('aside') !== null,
      topBar: document.querySelector('[data-testid="top-bar-title"]')?.textContent?.trim() ?? null,
      settings: [...document.querySelectorAll('aside [data-testid="nav-apart"] a, [data-testid="home-kuna-settings"]')]
        .filter((link) => link.getClientRects().length > 0)
        .map((link) => link.textContent?.trim()),
    }))
    if (bar.menuButton) throw new Error('the home has a menu button')
    if (!bar.sidebar && bar.topBar !== null && bar.topBar !== 'Kuna') throw new Error(`the phone top bar on the home says "${bar.topBar}"`)
    if (JSON.stringify(bar.settings) !== JSON.stringify([words.kunaSettings])) throw new Error(`the home offers ${JSON.stringify(bar.settings)} instead of ${words.kunaSettings} once`)
    if (bar.sidebar) {
      const home = await page.evaluate(menuShown)
      if (home.groups !== 0) throw new Error("the sidebar on the home shows an app's menu")
      markLeads(home, words, "the home's sidebar")
      sidebarMatchesCards(await page.evaluate(homeMenu), await page.evaluate(homeCards), words)
    }
    await inspect?.('the home')

    await pressSelector(page, press, '[data-testid="home-card"][data-app="company"]')
    await screenTitled(page, words.companyOverview)
    await openMenu(page, press)
    const company = await page.evaluate(menuShown)
    if (company.groups !== 1 || company.name !== words.company) throw new Error(`the Company menu shows ${company.groups} groups, the first ${company.name}`)
    markLeads(company, words, 'the Company menu')
    headingStandsOut(company, words.company)
    if (
      !company.entries.includes(words.companyOverview) ||
      !company.entries.some((entry) => entry.startsWith(words.transactions.title)) ||
      company.entries.some((entry) => entry === words.companySettings)
    )
      throw new Error(`Company lists ${company.entries.join(', ')}`)
    if (JSON.stringify(company.apart) !== JSON.stringify([words.companySettings])) throw new Error(`Company sets apart ${company.apart.join(', ')}`)
    const companyTitle = await page.title()
    if (companyTitle !== `${words.companyOverview}, ${words.company} – Kuna`) throw new Error(`the browser tab says "${companyTitle}"`)
    await inspect?.('the Company menu')
    await shoot(language === 'en' ? 'app-menu-company' : `app-menu-company-${language}`)
  }
}

export const appMenuFlow = appMenuFlowIn('en')

/** The cents of the first amount in euros a text writes, in the way the language writes money. */
function centsIn(text, language) {
  const amount = (language === 'en' ? /€[\d,]+(?:\.\d{2})?/ : /[\d.]+(?:,\d{2})?\s?€/).exec(text)?.[0]
  return amount === undefined ? Number.NaN : Number(amount.replace(/\D/g, ''))
}

/**
 * The home with the books of Company, Loans and Investments open: Company's card leads with the cash on hand
 * Overview shows and opens it, the Loans card with what you owe in all, which the Loans Overview says too, and the Investments card with the value, which its Overview's Value tile says too, and the total gain with its sign. Each
 * card tiles its icon in a colour of its own. From 1024 px the sidebar lists every app as their cards do, and its
 * Company row opens Overview.
 */
export function homeFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const cards = await page.evaluate(homeCards)
    const [company, loans, investments] = cards
    if (cards.length !== 3 || company.app !== 'company' || loans.app !== 'loans' || investments.app !== 'investments')
      throw new Error(`the home shows ${JSON.stringify(cards.map((card) => card.app))}, not Company, Loans and Investments`)
    if (company.state !== 'open' || !company.text.includes(words.companyHome.cashOnHand) || !/€/.test(company.figure ?? '')) throw new Error(`the Company card reads "${company.text}"`)
    if (loans.state !== 'open' || !loans.text.includes(words.loansHome.owed) || !/€/.test(loans.figure ?? '')) throw new Error(`the Loans card reads "${loans.text}"`)
    const gain = new RegExp(`${words.investmentsHome.totalGain}[+−]?(?:€|\\d)`)
    if (investments.state !== 'open' || !investments.text.includes(words.investmentsHome.value) || !gain.test(investments.text) || !/€/.test(investments.figure ?? ''))
      throw new Error(`the Investments card reads "${investments.text}"`)
    const colours = cards.map((card) => card.colour)
    if (colours.includes(null) || new Set(colours).size !== colours.length) throw new Error(`the cards tile their icons in ${colours.join(', ')}, not one colour each`)
    const menu = await page.evaluate(homeMenu)
    if (menu !== null) sidebarMatchesCards(menu, cards, words)
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
      .waitForFunction(() => document.querySelector('[data-testid="loans-total"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null, { timeout: 10_000 })
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

    if (menu === null) return
    await goHome(page, press, words)
    await pressSelector(page, press, 'aside [data-testid="nav-apps"] a[data-app="company"]')
    await screenTitled(page, words.companyOverview)
    const title = `${words.companyOverview}, ${words.company} – Kuna`
    if ((await page.title()) !== title) throw new Error(`the Company row in the home's sidebar opened "${await page.title()}"`)
  }
}

export const homeFlow = homeFlowIn('en')

/**
 * A fresh device opens the home with every app in Set up. Loans and Investments can be set up first: each card opens
 * its first run, whose link home comes back, and the Company card opens the company's welcome.
 */
export function setUpFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const cards = await page.evaluate(homeCards)
    if (cards.length !== 3 || cards.some((card) => card.state !== 'set-up' || !card.text.includes(words.setUp)))
      throw new Error(`the fresh home shows ${JSON.stringify(cards.map((card) => [card.app, card.state]))}`)
    if (await page.evaluate(() => document.querySelector('[data-testid="sync-status"]') !== null)) throw new Error('the fresh home shows a sync control')
    const menu = await page.evaluate(homeMenu)
    if (menu !== null) sidebarMatchesCards(menu, cards, words)
    await inspect?.('the home on a fresh device')
    await shoot('home-set-up')

    for (const [app, name] of [
      [LOANS, words.loans],
      [INVESTMENTS, words.investments],
    ]) {
      await pressSelector(page, press, `[data-testid="home-card"][data-app="${app.id}"]`)
      await firstRunAt(page, app, 'home')
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
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await fill(page, 'what-if-amount', '10000')
    await fill(page, 'what-if-date', '2027-06-20')
    await elementSays(page, '[data-testid="what-if-outcomes"]', [whatIf.shorter, whatIf.lower, whatIf.interestSaved, whatIf.newInstalment], 'the what-if does not show both effects')
    await elementSays(page, '[data-testid="what-if-subsidy"]', [whatIf.subsidyTitle], 'the what-if does not warn about the subsidy')
    const panel = await page.$('[data-testid="what-if"]')
    await panel.evaluate((element) => element.scrollIntoView({ block: 'start' }))
    await delay(200)
    await inspect?.('the what-if panel')
    await shoot('loans-what-if')
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

/** The sample Loans file's scenarios of Home loan and its offers, by their bare UUIDs. */
const SAMPLE_SCENARIOS = {
  nextSpring: 'fa4e0000-0000-4000-8000-000000000020',
  everyMonth: 'fa4e0000-0000-4000-8000-000000000021',
  move: 'fa4e0000-0000-4000-8000-000000000022',
  coastal: 'fa4e0000-0000-4000-8000-000000000024',
}

/** The keys of the scenarios Scenarios shows a card for, in their order. */
function scenarioCards(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-testid="scenario-card"]')].map((card) => card.dataset.scenario))
}

async function cardsAre(page, wanted, failure) {
  await page
    .waitForFunction(
      (keys) => JSON.stringify([...document.querySelectorAll('[data-testid="scenario-card"]')].map((card) => card.dataset.scenario)) === JSON.stringify(keys),
      { timeout: 10_000 },
      wanted,
    )
    .catch(async () => {
      throw new Error(`${failure}: the cards are ${JSON.stringify(await scenarioCards(page))}`)
    })
}

/** How many figures the total line of Side by side holds, as cells of the table or two by two on a phone. */
function totalFigures(page) {
  return page.evaluate(() => document.querySelectorAll('[data-line="total"] td, [data-line="total"] [data-column]').length)
}

/**
 * Scenarios with the sample file: A and three scenarios of Home loan side by side, each line with its
 * four figures. Unpicking C leaves B and D their letters and repicking fills C again. Comparing
 * against B moves the Base mark. Deleting C takes it off the list and Undo brings it back.
 */
export async function loansScenariosFlow(page, { press, shoot, inspect }) {
  const stands = 'as-it-stands'
  const { nextSpring, everyMonth, move } = SAMPLE_SCENARIOS
  await cardsAre(page, [stands, nextSpring, everyMonth, move], 'Scenarios does not compare A with the first three scenarios')
  const figures = await totalFigures(page)
  if (figures !== 4) throw new Error(`the total line of Side by side holds ${figures} figures, not 4`)
  await inspect?.('Scenarios')
  await shoot('loans-scenarios-flow')

  await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${everyMonth}"]`)
  await cardsAre(page, [stands, nextSpring, move], 'unpicking C did not take its card away')
  await elementSays(page, `[data-testid="scenario-card"][data-scenario="${move}"]`, ['D'], 'D lost its letter when C was unpicked')
  if (!(await page.evaluate(() => window.location.hash.includes(',,')))) throw new Error('the freed slot is not kept in the address')
  await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${everyMonth}"]`)
  await cardsAre(page, [stands, nextSpring, everyMonth, move], 'repicking C did not fill its slot')

  await chooseStartingWith(page, press, '[data-testid="scenario-base"]', 'B ·')
  await elementSays(page, `[data-testid="scenario-card"][data-scenario="${nextSpring}"]`, ['Base'], 'B is not marked the base')
  await inspect?.('Scenarios against B')
  await shoot('loans-scenarios-base')

  const rows = () => page.evaluate(() => document.querySelectorAll('[data-testid="scenario-row"]').length)
  const before = await rows()
  await pressSelector(page, press, `[data-testid="scenario-row"][data-scenario="${everyMonth}"] [data-testid="scenario-delete"]`)
  await toast(page, 'Scenario deleted')
  await page
    .waitForFunction((count) => document.querySelectorAll('[data-testid="scenario-row"]').length === count, { timeout: 10_000 }, before - 1)
    .catch(() => {
      throw new Error('Delete left the scenario on the list')
    })
  await undo(page, press)
  await page
    .waitForFunction((count) => document.querySelectorAll('[data-testid="scenario-row"]').length === count, { timeout: 10_000 }, before)
    .catch(() => {
      throw new Error('Undo did not bring the scenario back')
    })
  await dismissToasts(page)
}

/**
 * A new scenario of Home loan from New scenario: a regular extra payment typed into its block, whose
 * headline in the dialog's foot changes with the amount, saved and listed, then deleted again.
 */
export async function loansScenarioEditorFlow(page, { press, shoot, inspect }) {
  await pressSelector(page, press, '[data-testid="scenario-new"]')
  await page.waitForSelector('[data-testid="new-scenario-form"]', { visible: true })
  await fill(page, 'new-scenario-name', '€200 a month')
  await pressSelector(page, press, '[data-testid="new-scenario-next"]')
  await page.waitForSelector('[data-testid="scenario-editor"]', { visible: true })
  await pressSelector(page, press, '[data-testid="scenario-add-regular-extra-payment"]')
  await fill(page, 'scenario-change-amount', '200')
  const headline = () => page.$eval('[data-testid="scenario-headline"]', (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '').catch(() => '')
  await page
    .waitForFunction(() => document.querySelector('[data-testid="scenario-headline"]')?.textContent?.includes('less interest'), { timeout: 10_000 })
    .catch(async () => {
      throw new Error(`the foot does not give the headline, it says "${await headline()}"`)
    })
  const first = await headline()
  await delay(200)
  await inspect?.('the scenario editor with a regular extra payment')
  await shoot('loans-scenario-editor')
  await fill(page, 'scenario-change-amount', '400')
  await page
    .waitForFunction((was) => (document.querySelector('[data-testid="scenario-headline"]')?.textContent ?? '').replace(/\s+/g, ' ').trim() !== was, { timeout: 10_000 }, first)
    .catch(() => {
      throw new Error(`the headline stayed "${first}" when the amount doubled`)
    })
  await pressSelector(page, press, '[data-testid="scenario-save"]')
  await toast(page, 'Scenario added')
  await dialogGone(page, '[data-testid="scenario-editor"]')
  await elementSays(page, '[data-testid="scenario-list"]', ['€200 a month', 'Not compared'], 'the new scenario is not listed')
  await dismissToasts(page)
  const added = await page.evaluate(() => [...document.querySelectorAll('[data-testid="scenario-row"]')].find((row) => row.textContent?.includes('€200 a month'))?.dataset.scenario ?? null)
  await pressSelector(page, press, `[data-testid="scenario-row"][data-scenario="${added}"] [data-testid="scenario-delete"]`)
  await toast(page, 'Scenario deleted')
  await dismissToasts(page)
}

/** The house-and-car Loans file's Car loan tab on Scenarios, which has no scenarios. */
export const CAR_LOAN_SCENARIOS = '#/loans/scenarios?tab=fa4e0000-0000-4000-8000-000000000030'

/**
 * Car loan's tab with no scenarios and no `?compare=`: Try €5,000.00 extra opens the editor on the
 * payment, and the saved scenario is compared as B beside A rather than left out.
 */
export async function loansTryExtraFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector('[data-testid="scenarios-empty"]', { visible: true })
  await pressButton(page, press, '[data-testid="scenarios-empty"] button', 'Try ')
  await page.waitForSelector('[data-testid="scenario-editor"]', { visible: true })
  await pressSelector(page, press, '[data-testid="scenario-save"]')
  await toast(page, 'Scenario added')
  await dialogGone(page, '[data-testid="scenario-editor"]')
  await page
    .waitForFunction(() => document.querySelectorAll('[data-testid="scenario-card"]').length === 2, { timeout: 10_000 })
    .catch(async () => {
      throw new Error(`the tried payment is not compared beside A: the cards are ${JSON.stringify(await scenarioCards(page))}`)
    })
  const [first] = await scenarioCards(page)
  if (first !== 'as-it-stands') throw new Error(`the first card is ${first}, not the loan as it stands`)
  if (await page.evaluate(() => document.querySelector('[data-testid="scenario-list"]')?.textContent?.includes('Not compared') ?? true)) {
    throw new Error('the list says the tried payment is not compared')
  }
  await inspect?.('the tried payment compared')
  await shoot('loans-scenarios-tried')
  await dismissToasts(page)
}

/** The what-if's Save as scenario keeps the tried payment as a scenario and opens it on Scenarios, picked. */
export async function loansWhatIfScenarioFlow(page, { press, shoot, inspect }) {
  await fill(page, 'what-if-amount', '3000')
  await fill(page, 'what-if-date', '2027-06-20')
  await pressSelector(page, press, '[data-testid="what-if-keep-shorter"]')
  await page.waitForSelector('[data-testid="scenario-editor"]', { visible: true })
  await elementSays(page, '[data-testid="scenario-outcome"]', ['Paid off', 'Interest left'], 'the editor does not work the tried payment out')
  await inspect?.('the what-if kept as a scenario')
  await shoot('loans-what-if-scenario')
  await pressSelector(page, press, '[data-testid="scenario-save"]')
  await toast(page, 'Scenario added')
  await screenTitled(page, 'Scenarios')
  await elementSays(page, '[data-testid="scenario-card"]', ['€3,000.00 on 20 Jun 2027'], 'the kept scenario is not picked on Scenarios')
  await dismissToasts(page)
}

/**
 * Scenarios of Home loan in a language: C unpicked and picked again, B made the base, C deleted and
 * brought back with Undo, a new scenario with a regular extra payment typed into the editor, saved and
 * deleted, and on the bank loan's page the what-if kept as a scenario. Each state is inspected, so
 * the visual check reads its words.
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
    const { nextSpring, everyMonth, move } = SAMPLE_SCENARIOS
    await cardsAre(page, ['as-it-stands', nextSpring, everyMonth, move], 'Scenarios does not compare A with the first three scenarios')
    await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${everyMonth}"]`)
    await cardsAre(page, ['as-it-stands', nextSpring, move], 'unpicking C did not take its card away')
    await inspect?.('Scenarios with C unpicked')
    await pressSelector(page, press, `[data-testid="scenario-picker"] [data-option="${everyMonth}"]`)
    await chooseStartingWith(page, press, '[data-testid="scenario-base"]', 'B ·')
    await inspect?.('Scenarios against B')
    await shoot('loans-scenarios-base')
    await pressSelector(page, press, `[data-testid="scenario-row"][data-scenario="${everyMonth}"] [data-testid="scenario-delete"]`)
    await toastShown('a scenario deleted')
    await undoIn(page, press, words)
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="scenario-new"]')
    await page.waitForSelector('[data-testid="new-scenario-form"]', { visible: true })
    await fill(page, 'new-scenario-name', '€200 a month')
    await inspect?.('the new scenario dialog')
    await pressSelector(page, press, '[data-testid="new-scenario-next"]')
    await page.waitForSelector('[data-testid="scenario-editor"]', { visible: true })
    await pressSelector(page, press, '[data-testid="scenario-add-regular-extra-payment"]')
    await fill(page, 'scenario-change-amount', '200')
    await page
      .waitForFunction(() => (document.querySelector('[data-testid="scenario-headline"]')?.textContent ?? '').trim() !== '', { timeout: 10_000 })
      .catch(() => {
        throw new Error('the foot of the scenario editor gives no headline')
      })
    await delay(200)
    await inspect?.('the scenario editor with a regular extra payment')
    await shoot('loans-scenario-editor')
    await pressSelector(page, press, '[data-testid="scenario-save"]')
    await toastShown('a scenario added')
    await dialogGone(page, '[data-testid="scenario-editor"]')
    await dismissToasts(page)
    const added = await page.evaluate(() => [...document.querySelectorAll('[data-testid="scenario-row"]')].find((row) => row.textContent?.includes('€200 a month'))?.dataset.scenario ?? null)
    await pressSelector(page, press, `[data-testid="scenario-row"][data-scenario="${added}"] [data-testid="scenario-delete"]`)
    await toastShown('the new scenario deleted')
    await dismissToasts(page)

    await page.evaluate((loan) => {
      window.location.hash = `#/loans/bank-loan?loan=${loan}`
    }, bankLoan)
    await screenTitled(page, 'Home loan')
    await fill(page, 'what-if-amount', '3000')
    await fill(page, 'what-if-date', '2027-06-20')
    await pressSelector(page, press, '[data-testid="what-if-keep-shorter"]')
    await page.waitForSelector('[data-testid="scenario-editor"]', { visible: true })
    await delay(300)
    await inspect?.('the what-if kept as a scenario')
    await shoot('loans-what-if-scenario')
    await pressSelector(page, press, '[data-testid="scenario-save"]')
    await toastShown('the what-if saved as a scenario')
    await screenTitled(page, words.scenarios)
    await inspect?.('Scenarios with the kept what-if')
    await dismissToasts(page)
  }
}

/** Opens a dialog with `opener`, waits for `shown` in it, shoots it under `name` and closes it with Escape. */
async function lookAtDialog(page, press, shoot, opener, shown, name, says = null) {
  await pressSelector(page, press, opener)
  await page.waitForSelector(shown, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`${opener} opened no ${shown}`)
  })
  if (says !== null) await elementSays(page, shown, [says], `${shown} does not say "${says}"`)
  await delay(400)
  await shoot(name)
  await page.keyboard.press('Escape')
  await dialogGone(page, shown)
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
 * a subsidy, a new informal loan, each loan's own dialog, and the dialog of each change of the bank
 * loan, the subsidy's showing its payer.
 */
export function loansDialogsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await lookAtDialog(page, press, shoot, '[data-testid="add-informal-loan"]', '[data-testid="informal-loan-form"]', 'dialog-add-informal-loan')
    await lookAtDialog(page, press, shoot, '[data-testid="add-bank-loan"]', '[data-testid="bank-loan-form"]', 'dialog-add-bank-loan')
    await pressSelector(page, press, '[data-testid="add-bank-loan"]')
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

    await goTo(page, '#/loans/scenarios', words.scenarios)
    await lookAtDialog(page, press, shoot, '[data-testid="scenario-new"]', '[data-testid="new-scenario-form"]', 'dialog-new-scenario')
    await lookAtDialog(
      page,
      press,
      shoot,
      `[data-testid="scenario-row"][data-scenario="${SAMPLE_SCENARIOS.move}"] [data-testid="scenario-edit"]`,
      '[data-testid="scenario-editor"]',
      'dialog-scenario-editor',
    )
    await goTo(page, '#/loans/scenarios?tab=offers', words.scenarios)
    await lookAtDialog(
      page,
      press,
      shoot,
      `[data-testid="scenario-row"][data-scenario="${SAMPLE_SCENARIOS.coastal}"] [data-testid="scenario-edit"]`,
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
    await elementSays(page, '[role="dialog"]', [words.transactions.splitDialog.addTitle, words.transactions.splitDialog.addPart], 'the split dialog is not in its language')
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
 * brought back with Undo, a sale beyond what the account holds refused in words, and a new holding added from inside
 * the dialog with a price entered by hand for it.
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
  await elementSays(page, '[data-testid="transaction-summary"]', ['You pay', 'US$321.00', 'Afterwards you hold', 'Average cost'], 'the summary does not say what the buy pays')
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
  await elementSays(page, '[data-testid="transaction-summary"]', ['US$481.00'], 'the summary does not follow the changed units')
  await pressSelector(page, press, '[data-testid="transaction-save"]')
  await toast(page, 'Buy saved')
  await elementSays(page, '[data-testid="transaction-row"]', ['3 units at US$160.00'], 'the changed buy is not listed')
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
}

/**
 * Every Investments dialog with the sample file, opened and closed again: the transaction dialog on each kind of
 * record, a transaction changed, a holding and an account.
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
    await lookAtDialog(page, press, shoot, '[data-testid="holding-add-transaction"]', '[data-testid="transaction-form"]', 'dialog-investments-holding-buy')
    await goTo(page, '#/investments/settings', croatian ? 'Postavke' : 'Settings')
    await lookAtDialog(page, press, shoot, '[data-testid="account-edit"]', '[data-testid="account-form"]', 'dialog-investments-account')
  }
}

export const investmentsDialogsFlow = investmentsDialogsFlowIn('en')

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
 * holding's guess opened, the spin-off's parent picked with its share proposed, the dry run, and Import. Then either
 * Undo takes it all back to the empty Overview, or the same workbook again adds nothing and a copy with its first
 * deposit edited shows the deposit in Kuna beside the edited one, kept unless ticked.
 */
export function investmentsImportFlowIn(language, { workbook: path, edited }, { undoing = false } = {}) {
  const croatian = language === 'hr'
  const text = croatian ? workbookImportCroatian : workbookImportEnglish
  const firstSummary = croatian ? 'Uvoz dodaje 20 zapisa, a novo je: 3 računa i 4 pozicije.' : 'Import adds 20 records, with 3 accounts and 4 holdings new.'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    await page.waitForSelector('[data-testid="investments-empty"]', { visible: true, timeout: 10_000 })
    // A made-up Alpha Vantage key, so the fake vendor lists the made-up workbook's split.
    await page.evaluate(() => localStorage.setItem('kuna.price-vendor-key.alphavantage', 'MADEUPKEY01'))
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
    await inspect?.('the dry run')
    await shoot('investments-import-dry-run')
    await pressSelector(page, press, '[data-testid="workbook-import-confirm"]')
    await toast(page, text.imported)
    await dialogGone(page, '[data-testid="workbook-import"]')
    await page.waitForSelector('[data-testid="investments-cards"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the Overview shows no figures after the import')
    })
    await inspect?.('the Overview after the import')

    if (undoing) {
      await undoIn(page, press, { writes: croatian ? writesCroatian : writesEnglish })
      await page.waitForSelector('[data-testid="investments-empty"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('Undo did not take the import back to the empty Overview')
      })
      await dismissToasts(page)
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
    await importSummarySays(page, croatian ? 'Uvoz dodaje 1 zapis.' : 'Import adds 1 record.')
    const gone = await page.waitForSelector('[data-testid="import-gone"] [data-testid="import-gone-now"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the dry run does not show the edited deposit beside the one in Kuna')
    })
    await gone.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(300)
    await inspect?.('an edited row as new and gone')
    await shoot('investments-import-edited')
    if ((await page.$('[data-testid="import-gone-kept"]')) === null) throw new Error('the edited deposit does not say that both count while it is kept')
    await pressSelector(page, press, '[data-testid="import-gone-delete"]')
    await importSummarySays(page, croatian ? 'Briše 1 zapis kojeg više nema u radnoj knjizi.' : 'It deletes 1 record gone from the workbook.')
    await page.waitForSelector('[data-testid="import-gone-kept"]', { hidden: true, timeout: 5_000 }).catch(() => {
      throw new Error('the edited deposit still says both count once it is ticked')
    })
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="workbook-import"]')
  }
}
