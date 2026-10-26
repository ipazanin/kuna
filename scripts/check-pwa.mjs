/**
 * Checks the production build as an installable, offline app in a real browser: the manifest and
 * its icons, a worker scoped to the app that caches every built file and nothing from another
 * origin, an offline reload that still shows the workbook imported on the first visit, an update
 * that waits for the prompt and swaps the cache when the user reloads, and a broken release that
 * never becomes the offline copy.
 *
 * Every request to another origin is sent to a dead proxy, so no call reaches Google.
 *
 *   npm run build && npm run check:pwa
 *   npm run check:pwa -- --firefox
 */

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from 'puppeteer-core'

import { chromePath, firefoxPath } from './support/browsers.mjs'
import { writeFakeTemplateFile } from './support/fakeTemplateFile.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outputDirectory = join(root, 'dist')
const html = await readFile(join(outputDirectory, 'index.html'), 'utf8')
const manifestPath = html.match(/rel="manifest"[^>]*href="([^"]+)"/)?.[1]
assert.ok(manifestPath?.startsWith('/'), 'Build the production app before running this check.')
const base = manifestPath.slice(0, manifestPath.lastIndexOf('/') + 1)
const filenames = (await readdir(outputDirectory, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && !entry.name.endsWith('.map'))
  .map((entry) => join(entry.parentPath, entry.name).slice(outputDirectory.length + 1).replaceAll('\\', '/'))
const builtFiles = new Map(await Promise.all(filenames.map(async (filename) => [filename, await readFile(join(outputDirectory, filename))])))
assert.ok(builtFiles.has('sw.js'), 'The production build must contain a service worker.')
const missingAsset = filenames.find((filename) => filename.endsWith('.woff2'))
assert.ok(missingAsset, 'Expected bundled fonts to exercise a failed precache installation.')

const scratch = mkdtempSync(join(tmpdir(), 'ledgerboard-pwa-'))
const templateFile = await writeFakeTemplateFile(join(scratch, 'filled-template.xlsx'))

const mimeTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff',
}
let release = 'initial'
let serverUnavailable = false
const server = createServer((request, response) => {
  if (serverUnavailable) {
    request.socket.destroy()
    return
  }
  const pathname = new URL(request.url, 'http://localhost').pathname
  if (pathname === '/probe') {
    response.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' })
    response.end('<!doctype html><title>Browser storage probe</title>')
    return
  }
  const filename = pathname.startsWith(base) ? pathname.slice(base.length) || 'index.html' : null
  let body = builtFiles.get(filename)
  if (release === 'broken' && filename === missingAsset) body = undefined
  if (!body) {
    response.writeHead(404)
    response.end()
    return
  }
  if (filename === 'sw.js' && release !== 'initial') {
    const source = body.toString()
    const changed = source.replace(/("release"\s*:\s*")([^"]+)(")/, `$1$2-${release}$3`)
    assert.notEqual(changed, source, 'The update fixture must create a distinct release cache.')
    body = Buffer.from(`${changed}\n// Browser regression fixture: ${release}\n`)
  }
  response.writeHead(200, { 'Content-Type': mimeTypes[extname(filename)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
  response.end(body)
})

const browserName = process.argv.includes('--firefox') ? 'firefox' : 'chrome'
// Port 9 is the discard port, where nothing listens, so every request through the proxy fails at once.
const DEAD_PROXY = '127.0.0.1:9'
let browser
try {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  const appUrl = origin + base
  browser = await launch(
    browserName === 'firefox'
      ? {
          browser: 'firefox',
          executablePath: firefoxPath(),
          headless: true,
          extraPrefsFirefox: {
            'network.proxy.type': 1,
            'network.proxy.http': '127.0.0.1',
            'network.proxy.http_port': 9,
            'network.proxy.ssl': '127.0.0.1',
            'network.proxy.ssl_port': 9,
            'network.proxy.no_proxies_on': '127.0.0.1',
          },
        }
      : { executablePath: chromePath(), headless: true, args: ['--no-sandbox', `--proxy-server=http://${DEAD_PROXY}`] },
  )
  console.log(`Checking ${await browser.version()}`)
  const context = await browser.createBrowserContext()
  const probe = await context.newPage()
  await probe.goto(`${origin}/probe`)
  await probe.evaluate(async () => {
    const cache = await caches.open('another-project-cache')
    await cache.put('/unrelated', new Response('Keep another app intact'))
  })

  const errors = []
  const foreignRequests = []
  const watch = (page) => {
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      // A Google script the dead proxy refused is expected. The app catches that and carries on.
      const source = message.location()?.url ?? ''
      if (message.type() === 'error' && (source === '' || source.startsWith(origin))) errors.push(message.text())
    })
    page.on('request', (request) => {
      if (!request.url().startsWith(origin) && !request.url().startsWith('data:') && !request.url().startsWith('blob:')) {
        foreignRequests.push(request.url())
      }
    })
    return page
  }

  const page = watch(await context.newPage())
  await page.setCacheEnabled(false)
  await page.goto(appUrl)
  await waitForWorker(page)
  const manifest = await page.evaluate(async () => {
    const url = document.querySelector('link[rel="manifest"]').href
    const manifest = await (await fetch(url)).json()
    const icons = await Promise.all(manifest.icons.map(async (icon) => {
      const bitmap = await createImageBitmap(await (await fetch(new URL(icon.src, url))).blob())
      return { declared: icon.sizes, purpose: icon.purpose, actual: `${bitmap.width}x${bitmap.height}` }
    }))
    return { ...manifest, url, icons }
  })
  assert.equal(new URL(manifest.scope, manifest.url).href, appUrl)
  assert.equal(new URL(manifest.start_url, manifest.url).href, appUrl)
  assert.equal(new URL(manifest.id, manifest.url).href, appUrl)
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.theme_color, '#0d1219')
  assert.equal(manifest.background_color, '#0d1219')
  for (const size of ['192x192', '512x512']) {
    assert.ok(manifest.icons.some((icon) => icon.declared === size && icon.actual === size && icon.purpose === 'any'), `Missing valid ${size} icon`)
  }
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable' && icon.actual === icon.declared), 'Missing a valid maskable icon')
  assert.equal(await page.evaluate(async () => (await navigator.serviceWorker.ready).scope), appUrl)
  if (browserName === 'chrome') {
    // Chrome's own verdict on whether the page can be installed, as Android Chrome makes it.
    const session = await page.createCDPSession()
    const { installabilityErrors } = await session.send('Page.getInstallabilityErrors')
    // The check runs in a separate browser context, which Chrome treats as incognito, where nothing installs.
    const blocking = installabilityErrors.map((error) => error.errorId).filter((errorId) => errorId !== 'in-incognito')
    assert.deepEqual(blocking, [], 'Chrome must consider the app installable.')
    await session.detach()
  }
  const assets = filenames.filter((filename) => filename !== 'sw.js').map((filename) => appUrl + filename)
  assert.deepEqual(await page.evaluate(async (urls) => {
    const missing = []
    for (const url of urls) if (!await caches.match(url)) missing.push(url)
    return missing
  }, assets), [], 'Every built asset, including lazy screens, SheetJS and fonts, must be available offline.')
  console.log(`PASS: manifest, icons, scoped worker, complete precache${browserName === 'chrome' ? ', installable' : ''}`)

  // The first visit: onboarding brings an xlsx file into this browser, which keeps the workbook in IndexedDB.
  await clickStart(page, '[data-testid="onboarding-path"] label', 'Bring my books')
  await clickText(page, '[data-testid="onboarding-step"] button', 'Continue')
  await clickStart(page, '[data-testid="onboarding-home"] label', 'Only this browser')
  await clickText(page, '[data-testid="onboarding-step"] button', 'Continue')
  await (await page.waitForSelector('input[data-testid="onboarding-file"]')).uploadFile(templateFile)
  await page.waitForSelector('[data-testid="import-summary"] dl')
  await clickText(page, '[data-testid="onboarding-step"] button', 'Keep in this browser')
  await page.waitForSelector('[data-testid="onboarding-step"][data-step="company"]')
  await clickText(page, '[data-testid="onboarding-step"] button', 'Continue')
  await waitForTitle(page, 'Overview')
  await page.waitForSelector('.chart-body canvas')
  assert.deepEqual(await cachedForeignUrls(page, origin), [], 'Nothing from another origin may be cached.')

  // Firefox's WebDriver offline emulation rejects navigation before service-worker handling.
  serverUnavailable = true
  if (browserName === 'chrome') await page.setOfflineMode(true)
  await page.goto(`${appUrl}?offline-check=1#/transactions`)
  await waitForTitle(page, 'Transactions')
  await page.waitForFunction(() => document.body.innerText.includes('Northwind Analytics'))
  await page.goto(`${appUrl}?offline-check=2#/analysis?tab=over-time`)
  await waitForTitle(page, 'Analysis')
  await page.waitForSelector('.chart-body canvas')
  await page.reload()
  await waitForTitle(page, 'Analysis')
  await page.waitForSelector('.chart-body canvas')
  assert.deepEqual(errors, [], 'Offline navigation must not produce browser errors.')
  console.log('PASS: offline reload shows the imported workbook, lazy screens and charts included')

  serverUnavailable = false
  if (browserName === 'chrome') await page.setOfflineMode(false)
  const secondWindow = watch(await context.newPage())
  await secondWindow.goto(appUrl)
  await waitForWorker(secondWindow)
  await waitForTitle(secondWindow, 'Overview')
  const originalCaches = await probe.evaluate(() => caches.keys())
  const originalDocument = await page.evaluate(() => {
    window.pwaCheckDocument = crypto.randomUUID()
    return window.pwaCheckDocument
  })
  release = 'updated'
  await page.evaluate(async () => (await navigator.serviceWorker.ready).update())
  await probe.waitForFunction(async (scope) => Boolean((await navigator.serviceWorker.getRegistration(scope))?.waiting), { polling: 100 }, appUrl)
  await page.waitForSelector('[data-testid="update-prompt"]')
  assert.equal(await page.evaluate(() => window.pwaCheckDocument), originalDocument, 'An update must wait for the prompt, not reload the page.')
  const cachesWithUpdate = await probe.evaluate(() => caches.keys())
  for (const cacheName of originalCaches) assert.ok(cachesWithUpdate.includes(cacheName), 'A waiting update must keep the active cache.')
  assert.ok(cachesWithUpdate.some((cacheName) => !originalCaches.includes(cacheName)), 'The next release must have its own complete cache.')

  // A background tab never reports its elements in view, so a click there would wait forever.
  await page.bringToFront()
  await clickText(page, '[data-testid="update-prompt"] button', 'Reload')
  await page.waitForFunction(() => window.pwaCheckDocument === undefined, { polling: 100 })
  await waitForTitle(page, 'Analysis')
  await probe.waitForFunction(async (scope) => {
    const registration = await navigator.serviceWorker.getRegistration(scope)
    return registration?.active?.state === 'activated' && !registration.waiting
  }, { polling: 100 }, appUrl)
  await secondWindow.waitForSelector('[data-testid="update-prompt"]')
  const activeCaches = await probe.evaluate(() => caches.keys())
  for (const cacheName of originalCaches.filter((name) => name !== 'another-project-cache')) {
    assert.ok(!activeCaches.includes(cacheName), 'The old release cache should be removed once the update is active.')
  }
  assert.equal(await probe.evaluate(async () => (await caches.match('/unrelated'))?.text()), 'Keep another app intact')
  await secondWindow.close()
  const reopened = watch(await context.newPage())
  await reopened.setCacheEnabled(false)
  serverUnavailable = true
  if (browserName === 'chrome') await reopened.setOfflineMode(true)
  await reopened.goto(`${appUrl}?offline-check=updated#/analysis?tab=over-time`)
  await waitForTitle(reopened, 'Analysis')
  await reopened.waitForSelector('.chart-body canvas')
  await context.close()
  assert.deepEqual(errors, [], 'The update must not produce browser errors.')
  console.log('PASS: an update waits for the prompt, reloads on request, tells other windows, and keeps unrelated caches')

  release = 'broken'
  serverUnavailable = false
  const failedContext = await browser.createBrowserContext()
  const failedPage = await failedContext.newPage()
  await failedPage.goto(`${origin}/probe`)
  const failedInstallation = await failedPage.evaluate(async (scope) => {
    try {
      const registration = await navigator.serviceWorker.register(`${scope}sw.js`, { scope })
      const worker = registration.installing
      if (worker) await new Promise((resolve) => {
        if (worker.state === 'redundant' || worker.state === 'activated') resolve()
        else worker.addEventListener('statechange', () => {
          if (worker.state === 'redundant' || worker.state === 'activated') resolve()
        })
      })
      return { active: Boolean(registration.active), state: worker?.state, caches: await caches.keys() }
    } catch {
      return { active: false, state: 'rejected', caches: await caches.keys() }
    }
  }, appUrl)
  assert.equal(failedInstallation.active, false, 'An incomplete shell must not become available offline.')
  assert.ok(['redundant', 'rejected'].includes(failedInstallation.state))
  assert.deepEqual(failedInstallation.caches, [], 'An unsuccessful first install must not leave a partial app cache.')
  await failedContext.close()
  console.log('PASS: a missing precache asset rejects installation and removes the incomplete cache')

  const unexpected = foreignRequests.filter((url) => !url.startsWith('https://accounts.google.com/gsi/client'))
  assert.deepEqual(unexpected, [], 'The only other origin the app may ask for before sign-in is the Google sign-in script.')
} finally {
  await browser?.close()
  if (server.listening) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  rmSync(scratch, { recursive: true, force: true })
}

async function waitForWorker(page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
}

async function waitForTitle(page, title) {
  await page.waitForFunction(
    (expected) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === expected,
    { timeout: 15_000 },
    title,
  )
}

async function clickText(page, selector, text) {
  const handle = await page.waitForFunction(
    (css, wanted) => [...document.querySelectorAll(css)].find((element) => element.textContent?.trim() === wanted) ?? null,
    {},
    selector,
    text,
  )
  await handle.asElement().click()
}

/** Clicks the first element under the selector whose text starts with the words, such as a radio choice's label above its description. */
async function clickStart(page, selector, text) {
  const handle = await page.waitForFunction(
    (css, wanted) => [...document.querySelectorAll(css)].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null,
    {},
    selector,
    text,
  )
  await handle.asElement().click()
}

async function cachedForeignUrls(page, origin) {
  return page.evaluate(async (own) => {
    const foreign = []
    for (const name of await caches.keys()) {
      for (const request of await (await caches.open(name)).keys()) {
        if (!request.url.startsWith(own)) foreign.push(request.url)
      }
    }
    return foreign
  }, origin)
}
