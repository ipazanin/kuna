/**
 * The shell's own flows that the visual, touch and Firefox checks share: the three sidebar states with and without the
 * docked chat, the layout menu's notes, the chat's edge, the window squeezed from wide to a phone, the lit parent of a
 * detail screen, the skip link and Jump to a page. `press` clicks or taps an element handle. A failure throws with what was wrong.
 */

import { en as appEnglish, hr as appCroatian } from '../../src/shared/app/words.ts'
import { CHAT_MIN_WIDTH } from '../../src/shared/ai/presentation/chatDock.ts'
import { PAGE_LEAST_WIDTH, PHONE_BELOW } from '../../src/shared/layout/viewport.ts'
import { layoutOf, roomEffectOf, SIDEBAR_WIDTH } from '../../src/shell/ui/sidebarLayout.ts'
import { en as shellEnglish, hr as shellCroatian } from '../../src/shell/ui/words.ts'
import { allowIfAsked, MADE_UP_ANTHROPIC_KEY, sendInChat } from './chatFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'

const SHELL_WORDS = { en: shellEnglish, hr: shellCroatian }
const APP_WORDS = { en: appEnglish, hr: appCroatian }

/** What the shell draws now, read from the page. */
function shellState(page) {
  return page.evaluate(() => {
    const width = (selector) => {
      const element = document.querySelector(selector)
      return element === null ? null : Math.round(element.getBoundingClientRect().width)
    }
    return {
      windowWidth: document.body.clientWidth,
      sidebar: document.querySelector('[data-testid="app-shell"]')?.dataset.sidebar ?? null,
      aside: width('aside[data-testid="sidebar"]'),
      dock: width('[data-testid="chat-dock"]'),
      pane: document.querySelector('[data-testid="chat-pane"]') !== null,
      main: document.querySelector('main')?.offsetParent === null ? null : width('main'),
    }
  })
}

/** The width the shell is laid out in, as the app reads it: the body's, after a classic scrollbar's gutter. */
export function shellRoom(page) {
  return page.evaluate(() => document.body.clientWidth)
}

/** How much of the window a classic scrollbar's gutter takes from the shell, from the phone step up. Zero where scrollbars float. */
export async function scrollbarGutter(page) {
  return (await page.evaluate(() => window.innerWidth)) - (await shellRoom(page))
}

/** Fails unless the page draws what `layoutOf` says for this window, the stored choice and the chat at `chat` px, or closed. */
async function drawsAsDecided(page, choice, chat) {
  await delay(300)
  const drawn = await shellState(page)
  const decided = layoutOf({ choice, windowWidth: drawn.windowWidth, chat })
  const asideWidth = decided.sidebar === 'expanded' || decided.sidebar === 'icons' ? SIDEBAR_WIDTH[decided.sidebar] : null
  const dockWidth = decided.chat.at === 'dock' ? decided.chat.width : null
  const pageWidth = decided.chat.at === 'page' ? null : decided.page
  if (drawn.sidebar !== decided.sidebar || drawn.aside !== asideWidth || drawn.dock !== dockWidth || drawn.pane !== (decided.chat.at === 'page') || drawn.main !== pageWidth)
    throw new Error(`at ${drawn.windowWidth} px with ${choice} and the chat ${chat ?? 'closed'} the shell drew ${JSON.stringify(drawn)}, not ${JSON.stringify(decided)}`)
  if (dockWidth !== null && drawn.main < PAGE_LEAST_WIDTH) throw new Error(`the page beside the docked chat is ${drawn.main} px, under ${PAGE_LEAST_WIDTH}`)
  return drawn
}

