/**
 * Drives the fake-mode build with touch at the two phone widths, as a thumb would: the top app bar
 * with its one-line Sync button and its navigation drawer, the tabs of Settings with Back through them, a link to Year's Statements tab alone kept in its year through two tabs and Back, the review and corporate tax lines of Overview's waiting card, a chart's tap-then-drill, the filter sheet with a
 * filter added and removed,
 * grouped transactions that collapse and expand, a payee's category breakdown, an xlsx file opened and kept in this browser,
 * confirming and recategorising a row on Review with Undo, the session's changes with Undo from
 * there, the coverage list split into rows no rule settles and exceptions to a rule, a paid month on the payroll calendar of Year, Taxes, the
 * doubled rates, a year's build-up and a payment on Year, Assets, a line's build-up and its rows on Year, Statements, the accountant's lines,
 * asset rows and grant rows on Year, a line's build-up on Year, Forecast, a payout option, the next year and the Plan tab from Year, Pay,
 * a pay scenario's figure, warnings and starting figures on Year, Pay, a paid corporate tax advance on Year, Taxes, a repayment on the Owner loan list, the
 * Taken tab as Owner's default with its net share and monthly net pay tiles, the monthly net with the profit included opening its build-up and Year from it, and reading – without hr_company_registered, Owner's Filters button on the tab row setting the period of both tabs, the owner take under the ring against its tile, a month of the loan balance beside the ring, the tax the benefits from company costs avoided against a dividend full screen, Compare pay mixes and the Add advance form from Owner's header, an advance added outside the period opened from its toast,
 * the cost of a reimbursement with no cost on file added from Review,
 * Invoicing's next invoice tile opening its month on the Plan tab, the rest of the year filled from a preview with a description edited, a plan row edited and
 * deleted, and the first row added to an empty billing plan, the clients and the billing and invoice terms on the Clients tab, each with Undo where it has one, a category, with
 * its colour, a label and a role, an asset, an employee on Salaries and an invoice added, edited, deleted and brought back with Undo in the fake file on Drive and in a workbook kept in this browser, the statements
 * folder the settings lack saved at the path the app uses and then at a new one, the card settlement IBANs and a client's second
 * IBAN typed as tags, refused, removed and saved, the client's with Undo, in both modes, an owner advance
 * changed, deleted and brought back, a payment split, edited, deleted and
 * brought back, the same from a row of Review's queue, a group of rows no rule repeats dismissed, restored and the restore undone,
 * the way back from Google with one token for every scope and the sync it resumes ending ready, with Drive read unticked ending in Allow access, a refused consent and a
 * forged answer leaving Allow access with no message, a refused silent trip marking the device so the next open waits for Allow access, Sign in to Google when Google asks
 * for a sign-in, the find and the Picker a tap resumes, the Loans find a tap resumes ending on the Loans Overview, and the note to tap again after a file made on Drive,
 * a statement filed on Sync from the fake statements folder with Undo in its step on Settings, This device and no toast, one held with 1 problem in the sync control and its steps in a bottom sheet
 * linking to Import, a sync with nothing new, Allow access in the sync control, the control while a slow step runs and once ready,
 * the mail step off and then saved on the Mail card, filing a statement the same sync reads with its list and a second sync filing nothing new, nothing new, a failed source and a failed upload in a bottom sheet and Allow access for Gmail read,
 * a save on the Mail card that asks for Gmail read in its own tap and syncs, Allow access whose Google window closed with why in what a screen reader hears,
 * the accountant's mail switched off, the payroll switched on without a sender, Gmail asking to slow down, and the window after mail already there,
 * Salaries with five made-up employees, its gross to net chart's tap-then-drill, the one problem's build-up and rows, the People tab and the Over time table,
 * a settled row on Transactions filed in another category with the rule it contradicts named, and undone,
 * a camt.053 statement and a bank export imported on the Import tab of Transactions, the export
 * with a profile made for it, each confirmed and undone, and the profile deleted, an invoice made and re-exported, a rule made from a row and applied to
 * the rows still waiting, a rule edited and switched off on Review's Rules tab, a rule's note changed and the rule deleted from
 * its editor, each undone, in both modes, the Ruleset search on Settings, a
 * watch list link that opens its rule in the side panel, the local income tax rates searched and shown in full, the first run kept
 * on the fake Drive and in this browser, new books on the fake Drive with statements from mail and their first sync, the statement step asking for Drive read before the Picker,
 * an xlsx file moved to the fake Drive through its summary, a workbook kept in this browser
 * moved there from Settings, This device with the Drive read its folders need asked up front, the categories searched, filtered to a bucket from their sheet, sorted by a tap and the keyboard,
 * and a row edited while filtered and sorted, saved and undone, a row confirmed while another device files the other one, the notice for a file a
 * newer app saved, and every screen. The
 * writes go to the fake workbook kept in this browser. Each screen collapses and expands a card, and
 * the payee breakdown has to stay inside the window and off its own row.
 * After each step it asserts that every visible control is at least 44 by 44 px and that nothing
 * scrolls the page sideways. No console errors and no request to another origin are allowed.
 *
 * Run against a preview of the fake build:
 *   npm run build:fake && npm run preview:fake -- --port 4173
 *   npm run check:touch -- http://localhost:4173/kuna/
 *
 * While working on one screen, `--only billing,owner` limits the run to the steps with those names,
 * or names that start with them and a hyphen, and `--widths 360,1440` to those widths. A limited
 * run keeps the other screenshots and says it was limited. The full run without options is the check.
 *
 * Screenshots go to visual-check/touch/ (gitignored), or to TOUCH_OUTPUT_DIR.
 */

import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

import { chromePath, ENGLISH_CHROME_ARG } from './support/browsers.mjs'
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
  shareFillFlow,
  splitFlow,
  startingScenariosFlow,
  statementAccessFlow,
  statementSyncFlow,
  statementsFolderFlow,
  syncRunningFlow,
} from './support/editorFlows.mjs'
import { writeImportSamples } from './support/importSampleFiles.mjs'
import { writeFakeTemplateFile } from './support/fakeTemplateFile.mjs'
import { runSelection } from './support/runSelection.mjs'
import { screenshotWholePage } from './support/wholePage.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** The ids of the sample Loans file's two loans, `?loans=sample`. */
const SAMPLE_BANK_LOAN = 'fa4e0000-0000-4000-8000-000000000001'
const SAMPLE_INFORMAL_LOAN = 'fa4e0000-0000-4000-8000-000000000006'
const OUTPUT_DIR = process.env.TOUCH_OUTPUT_DIR ?? join(ROOT, 'visual-check', 'touch')
const WIDTHS = [360, 430]
const SMALLEST_TARGET = 44
const selection = runSelection(WIDTHS)
const BASE = selection.base

/** Steps that carry on from the page an earlier step left, so a run limited to one of them runs that one too. */
const CARRIES_ON_FROM = { 'top-bar': 'overview', drawer: 'overview' }

/**
 * `ready` appears once the screen drew the fake workbook. `name` names the step of a screen with tabs. `p=all` resets the filters the drills left
 * behind. A screen collapses and expands its first collapsible card, unless `cards: false` says it has none.
 */
const SCREENS = [
  { hash: '#/company/transactions?tab=import', title: 'Transactions', ready: '[data-testid="import-file"]', cards: false },
  { hash: '#/company/analysis?p=all', title: 'Analysis', ready: '[data-testid="cost-line"]' },
  { hash: '#/company/invoicing?p=all', title: 'Invoicing', ready: '[data-testid="invoice-list"]' },
  { name: 'year-accountant', hash: '#/company/year?year=2025&p=all', title: 'Year', ready: '[data-testid="line-statuses"]' },
  { name: 'year-statements', hash: '#/company/year?year=2025&tab=statements&p=all', title: 'Year', ready: '[data-testid="comparison-pl"]' },
  { name: 'year-taxes', hash: '#/company/year?tab=taxes&p=all', title: 'Year', ready: '[data-testid="corporate-tax"]' },
  { name: 'year-assets', hash: '#/company/year?tab=assets&p=all', title: 'Year', ready: '[data-testid="asset-register"]' },
  { name: 'year-forecast', hash: '#/company/year?p=all', title: 'Year', ready: '[data-testid="forecast-unregistered"]', cards: false },
  { name: 'year-plan', hash: '#/company/year?tab=plan&p=all', title: 'Year', ready: '[data-testid="plan-editor"]', cards: false },
  { name: 'year-pay', hash: '#/company/year?year=2027&tab=pay&p=all', title: 'Year', ready: '[data-testid="scenario-editor"]' },
  { hash: '#/company/owner?tab=owed&p=all', title: 'Owner', ready: '[data-testid="loan-list"]' },
  { hash: '#/company/review?p=all', title: 'Review', ready: '[data-testid="open-filters"]' },
  { name: 'settings', hash: '#/settings', title: 'Settings', ready: '[data-testid="settings-tabs"]' },
  { name: 'settings-ruleset', hash: '#/settings?tab=ruleset', title: 'Settings', ready: '[data-testid="rule-row"]' },
  { name: 'settings-device', hash: '#/settings?tab=device', title: 'Settings', ready: '[data-testid="data-source-card"]', cards: false },
]

mkdirSync(OUTPUT_DIR, { recursive: true })
if (!selection.limited) {
  for (const stale of readdirSync(OUTPUT_DIR).filter((file) => file.endsWith('.png') || file.endsWith('.xlsx'))) {
    rmSync(join(OUTPUT_DIR, stale))
  }
}
const TEMPLATE_FILE = await writeFakeTemplateFile(join(OUTPUT_DIR, 'filled-template.xlsx'))
const IMPORT_SAMPLES = await writeImportSamples(OUTPUT_DIR)

const failures = []
let checked = 0
const browser = await launch({ executablePath: chromePath(), headless: true, args: ['--hide-scrollbars', ENGLISH_CHROME_ARG] })

try {
  for (const width of WIDTHS.filter(selection.takesWidth)) {
    await checkWidth(width)
  }
} finally {
  await browser.close()
}
const unmatched = selection.unmatched()
if (unmatched !== null) failures.push(unmatched)
if (checked === 0) failures.push(`${selection.summary()} checked nothing`)

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}
console.log(selection.limited ? `\nevery step of this limited run clean (${selection.summary()}). The full run without options is the check` : '\nall touch checks clean')

