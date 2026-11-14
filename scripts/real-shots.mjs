/**
 * Screenshots of the screens a design review looks at, on the books the running dev server holds, usually `npm run dev:real`.
 * Each screen is shot whole at 360, 640, 1024 and 1440 px, in English and Croatian, light and dark. A screen that draws charts
 * also gets the frames of their first animation, and a screen given `--press` the frames of what the press opens, such as a
 * dialog or a toast, and the screen after it. The shots hold real books, so the folder is always a scratch folder outside the repo.
 *
 *   npm run shots:real -- http://localhost:4420/kuna/ --out /path/to/scratch --only home,net-worth,company
 *
 *   --out <folder>              where the shots go, as <screen>/<width>-<language>-<theme>.png, required
 *   --only <names>              the screens of SCREENS below to shoot, or a name ending in * for each that starts with the rest
 *   --widths 360,1440           only these of the four widths
 *   --route <name>=<hash>       one more screen, such as `--route rules=#/company/settings?tab=rules`. Without --only, only the routes
 *   --press <name>=<selector>   after the screen settles, clicks the element and shoots the frames of what opens
 *
 * --route and --press may each come more than once.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { launch } from 'puppeteer-core'

import { chromeLaunch } from './support/browsers.mjs'
import { runSelection } from './support/runSelection.mjs'
import { settleCharts } from './support/settleCharts.mjs'
import { screenshotWholePage } from './support/wholePage.mjs'

const WIDTHS = [
  { width: 360, height: 780 },
  { width: 640, height: 960 },
  { width: 1024, height: 1366 },
  { width: 1440, height: 900 },
]
const LANGUAGES = ['en', 'hr']
const THEMES = ['light', 'dark']

/** Net worth, All apps and every screen of each app's menu, with their settings. */
const SCREENS = [
  { name: 'home', hash: '#/' },
  { name: 'net-worth', hash: '#/overview' },
  { name: 'kuna-settings', hash: '#/settings' },
  { name: 'company', hash: '#/company' },
  { name: 'company-transactions', hash: '#/company/transactions' },
  { name: 'company-review', hash: '#/company/transactions?tab=review' },
  { name: 'company-analysis', hash: '#/company/analysis' },
  { name: 'company-invoicing', hash: '#/company/invoicing' },
  { name: 'company-year', hash: '#/company/year' },
  { name: 'company-salaries', hash: '#/company/salaries' },
  { name: 'company-owner', hash: '#/company/owner' },
  { name: 'company-trips', hash: '#/company/trips' },
  { name: 'company-settings', hash: '#/company/settings' },
  { name: 'loans', hash: '#/loans' },
  { name: 'loans-scenarios', hash: '#/loans/scenarios' },
  { name: 'loans-settings', hash: '#/loans/settings' },
  { name: 'investments', hash: '#/investments' },
  { name: 'investments-holdings', hash: '#/investments/holdings' },
  { name: 'investments-transactions', hash: '#/investments/transactions' },
  { name: 'investments-performance', hash: '#/investments/performance' },
  { name: 'investments-tax', hash: '#/investments/tax' },
  { name: 'investments-settings', hash: '#/investments/settings' },
  { name: 'assets', hash: '#/assets' },
  { name: 'assets-settings', hash: '#/assets/settings' },
  { name: 'spending', hash: '#/spending' },
  { name: 'spending-transactions', hash: '#/spending/transactions' },
  { name: 'spending-budgets', hash: '#/spending/budgets' },
  { name: 'spending-accounts', hash: '#/spending/accounts' },
  { name: 'spending-settings', hash: '#/spending/settings' },
]

const CHART_CANVASES = '.chart-body canvas, .donut-ring canvas'
const FRAMES = 8
const FRAME_GAP_MS = 100

/** Takes this script's own options out of the arguments and leaves the rest to runSelection. */
function ownOptions(args) {
  const rest = []
  const named = { out: null, routes: [], presses: new Map() }
  for (let index = 0; index < args.length; index++) {
    const option = args[index]
    if (option !== '--out' && option !== '--route' && option !== '--press') {
      rest.push(option)
      continue
    }
    const text = args[++index]
    if (text === undefined) usage(`${option} needs a value.`)
    if (option === '--out') {
      named.out = resolve(text)
      continue
    }
    const at = text.indexOf('=')
    if (at < 1) usage(`${option} takes <name>=<value>, not ${text}.`)
    if (option === '--route') named.routes.push({ name: text.slice(0, at), hash: text.slice(at + 1) })
    else named.presses.set(text.slice(0, at), text.slice(at + 1))
  }
  if (named.out === null) usage('--out names the scratch folder the shots go to.')
  return { named, rest }
}