/** Fails unless every item of the open layout menu says what `roomEffectOf` says picking it changes, and nothing where it changes nothing. */
function menuSaysWhatChanges(items, words, inForce, windowWidth, chat) {
  for (const picked of ['expanded', 'icons', 'hidden']) {
    const item = items.find((shown) => shown.text.startsWith(words.sidebarLayout[picked]))
    const effect = roomEffectOf({ picked, inForce, windowWidth, chat })
    const said = Object.entries(words.sidebarLayout.effects)
      .filter(([, text]) => item?.text.includes(text))
      .map(([name]) => name)
    if (said.join() !== (effect ?? ''))
      throw new Error(`at ${windowWidth} px with ${inForce} and the chat ${chat ?? 'closed'}, ${picked} says ${JSON.stringify(item?.text)}, not ${effect ?? 'nothing'}`)
  }
}

async function keepChoices(page, stored) {
  await page.evaluate(
    (key, choices) => {
      localStorage.setItem('kuna.secret.anthropic', key)
      for (const [name, choice] of Object.entries(choices)) {
        if (choice === null) localStorage.removeItem(name)
        else localStorage.setItem(name, choice)
      }
    },
    MADE_UP_ANTHROPIC_KEY,
    stored,
  )
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10_000 })
  await delay(300)
}

async function forgetChoices(page) {
  await page.evaluate(() => {
    for (const name of ['kuna.secret.anthropic', 'kuna.sidebar', 'kuna.chat-width']) localStorage.removeItem(name)
  })
}

async function openTheChat(page, press) {
  if (await page.$('[data-testid="chat-panel"]')) return
  const opener = await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="chat-open"]')].find((button) => button.getClientRects().length > 0), { timeout: 10_000 })
  await press(opener.asElement())
  await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
}

/** Opens the sidebar layout menu, from the drawer when the sidebar is hidden, and returns each item's name, description and whether it is checked, then closes it. */
async function layoutMenuItems(page, press) {
  const shown = await page.evaluate(() => [...document.querySelectorAll('[data-testid="sidebar-layout"]')].some((button) => button.getClientRects().length > 0))
  if (!shown) {
    await pressSelector(page, press, '[data-testid="open-navigation"]')
    await page.waitForSelector('[role="dialog"] [data-testid="sidebar-layout"]', { visible: true, timeout: 5_000 })
    await delay(300)
  }
  await pressSelector(page, press, '[data-testid="sidebar-layout"]')
  await page.waitForSelector('[role="menuitemcheckbox"]', { visible: true, timeout: 5_000 })
  await delay(200)
  const items = await page.$$eval('[role="menuitemcheckbox"]', (rows) => rows.map((row) => ({ text: row.textContent?.trim() ?? '', checked: row.getAttribute('aria-checked') === 'true' })))
  return items
}

async function closeMenu(page) {
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[role="menu"]'), { timeout: 5_000 })
}

async function pickLayout(page, press, label) {
  await layoutMenuItems(page, press)
  const row = await page.waitForFunction((wanted) => [...document.querySelectorAll('[role="menuitemcheckbox"]')].find((item) => item.textContent?.trim().startsWith(wanted)), { timeout: 5_000 }, label)
  await press(row.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="menu"]'), { timeout: 5_000 })
  await delay(300)
}

/** The icon sidebar: a row names itself on focus, and the footer's logo opens its lines at the button and gives focus back on Escape. */
async function iconsSayWhatTheyAre(page, press, language, shoot) {
  await page.focus('[data-testid="nav-kuna-settings"]')
  await page.waitForSelector('[role="tooltip"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('a row of the icon sidebar shows no name on focus')
  })
  const opener = await pressSelector(page, press, '[data-testid="company-footer-open"]')
  const lines = await page.waitForSelector('[data-testid="company-footer-lines"]', { visible: true, timeout: 5_000 })
  await delay(300)
  const placed = await page.evaluate(() => {
    const button = document.querySelector('[data-testid="company-footer-open"]').getBoundingClientRect()
    const popover = document.querySelector('[data-testid="company-footer-lines"]').getBoundingClientRect()
    return { gap: Math.round(popover.left - button.right), overlaps: popover.top < button.bottom && popover.bottom > button.top, tooltip: document.querySelector('[role="tooltip"]') !== null }
  })
  if (placed.gap < 0 || placed.gap > 16 || !placed.overlaps) throw new Error(`the footer's lines do not sit at its button: ${JSON.stringify(placed)}`)
  if (placed.tooltip) throw new Error("the footer's tooltip shows over its open lines")
  const text = await lines.evaluate((element) => element.textContent ?? '')
  for (const wanted of [APP_WORDS[language].privacy, APP_WORDS[language].terms, '@']) if (!text.includes(wanted)) throw new Error(`the footer's lines lack ${wanted}`)
  await shoot('footer-popover')
  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-testid="company-footer-lines"]', { hidden: true, timeout: 5_000 })
  const back = await opener.evaluate((button) => document.activeElement === button)
  if (!back) throw new Error("Escape did not give focus back to the footer's button")
}

