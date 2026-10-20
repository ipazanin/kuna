/**
 * Renders every screen of the fake-mode build in real Chrome at eight widths, from 360 to 2560 px,
 * in the dark and the light theme at 360, 430 and 1440 and in one theme at the others. It asserts
 * what a screenshot cannot: no horizontal overflow, no card whose content is wider than the card
 * outside the editors allowed to scroll sideways, no console errors (CSP violations included), no
 * request to another origin, that each screen rendered its title, and that it drew as many charts as
 * it has from the fake workbook. Every chart on the gallery must draw and every icon must come from
 * the bundle. From 768 px, cards whose tops line up in a row must end at the same height. A deep
 * link to a rule on Ruleset must bring that rule to just below the search bar, marked and focused,
 * and keep it there once slow web fonts swap in. Deep links into a collapsed card must open it and
 * land on their row. At 360, 430 and 1440 px each screen collapses and expands one card.
 *
 * Beyond the screens of the fake Google workbook, it renders the first-run welcome screen
 * (`?fake=empty`), Settings and each Workbook tab for a workbook kept in this browser (`?fake=excel`), and the import
 * summary for an xlsx file it writes from the fake workbook with two problems added.
 *
 * At 360 and 1440 px, in both themes and both modes, it then adds, edits, deletes and undoes a
 * category, an asset and an invoice, and screenshots the editors and the invoice dialog on the way.
 * At 360, 430 and 1440 px it does the same with a pay scenario's component, copies a scenario, and
 * adds the starting scenarios to a workbook without any, which adds the tab to a Sheet without it.
 * It plans a category for 2027 on Forecast, edits, clears and undoes it, and plans a purchase in a
 * workbook without plan rows, which adds the plan tab to a Sheet without it.
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
import { collapseAndExpand } from './support/cardFlows.mjs'
import { assetFlow, categoryFlow, invoiceFlow, planFlow, planTabFlow, scenarioFlow, startingScenariosFlow } from './support/editorFlows.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCREENSHOT_DIR = process.env.VISUAL_OUTPUT_DIR ?? join(ROOT, 'visual-check')
const BASE = process.argv[2] ?? 'http://localhost:4173/ledgerboard/'

/**
 * Every screen renders at each width. A width with a `theme` renders in that theme only, since the
 * layout does not change with the theme. `cardFlow` collapses and expands a card on each screen.
 */
const VIEWPORTS = [
  { name: 'phone', width: 360, height: 780, cardFlow: true },
  { name: 'phone-large', width: 430, height: 932, cardFlow: true },
  { name: 'tablet', width: 768, height: 1024, alignedCards: true, theme: 'dark' },
  { name: 'tablet-wide', width: 1024, height: 1366, alignedCards: true, theme: 'light' },
  { name: 'laptop', width: 1280, height: 800, alignedCards: true, theme: 'dark' },
  { name: 'desktop', width: 1440, height: 900, alignedCards: true, cardFlow: true },
  { name: 'wide', width: 1920, height: 1080, alignedCards: true, theme: 'dark' },
  { name: 'wider', width: 2560, height: 1440, alignedCards: true, theme: 'light' },
]

/** A card is a raised surface. One nested inside another card is part of that card. */
const CARD_SELECTOR = '.rounded-card, .gallery-frame'

/**
 * `charts` is how many charts the screen draws from the fake workbook. `shows` is the text, or the
 * texts, that only appear once the fake workbook's rows reached the screen. `linkedRule` is the rule a deep link names.
 * `linkedPart` is the element a deep link's hash names, and `linkedRow` the row a deep link's query
 * marks, each inside a card that has to open for it. `linkedCard` is a card a link from another
 * screen points at, which has to open. `collapsedBefore` names the cards this device
 * remembers as collapsed. `cards: false` marks a screen with no collapsible card.
 */
