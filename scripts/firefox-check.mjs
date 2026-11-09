/**
 * The few things Chrome cannot show, run in real Firefox against the fake build: the sidebar and a
 * dialog with classic scrollbars taking room, focus shown by a call and by the keyboard, the chat, a
 * photo and a sheet picked through the chat's file input, a streamed answer read through the app's
 * own reader, and the warning on leaving during a save.
 *
 *   npm run build:fake && npm run preview:fake -- --port 4173
 *   npm run check:firefox -- http://localhost:4173/kuna/
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { stripTypeScriptTypes } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch } from 'puppeteer-core'

import { ENGLISH_FIREFOX_PREFS, firefoxPath } from './support/browsers.mjs'
import { writeChatAttachmentSamples } from './support/chatAttachmentFiles.mjs'
import { keepAiKey, openChat, sendInChat } from './support/chatFlows.mjs'
import { pressSelector } from './support/pressing.mjs'
import { chartsFollowWidth } from './support/settleCharts.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4173/kuna/'
const VISIBLE = { visible: true, timeout: 15_000 }
const click = (handle) => handle.click()

const browser = await launch({
  browser: 'firefox',
  executablePath: firefoxPath(),
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
  extraPrefsFirefox: { ...ENGLISH_FIREFOX_PREFS, 'ui.useOverlayScrollbars': 0 },
})

const failures = []

async function step(name, run) {
  const page = await browser.newPage()
  const started = Date.now()
  try {
    await run(page)
    console.log(`ok   ${name}  ${((Date.now() - started) / 1000).toFixed(1)} s`)
  } catch (failure) {
    failures.push(name)
    console.log(`FAIL ${name}: ${failure instanceof Error ? failure.message : String(failure)}`)
  } finally {
    if (!page.isClosed()) await page.close()
  }
}

function open(page, query, hash) {
  return page.goto(`${BASE}?theme=dark&${query}#${hash}`, { waitUntil: 'load' })
}

/** How wide a classic scrollbar is on this Firefox, which is above zero or the checks of the room it takes prove nothing. */
async function scrollbarWidth(page) {
  return page.evaluate(() => {
    const box = document.createElement('div')
    box.style.cssText = 'width:100px;height:100px;overflow:scroll;position:absolute;top:-999px'
    document.body.append(box)
    const width = box.offsetWidth - box.clientWidth
    box.remove()
    return width
  })
}

async function pageFits(page, where) {
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  if (scroll > client) throw new Error(`${where} is ${scroll} px wide in ${client} px`)
}

await step('sidebar', async (page) => {
  await open(page, 'fake=drive', '/company')
  await page.waitForSelector('[data-testid="nav-apps"]', VISIBLE)
  const bar = await scrollbarWidth(page)
  if (bar === 0) throw new Error('this Firefox has overlay scrollbars, so nothing here takes their room')
  for (const [width, height] of [
    [1024, 800],
    [1440, 900],
    [1440, 300],
  ]) {
    await page.setViewport({ width, height })
    await page.waitForSelector('[data-testid="nav-apps"]', VISIBLE)
    // A chart that never fits keeps the page too wide, which the next line names.
    await chartsFollowWidth(page).catch(() => {})
    await pageFits(page, `the page at ${width} by ${height}`)
    const list = await page.$eval('[data-testid="nav-apps"]', (apps) => {
      const scroller = apps.parentElement
      return { scroll: scroller.scrollWidth, client: scroller.clientWidth, whole: scroller.offsetWidth }
    })
    if (list.scroll > list.client) throw new Error(`the menu at ${width} by ${height} is ${list.scroll} px wide in ${list.client} px`)
    if (list.whole - list.client < bar) throw new Error(`the menu at ${width} by ${height} keeps ${list.whole - list.client} px for a ${bar} px scrollbar`)
  }
  await page.setViewport({ width: 1440, height: 900 })
  await page.click('[data-testid="nav-app-link"][data-app="company"]')
  await page.waitForFunction(() => window.location.hash.startsWith('#/company'), { timeout: 10_000 })
})

await step('focus', async (page) => {
  await open(page, 'fake=drive', '/')
  await page.waitForSelector('[data-testid="home-card"][data-state="set-up"]', VISIBLE)
  const shown = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="home-card"][data-state="set-up"]')
    card.focus({ focusVisible: true })
    return document.activeElement === card && card.matches(':focus-visible')
  })
  if (!shown) throw new Error('focus({ focusVisible: true }) does not show on the home card')
  await page.keyboard.press('Tab')
  const tabbed = await page.evaluate(() => document.activeElement !== document.body && document.activeElement.matches(':focus-visible'))
  if (!tabbed) throw new Error('Tab moves to nothing that shows its focus')
})

await step('dialog', async (page) => {
  await open(page, 'fake=mail-move', '/company/settings?tab=books')
  const opener = await page.waitForSelector('[data-testid="move-into-kuna-open"]', VISIBLE)
  const main = () => page.$eval('main', (element) => element.getBoundingClientRect().left + element.getBoundingClientRect().width)
  const before = await main()
  await opener.click()
  await page.waitForSelector('[role="dialog"]', VISIBLE)
  const during = await main()
  if (Math.abs(during - before) > 1) throw new Error(`the page moved ${during - before} px as the dialog opened`)
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role="dialog"]', { hidden: true, timeout: 10_000 })
  await page
    .waitForFunction(() => document.activeElement?.getAttribute('data-testid') === 'move-into-kuna-open', { timeout: 5_000 })
    .catch(() => {
      throw new Error('closing the dialog does not hand focus back')
    })
  const after = await main()
  if (Math.abs(after - before) > 1) throw new Error(`the page moved ${after - before} px as the dialog closed`)
})

