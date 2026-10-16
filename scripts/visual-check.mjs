/**
 * Renders every screen of the fake-mode build in real Chrome at four widths, in the dark and the
 * light theme, and asserts what a screenshot cannot: no horizontal overflow, no console errors (CSP
 * violations included), no request to another origin, that each screen rendered its title, and
 * that it drew as many charts as it has from the fake workbook. Every chart on the gallery must
 * draw and every icon must come from the bundle.
 *
 * Beyond the screens of the fake Google workbook, it renders the first-run welcome screen
 * (`?fake=empty`), Settings for a workbook kept in this browser (`?fake=excel`), and the import
 * summary for an xlsx file it writes from the fake workbook with two problems added.
 *
 * Run against a preview of the fake build:
 *   npm run build:fake && npm run preview:fake -- --port 4173
 *   npm run check:visual -- http://localhost:4173/ledgerboard/
 *
 * Screenshots go to visual-check/ (gitignored), or to VISUAL_OUTPUT_DIR.
 */

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'
import * as XLSX from 'xlsx'

import { fakeWorkbookValues } from '../src/features/workbook/infrastructure/fake/fakeWorkbook.ts'
import { chromePath } from './support/browsers.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCREENSHOT_DIR = process.env.VISUAL_OUTPUT_DIR ?? join(ROOT, 'visual-check')
const BASE = process.argv[2] ?? 'http://localhost:4173/ledgerboard/'

const VIEWPORTS = [
  { name: 'phone', width: 360, height: 780 },
  { name: 'phone-large', width: 430, height: 932 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 900 },
]

/**
 * `charts` is how many charts the screen draws from the fake workbook. `shows` is text that only
 * appears once the fake workbook's rows reached the screen.
 */
const SCREENS = [
  { name: 'overview', hash: '#/', title: 'Overview', charts: 3, shows: 'A typical month' },
  { name: 'transactions', hash: '#/transactions', title: 'Transactions', charts: 0, shows: 'Northwind Analytics' },
  { name: 'trends', hash: '#/trends', title: 'Trends', charts: 3, shows: 'Cumulative net' },
  { name: 'spending', hash: '#/spending', title: 'Spending', charts: 1, shows: 'NORTHWIND' },
  { name: 'period-review', hash: '#/period-review', title: 'Period review', charts: 1, shows: 'Outside profit and loss' },
  { name: 'cash', hash: '#/cash', title: 'Cash', charts: 1, shows: 'legacy' },
  { name: 'review', hash: '#/review', title: 'Review', charts: 0, shows: 'GADGET CORNER' },
  { name: 'settings', hash: '#/settings', title: 'Settings', charts: 0, shows: 'Fake workbook' },
]

/** The gallery's chart cards that draw a chart. The loading card counts, the empty one does not. */
const GALLERY_CHARTS = 6

/** Screens outside the fake Google workbook. `query` picks the fake variant, `upload` drops the import file on the page. */
const SOURCE_SCREENS = [
  { name: 'welcome', query: 'fake=empty', hash: '#/', title: 'Ledgerboard', charts: 0, shows: 'Where is your ledger?' },
  { name: 'settings-excel', query: 'fake=excel', hash: '#/settings', title: 'Settings', charts: 0, shows: 'Save settings' },
  { name: 'import-summary', query: 'fake=empty', hash: '#/', title: 'Ledgerboard', charts: 0, shows: 'rows the app could not use', upload: true },
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
      chartHeights: [...document.querySelectorAll('.chart-body canvas')].map((canvas) => canvas.getBoundingClientRect().height),
      iconCount: document.querySelectorAll('svg.iconify').length,
      unrenderedIcons: [...document.querySelectorAll('.iconify')].filter((icon) => icon.tagName.toLowerCase() !== 'svg').length,
      themeClass: doc.classList.contains('light') ? 'light' : doc.classList.contains('dark') ? 'dark' : 'none',
      text: document.body.innerText,
    }
  })
}

mkdirSync(SCREENSHOT_DIR, { recursive: true })
// Screenshots of a screen that no longer exists would otherwise survive and mislead a review.
for (const stale of readdirSync(SCREENSHOT_DIR).filter((file) => file.endsWith('.png'))) {
  rmSync(join(SCREENSHOT_DIR, stale))
}