const SCREENS = [
  { name: 'overview', hash: '#/', title: 'Overview', charts: 3, shows: 'A typical month', cards: false },
  { name: 'transactions', hash: '#/transactions', title: 'Transactions', charts: 0, shows: 'Northwind Analytics', cards: false },
  { name: 'trends', hash: '#/trends', title: 'Trends', charts: 3, shows: 'Cumulative net', cards: false },
  { name: 'spending', hash: '#/spending', title: 'Spending', charts: 0, shows: 'Northwind' },
  { name: 'period-review', hash: '#/period-review', title: 'Period review', charts: 1, shows: 'Revenue' },
  { name: 'cash', hash: '#/cash', title: 'Cash', charts: 1, shows: 'Legacy', cards: false },
  { name: 'receivables', hash: '#/receivables', title: 'Receivables', charts: 1, shows: 'Every invoice' },
  { name: 'billing', hash: '#/billing', title: 'Billing plan', charts: 1, shows: ['Month by month, 2026', 'Totals over every client'] },
  {
    name: 'billing-month',
    hash: '#/billing?year=2026&month=2026-10#billing-month-2026-10',
    title: 'Billing plan',
    charts: 1,
    shows: "of the month's rows is not invoiced yet",
    linkedPart: 'billing-month-2026-10',
  },
  { name: 'billing-2025', hash: '#/billing?year=2025', title: 'Billing plan', charts: 1, shows: 'Month by month, 2025' },
  { name: 'taxes', hash: '#/taxes', title: 'Taxes', charts: 1, shows: 'Payroll cadence' },
  { name: 'assets', hash: '#/assets', title: 'Assets', charts: 1, shows: 'Workstation' },
  { name: 'assets-doubled', hash: '#/assets?rates=doubled', title: 'Assets', charts: 1, shows: 'What doubled rates would change' },
  { name: 'year-end', hash: '#/year-end?year=2025', title: 'Year end', charts: 1, shows: 'From the cash net to profit, 2025' },
  { name: 'forecast', hash: '#/forecast', title: 'Forecast', charts: 0, shows: ['The forecast needs the day the company was registered', 'Plan for 2026'] },
  { name: 'pay-scenarios', hash: '#/pay-scenarios', title: 'Pay scenarios', charts: 0, shows: 'The figures need hr_company_registered' },
  { name: 'owner', hash: '#/owner', title: 'Owner', charts: 2, shows: ['Costs the owner paid privately', 'Reimbursed with no cost on file'] },
  { name: 'ruleset', hash: '#/ruleset', title: 'Ruleset', charts: 0, shows: 'Watch list' },
  {
    name: 'ruleset-linked',
    hash: '#/ruleset?rule=hr.contrib.director-floor',
    title: 'Ruleset',
    charts: 0,
    shows: 'hr.contrib.director-floor',
    linkedRule: 'hr.contrib.director-floor',
  },
  { name: 'review', hash: '#/review', title: 'Review', charts: 0, shows: ['GADGET CORNER', 'Refund of a parking fee'] },
  { name: 'workbook', hash: '#/workbook', title: 'Workbook', charts: 0, shows: 'Bucket labels' },
  {
    name: 'workbook-categories',
    hash: '#/workbook?tab=categories',
    title: 'Workbook',
    charts: 0,
    shows: "The ledger's category dropdown in the Sheet lists",
    collapsedBefore: ['workbook.categories'],
    linkedCard: 'workbook.categories',
  },
  {
    name: 'workbook-rule-linked',
    hash: '#/workbook?tab=rules&rule=merchant-airline',
    title: 'Workbook',
    charts: 0,
    shows: 'merchant-airline',
    collapsedBefore: ['workbook.rules'],
    linkedRow: '[data-testid="rule-row"][aria-current="true"]',
  },
  { name: 'workbook-clients', hash: '#/workbook?tab=clients', title: 'Workbook', charts: 0, shows: 'Add client row' },
  { name: 'workbook-assets', hash: '#/workbook?tab=assets', title: 'Workbook', charts: 0, shows: 'Save assets' },
  { name: 'settings', hash: '#/settings', title: 'Settings', charts: 0, shows: 'Fake workbook', cards: false },
]

