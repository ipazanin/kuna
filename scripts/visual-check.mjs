/**
 * Renders every screen of the fake-mode build in real Chrome at four widths and asserts what a
 * screenshot cannot: no horizontal overflow, no console errors (CSP violations included), and that
 * each screen rendered its title. Overview must also draw its chart from the fake workbook.
 *
 * Run against a preview of the fake build:
 *   npm run build:fake && npm run preview:fake -- --port 4173
 *   node scripts/visual-check.mjs http://localhost:4173/ledgerboard/
 *
 * Screenshots go to visual-check/ (gitignored), or to VISUAL_OUTPUT_DIR.
 */

import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCREENSHOT_DIR = process.env.VISUAL_OUTPUT_DIR ?? join(ROOT, 'visual-check')
const BASE = process.argv[2] ?? 'http://localhost:4173/ledgerboard/'

// puppeteer-core ships no browser, so the executable path must be explicit.
// Well-known install locations per platform. The first that exists wins.
const CHROME_CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
}

function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const found = (CHROME_CANDIDATES[process.platform] ?? []).find((path) => existsSync(path))
  if (found) return found
  console.error('Could not find Chrome. Set CHROME_PATH to your Chrome, Chromium or Edge executable and re-run.')
  process.exit(1)
}

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-large', width: 430, height: 932 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 900 },
]

const SCREENS = [
  { name: 'overview', hash: '#/', title: 'Overview', chart: true },
  { name: 'transactions', hash: '#/transactions', title: 'Transactions' },
  { name: 'trends', hash: '#/trends', title: 'Trends' },
  { name: 'spending', hash: '#/spending', title: 'Spending' },
  { name: 'period-review', hash: '#/period-review', title: 'Period review' },
  { name: 'cash', hash: '#/cash', title: 'Cash' },
  { name: 'obligations', hash: '#/obligations', title: 'Obligations' },
  { name: 'review', hash: '#/review', title: 'Review' },
  { name: 'settings', hash: '#/settings', title: 'Settings' },
]

const failures = []

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

function readPage(page) {
  return page.evaluate(() => {
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
      chartHeight: document.querySelector('[data-testid="placeholder-chart"] canvas')?.getBoundingClientRect().height ?? 0,
      text: document.body.innerText,
    }
  })
}

mkdirSync(SCREENSHOT_DIR, { recursive: true })

const browser = await launch({ executablePath: resolveChrome(), headless: true, args: ['--hide-scrollbars'] })

for (const viewport of VIEWPORTS) {
  for (const screen of SCREENS) {
    const scope = `${viewport.name} ${screen.name}`
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    const errors = watchForErrors(page)

    await page.setViewport({ width: viewport.width, height: viewport.height })
    // Dark is the designed default. Headless Chrome would otherwise report a light preference.
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }])
    await page.goto(`${BASE}${screen.hash}`, { waitUntil: 'networkidle0' })

    const ready = screen.chart ? '[data-testid="placeholder-chart"] canvas' : '[data-testid="screen-title"]'
    const rendered = await page
      .waitForSelector(ready, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    // ECharts animates bars in. The screenshot should show where they land.
    if (screen.chart && rendered) await new Promise((resolve) => setTimeout(resolve, 1500))

    const report = await readPage(page)
    if (!rendered) fail(scope, `nothing matched ${ready} within 10 s`)
    if (report.title !== screen.title) fail(scope, `title was ${JSON.stringify(report.title)}, expected "${screen.title}"`)
    if (screen.chart && !/Fake workbook/.test(report.text)) fail(scope, 'the fake workbook did not reach the cache')
    if (screen.chart && report.chartHeight < 100) fail(scope, `the chart drew ${report.chartHeight}px tall`)
    if (report.scrollWidth > report.clientWidth + 1) {
      fail(scope, `horizontal overflow: scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}`)
      if (report.overflowing.length) fail(scope, `overflowing: ${report.overflowing.join(', ')}`)
    }
    if (errors.length) fail(scope, `console errors: ${errors.slice(0, 3).join(' | ')}`)

    await page.screenshot({ path: join(SCREENSHOT_DIR, `${viewport.name}-${screen.name}.png`), fullPage: true })

    console.log(
      `${scope.padEnd(28)} ${String(viewport.width).padStart(4)}px  ` +
        `scroll=${report.scrollWidth} client=${report.clientWidth}  errors=${errors.length}`,
    )

    await context.close()
  }
}

await browser.close()

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}
console.log('\nall viewports clean')