/** The hidden sidebar: the top bar holds only the menu button, whose drawer starts with the layout menu and ends with the footer. */
async function topBarHoldsTheWayBack(page, press) {
  for (const control of ['sidebar-layout', 'quick-jump-open']) {
    if (await page.$(`header [data-testid="${control}"]`)) throw new Error(`the top bar of the hidden sidebar holds ${control}, beside the menu button`)
  }
  await pressSelector(page, press, '[data-testid="open-navigation"]')
  await page.waitForSelector('[role="dialog"] [data-testid="company-footer"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('the drawer does not end with the footer')
  })
  const atTop = await page.evaluate(() => {
    const layout = document.querySelector('[role="dialog"] [data-testid="sidebar-layout"]')?.getBoundingClientRect()
    const nav = document.querySelector('[role="dialog"] nav')?.getBoundingClientRect()
    return layout !== undefined && nav !== undefined && layout.bottom <= nav.top + 1
  })
  if (!atTop) throw new Error('the drawer of the hidden sidebar does not start with the layout menu')
  await delay(300)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
}

/**
 * One sidebar choice at this width, with the chat open or not, walked as a person would. The layout menu checks exactly
 * one item and says under each what picking it changes.
 */
export function sidebarStateFlowIn(choice, { chat = false, language = 'en' } = {}) {
  const words = SHELL_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(`sidebar-${choice}${chat ? '-chat' : ''}-${name}${language === 'en' ? '' : `-${language}`}`)
    try {
      await keepChoices(page, { 'kuna.sidebar': choice === 'expanded' ? null : choice })
      if (chat) await openTheChat(page, press)
      const drawn = await drawsAsDecided(page, choice, chat ? CHAT_MIN_WIDTH : null)
      await shoot('rest')

      if (drawn.sidebar === 'icons') await iconsSayWhatTheyAre(page, press, language, shoot)
      if (drawn.sidebar === 'hidden') await topBarHoldsTheWayBack(page, press)
      if (drawn.sidebar !== 'drawer') {
        const items = await layoutMenuItems(page, press)
        if (items.filter((item) => item.checked).length !== 1 || !items.find((item) => item.checked)?.text.startsWith(words.sidebarLayout[choice]))
          throw new Error(`the layout menu does not check ${choice} alone: ${JSON.stringify(items)}`)
        menuSaysWhatChanges(items, words, choice, drawn.windowWidth, chat ? CHAT_MIN_WIDTH : null)
        await shoot('menu')
        await closeMenu(page)
      }

      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="app-shell"]', { timeout: 10_000 })
      if (chat) await openTheChat(page, press)
      await drawsAsDecided(page, choice, chat ? CHAT_MIN_WIDTH : null)
    } finally {
      await forgetChoices(page)
    }
  }
}

/**
 * At 1,200 px with Icons and the chat docked, the layout menu warns that Expanded moves the chat into the page's place,
 * and picking it does so at once. Then Icons and Hidden say they move it beside the page, and Icons docks it again.
 */