/** The gallery's chart cards that draw a chart. The loading card counts, the empty one does not. */
const GALLERY_CHARTS = 6

/** Screens outside the fake Google workbook. `query` picks the fake variant, `upload` drops the import file on the page. */
const SOURCE_SCREENS = [
  { name: 'welcome', query: 'fake=empty', hash: '#/', title: 'Ledgerboard', charts: 0, shows: 'Where is your ledger?', cards: false },
  { name: 'settings-excel', query: 'fake=excel', hash: '#/settings', title: 'Settings', charts: 0, shows: 'Import a file', cards: false },
  { name: 'workbook-excel', query: 'fake=excel', hash: '#/workbook', title: 'Workbook', charts: 0, shows: 'Save settings' },
  { name: 'workbook-categories-excel', query: 'fake=excel', hash: '#/workbook?tab=categories', title: 'Workbook', charts: 0, shows: 'Save categories' },
  { name: 'workbook-accounts-excel', query: 'fake=excel', hash: '#/workbook?tab=accounts', title: 'Workbook', charts: 0, shows: 'Save accounts' },
  { name: 'workbook-clients-excel', query: 'fake=excel', hash: '#/workbook?tab=clients', title: 'Workbook', charts: 0, shows: 'Save clients' },
  { name: 'workbook-assets-excel', query: 'fake=excel', hash: '#/workbook?tab=assets', title: 'Workbook', charts: 0, shows: 'Save assets' },
  { name: 'workbook-grants-excel', query: 'fake=excel', hash: '#/workbook?tab=grants', title: 'Workbook', charts: 0, shows: 'Save grants' },
  { name: 'workbook-year-end-excel', query: 'fake=excel', hash: '#/workbook?tab=year-end', title: 'Workbook', charts: 0, shows: 'Save year-end lines' },
  { name: 'year-end-excel', query: 'fake=excel', hash: '#/year-end?year=2025', title: 'Year end', charts: 1, shows: 'Balance paid on' },
  { name: 'forecast-excel', query: 'fake=excel', hash: '#/forecast?year=2026', title: 'Forecast', charts: 1, shows: 'Corporate tax payments, expected against paid' },
  { name: 'forecast-2027-excel', query: 'fake=excel', hash: '#/forecast?year=2027&payout=interim', title: 'Forecast', charts: 1, shows: 'An interim payout in 2027' },
  { name: 'pay-scenarios-excel', query: 'fake=excel', hash: '#/pay-scenarios?year=2027', title: 'Pay scenarios', charts: 1, shows: 'Side by side' },
  { name: 'pay-scenarios-2026-excel', query: 'fake=excel', hash: '#/pay-scenarios?year=2026', title: 'Pay scenarios', charts: 0, shows: 'No scenario for 2026 to compare yet' },
  { name: 'pay-scenarios-no-tab', query: 'fake=no-scenarios', hash: '#/pay-scenarios', title: 'Pay scenarios', charts: 0, shows: 'No scenario is for 2027 yet' },
  { name: 'taxes-excel', query: 'fake=excel', hash: '#/taxes', title: 'Taxes', charts: 1, shows: 'For 2026' },
  { name: 'billing-excel', query: 'fake=excel', hash: '#/billing', title: 'Billing plan', charts: 1, shows: 'Terms on Workbook, General' },
  { name: 'billing-no-tab', query: 'fake=no-billing-plan', hash: '#/billing', title: 'Billing plan', charts: 0, shows: 'The Sheet has no outgoing-plan tab yet', cards: false },
  { name: 'billing-empty-excel', query: 'fake=excel-no-billing-plan', hash: '#/billing', title: 'Billing plan', charts: 0, shows: 'Add the first row', cards: false },
  { name: 'import-summary', query: 'fake=empty', hash: '#/', title: 'Ledgerboard', charts: 0, shows: 'rows the app could not use', upload: true, cards: false },
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

/**
 * The only cards that may scroll sideways: editors whose every column is an input, on a phone. Each
 * names its card, the widest viewport it may scroll at, and why.
 */
const SIDEWAYS_SCROLL_ALLOWED = [
  {
    card: 'workbook.categories',
    upTo: Infinity,
    reason: 'Seven input columns at their narrowest are wider than the 100rem measure the Workbook screen keeps.',
  },
  { card: 'workbook.accounts', upTo: 1024, reason: 'Every column is an input, and they fit beside each other only from 1280 px.' },
  { card: 'workbook.clients', upTo: 1024, reason: 'Every column is an input, and they fit beside each other only from 1280 px.' },
  { card: 'workbook.assets', upTo: Infinity, reason: 'Ten input columns are wider than the 100rem measure the Workbook screen keeps.' },
  { card: 'workbook.grants', upTo: Infinity, reason: 'Twelve input columns are wider than the 100rem measure the Workbook screen keeps.' },
  { card: 'workbook.year-end', upTo: Infinity, reason: 'Nine input columns are wider than the 100rem measure the Workbook screen keeps.' },
]

const failures = []
/** Every card found wider than its content, allowed or not, listed at the end. */
const overflowSeen = []

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
  return page.evaluate((cardSelector) => {
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
      raggedRows: raggedCardRows(cardSelector),
      cardOverflow: overflowingCards(cardSelector),
    }

    /**
     * Cards whose content is wider than the card: the card or a box in it that scrolls or clips
     * sideways, or a box that reaches past the card's edges. A line of text cut short with an
     * ellipsis is meant to clip, and a box inside one that scrolls is counted with it.
     */
    function overflowingCards(selector) {
      const clips = (style) => style.overflowX !== 'visible'
      const found = []
      for (const card of document.querySelectorAll(selector)) {
        if (card.parentElement?.closest(selector) || card.getClientRects().length === 0) continue
        const edge = card.getBoundingClientRect()
        let widest = null
        for (const element of [card, ...card.querySelectorAll('*')]) {
          if (element.getClientRects().length === 0) continue
          const style = getComputedStyle(element)
          if (style.position === 'fixed' || style.textOverflow === 'ellipsis') continue
          let content = 0
          if (element instanceof HTMLElement && element.clientWidth > 1 && clips(style) && element.scrollWidth > element.clientWidth + 1) {
            content = element.scrollWidth - element.clientWidth + edge.width
          } else if (element !== card) {
            const box = element.getBoundingClientRect()
            let inside = element.parentElement
            while (inside !== null && inside !== card && !clips(getComputedStyle(inside))) inside = inside.parentElement
            if (inside === card && box.width > 1 && (box.right > edge.right + 1 || box.left < edge.left - 1)) {
              content = Math.max(box.right, edge.right) - Math.min(box.left, edge.left)
            }
          }
          if (content > (widest?.content ?? 0)) widest = { content, element }
        }
        if (widest !== null) {
          found.push({
            card: card.dataset.card ?? null,
            title: (card.querySelector('h2, h3')?.textContent ?? card.getAttribute('aria-label') ?? card.dataset.testid ?? '').trim().replace(/\s+/g, ' ').slice(0, 48),
            width: Math.round(edge.width),
            content: Math.round(widest.content),
            by: `${widest.element.tagName.toLowerCase()}${widest.element.classList.length ? `.${[...widest.element.classList].slice(0, 2).join('.')}` : ''}`,
          })
        }
      }
      return found
    }

    /**
     * Pairs of side-by-side cards whose tops line up but whose bottoms are more than 1 px apart. A card
     * with a sibling card stacked right under it, beside one without, heads a column of cards beside a
     * single long card, so its bottom is not meant to line up.
     */
    function raggedCardRows(selector) {
      const cards = [...document.querySelectorAll(selector)]
        .filter((card) => !card.parentElement?.closest(selector) && card.getClientRects().length > 0)
        .map((card) => ({ card, box: card.getBoundingClientRect() }))
      const label = (card) => (card.querySelector('h2, h3, p, dt, span')?.textContent ?? card.textContent ?? '').trim().slice(0, 32)
      const headsColumn = ({ card, box }) =>
        cards.some(
          (other) =>
            other.card.parentElement === card.parentElement &&
            Math.abs(other.box.left - box.left) <= 1 &&
            Math.abs(other.box.right - box.right) <= 1 &&
            other.box.top >= box.bottom - 1 &&
            other.box.top - box.bottom <= 32,
        )
      const ragged = []
      for (const [index, left] of cards.entries()) {
        for (const right of cards.slice(index + 1)) {
          const sideBySide = left.box.right <= right.box.left + 1 || right.box.right <= left.box.left + 1
          if (!sideBySide || Math.abs(left.box.top - right.box.top) > 1) continue
          if (headsColumn(left) !== headsColumn(right)) continue
          const gap = Math.abs(left.box.bottom - right.box.bottom)
          if (gap > 1) ragged.push(`"${label(left.card)}" and "${label(right.card)}" end ${Math.round(gap)} px apart`)
        }
      }
      return ragged
    }
  }, CARD_SELECTOR)
}

