/**
 * The inner tabs of a page, shared by the visual and the touch check. `press` clicks or taps an
 * element handle, and `shoot` takes a screenshot under a name. A failure throws with what was wrong.
 */

import { delay } from './editorFlows.mjs'

/** The address, the browser title and the open tab of the strip, read in the page. */
function tabState() {
  const strip = document.querySelector('[role="tablist"]')
  const tab = strip?.querySelector('[role="tab"][aria-selected="true"]')
  const stripBox = strip?.getBoundingClientRect()
  const tabBox = tab?.getBoundingClientRect()
  return {
    hash: window.location.hash,
    title: document.title,
    name: strip?.getAttribute('aria-label') ?? null,
    open: tab?.textContent?.trim() ?? null,
    inStrip: stripBox !== undefined && tabBox !== undefined && tabBox.left >= stripBox.left - 1 && tabBox.right <= stripBox.right + 1 && tabBox.right <= window.innerWidth,
  }
}

/** Reads the state until it holds, for up to 10 s. */
async function until(page, holds, message) {
  let state = null
  for (let tries = 0; tries < 50; tries += 1) {
    state = await page.evaluate(tabState)
    if (holds(state)) return state
    await delay(200)
  }
  throw new Error(`${message} (got ${JSON.stringify(state)})`)
}

async function pressTab(page, press, label) {
  const tab = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="tab"]')].find((element) => element.textContent.trim().startsWith(wanted)) ?? null, { timeout: 10_000 }, label)
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no tab "${label}"`)
    })
  await press(tab)
}

/**
 * On Settings: two tabs picked in turn, each in the address and the browser title, then Back twice
 * through them to the default tab, which stays out of the address. Last, a fresh load of a link
 * to the last tab must show that tab inside the strip, which a phone scrolls for its five tabs.
 */
export async function pageTabsFlow(page, { press, shoot }) {
  await until(page, (state) => state.name === 'Parts of the settings', 'the tab strip has no accessible name')

  await pressTab(page, press, 'Categories')
  await until(page, (state) => state.hash.includes('tab=categories') && state.open?.startsWith('Categories'), 'Categories did not open with tab=categories in the address')
  await pressTab(page, press, 'Accounts')
  await until(page, (state) => state.hash.includes('tab=accounts') && state.title === 'Settings, Accounts – Kuna', 'Accounts did not reach the address and the browser title')
  await shoot('page-tabs-accounts')

  await page.evaluate(() => history.back())
  await until(page, (state) => state.hash.includes('tab=categories') && state.open?.startsWith('Categories'), 'Back did not return to Categories')
  await page.evaluate(() => history.back())
  await until(
    page,
    (state) => !state.hash.includes('tab=') && state.open?.startsWith('General') && state.title === 'Settings, General – Kuna',
    'the second Back did not return to General with no tab in the address',
  )

  await page.goto(page.url().replace(/#.*$/, '#/settings?tab=device'), { waitUntil: 'networkidle0' })
  await page.reload({ waitUntil: 'networkidle0' })
  await until(page, (state) => state.open?.startsWith('This device') && state.inStrip, 'a link to the last tab did not open it in sight in the strip')
  await shoot('page-tabs-last')
}

/** The year picker's chosen year, read in the page. */
function pickedYear() {
  return document.querySelector('[data-testid="year-picker"] [aria-pressed="true"]')?.textContent?.trim() ?? null
}

/**
 * On Year, from a link to the Statements tab with no year, which opens the last closed year: the
 * year goes into the address, so another tab, the default tab and Back all stay in that year.
 */
export async function yearTabLinkFlow(page, { press, shoot }) {
  const closed = await page.waitForFunction(pickedYear).then((handle) => handle.jsonValue())
  await until(page, (state) => state.open?.startsWith('Statements') && state.hash.includes(`year=${closed}`), 'a link to Statements alone did not name the year it opened')
  await pressTab(page, press, 'Taxes')
  await until(page, (state) => state.hash.includes('tab=taxes') && state.hash.includes(`year=${closed}`), 'Taxes did not stay in the year the link opened')
  await pressTab(page, press, 'Accountant')
  await until(page, (state) => !state.hash.includes('tab=') && state.open?.startsWith('Accountant'), 'the default tab did not open in the same year')
  const year = await page.evaluate(pickedYear)
  if (year !== closed) throw new Error(`the Accountant tab opened ${year} instead of ${closed}`)
  await shoot('year-tab-link')
  await page.evaluate(() => history.back())
  await until(page, (state) => state.hash.includes('tab=taxes') && state.hash.includes(`year=${closed}`), 'Back did not return to Taxes in the same year')
}