export function sidebarRoomWarningFlowIn(language = 'en') {
  const words = SHELL_WORDS[language]
  return async (page, { press, shoot }) => {
    const before = page.viewport()
    try {
      await page.setViewport({ ...before, width: 1200 })
      await keepChoices(page, { 'kuna.sidebar': 'icons' })
      await openTheChat(page, press)
      const { windowWidth } = await drawsAsDecided(page, 'icons', CHAT_MIN_WIDTH)
      menuSaysWhatChanges(await layoutMenuItems(page, press), words, 'icons', windowWidth, CHAT_MIN_WIDTH)
      await shoot(`sidebar-room-warning${language === 'en' ? '' : `-${language}`}`)
      await closeMenu(page)
      await pickLayout(page, press, words.sidebarLayout.expanded)
      await drawsAsDecided(page, 'expanded', CHAT_MIN_WIDTH)
      menuSaysWhatChanges(await layoutMenuItems(page, press), words, 'expanded', windowWidth, CHAT_MIN_WIDTH)
      await shoot(`sidebar-room-beside${language === 'en' ? '' : `-${language}`}`)
      await closeMenu(page)
      await pickLayout(page, press, words.sidebarLayout.icons)
      await drawsAsDecided(page, 'icons', CHAT_MIN_WIDTH)
    } finally {
      await forgetChoices(page)
      await page.setViewport(before)
      // The grid's columns ease to the new width, so the check after the flow meets them in place.
      await delay(400)
    }
  }
}

