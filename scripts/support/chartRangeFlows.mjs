import { en as sharedEnglish, hr as sharedCroatian } from '../../src/shared/ui/words.ts'
import { delay, pressSelector, typeDay } from './pressing.mjs'

const VISIBLE = { visible: true, timeout: 10_000 }

/** The button of a chart's span control that reads the label. */
async function rangeButton(page, card, label) {
  const handle = await page.waitForFunction(
    (selector, wanted) => [...document.querySelectorAll(selector)].find((button) => button.textContent?.trim() === wanted) ?? null,
    { timeout: 10_000 },
    `${card} [data-testid="chart-range"] button`,
    label,
  )
  return handle.asElement()
}

async function pressedOn(page, card) {
  return page.$eval(`${card} [data-testid="chart-range"] [aria-pressed="true"]`, (button) => button.textContent?.trim() ?? '')
}

/**
 * A custom span on the Home loan's charts. From All, Custom fills the whole span into its from and to days on Owed over
 * time. A from day typed there narrows both of the loan's charts, Where the payments go shows Custom pressed too, and the
 * span goes into the address. A from day past the chart keeps to its last day. All takes it out again and hides the days.
 */
export function loanChartCustomRangeFlowIn(language) {
  const croatian = language === 'hr'
  const words = croatian ? sharedCroatian : sharedEnglish
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(croatian ? `${name}-${language}` : name)
    const balance = '[data-testid="loan-balance-chart"]'
    const payments = '[data-testid="loan-payments-chart"]'
    const custom = await rangeButton(page, balance, words.periodBar.presets.custom)
    await custom.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(custom)
    const from = await page.waitForSelector(`${balance} [data-testid="chart-range-from"]`, VISIBLE)
    await page.waitForSelector(`${payments} [data-testid="chart-range-from"]`, VISIBLE)
    if (!(await page.evaluate(() => location.hash.includes('range=')))) throw new Error('Custom does not go into the address')
    await delay(400)
    await inspect?.('a loan chart with Custom picked over its whole span')
    await shoot('loan-chart-range-custom')
    await typeDay(from, '2025-01-01')
    // The day is written once the field is left.
    await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
    await page
      .waitForFunction(() => location.hash.includes('range=2025-01-01..'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('a from day typed on Custom does not go into the address')
      })
    const shown = await pressedOn(page, payments)
    if (shown !== words.periodBar.presets.custom) throw new Error(`Where the payments go shows ${shown} pressed, not Custom`)
    await delay(400)
    await inspect?.('a loan chart with a custom from day')
    await shoot('loan-chart-range-custom-from')
    // A from day past the chart's last day moves to that day, so the span shrinks to it instead of going back to all of it.
    await typeDay(await page.waitForSelector(`${balance} [data-testid="chart-range-from"]`, VISIBLE), '2099-01-01')
    await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
    await page
      .waitForFunction(() => /range=(\d{4}-\d{2}-\d{2})\.\.\1(&|$)/.test(location.hash), { timeout: 10_000 })
      .catch(() => {
        throw new Error('a from day past the chart does not keep to its last day')
      })
    await pressSelector(page, press, `${balance} [data-testid="chart-range"] button:last-child`)
    await page.waitForFunction(() => !location.hash.includes('range='), { timeout: 10_000 })
    if ((await page.$(`${balance} [data-testid="chart-range-days"]`)) !== null) throw new Error('All keeps the custom days on screen')
    if ((await pressedOn(page, balance)) !== words.chart.ranges.all) throw new Error('All is not pressed after it is picked')
  }
}