async function checkWidth(width) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const errors = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  const own = new URL(BASE).origin
  const foreign = []
  page.on('request', (request) => {
    const url = request.url()
    if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== own) foreign.push(url)
  })
  await page.setViewport({ width, height: 800, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])

  const step = async (name, run) => {
    const followed = Object.entries(CARRIES_ON_FROM).some(([later, earlier]) => earlier === name && selection.takes(later))
    if (!selection.takes(name) && !followed) return
    checked += 1
    const scope = `${width}px ${name}`
    const startedAt = Date.now()
    try {
      await run()
      await inspect(page, scope)
      console.log(`${scope.padEnd(36)} ok  ${((Date.now() - startedAt) / 1000).toFixed(1)} s`)
    } catch (error) {
      failures.push(`[${scope}] ${error.message}`)
      await page.screenshot({ path: join(OUTPUT_DIR, `${width}-${name}-failed.png`) }).catch(() => {})
    }
  }
  const shoot = (name) => page.screenshot({ path: join(OUTPUT_DIR, `${width}-${name}.png`), fullPage: false })

  await step('overview', async () => {
    await open(page, '#/company', 'Overview')
    await settleCharts(page)
    await shoot('overview')
  })

  await step('top-bar', async () => {
    await expect(topBarTitle(page), (title) => title === 'Overview', 'the top bar does not name the screen')
    await expect(
      page.evaluate(() => {
        const bar = document.querySelector('header')
        const menu = bar?.querySelector('[data-testid="open-navigation"]')?.getBoundingClientRect()
        const button = bar?.querySelector('[data-testid="sync-button"]')
        const sync = button?.getBoundingClientRect()
        return {
          menuAtLeft: menu !== undefined && menu.left < 24,
          syncAtRight: sync !== undefined && sync.right > window.innerWidth - 24,
          height: Math.round(sync?.height ?? 0),
          time: button?.textContent?.trim() ?? '',
          name: button?.getAttribute('aria-label') ?? '',
        }
      }),
      (bar) => bar.menuAtLeft && bar.syncAtRight && bar.height === 44 && / ago$|^just now$|^yesterday$|^on /.test(bar.time) && bar.name.startsWith(`Synced ${bar.time}, `),
      'the top bar does not hold the menu at the left and one 44 px Sync button with the time since the last sync at the right',
    )
  })

  await step('drawer', async () => {
    await openDrawer(page)
    await expect(
      page.evaluate(() => document.querySelector('[role="dialog"] a[aria-current="page"]')?.textContent?.trim() ?? null),
      (current) => current === 'Overview',
      'the drawer does not mark the current screen',
    )
    await inspect(page, `${width}px drawer open`)
    await shoot('drawer-open')
    for (let press = 0; press < 12; press += 1) await page.keyboard.press('Tab')
    await expect(
      page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement) ?? false),
      (inside) => inside,
      'Tab moved focus out of the open drawer',
    )
    await page.keyboard.press('Escape')
    await drawerClosed(page)

    await openDrawer(page)
    await page.touchscreen.tap(width - 16, 400)
    await drawerClosed(page)

    await page.evaluate(() => window.scrollTo(0, 600))
    await openDrawer(page)
    const link = await waitForText(page, '[role="dialog"] a', 'Transactions')
    await link.tap()
    await waitForTitle(page, 'Transactions')
    await drawerClosed(page)
    await expect(topBarTitle(page), (title) => title === 'Transactions', 'the top bar kept the previous screen title')
    await expect(
      page.evaluate(() => document.querySelector('[data-testid="screen-title"]').getBoundingClientRect().top - document.querySelector('header').getBoundingClientRect().bottom),
      (gap) => gap >= 0,
      'the new screen opened with its heading under the top bar',
    )
  })

  await step('waiting-review', async () => {
    await open(page, '#/company', 'Overview')
    await page.waitForSelector('[data-testid="waiting-for-you"]')
    await shoot('overview-waiting')
    const reviewLink = await waitForText(page, '[data-testid="waiting-for-you"] [data-job="review"] a', 'Review')
    await reviewLink.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await reviewLink.tap()
    await waitForTitle(page, 'Review')
    await expect(reviewCount(page), (count) => count === 2, 'the waiting line did not open the queue with its two rows')
  })

  await step('waiting-corporate-tax', async () => {
    await openFreshBrowser(page, '#/company', 'Overview')
    const taxLink = await waitForText(page, '[data-testid="waiting-for-you"] [data-job="corporate-tax"] a', 'Year, Taxes')
    await taxLink.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await taxLink.tap()
    await waitForTitle(page, 'Year')
    await expect(hashOf(page), (hash) => hash.includes('tab=taxes') && hash.endsWith('#corporate-tax'), 'the waiting line did not open the Taxes tab at the corporate tax')
    await page.waitForSelector('[data-testid="corporate-tax-overdue"]', { visible: true })
    await inspect(page, `${width}px year taxes from the waiting card`)
    await shoot('year-taxes-overdue')
  })

  await step('filter-sheet', async () => {
    await open(page, '#/company/transactions?p=all&review=1', 'Transactions')
    await expect(filterCount(page), (count) => count === '1', 'the filter button does not count one active filter')
    await page.waitForSelector('[data-testid="transaction-card"]')
    await shoot('transactions-cards')
    await page.tap('[data-testid="open-filters"]')
    await waitForText(page, '[role="dialog"] [aria-label="Active filters"]', 'Needs review')
    await delay(300)
    await inspect(page, `${width}px filter sheet open`)
    await shoot('filter-sheet')
    const before = await totalOf(page)
    const lastThree = await waitForText(page, '[role="dialog"] button[aria-pressed]', 'Last 3 months')
    await lastThree.tap()
    await page.waitForFunction(() => window.location.hash.includes('p=l3'))
    const clearAll = await waitForText(page, '[role="dialog"] button', 'Clear')
    await clearAll.tap()
    await page.waitForFunction(() => !window.location.hash.includes('review=1'))
    await page.waitForFunction(() => !document.querySelector('[role="dialog"] [aria-label="Active filters"]'))
    const done = await waitForText(page, '[role="dialog"] button', 'Show results')
    await done.tap()
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    await expect(filterCount(page), (count) => count === null, 'the filter button still counts a filter after Clear all')
    await expect(totalOf(page), (after) => after !== before, 'the total did not change with the period and the chips')
  })

  await step('add-filter', async () => {
    await open(page, '#/company/transactions?p=l12', 'Transactions')
    await page.tap('[data-testid="open-filters"]')
    await page.waitForSelector('[role="dialog"] [data-testid="add-filter"]')
    await delay(300)
    await page.tap('[role="dialog"] [data-testid="add-filter"]')
    await page.waitForSelector('[role="listbox"] [role="option"]')
    await page.keyboard.type('travel')
    const travel = await waitForText(page, '[role="option"]', 'Travel')
    await travel.tap()
    await page.waitForFunction(() => window.location.hash.includes('travel'))
    await page.keyboard.press('Escape')
    const chip = await waitForText(page, '[role="dialog"] [data-testid="filter-chip"]', 'Category: Travel')
    await expect(filterCount(page), (count) => count === '1', 'the filter button does not count the added filter')
    await delay(300)
    await inspect(page, `${width}px filter added`)
    await shoot('filter-added')
    const remove = await chip.$('button')
    await remove.tap()
    await page.waitForFunction(() => !window.location.hash.includes('travel'))
    await page.waitForFunction(() => !document.querySelector('[role="dialog"] [data-testid="filter-chip"]'))
    await expect(filterCount(page), (count) => count === null, 'the filter button still counts the removed filter')
    const done = await waitForText(page, '[role="dialog"] button', 'Show results')
    await done.tap()
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
  })

  await step('grouping', async () => {
    await open(page, '#/company/transactions?p=all', 'Transactions')
    await page.tap('[aria-label="Group rows"]')
    const byCategory = await waitForText(page, '[role="option"]', 'By category')
    await byCategory.tap()
    await page.waitForSelector('[data-testid="transaction-group"]')
    // The option list fades out. A tap before it is gone lands on it.
    await delay(400)
    const firstCategory = await page.evaluate(() => document.querySelector('[data-testid="transaction-group"] .category-chip')?.textContent?.trim() ?? '')
    await page.tap('[data-testid="transaction-group"] [data-testid="group-toggle"]')
    await expect(groupState(page, firstCategory), (state) => state?.expanded === false && state.cards === 0, `tapping "${firstCategory}" did not collapse it`)
    await inspect(page, `${width}px grouped, one collapsed`)
    await delay(200)
    await shoot('grouped-collapsed')

    await page.tap('[data-testid="collapse-all"]')
    await expect(cardCount(page), (count) => count === 0, 'Collapse all left cards showing')
    await page.tap('[data-testid="expand-all"]')
    await expect(groupState(page, firstCategory), (state) => state?.expanded === true && state.cards > 0, 'Expand all did not open the groups')

    await page.tap('[data-testid="transaction-group"] [data-testid="group-toggle"]')
    await page.evaluate(() => {
      window.location.hash = '#/company/transactions?p=l12'
    })
    await page.waitForFunction(() => window.location.hash.includes('p=l12'))
    await delay(300)
    await expect(groupState(page, firstCategory), (state) => state?.expanded === false, `"${firstCategory}" opened again when the period changed`)
    await page.tap('[data-testid="expand-all"]')
  })

  await step('payee-breakdown', async () => {
    await open(page, '#/company/analysis?p=l12', 'Analysis')
    const payeesToggle = await page.waitForSelector('[data-testid="top-payees"] [data-testid="card-toggle"]')
    if ((await payeesToggle.evaluate((toggle) => toggle.getAttribute('aria-expanded'))) === 'false') {
      await payeesToggle.evaluate((toggle) => toggle.scrollIntoView({ block: 'center' }))
      await delay(200)
      await payeesToggle.tap()
    }
    const several = await page.waitForFunction(
      () => [...document.querySelectorAll('[data-testid="payee-categories"]')].find((trigger) => trigger.textContent?.includes('+')) ?? null,
      { timeout: 10_000 },
    )
    await several.asElement().evaluate((trigger) => trigger.scrollIntoView({ block: 'center' }))
    await several.asElement().tap()
    await page.waitForSelector('[data-testid="payee-breakdown"] a')
    await delay(300)
    await expect(
      several.asElement().evaluate((trigger) => {
        const panel = document.querySelector('[data-testid="payee-breakdown"]').getBoundingClientRect()
        const row = trigger.closest('tr').getBoundingClientRect()
        const inside = panel.left >= 0 && panel.right <= window.innerWidth && panel.top >= 0 && panel.bottom <= window.innerHeight
        return inside && (panel.top >= row.bottom - 1 || panel.bottom <= row.top + 1)
      }),
      (placed) => placed,
      'the breakdown leaves the window or covers the row it belongs to',
    )
    await shoot('payee-breakdown')
    await inspect(page, `${width}px payee breakdown open`)
    // Measuring the links of the cost headings scrolls the page, which closes the breakdown, so it opens again.
    await delay(500)
    if ((await page.$('[data-testid="payee-breakdown"] a')) === null) {
      await several.asElement().evaluate((trigger) => trigger.scrollIntoView({ block: 'center' }))
      await several.asElement().tap()
      await delay(300)
    }
    await page.tap('[data-testid="payee-breakdown"] a')
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 2, 'the breakdown line did not narrow to its counterparty and category')
  })

  await step('chart-drill', async () => {
    await open(page, '#/company', 'Overview')
    await settleCharts(page)
    await tapUntilDrillOffered(page)
    await expect(hashOf(page), (hash) => hash.startsWith('#/company?') || hash === '#/company', 'one tap left the screen')
    await page.waitForFunction(() => {
      const tooltip = document.querySelector('.chart-tooltip')
      return tooltip !== null && getComputedStyle(tooltip).display !== 'none' && getComputedStyle(tooltip).visibility !== 'hidden'
    })
    await shoot('chart-tooltip')
    const viewRows = await waitForText(page, '[data-testid="chart-drill"] button', 'View rows')
    await viewRows.tap()
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the chart drill opened Transactions without its filters')

    await open(page, '#/company', 'Overview')
    await settleCharts(page)
    // The second tap on the same mark drills too, without "View rows".
    await tapChart(page, await tapUntilDrillOffered(page))
    await waitForTitle(page, 'Transactions')
  })

  await step('salaries-drill', async () => {
    await open(page, '&fake=five-employees#/company/salaries', 'Salaries')
    await settleCharts(page)
    await tapUntilDrillOffered(page, '[data-testid="salaries-bridge"] .chart-body canvas')
    await expect(hashOf(page), (hash) => hash.startsWith('#/company/salaries'), 'one tap on the gross to net chart left the screen')
    await shoot('salaries-bridge-tooltip')
    const viewRows = await waitForText(page, '[data-testid="salaries-bridge"] [data-testid="chart-drill"] button', 'View rows')
    await viewRows.tap()
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the gross to net drill opened Transactions without its filters')
  })

  await step('taxes-cadence-drill', async () => {
    await open(page, '#/company/year?tab=taxes&p=all#payroll-cadence', 'Year')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="cadence-paid"]')
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-taxes.png`))
    await page.tap('[data-testid="cadence-paid"]')
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the cadence cell opened Transactions without its filters')
  })

  await step('assets-doubled-and-drill', async () => {
    await open(page, '#/company/year?tab=assets&p=all', 'Year')
    await settleCharts(page)
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-assets.png`))
    await page.tap('[role="switch"][data-testid="doubled-rates-switch"]')
    await page.waitForSelector('[data-testid="doubled-rates-changes"]')
    await expect(hashOf(page), (hash) => hash.includes('rates=doubled'), 'the switch did not put the doubled rates in the address')
    await inspect(page, `${width}px assets at doubled rates`)
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-assets-doubled.png`))
    const years = await page.waitForSelector('[data-card="year.depreciation"] [data-testid="card-toggle"][aria-expanded="false"]')
    await years.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await years.tap()
    const year = await page.waitForSelector('[data-testid="depreciation-year-toggle"][aria-expanded="false"]')
    await year.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await year.tap()
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="depreciation-year-toggle"][aria-expanded="true"]').length >= 2)
    await inspect(page, `${width}px assets, a year opened`)
    const payment = await page.waitForSelector('[data-testid="asset-register"] a[aria-label$="open the payment"]')
    await payment.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await payment.tap()
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the asset opened Transactions without its filters')
  })

  await step('year-end-build-up-and-drill', async () => {
    await open(page, '#/company/year?year=2025&tab=statements&p=all', 'Year')
    await page.waitForSelector('[data-testid="comparison-pl"]')
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-year-end.png`))
    const toggle = await page.waitForSelector('[data-testid="comparison-pl"] [data-testid="comparison-toggle"][aria-expanded="false"]')
    await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await toggle.tap()
    const buildUp = await page.waitForSelector('[data-testid="comparison-pl"] [data-testid="line-build-up"]')
    await inspect(page, `${width}px year end, a line opened`)
    await buildUp.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await shoot('year-end-line')
    const rows = await page.waitForSelector('[data-testid="comparison-pl"] [data-testid="line-build-up"] a[aria-label$="open the rows"]')
    await rows.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await rows.tap()
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the line opened Transactions without its filters')
  })

  await step('forecast-build-up-and-switch', async () => {
    await openFreshBrowser(page, '#/company/year?year=2026&p=all', 'Year')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="forecast-tiles"]')
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-forecast.png`))
    const card = await page.waitForSelector('[data-card="year.forecast-pl"] [data-testid="card-toggle"]')
    await card.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    if ((await card.evaluate((element) => element.getAttribute('aria-expanded'))) === 'false') await card.tap()
    const toggle = await page.waitForSelector('[data-testid="forecast-profit-and-loss"] [data-testid="build-up-toggle"][aria-expanded="false"]')
    await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await toggle.tap()
    await page.waitForSelector('[data-testid="forecast-profit-and-loss"] [data-testid="build-up-detail"]')
    await inspect(page, `${width}px forecast, a line opened`)
    await shoot('forecast-line')
    await (await waitForText(page, '[role="tab"]', 'Pay')).tap()
    await expect(hashOf(page), (hash) => hash.includes('tab=pay'), 'the Pay tab did not put itself in the address')
    const interim = await waitForText(page, '[data-testid="payout-switch"] button', 'Interim payout now')
    await interim.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await interim.tap()
    await expect(hashOf(page), (hash) => hash.includes('payout=interim'), 'the payout switch did not put the option in the address')
    await waitForText(page, '[data-testid="dividend-capacity"] p', 'An interim payout in 2026')
    await inspect(page, `${width}px pay, interim payout`)
    await shoot('pay-interim')
    const next = await waitForText(page, '[data-testid="year-picker"] button', '2027')
    await next.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await next.tap()
    await expect(hashOf(page), (hash) => hash.includes('year=2027') && hash.includes('tab=pay'), 'the year picker did not keep the Pay tab for the next year')
    await waitForText(page, '[data-testid="dividend-capacity"] p', 'An interim payout in 2027')
    await (await waitForText(page, '[role="tab"]', 'Plan')).tap()
    await waitForText(page, '[data-testid="plan-editor"] h2', 'Plan for 2027')
    await inspect(page, `${width}px plan for 2027`)
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-plan-2027.png`))
  })

  await step('taxes-corporate-tax-drill', async () => {
    await openFreshBrowser(page, '#/company/year?tab=taxes&p=all', 'Year')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="corporate-tax-2026"]')
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-taxes-corporate-tax.png`))
    const paid = await page.waitForSelector('[data-testid="corporate-tax-2026"] a[aria-label$="paid, open the rows"]')
    await paid.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await paid.tap()
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the paid advance opened Transactions without its filters')
  })

  await step('owner-loan-drill', async () => {
    await open(page, '#/company/owner?tab=owed&p=all', 'Owner')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="loan-list"]')
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-owner.png`))
    await page.tap('[data-testid="loan-list"] ol a')
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the repayment opened Transactions without its filters')
  })

  await step('owner-period', async () => {
    await open(page, '#/company/owner?tab=owed&p=all', 'Owner')
    await page.waitForSelector('[data-testid="owner-owed-tiles"]')
    await expect(
      page.evaluate(() => {
        const button = document.querySelector('[data-testid="page-tab-actions"] [data-testid="open-filters"]')
        const word = button?.querySelector('.filters-label')?.getBoundingClientRect()
        return button !== null && word !== undefined && word.width <= 1
      }),
      (onTabRow) => onTabRow,
      'the Filters button is not on the tab row as an icon alone',
    )
    await shoot('owner-tab-row')
    await delay(300)
    await page.tap('[data-testid="page-tab-actions"] [data-testid="open-filters"]')
    // The sheet slides up, so its buttons are tapped once it has landed.
    const year = await waitForText(page, '[role="dialog"] button[aria-pressed]', 'Year')
    await delay(400)
    await year.tap()
    await page.waitForFunction(() => window.location.hash.includes('p=2026'))
    await (await waitForText(page, '[role="dialog"] button', 'Show results')).tap()
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    // 2026 runs past the newest booking, so its balances stand on that day.
    await waitForText(page, '[data-testid="owner-owed-tiles"] p', 'The owner owes the company on 8 Oct 2026')
    await (await waitForText(page, '[role="tab"]', 'Taken')).tap()
    await waitForText(page, '[data-testid="period-range"]', 'Jan 2026 – Dec 2026')
    await inspect(page, `${width}px owner, the period on both tabs`)
  })

  await step('owner-taken', async () => {
    await open(page, '#/company/owner?p=all', 'Owner')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="owner-take-total"]')
    await expect(
      page.$eval('[data-testid="owner-taken-tiles"]', (tiles) => tiles.textContent ?? ''),
      (tiles) => tiles.includes('Net share of gross cost') && tiles.includes('Monthly net pay'),
      'the Taken tab, the default one, lacks the net share or the monthly net pay tile',
    )
    await expect(
      page.evaluate(() => [
        document.querySelector('[data-testid="owner-taken-tiles"] .text-figure-lg')?.textContent?.trim(),
        document.querySelector('[data-testid="owner-take-total"]')?.textContent?.trim(),
      ]),
      ([tile, ring]) => tile !== undefined && tile === ring,
      'the owner take under the ring does not add up to the Owner take tile',
    )
    await inspect(page, `${width}px owner, taken`)
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-owner-taken.png`))
  })

  await step('owner-taken-loan-balance', async () => {
    await open(page, '#/company/owner?p=all', 'Owner')
    await settleCharts(page)
    const plot = '[data-testid="owner-loan-balance"] .chart-body canvas'
    await tapUntilDrillOffered(page, plot)
    await expect(hashOf(page), (hash) => hash.startsWith('#/company/owner'), 'one tap on the loan balance left the screen')
    await shoot('owner-loan-balance')
    const viewRows = await waitForText(page, '[data-testid="owner-loan-balance"] [data-testid="chart-drill"] button', 'View rows')
    await viewRows.tap()
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the loan balance opened Transactions without its filters')
  })

  await step('owner-taken-dividend', async () => {
    await openFreshBrowser(page, '#/company/owner?p=all', 'Owner')
    const avoided = await page.waitForSelector('[data-testid="owner-benefits-dividend"] [data-testid="build-up-button"]')
    await avoided.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await avoided.tap()
    await page.waitForSelector('[data-testid="figure-detail"]')
    await delay(400)
    await expect(
      page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]')?.getBoundingClientRect()
        const fills = dialog !== undefined && dialog.width >= window.innerWidth - 1 && dialog.height >= window.innerHeight - 1
        return { fills, steps: document.querySelector('[data-testid="figure-detail"]')?.textContent ?? '' }
      }),
      (shown) => shown.fills && shown.steps.includes('Corporate tax at') && shown.steps.includes('Dividend tax at'),
      'the tax avoided against a dividend did not open full screen on its corporate and dividend tax',
    )
    await inspect(page, `${width}px owner, taken, tax avoided against a dividend`)
    await shoot('owner-taken-dividend')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="figure-detail"]'))
  })

  await step('invoices-payment-drill', async () => {
    await open(page, '#/company/invoicing?p=all', 'Invoicing')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="invoice-list"]')
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-invoicing.png`))
    await page.tap('[data-testid="invoice-list"] ol a')
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the payment opened Transactions without its filters')
  })

  await step('owner-pay-mixes', async () => {
    await openFreshBrowser(page, '#/company/owner?p=all', 'Owner')
    await page.tap('[data-testid="owner-pay-scenarios"]')
    await waitForTitle(page, 'Year')
    await expect(hashOf(page), (hash) => hash.includes('tab=pay') && hash.includes('year=2027'), 'Compare pay mixes did not open Year, Pay for the next year')
    await page.waitForSelector('[data-testid="scenario-picker"]')
  })

  await step('owner-advance-undo', async () => {
    await openFreshBrowser(page, '#/company/owner?tab=owed&p=all', 'Owner')
    const advances = () => page.evaluate(() => document.querySelectorAll('[data-testid="advance-list"] > li').length)
    const before = await advances()
    const opener = await page.$('[data-testid="open-add-advance"]')
    await opener.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await opener.tap()
    await page.waitForSelector('[data-testid="add-advance"]')
    await delay(300)
    await page.type('[data-testid="add-advance"] input[inputmode="decimal"]', '48.50')
    await page.tap('[data-testid="advance-category"]')
    await page.waitForSelector('[role="listbox"] [role="option"]')
    await page.keyboard.type('travel')
    await (await waitForText(page, '[role="option"]', 'Travel')).tap()
    await delay(200)
    await inspect(page, `${width}px add advance form`)
    await shoot('owner-add-advance')
    await page.tap('button[form="add-advance"]')
    await waitForText(page, '[data-slot="title"]', 'Advance added')
    await expect(advances(), (count) => count === before + 1, 'the advance is not on the list')
    await delay(700)
    await (await waitForText(page, 'button', 'Undo')).tap()
    await waitForText(page, '[data-slot="title"]', 'Undone')
    await expect(advances(), (count) => count === before, 'Undo did not take the advance off the list')
  })

  await step('owner-advance-outside', async () => {
    // Add advance starts on the newest booking, 8 Oct 2026, so under 2025 the toast says the page does not list it and opens it.
    await openFreshBrowser(page, '#/company/owner?tab=owed&p=2025', 'Owner')
    const opener = await page.$('[data-testid="open-add-advance"]')
    await opener.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await opener.tap()
    await page.waitForSelector('[data-testid="add-advance"]')
    await delay(300)
    await page.type('[data-testid="add-advance"] input[inputmode="decimal"]', '48.50')
    await page.tap('[data-testid="advance-category"]')
    await page.waitForSelector('[role="listbox"] [role="option"]')
    await page.keyboard.type('travel')
    await (await waitForText(page, '[role="option"]', 'Travel')).tap()
    await delay(200)
    await page.tap('button[form="add-advance"]')
    await waitForText(page, '[data-slot="title"]', 'Advance added')
    await expect(
      page.$eval('li[data-slot="base"] [data-slot="description"]', (element) => element.textContent ?? ''),
      (said) => said.includes('Outside the period in view, Jan 2025 – Dec 2025'),
      'the toast does not say the advance is outside the period in view',
    )
    await delay(700)
    await shoot('owner-advance-outside')
    await (await waitForText(page, 'li[data-slot="base"] button', 'Open it')).tap()
    await waitForTitle(page, 'Transactions')
    await expect(hashOf(page), (hash) => hash.includes('2026-10-08'), 'Open it did not open the day of the advance')
  })

  for (const [screen, title] of [['review', 'Review']]) {
    await step(`${screen}-unaccounted-cost`, async () => {
      await openFreshBrowser(page, `#/company/${screen}?p=all`, title)
      const unaccounted = () => page.evaluate(() => document.querySelectorAll('[data-testid="unaccounted-reimbursement"]').length)
      await expect(unaccounted(), (count) => count === 1, 'the reimbursement with no cost on file is not listed')
      const adder = await page.$('[data-testid="add-unaccounted-cost"]')
      await adder.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await delay(200)
      await adder.tap()
      await page.waitForSelector('[data-testid="add-advance"]')
      await delay(300)
      await expect(
        page.$eval('[data-testid="add-advance"] input[inputmode="decimal"]', (input) => input.value),
        (amount) => amount === '38.50',
        'Add the cost did not start on the amount left unaccounted',
      )
      await page.tap('[data-testid="advance-category"]')
      await page.waitForSelector('[role="listbox"] [role="option"]')
      await page.keyboard.type('travel')
      await (await waitForText(page, '[role="option"]', 'Travel')).tap()
      await delay(200)
      await inspect(page, `${width}px add the cost on ${title}`)
      await shoot(`${screen}-add-unaccounted-cost`)
      await page.tap('button[form="add-advance"]')
      await waitForText(page, '[data-slot="title"]', 'Advance added')
      await expect(unaccounted(), (count) => count === 0, 'the reimbursement is still listed once its cost is on file')
      await delay(700)
      await (await waitForText(page, 'button', 'Undo')).tap()
      await waitForText(page, '[data-slot="title"]', 'Undone')
      await expect(unaccounted(), (count) => count === 1, 'Undo did not list the reimbursement again')
    })
  }

  await step('billing-month-link', async () => {
    await open(page, '#/company/invoicing?tab=plan&p=all', 'Invoicing')
    await page.waitForSelector('[data-testid="billing-rows"]')
    await screenshotWholePage(page, join(OUTPUT_DIR, `${width}-invoicing-plan.png`))
    await open(page, '#/company/invoicing?p=all', 'Invoicing')
    await (await waitForText(page, '[data-testid="invoicing-tiles"] .kpi-link', 'Next invoice')).tap()
    await page.waitForFunction(() => window.location.hash.includes('tab=plan') && window.location.hash.includes('month='))
    await page.waitForSelector('[data-testid="billing-months"] li[data-selected] [data-testid="billing-month-toggle"][aria-expanded="true"]')
    await delay(300)
    await expect(
      page.evaluate(() => {
        const box = document.querySelector('[data-testid="billing-months"] li[data-selected]').getBoundingClientRect()
        const band = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sticky-band')) || 0
        const atFoot = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1
        return box.top >= band && (box.top <= band + 40 || (atFoot && box.top < window.innerHeight))
      }),
      (inView) => inView,
      'the tile did not bring its month to just below the tab row',
    )
    await shoot('billing-month')
  })

  await step('billing-fill-write-undo', async () => {
    await openFreshBrowser(page, '#/company/invoicing?tab=plan&p=all', 'Invoicing')
    await page.waitForSelector('[data-testid="billing-rows"]')
    const rows = () => page.evaluate(() => document.querySelectorAll('[data-testid="billing-row"]').length)
    const before = await rows()
    const fill = await page.$('[data-testid="billing-fill"]')
    await fill.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await fill.tap()
    await page.waitForSelector('[data-testid="fill-row"]')
    await delay(300)
    const previewed = await page.evaluate(() => document.querySelectorAll('[data-testid="fill-row"]').length)
    await expect(Promise.resolve(previewed), (count) => count > 0, 'the preview lists no rows to fill')
    await page.$eval('[data-testid="fill-description"]', (input) => input.select())
    await page.type('[data-testid="fill-description"]', 'Fee for the last sprint')
    await inspect(page, `${width}px fill preview`)
    await shoot('billing-fill-preview')
    await page.tap('[data-testid="fill-write"]')
    await waitForText(page, '[data-slot="title"]', `${previewed} plan rows added`)
    await expect(rows(), (count) => count === before + previewed, 'the filled rows are not on the list')
    await waitForText(page, '[data-testid="billing-row"] p', 'Fee for the last sprint')
    await delay(700)
    await (await waitForText(page, 'button', 'Undo')).tap()
    await waitForText(page, '[data-slot="title"]', 'Undone')
    await expect(rows(), (count) => count === before, 'Undo did not take the filled rows off the list')
  })

  await step('billing-edit-delete', async () => {
    await openFreshBrowser(page, '#/company/invoicing?tab=plan&p=all', 'Invoicing')
    await page.waitForSelector('[data-testid="billing-rows"]')
    const rows = () => page.evaluate(() => document.querySelectorAll('[data-testid="billing-row"]').length)
    const before = await rows()
    const openLastRow = async () => {
      const edit = (await page.$$('[data-testid="billing-row-edit"]')).at(-1)
      await edit.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await delay(200)
      await edit.tap()
      await page.waitForSelector('[data-testid="billing-row-form"]')
      await delay(300)
    }
    await openLastRow()
    await page.$eval('[data-testid="billing-row-description"]', (input) => input.select())
    await page.type('[data-testid="billing-row-description"]', 'Seat for the model API, adjusted')
    await inspect(page, `${width}px edit a plan row`)
    await shoot('billing-row-edit')
    await page.tap('button[form="billing-row"]')
    await waitForText(page, '[data-slot="title"]', 'Plan row saved')
    await waitForText(page, '[data-testid="billing-row"] p', 'Seat for the model API, adjusted')
    // A fresh load drops the toast, so the Undo below is the deletion's own.
    await openFreshBrowser(page, '#/company/invoicing?tab=plan&p=all', 'Invoicing')
    await page.waitForSelector('[data-testid="billing-rows"]')
    await openLastRow()
    await page.tap('[data-testid="billing-row-delete"]')
    await waitForText(page, '[data-slot="title"]', 'Plan row deleted')
    await expect(rows(), (count) => count === before - 1, 'the deleted row is still on the list')
    await delay(700)
    await (await waitForText(page, 'button', 'Undo')).tap()
    await waitForText(page, '[data-slot="title"]', 'Undone')
    await expect(rows(), (count) => count === before, 'Undo did not bring the row back')
  })

  await step('billing-start-browser', async () => {
    await page.goto(`${BASE}?theme=dark&fake=browser-no-billing-plan&load=${Date.now()}#/company/invoicing?tab=plan`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Invoicing')
    await page.waitForSelector('[data-testid="billing-empty"]')
    await shoot('billing-empty')
    await page.tap('[data-testid="billing-start"]')
    await page.waitForSelector('[data-testid="billing-row-form"]')
    await delay(300)
    await page.tap('[data-testid="billing-row-item"]')
    await (await waitForText(page, '[role="option"]', 'Monthly Fee')).tap()
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'))
    await delay(500)
    await page.type('[data-testid="billing-row-amount"]', '7200')
    await inspect(page, `${width}px add the first plan row`)
    await page.tap('button[form="billing-row"]')
    await waitForText(page, '[data-slot="title"]', 'Plan row added')
    await page.waitForSelector('[data-testid="billing-rows"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    await delay(300)
  })

  await step('pay-scenarios-figures', async () => {
    await openFreshBrowser(page, '#/company/year?year=2027&tab=pay&p=all', 'Year')
    await settleCharts(page)
    await inspect(page, `${width}px pay`)
    const badge = await page.waitForSelector('[data-testid="scenario-warning-badge"]')
    await badge.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await badge.tap()
    // The popover holds text only, and it can lie over a link the size check scrolls to, so the page is checked before it opens.
    await page.waitForSelector('[data-testid="scenario-warning-list"]', { visible: true })
    await delay(300)
    await shoot('pay-scenario-warnings')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="scenario-warning-list"]'))
    const comparison = await page.waitForSelector('[data-card="year.comparison"] [data-testid="card-toggle"]')
    await comparison.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    if ((await comparison.evaluate((element) => element.getAttribute('aria-expanded'))) === 'false') await comparison.tap()
    await page.waitForSelector('[data-testid="scenario-comparison"]')
    const columns = () => page.$$eval('[data-testid="scenario-comparison"] thead th.figure-head', (heads) => heads.length)
    await expect(columns(), (count) => count === 2, 'the phone comparison does not set the base beside one scenario')
    const other = await page.waitForSelector('[data-testid="comparison-against"] button[aria-pressed="false"]')
    const picked = await other.evaluate((element) => element.textContent.trim())
    await other.tap()
    await page.waitForFunction((wanted) => document.querySelectorAll('[data-testid="scenario-comparison"] thead th.figure-head')[1]?.textContent.includes(wanted), {}, picked)
    await inspect(page, `${width}px pay scenarios`)
    await shoot('pay-scenarios')
    const figure = await page.waitForSelector('[data-line="net"] button')
    await figure.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await figure.tap()
    await page.waitForSelector('[data-testid="figure-detail"]')
    await delay(400)
    await inspect(page, `${width}px pay scenarios build-up`)
    await shoot('pay-scenarios-build-up')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="figure-detail"]'))
    const starting = await page.waitForSelector('[data-testid="open-starting-figures"]')
    await starting.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await starting.tap()
    await page.waitForSelector('[data-testid="starting-figures"]')
    await delay(400)
    await inspect(page, `${width}px what the scenarios start from`)
    await shoot('pay-starting-figures')
    await (await page.waitForSelector('[data-testid="starting-figures"] [data-testid="build-up-button"]')).tap()
    await page.waitForSelector('[data-testid="figure-detail"]')
    await page.waitForFunction(() => !document.querySelector('[data-testid="starting-figures"]'), { timeout: 5_000 }).catch(() => {
      throw new Error('the starting figures stayed open under the build-up')
    })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="figure-detail"]'))
  })

  for (const [mode, query] of [
    ['drive', ''],
    ['browser', '&fake=browser'],
  ]) {
    for (const [name, hash, title, run, variant] of [
      ['categories', '#/settings?tab=categories', 'Settings', categoryFlow],
      ['categories-filters', '#/settings?tab=categories', 'Settings', categoryFiltersFlow],
      ['settings-statements-folder', '#/settings', 'Settings', statementsFolderFlow],
      ['settings-card-ibans', '#/settings', 'Settings', cardSettlementIbansFlow],
      ['clients-ibans', '#/company/invoicing?tab=clients', 'Invoicing', clientIbansFlow],
      ['assets', '#/company/year?tab=assets#asset-rows', 'Year', assetFlow],
      ['employees', '#/company/salaries#employee-rows', 'Salaries', employeeFlow],
      ['advances', '#/company/owner?tab=owed', 'Owner', advanceFlow],
      ['invoices', '#/company/invoicing?p=all', 'Invoicing', invoiceFlow],
      ['invoice-run', '#/company/invoicing?p=all', 'Invoicing', invoiceRunFlow],
      ['scenarios', '#/company/year?year=2027&tab=pay', 'Year', scenarioFlow],
      ['starting-scenarios', '#/company/year?year=2027&tab=pay', 'Year', startingScenariosFlow, mode === 'drive' ? '&fake=no-scenarios' : '&fake=browser-no-scenarios'],
      ['plan', '#/company/year?year=2027&tab=plan', 'Year', planFlow],
      ['plan-tab', '#/company/year?year=2027&tab=plan', 'Year', planTabFlow, mode === 'drive' ? '&fake=no-plan' : '&fake=browser-no-plan'],
      ['split', '#/company/transactions?p=all&q=GADGET', 'Transactions', splitFlow],
      ['split-review', '#/company/review', 'Review', reviewSplitFlow],
      ['change-category', '#/company/transactions?p=all&q=CODE%20HOST', 'Transactions', changeCategoryFlow],
      ['owner-share', '#/company/transactions?p=all&q=purchase%2C%20laptop', 'Transactions', ownerShareFlow],
      ['share-fill', '#/settings?tab=categories', 'Settings', shareFillFlow],
      ['dismiss', '#/company/review?tab=rules', 'Review', dismissFlow],
      ['rules-editor', '#/company/review?tab=rules', 'Review', rulesEditorFlow],
      ['import-camt', '#/company/transactions?tab=import', 'Transactions', importCamtFlow(IMPORT_SAMPLES.camt)],
      ['import-table', '#/company/transactions?tab=import', 'Transactions', importTableFlow(IMPORT_SAMPLES.table)],
    ]) {
      await step(`${name}-${mode}`, async () => {
        await page.goto(`${BASE}?theme=dark${variant ?? query}&load=${Date.now()}${hash}`, { waitUntil: 'networkidle0' })
        await waitForTitle(page, title)
        await run(page, {
          press: (handle) => handle.tap(),
          shoot: async (shot) => {
            await inspect(page, `${width}px ${mode} ${shot}`)
            await page.screenshot({ path: join(OUTPUT_DIR, `${width}-${mode}-${shot}.png`), fullPage: false })
          },
          inspect: (when) => inspect(page, `${width}px ${mode} ${when}`),
        })
      })
    }
  }

  for (const [name, variant, run, hash = '#/company', title = 'Overview'] of [
    ['statements-sync', '', statementSyncFlow],
    ['statements-held', '&fake=held-statement', heldStatementFlow],
    ['statements-access', '', statementAccessFlow],
    ['sync-running', '&fake=slow-statements', syncRunningFlow],
    ['mail-off', '', mailOffFlow],
    ['mail-filed', '&fake=mail', mailFiledFlow],
    ['mail-upload-failed', '&fake=mail-upload-failed', mailUploadFailedFlow],
    ['mail-nothing-new', '&fake=mail-nothing-new', mailNothingNewFlow],
    ['mail-failed', '&fake=mail-failed', mailFailedFlow],
    ['mail-access', '&fake=mail', mailAccessFlow],
    ['mail-save-asks', '', mailSaveAsksFlow],
    ['mail-switches-off', '&fake=mail-switches-off', mailSwitchesOffFlow],
    ['mail-no-sender', '&fake=mail-no-sender', mailNoSenderFlow],
    ['mail-rate-limited', '&fake=mail-rate-limited', mailRateLimitedFlow],
    ['mail-window', '&fake=mail-nothing-new', mailWindowFlow],
    ['sync-access-closed', '&fake=google-closed', accessClosedFlow],
    ['salaries', '&fake=five-employees', salariesFlow, '#/company/salaries', 'Salaries'],
    ['owner-net', '&fake=browser', ownerNetFlow, '#/company/owner?p=2026', 'Owner'],
    ['owner-net-unregistered', '', ownerNetUnregisteredFlow, '#/company/owner?p=2026', 'Owner'],
  ]) {
    await step(name, async () => {
      await page.goto(`${BASE}?theme=dark${variant}&load=${Date.now()}${hash}`, { waitUntil: 'networkidle0' })
      await waitForTitle(page, title)
      await run(page, {
        press: (handle) => handle.tap(),
        shoot: async (shot) => {
          await inspect(page, `${width}px ${shot}`)
          await page.screenshot({ path: join(OUTPUT_DIR, `${width}-${shot}.png`), fullPage: false })
        },
        inspect: (when) => inspect(page, `${width}px ${when}`),
      })
    })
  }

  for (const screen of SCREENS) {
    const name = screen.name ?? screen.title.toLowerCase().replace(' ', '-')
    await step(name, async () => {
      await open(page, screen.hash, screen.title)
      await page.waitForSelector(screen.ready)
      await expect(topBarTitle(page), (title) => title === screen.title, 'the top bar does not name the screen')
      if (screen.title === 'Settings') await shoot(name)
      if (screen.cards !== false) {
        await collapseAndExpand(
          page,
          (handle) => handle.tap(),
          async () => {
            await inspect(page, `${width}px ${name} card collapsed`)
            await shoot(`${name}-card-collapsed`)
          },
        )
      }
    })
  }

  await step('ruleset-deep-link', async () => {
    await open(page, '#/settings?tab=ruleset', 'Settings')
    await page.waitForSelector('[data-testid="rule-row"]')
    const ruleRows = () => page.evaluate(() => document.querySelectorAll('[data-testid="rule-row"]').length)
    const everyRule = await ruleRows()
    await page.tap('input[data-testid="ruleset-search"]')
    await page.keyboard.type('director floor')
    await expect(ruleRows(), (shown) => shown >= 1 && shown < everyRule, 'the search did not narrow the rules')
    await inspect(page, `${width}px ruleset search`)
    await shoot('ruleset-search')
    await page.tap('[data-testid="ruleset-bar"] button[aria-label="Clear the search"]')
    await expect(ruleRows(), (shown) => shown === everyRule, 'clearing the search did not bring every rule back')

    const watchToggle = await page.waitForSelector('[data-testid="watch-list"] [data-testid="card-toggle"]')
    if ((await watchToggle.evaluate((toggle) => toggle.getAttribute('aria-expanded'))) === 'false') await watchToggle.tap()
    const link = await page.waitForSelector('[data-testid="watch-rule-link"]', { visible: true })
    const ruleId = await link.evaluate((element) => new URLSearchParams(element.getAttribute('href').split('?')[1]).get('rule'))
    await link.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await link.tap()
    await page.waitForFunction((wanted) => window.location.hash.includes(`rule=${wanted}`), { timeout: 5_000 }, ruleId)
    await page
      .waitForFunction(
        (wanted) => {
          const panel = document.querySelector('[role="dialog"]')
          const panelBox = panel?.getBoundingClientRect()
          const line = document.getElementById(`rule-${wanted}`)
          return (
            panel?.querySelector('[data-testid="rule-detail"]') != null &&
            panel.textContent.includes(wanted) &&
            panelBox.left <= 1 &&
            panelBox.top <= 1 &&
            panelBox.bottom >= window.innerHeight - 1 &&
            line?.getAttribute('aria-current') === 'true'
          )
        },
        { timeout: 5_000 },
        ruleId,
      )
      .catch(() => {
        throw new Error(`the watch list link did not open ${ruleId} in a full-height sheet with its line marked`)
      })
    await delay(400)
    await inspect(page, `${width}px rule detail`)
    await shoot('ruleset-linked')
    await (await page.waitForSelector('[role="dialog"] button[aria-label="Close"]')).tap()
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]') && !window.location.hash.includes('rule='), { timeout: 5_000 }).catch(() => {
      throw new Error('closing the rule did not take it out of the address')
    })
    const list = page.url()
    await page.goBack({ waitUntil: 'networkidle0' })
    await expect(page.url(), (address) => address !== list, 'Back after closing the rule showed the same list again')
  })

  await step('ruleset-local-rates', async () => {
    await open(page, '#/settings?tab=ruleset&rule=hr.pit.local-rates', 'Settings')
    const card = '[role="dialog"] [data-testid="rule-detail"]'
    const tableCount = () => page.$eval(`${card} [data-testid="table-count"]`, (element) => element.textContent.trim())
    const rowsShown = (text) => Number(text.split(' ')[0])
    await page.waitForSelector(`${card} [data-testid="table-count"]`)
    await delay(400)
    await expect(tableCount(), (text) => rowsShown(text) <= 8, "the local rates opened on more than the owner's unit")
    await inspect(page, `${width}px local rates, folded`)
    await shoot('ruleset-local-rates')
    const search = await page.$(`${card} input[data-testid="table-search"]`)
    await search.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await search.tap()
    await page.keyboard.type('rijeka')
    await expect(tableCount(), (text) => rowsShown(text) >= 4 && !text.startsWith('All'), 'the table search did not find Rijeka')
    await inspect(page, `${width}px local rates search`)
    await shoot('ruleset-local-rates-search')
    await page.tap(`${card} button[aria-label="Clear the table search"]`)
    await page.tap(`${card} [data-testid="table-show-all"]`)
    await expect(tableCount(), (text) => text.startsWith('All'), 'Show all did not show every row')
    await inspect(page, `${width}px local rates, all rows`)
    await page.tap(`${card} [data-testid="table-show-all"]`)
    await expect(tableCount(), (text) => !text.startsWith('All'), 'Show fewer did not fold the table back')
  })

  await step('settings-browser', async () => {
    await page.goto(`${BASE}?theme=dark&fake=browser#/settings?tab=device`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Settings')
    await waitForText(page, 'button', 'Import a file')
  })

  await step('settings-language', async () => {
    const shown = () => page.evaluate(() => ({ lang: document.documentElement.lang, text: document.body.innerText }))
    const pick = (choice) => Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.tap(`[data-testid="language-choice"] [role="radio"][value="${choice}"]`)])
    try {
      await open(page, '#/settings?tab=device', 'Settings')
      await expect(shown(), (screen) => screen.lang === 'en', 'the app did not open in English')
      await pick('hr')
      await waitForTitle(page, 'Settings')
      await expect(shown(), (screen) => screen.lang === 'hr' && /\d{1,2}\. [a-zčćđšž]{3,} \d{4}\./.test(screen.text), 'picking Hrvatski did not load the app again in Croatian, with a Croatian date')
      await inspect(page, `${width}px settings in Croatian`)
      await shoot('settings-language-croatian')
      await pick('browser')
      await waitForTitle(page, 'Settings')
      await expect(shown(), (screen) => screen.lang === 'en' && screen.text.includes('Browser language'), 'Browser language did not bring English back')
    } finally {
      // A step that stopped half way must not leave the later steps in Croatian.
      await page.evaluate(() => localStorage.removeItem('kuna.language')).catch(() => {})
    }
  })

  await step('settings-tabs', async () => {
    await page.goto(`${BASE}?theme=dark&fake=browser#/settings`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Settings')
    await waitForText(page, 'button', 'Save settings')
    await shoot('settings-general')
    for (const [label, query, ready] of [
      ['Categories', 'tab=categories', 'Save categories'],
      ['Accounts', 'tab=accounts', 'Save accounts'],
    ]) {
      const tab = await waitForText(page, '[role="tab"]', label)
      await tab.tap()
      await page.waitForFunction((wanted) => window.location.hash.includes(wanted), {}, query)
      await waitForText(page, 'button', ready)
      await inspect(page, `${width}px settings ${label.toLowerCase()}`)
    }
    await shoot('settings-accounts')
  })

  await step('year-editors', async () => {
    for (const [hash, ready, name] of [
      ['#/company/year?year=2025&tab=statements#accountant-lines', 'Save year-end lines', 'year-accountant-lines'],
      ['#/company/year?tab=assets#asset-rows', 'Save assets', 'year-asset-rows'],
      ['#/company/year?tab=assets#grant-rows', 'Save grants', 'year-grant-rows'],
    ]) {
      await page.goto(`${BASE}?theme=dark&fake=browser&load=${Date.now()}${hash}`, { waitUntil: 'networkidle0' })
      await waitForTitle(page, 'Year')
      await waitForText(page, 'button', ready)
      await inspect(page, `${width}px ${name}`)
      await shoot(name)
    }
  })

  await step('invoicing-clients', async () => {
    await page.goto(`${BASE}?theme=dark&fake=browser#/company/invoicing?tab=clients`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Invoicing')
    await waitForText(page, 'button', 'Save clients')
    await inspect(page, `${width}px invoicing clients`)
    const termsToggle = await page.waitForSelector('[data-testid="invoicing-terms-card"] [data-testid="card-toggle"]')
    await termsToggle.evaluate((toggle) => toggle.scrollIntoView({ block: 'center' }))
    await delay(200)
    if ((await termsToggle.evaluate((toggle) => toggle.getAttribute('aria-expanded'))) === 'false') await termsToggle.tap()
    await page.waitForSelector('[data-testid="terms-save"]', { visible: true })
    await inspect(page, `${width}px invoicing terms`)
    await shoot('invoicing-terms')
  })

  await step('page-tabs', async () => {
    await open(page, '#/settings', 'Settings')
    await pageTabsFlow(page, { press: (handle) => handle.tap(), shoot })
  })

  await step('year-tab-link', async () => {
    await open(page, '#/company/year?tab=statements', 'Year')
    await yearTabLinkFlow(page, { press: (handle) => handle.tap(), shoot })
  })

  await step('review-confirm-undo', async () => {
    await openFreshBrowser(page, '#/company/review', 'Review')
    await expect(reviewCount(page), (count) => count === 2, 'the queue does not hold the two fake rows')
    await (await reviewRow(page, 'GADGET CORNER')).tap()
    await page.waitForSelector('[data-testid="review-details"]')
    await delay(200)
    await inspect(page, `${width}px review row open`)
    await shoot('review-expanded')
    await (await waitForText(page, '[data-testid="review-details"] button', 'Confirm')).tap()
    await waitForText(page, '[data-slot="title"]', 'Confirmed')
    await expect(reviewCount(page), (count) => count === 1, 'the confirmed row is still waiting')
    // The toast rises into place. A tap before it settles lands where it was.
    await delay(700)
    await (await waitForText(page, 'button', 'Undo')).tap()
    await waitForText(page, '[data-slot="title"]', 'Undone')
    await expect(reviewCount(page), (count) => count === 2, 'Undo did not bring the row back')
  })

  await step('review-recategorise-undo', async () => {
    await openFreshBrowser(page, '#/company/review', 'Review')
    await (await reviewRow(page, 'SNACK KIOSK')).tap()
    await page.waitForSelector('[data-testid="recategorise-row"]')
    await page.tap('[data-testid="review-details"] [data-testid="recategorise-row"]')
    await page.waitForSelector('[role="listbox"] [role="option"]')
    await page.keyboard.type('travel')
    await (await waitForText(page, '[role="option"]', 'Travel')).tap()
    await waitForText(page, '[data-slot="title"]', 'Filed as Travel')
    await expect(reviewCount(page), (count) => count === 1, 'the recategorised row is still waiting')
    await delay(300)
    await inspect(page, `${width}px toast with Undo`)
    await shoot('review-recategorised-toast')
    // The toast rises into place. A tap before it settles lands where it was.
    await delay(700)
    await (await waitForText(page, 'button', 'Undo')).tap()
    await waitForText(page, '[data-slot="title"]', 'Undone')
    await expect(reviewCount(page), (count) => count === 2, 'Undo did not bring the row back')
  })

  await step('session-panel-undo', async () => {
    await openFreshBrowser(page, '#/company/review', 'Review')
    await (await reviewRow(page, 'GADGET CORNER')).tap()
    await (await waitForText(page, '[data-testid="review-details"] button', 'Confirm')).tap()
    await waitForText(page, '[data-slot="title"]', 'Confirmed')
    await expect(reviewCount(page), (count) => count === 1, 'the confirmed row is still waiting')
    await expect(
      page.evaluate(() => document.querySelector('[data-testid="session-count"]')?.textContent?.trim() ?? null),
      (count) => count === '1',
      'the session panel does not count the write',
    )
    // The panel sits below the queue, where the toast rises, so the toast goes first.
    await closeToasts(page)
    const toggle = await page.$('[data-testid="session-changes"] [data-testid="card-toggle"]')
    await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await toggle.tap()
    await page.waitForSelector('[data-testid="session-write"]')
    await expect(
      page.evaluate(() => document.querySelector('[data-testid="session-write"]')?.textContent ?? ''),
      (text) => text.includes('Confirmed a row') && text.includes('GADGET CORNER') && text.includes('human'),
      'the session entry does not say what changed',
    )
    await page.evaluate(() => document.querySelector('[data-testid="session-changes"]').scrollIntoView({ block: 'center' }))
    await delay(300)
    await inspect(page, `${width}px session panel open`)
    await shoot('session-panel')
    await page.tap('[data-testid="session-undo"]')
    await waitForText(page, '[data-slot="title"]', 'Undone')
    await expect(reviewCount(page), (count) => count === 2, 'Undo from the session panel did not bring the row back')
    await expect(
      page.evaluate(() => ({
        entries: [...document.querySelectorAll('[data-testid="session-write"]')].map((entry) => entry.textContent ?? ''),
        undoOffered: document.querySelector('[data-testid="session-undo"]') !== null,
      })),
      ({ entries, undoOffered }) => entries.length === 2 && entries[0].includes('Undid a change') && entries[1].includes('Undone') && !undoOffered,
      'the session panel does not show the undo beside the write it undid',
    )
    await inspect(page, `${width}px session panel after undo`)
  })

  await step('make-rule-apply', async () => {
    await openFreshBrowser(page, '#/company/review', 'Review')
    await (await reviewRow(page, 'GADGET CORNER')).tap()
    await page.tap('[data-testid="review-details"] [data-testid="make-rule"]')
    await page.waitForSelector('[data-testid="rule-backtest"]')
    await delay(400)
    await inspect(page, `${width}px rule form`)
    await shoot('rule-form')
    await expect(
      page.evaluate(() => document.querySelector('[data-testid="backtest-settled"]')?.textContent ?? ''),
      (text) => text.includes('GADGET CORNER'),
      'the back-test does not list the row the rule settles',
    )
    await page.evaluate(() => document.querySelector('[data-testid="backtest-conflicts"]').scrollIntoView({ block: 'center' }))
    await delay(200)
    await shoot('rule-backtest')
    await page.tap('[data-testid="save-rule"]')
    const apply = await waitForText(page, '[data-testid="apply-rule"]', 'Apply to the 1 row still waiting')
    await delay(300)
    await inspect(page, `${width}px rule saved`)
    await apply.tap()
    await waitForText(page, '[data-slot="title"]', 'Filed 1 row by')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"] [data-testid="rule-saved"]'))
    await expect(reviewCount(page), (count) => count === 1, 'the row the new rule settles is still waiting')
  })

  await step('coverage-split', async () => {
    await openFreshBrowser(page, '#/company/review?tab=rules', 'Review')
    await openCoverage(page)
    const split = await waitForText(page, '[data-testid="coverage-gap"]', 'STATE BUDGET')
    await expect(
      split.evaluate((group) => group.textContent ?? ''),
      (text) => text.includes('2 categories'),
      'a group filed in two categories does not say so',
    )
    await split.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await (await split.$('[data-testid="coverage-make-rule"]')).tap()
    await page.waitForSelector('[data-testid="rule-split"]')
    await delay(400)
    await inspect(page, `${width}px rule form from a split group`)
    await shoot('rule-split')
    await (await waitForText(page, '[role="dialog"] button', 'Cancel')).tap()
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))

    // A rule by the fragment STORE files PAPER & INK STORE as equipment, against the person's office supplies, so that row turns into an exception.
    const laptop = await waitForText(page, '[data-testid="coverage-gap"]', 'Laptop Store')
    await laptop.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await (await laptop.$('[data-testid="coverage-make-rule"]')).tap()
    const fragment = await page.waitForSelector('[data-testid="rule-condition"] input[aria-label="Counterparty contains"]')
    await fragment.evaluate((input) => input.select())
    await page.keyboard.type('STORE')
    const accept = await page.waitForSelector('[data-testid="accept-backtest"][role="checkbox"], [data-testid="accept-backtest"] [role="checkbox"]')
    await accept.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(300)
    await accept.tap()
    await page.tap('[data-testid="save-rule"]')
    await (await waitForText(page, '[role="dialog"] button', 'Done')).tap()
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    // The save's toast shows once the editor closes and would take the taps below.
    await waitForText(page, '[data-slot="title"]', 'Added merchant-laptop-store')
    await closeToasts(page)

    const exception = await waitForText(page, '[data-testid="coverage-exception"]', 'PAPER & INK STORE')
    await expect(
      exception.evaluate((group) => group.textContent ?? ''),
      (text) => text.includes('merchant-laptop-store files them as') && !text.includes('Make this a rule'),
      'the exception does not name the rule that files it, or still offers a rule',
    )
    await page.evaluate(() => document.querySelector('[data-testid="coverage-exceptions"]').scrollIntoView({ block: 'end' }))
    await delay(300)
    await inspect(page, `${width}px coverage with exceptions`)
    await shoot('coverage-split')
    await (await exception.$('[data-testid="coverage-open-rule"]')).tap()
    await page.waitForFunction(() => window.location.hash.includes('rule=merchant-laptop-store'))
    await page.waitForSelector('[data-testid="rule-row"][aria-current="true"]')
    await expect(
      page.evaluate(() => document.querySelector('[data-testid="rule-row"][aria-current="true"]')?.textContent ?? ''),
      (text) => text.includes('merchant-laptop-store'),
      'Open the rule does not mark the rule in the rules list',
    )
    await delay(300)
    await inspect(page, `${width}px rule highlighted`)
    await shoot('rule-highlighted')
  })

  await step('rules-tab-edit', async () => {
    await openFreshBrowser(page, '#/company/review?tab=rules', 'Review')
    await page.waitForSelector('[data-testid="rule-row"]')
    await inspect(page, `${width}px rules tab`)
    await shoot('rules-tab')
    await page.tap('[data-testid="rule-row"] [data-testid="edit-rule"]')
    await page.waitForSelector('[data-testid="rule-form"] textarea')
    await page.tap('[data-testid="rule-form"] textarea')
    await page.keyboard.type(' Checked on the phone.')
    await delay(300)
    await inspect(page, `${width}px rule edit`)
    await page.tap('[data-testid="save-rule"]')
    await waitForText(page, '[role="dialog"] [data-slot="title"]', 'Saved own-account')
    await (await waitForText(page, '[role="dialog"] button', 'Done')).tap()
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    await waitForText(page, '[data-slot="title"]', 'Edited own-account: note')
    await closeToasts(page)
    await expect(
      page.evaluate(() => document.querySelector('[data-testid="rule-row"]')?.textContent ?? ''),
      (text) => text.includes('Checked on the phone.'),
      'the edited note did not reach the rules tab',
    )
    await page.tap('[data-testid="rule-row"] [role="switch"]')
    // Switching off own-account hands the two transfer legs to review, so the change needs an explicit yes.
    const accept = await page.waitForSelector('[data-testid="accept-backtest"][role="checkbox"], [data-testid="accept-backtest"] [role="checkbox"]')
    await accept.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(300)
    await inspect(page, `${width}px rule switch-off back-test`)
    await shoot('rule-switch-off')
    await accept.tap()
    await (await waitForText(page, '[data-testid="save-rules-change"]', 'Switch off')).tap()
    await waitForText(page, '[data-slot="title"]', 'Switched off own-account')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    await expect(
      page.evaluate(() => [...document.querySelectorAll('[data-testid="rule-row"] [role="switch"]')].some((toggle) => toggle.getAttribute('aria-checked') === 'false')),
      (off) => off,
      'the rule did not switch off',
    )
  })

  await step('google-return', async () => {
    const scopeOf = (...names) => encodeURIComponent(['openid', ...names.map((name) => `https://www.googleapis.com/auth/${name}`)].join(' '))
    const tokenOf = (scope, state = 'touch-check') => `access_token=fake-one-token&token_type=Bearer&expires_in=3599&scope=${scope}&state=${state}`
    const everyScope = scopeOf('drive.file', 'drive.readonly', 'gmail.readonly', 'gmail.compose')
    const tapAsk = { state: 'touch-check', scopes: ['drive.file', 'drive.readonly', 'gmail.readonly', 'gmail.compose'], resume: 'sync', route: '#/company/transactions', ask: 'tap' }
    const silentAsk = { state: 'touch-check', scopes: ['drive.file', 'drive.readonly'], resume: 'none', route: '#/company/review', ask: 'silent' }
    /** Loads the app as Google sends the tab back, with what the tab remembered before it left, nothing kept from an earlier grant and invoice drafts off. */
    const comeBack = async (variant, pending, fragment) => {
      await page.goto(`${BASE}?theme=dark&fake=${variant}#/`, { waitUntil: 'networkidle0' })
      await page.evaluate((remembered) => {
        for (const key of ['kuna.google-granted', 'kuna.google-silent-refused', 'kuna.invoice-mail-draft']) localStorage.removeItem(key)
        localStorage.setItem('kuna.google-account', 'owner@example.com')
        localStorage.setItem('kuna.google-redirect', JSON.stringify(remembered))
      }, pending)
      await page.goto(`${BASE}?theme=dark&fake=${variant}&load=${Date.now()}#${fragment}`, { waitUntil: 'networkidle0' })
    }
    const fragmentGone = () => page.evaluate(() => !window.location.href.includes('access_token') && !window.location.href.includes('error='))
    const tokenKept = () => page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).includes('fake-one-token'))
    const granted = () => page.evaluate(() => JSON.parse(localStorage.getItem('kuna.google-granted') ?? 'null'))
    const deviceMark = () => page.evaluate(() => localStorage.getItem('kuna.google-silent-refused'))
    const noMessage = () => page.evaluate(() => document.querySelectorAll('li[data-slot="base"]').length === 0)
    const control = () =>
      page.evaluate(() => {
        const button = document.querySelector('header [data-testid="sync-button"]')
        return { label: button?.textContent?.trim() ?? '', name: button?.getAttribute('aria-label') ?? '' }
      })
    const controlShows = (kind, failure) =>
      page.waitForFunction((wanted) => document.querySelector('[data-testid="sync-status"]')?.dataset.control === wanted, { timeout: 12_000 }, kind).catch(() => {
        throw new Error(failure)
      })
    const watchSync = await page.evaluateOnNewDocument(() => {
      new MutationObserver(() => {
        if (document.querySelector('[data-testid="sync-status"]')?.dataset.control === 'running') window.sawSyncing = true
      }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['data-control'] })
    })
    const syncStarted = (after) =>
      page.waitForFunction(() => window.sawSyncing === true, { timeout: 10_000 }).catch(() => {
        throw new Error(`the sync did not start by itself after ${after}`)
      })

    await page.goto(`${BASE}?theme=dark&fake=empty#/company/start?step=access`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Kuna')
    await waitForText(page, '[data-testid="redirect-sign-in-note"]', 'Google may ask about cookies first')

    // Allow access on a phone, every box ticked: one token for every scope, and the sync it resumes runs and ends ready, with no message.
    await comeBack('drive', tapAsk, tokenOf(everyScope))
    await waitForTitle(page, 'Transactions')
    await syncStarted('a full grant')
    await controlShows('ready', 'the sync after a full grant did not end ready')
    await expect(hashOf(page), (hash) => hash === '#/company/transactions', 'the return did not land on the route the tap left')
    await expect(fragmentGone(), (gone) => gone, 'the token stayed in the address')
    await expect(tokenKept(), (kept) => !kept, 'the token was kept in site storage, not in page memory only')
    await expect(granted(), (scopes) => JSON.stringify(scopes) === JSON.stringify(['drive.file', 'drive.readonly', 'gmail.readonly', 'gmail.compose']), 'the full grant was not noted')
    await expect(noMessage(), (none) => none, 'the full grant showed a message')
    await inspect(page, `${width}px full grant return`)
    await shoot('google-return-full-grant')

    // The same with Drive read unticked: the books sync, and the control asks for Drive read for the steps that need it.
    await comeBack('drive', tapAsk, tokenOf(scopeOf('drive.file', 'gmail.compose')))
    await waitForTitle(page, 'Transactions')
    await syncStarted('a partial grant')
    await controlShows('allow-access', 'a grant without Drive read did not leave Allow access in the sync control')
    const partial = await control()
    if (!partial.name.includes('Statements needs your Drive read access')) throw new Error(`after a partial grant a screen reader hears "${partial.name}"`)
    await expect(granted(), (scopes) => JSON.stringify(scopes) === JSON.stringify(['drive.file', 'gmail.compose']), 'the partial grant was not noted without Drive read')
    await expect(noMessage(), (none) => none, 'the partial grant showed a message')
    await inspect(page, `${width}px partial grant return`)
    await shoot('google-return-partial-grant')
    await page.removeScriptToEvaluateOnNewDocument(watchSync.identifier)

    // A refused consent and an answer this tab never asked for leave Allow access, never a message.
    for (const [pending, fragment, what] of [
      [tapAsk, 'error=access_denied&state=touch-check', 'a refused consent'],
      [tapAsk, tokenOf(everyScope, 'forged'), 'a forged answer'],
    ]) {
      await comeBack('drive', pending, fragment)
      await waitForTitle(page, 'Transactions')
      await controlShows('allow-access', `${what} did not leave Allow access in the sync control`)
      await expect(fragmentGone(), (gone) => gone, `${what} stayed in the address`)
      await expect(noMessage(), (none) => none, `${what} showed a message`)
    }

    // The silent trip as the app opens, refused: the device is marked, so the next open stays, and the control asks for a tap.
    await comeBack('drive', silentAsk, 'error=interaction_required&state=touch-check')
    await waitForTitle(page, 'Review')
    await controlShows('allow-access', 'a refused silent trip did not leave Allow access in the sync control')
    await expect(noMessage(), (none) => none, 'the refused silent trip showed a message')
    await expect(deviceMark(), (mark) => mark === 'interaction_required', 'the refused silent trip did not mark the device')
    await page.reload({ waitUntil: 'networkidle0' })
    await controlShows('allow-access', 'the next open of a marked device did not wait for a tap')
    await inspect(page, `${width}px refused silent trip`)
    await shoot('google-return-silent-refused')
    await (await page.waitForSelector('header [data-testid="sync-button"]')).tap()
    await controlShows('ready', 'Allow access after a refused silent trip did not sync')
    await expect(deviceMark(), (mark) => mark === 'interaction_required', 'a tap\'s token cleared a mark Google gave as needing a person')

    // Not signed in to Google: the control says so, and its tap signs in, syncs and lets the next open go silently again.
    await comeBack('drive', silentAsk, 'error=login_required&state=touch-check')
    await waitForTitle(page, 'Review')
    await controlShows('sign-in', 'Google asking for a sign-in did not show Sign in to Google')
    const signIn = await control()
    if (signIn.label !== 'Sign in to Google') throw new Error(`the sync control says "${signIn.label}", not Sign in to Google`)
    await inspect(page, `${width}px sign in to google`)
    await shoot('google-return-sign-in')
    await (await page.waitForSelector('header [data-testid="sync-button"]')).tap()
    await controlShows('ready', 'Sign in to Google did not sync')
    await expect(deviceMark(), (mark) => mark === null, 'the token after a sign-in left the device marked')

    // The empty fake Drive holds no file the app marked, and its Picker picks none, so the find the tap resumes leaves onboarding's find step.
    await comeBack('empty', { ...tapAsk, resume: 'find', app: 'company', route: '#/company/start?path=open&step=find' }, tokenOf(everyScope))
    await waitForTitle(page, 'Kuna')
    await expect(hashOf(page), (hash) => hash === '#/company/start?path=open&step=find', 'the find the tap resumed did not stay on the find step')
    await expect(fragmentGone(), (gone) => gone, 'the token stayed in the address after the find resumed')

    // The fake Picker the tap resumes picks the file in Books, which is the one on screen.
    await comeBack('drive', { ...tapAsk, resume: 'pick', app: 'company', route: '#/company' }, tokenOf(everyScope))
    await waitForTitle(page, 'Overview')
    await waitForText(page, 'li[data-slot="base"]', 'Your books are already open')

    // Onboarding's access step resumes nothing: the route brings the person back to it, and it says what Google allowed, with no message.
    await comeBack('empty', { ...tapAsk, scopes: ['drive.file', 'drive.readonly'], resume: 'none', route: '#/company/start?step=access&statements=folder' }, tokenOf(scopeOf('drive.file')))
    await waitForTitle(page, 'Kuna')
    await expect(hashOf(page), (hash) => hash === '#/company/start?step=access&statements=folder', 'the return did not land on the step the tap left')
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="access-status"]')].map((badge) => badge.textContent?.trim()).join(',') === 'Allowed,Not allowed', { timeout: 10_000 }).catch(() => {
      throw new Error('the access step does not say Google allowed the books file and not Drive read')
    })
    await expect(noMessage(), (none) => none, 'the return to the access step showed a message')
    await inspect(page, `${width}px access step after Google`)
    await shoot('google-return-onboarding')
  })

  await step('google-return-loans', async () => {
    // A find the Loans first run left the page for comes back to the Loans app alone: it opens the file another device made, found by its mark, and ends on the Loans Overview.
    // The tap asked for every scope the company books need beside the Loans file's, as a tap does.
    const scopes = ['drive.file', 'drive.readonly', 'gmail.readonly', 'gmail.compose']
    const scope = encodeURIComponent(['openid', ...scopes.map((name) => `https://www.googleapis.com/auth/${name}`)].join(' '))
    const pending = { state: 'touch-check', scopes, resume: 'find', app: 'loans', route: '#/loans/start?step=find', ask: 'tap' }
    await page.goto(`${BASE}?theme=dark&loans=other-device#/`, { waitUntil: 'networkidle0' })
    await page.evaluate((remembered) => {
      localStorage.removeItem('kuna.google-silent-refused')
      localStorage.setItem('kuna.google-redirect', JSON.stringify(remembered))
    }, pending)
    await page.goto(`${BASE}?theme=dark&loans=other-device&load=${Date.now()}#access_token=fake-one-token&token_type=Bearer&expires_in=3599&scope=${scope}&state=touch-check`, { waitUntil: 'networkidle0' })
    await waitForText(page, 'li[data-slot="base"]', 'Opened kuna-loans.json')
    await page.waitForFunction(() => window.location.hash === '#/loans' && document.querySelector('[data-testid="loans-empty"]') !== null, { timeout: 10_000 }).catch(() => {
      throw new Error('the find the tap resumed did not end on the Loans Overview')
    })
    await expect(
      page.evaluate(() => [...document.querySelectorAll('li[data-slot="base"] [data-slot="title"]')].map((title) => title.textContent?.trim())),
      (titles) => titles.length === 1,
      'the company books acted on the Loans find too',
    )
    await expect(page.evaluate(() => !window.location.href.includes('access_token')), (gone) => gone, 'the token stayed in the address after the Loans find resumed')
    await inspect(page, `${width}px resumed Loans find`)
    await shoot('google-return-loans-find')
  })

  // The sample Loans file, ?loans=sample: its Overview and both loan pages with a card collapsed on each, then an extra payment entered and undone.
  for (const [name, hash, title, ready] of [
    ['loans-overview', '#/loans', 'Overview', '[data-testid="loan-cards"]'],
    ['loans-bank-loan', `#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`, 'Home loan', '[data-testid="loan-plan"]'],
    ['loans-informal-loan', `#/loans/informal-loan?loan=${SAMPLE_INFORMAL_LOAN}`, 'From Marko', '[data-testid="movement-list"]'],
  ]) {
    await step(name, async () => {
      await page.goto(`${BASE}?theme=dark&loans=sample&load=${Date.now()}${hash}`, { waitUntil: 'networkidle0' })
      await waitForTitle(page, title)
      await page.waitForSelector(ready)
      await inspect(page, `${width}px ${name}`)
      await shoot(name)
      if ((await page.$('[data-card]')) !== null) {
        await collapseAndExpand(
          page,
          (handle) => handle.tap(),
          async () => {
            await inspect(page, `${width}px ${name} card collapsed`)
            await shoot(`${name}-card-collapsed`)
          },
        )
      }
    })
  }

  await step('loans-plan-row', async () => {
    await page.goto(`${BASE}?theme=dark&loans=sample&load=${Date.now()}#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Home loan')
    const toggle = await page.waitForSelector('[data-testid="plan-row-toggle"]', { visible: true })
    await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await toggle.tap()
    await waitForText(page, '[data-testid="plan-row-detail"]', 'Instalment')
    await inspect(page, `${width}px a plan row opened`)
    await shoot('loans-plan-row')
  })

  await step('loans-extra-payment-undo', async () => {
    await page.goto(`${BASE}?theme=dark&loans=sample&load=${Date.now()}#/loans/bank-loan?loan=${SAMPLE_BANK_LOAN}`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Home loan')
    const payments = () => page.evaluate(() => document.querySelectorAll('[data-testid="extra-payments"] [data-testid="change-line"]').length)
    const before = await payments()
    const add = await page.waitForSelector('[data-testid="extra-payments"] [data-testid="change-add"]')
    await add.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await add.tap()
    await page.waitForSelector('[data-testid="extra-payment-form"]')
    await delay(300)
    await page.tap('[data-testid="extra-payment-date"]')
    await page.$eval('[data-testid="extra-payment-date"]', (input) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2026-11-25')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await page.tap('[data-testid="extra-payment-amount"]')
    await page.type('[data-testid="extra-payment-amount"]', '3000')
    await (await waitForText(page, '[data-testid="extra-payment-effect"] label', 'Shorter term')).tap()
    await inspect(page, `${width}px extra payment form`)
    await shoot('loans-extra-payment')
    await page.tap('[data-testid="extra-payment-save"]')
    await waitForText(page, '[data-slot="title"]', 'Extra payment added')
    await expect(payments(), (count) => count === before + 1, 'the extra payment is not listed')
    await delay(700)
    await (await waitForText(page, 'button', 'Undo')).tap()
    await waitForText(page, '[data-slot="title"]', 'Undone')
    await expect(payments(), (count) => count === before, 'Undo did not take the extra payment off the list')
  })

  await step('open-file-browser', async () => {
    await page.goto(`${BASE}?theme=dark&fake=empty#/`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Kuna')
    await inspect(page, `${width}px welcome`)
    await page.goto(`${BASE}?theme=dark&fake=empty#/company/start?path=bring&home=browser&step=file`, { waitUntil: 'networkidle0' })
    const input = await page.waitForSelector('input[data-testid="onboarding-file"]')
    await input.uploadFile(TEMPLATE_FILE)
    await page.waitForSelector('[data-testid="import-summary"] dl')
    await delay(400)
    await inspect(page, `${width}px import summary`)
    await shoot('import-summary')
    await (await waitForText(page, '[data-testid="onboarding-step"] button', 'Keep in this browser')).tap()
    await waitForText(page, '[data-testid="onboarding-step"] button', 'Continue')
    await (await waitForText(page, '[data-testid="onboarding-step"] button', 'Continue')).tap()
    await waitForTitle(page, 'Overview')
    await waitForText(page, 'header [data-testid="local-status"] button', 'Export')
  })

  for (const [name, variant, run, hash = '#/', title = 'Kuna'] of [
    ['onboarding-drive', 'empty', onboardingDriveFlow],
    ['onboarding-drive-read', 'empty', onboardingDriveReadFlow],
    ['onboarding-mail', 'empty', onboardingMailFlow],
    ['onboarding-browser', 'empty', onboardingBrowserFlow],
    ['onboarding-bring', 'empty', onboardingBringFlow(TEMPLATE_FILE)],
    ['onboarding-open', 'drive', onboardingOpenFlow, '#/company/start?path=open', 'Kuna'],
    ['onboarding-statement-access', 'drive', onboardingStatementAccessFlow, '#/company/start?step=statement&statements=folder', 'Kuna'],
    ['move-browser', 'browser', moveFromBrowserFlow, '#/settings?tab=device', 'Settings'],
    ['race', 'race', raceFlow, '#/company/review', 'Review'],
  ]) {
    await step(name, async () => {
      await page.goto(`${BASE}?theme=dark&fake=${variant}&load=${Date.now()}${hash}`, { waitUntil: 'networkidle0' })
      await waitForTitle(page, title)
      await run(page, {
        press: (handle) => handle.tap(),
        shoot,
        inspect: (when) => inspect(page, `${width}px ${when}`),
      })
    })
  }

  await step('newer-file', async () => {
    await page.goto(`${BASE}?theme=dark&fake=newer-file&load=${Date.now()}#/settings?tab=device`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Settings')
    await waitForText(page, '[data-testid="newer-file-notice"]', 'A newer version of Kuna saved this file')
    await inspect(page, `${width}px newer file`)
    await shoot('newer-file')
  })

  if (errors.length) failures.push(`[${width}px] console errors: ${errors.slice(0, 3).join(' | ')}`)
  if (foreign.length) failures.push(`[${width}px] requests to other origins: ${foreign.slice(0, 3).join(' | ')}`)
  await context.close()
}

async function open(page, hash, title) {
  await page.goto(`${BASE}?theme=dark${hash}`, { waitUntil: 'networkidle0' })
  await waitForTitle(page, title)
}

/**
 * Loads the fake workbook kept in this browser anew, its seed replacing what earlier steps wrote and
 * no toast left over. The query changes on every load, since a URL that differs only after the #
 * would not load the page again.
 */
async function openFreshBrowser(page, hash, title) {
  await page.goto(`${BASE}?theme=dark&fake=browser&load=${Date.now()}${hash}`, { waitUntil: 'networkidle0' })
  await waitForTitle(page, title)
}

async function waitForTitle(page, title) {
  await page.waitForFunction(
    (expected) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === expected,
    { timeout: 10_000 },
    title,
  )
}

async function openDrawer(page) {
  await page.tap('[data-testid="open-navigation"]')
  await waitForText(page, '[role="dialog"] a', 'Transactions')
  // The drawer slides in. A tap or a screenshot should meet it in place.
  await delay(300)
}

function drawerClosed(page) {
  return page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
}

function topBarTitle(page) {
  return page.evaluate(() => document.querySelector('[data-testid="top-bar-title"]')?.textContent?.trim() ?? null)
}

async function waitForText(page, selector, text) {
  const handle = await page
    .waitForFunction(
      // A collapsed card keeps its body on the page, hidden, so nothing inside one counts.
      (css, wanted) => [...document.querySelectorAll(css)].find((element) => !element.closest('[data-collapsed="true"]') && element.textContent?.trim().startsWith(wanted)) ?? null,
      { timeout: 10_000 },
      selector,
      text,
    )
    .catch((error) => {
      throw new Error(`no ${selector} reading "${text}" within 10 s (${error.message})`)
    })
  return handle.asElement()
}

async function settleCharts(page) {
  await page.waitForSelector('.chart-body canvas')
  // ECharts animates bars in. A tap should land where they end up.
  await delay(1500)
}

/** Taps across the first chart, or the one `canvas` names, until a mark answers with the drill offer, and returns where it hit, as fractions of the plot. */
async function tapUntilDrillOffered(page, canvas = '.chart-body canvas') {
  for (const row of [0.3, 0.45, 0.6, 0.2, 0.7]) {
    for (const column of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
      const spot = { row, column }
      await tapChart(page, spot, canvas)
      await delay(150)
      if (await page.$('[data-testid="chart-drill"]')) return spot
    }
  }
  throw new Error(`no tap on ${canvas} offered "View rows"`)
}

async function tapChart(page, { row, column }, selector = '.chart-body canvas') {
  const canvas = await page.$(selector)
  await canvas.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  const box = await canvas.boundingBox()
  await page.touchscreen.tap(box.x + box.width * column, box.y + box.height * row)
}

/** Whether the group of one category is expanded, and how many cards it shows. */
function groupState(page, category) {
  return page.evaluate((wanted) => {
    const group = [...document.querySelectorAll('[data-testid="transaction-group"]')].find(
      (section) => section.querySelector('.category-chip')?.textContent?.trim() === wanted,
    )
    if (!group) return null
    return {
      expanded: group.querySelector('[data-testid="group-toggle"]')?.getAttribute('aria-expanded') === 'true',
      cards: group.querySelectorAll('[data-testid="transaction-card"]').length,
    }
  }, category)
}

async function closeToasts(page) {
  await page.evaluate(() => {
    for (const close of document.querySelectorAll('li[data-slot="base"] button[aria-label="Close"]')) close.click()
  })
  await page.waitForFunction(() => document.querySelectorAll('li[data-slot="base"]').length === 0, { timeout: 5_000 })
}

/** Opens the collapsed list of confirmed rows no rule repeats. */
async function openCoverage(page) {
  const toggle = await page.waitForSelector('[data-testid="rule-coverage"] [data-testid="card-toggle"]')
  if ((await toggle.evaluate((element) => element.getAttribute('aria-expanded'))) === 'true') return
  await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await toggle.tap()
  await delay(300)
}

function reviewCount(page) {
  return page.evaluate(() => document.querySelectorAll('[data-testid="review-row"]').length)
}

/** A queue row's summary, scrolled to the middle and settled, so the tap meets it where it stands. */
async function reviewRow(page, counterparty) {
  const row = await waitForText(page, '[data-testid="review-row"] > button', counterparty)
  await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(300)
  return row
}

function cardCount(page) {
  return page.evaluate(() => document.querySelectorAll('[data-testid="transaction-card"]').length)
}

function hashOf(page) {
  return page.evaluate(() => window.location.hash)
}

function filterCount(page) {
  return page.evaluate(() => document.querySelector('[data-testid="filter-count"]')?.textContent?.trim() ?? null)
}

function totalOf(page) {
  return page.evaluate(() => document.querySelector('[data-testid="transaction-total"]')?.textContent?.trim() ?? '')
}

async function expect(valuePromise, holds, message) {
  const actual = await valuePromise
  if (!holds(actual)) throw new Error(`${message} (got ${JSON.stringify(actual)})`)
}

/** Every visible control at least 44 by 44 px, its label counted when the label toggles it too, and no sideways page scroll. */
async function inspect(page, scope) {
  const report = await page.evaluate((smallest) => {
    const controls = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [role="checkbox"], [role="combobox"], [role="tab"]'
    const tooSmall = []
    for (const element of document.querySelectorAll(controls)) {
      if (element.closest('[aria-hidden="true"], [inert]')) continue
      const style = getComputedStyle(element)
      if (style.visibility === 'hidden' || style.display === 'none') continue
      const box = element.getBoundingClientRect()
      if (box.width <= 1 || box.height <= 1) continue
      let { left, top, right, bottom } = box
      for (const label of element.labels ?? []) {
        const labelBox = label.getBoundingClientRect()
        left = Math.min(left, labelBox.left)
        top = Math.min(top, labelBox.top)
        right = Math.max(right, labelBox.right)
        bottom = Math.max(bottom, labelBox.bottom)
      }
      // A link in running text keeps the line height and reaches 44 px through an invisible margin, measured where a finger lands.
      if (element.dataset.hitArea === 'extended' && extendedHitHeight(element) >= smallest - 0.5 && right - left >= smallest - 0.5) continue
      if (right - left < smallest - 0.5 || bottom - top < smallest - 0.5) {
        const name = (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '').trim().slice(0, 30)
        tooSmall.push(`${element.tagName.toLowerCase()} "${name}" ${Math.round(right - left)}x${Math.round(bottom - top)}`)
      }
    }
    const root = document.documentElement
    return { tooSmall: [...new Set(tooSmall)], scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }

    /** How tall the strip is, through the middle of the link, where a tap reaches the link. The page scrolls back after. */
    function extendedHitHeight(element) {
      const scrolledTo = window.scrollY
      element.scrollIntoView({ block: 'center' })
      const box = element.getBoundingClientRect()
      const x = box.left + Math.min(box.width / 2, 8)
      const reaches = (y) => element.contains(document.elementFromPoint(x, y))
      let top = box.top + box.height / 2
      while (reaches(top - 1)) top -= 1
      let bottom = box.top + box.height / 2
      while (reaches(bottom + 1)) bottom += 1
      window.scrollTo(0, scrolledTo)
      return bottom - top + 1
    }
  }, SMALLEST_TARGET)
  if (report.tooSmall.length) throw new Error(`${report.tooSmall.length} control(s) under 44 px: ${report.tooSmall.slice(0, 6).join(', ')}`)
  if (report.scrollWidth > report.clientWidth + 1) throw new Error(`page scrolls sideways: ${report.scrollWidth} > ${report.clientWidth}`)
  return scope
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