async function handleBox(page) {
  const handle = await page.waitForSelector('[data-testid="chat-resize"]', { timeout: 5_000 })
  const box = await handle.boundingBox()
  return { handle, x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function readHandle(page) {
  return page.evaluate(() => {
    const handle = document.querySelector('[data-testid="chat-resize"]')
    return {
      now: Number(handle.getAttribute('aria-valuenow')),
      max: Number(handle.getAttribute('aria-valuemax')),
      dock: Math.round(document.querySelector('[data-testid="chat-dock"]').getBoundingClientRect().width),
      stored: localStorage.getItem('kuna.chat-width'),
      sidebar: document.querySelector('[data-testid="app-shell"]').dataset.sidebar,
    }
  })
}

async function expectWidth(page, width, how) {
  await delay(300)
  const read = await readHandle(page)
  if (read.now !== width || read.dock !== width) throw new Error(`${how} left the chat at ${JSON.stringify(read)}, not ${width} px`)
  return read
}

/**
 * The chat's edge at 1920 px, on Company's Overview: a drag widens the chat and keeps it on release, a reload keeps it,
 * a double-click resets it, and the keyboard follows the window splitter pattern. At 1440 px the drag stops at the room
 * beside a 640 px page and the sidebar stays expanded.
 */
export function chatResizeFlow() {
  return async (page, { shoot }) => {
    const before = page.viewport()
    try {
      await keepChoices(page, { 'kuna.sidebar': null, 'kuna.chat-width': null })
      await page.evaluate(() => {
        window.location.hash = '#/company?chat=1'
      })
      await page.waitForSelector('[data-testid="chat-dock"]', { visible: true, timeout: 10_000 })
      await expectWidth(page, 384, 'opening the chat')
      await shoot('chat-resize-rest')

      const { x, y } = await handleBox(page)
      await page.mouse.move(x, y)
      await page.mouse.down()
      for (let step = 1; step <= 10; step += 1) await page.mouse.move(x - step * 30, y)
      await delay(100)
      const during = await page.evaluate(() => ({
        resizing: document.documentElement.classList.contains('chat-resizing'),
        cursor: getComputedStyle(document.body).cursor,
        selects: getComputedStyle(document.body).userSelect,
        animates: getComputedStyle(document.querySelector('[data-testid="app-shell"]')).transitionProperty.includes('grid'),
        stored: localStorage.getItem('kuna.chat-width'),
      }))
      if (!during.resizing || during.cursor !== 'col-resize' || during.selects !== 'none' || during.animates || during.stored !== null)
        throw new Error(`during a drag the page is ${JSON.stringify(during)}: it should show col-resize, select nothing, not animate the grid and keep nothing yet`)
      await shoot('chat-resize-dragging')
      await page.mouse.up()
      const dragged = await expectWidth(page, 684, 'a 300 px drag')
      if (dragged.stored !== '684') throw new Error(`the release kept ${dragged.stored}, not 684`)

      await page.reload({ waitUntil: 'networkidle0' })
      await page.waitForSelector('[data-testid="chat-dock"]', { visible: true, timeout: 10_000 })
      await expectWidth(page, 684, 'a reload')
      await shoot('chat-resize-wide')

      const reset = await handleBox(page)
      await page.mouse.click(reset.x, reset.y, { count: 2 })
      const afterReset = await expectWidth(page, 384, 'a double-click')
      if (afterReset.stored !== null) throw new Error(`a reset kept ${afterReset.stored}`)

      await page.focus('[data-testid="chat-resize"]')
      for (let press = 0; press < 3; press += 1) await page.keyboard.press('ArrowLeft')
      await expectWidth(page, 432, 'Left Arrow three times')
      await page.keyboard.down('Shift')
      await page.keyboard.press('ArrowLeft')
      await page.keyboard.up('Shift')
      await expectWidth(page, 496, 'Shift and Left Arrow')
      await page.keyboard.press('ArrowRight')
      await expectWidth(page, 480, 'Right Arrow')
      await page.keyboard.press('End')
      const widest = await readHandle(page)
      await expectWidth(page, widest.max, 'End')
      await page.keyboard.press('Home')
      await expectWidth(page, 384, 'Home')
      await page.keyboard.press('Enter')
      await expectWidth(page, 384, 'Enter')
      await shoot('chat-resize-focused')

      await page.setViewport({ ...before, width: 1440 })
      await delay(300)
      // The room beside the expanded sidebar and a 640 px page: 1440 − 240 − 640 = 560 px where scrollbars float.
      const room = (await shellRoom(page)) - SIDEBAR_WIDTH.expanded - PAGE_LEAST_WIDTH
      const narrow = await handleBox(page)
      await page.mouse.move(narrow.x, narrow.y)
      await page.mouse.down()
      await page.mouse.move(narrow.x - 300, narrow.y)
      await delay(150)
      const held = await readHandle(page)
      if (held.sidebar !== 'expanded' || held.max !== room) throw new Error(`a drag at 1440 px drew ${JSON.stringify(held)}: it should keep the expanded sidebar and stop at ${room} px`)
      await page.mouse.up()
      await expectWidth(page, room, 'a drag at 1440 px')
      await drawsAsDecided(page, 'expanded', room)
    } finally {
      await forgetChoices(page)
      await page.setViewport(before)
      // The grid's columns ease to the new width, so the check after the flow meets them in place.
      await delay(400)
    }
  }
}

/**
 * The window squeezed from 1,920 px to a phone with the expanded sidebar and a chat with one answer and a draft. At each
 * width the shell draws what `layoutOf` decides, on both sides of every edge: the chat leaving the dock for the page's
 * place, the sidebar folding into the drawer and the phone step. The conversation and the draft survive every step, and
 * the columns follow a live resize with no easing.
 */
export function shellSqueezeFlow() {
  const QUESTION = 'How do I set up rules for my bank?'
  const DRAFT = 'And the limits?'
  const asked = CHAT_MIN_WIDTH
  const chosen = 'expanded'
  // Each edge in px of the shell's width, and the width just under it: the dock, the expanded sidebar and the phone.
  const dockFrom = SIDEBAR_WIDTH.expanded + PAGE_LEAST_WIDTH + asked
  const sidebarFrom = SIDEBAR_WIDTH.expanded + PAGE_LEAST_WIDTH
  const edges = [dockFrom, dockFrom - 1, sidebarFrom, sidebarFrom - 1, PAGE_LEAST_WIDTH, PAGE_LEAST_WIDTH - 1]
  const widths = [...new Set([1600, 1390, ...edges, 1100, 1024, 768, 360])].sort((a, b) => b - a)
  return async (page, { press, shoot, inspect }) => {
    const before = page.viewport()
    try {
      await page.setViewport({ ...before, width: 1920 })
      await keepChoices(page, { 'kuna.sidebar': null, 'kuna.chat-width': null })
      await openTheChat(page, press)
      await drawsAsDecided(page, chosen, asked)
      await sendInChat(page, press, QUESTION)
      await allowIfAsked(page, press)
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the chat gave no answer')
      })
      const conversation = () => page.$$eval('[data-testid="chat-question"], [data-testid="chat-answer"]', (lines) => lines.map((line) => line.textContent?.trim() ?? ''))
      const said = await conversation()
      await (await page.waitForSelector('textarea[data-testid="chat-prompt"]')).type(DRAFT)
      // A window past the phone step keeps a classic scrollbar's gutter, so it is that much wider than the shell it lays out.
      const gutter = await scrollbarGutter(page)
      for (const width of widths) {
        await page.setViewport({ ...before, width: width + gutter >= PHONE_BELOW ? width + gutter : width })
        // The browser tells the page of a resize with its next frame.
        const marked = await page
          .waitForFunction(() => document.documentElement.classList.contains('shell-resizing'), { timeout: 1_000, polling: 'raf' })
          .then(() => true)
          .catch(() => false)
        const eases = await page.evaluate(() =>
          getComputedStyle(document.querySelector('[data-testid="app-shell"]'))
            .transitionDuration.split(',')
            .some((duration) => parseFloat(duration) > 0),
        )
        if (!marked || eases) throw new Error(`a live resize to ${width} px ${marked ? 'eased the columns' : 'left the shell unmarked'}`)
        await delay(300)
        const drawn = await drawsAsDecided(page, chosen, asked)
        if (drawn.windowWidth !== width) throw new Error(`a ${width} px shell was laid out in ${drawn.windowWidth} px`)
        if (width === dockFrom || width === dockFrom - 1) await shoot(`shell-squeeze-${width}`)
        const draft = await page.$eval('textarea[data-testid="chat-prompt"]', (prompt) => prompt.value).catch(() => null)
        if (draft !== DRAFT) throw new Error(`at ${width} px the draft reads ${JSON.stringify(draft)}, not ${JSON.stringify(DRAFT)}`)
        const now = await conversation()
        if (now.join('\n') !== said.join('\n')) throw new Error(`at ${width} px the conversation reads ${JSON.stringify(now)}, not ${JSON.stringify(said)}`)
        await inspect?.(`the shell squeezed to ${width} px`)
      }
    } finally {
      await forgetChoices(page)
      await page.setViewport(before)
      await delay(400)
    }
  }
}

