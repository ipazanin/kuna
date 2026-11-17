import { en as holdingsEnglish, hr as holdingsCroatian } from '../../src/apps/investments/holdings/presentation/words.ts'
import { en as overviewEnglish, hr as overviewCroatian } from '../../src/apps/investments/overview/presentation/words.ts'
import { en as pricesEnglish, hr as pricesCroatian } from '../../src/apps/investments/prices/presentation/words.ts'

const VISIBLE = { visible: true, timeout: 10_000 }
/** A made-up Twelve Data key, which the fake vendor takes like any other. */
const MADE_UP_KEY = 'made-up-twelve-data-key-0042'

function isWeekend(day = new Date()) {
  return day.getDay() === 0 || day.getDay() === 6
}

/**
 * Fetch today on the sample's Overview: off with its reason while no key is kept, then with a made-up Twelve Data key
 * a click brings the fake quotes. On a weekday the US holdings go live, so the day's tile and the list's first column
 * read Today, the header says how many holdings are live, and the holdings at an earlier close say which. On a weekend
 * the quote is Friday's close, which changes nothing.
 */
export function fetchTodayFlowIn(language) {
  const words = language === 'hr' ? { holdings: holdingsCroatian, overview: overviewCroatian, prices: pricesCroatian } : { holdings: holdingsEnglish, overview: overviewEnglish, prices: pricesEnglish }
  return async (page, { press, shoot }) => {
    const button = '[data-testid="investments-fetch-today"]'
    await page.waitForSelector(button, VISIBLE)
    if (!(await page.$eval(button, (element) => element.disabled))) throw new Error('Fetch today is on without a key kept')
    const reason = await page.$eval('[data-testid="investments-fetch-today-note"]', (element) => element.textContent?.trim() ?? '')
    if (!reason.startsWith(words.prices.today.noKey)) throw new Error(`Fetch today says "${reason}" without a key`)
    if ((await page.$('[data-testid="investments-fetch-today-prices"]')) === null) throw new Error('Fetch today names no way to Prices without a key')
    await shoot(`fetch-today-no-key-${language}`)

    await page.evaluate((key) => localStorage.setItem('kuna.secret.twelvedata', key), MADE_UP_KEY)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForFunction((selector) => document.querySelector(selector)?.disabled === false, { timeout: 10_000 }, button)
    await press(await page.$(button))
    if (isWeekend()) {
      await new Promise((resolve) => setTimeout(resolve, 3_000))
      await shoot(`fetch-today-weekend-${language}`)
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
    if (!held.includes(words.holdings.columns.today) && !held.includes(words.holdings.today.atClose('').trim().split(' ')[0])) {
      throw new Error('the holdings list names neither Today nor a holding at an earlier close')
    }
    await shoot(`fetch-today-live-${language}`)
  }
}
