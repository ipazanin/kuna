/**
 * Drives the fake-mode build with touch at the two phone widths, as a thumb would: the menu, a
 * KPI tile's drill, a chart's tap-then-drill, the filter sheet, the Excel import, and every screen.
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
  { hash: '#/spending?p=all', title: 'Spending', ready: '.chart-body canvas' },
  { hash: '#/period-review?p=all', title: 'Period review', ready: '.chart-body canvas' },
  { hash: '#/cash?p=all', title: 'Cash', ready: '.chart-body canvas' },
  { hash: '#/review?p=all', title: 'Review', ready: '[data-testid="open-filters"]' },
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

  await step('menu', async () => {
    await page.tap('[data-testid="open-navigation"]')
    const link = await waitForText(page, '[role="dialog"] a', 'Transactions')
    await delay(300)
    await inspect(page, `${width}px menu open`)
    await shoot('menu')
    await link.tap()
    await waitForTitle(page, 'Transactions')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
  })

  await step('kpi-drill', async () => {
    await open(page, '#/', 'Overview')
    const tile = await waitForText(page, 'a.kpi-link', 'Needs review')
    await tile.tap()
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
    const clearAll = await waitForText(page, '[role="dialog"] button', 'Clear all')
    await clearAll.tap()
    await page.waitForFunction(() => !window.location.hash.includes('review=1'))
    await page.waitForFunction(() => !document.querySelector('[role="dialog"] [aria-label="Active filters"]'))
    const done = await waitForText(page, '[role="dialog"] button', 'Show results')
    await done.tap()
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'))
    await expect(filterCount(page), (count) => count === null, 'the filter button still counts a filter after Clear all')
    await expect(totalOf(page), (after) => after !== before, 'the total did not change with the period and the chips')
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

  for (const screen of SCREENS) {
    await step(screen.title.toLowerCase().replace(' ', '-'), async () => {
      await open(page, screen.hash, screen.title)
      await page.waitForSelector(screen.ready)
      if (screen.title === 'Settings') await shoot('settings')
    })
  }

  await step('settings-excel', async () => {
    await page.goto(`${BASE}?theme=dark&fake=excel#/settings`, { waitUntil: 'networkidle0' })
    await waitForTitle(page, 'Settings')
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
    await waitForText(page, '[data-testid="local-status"] button', 'Export')
  })

  if (errors.length) failures.push(`[${width}px] console errors: ${errors.slice(0, 3).join(' | ')}`)
  if (foreign.length) failures.push(`[${width}px] requests to other origins: ${foreign.slice(0, 3).join(' | ')}`)
  await context.close()
}

async function open(page, hash, title) {
  await page.goto(`${BASE}?theme=dark${hash}`, { waitUntil: 'networkidle0' })
  await waitForTitle(page, title)
}

async function waitForTitle(page, title) {
  await page.waitForFunction(
    (expected) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === expected,
    { timeout: 10_000 },
    title,
  )
}

async function waitForText(page, selector, text) {
  const handle = await page.waitForFunction(
    (css, wanted) => [...document.querySelectorAll(css)].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null,
    { timeout: 10_000 },
    selector,
    text,
  )
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
      if (right - left < smallest - 0.5 || bottom - top < smallest - 0.5) {
        const name = (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '').trim().slice(0, 30)
        tooSmall.push(`${element.tagName.toLowerCase()} "${name}" ${Math.round(right - left)}x${Math.round(bottom - top)}`)
      }
    }
    const root = document.documentElement
    return { tooSmall: [...new Set(tooSmall)], scrollWidth: root.scrollWidth, clientWidth: root.clientWidth }
  }, SMALLEST_TARGET)
  if (report.tooSmall.length) throw new Error(`${report.tooSmall.length} control(s) under 44 px: ${report.tooSmall.slice(0, 6).join(', ')}`)
  if (report.scrollWidth > report.clientWidth + 1) throw new Error(`page scrolls sideways: ${report.scrollWidth} > ${report.clientWidth}`)
  return scope
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