const DETAIL_SCREENS = [
  { hash: '#/investments/holding?instrument=fa4e1000-0000-4000-8000-000000000012', under: '/investments/holdings' },
  { hash: '#/loans/bank-loan?loan=fa4e0000-0000-4000-8000-000000000001', under: '/loans' },
  { hash: '#/loans/informal-loan?loan=fa4e0000-0000-4000-8000-000000000006', under: '/loans' },
  { hash: '#/assets/asset?asset=fa4e2000-0000-4000-8000-000000000001', under: '/assets' },
  { hash: '#/spending/account?account=fa4e3000-0000-4000-8000-000000001003', under: '/spending/accounts' },
]

async function litParentIn(page, frame, under) {
  const lit = await page.$$eval(`${frame} a.is-active`, (links) => links.map((link) => ({ href: link.getAttribute('href'), current: link.getAttribute('aria-current') })))
  if (lit.length !== 1 || !lit[0].href?.startsWith(`#${under}`) || lit[0].current !== null) throw new Error(`${frame} lights ${JSON.stringify(lit)}, not ${under} alone without aria-current`)
}

/** Each detail screen lights the menu screen it opens from, in the expanded sidebar, the icon sidebar and the drawer. */
export function menuLitFlow() {
  return async (page, { press, shoot }) => {
    const before = page.viewport()
    try {
      for (const choice of ['expanded', 'icons']) {
        await keepChoices(page, { 'kuna.sidebar': choice === 'expanded' ? null : choice })
        for (const { hash, under } of DETAIL_SCREENS) {
          await page.evaluate((target) => {
            window.location.hash = target
          }, hash)
          await page.waitForFunction((wanted) => window.location.hash.startsWith(wanted), { timeout: 10_000 }, hash.split('?')[0])
          await page.waitForSelector('[data-testid="screen-title"]', { visible: true, timeout: 10_000 })
          await delay(400)
          await litParentIn(page, 'aside', under)
        }
        await shoot(`menu-lit-${choice}`)
      }
      // Under 56 + 640 px even the icons give way to the drawer.
      await page.setViewport({ ...before, width: SIDEBAR_WIDTH.icons + PAGE_LEAST_WIDTH - 1 })
      await delay(300)
      await pressSelector(page, press, '[data-testid="open-navigation"]')
      await page.waitForSelector('[role="dialog"] nav', { visible: true, timeout: 5_000 })
      await delay(400)
      await litParentIn(page, '[role="dialog"]', DETAIL_SCREENS.at(-1).under)
      await shoot('menu-lit-drawer')
      await page.keyboard.press('Escape')
    } finally {
      await forgetChoices(page)
      await page.setViewport(before)
      // The grid's columns ease to the new width, so the check after the flow meets them in place.
      await delay(400)
    }
  }
}