/** Runs in the page: the linked part sits just below the top, or in view at the foot of a page too short to scroll it higher, in a card that is open. */
function linkedPartLanded(id) {
  const part = document.getElementById(id)
  const card = part?.closest('[data-card]')
  if (part === null || card?.dataset.collapsed !== 'false') return false
  const top = part.getBoundingClientRect().top
  const atFoot = window.scrollY >= document.documentElement.scrollHeight - window.innerHeight - 1
  return (top >= 56 && top <= 96) || (atFoot && top > 0 && top < window.innerHeight)
}

/** Runs in the page: the linked row is in an open card and inside the window. */
function linkedRowShown(selector) {
  const row = document.querySelector(selector)
  if (row === null || row.closest('[data-card]')?.dataset.collapsed !== 'false') return false
  const box = row.getBoundingClientRect()
  return box.height > 0 && box.top >= 0 && box.bottom <= window.innerHeight
}

/** Runs in the page: the linked rule card is marked, has focus, and starts just below the sticky search bar. */
function linkedRuleInView(ruleId) {
  const card = document.getElementById(`rule-${ruleId}`)
  const bar = document.querySelector('[data-testid="ruleset-bar"]')
  if (card === null || bar === null || card.dataset.linked !== 'true' || document.activeElement !== card) return false
  const below = card.getBoundingClientRect().top - bar.getBoundingClientRect().bottom
  return below >= -1 && below <= 24
}

