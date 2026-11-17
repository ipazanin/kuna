import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

import { whenRunEnds } from './runEnd.mjs'

// puppeteer-core ships no browser, so the executable path must be explicit.
// Well-known install locations per platform. The first that exists wins.
const CHROME_CANDIDATES = {
  darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
  linux: ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'],
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
}

const FIREFOX_CANDIDATES = {
  darwin: ['/Applications/Firefox.app/Contents/MacOS/firefox'],
  linux: ['/usr/bin/firefox'],
  win32: ['C:\\Program Files\\Mozilla Firefox\\firefox.exe'],
}

/**
 * The languages every check's browser asks for, so the app opens in English whatever this machine's
 * languages are. A check that wants Croatian visits with `?lang=hr`.
 */
export const ENGLISH_CHROME_ARG = '--accept-lang=en-GB,en'
export const ENGLISH_FIREFOX_PREFS = { 'intl.accept_languages': 'en-GB, en' }

/** Chrome, Chromium or Edge, from CHROME_PATH or a well-known location. Exits when none is found. */
export function chromePath() {
  return process.env.CHROME_PATH ?? found(CHROME_CANDIDATES, 'Set CHROME_PATH to your Chrome, Chromium or Edge executable and re-run.')
}

/**
 * Chrome's launch for a check: scrollbars hidden, as a phone floats them over the page, or with `classic` drawn as Linux and
 * Windows draw them, so the page lays out around a gutter. A Mac floats its scrollbars unless overlay scrollbars are off, and
 * Puppeteer hides them unless told not to.
 */
export function chromeLaunch(classic) {
  return classic
    ? { executablePath: chromePath(), headless: true, args: [ENGLISH_CHROME_ARG, '--disable-features=OverlayScrollbar'], ignoreDefaultArgs: ['--hide-scrollbars'] }
    : { executablePath: chromePath(), headless: true, args: ['--hide-scrollbars', ENGLISH_CHROME_ARG] }
}

/** Hides a classic scrollbar below the phone step on every document the page opens, as a phone floats its scrollbar over the page. */
export async function floatPhoneScrollbars(page) {
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '@media (max-width: 639.98px) { html { scrollbar-width: none } }'
      document.head.append(style)
    })
  })
}

/** Firefox, from FIREFOX_PATH or a well-known location. Exits when none is found. */
export function firefoxPath() {
  return process.env.FIREFOX_PATH ?? found(FIREFOX_CANDIDATES, 'Set FIREFOX_PATH to your Firefox executable and re-run.')
}

function found(candidates, advice) {
  const path = (candidates[process.platform] ?? []).find((candidate) => existsSync(candidate))
  if (path) return path
  console.error(advice)
  process.exit(1)
}

/** What every browser profile a check makes is named from, so a sweep and `check:leftovers` touch only these. */
export const PROFILE_PREFIX = 'kuna-browser-'

const CHECKOUT = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const DAY_MS = 24 * 60 * 60 * 1000

/** The profile prefix of this checkout's runs, so a lane's leftovers are told apart from another lane's run still going. */
export function checkoutProfilePrefix(checkout = CHECKOUT) {
  return `${PROFILE_PREFIX}${createHash('sha256').update(checkout).digest('hex').slice(0, 8)}-`
}

/**
 * Launches the browser `options` name with a profile folder of its own and hands it to `run`. The browser is closed and
 * the profile removed when `run` ends, fails or the run is stopped. Every check launches its browser through this.
 */
export async function withBrowser(options, run) {
  sweepStaleProfiles()
  const profile = mkdtempSync(join(tmpdir(), checkoutProfilePrefix()))
  let browser = null
  const removeProfile = whenRunEnds(() => {
    browser?.process()?.kill('SIGKILL')
    rmSync(profile, { recursive: true, force: true })
  })
  try {
    browser = await launch({ ...options, userDataDir: profile })
    return await run(browser)
  } finally {
    await browser?.close().catch(() => {})
    removeProfile()
  }
}

/**
 * Removes the browser profiles in `folder` that are older than a day, which only a killed run leaves behind. Nothing
 * without the profile prefix is touched, and a symbolic link is never followed.
 */
export function sweepStaleProfiles(folder = tmpdir(), now = Date.now()) {
  const swept = []
  for (const name of readdirSync(folder).filter((entry) => entry.startsWith(PROFILE_PREFIX))) {
    const path = join(folder, name)
    const stat = lstatSync(path, { throwIfNoEntry: false })
    if (stat === undefined || !stat.isDirectory() || now - stat.mtimeMs <= DAY_MS) continue
    rmSync(path, { recursive: true, force: true })
    swept.push(name)
  }
  return swept
}
