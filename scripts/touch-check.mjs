/**
 * Drives the fake-mode build with touch at the two phone widths, as a thumb would: the top app bar
 * and its navigation drawer, the review notice's drill, a chart's tap-then-drill, the filter sheet with a
 * filter added and removed,
 * grouped transactions that collapse and expand, a payee's category breakdown, the Excel import,
 * confirming and recategorising a row on Review with Undo, the session's changes with Undo from
 * there, the coverage list split into rows no rule settles and exceptions to a rule, a paid month on the Taxes calendar, the
 * doubled rates, a year's build-up and a payment on Assets, a line's build-up and its rows on Year end, a repayment on the Owner loan list, both kinds of the Add advance form, a rule made from a row and applied to
 * the rows still waiting, a rule edited and switched off on the Rules tab, the Ruleset search, a
 * watch list link that opens its rule, the local income tax rates searched and shown in full, and every screen. The
 * writes go to the fake workbook kept in this browser.
 * After each step it asserts that every visible control is at least 44 by 44 px and that nothing
 * scrolls the page sideways. No console errors and no request to another origin are allowed.
 *
 * Run against a preview of the fake build:
 *   npm run build:fake && npm run preview:fake -- --port 4173
 *   npm run check:touch -- http://localhost:4173/ledgerboard/
 *
 * Screenshots go to visual-check/touch/ (gitignored), or to TOUCH_OUTPUT_DIR.
 */

import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

import { chromePath } from './support/browsers.mjs'
import { writeFakeTemplateFile } from './support/fakeTemplateFile.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_DIR = process.env.TOUCH_OUTPUT_DIR ?? join(ROOT, 'visual-check', 'touch')
const BASE = process.argv[2] ?? 'http://localhost:4173/ledgerboard/'
const WIDTHS = [360, 430]
const SMALLEST_TARGET = 44

/** `ready` appears once the screen drew the fake workbook. `p=all` resets the filters the drills left behind. */
const SCREENS = [
  { hash: '#/trends?p=all', title: 'Trends', ready: '.chart-body canvas' },
  { hash: '#/spending?p=all', title: 'Spending', ready: '[data-testid="cost-line"]' },
  { hash: '#/period-review?p=all', title: 'Period review', ready: '.chart-body canvas' },
  { hash: '#/cash?p=all', title: 'Cash', ready: '.chart-body canvas' },
  { hash: '#/receivables?p=all', title: 'Receivables', ready: '[data-testid="invoice-list"]' },
  { hash: '#/taxes?p=all', title: 'Taxes', ready: '[data-testid="cadence-paid"]' },
  { hash: '#/assets?p=all', title: 'Assets', ready: '[data-testid="asset-register"]' },
  { hash: '#/year-end?year=2025&p=all', title: 'Year end', ready: '[data-testid="bridge-steps"]' },
  { hash: '#/owner?p=all', title: 'Owner', ready: '[data-testid="loan-list"]' },
  { hash: '#/ruleset', title: 'Ruleset', ready: '[data-testid="rule-card"]' },
  { hash: '#/review?p=all', title: 'Review', ready: '[data-testid="open-filters"]' },
  { hash: '#/workbook', title: 'Workbook', ready: '[data-testid="workbook-tabs"]' },
  { hash: '#/settings', title: 'Settings', ready: '[data-testid="data-source-card"]' },
]

mkdirSync(OUTPUT_DIR, { recursive: true })
for (const stale of readdirSync(OUTPUT_DIR).filter((file) => file.endsWith('.png') || file.endsWith('.xlsx'))) {
  rmSync(join(OUTPUT_DIR, stale))
}
const TEMPLATE_FILE = await writeFakeTemplateFile(join(OUTPUT_DIR, 'filled-template.xlsx'))

const failures = []
const browser = await launch({ executablePath: chromePath(), headless: true, args: ['--hide-scrollbars'] })