/** Holds back every web font, as a slow runner does, so text reflows after the screen's first frames. */
async function slowWebFonts(page) {
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (request.url().endsWith('.woff2')) setTimeout(() => request.continue(), 400)
    else request.continue()
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
    if (viewport.theme && visit.theme !== viewport.theme) continue
    const scope = `${viewport.name} ${visit.name}`
    const context = await browser.createBrowserContext()
    const page = await context.newPage()
    const errors = watchForErrors(page)
    const foreignRequests = watchForForeignRequests(page)

    if (visit.linkedRule) await slowWebFonts(page)
    if (visit.collapsedBefore) {
      await page.evaluateOnNewDocument((cards) => {
        for (const card of cards) localStorage.setItem(`ledgerboard.card.${card}`, 'collapsed')
      }, visit.collapsedBefore)
    }
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

    if (visit.linkedRule && rendered) {
      await page.evaluate(() => document.fonts.ready.then(() => undefined))
      const shown = await page
        .waitForFunction(linkedRuleInView, { timeout: 5_000 }, visit.linkedRule)
        .then(() => true)
        .catch(() => false)
      if (!shown) fail(scope, `the deep link did not bring ${visit.linkedRule} to just below the search bar, marked and focused, once the fonts loaded`)
    }

    // ECharts animates bars in. The screenshot should show where they land.
    if (drawsCharts && rendered) await new Promise((resolve) => setTimeout(resolve, 1500))

    if (visit.linkedPart && rendered) {
      const landed = await page.evaluate(linkedPartLanded, visit.linkedPart)
      if (!landed) fail(scope, `the deep link to #${visit.linkedPart} did not open its card and bring the part to just below the top`)
    }
    if (visit.linkedCard && rendered) {
      const opened = await page.evaluate((card) => document.querySelector(`[data-card="${card}"]`)?.getAttribute('data-collapsed') === 'false', visit.linkedCard)
      if (!opened) fail(scope, `the link to the tab did not open ${visit.linkedCard}, which this device keeps collapsed`)
    }
    if (visit.linkedRow && rendered) {
      const shown = await page
        .waitForFunction(linkedRowShown, { timeout: 5_000 }, visit.linkedRow)
        .then(() => true)
        .catch(() => false)
      if (!shown) fail(scope, `the deep link did not open the collapsed card and bring ${visit.linkedRow} into view`)
    }

    const report = await readPage(page)
    if (!rendered) fail(scope, `nothing matched ${ready} within 10 s`)
    if (report.title !== visit.title) fail(scope, `title was ${JSON.stringify(report.title)}, expected "${visit.title}"`)
    if (report.themeClass !== visit.theme) fail(scope, `rendered ${report.themeClass}, expected the ${visit.theme} theme`)
    for (const text of [visit.shows ?? []].flat()) {
      if (!report.text.includes(text)) fail(scope, `"${text}" is missing, so the fake workbook did not reach the screen`)
    }
    const expectedCharts = visit.gallery ? GALLERY_CHARTS : visit.charts
    if (report.chartHeights.length !== expectedCharts) fail(scope, `drew ${report.chartHeights.length} charts, expected ${expectedCharts}`)
    const collapsed = report.chartHeights.filter((height) => height < 100)
    if (collapsed.length) fail(scope, `${collapsed.length} chart(s) drew under 100px tall: ${collapsed.join(', ')}`)
    if (visit.gallery && report.iconCount < 10) fail(scope, `only ${report.iconCount} icons rendered as SVG`)
    if (viewport.alignedCards) for (const row of report.raggedRows) fail(scope, `ragged card row: ${row}`)
    for (const wide of report.cardOverflow) {
      const allowed = SIDEWAYS_SCROLL_ALLOWED.find((entry) => entry.card === wide.card && viewport.width <= entry.upTo)
      overflowSeen.push({ viewport: viewport.width, screen: visit.name, theme: visit.theme, ...wide, allowed: allowed !== undefined })
      if (!allowed) fail(scope, `"${wide.title}" is ${wide.content} px wide inside a ${wide.width} px card, by ${wide.by}`)
    }
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

    if (viewport.cardFlow && rendered) {
      const collapsible = (await page.$('[data-card]')) !== null
      if (visit.cards === false) {
        if (collapsible) fail(scope, 'has a collapsible card, so it should not say cards: false')
      } else if (!collapsible) {
        fail(scope, 'has no collapsible card. Say cards: false if none of its cards holds a long list or table')
      } else {
        await collapseAndExpand(
          page,
          (handle) => handle.click(),
          (card) => card.screenshot({ path: join(SCREENSHOT_DIR, `${viewport.name}-${visit.file}-collapsed.png`) }),
        ).catch((error) => fail(scope, error.message))
        const after = await readPage(page)
        if (after.scrollWidth > after.clientWidth + 1) fail(scope, `horizontal overflow after collapsing a card: scrollWidth ${after.scrollWidth}`)
      }
    }

    console.log(
      `${`${scope} ${visit.theme}`.padEnd(34)} ${String(viewport.width).padStart(4)}px  ` +
        `scroll=${report.scrollWidth} client=${report.clientWidth}  errors=${errors.length}  ` +
        `foreign=${foreignRequests.length}  icons=${report.iconCount}`,
    )

    await context.close()
  }
}