/** The fake workbook as an xlsx file, with a ledger row that has no amount and a setting the app does not know. */
function writeImportFile() {
  const values = fakeWorkbookValues('excel')
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

const browser = await launch({ executablePath: chromePath(), headless: true, args: ['--hide-scrollbars'] })

for (const viewport of VIEWPORTS) {
  for (const visit of VISITS) {
    const scope = `${viewport.name} ${visit.name}`
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    const errors = watchForErrors(page)
    const foreignRequests = watchForForeignRequests(page)

    await page.setViewport({ width: viewport.width, height: viewport.height })
    // Headless Chrome reports a light preference unless told otherwise. The pin makes the theme explicit.
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: visit.theme }])
    await page.goto(`${BASE}?theme=${visit.theme}${visit.query ? `&${visit.query}` : ''}${visit.hash}`, { waitUntil: 'networkidle0' })

    const drawsCharts = visit.gallery || visit.charts > 0
    const ready = drawsCharts ? '.chart-body canvas' : '[data-testid="screen-title"]'
    let rendered = await page
      .waitForSelector(ready, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    if (visit.upload && rendered) {
      const input = await page.$('[data-testid="data-source-choices"] input[type="file"]')
      await input?.uploadFile(IMPORT_FILE)
      rendered = await page
        .waitForSelector('[data-testid="import-summary"] dl', { timeout: 10_000 })
        .then(() => true)
        .catch(() => false)
      // The dialog fades in.
      await new Promise((resolve) => setTimeout(resolve, 600))
    }

    // ECharts animates bars in. The screenshot should show where they land.
    if (drawsCharts && rendered) await new Promise((resolve) => setTimeout(resolve, 1500))

    const report = await readPage(page)
    if (!rendered) fail(scope, `nothing matched ${ready} within 10 s`)
    if (report.title !== visit.title) fail(scope, `title was ${JSON.stringify(report.title)}, expected "${visit.title}"`)
    if (report.themeClass !== visit.theme) fail(scope, `rendered ${report.themeClass}, expected the ${visit.theme} theme`)
    if (visit.shows && !report.text.includes(visit.shows)) fail(scope, `"${visit.shows}" is missing, so the fake workbook did not reach the screen`)
    const expectedCharts = visit.gallery ? GALLERY_CHARTS : visit.charts
    if (report.chartHeights.length !== expectedCharts) fail(scope, `drew ${report.chartHeights.length} charts, expected ${expectedCharts}`)
    const collapsed = report.chartHeights.filter((height) => height < 100)
    if (collapsed.length) fail(scope, `${collapsed.length} chart(s) drew under 100px tall: ${collapsed.join(', ')}`)
    if (visit.gallery && report.iconCount < 10) fail(scope, `only ${report.iconCount} icons rendered as SVG`)
    if (report.unrenderedIcons) fail(scope, `${report.unrenderedIcons} icon(s) did not render`)
    if (report.scrollWidth > report.clientWidth + 1) {
      fail(scope, `horizontal overflow: scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}`)
      if (report.overflowing.length) fail(scope, `overflowing: ${report.overflowing.join(', ')}`)
    }
    if (errors.length) fail(scope, `console errors: ${errors.slice(0, 3).join(' | ')}`)
    if (foreignRequests.length) fail(scope, `requests to other origins: ${foreignRequests.slice(0, 3).join(' | ')}`)

    await page.screenshot({ path: join(SCREENSHOT_DIR, `${viewport.name}-${visit.file}.png`), fullPage: true })
    if (visit.gallery && viewport.name === 'desktop') {
      const firstChart = await page.$('[data-testid="chart-card"]')
      await firstChart?.screenshot({ path: join(SCREENSHOT_DIR, `${viewport.name}-${visit.file}-chart.png`) })
    }

    console.log(
      `${`${scope} ${visit.theme}`.padEnd(34)} ${String(viewport.width).padStart(4)}px  ` +
        `scroll=${report.scrollWidth} client=${report.clientWidth}  errors=${errors.length}  ` +
        `foreign=${foreignRequests.length}  icons=${report.iconCount}`,
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
