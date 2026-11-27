import { en as homeEnglish, hr as homeCroatian } from '../../src/apps/investments/home/presentation/words.ts'
import { en as holdingsEnglish, hr as holdingsCroatian } from '../../src/apps/investments/holdings/presentation/words.ts'
import { en as overviewEnglish, hr as overviewCroatian } from '../../src/apps/investments/overview/presentation/words.ts'
import { en as pricesEnglish, hr as pricesCroatian } from '../../src/apps/investments/prices/presentation/words.ts'

const VISIBLE = { visible: true, timeout: 10_000 }
/** A made-up Twelve Data key, which the fake vendor takes like any other. */
const MADE_UP_KEY = 'made-up-twelve-data-key-0042'

/**
 * The instant each run pins the page clock to, so the live path is checked whatever day CI runs on. A weekday at 16:40 in
 * Zagreb has the US shares live while the European closes are not yet in. At 18:30 the European closes are in too. A
 * Saturday quote is Friday's close.
 */
export const WEEKDAY_CLOCK = { name: 'live', instant: '2026-11-18T15:40:00Z', weekend: false }
export const EVENING_CLOCK = { name: 'evening', instant: '2026-11-18T17:30:00Z', weekend: false, closedHoldings: ['Example World ETF', 'Example Money Fund'], alphaVantageKey: 'MADEUPKEY01' }
export const SATURDAY_CLOCK = { name: 'weekend', instant: '2026-11-21T11:00:00Z', weekend: true }

/** Makes every document the page loads from now on start at the clock's instant and run on from there. */
async function pinClock(page, clock) {
  await page.evaluateOnNewDocument((instant) => {
    const RealDate = Date
    const offset = RealDate.parse(instant) - RealDate.now()
    globalThis.Date = class PinnedDate extends RealDate {
      constructor(...parts) {
        if (parts.length === 0) super(RealDate.now() + offset)
        else super(...parts)
      }

      static now() {
        return RealDate.now() + offset
      }
    }
  }, clock.instant)
}

/**
 * Fetch today on the sample's Overview: off with its reason while no key is kept, then with a made-up Twelve Data key
 * a click brings the fake quotes. On a weekday the US holdings go live, so the day's tile and the list's first column
 * read Today, the header says how many holdings are live, and the holdings at an earlier close say which. On a weekend
 * the quote is Friday's close, which changes nothing.
 */
export function fetchTodayFlowIn(language, clock = WEEKDAY_CLOCK) {
  const words = language === 'hr' ? { holdings: holdingsCroatian, overview: overviewCroatian, prices: pricesCroatian } : { holdings: holdingsEnglish, overview: overviewEnglish, prices: pricesEnglish }
  return async (page, { press, shoot }) => {
    const button = '[data-testid="investments-fetch-today"]'
    await page.waitForSelector(button, VISIBLE)
    if (!(await page.$eval(button, (element) => element.disabled))) throw new Error('Fetch today is on without a key kept')
    const reason = await page.$eval('[data-testid="investments-fetch-today-note"]', (element) => element.textContent?.trim() ?? '')
    if (!reason.startsWith(words.prices.today.noKey)) throw new Error(`Fetch today says "${reason}" without a key`)
    if ((await page.$('[data-testid="investments-fetch-today-prices"]')) === null) throw new Error('Fetch today names no way to Prices without a key')
    // The screen without a key is the same at every clock, so the weekday run alone shoots it.
    if (clock === WEEKDAY_CLOCK) await shoot(`fetch-today-no-key-${language}`)

    await page.evaluate((key) => localStorage.setItem('kuna.secret.twelvedata', key), MADE_UP_KEY)
    if (clock.alphaVantageKey !== undefined) await page.evaluate((key) => localStorage.setItem('kuna.secret.alphavantage', key), clock.alphaVantageKey)
    await pinClock(page, clock)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForFunction((selector) => document.querySelector(selector)?.disabled === false, { timeout: 10_000 }, button)
    await press(await page.$(button))
    if (clock.weekend) {
      await new Promise((resolve) => setTimeout(resolve, 3_000))
      await shoot(`fetch-today-${clock.name}-${language}`)
      return
    }
    await page.waitForFunction(
      (label) => [...document.querySelectorAll('[data-testid="investments-day"]')].some((tile) => tile.textContent?.includes(label)),
      { timeout: 15_000 },
      words.overview.tiles.today,
    )
    const header = await page.$eval('[data-testid="screen-title"] + p', (element) => element.textContent?.trim() ?? '')
    const live = words.holdings.today.live('', 2).other.split(' ')[0]
    if (!header.startsWith(live)) throw new Error(`the header says "${header}" after the click, not that holdings are live`)
    const held = await page.$eval('[data-testid="investments-held"]', (element) => element.textContent ?? '')
    if (clock.closedHoldings === undefined && !held.includes(words.holdings.columns.today) && !held.includes(words.holdings.today.atClose('').trim().split(' ')[0])) {
      throw new Error('the holdings list names neither Today nor a holding at an earlier close')
    }
    for (const name of clock.closedHoldings ?? []) {
      const row = await page.evaluate(
        (holding) =>
          [...document.querySelectorAll('[data-testid="investments-held"] [data-testid="holding-line"], [data-testid="investments-held"] [data-testid="holding-row"]')].find((line) =>
            line.textContent?.includes(holding),
          )?.textContent ?? null,
        name,
      )
      if (row === null) throw new Error(`the holdings list has no row for ${name}`)
      if (row.includes(words.holdings.today.atClose('').trim())) throw new Error(`${name} reads "${row}" after the evening run, not today's close`)
    }
    await shoot(`fetch-today-${clock.name}-${language}`)
  }
}

