/**
 * The Croatian d.o.o. pack's flows that the visual and the touch check share: advances, assets, employees, pay scenarios,
 * the plan, the owner's net, salaries and build-ups. `press` clicks or taps an element handle, and `shoot` takes a
 * screenshot under a name. Each flow starts on its screen and leaves the workbook as it found it. A failure throws with what was missing.
 */

import { en as packEnglish } from '../../src/apps/company/packs/hr-doo/presentation/words.ts'
import { formatMoney } from '../../src/shared/money/moneyFormat.ts'
import { delay, pressSelector } from './pressing.mjs'
import { eurosIn, fieldIn, rowGone, rowNamed } from './companyFlows.mjs'
import {
  MONEY_FORMATS,
  SCREEN_WORDS,
  choose,
  chooseCategory,
  countedIn,
  dialogGone,
  dismissToasts,
  elementSays,
  openCard,
  pressButton,
  screenTitled,
  setField,
  shootAt,
  toast,
  undoIn,
} from './flowHelpers.mjs'

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

/**
 * To review: add the cost of the payment to the owner no cost accounts for. The dialog starts with that payment as what paid the
 * cost back, its menu lists it, and the save takes the payment off the card until Undo.
 */
export function advancePaidBackFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.pack.advanceDialog
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const unaccounted = () => page.evaluate(() => document.querySelectorAll('[data-testid="unaccounted-reimbursement"]').length)
    await page.waitForSelector('[data-testid="unaccounted-reimbursement"]', { visible: true, timeout: 10_000 })
    const before = await unaccounted()
    await pressSelector(page, press, '[data-testid="add-unaccounted-cost"]')
    await page.waitForSelector('[data-testid="add-advance"]', { visible: true })
    await elementSays(page, '[data-testid="advance-paid-back-by"]', ['Refund of a parking fee'], 'Add the cost did not start with its payment as what paid it back')
    await chooseCategory(page, press, await page.$('[data-testid="advance-category"]'), words.categoryName('travel'))
    await shoot('advance-paid-back')
    await pressSelector(page, press, '[data-testid="advance-paid-back-by"]')
    await page.waitForSelector('[role="listbox"] [role="option"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await shoot('advance-paid-back-menu')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await pressSelector(page, press, 'button[form="add-advance"]')
    await toast(page, said.added)
    await dialogGone(page, '[data-testid="add-advance"]')
    if ((await unaccounted()) !== before - 1) throw new Error('the payment is still on the card once its cost is on file')
    await undoIn(page, press, words)
    await page
      .waitForFunction((count) => document.querySelectorAll('[data-testid="unaccounted-reimbursement"]').length === count, { timeout: 10_000 }, before)
      .catch(() => {
        throw new Error('Undo did not put the payment back on the card')
      })
    await dismissToasts(page)
  }
}

/**
 * To review: the newest advance names the payment that paid it back. Choosing the payment no cost accounts for as well shows two
 * payments in the field, lowering the amount below the one it names shows the amount's error, and a save in between is undone.
 */
export function advancePaidBackTwiceFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.pack.advanceDialog
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="advance-edit"]')
    await page.waitForSelector('[data-testid="add-advance"]', { visible: true })
    const amount = await page.waitForSelector(`[data-testid="add-advance"] input[placeholder="${said.amountPlaceholder}"]`)
    await setField(amount, '60')
    await pressSelector(page, press, '[data-testid="advance-paid-back-by"]')
    const parking = await page
      .waitForFunction(() => [...document.querySelectorAll('[role="listbox"] [role="option"]')].find((option) => option.textContent?.includes('Refund of a parking fee')) ?? null, { timeout: 5_000 })
      .catch(() => {
        throw new Error('the payment no cost accounts for is not on offer')
      })
    await press(parking.asElement())
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await elementSays(page, '[data-testid="advance-paid-back-by"]', ['Refund of a parking fee'], 'the field does not show the payment chosen')
    await shootAt(page, shoot, '[data-testid="advance-paid-back-by"]', 'advance-paid-back-two')
    await pressSelector(page, press, 'button[form="add-advance"]')
    await toast(page, said.changed)
    await dialogGone(page, '[data-testid="add-advance"]')
    await undoIn(page, press, words)
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="advance-edit"]')
    await page.waitForSelector('[data-testid="add-advance"]', { visible: true })
    await setField(await page.waitForSelector(`[data-testid="add-advance"] input[placeholder="${said.amountPlaceholder}"]`), '20')
    await pressSelector(page, press, 'button[form="add-advance"]')
    await elementSays(
      page,
      '[data-testid="add-advance"]',
      said
        .repaidMore('|')
        .split('|')
        .map((part) => part.trim()),
      'a lowered amount does not say the payments add up to more',
    )
    await shootAt(page, shoot, `[data-testid="add-advance"] input[placeholder="${said.amountPlaceholder}"]`, 'advance-repaid-more')
    await page.keyboard.press('Escape')
  }
}

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
  const profitOf2026 = packEnglish.ownerNet.profitBeforeTax('Jan – Sep 2026')
  for (const line of [
    'Pay without loans and dividends, 10 months',
    'Rent tax the owner pays the tax office',
    'Pay after the rent tax',
    profitOf2026,
    'Corporate tax at',
    'Dividend tax at',
    'Profit after both taxes, 9 months',
    'Left in the company',
  ]) {
    if (!detail.includes(line)) throw new Error(`the build-up lacks "${line}", it says: ${detail.slice(0, 300)}`)
  }
  await inspect?.('owner net build-up')
  await shoot('owner-net-build-up')

  await pressSelector(page, press, `[data-testid="figure-detail"] a[aria-label^="${profitOf2026}"]`)
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

const SALARIES_TABS = '[data-testid="salaries-tabs"] [role="tab"]'

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
    await pressButton(page, press, SALARIES_TABS, salaries.screen.tabs.people)
    await pressSelector(page, press, '[data-testid="salaries-people"] [data-person="mia"] :is(td:last-child, dd:last-of-type)')
    await elementSays(page, '[data-testid="salaries-strip"]', ['Mia Primjer'], 'a press on a figure of a person’s row on the People tab did not open that employee’s month')

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
