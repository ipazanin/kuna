/**
 * Imports xlsx files another program wrote through the production build in a real browser: a
 * filled-in template laid out as in Excel must reach the import summary, a bank export must be
 * refused for its missing ledger tab, and a broken file must show why it failed.
 * Every file is made up by scripts/support/foreignWorkbookFiles.mjs.
 *
 *   npm run build && npm run check:import
 *   npm run check:import -- --firefox
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch } from 'puppeteer-core'
import { preview } from 'vite'

import { chromePath, firefoxPath } from './support/browsers.mjs'
import { writeForeignWorkbookFiles } from './support/foreignWorkbookFiles.mjs'

const browserName = process.argv.includes('--firefox') ? 'firefox' : 'chrome'
const scratch = mkdtempSync(join(tmpdir(), 'ledgerboard-import-'))
const foreignFiles = writeForeignWorkbookFiles(scratch)
const brokenFile = join(scratch, 'broken.xlsx')
writeFileSync(brokenFile, new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]))

const server = await preview({ logLevel: 'silent', preview: { host: '127.0.0.1', port: 0 } })
const appUrl = server.resolvedUrls.local[0]
const browser = await launch(
  browserName === 'firefox' ? { browser: 'firefox', executablePath: firefoxPath(), headless: true } : { executablePath: chromePath(), headless: true },
)

try {
  console.log(`Checking ${await browser.version()} against ${appUrl}`)
  for (const foreignFile of foreignFiles) {
    const { errors, outcome } = await importFile(foreignFile.path)
    assert.deepEqual(errors, [], `${foreignFile.name} must import without browser errors.`)
    if ('refusal' in foreignFile.expected) {
      assert.equal(outcome.refusal, foreignFile.expected.refusal, `${foreignFile.name} must be refused for its missing ledger, not fail to read.`)
    } else {
      assert.equal(outcome.failure, null, `${foreignFile.name} must be readable.`)
      assert.equal(outcome.facts.Transactions, String(foreignFile.expected.transactions))
      assert.equal(outcome.facts.Accounts, foreignFile.expected.accounts.join(', '))
      assert.equal(outcome.facts.Categories, String(foreignFile.expected.categories))
    }
    console.log(`PASS: ${foreignFile.name}`)
  }

  const broken = await importFile(brokenFile)
  assert.match(broken.outcome.failure ?? '', /could not be read as an Excel workbook/)
  assert.ok(broken.outcome.failureDetail, 'A file that cannot be read must show the underlying error.')
  assert.ok(broken.errors.some((error) => error.includes('Reading broken.xlsx failed')), 'The underlying error must reach the console.')
  console.log(`PASS: broken.xlsx shows "${broken.outcome.failureDetail}"`)
} finally {
  await browser.close()
  await server.close()
  rmSync(scratch, { recursive: true, force: true })
}

/** Drops one file on the welcome screen and reads what the import dialog says about it. */
async function importFile(path) {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto(appUrl, { waitUntil: 'networkidle0' })
  const input = await page.waitForSelector('[data-testid="data-source-choices"] input[type="file"]')
  await input.uploadFile(path)
  const outcome = await page
    .waitForFunction(
      () => {
        const summary = document.querySelector('[data-testid="import-summary"]')
        const failure = summary?.querySelector('[data-testid="import-failure"]')
        const facts = summary?.querySelector('dl')
        const refusal = [...(summary?.querySelectorAll('[role="alert"], [data-slot="title"]') ?? [])].find((element) => element.textContent?.includes('no tab called'))
        if (!failure && !facts && !refusal) return null
        return {
          failure: failure?.querySelector('[data-slot="title"]')?.textContent?.trim() ?? null,
          failureDetail: failure?.querySelector('[data-slot="description"]')?.textContent?.trim() ?? null,
          refusal: refusal?.textContent?.trim() ?? null,
          facts: Object.fromEntries([...(facts?.querySelectorAll('div') ?? [])].map((fact) => [fact.querySelector('dt')?.textContent?.trim(), fact.querySelector('dd')?.textContent?.trim()])),
        }
      },
      { timeout: 15_000 },
    )
    .then((handle) => handle.jsonValue())
  await context.close()
  return { errors, outcome }
}
