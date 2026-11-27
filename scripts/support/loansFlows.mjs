/**
 * Loans' flows that the visual and the touch check share: the editors, what-ifs, offers, saved tries and the dialogs.
 * `press` clicks or taps an element handle, and `shoot` takes a screenshot under a name. A failure throws with what was missing.
 */

import { delay, pressSelector } from './pressing.mjs'
import {
  LOANS,
  SCREEN_WORDS,
  TOAST,
  chooseAt,
  chooseOption,
  chooseStartingWith,
  dialogGone,
  dismissToasts,
  elementSays,
  exactly,
  fill,
  firstRunAt,
  goTo,
  inKunaFolder,
  lookAtDialog,
  pageSays,
  pressButton,
  screenTitled,
  settingsShowFile,
  shootAt,
  toast,
  toastMatching,
  undo,
  undoIn,
} from './flowHelpers.mjs'

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
  const lateLine = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('[data-testid="late-instalments"] [data-testid="change-line"]')]
          .find((line) => line.textContent?.includes('Due 10 Mar 2026'))
          ?.querySelector('[data-testid="change-edit"]') ?? null,
      { timeout: 10_000 },
    )
    .then((handle) => handle.asElement())
  await lateLine.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(lateLine)
  await pressSelector(page, press, '[data-testid="late-instalment-delete"]')
  await toast(page, 'Late instalment deleted')
  const deletedDue = await page.$eval(`${TOAST} [data-slot="description"]`, (element) => element.textContent?.trim() ?? '')
  if (deletedDue !== '10 Mar 2026') throw new Error(`the late instalment's Delete does not say which one went: ${deletedDue}`)
  await undoIn(page, press, SCREEN_WORDS.en)
  await elementSays(page, '[data-testid="late-instalments"]', ['Due 10 Mar 2026'], 'Undo did not bring the late instalment back')
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

/**
 * The home loan's plan with the sample Spending books, whose early repayment is linked to the extra payment in 2025: opening
 * that year shows the extra payment as seen in your statement, which a phone shows once its row is tapped.
 */
export function loansExtraPaymentSeenFlowIn(language) {
  const { planStatus } = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const YEAR = '[data-testid="loan-plan"] li[data-year="2025"]'
    await pressSelector(page, press, `${YEAR} [data-testid="plan-year"]`)
    const row = await page.waitForSelector(`${YEAR} [data-testid="plan-row"][data-kind="extra-payment"]`, { visible: true, timeout: 10_000 })
    const toggle = await row.$('[data-testid="plan-row-toggle"]')
    if (toggle !== null && (await toggle.boundingBox()) !== null) await press(toggle)
    await elementSays(page, YEAR, [planStatus.extraSeen], 'the plan does not show the extra payment as seen in your statement')
    await inspect?.('the plan with the extra payment seen in your statement')
    await shootAt(page, shoot, row, 'loans-plan-extra-payment-seen')
  }
}