try {
  for (const width of WIDTHS) {
    await checkWidth(width)
  }
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}
console.log('\nall touch checks clean')

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
    await open(page, '#/', 'Overview')
    await settleCharts(page)
    await shoot('overview')
  })

  await step('top-bar', async () => {
    await expect(topBarTitle(page), (title) => title === 'Overview', 'the top bar does not name the screen')
    await expect(
      page.evaluate(() => {
        const bar = document.querySelector('header')
        const menu = bar?.querySelector('[data-testid="open-navigation"]')?.getBoundingClientRect()
        const sync = bar?.querySelector('[data-testid="sync-status"] button')?.getBoundingClientRect()
        const syncedAt = bar?.querySelector('[data-testid="sync-status"] time')?.textContent?.trim() ?? ''
        return { menuAtLeft: menu !== undefined && menu.left < 24, syncAtRight: sync !== undefined && sync.right > window.innerWidth - 24, syncedAt }
      }),
      (bar) => bar.menuAtLeft && bar.syncAtRight && bar.syncedAt !== '',
      'the top bar does not hold the menu at the left and Sync with its time at the right',
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

  await step('review-drill', async () => {
    await open(page, '#/', 'Overview')
    const reviewLink = await waitForText(page, '[data-testid="review-notice"] a', 'Review them')
    await reviewLink.tap()
    await waitForTitle(page, 'Transactions')
    await expect(hashOf(page), (hash) => hash.includes('review=1'), 'the drill did not carry the needs-review filter')
    await expect(filterCount(page), (count) => count === '1', 'the filter button does not count one active filter')
    await page.waitForSelector('[data-testid="transaction-card"]')
    await shoot('transactions-cards')
  })

  await step('filter-sheet', async () => {
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
    await open(page, '#/transactions?p=l12', 'Transactions')
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
    await open(page, '#/transactions?p=all', 'Transactions')
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
      window.location.hash = '#/transactions?p=l12'
    })
    await page.waitForFunction(() => window.location.hash.includes('p=l12'))
    await delay(300)
    await expect(groupState(page, firstCategory), (state) => state?.expanded === false, `"${firstCategory}" opened again when the period changed`)
    await page.tap('[data-testid="expand-all"]')
  })

  await step('payee-breakdown', async () => {
    await open(page, '#/spending?p=l12', 'Spending')
    const several = await page.waitForFunction(
      () => [...document.querySelectorAll('[data-testid="payee-categories"]')].find((trigger) => trigger.textContent?.includes('+')) ?? null,
      { timeout: 10_000 },
    )
    await several.asElement().evaluate((trigger) => trigger.scrollIntoView({ block: 'center' }))
    await several.asElement().tap()
    await page.waitForSelector('[data-testid="payee-breakdown"] a')
    await delay(300)
    await inspect(page, `${width}px payee breakdown open`)
    await shoot('payee-breakdown')
    const firstLine = await page.$('[data-testid="payee-breakdown"] a')
    await firstLine.tap()
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 2, 'the breakdown line did not narrow to its counterparty and category')
  })

  await step('chart-drill', async () => {
    await open(page, '#/', 'Overview')
    await settleCharts(page)
    await tapUntilDrillOffered(page)
    await expect(hashOf(page), (hash) => hash.startsWith('#/?') || hash === '#/', 'one tap left the screen')
    await page.waitForFunction(() => {
      const tooltip = document.querySelector('.chart-tooltip')
      return tooltip !== null && getComputedStyle(tooltip).display !== 'none' && getComputedStyle(tooltip).visibility !== 'hidden'
    })
    await shoot('chart-tooltip')
    const viewRows = await waitForText(page, '[data-testid="chart-drill"] button', 'View rows')
    await viewRows.tap()
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the chart drill opened Transactions without its filters')

    await open(page, '#/', 'Overview')
    await settleCharts(page)
    // The second tap on the same mark drills too, without "View rows".
    await tapChart(page, await tapUntilDrillOffered(page))
    await waitForTitle(page, 'Transactions')
  })

  await step('taxes-cadence-drill', async () => {
    await open(page, '#/taxes?p=all', 'Taxes')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="cadence-paid"]')
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-taxes.png`), fullPage: true })
    await page.tap('[data-testid="cadence-paid"]')
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the cadence cell opened Transactions without its filters')
  })

  await step('assets-doubled-and-drill', async () => {
    await open(page, '#/assets?p=all', 'Assets')
    await settleCharts(page)
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-assets.png`), fullPage: true })
    await page.tap('[role="switch"][data-testid="doubled-rates-switch"]')
    await page.waitForSelector('[data-testid="doubled-rates-changes"]')
    await expect(hashOf(page), (hash) => hash.includes('rates=doubled'), 'the switch did not put the doubled rates in the address')
    await inspect(page, `${width}px assets at doubled rates`)
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-assets-doubled.png`), fullPage: true })
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
    await open(page, '#/year-end?year=2025&p=all', 'Year end')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="comparison-pl"]')
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-year-end.png`), fullPage: true })
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

  await step('owner-loan-drill', async () => {
    await open(page, '#/owner?p=all', 'Owner')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="loan-list"]')
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-owner.png`), fullPage: true })
    await page.tap('[data-testid="loan-list"] ol a')
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the repayment opened Transactions without its filters')
  })

  await step('receivables-payment-drill', async () => {
    await open(page, '#/receivables?p=all', 'Receivables')
    await settleCharts(page)
    await page.waitForSelector('[data-testid="invoice-list"]')
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-receivables.png`), fullPage: true })
    await page.tap('[data-testid="invoice-list"] ol a')
    await waitForTitle(page, 'Transactions')
    await expect(filterCount(page), (count) => Number(count) >= 1, 'the payment opened Transactions without its filters')
  })

  await step('owner-advance-undo', async () => {
    await openFreshExcel(page, '#/owner?p=all', 'Owner')
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
    await (await waitForText(page, '[data-testid="advance-kind"] button', 'Part of a company payment was mine')).tap()
    await waitForText(page, '[data-testid="add-advance"] label', 'Private part')
    await inspect(page, `${width}px add advance form, private share`)
    await shoot('owner-add-private-share')
    await (await waitForText(page, '[data-testid="advance-kind"] button', 'I paid a company cost')).tap()
    await waitForText(page, '[data-testid="add-advance"] label', 'Amount')
    await inspect(page, `${width}px add advance form`)
    await shoot('owner-add-advance')
    await page.tap('button[form="add-advance"]')
    await waitForText(page, '[data-slot="title"]', 'Advance added')
    await expect(advances(), (count) => count === before + 1, 'the advance is not on the list')
    await delay(700)
    await (await waitForText(page, 'button', 'Undo')).tap()
    await waitForText(page, '[data-slot="title"]', 'Advance removed')
    await expect(advances(), (count) => count === before, 'Undo did not take the advance off the list')
  })

  for (const screen of SCREENS) {
    await step(screen.title.toLowerCase().replace(' ', '-'), async () => {
      await open(page, screen.hash, screen.title)
      await page.waitForSelector(screen.ready)
      await expect(topBarTitle(page), (title) => title === screen.title, 'the top bar does not name the screen')
      if (screen.title === 'Settings') await shoot('settings')
    })
  }

  await step('ruleset-deep-link', async () => {
    await open(page, '#/ruleset', 'Ruleset')
    await page.waitForSelector('[data-testid="rule-card"]')
    const ruleCards = () => page.evaluate(() => document.querySelectorAll('[data-testid="rule-card"]').length)
    const everyRule = await ruleCards()
    await page.tap('input[data-testid="ruleset-search"]')
    await page.keyboard.type('director floor')
    await expect(ruleCards(), (shown) => shown >= 1 && shown < everyRule, 'the search did not narrow the rules')
    await inspect(page, `${width}px ruleset search`)
    await shoot('ruleset-search')
    await page.tap('[data-testid="ruleset-bar"] button[aria-label="Clear the search"]')
    await expect(ruleCards(), (shown) => shown === everyRule, 'clearing the search did not bring every rule back')

    const link = await page.waitForSelector('[data-testid="watch-rule-link"]')
    const ruleId = await link.evaluate((element) => new URLSearchParams(element.getAttribute('href').split('?')[1]).get('rule'))
    await link.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await link.tap()
    await page.waitForFunction((wanted) => window.location.hash.includes(`rule=${wanted}`), { timeout: 5_000 }, ruleId)
    await page
      .waitForFunction(
        (wanted) => {
          const card = document.getElementById(`rule-${wanted}`)
          const bar = document.querySelector('[data-testid="ruleset-bar"]')
          if (card === null || bar === null || card.dataset.linked !== 'true' || document.activeElement !== card) return false
          const top = card.getBoundingClientRect().top
          return top >= bar.getBoundingClientRect().bottom - 1 && top < window.innerHeight / 2
        },
        { timeout: 5_000 },
        ruleId,
      )
      .catch(() => {
        throw new Error(`the watch list link did not bring ${ruleId} into view below the search bar, marked and focused`)
      })
    await shoot('ruleset-linked')
  })

  await step('ruleset-local-rates', async () => {
    await open(page, '#/ruleset?rule=hr.pit.local-rates', 'Ruleset')
    const card = '[id="rule-hr.pit.local-rates"]'
    const tableCount = () => page.$eval(`${card} [data-testid="table-count"]`, (element) => element.textContent.trim())
    const rowsShown = (text) => Number(text.split(' ')[0])
    await page.waitForSelector(`${card} [data-testid="table-count"]`)
    // The deep link scrolls to the card and focuses it a frame or two after the screen renders.
    await page.waitForFunction(() => document.activeElement?.id === 'rule-hr.pit.local-rates', { timeout: 5_000 })
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

  await step('settings-excel', async () => {
    await page.goto(`${BASE}?theme=dark&fake=excel#/settings`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Settings')
  })

  await step('workbook-tabs', async () => {
    await page.goto(`${BASE}?theme=dark&fake=excel#/workbook`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Workbook')
    await waitForText(page, 'button', 'Save settings')
    await shoot('workbook')
    for (const [label, query, ready] of [
      ['Categories', 'tab=categories', 'Save categories'],
      ['Accounts', 'tab=accounts', 'Save accounts'],
      ['Assets', 'tab=assets', 'Save assets'],
      ['Grants', 'tab=grants', 'Save grants'],
      ['Year end', 'tab=year-end', 'Save year-end lines'],
    ]) {
      const tab = await waitForText(page, '[role="tab"]', label)
      await tab.tap()
      await page.waitForFunction((wanted) => window.location.hash.includes(wanted), {}, query)
      await waitForText(page, 'button', ready)
      await inspect(page, `${width}px workbook ${label.toLowerCase()}`)
      if (label === 'Assets' || label === 'Year end') await shoot(`workbook-${query.slice(4)}`)
    }
    await shoot('workbook-accounts')
  })

  await step('review-confirm-undo', async () => {
    await openFreshExcel(page, '#/review', 'Review')
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
    await openFreshExcel(page, '#/review', 'Review')
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
    await openFreshExcel(page, '#/review', 'Review')
    await (await reviewRow(page, 'GADGET CORNER')).tap()
    await (await waitForText(page, '[data-testid="review-details"] button', 'Confirm')).tap()
    await waitForText(page, '[data-slot="title"]', 'Confirmed')
    await expect(reviewCount(page), (count) => count === 1, 'the confirmed row is still waiting')
    await expect(
      page.evaluate(() => document.querySelector('[data-testid="session-count"]')?.textContent?.trim() ?? null),
      (count) => count === '1',
      'the session panel does not count the write',
    )
    const toggle = await page.$('[data-testid="session-toggle"]')
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
    await openFreshExcel(page, '#/review', 'Review')
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
    await openFreshExcel(page, '#/review', 'Review')
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
    await waitForTitle(page, 'Workbook')
    await page.waitForSelector('[data-testid="rule-row"][aria-current="true"]')
    await expect(
      page.evaluate(() => document.querySelector('[data-testid="rule-row"][aria-current="true"]')?.textContent ?? ''),
      (text) => text.includes('merchant-laptop-store'),
      'Open the rule does not mark the rule on the Rules tab',
    )
    await delay(300)
    await inspect(page, `${width}px rule highlighted`)
    await shoot('rule-highlighted')
  })

  await step('rules-tab-edit', async () => {
    await openFreshExcel(page, '#/workbook?tab=rules', 'Workbook')
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

  await step('excel-import', async () => {
    await page.goto(`${BASE}?theme=dark&fake=empty#/`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Ledgerboard')
    await inspect(page, `${width}px welcome`)
    const input = await page.$('[data-testid="data-source-choices"] input[type="file"]')
    await input.uploadFile(TEMPLATE_FILE)
    await page.waitForSelector('[data-testid="import-summary"] dl')
    await delay(400)
    await inspect(page, `${width}px import summary`)
    await shoot('import-summary')
    const importButton = await waitForText(page, '[role="dialog"] button', 'Import')
    await importButton.tap()
    await waitForTitle(page, 'Overview')
    await waitForText(page, 'header [data-testid="local-status"] button', 'Export')
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
async function openFreshExcel(page, hash, title) {
  await page.goto(`${BASE}?theme=dark&fake=excel&load=${Date.now()}${hash}`, { waitUntil: 'networkidle0' })
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
      (css, wanted) => [...document.querySelectorAll(css)].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null,
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

/** Taps across the first chart until a mark answers with the drill offer, and returns where it hit, as fractions of the plot. */
async function tapUntilDrillOffered(page) {
  for (const row of [0.3, 0.45, 0.6, 0.2, 0.7]) {
    for (const column of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
      const spot = { row, column }
      await tapChart(page, spot)
      await delay(150)
      if (await page.$('[data-testid="chart-drill"]')) return spot
    }
  }
  throw new Error('no tap on the first chart offered "View rows"')
}

async function tapChart(page, { row, column }) {
  const canvas = await page.$('.chart-body canvas')
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
