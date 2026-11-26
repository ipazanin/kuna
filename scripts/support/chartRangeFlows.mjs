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

/** True while the day field shows its day as an error. */
async function markedInvalid(field) {
  return field.evaluate((element) => element.querySelector('[data-invalid]') !== null)
}

/** Types a day segment by segment as `typeDay` does, failing when a year short of its four digits shows as an error. */
async function typeDayWatchingYear(page, field, day) {
  const [year, month, date] = day.split('-')
  for (const [part, digits] of [
    ['year', year],
    ['month', month],
    ['day', date],
  ]) {
    const segment = await field.$(`[data-segment="${part}"]`)
    await segment.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await segment.click()
    for (const [typed, digit] of [...digits].entries()) {
      await page.keyboard.type(digit)
      if (part === 'year' && typed < 3 && (await markedInvalid(field))) throw new Error(`a year typed digit by digit shows as an error at ${digits.slice(0, typed + 1)}`)
    }
  }
}

async function blurField(page) {
  await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined))
}

async function pressedOn(page, card) {
  return page.$eval(`${card} [data-testid="chart-range"] [aria-pressed="true"]`, (button) => button.textContent?.trim() ?? '')
}

/**
 * A custom span on the Home loan's charts. From All, Custom fills the whole span into its from and to days on Owed over
 * time, and the days keep inside the chart's span. A from day before the chart shows as an error while typed and the chart's
 * first day again once left. A from day typed there narrows both of the loan's charts with no error while its year is typed
 * digit by digit, Where the payments go shows Custom pressed too, and the span goes into the address. A from day past the
 * chart keeps to its last day. All takes it out again and hides the days.
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
    const firstDay = await from.evaluate((element) => element.textContent?.trim() ?? '')
    const wholeSpan = await page.evaluate(() => location.hash)
    await typeDay(from, '2000-01-01')
    if (!(await markedInvalid(from))) throw new Error('a from day before the chart does not show as an error')
    await blurField(page)
    await page
      .waitForFunction((day) => document.querySelector('[data-testid="loan-balance-chart"] [data-testid="chart-range-from"]')?.textContent?.trim() === day, { timeout: 10_000 }, firstDay)
      .catch(() => {
        throw new Error("a from day before the chart stays in its field instead of the chart's first day")
      })
    if ((await page.evaluate(() => location.hash)) !== wholeSpan) throw new Error('a from day before the chart changed the span')
    await typeDayWatchingYear(page, from, '2025-01-01')
    if (await markedInvalid(from)) throw new Error('a from day inside the chart shows as an error')
    // The day is written once the field is left.
    await blurField(page)
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
    await blurField(page)
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