/** The first Tab reaches the skip link, which shows, and Enter takes focus to the screen's title, or to the chat's prompt while the chat holds the page. */
export function skipLinkFlow() {
  return async (page, { shoot }) => {
    try {
      await page.keyboard.press('Tab')
      const shown = await page.evaluate(() => {
        const link = document.activeElement
        return { skip: link?.dataset.testid === 'skip-link', width: link?.getBoundingClientRect().width ?? 0 }
      })
      if (!shown.skip || shown.width < 40) throw new Error(`the first Tab gave ${JSON.stringify(shown)}, not a visible skip link`)
      await shoot('skip-link')
      await page.keyboard.press('Enter')
      await delay(200)
      if (!(await page.evaluate(() => document.activeElement?.classList.contains('screen-title')))) throw new Error("the skip link did not focus the screen's title")

      await keepChoices(page, {})
      await page.evaluate(() => {
        window.location.hash = `${window.location.hash.split('?')[0]}?chat=1`
      })
      await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
      const inPane = (await page.$('[data-testid="chat-pane"]')) !== null
      await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
      await page.focus('[data-testid="skip-link"]')
      await page.keyboard.press('Enter')
      await delay(200)
      const focused = await page.evaluate(() =>
        document.activeElement?.tagName === 'TEXTAREA' ? 'prompt' : document.activeElement?.classList.contains('screen-title') ? 'title' : document.activeElement?.tagName,
      )
      if (focused !== (inPane ? 'prompt' : 'title')) throw new Error(`with the chat ${inPane ? 'in the page' : 'docked'} the skip link focused ${focused}`)
    } finally {
      await forgetChoices(page)
    }
  }
}

/** The key the app reads as Cmd on macOS and Ctrl elsewhere, as Nuxt UI's shortcuts do. */
async function commandKey(page) {
  return (await page.evaluate(() => /Mac|iPod|iPhone|iPad/.test(navigator.platform))) ? 'Meta' : 'Control'
}