function usage(problem) {
  console.error(`${problem} Run as: npm run shots:real -- <base> --out <folder> [--only names] [--widths 360,1440] [--route name=#/hash] [--press name=selector]`)
  process.exit(2)
}

const { named, rest } = ownOptions(process.argv.slice(2))
const selection = runSelection(
  WIDTHS.map((viewport) => viewport.width),
  rest,
)
// Routes alone, without --only, shoot only the routes.
const onlyRoutes = named.routes.length > 0 && !rest.some((option) => option.startsWith('--only'))
const screens = [...SCREENS.filter((screen) => selection.takes(screen.name) && !onlyRoutes), ...named.routes]
const unmatched = selection.unmatched()
if (unmatched !== null) usage(unmatched)
if (screens.length === 0) usage('Nothing to shoot.')
const unknownPresses = [...named.presses.keys()].filter((name) => !screens.some((screen) => screen.name === name))
if (unknownPresses.length > 0) usage(`--press named ${unknownPresses.join(', ')}, which this run does not shoot.`)

const visits = screens.flatMap((screen) =>
  WIDTHS.filter((viewport) => selection.takesWidth(viewport.width)).flatMap((viewport) =>
    LANGUAGES.flatMap((language) => THEMES.map((theme) => ({ screen, viewport, language, theme, stem: `${viewport.width}-${language}-${theme}` }))),
  ),
)

const pause = (ms) => new Promise((done) => setTimeout(done, ms))

/** Viewport shots a gap apart, so a reviewer can step through what moves. */
async function frames(page, folder, stem, kind) {
  for (let frame = 1; frame <= FRAMES; frame++) {
    await page.screenshot({ path: join(folder, `${stem}-${kind}-${String(frame).padStart(2, '0')}.png`) })
    await pause(FRAME_GAP_MS)
  }
}

async function settle(page) {
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 20_000 }).catch(() => undefined)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  if ((await page.$(CHART_CANVASES)) !== null) await settleCharts(page).catch(() => undefined)
  await pause(300)
}

async function shoot(browser, { screen, viewport, language, theme, stem }) {
  const folder = join(named.out, screen.name)
  mkdirSync(folder, { recursive: true })
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const errors = []
  page.on('console', (message) => {
    // A failed request names its address only in the message's location, without its query.
    if (message.type() === 'error') errors.push(`${message.text()} ${message.location().url?.split('?')[0] ?? ''}`.trim())
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  try {
    await page.setViewport(viewport)
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }])
    await page.goto(`${selection.base}?theme=${theme}&lang=${language}${screen.hash}`, { waitUntil: 'domcontentloaded' })
    const ready = await page
      .waitForSelector('[data-testid="screen-title"]', { timeout: 20_000 })
      .then(() => true)
      .catch(() => false)
    if (ready && (await page.waitForSelector(CHART_CANVASES, { timeout: 3_000 }).catch(() => null)) !== null) await frames(page, folder, stem, 'load')
    await settle(page)
    await screenshotWholePage(page, join(folder, `${stem}.png`))
    const press = named.presses.get(screen.name)
    if (press !== undefined) {
      const target = await page.$(press)
      if (target === null) errors.push(`--press found no ${press}`)
      else {
        await target.click()
        await frames(page, folder, stem, 'press')
        await settle(page)
        await screenshotWholePage(page, join(folder, `${stem}-pressed.png`))
      }
    }
    return { name: `${screen.name} ${stem}`, ready, errors }
  } finally {
    await context.close()
  }
}

mkdirSync(named.out, { recursive: true })
const browser = await launch(chromeLaunch(false))
const results = []
const queue = [...visits]
try {
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let visit = queue.shift(); visit !== undefined; visit = queue.shift()) results.push(await shoot(browser, visit))
    }),
  )
} finally {
  await browser.close()
}

const troubled = results.filter((result) => !result.ready || result.errors.length > 0)
const report = troubled.map((result) => `${result.name}: ${result.ready ? '' : 'no screen title within 20 s. '}${[...new Set(result.errors)].join(' | ')}`)
writeFileSync(join(named.out, 'problems.txt'), report.join('\n'))
console.log(
  `${results.length} shots of ${screens.length} screens in ${named.out}. ${troubled.length === 0 ? 'Every screen opened without a console error.' : `${troubled.length} had a problem, listed in problems.txt.`}`,
)
