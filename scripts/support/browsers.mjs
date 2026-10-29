import { existsSync } from 'node:fs'

// puppeteer-core ships no browser, so the executable path must be explicit.
// Well-known install locations per platform. The first that exists wins.
const CHROME_CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ],
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
