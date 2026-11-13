/**
 * Google's window opens from a chat card's Accept in Chrome and in Firefox, each with the popup blocker on that Puppeteer turns
 * off. Accept waits on the app's assistant and the write before it asks Google, and a browser blocks a window asked for once
 * the tap's activation is gone. The fake build's Google opens its window where Google's library would, with a token that has
 * lapsed so the card's write asks again.
 *
 *   npm run build:fake && npm run preview:fake -- --port 4173
 *   npm run check:google-popup -- http://localhost:4173/kuna/
 */

import { launch } from 'puppeteer-core'

import { ENGLISH_FIREFOX_PREFS, chromeLaunch, firefoxPath } from './support/browsers.mjs'
import { forgetAssist, keepAiKey, openChat, sendInChat, allowIfAsked } from './support/chatFlows.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4173/kuna/'
const VISIBLE = { visible: true, timeout: 15_000 }
const click = (handle) => handle.click()

const BROWSERS = {
  chrome: () => launch({ ...chromeLaunch(false), defaultViewport: { width: 1440, height: 900 }, ignoreDefaultArgs: ['--disable-popup-blocking'] }),
  firefox: () =>
    launch({
      browser: 'firefox',
      executablePath: firefoxPath(),
      headless: true,
      defaultViewport: { width: 1440, height: 900 },
      extraPrefsFirefox: { ...ENGLISH_FIREFOX_PREFS, 'dom.disable_open_during_load': true },
    }),
}

/**
 * Keeps on the page whether a window asked for as the page loads, with no tap, was let through, and each window the fake
 * Google asked for and whether the browser let it open.
 */
function watchWindows() {
  const open = window.open.bind(window)
  window.googleWindows = []
  window.addEventListener('load', () => {
    const untapped = open('about:blank', 'kuna-no-tap')
    window.openedWithoutTap = untapped !== null
    untapped?.close()
  })
  window.open = (...args) => {
    const opened = open(...args)
    if (args[1] === 'kuna-fake-google') window.googleWindows.push(opened !== null)
    return opened
  }
}

async function acceptOpensGoogle(page) {
  await page.evaluateOnNewDocument(watchWindows)
  await page.goto(`${BASE}?theme=dark&fake=drive&google=expired#/company`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="nav-apps"]', VISIBLE)
  try {
    await keepAiKey(page)
    if (await page.evaluate(() => window.openedWithoutTap)) throw new Error('this browser opens a window with no tap, so a window from Accept proves nothing')
    await openChat(page, click)
    await sendInChat(page, click, 'Add a category for training courses')
    await allowIfAsked(page, click)
    await (await page.waitForSelector('[data-testid="chat-proposal-accept"]', VISIBLE).catch(() => Promise.reject(new Error('the chat proposed no category card')))).click()
    await page.waitForSelector('[data-testid="chat-proposal-undo"], [data-testid="chat-proposal-refused"]', VISIBLE)
    const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent?.trim() ?? null)
    const windows = await page.evaluate(() => window.googleWindows)
    if (windows.length === 0) throw new Error('Accept wrote the card without asking Google, so the token never lapsed')
    if (windows.includes(false)) throw new Error(`the browser blocked Google's window from Accept: ${refused}`)
    if (refused !== null) throw new Error(`Accept opened Google's window but did not write the card: ${refused}`)
  } finally {
    await forgetAssist(page)
  }
}

const failures = []
for (const [name, start] of Object.entries(BROWSERS)) {
  const browser = await start()
  const page = await browser.newPage()
  const started = Date.now()
  try {
    await acceptOpensGoogle(page)
    console.log(`ok   ${name}  ${((Date.now() - started) / 1000).toFixed(1)} s`)
  } catch (failure) {
    failures.push(name)
    console.log(`FAIL ${name}: ${failure instanceof Error ? failure.message : String(failure)}`)
  } finally {
    await browser.close()
  }
}
if (failures.length > 0) {
  console.error(`Google's window did not open from Accept in ${failures.join(', ')}`)
  process.exit(1)
}
console.log("Google's window opens from Accept in every browser")