await step('chat', async (page) => {
  await open(page, 'fake=drive&spending=sample', '/spending')
  await page.waitForSelector('[data-testid="nav-apps"]', VISIBLE)
  await keepAiKey(page)
  await openChat(page, click)
  await sendInChat(page, click, 'Hello')
  await pressSelector(page, click, '[data-testid="chat-allow"]')
  await page.waitForSelector('[data-testid="chat-answer"]', VISIBLE).catch(() => {
    throw new Error('the chat gave no answer')
  })
})

await step('attach', async (page) => {
  const folder = mkdtempSync(join(tmpdir(), 'kuna-firefox-'))
  try {
    const samples = await writeChatAttachmentSamples(folder)
    await open(page, 'fake=drive&spending=sample', '/spending')
    await page.waitForSelector('[data-testid="nav-apps"]', VISIBLE)
    await keepAiKey(page)
    await openChat(page, click)
    const input = await page.waitForSelector('[data-testid="chat-attach-input"]', { timeout: 10_000 })
    await input.uploadFile(samples.photo, samples.sheet)
    await page
      .waitForFunction(
        () => {
          const chips = [...document.querySelectorAll('[data-testid="chat-file"]')]
          return chips.length === 2 && chips.every((chip) => chip.getAttribute('data-state') === 'ready')
        },
        { timeout: 15_000 },
      )
      .catch(async () => {
        const states = await page.$$eval('[data-testid="chat-file"]', (chips) => chips.map((chip) => `${chip.textContent?.trim()} ${chip.getAttribute('data-state')}`))
        throw new Error(`the photo and the sheet picked are not both ready: ${states.join(', ') || 'no chip'}`)
      })
    await sendInChat(page, click, 'What is on these?')
    await pressSelector(page, click, '[data-testid="chat-allow"]')
    await page.waitForSelector('[data-testid="chat-answer"]', VISIBLE).catch(() => {
      throw new Error('the chat gave no answer to a message with files')
    })
    const listed = await page.$eval('[data-testid="chat-question-files"]', (files) => files.textContent ?? '').catch(() => '')
    if (!listed.includes('chat-sample-receipt.png') || !listed.includes('chat-sample-turnover.xlsx')) throw new Error(`the sent message lists "${listed}", not the photo and the sheet`)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})

await step('stream', async (page) => {
  const events = ['first', 'druga šljiva', 'last']
  const server = createServer((request, response) => {
    if (request.url !== '/stream') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<!doctype html><title>stream</title>')
      return
    }
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    const wire = Buffer.from(events.map((event) => `data: ${event}\r\n\r\n`).join(''))
    // Cut inside a Croatian letter and between a carriage return and its line feed, as a network may.
    const cuts = [wire.indexOf('\n'), wire.indexOf(Buffer.from('š')) + 1, wire.length]
    let from = 0
    const send = () => {
      const to = cuts.shift()
      response.write(wire.subarray(from, to))
      from = to
      if (cuts.length === 0) response.end()
      else setTimeout(send, 300)
    }
    send()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    const reader = stripTypeScriptTypes(readFileSync(new URL('../src/shared/ai/infrastructure/serverSentEvents.ts', import.meta.url), 'utf8')).replace('export ', '')
    const heard = await page.evaluate(
      `(async () => {
        ${reader}
        const response = await fetch('/stream')
        const started = performance.now()
        const heard = []
        for await (const event of serverSentEvents(response.body)) heard.push({ event, at: performance.now() - started })
        return heard
      })()`,
    )
    if (JSON.stringify(heard.map((item) => item.event)) !== JSON.stringify(events)) throw new Error(`the reader heard ${JSON.stringify(heard)}`)
    if (heard.at(-1).at - heard[0].at < 200) throw new Error('the events came all at once, so the body was not read as it arrived')
  } finally {
    server.close()
  }
})

await step('save-warning', async (page) => {
  const dialogs = []
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.type())
    await dialog.accept()
  })
  await open(page, 'fake=slow-writes', '/company/transactions?tab=review')
  await page.waitForSelector('[data-testid="review-row"] > button', VISIBLE)
  const row = await page.evaluateHandle(() => [...document.querySelectorAll('[data-testid="review-row"] > button')].find((button) => button.textContent?.includes('GADGET CORNER')))
  await row.asElement().click()
  await (await page.waitForSelector('[data-testid="review-details"] [data-testid="confirm-row"]', VISIBLE)).click()
  await page.waitForSelector('[data-testid="write-progress"]', VISIBLE)
  await page.close({ runBeforeUnload: true })
  await new Promise((resolve) => setTimeout(resolve, 500))
  if (dialogs.join() !== 'beforeunload') throw new Error(`closing the page during a save brought ${dialogs.join() || 'no dialog'}`)
})

await browser.close()
if (failures.length > 0) {
  console.error(`Failed in Firefox: ${failures.join(', ')}`)
  process.exit(1)
}
console.log('every Firefox step clean')