export async function pressJumpKey(page) {
  const key = await commandKey(page)
  await page.keyboard.down(key)
  await page.keyboard.press('k')
  await page.keyboard.up(key)
  await delay(300)
}

/**
 * Cmd+K or Ctrl+K opens Jump to a page, from a field too. Rows are grouped by app and found by its name, Enter jumps,
 * Escape gives focus back, the chat has a row, and the key does nothing while another dialog is open or on a phone.
 */
export function quickJumpFlowIn(language = 'en') {
  const words = SHELL_WORDS[language]
  return async (page, { press, shoot }) => {
    const phone = await page.evaluate(() => window.innerWidth < 640)
    try {
      await keepChoices(page, {})
      if (phone) {
        await pressJumpKey(page)
        if (await page.$('[data-testid="quick-jump"]')) throw new Error('the jump key opened the list on a phone')
        return
      }
      await pressJumpKey(page)
      await page.waitForSelector('[data-testid="quick-jump"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the jump key did not open Jump to a page')
      })
      const title = await page.$eval('[role="dialog"] h2', (heading) => heading.textContent?.trim())
      if (title !== words.quickJump.title) throw new Error(`the list is titled ${title}`)
      await page.keyboard.type(language === 'en' ? 'transactions company' : 'transakcije tvrtka', { delay: 20 })
      await delay(500)
      const found = await page.$$eval('[data-testid="quick-jump"] [role="option"]', (rows) => rows.map((row) => row.textContent?.trim()))
      if (found.length === 0) throw new Error('searching by a page and its app found nothing')
      await shoot(`quick-jump${language === 'en' ? '' : `-${language}`}`)
      await page.keyboard.press('Enter')
      await page
        .waitForFunction(() => window.location.hash.startsWith('#/company/transactions'), { timeout: 5_000 })
        .catch(async () => {
          throw new Error(`Enter on ${found[0]} did not open Company's transactions, but ${await page.evaluate(() => window.location.hash)}`)
        })
      await page.waitForSelector('[data-testid="quick-jump"]', { hidden: true, timeout: 5_000 })

      const opener = await pressSelector(page, press, '[data-testid="quick-jump-open"]')
      await page.waitForSelector('[data-testid="quick-jump"]', { visible: true, timeout: 5_000 })
      await page.keyboard.type(language === 'en' ? 'open the chat' : 'otvori razgovor', { delay: 20 })
      await delay(400)
      const chatRow = await page.$$eval('[data-testid="quick-jump"] [role="option"]', (rows) => rows[0]?.textContent?.trim() ?? '')
      if (!chatRow.includes(words.quickJump.openChat)) throw new Error(`the chat's row is not first: ${chatRow}`)
      await page.keyboard.press('Escape')
      await page.waitForSelector('[data-testid="quick-jump"]', { hidden: true, timeout: 5_000 })
      await delay(200)
      if (!(await opener.evaluate((button) => document.activeElement === button))) throw new Error('Escape did not give focus back to the Jump to a page button')

      await openTheChat(page, press)
      await page.focus('textarea[data-testid="chat-prompt"]')
      await pressJumpKey(page)
      await page.waitForSelector('[data-testid="quick-jump"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error("the jump key did nothing from the chat's prompt")
      })
      await page.keyboard.press('Escape')
      await page.waitForSelector('[data-testid="quick-jump"]', { hidden: true, timeout: 5_000 })

      const before = page.viewport()
      await page.setViewport({ ...before, width: 800 })
      await delay(300)
      await pressSelector(page, press, '[data-testid="open-navigation"]')
      await page.waitForSelector('[role="dialog"] nav', { visible: true, timeout: 5_000 })
      await pressJumpKey(page)
      if (await page.$('[data-testid="quick-jump"]')) throw new Error('the jump key opened the list over the open drawer')
      await page.keyboard.press('Escape')
      await page.setViewport(before)
      await delay(400)
    } finally {
      await forgetChoices(page)
    }
  }
}
