/**
 * Opens select menus so a check's `press` can look at what they draw. `press` clicks or taps an element
 * handle. A failure throws with what was wrong.
 */

import { delay } from './pressing.mjs'

const MENU_TRIGGER = ':is(button[aria-haspopup="listbox"], button[role="combobox"])'

/** How many menus one screen opens. A table repeats one menu per row, and the first few say what the rest would. */
const MOST_MENUS_ON_A_SCREEN = 5

/** Opens and closes each visible, enabled menu inside `frame`, up to `most`. */
export async function openEachMenuIn(page, press, frame, most = Infinity) {
  const triggers = await page.$$(`${frame} ${MENU_TRIGGER}`)
  const usable = []
  for (const trigger of triggers) {
    if (await trigger.evaluate((element) => element.getClientRects().length > 0 && !element.disabled)) usable.push(trigger)
  }
  for (const trigger of usable.slice(0, most)) {
    await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(150)
    await press(trigger)
    await page.waitForSelector('[role="listbox"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error(`a menu in ${frame} did not open`)
    })
    await page.keyboard.press('Escape')
    await page
      .waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
      .catch(() => {
        throw new Error(`a menu in ${frame} did not close on Escape`)
      })
    await delay(100)
  }
}

/**
 * A flow through `stops`, opening the menus of each screen and of its dialogs. A stop is a screen's hash, its title or
 * else a selector it `shows`, and the `dialogs` that buttons on it open.
 */
export function screenMenusFlow(stops) {
  return async (page, { press }) => {
    for (const { hash, title, shows, dialogs = [] } of stops) {
      await page.evaluate((target) => {
        window.location.hash = target
      }, hash)
      const opened =
        shows === undefined
          ? page.waitForFunction((wanted) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === wanted, { timeout: 10_000 }, title)
          : page.waitForSelector(shows, { timeout: 10_000 })
      await opened.catch(() => {
        throw new Error(`${hash} did not open`)
      })
      await delay(400)
      await openEachMenuIn(page, press, 'main', MOST_MENUS_ON_A_SCREEN)
      for (const opener of dialogs) {
        const button = await page.waitForSelector(opener, { visible: true, timeout: 10_000 })
        await button.evaluate((element) => element.scrollIntoView({ block: 'center' }))
        await delay(150)
        await press(button)
        await page.waitForSelector('[role="dialog"]', { visible: true, timeout: 10_000 })
        await delay(400)
        await openEachMenuIn(page, press, '[role="dialog"]')
        await page.keyboard.press('Escape')
        await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
        await delay(100)
      }
    }
  }
}