/**
 * Fetch today on the Investments home card: no button while no key is kept, then with a made-up Twelve Data key a press
 * on it stays on the home, and the day's change comes in between Value and Total gain. On a weekday it reads Today, and
 * the Overview's day tile then shows the same figure. On a weekend the quote is Friday's close, so it reads Last day.
 */
export function homeFetchTodayFlowIn(language, clock = WEEKDAY_CLOCK) {
  const words = language === 'hr' ? { home: homeCroatian, overview: overviewCroatian } : { home: homeEnglish, overview: overviewEnglish }
  return async (page, { press, shoot }) => {
    const card = '[data-testid="home-card"][data-app="investments"]'
    const button = `${card} [data-testid="home-card-action"]`
    await page.waitForSelector(`${card} dl`, VISIBLE)
    if ((await page.$(button)) !== null) throw new Error('the home card offers Fetch today without a key kept')
    // The screen without a key is the same at every clock, so the weekday run alone shoots it.
    if (clock === WEEKDAY_CLOCK) await shoot(`home-fetch-today-no-key-${language}`)

    await page.evaluate((key) => localStorage.setItem('kuna.secret.twelvedata', key), MADE_UP_KEY)
    await pinClock(page, clock)
    await page.reload({ waitUntil: 'networkidle0' })
    await press(await page.waitForSelector(button, VISIBLE))
    const label = clock.weekend ? words.home.lastDay : words.home.today
    await page.waitForFunction((selector, wanted) => [...document.querySelectorAll(`${selector} dt`)].some((term) => term.textContent?.trim() === wanted), { timeout: 15_000 }, card, label)
    if (!(await page.evaluate(() => window.location.hash === '#/' || window.location.hash === ''))) throw new Error('the press on Fetch today left the home')
    const terms = await page.$$eval(`${card} dt`, (elements) => elements.map((element) => element.textContent?.trim()))
    if (JSON.stringify(terms) !== JSON.stringify([words.home.value, label, words.home.totalGain])) throw new Error(`the home card reads ${JSON.stringify(terms)} after the click`)
    const figure = await page.$eval(`${card} dl > div:nth-child(2) > dd`, (element) => element.textContent?.trim() ?? '')
    await shoot(`home-fetch-today-${clock.name}-${language}`)

    await press(await page.$(`${card} [data-testid="home-card-link"]`))
    await page.waitForFunction(
      (wanted, shown) => [...document.querySelectorAll('[data-testid="investments-day"]')].some((tile) => tile.textContent?.includes(wanted) && tile.textContent?.includes(shown)),
      { timeout: 15_000 },
      clock.weekend ? words.overview.tiles.lastDay : words.overview.tiles.today,
      figure,
    )
  }
}
