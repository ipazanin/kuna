/**
 * The flows of Spending's Analysis on the fake `years` set: each tab draws its charts, a breakdown grouped by payee keeps its
 * grouping in the address and a row opens that payee's entries over the span with the total the row shows, and a growing
 * category opens Over time on itself.
 */

import { en as analysisEnglish, hr as analysisCroatian } from '../../src/apps/spending/analytics/presentation/words.ts'

const WORDS = { en: analysisEnglish.analysis, hr: analysisCroatian.analysis }

const queryOf = (page) => page.evaluate(() => Object.fromEntries(new URLSearchParams(window.location.hash.split('?')[1] ?? '')))

async function waitForQuery(page, key, wanted, what) {
  await page
    .waitForFunction((name, value) => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(name) === value, { timeout: 5_000 }, key, wanted)
    .catch(() => {
      throw new Error(`${what} left the address at ${page.url()}`)
    })
}

async function openTab(page, press, label) {
  const tab = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="tab"]')].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null, { timeout: 10_000 }, label)
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no tab reading "${label}"`)
    })
  await tab.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(tab)
}

async function chartsDrawn(page, selector) {
  await page.waitForSelector(`${selector} canvas`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`${selector} drew no chart`)
  })
}

export function spendingAnalysisFlowIn(language) {
  const words = WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-analysis-table"]', { visible: true, timeout: 10_000 })
    await chartsDrawn(page, '[data-testid="spending-analysis-chart"]')
    await inspect?.('Analysis, Breakdown by category')
    await shoot('spending-analysis')

    const payee = await page.waitForSelector('[data-testid="spending-analysis-grouping"] button[data-value="payee"]', { visible: true, timeout: 5_000 })
    await press(payee)
    await waitForQuery(page, 'grouping', 'payee', words.breakdown.groupings.payee)
    await page.waitForFunction((title) => document.querySelector('[data-testid="spending-analysis-table"]')?.textContent?.includes(title), { timeout: 5_000 }, words.breakdown.tableTitles.payee)
    await inspect?.('Analysis, Breakdown by payee')
    await shoot('spending-analysis-payees')

    const row = await page.waitForSelector('[data-testid="spending-analysis-row"][data-spent]:not([data-spent="0"])', { visible: true, timeout: 5_000 })
    const shown = await row.evaluate((element) => ({ name: element.querySelector('th')?.textContent?.trim() ?? '', spent: element.getAttribute('data-spent') }))
    await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    const cell = await row.$('td:last-of-type')
    await press(cell ?? row)
    await page.waitForSelector('[data-testid="spending-filter-total"]', { visible: true, timeout: 10_000 })
    const query = await queryOf(page)
    if (query.from === undefined || query.to === undefined || query.payee === undefined) throw new Error(`Entries opened from ${shown.name} names no span and payee: ${page.url()}`)
    const total = await page.$eval('[data-testid="spending-filter-total"]', (line) => line.querySelector('[data-spent]')?.getAttribute('data-spent') ?? null)
    if (total !== shown.spent) throw new Error(`Entries opened from ${shown.name} sums ${total} where Analysis shows ${shown.spent}`)
    await page.goBack()
    await page.waitForSelector('[data-testid="spending-analysis-table"]', { visible: true, timeout: 10_000 })

    await openTab(page, press, words.tabs.overTime)
    await waitForQuery(page, 'tab', 'over-time', words.tabs.overTime)
    await page.waitForSelector('[data-testid="spending-analysis-average"]', { visible: true, timeout: 10_000 })
    await chartsDrawn(page, '[data-testid="spending-analysis-over-time-chart"]')
    await inspect?.('Analysis, Over time')
    await shoot('spending-analysis-over-time')

    await openTab(page, press, words.tabs.year)
    await waitForQuery(page, 'tab', 'year', words.tabs.year)
    await chartsDrawn(page, '[data-testid="spending-analysis-year-chart"]')
    await inspect?.('Analysis, Year against year')
    await shoot('spending-analysis-year')

    await openTab(page, press, words.tabs.savings)
    await waitForQuery(page, 'tab', 'savings', words.tabs.savings)
    await chartsDrawn(page, '[data-testid="spending-analysis-flow"]')
    await chartsDrawn(page, '[data-testid="spending-analysis-went"]')
    await inspect?.('Analysis, Savings and trends')
    await shoot('spending-analysis-savings')

    const trend = await page.waitForSelector('[data-testid="spending-analysis-growing"] [data-testid="spending-analysis-trend"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the years set shows no growing category')
    })
    const category = await trend.evaluate((element) => element.querySelector('.list-row-title')?.textContent?.trim() ?? '')
    await trend.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(trend)
    await waitForQuery(page, 'tab', 'over-time', category)
    await page
      .waitForFunction((name) => document.querySelector('[data-testid="spending-analysis-category"]')?.textContent?.includes(name), { timeout: 5_000 }, category)
      .catch(() => {
        throw new Error(`Over time opened from ${category} picks another category`)
      })
  }
}
