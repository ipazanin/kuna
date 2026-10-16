/**
 * Draws the PNG app icons from the SVG marks in public/icons. The 180 px Apple touch icon is full
 * bleed, because iOS rounds the corners itself. Run it after changing a mark:
 *   node scripts/generate-icons.mjs
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

import { chromePath } from './support/browsers.mjs'

const ICONS = [
  { mark: 'ledgerboard-maskable.svg', file: 'ledgerboard-180.png', size: 180 },
  { mark: 'ledgerboard.svg', file: 'ledgerboard-192.png', size: 192 },
  { mark: 'ledgerboard.svg', file: 'ledgerboard-512.png', size: 512 },
  { mark: 'ledgerboard-maskable.svg', file: 'ledgerboard-maskable-512.png', size: 512 },
]

const browser = await launch({ executablePath: chromePath(), headless: true, args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  for (const icon of ICONS) {
    const svg = await readFile(new URL(`../public/icons/${icon.mark}`, import.meta.url), 'utf8')
    await page.setViewport({ width: icon.size, height: icon.size, deviceScaleFactor: 1 })
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`)
    await page.screenshot({ path: fileURLToPath(new URL(`../public/icons/${icon.file}`, import.meta.url)), omitBackground: true })
  }
} finally {
  await browser.close()
}