/** The editors' flows, each on a fresh load, so the fake Sheet and the workbook kept in this browser start from their seed. */
const FLOWS = [
  { name: 'categories', hash: '#/workbook?tab=categories', title: 'Workbook', run: categoryFlow },
  { name: 'assets', hash: '#/workbook?tab=assets', title: 'Workbook', run: assetFlow },
  { name: 'invoices', hash: '#/receivables?p=all', title: 'Receivables', run: invoiceFlow },
  { name: 'scenarios', hash: '#/pay-scenarios?year=2027', title: 'Pay scenarios', run: scenarioFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  {
    name: 'starting-scenarios',
    hash: '#/pay-scenarios?year=2027',
    title: 'Pay scenarios',
    run: startingScenariosFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    queries: { google: '&fake=no-scenarios', excel: '&fake=excel-no-scenarios' },
  },
  { name: 'plan', hash: '#/forecast?year=2027', title: 'Forecast', run: planFlow, viewports: ['phone', 'phone-large', 'desktop'] },
  {
    name: 'plan-tab',
    hash: '#/forecast?year=2027',
    title: 'Forecast',
    run: planTabFlow,
    viewports: ['phone', 'phone-large', 'desktop'],
    queries: { google: '&fake=no-plan', excel: '&fake=excel-no-plan' },
  },
]
const MODES = [
  { name: 'google', query: '' },
  { name: 'excel', query: '&fake=excel' },
]

for (const viewport of VIEWPORTS.filter((candidate) => ['phone', 'phone-large', 'desktop'].includes(candidate.name))) {
  for (const mode of MODES) {
    for (const theme of THEMES) {
      for (const flow of FLOWS.filter((candidate) => (candidate.viewports ?? ['phone', 'desktop']).includes(viewport.name))) {
        const scope = `${viewport.name} ${mode.name} ${flow.name} ${theme}`
        const context = await browser.createBrowserContext()
        const page = await context.newPage()
        const errors = watchForErrors(page)
        const foreignRequests = watchForForeignRequests(page)
        await page.setViewport({ width: viewport.width, height: viewport.height })
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }])
        const file = (name) => join(SCREENSHOT_DIR, `${viewport.name}-${mode.name}-${name}-${theme}.png`)
        const overflowCheck = async (when) => {
          const report = await readPage(page)
          if (report.scrollWidth > report.clientWidth + 1) fail(scope, `${when}: horizontal overflow, scrollWidth ${report.scrollWidth} > clientWidth ${report.clientWidth}`)
        }
        try {
          await page.goto(`${BASE}?theme=${theme}${flow.queries?.[mode.name] ?? mode.query}${flow.hash}`, { waitUntil: 'networkidle0' })
          await page.waitForFunction((title) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === title, { timeout: 10_000 }, flow.title)
          await flow.run(page, {
            press: (handle) => handle.click(),
            shoot: async (name) => {
              await overflowCheck(name)
              await page.screenshot({ path: file(name) })
            },
            inspect: overflowCheck,
          })
          await overflowCheck('after the flow')
        } catch (error) {
          fail(scope, error.message)
          await page.screenshot({ path: file(`${flow.name}-failed`) }).catch(() => {})
        }
        if (errors.length) fail(scope, `console errors: ${errors.slice(0, 3).join(' | ')}`)
        if (foreignRequests.length) fail(scope, `requests to other origins: ${foreignRequests.slice(0, 3).join(' | ')}`)
        console.log(`${scope.padEnd(44)} ${String(viewport.width).padStart(4)}px  errors=${errors.length}  foreign=${foreignRequests.length}`)
        await context.close()
      }
    }
  }
}

await browser.close()

if (overflowSeen.length) {
  console.log('\ncards wider than their content:')
  for (const seen of overflowSeen) {
    console.log(`  ${String(seen.viewport).padStart(4)}px ${seen.screen} ${seen.theme}: "${seen.title}" ${seen.content} in ${seen.width} px, by ${seen.by}${seen.allowed ? ' (allowed)' : ''}`)
  }
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}
console.log('\nall viewports clean')
