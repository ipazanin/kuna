/**
 * The shell's own flows that the visual, touch and Firefox checks share: the three sidebar states with and without the
 * docked chat, the layout menu's notes, the theme and language menu, the chat's edge, the window squeezed from wide to a phone, the lit parent of a
 * detail screen, the skip link and Jump to a page, the app menus, the home and its set-up, Kuna's welcome, the assistant's
 * keys, files sent to the chat and deleting Kuna. `press` clicks or taps an element handle. A failure throws with what was wrong.
 */

import { en as appEnglish, hr as appCroatian } from '../../src/shared/app/words.ts'
import { FAKE_HOME_LOAN, FAKE_CAR_LOAN } from '../../src/shared/storage/infrastructure/fake/fakeLoanKeys.ts'
import { CHAT_MIN_WIDTH } from '../../src/shared/ai/presentation/chatDock.ts'
import { PAGE_LEAST_WIDTH, PHONE_BELOW } from '../../src/shared/layout/viewport.ts'
import { layoutOf, roomEffectOf, SIDEBAR_WIDTH, FOOTER_FOLDS_BELOW_HEIGHT } from '../../src/shell/ui/sidebarLayout.ts'
import { en as shellEnglish, hr as shellCroatian } from '../../src/shell/ui/words.ts'
import { allowIfAsked, MADE_UP_ANTHROPIC_KEY, sendInChat, TWO_KEYS_ANONYMISE_OFF, forgetAssist, keepAiKey, openChat } from './chatFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'
import { en as kunaSettingsEnglish, hr as kunaSettingsCroatian } from '../../src/shell/settings/words.ts'
import {
  ALWAYS_ALLOW,
  APP_ALLOWED,
  ASSETS,
  ASSIST_WORDS,
  CHAT_CONSENT,
  COMPANY_SELECT,
  DELETE_WORDS,
  INVESTMENTS,
  LOANS,
  SCREEN_WORDS,
  SPENDING,
  TOAST,
  attachToChat,
  checkboxState,
  choose,
  chooseOption,
  dialogGone,
  dismissToasts,
  elementSays,
  exactly,
  failureInView,
  firstRunAt,
  goToRoute,
  googleGrants,
  homeCards,
  homeMenu,
  inKunaFolder,
  menuShown,
  onboardingAt,
  openCompanies,
  openMenu,
  pickCompany,
  pressButton,
  restoreGoogleGrants,
  screenTitled,
  shootAt,
  sidebarMatchesCards,
  switchSays,
  toast,
  toastMatching,
} from './flowHelpers.mjs'

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

/** Opens the menu of `control`, from the drawer when the sidebar is hidden, and returns each item's name, description and whether it is checked, leaving it open. */
async function menuItems(page, press, control) {
  const shown = await page.evaluate((testId) => [...document.querySelectorAll(`[data-testid="${testId}"]`)].some((button) => button.getClientRects().length > 0), control)
  if (!shown) {
    await pressSelector(page, press, '[data-testid="open-navigation"]')
    await page.waitForSelector(`[role="dialog"] [data-testid="${control}"]`, { visible: true, timeout: 5_000 })
    await delay(300)
  }
  await pressSelector(page, press, `[data-testid="${control}"]`)
  await page.waitForSelector('[role="menuitemcheckbox"]', { visible: true, timeout: 5_000 })
  await delay(200)
  const items = await page.$$eval('[role="menuitemcheckbox"]', (rows) => rows.map((row) => ({ text: row.textContent?.trim() ?? '', checked: row.getAttribute('aria-checked') === 'true' })))
  return items
}

function layoutMenuItems(page, press) {
  return menuItems(page, press, 'sidebar-layout')
}

/** Fails unless the theme and language menu names both settings in force and checks System under Theme and Browser language under Language, as a fresh device has them. */
async function themeAndLanguageSaysWhatIsInForce(page, press, words) {
  const items = await menuItems(page, press, 'theme-and-language')
  const named = await page.evaluate(() => [...document.querySelectorAll('[data-testid="theme-and-language"]')].find((button) => button.getClientRects().length > 0)?.getAttribute('aria-label'))
  const { themes, languages } = words.themeAndLanguage
  if (named !== words.themeAndLanguage.name(themes.system, languages.browser)) throw new Error(`the theme and language button is named ${JSON.stringify(named)}, not the settings in force`)
  const checked = items.filter((item) => item.checked).map((item) => item.text)
  if (items.length !== 6 || checked.length !== 2 || !checked[0].startsWith(themes.system) || !checked[1].startsWith(languages.browser))
    throw new Error(`the theme and language menu does not check System and Browser language alone: ${JSON.stringify(items)}`)
  const labels = await page.$$eval('[role="menu"] [data-slot="label"]', (shown) =>
    shown.map((label) => [label.querySelector('[data-slot="itemLabel"]')?.textContent?.trim(), label.querySelector('[data-slot="itemDescription"]')?.textContent?.trim() ?? null]),
  )
  const grouped = [
    [words.themeAndLanguage.theme, null],
    [words.themeAndLanguage.language, words.themeAndLanguage.reloads],
  ]
  if (JSON.stringify(labels) !== JSON.stringify(grouped))
    throw new Error(`the theme and language menu is not grouped under its two labels, with the reload note under Language alone: ${JSON.stringify(labels)}`)
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

/** The hidden sidebar: the top bar holds only the menu button, whose drawer starts with the layout menu and the theme and language menu and ends with the footer. */
async function topBarHoldsTheWayBack(page, press) {
  for (const control of ['sidebar-layout', 'theme-and-language', 'quick-jump-open']) {
    if (await page.$(`header [data-testid="${control}"]`)) throw new Error(`the top bar of the hidden sidebar holds ${control}, beside the menu button`)
  }
  await pressSelector(page, press, '[data-testid="open-navigation"]')
  await page.waitForSelector('[role="dialog"] [data-testid="company-footer"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('the drawer does not end with the footer')
  })
  const atTop = await page.evaluate(() => {
    const nav = document.querySelector('[role="dialog"] nav')?.getBoundingClientRect()
    return ['sidebar-layout', 'theme-and-language'].every((control) => {
      const button = document.querySelector(`[role="dialog"] [data-testid="${control}"]`)?.getBoundingClientRect()
      return button !== undefined && nav !== undefined && button.bottom <= nav.top + 1
    })
  })
  if (!atTop) throw new Error('the drawer of the hidden sidebar does not start with the layout menu and the theme and language menu')
  await delay(300)
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
}

/**
 * One sidebar choice at this width, with the chat open or not, walked as a person would. The layout menu checks exactly
 * one item and says under each what picking it changes, and the theme and language menu checks one item under each label.
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
      await themeAndLanguageSaysWhatIsInForce(page, press, words)
      await shoot('theme-and-language')
      await closeMenu(page)

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
  { hash: `#/loans/bank-loan?loan=${FAKE_HOME_LOAN}`, under: '/loans' },
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

/**
 * Net worth's debt ring with two loans of one name: a click on each of the two slices that share the name opens that slice's own
 * loan, the home loan for the first and the car loan for the second, never the first loan of that name for both.
 */
export async function twinDebtSlicesFlow(page, { shoot, inspect }) {
  const canvas = await page.waitForSelector('[data-testid="overview-ring"][data-side="owes"] .ring-chart canvas', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Net worth shows no ring of what you owe')
  })
  await delay(800)
  await canvas.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(300)
  const box = await canvas.boundingBox()
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const radius = (Math.min(box.width, box.height) / 2) * 0.83
  const pointAt = (degrees) => ({ x: centre.x + radius * Math.sin((degrees * Math.PI) / 180), y: centre.y - radius * Math.cos((degrees * Math.PI) / 180) })
  const tooltipText = () =>
    page.$eval(
      '[data-testid="overview-ring"][data-side="owes"] .ring-chart',
      (element) =>
        [...element.querySelectorAll('div')]
          .filter((part) => part.querySelector('canvas') === null && getComputedStyle(part).display !== 'none' && getComputedStyle(part).opacity !== '0')
          .map((part) => part.textContent?.trim() ?? '')
          .find((text) => text !== '') ?? '',
    )
  // The ring starts at the top and runs clockwise, so a sweep of the pointer finds each slice as a run of angles under one tooltip.
  const runs = []
  for (let degrees = 2; degrees < 360; degrees += 4) {
    const point = pointAt(degrees)
    await page.mouse.move(point.x, point.y)
    await delay(60)
    const text = await tooltipText()
    const last = runs[runs.length - 1]
    if (last !== undefined && last.text === text) last.to = degrees
    else runs.push({ text, from: degrees, to: degrees })
  }
  const twins = runs.filter((run) => run.text.startsWith('Home loan'))
  if (new Set(twins.map((run) => run.text)).size !== 2) throw new Error(`the debt ring does not show two slices named Home loan, the pointer found: ${runs.map((run) => run.text).join(' | ')}`)
  await inspect?.('the debt ring with two slices of one name')
  await shoot('twin-debt-slices')
  const opened = []
  for (const run of twins) {
    const point = pointAt((run.from + run.to) / 2)
    await page.mouse.click(point.x, point.y)
    await page
      .waitForFunction(() => !window.location.hash.startsWith('#/overview'), { timeout: 5_000 })
      .catch(() => {
        throw new Error(`a click on the slice "${run.text}" opened nothing`)
      })
    opened.push(await page.evaluate(() => window.location.hash))
    await page.goBack()
    await page.waitForSelector('[data-testid="overview-ring"][data-side="owes"] .ring-chart canvas', { visible: true, timeout: 10_000 })
    await delay(800)
  }
  if (!opened[0]?.includes(FAKE_HOME_LOAN) || !opened[1]?.includes(FAKE_CAR_LOAN)) {
    throw new Error(`the two slices named Home loan open ${opened.join(' and ')}, not the home loan and then the car loan`)
  }
}

/**
 * The one start on the home of a new device: the welcome shows in place of the cards, picks Loans and Assets and suggests their order, and goes on
 * only with an app picked. Saying Drive makes nothing. The cards then lead the picked apps, the others wait under them, and Assets asks no storage
 * question: its folder step names its subfolder of the new Kuna folder, and Loans' names the same folder without offering to put it elsewhere.
 * Kuna settings says where new files go, and asks again.
 */
export function kunaWelcomeFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a new device shows no welcome on the home')
    })
    if (await page.$('[data-testid="home-card"]')) throw new Error('the welcome shows beside the cards')
    if (!(await page.$eval('[data-testid="kuna-welcome-continue"]', (button) => button.disabled))) throw new Error('the welcome goes on with no app picked')
    await kunaSettingsInMenu(page, press, 'the welcome')
    await inspect?.('the welcome')
    await shoot('kuna-welcome')
    await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', words.loans)
    await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', words.assetsApp)
    await page.waitForSelector('[data-testid="kuna-welcome-order"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the welcome does not suggest Loans before Assets')
    })
    await inspect?.('the welcome with its order line')
    await shoot('kuna-welcome-picked')
    await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
    await page.waitForSelector('[data-testid="home-other-cards"] [data-testid="home-card"][data-app="company"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('an app left out does not wait under the others')
    })
    if ((await page.evaluate(homeMenu)) !== null) {
      if ((await page.evaluate(menuShown)).apps.length !== 0) throw new Error('the sidebar lists an app with no file')
      await pressSelector(page, press, '[data-testid="nav-add-app"]')
      const focused = await page.evaluate(() => document.activeElement?.closest('[data-testid="home-card"]')?.dataset.app)
      if (focused !== 'loans') throw new Error(`Add an app moved focus to ${focused}, not the first picked app in Set up`)
    }
    await inspect?.('the home after the welcome')
    await shoot('kuna-welcome-answered')
    await pressSelector(page, press, '[data-testid="home-card"][data-app="assets"]')
    await firstRunAt(page, ASSETS, 'folder')
    const assetsConfirm = await page.waitForSelector('[data-testid="assets-start-folder-confirm"]', { visible: true, timeout: 10_000 })
    const said = await assetsConfirm.evaluate((element) => element.textContent ?? '')
    if (!said.includes(inKunaFolder(words, 'assets'))) throw new Error(`the Assets folder step says "${said}"`)
    if (await page.$('[data-testid="onboarding-back"]')) throw new Error('the folder step of someone who answered goes back to a question')
    if (!(await page.$('[data-testid="assets-start-open-existing"]'))) throw new Error('the folder step offers no way to open a file the person already has')
    await inspect?.('the Assets folder step after the welcome')
    await shoot('kuna-welcome-assets')
    await pressSelector(page, press, '[data-testid="assets-start-open-existing"]')
    await firstRunAt(page, ASSETS, 'find')
    await pressSelector(page, press, '[data-testid="onboarding-back"]')
    await firstRunAt(page, ASSETS, 'folder')
    await pressSelector(page, press, '[data-testid="assets-start-create"]')
    await toastMatching(page, exactly(words.writes.firstRun.folder.created('kuna-assets.json', inKunaFolder(words, 'assets'))))
    await firstRunAt(page, ASSETS, 'overview')
    await dismissToasts(page)
    if ((await page.evaluate(homeMenu)) !== null) {
      const listed = (await page.evaluate(menuShown)).apps
      if (JSON.stringify(listed) !== JSON.stringify(['assets'])) throw new Error(`with one file the sidebar lists ${listed.join()}, not Assets alone, whichever list the others wait in`)
    }
    await page.evaluate(() => {
      window.location.hash = '#/loans/start'
    })
    await firstRunAt(page, LOANS, 'folder')
    await page.waitForFunction((wanted) => document.querySelector('[data-testid="loans-start-folder-confirm"]')?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, `Kuna › loans`)
    if (await page.$('[data-testid="loans-start-elsewhere"]')) throw new Error('a Kuna folder that exists is offered a new place')
    await page.evaluate(() => {
      window.location.hash = '#/settings'
    })
    const card = await page.waitForSelector('[data-testid="files-home-answer"]', { visible: true, timeout: 10_000 })
    if ((await card.evaluate((element) => element.textContent ?? '')) !== words.filesHome.onDrive) throw new Error('Kuna settings does not say where new files go')
    if (!(await page.$('[data-testid="assist-key-steps"]'))) throw new Error('Kuna settings does not offer the assistant after Not now')
    if (await page.$('[data-testid="chat-open"]')) throw new Error('the chat shows after Not now')
    await inspect?.('Kuna settings with the answer')
    await shoot('kuna-welcome-settings')
    await pressSelector(page, press, '[data-testid="files-home-ask-again"]')
    await toastMatching(page, exactly(words.filesHome.askedAgain))
    if (await page.$('[data-testid="files-home-card"]')) throw new Error('Ask me again leaves the answer on Kuna settings')
    await pressButton(page, press, `${TOAST} button`, words.filesHome.undo)
    await page.waitForSelector('[data-testid="files-home-card"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Undo on the Ask me again toast did not bring the answer back')
    })
  }
}

export const kunaWelcomeFlow = kunaWelcomeFlowIn('en')

/** Saying this browser at the welcome: the app's first run asks nothing, says where the file goes, and one tap makes it. */
export function kunaWelcomeBrowserFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 })
    await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', words.loans)
    await pressButton(page, press, '[data-testid="kuna-welcome-home"] label', words.home.welcome.browser)
    await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
    await pressSelector(page, press, '[data-testid="home-card"][data-app="loans"]')
    await firstRunAt(page, LOANS, 'home')
    await page.waitForSelector('[data-testid="loans-start-in-browser"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the first run of someone who said this browser does not say so')
    })
    if (await page.$('[data-testid="loans-start-home"]')) throw new Error('the first run asks where the file lives again')
    await inspect?.('the Loans first run after this browser')
    await shoot('kuna-welcome-browser')
    await pressSelector(page, press, '[data-testid="loans-start-continue"]')
    await firstRunAt(page, LOANS, 'overview')
  }
}

export const kunaWelcomeBrowserFlow = kunaWelcomeBrowserFlowIn('en')

/**
 * All of Kuna with Investments a file someone shared (`?investments=given`) and the company unticked: Drive refuses the bin, what failed comes first and in
 * view, and the company's rows stay unticked, so a retry would bin nothing the person kept.
 */
export function deleteKunaFailsFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="delete-kuna"]')
    await page.waitForSelector('[data-testid="delete-data-drive-company"]', { visible: true, timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="delete-data-drive-company"]')
    await pressSelector(page, press, '[data-testid="delete-data-copy-company"]')
    await page.type('[data-testid="delete-kuna-name"]', 'Kuna')
    await pressSelector(page, press, '[data-testid="delete-kuna-confirm"]')
    await page.waitForSelector('[data-testid="delete-kuna-failed"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a refused bin in all of Kuna does not say so')
    })
    await delay(300)
    await failureInView(page, 'delete-kuna-failed')
    if ((await checkboxState(page, 'delete-data-drive-company')).checked || (await checkboxState(page, 'delete-data-copy-company')).checked)
      throw new Error('a failure ticked again what the person unticked')
    await inspect?.('all of Kuna after a refused bin')
    await shoot('delete-kuna-fails')
    await pressSelector(page, press, '[data-testid="delete-kuna-cancel"]')
    await dialogGone(page, '[data-testid="delete-kuna-dialog"]')
  }
}

/**
 * Kuna settings with the company on the fake Drive and Investments in this browser: Delete all of Kuna lists both with what they share, the keys in
 * the Google account and the backups unticked, and Delete stays off until the name is typed. Once confirmed with the backups ticked, every app is on its first run, the home welcomes again, and only the file Kuna did not make is left in the backups folder.
 */
export function deleteKunaFlowIn(language) {
  const words = language === 'hr' ? kunaSettingsCroatian : kunaSettingsEnglish
  const text = words.deleteData.all
  const storage = DELETE_WORDS[language]
  // Node picks plural forms by English rules, and the page by the language's.
  const twoBackups = storage.backupsCounted(2)
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const grants = await googleGrants(page)
    await pressSelector(page, press, '[data-testid="delete-kuna"]')
    await elementSays(page, '[data-testid="delete-kuna-dialog"]', [text.googleKeys, text.browserSettings, text.stays], 'the delete of all of Kuna does not list what the apps share')
    await delay(300)
    for (const app of ['company', 'investments']) {
      if ((await page.$(`[data-testid="delete-data-${app}"]`)) === null) throw new Error(`the delete of all of Kuna does not list ${app}`)
    }
    if ((await checkboxState(page, 'delete-kuna-google-keys')).checked) throw new Error('the keys in the Google account start ticked, and they go for good')
    if ((await checkboxState(page, 'delete-data-backups-company')).checked) throw new Error('the backups start ticked')
    if ((await checkboxState(page, 'delete-data-copy-investments')).checked) throw new Error('a file kept only in this browser starts ticked')
    await elementSays(page, '[data-testid="delete-kuna-dialog"]', [twoBackups.few ?? twoBackups.other, storage.backupsStay, text.googleKeysStay], 'the unticked rows do not say what stays')
    if (!(await page.$eval('[data-testid="delete-kuna-confirm"]', (button) => button.disabled))) throw new Error('Delete can be pressed before the name is typed')
    await inspect?.('the delete of all of Kuna asking first')
    await shoot('delete-kuna')
    await page.type('[data-testid="delete-kuna-name"]', 'Kun')
    if (!(await page.$eval('[data-testid="delete-kuna-confirm"]', (button) => button.disabled))) throw new Error('Delete can be pressed on part of the name')
    await page.type('[data-testid="delete-kuna-name"]', 'a')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="delete-kuna-confirm"]')?.disabled === false, { timeout: 5_000 })
      .catch(() => {
        throw new Error('typing the name does not let Delete be pressed')
      })
    await pressSelector(page, press, '[data-testid="delete-data-backups-company"]')
    await elementSays(page, '[data-testid="delete-kuna-dialog"]', [storage.backupsGo], 'ticking the backups does not say they go')
    await pressSelector(page, press, '[data-testid="delete-data-copy-investments"]')
    await shoot('delete-kuna-typed')
    await pressSelector(page, press, '[data-testid="delete-kuna-confirm"]')
    await toastMatching(page, exactly(text.deleted))
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('deleting all of Kuna does not land on the home welcome')
    })
    const left = await page.evaluate(() => Object.keys(localStorage).filter((name) => name.startsWith('kuna.workbook-file.')))
    if (left.length > 0) throw new Error(`this browser still names ${left.join(', ')} after the delete`)
    const backupsLeft = await page.evaluate(() => window.kunaFakeBackupsLeft())
    if (backupsLeft.join() !== 'my-notes.json') throw new Error(`the backups folder holds ${backupsLeft.join(', ') || 'nothing'}, not only the file Kuna did not make`)
    await inspect?.('the home after deleting all of Kuna')
    await shoot('delete-kuna-done')
    await dismissToasts(page)
    await restoreGoogleGrants(page, grants)
  }
}

/** Assets set up in a second tab reach this one without a reload: the home card stops offering Set up and the menu lists the app. */
export async function setUpInOtherTabFlow(page, { shoot, inspect }) {
  const words = SCREEN_WORDS.en
  const card = (state) => `[data-testid="home-card"][data-app="assets"][data-state="${state}"]`
  await page.evaluate(() => {
    window.location.hash = '#/'
  })
  await page.waitForSelector(card('set-up'), { visible: true, timeout: 10_000 })
  const otherTab = await page.browserContext().newPage()
  try {
    await otherTab.goto(page.url().replace(/#.*$/, '#/assets'), { waitUntil: 'networkidle0' })
    await firstRunAt(otherTab, ASSETS, 'home')
    const clickIt = (element) => element.click()
    await chooseOption(otherTab, clickIt, 'assets-start-home', words.writes.firstRun.home.browser)
    await pressSelector(otherTab, clickIt, '[data-testid="assets-start-continue"]')
    await firstRunAt(otherTab, ASSETS, 'overview')
  } finally {
    await otherTab.close()
  }
  await page.bringToFront()
  await page.waitForSelector(card('open'), { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the home card still offers Set up after the other tab set Assets up')
  })
  const hasMenu = await page.$('[data-testid="nav-apps"]')
  if (hasMenu !== null && (await page.$('[data-testid="nav-app"][data-app="assets"]')) === null) throw new Error('the menu does not list Assets after the other tab set it up')
  await inspect?.('the home after a second tab set Assets up')
  await shoot('set-up-in-other-tab')
}

/** Checks that the sidebar or the drawer holds Kuna settings, and closes the drawer again. */
async function kunaSettingsInMenu(page, press, where) {
  await openMenu(page, press)
  if (!(await page.$('aside [data-testid="nav-kuna-settings"], [role="dialog"] [data-testid="nav-kuna-settings"]'))) throw new Error(`${where} leaves no way to Kuna settings`)
  if (await page.$('[role="dialog"]')) {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
  }
}

/** The menu opens with the link home in one row, its Kuna mark in line with the app tiles and its whole block named as the words say. */
function homeLinkLeads(menu, words, where) {
  const home = menu.home
  if (home === null || home.name !== words.homeLink || home.tooltip !== words.homeLink || home.shown !== 'Kuna' || !home.first)
    throw new Error(`${where} does not start with the link home named ${words.homeLink}: ${JSON.stringify(home)}`)
  if (!home.inLine) throw new Error(`the Kuna mark in ${where} is not in line with the app tiles: ${JSON.stringify(home)}`)
  if (!menu.ruled) throw new Error(`no line runs under the link home in ${where}`)
}

/** The menu holds the apps in use and one is open: Home and Net worth over them, Add an app and Kuna settings under them, and the open app's name heavier, in line with its pages' names and without its own count. */
function appLeadsItsPages(menu, app, listed, words) {
  if (menu.groups !== 1 || menu.name !== app) throw new Error(`the menu opens ${menu.groups} apps, the first ${menu.name}, instead of ${app} alone`)
  if (menu.expanded !== 'true') throw new Error(`the arrow of the open ${app} reads aria-expanded ${menu.expanded}`)
  if (!menu.heavier) throw new Error(`the name of the open ${app} is no heavier than a closed app's`)
  if (!menu.linedUp) throw new Error(`the name of ${app} is not in line with its pages' names`)
  if (menu.drawerArrows.some((side) => side < 44)) throw new Error(`an arrow in the drawer is only ${Math.min(...menu.drawerArrows)} px, where a thumb presses it`)
  if (menu.countOnOpenRow) throw new Error(`the open ${app} shows a count on its row and on its page`)
  if (JSON.stringify(menu.apps) !== JSON.stringify(listed)) throw new Error(`the ${app} menu lists the apps ${menu.apps.join(', ')}, not ${listed.join(', ')}`)
  if (menu.homeEntry !== words.homeTitle || menu.netWorth !== words.netWorth || menu.kunaSettings !== words.kunaSettings || menu.addApp !== words.addApp)
    throw new Error(`the ${app} menu shows ${menu.homeEntry}, ${menu.netWorth}, ${menu.addApp} and ${menu.kunaSettings} around the apps`)
}

/** Takes the link home from the sidebar or the drawer, to the home with every app. */
async function goHome(page, press, words = SCREEN_WORDS.en) {
  await openMenu(page, press)
  await pressSelector(page, press, '[data-testid="home-link"]')
  await screenTitled(page, words.homeTitle)
}

/** The count on each closed app's row in the sidebar, for the apps that show one. */
function closedRowCounts() {
  return Object.fromEntries(
    [...document.querySelectorAll('aside [data-testid="nav-app-link"]:has([data-testid="nav-count"])')].map((link) => [
      link.dataset.app,
      link.querySelector('[data-testid="nav-count"]')?.textContent?.trim(),
    ]),
  )
}

/**
 * The one menu, in the sidebar or the drawer: the Kuna mark first in one row as the link home, named Kuna, Home, with
 * a line under it, Home, Net worth, the apps with a file with Loans open and its Overview, Scenarios and Settings under it, then Add an
 * app and Kuna settings. The arrow on Company shows Company's pages in place of Loans' without leaving the screen, and shows them no
 * more when pressed again, and a press on the row of Loans opens its pages again, closing the drawer. The link home shows the home, with no app open, and the phone's top bar there has its menu button like any screen.
 * From the home, Company opens, whose Transactions item opens its To review tab while rows wait.
 */
export function appMenuFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot, inspect }) => {
    await openMenu(page, press)
    const loans = await page.evaluate(menuShown)
    homeLinkLeads(loans, words, 'the Loans menu')
    appLeadsItsPages(loans, words.loans, ['company', 'loans'], words)
    if (loans.subtitle !== null) throw new Error(`Loans shows "${loans.subtitle}" under its name`)
    if (JSON.stringify(loans.entries) !== JSON.stringify([words.overview, words.scenarios, words.loansSettings]) || loans.current !== words.overview)
      throw new Error(`Loans lists ${loans.entries.join(', ')} with ${loans.current} marked`)
    const loansTitle = await page.title()
    if (loansTitle !== `${words.overview}, ${words.loans} – Kuna`) throw new Error(`the browser tab says "${loansTitle}"`)
    await inspect?.('the Loans menu')
    await shoot(language === 'en' ? 'app-menu-loans' : `app-menu-loans-${language}`)

    const companyArrow = '[data-testid="nav-arrow"][data-app="company"]'
    await pressSelector(page, press, companyArrow)
    await delay(300)
    const peek = await page.evaluate(menuShown)
    if (peek.groups !== 1 || peek.name !== words.company) throw new Error(`the arrow on Company opens ${peek.groups} apps, the first ${peek.name}`)
    if ((await page.evaluate(() => window.location.hash)) !== '#/loans' || (await page.title()) !== loansTitle) throw new Error('the arrow on Company left the screen')
    await inspect?.('a peek at Company from Loans')
    await pressSelector(page, press, companyArrow)
    await delay(300)
    if ((await page.evaluate(menuShown)).groups !== 0) throw new Error('the arrow on Company did not close its pages')
    await pressSelector(page, press, '[data-testid="nav-app-link"][data-app="loans"]')
    await delay(500)
    // In the drawer the press also closes it, since Loans is already on screen.
    if ((await page.$('[role="dialog"]')) !== null) throw new Error('a press on the row of the Loans on screen left the drawer open')
    await openMenu(page, press)
    const backOnLoans = await page.evaluate(menuShown)
    if (backOnLoans.groups !== 1 || backOnLoans.name !== words.loans) throw new Error(`a press on the row of the Loans on screen left ${backOnLoans.groups} apps open`)

    await pressSelector(page, press, '[data-testid="home-link"]')
    await screenTitled(page, words.homeTitle)
    const homeTitle = await page.title()
    if (homeTitle !== 'Kuna') throw new Error(`the browser tab on the home says "${homeTitle}"`)
    const bar = await page.evaluate(() => ({
      menuButton: document.querySelector('[data-testid="open-navigation"]')?.getClientRects().length > 0,
      sidebar: document.querySelector('aside') !== null,
      topBar: document.querySelector('[data-testid="top-bar-title"]')?.textContent?.trim() ?? null,
      settings: [...document.querySelectorAll('aside [data-testid="nav-net-worth"], aside [data-testid="nav-kuna-settings"]')]
        .filter((link) => link.getClientRects().length > 0)
        .map((link) => link.textContent?.trim()),
    }))
    if (bar.menuButton === bar.sidebar) throw new Error(`the home has ${bar.sidebar ? 'a sidebar and a menu button' : 'neither a sidebar nor a menu button'}`)
    if (!bar.sidebar && bar.topBar !== null && bar.topBar !== 'Kuna') throw new Error(`the phone top bar on the home says "${bar.topBar}"`)
    const around = bar.sidebar ? [words.netWorth, words.kunaSettings] : []
    if (JSON.stringify(bar.settings) !== JSON.stringify(around)) throw new Error(`the home offers ${JSON.stringify(bar.settings)} instead of ${JSON.stringify(around)}`)
    if (bar.sidebar) {
      // Loans' pages take 200 ms to close and stay in the page until then.
      await delay(300)
      const home = await page.evaluate(menuShown)
      if (home.groups !== 0) throw new Error("the sidebar on the home shows an app's pages")
      homeLinkLeads(home, words, "the home's sidebar")
      if (!home.homeEntryCurrent) throw new Error(`the sidebar on the home does not mark ${words.homeTitle} as the current page`)
      sidebarMatchesCards(await page.evaluate(homeMenu), await page.evaluate(homeCards), words)
    }
    await inspect?.('the home')

    await pressSelector(page, press, '[data-testid="home-card"][data-app="company"]')
    await screenTitled(page, words.companyOverview)
    await openMenu(page, press)
    const company = await page.evaluate(menuShown)
    homeLinkLeads(company, words, 'the Company menu')
    appLeadsItsPages(company, words.company, ['company', 'loans'], words)
    if (!company.entries.includes(words.companyOverview) || !company.entries.some((entry) => entry.startsWith(words.transactions.title)) || company.entries.at(-1) !== words.companySettings)
      throw new Error(`Company lists ${company.entries.join(', ')}`)
    const companyTitle = await page.title()
    if (companyTitle !== `${words.companyOverview}, ${words.company} – Kuna`) throw new Error(`the browser tab says "${companyTitle}"`)
    await inspect?.('the Company menu')
    await shoot(language === 'en' ? 'app-menu-company' : `app-menu-company-${language}`)

    // The fake books hold rows that wait, so the counted item opens their queue.
    const counted = '[data-testid="nav-entries"] a:has([data-testid="nav-count"])'
    await pressSelector(page, press, `[role="dialog"] ${counted}, aside ${counted}`)
    await screenTitled(page, words.transactions.title)
    const opened = await page.evaluate(() => ({
      address: window.location.hash,
      tab: document.querySelector('[data-testid="page-tabs"] [role="tab"][data-state="active"]')?.textContent?.trim() ?? null,
    }))
    if (!opened.address.includes('tab=review') || !opened.tab?.startsWith(words.transactions.tabs.review))
      throw new Error(`the Transactions item, with rows waiting, opened ${opened.address} on ${opened.tab} instead of ${words.transactions.tabs.review}`)
  }
}

export const appMenuFlow = appMenuFlowIn('en')

/**
 * The menu adjusts to what is set up. From the first draw after a load it lists exactly `listed`, so nothing flickers in and out while files open or
 * wait to be looked up, with Net worth over the apps. Add an app leads to the home, whose cards still offer all five apps.
 */
export function sidebarAdjustsFlowIn(language, listed) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot, inspect }) => {
    await openMenu(page, press)
    const menu = await page.evaluate(menuShown)
    if (JSON.stringify(menu.apps) !== JSON.stringify(listed)) throw new Error(`the menu lists ${menu.apps.join(', ')}, not ${listed.join(', ')}`)
    if (menu.netWorth !== words.netWorth) throw new Error(`the menu shows ${menu.netWorth} over the apps`)
    if (menu.addApp !== words.addApp) throw new Error(`the menu shows ${menu.addApp} for Add an app`)
    await inspect?.('the menu with some apps set up')
    await shoot(`sidebar-adjusts-${listed.join('-')}${language === 'en' ? '' : `-${language}`}`)

    if (await page.evaluate(() => document.querySelector('aside') !== null)) {
      await page.evaluateOnNewDocument(() => {
        window.menusSeen = new Set()
        const read = () => {
          const aside = document.querySelector('aside')
          if (aside !== null) window.menusSeen.add([...aside.querySelectorAll('[data-testid="nav-app-link"]')].map((link) => link.dataset.app).join())
        }
        new MutationObserver(read).observe(document, { childList: true, subtree: true })
      })
      await page.reload({ waitUntil: 'networkidle0' })
      await delay(300)
      const seen = await page.evaluate(() => [...window.menusSeen])
      if (seen.some((rows) => rows !== listed.join())) throw new Error(`after a load the sidebar listed ${JSON.stringify(seen)}, not only ${listed.join()}`)
    }

    await pressSelector(page, press, '[data-testid="nav-add-app"]')
    await screenTitled(page, words.homeTitle)
    const cards = await page.evaluate(homeCards)
    if (cards.length !== 5) throw new Error(`the home shows ${cards.length} cards after Add an app`)
    await inspect?.('the home after Add an app')
  }
}

/** An address under an app that no screen has lands on the home, and leaves that app closed. */
export async function sidebarDeadAddressFlow(page) {
  const menu = await page.evaluate(menuShown)
  if (menu.groups !== 0) throw new Error(`an address no screen has left ${menu.name} open on the home`)
  const expanded = await page.evaluate(() => [...document.querySelectorAll('aside [data-testid="nav-arrow"]')].filter((arrow) => arrow.getAttribute('aria-expanded') === 'true').length)
  if (expanded !== 0) throw new Error(`an address no screen has left ${expanded} arrow expanded on the home`)
}

/**
 * The sidebar's height, with Company and its name line open as the longest menu there is. At 1280 x 800 and 1366 x 768 the
 * footer folds into its logo beside Sync, and at 1440 x 900 it keeps its own row. Each time the whole list fits, or only the
 * list scrolls, as at 1366 x 650, with the current page, Kuna settings, Sync and the footer on screen. Opening
 * an app's pages runs 200 ms and hardly any time under reduced motion, and a deep link opens its app with no animation on load.
 */
export function sidebarFitFlowIn(language) {
  return async (page, { shoot, inspect }) => {
    const before = page.viewport()
    const fit = () =>
      page.evaluate(() => {
        const list = document.querySelector('aside nav > div')
        const onScreen = (element) => {
          const box = element.getBoundingClientRect()
          return box.top >= 0 && box.bottom <= window.innerHeight
        }
        const listBox = list.getBoundingClientRect()
        const inList = (element) => {
          const box = element.getBoundingClientRect()
          return box.top >= listBox.top - 1 && box.bottom <= listBox.bottom + 1
        }
        return {
          subtitle: document.querySelector('aside [data-testid="nav-subtitle"]') !== null,
          width: Math.round(document.querySelector('aside').getBoundingClientRect().width),
          scrolls: list.scrollHeight > list.clientHeight,
          gutter: getComputedStyle(list).scrollbarGutter,
          lastPage: inList(document.querySelector('aside [data-testid="nav-entries"] li:last-child a')),
          lastApp: inList(document.querySelector('aside [data-testid="nav-app"]:last-child')),
          current: inList(document.querySelector('aside a[aria-current="page"]')),
          kunaSettings: onScreen(document.querySelector('aside [data-testid="nav-kuna-settings"]')),
          sync: onScreen(document.querySelector('aside nav').nextElementSibling),
          footer: onScreen(document.querySelector('aside [data-testid="company-footer-open"]')),
          folded: document.querySelector('aside [data-testid="sidebar-sync"] [data-testid="company-footer"]') !== null,
        }
      })
    try {
      // A short window folds the footer into its logo beside Sync. Then the whole menu fits, or only the list scrolls with the current page, Kuna settings, Sync and the footer in view.
      for (const [width, height] of [
        [1280, 800],
        [1366, 768],
        [1440, 900],
      ]) {
        await page.setViewport({ ...before, width, height })
        await delay(300)
        const fitted = await fit()
        const shown = fitted.scrolls ? fitted.current : fitted.lastPage && fitted.lastApp
        if (
          fitted.gutter !== 'stable' ||
          !fitted.subtitle ||
          fitted.width !== 240 ||
          fitted.folded !== height < FOOTER_FOLDS_BELOW_HEIGHT ||
          !shown ||
          !fitted.kunaSettings ||
          !fitted.sync ||
          !fitted.footer
        )
          throw new Error(`Company's sidebar does not fit ${width} x ${height}: ${JSON.stringify(fitted)}`)
        await inspect?.(`the sidebar at ${width} x ${height}`)
        await shoot(`sidebar-company-${width}x${height}${language === 'en' ? '' : `-${language}`}`)
      }
      await page.setViewport({ ...before, width: 1366, height: 650 })
      await delay(300)
      const short = await fit()
      if (!short.scrolls || !short.current || !short.kunaSettings || !short.sync || !short.footer) throw new Error(`at 1366 x 650 only the list should scroll: ${JSON.stringify(short)}`)
      await inspect?.('the sidebar at 1366 x 650')
      await page.setViewport(before)
      await delay(300)

      const openingTakes = () =>
        page.evaluate(async () => {
          document.querySelector('[data-testid="nav-arrow"][data-app="loans"]').click()
          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          return document
            .getAnimations()
            .filter((animation) => animation.animationName?.startsWith('collapsible'))
            .map((animation) => animation.effect.getComputedTiming().duration)
        })
      const moving = await openingTakes()
      if (moving.length === 0 || moving.some((duration) => duration !== 200)) throw new Error(`opening Loans runs ${JSON.stringify(moving)} ms`)
      await delay(300)
      await inspect?.('a peek at Loans from Company')
      await page.evaluate(() => document.querySelector('[data-testid="nav-arrow"][data-app="company"]').click())
      await delay(300)
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
      const still = await openingTakes()
      if (still.some((duration) => duration > 1)) throw new Error(`under reduced motion opening Loans still runs ${JSON.stringify(still)} ms`)
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])

      await page.evaluateOnNewDocument(() => {
        window.collapsiblesAnimated = 0
        document.addEventListener('animationstart', (event) => {
          if (event.animationName.startsWith('collapsible')) window.collapsiblesAnimated += 1
        })
      })
      await page.reload({ waitUntil: 'networkidle0' })
      await delay(300)
      const onLoad = await page.evaluate(() => window.collapsiblesAnimated)
      if (onLoad !== 0) throw new Error(`a deep link to Company animated ${onLoad} app's pages on load`)
    } finally {
      await page.setViewport(before)
    }
  }
}

/** The cents of the first amount in euros a text writes, in the way the language writes money. */
function centsIn(text, language) {
  const amount = (language === 'en' ? /€[\d,]+(?:\.\d{2})?/ : /[\d.]+(?:,\d{2})?\s?€/).exec(text)?.[0]
  return amount === undefined ? Number.NaN : Number(amount.replace(/\D/g, ''))
}

/**
 * The home with the books of Spending, Company, Investments, Loans and Assets open, in that order: Company's card leads with the cash on hand
 * Overview shows and opens it, the Loans card with what others owe you less what you owe, in full red or green by the way it runs, which the Loans Overview's Net tile says too, the Investments card with the value, which its Overview's Value tile says too, and the total gain with its sign, the Assets card with what the assets are worth, which its Overview's tile says too, and the Spending card with Bank and cash, which its Overview's accounts total says too. Each
 * card tiles its icon in a colour of its own. From 1024 px the sidebar lists every app as their cards do, and its
 * Company row opens Overview.
 */
export function homeFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const cards = await page.evaluate(homeCards)
    const [spending, company, investments, loans, assets] = cards
    if (cards.length !== 5 || spending.app !== 'spending' || company.app !== 'company' || investments.app !== 'investments' || loans.app !== 'loans' || assets.app !== 'assets')
      throw new Error(`the home shows ${JSON.stringify(cards.map((card) => card.app))}, not Spending, Company, Investments, Loans and Assets`)
    if (company.state !== 'open' || !company.text.includes(words.companyHome.cashOnHand) || !/€/.test(company.figure ?? '')) throw new Error(`the Company card reads "${company.text}"`)
    if (
      loans.state !== 'open' ||
      loans.lead !== words.loansOverview.tiles.net ||
      !loans.text.includes(words.loansHome.owed) ||
      !loans.text.includes(words.loansHome.owedToYou) ||
      !/€/.test(loans.figure ?? '')
    )
      throw new Error(`the Loans card reads "${loans.text}"`)
    const owesOnBalance = (loans.figure ?? '').startsWith('−')
    if (loans.tone !== (owesOnBalance ? 'text-error' : 'text-success')) throw new Error(`the Loans card's net ${loans.figure} shows in ${loans.tone}`)
    const gain = new RegExp(`${words.investmentsHome.totalGain}[+−]?(?:€|\\d)`)
    if (investments.state !== 'open' || !investments.text.includes(words.investmentsHome.value) || !gain.test(investments.text) || !/€/.test(investments.figure ?? ''))
      throw new Error(`the Investments card reads "${investments.text}"`)
    if (assets.state !== 'open' || !assets.text.includes(words.assetsHome.value) || !/€/.test(assets.figure ?? '')) throw new Error(`the Assets card reads "${assets.text}"`)
    if (spending.state !== 'open' || spending.lead !== words.spendingHome.bankAndCash || !spending.text.includes(words.spendingHome.spentThisMonth) || !/€/.test(spending.figure ?? ''))
      throw new Error(`the Spending card reads "${spending.text}"`)
    const colours = cards.map((card) => card.colour)
    if (colours.includes(null) || new Set(colours).size !== colours.length) throw new Error(`the cards tile their icons in ${colours.join(', ')}, not one colour each`)
    const menu = await page.evaluate(homeMenu)
    if (menu !== null) {
      sidebarMatchesCards(menu, cards, words)
      const counts = await page.evaluate(closedRowCounts)
      if (!(Number(counts.company) > 0) || 'investments' in counts) throw new Error(`the closed apps' rows count ${JSON.stringify(counts)}, when Company has rows waiting and Investments nothing`)
    }
    await inspect?.('the home with every app')
    await shoot('home')

    await pressSelector(page, press, '[data-testid="home-card"][data-app="company"]')
    await screenTitled(page, words.companyOverview)
    const cash = await page
      .waitForFunction(
        (label) =>
          [...document.querySelectorAll('.kpi-tile')]
            .find((tile) => tile.textContent?.includes(label))
            ?.querySelector('.text-figure-lg')
            ?.textContent?.trim() ?? null,
        { timeout: 10_000 },
        words.companyHome.cashOnHand,
      )
      .then((handle) => handle.jsonValue())
    if (cash !== company.figure) throw new Error(`the Company card says ${company.figure} on hand, the Overview ${cash}`)

    await goHome(page, press, words)
    await pressSelector(page, press, '[data-testid="home-card"][data-app="loans"]')
    await screenTitled(page, words.overview)
    const net = await page
      .waitForFunction(() => document.querySelector('[data-testid="loans-net"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? null, { timeout: 10_000 })
      .then((handle) => handle.jsonValue())
    const way = owesOnBalance ? words.loansOverview.tiles.netYouOwe : words.loansOverview.tiles.netOwedToYou
    if (centsIn(net, language) !== centsIn(loans.figure, language) || !net.includes(way)) throw new Error(`the Loans card says ${loans.figure} net, the Loans Overview's Net tile "${net}"`)
    await inspect?.('the Loans Overview from the home')

    await goHome(page, press, words)
    await pressSelector(page, press, '[data-testid="home-card"][data-app="investments"]')
    await screenTitled(page, words.investmentsOverview)
    const value = await page
      .waitForFunction(() => document.querySelector('[data-testid="investments-value"] .text-figure-lg')?.textContent?.trim() ?? null, { timeout: 10_000 })
      .then((handle) => handle.jsonValue())
    if (value !== investments.figure) throw new Error(`the Investments card says ${investments.figure}, the Overview's Value tile ${value}`)

    await goHome(page, press, words)
    await pressSelector(page, press, '[data-testid="home-card"][data-app="assets"]')
    await screenTitled(page, words.overview)
    const worth = await page
      .waitForFunction(() => document.querySelector('[data-testid="assets-value"] .text-figure-lg')?.textContent?.trim() ?? null, { timeout: 10_000 })
      .then((handle) => handle.jsonValue())
    if (worth !== assets.figure) throw new Error(`the Assets card says ${assets.figure}, the Assets Overview's tile ${worth}`)

    await goHome(page, press, words)
    await pressSelector(page, press, '[data-testid="home-card"][data-app="spending"]')
    await screenTitled(page, words.spendingScreens.overview)
    const held = await page
      .waitForFunction(
        (label) =>
          [...document.querySelectorAll('[data-testid="spending-accounts-total"]')]
            .find((total) => total.querySelector('th')?.textContent?.trim() === label)
            ?.querySelector('td')
            ?.textContent?.trim() ?? null,
        { timeout: 10_000 },
        words.spendingHome.bankAndCash,
      )
      .then((handle) => handle.jsonValue())
    if (held !== spending.figure) throw new Error(`the Spending card says ${spending.figure} in bank and cash, the Spending Overview's accounts ${held}`)

    if (menu === null) return
    await goHome(page, press, words)
    await pressSelector(page, press, 'aside [data-testid="nav-app-link"][data-app="company"]')
    await screenTitled(page, words.companyOverview)
    const title = `${words.companyOverview}, ${words.company} – Kuna`
    if ((await page.title()) !== title) throw new Error(`the Company row in the home's sidebar opened "${await page.title()}"`)
  }
}

export const homeFlow = homeFlowIn('en')

/**
 * A fresh device opens the home with the welcome in place of the cards, and a sidebar with no Add an app until the welcome is answered, no Net worth
 * and no empty strip where Sync would be. Once answered every app shows in Set up. Loans, Investments, Assets and Spending can be set
 * up first: each card opens its first run, whose link home comes back, and the Company card opens the company's welcome.
 */
export function setUpFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the fresh home shows no welcome')
    })
    if (await page.evaluate(() => document.querySelector('[data-testid="sync-status"]') !== null)) throw new Error('the fresh home shows a sync control')
    if ((await page.evaluate(homeMenu)) !== null) {
      const fresh = await page.evaluate(menuShown)
      if (fresh.apps.length !== 0 || fresh.addApp !== null || fresh.netWorth !== null)
        throw new Error(`before any app is set up the sidebar shows ${fresh.apps.join()}, ${fresh.addApp} and ${fresh.netWorth}`)
      if (await page.$('[data-testid="sidebar-sync"]')) throw new Error('before any app is set up the sidebar keeps an empty strip where Sync would be')
    }
    await inspect?.('the home on a fresh device')
    await shoot('home-set-up')
    for (const name of [words.company, words.loans, words.investments, words.assetsApp, words.spendingApp]) {
      await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', name)
    }
    await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
    await page.waitForSelector('[data-testid="home-card"]', { visible: true, timeout: 10_000 })
    const cards = await page.evaluate(homeCards)
    if (cards.length !== 5 || cards.some((card) => card.state !== 'set-up' || !card.text.includes(words.setUp)))
      throw new Error(`the answered home shows ${JSON.stringify(cards.map((card) => [card.app, card.state]))}`)
    const menu = await page.evaluate(homeMenu)
    if (menu !== null) sidebarMatchesCards(menu, cards, words)

    for (const [app, name] of [
      [LOANS, words.loans],
      [INVESTMENTS, words.investments],
      [ASSETS, words.assetsApp],
      [SPENDING, words.spendingApp],
    ]) {
      await pressSelector(page, press, `[data-testid="home-card"][data-app="${app.id}"]`)
      await firstRunAt(page, app, 'folder')
      await screenTitled(page, name)
      await inspect?.(`the ${app.name} first run from the home`)
      await pressSelector(page, press, '[data-testid="home-link"]')
      await screenTitled(page, words.homeTitle)
    }

    await pressSelector(page, press, '[data-testid="home-card"][data-app="company"]')
    await onboardingAt(page, 'welcome')
    await screenTitled(page, words.company)
    await inspect?.("the company's welcome from the home")
    await shoot('home-set-up-company')
  }
}

export const setUpFlow = setUpFlowIn('en')

const ANTHROPIC_ROW = '[data-testid="assist-card"] [data-provider="anthropic"]'
const OPENAI_ROW = '[data-testid="assist-card"] [data-provider="openai"]'
const OPENROUTER_ROW = '[data-testid="assist-card"] [data-provider="openrouter"]'

/** Types a key into the open field and presses Save, the Test that follows answering by itself. */
async function saveTypedKey(page, press, row, key) {
  const input = await pressSelector(page, press, `${row} [data-testid="assist-key"]`)
  await input.type(key)
  const fieldType = await input.evaluate((element) => element.type)
  if (fieldType !== 'password') throw new Error(`the key field is type "${fieldType}", not password`)
  await pressSelector(page, press, `${row} [data-testid="assist-key-save"]`)
}

/** Presses Undo on the toast that says a key was removed. */
async function undoKeyRemoval(page, press, words) {
  await toast(page, words.keyRow.removed)
  const undo = await page
    .waitForFunction(
      (selector, label) => [...document.querySelectorAll(`${selector} button`)].find((element) => element.textContent?.trim() === label) ?? null,
      { timeout: 5_000 },
      TOAST,
      words.keyRow.undo,
    )
    .catch(() => {
      throw new Error('the toast of a removed key offers no Undo')
    })
  await press(undo.asElement())
}

/** Waits for the card's Test to end saying this. */
async function testLineSays(page, row, text, failure) {
  await page
    .waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted), { timeout: 10_000 }, `${row} [data-testid="assist-key-test-result"]`, text)
    .catch(() => {
      throw new Error(failure)
    })
}

/**
 * Kuna settings, the assistant's card: with no key it shows the steps and hides the model. A made-up Anthropic key typed
 * and saved shows only how it ends, closes its field, is tested by itself and becomes the pick. Replace opens the field
 * and Keep this key closes it. Opus 5.5 picked from the model field's suggestions stays picked in this browser, a typed
 * model with no price says so and Test shows the provider's refusal of it, an emptied field goes back to the default. OpenRouter
 * changes nothing until its key is saved, its id that turns on web search is refused and goes back to the default when
 * the field is left, and Remove with Undo puts a key back and then Remove forgets it.
 */
export async function assistKeyFlow(page, { press, shoot, inspect }) {
  const words = ASSIST_WORDS.en
  try {
    await page.waitForSelector(`${ANTHROPIC_ROW} [data-testid="assist-key-steps"]`, { visible: true, timeout: 10_000 })
    if (await page.$('[data-testid="assist-model"]')) throw new Error('the model field shows with no key')
    if (await page.$(ALWAYS_ALLOW)) throw new Error('Always allow shows with no key')
    await inspect?.('the card with no key')

    await saveTypedKey(page, press, ANTHROPIC_ROW, MADE_UP_ANTHROPIC_KEY)
    await elementSays(page, `${ANTHROPIC_ROW} [data-testid="assist-key-kept"]`, ['A key ending in 0042 is kept in this browser.'], 'Save did not keep the key')
    await testLineSays(page, ANTHROPIC_ROW, words.card.accepted('Anthropic'), 'Save did not test the key by itself')
    await page.waitForSelector('[data-testid="assist-key"]', { hidden: true, timeout: 5_000 }).catch(() => {
      throw new Error('the key field stays open after Save')
    })
    if (await page.$('[data-testid="assist-key-steps"]')) throw new Error('the steps stay once a key is saved')
    if (await page.$('[data-testid="assist-get-key"]')) throw new Error('Get a key stays once a key is saved and accepted')
    const shown = await page.evaluate((key) => document.body.innerText.includes(key) || [...document.querySelectorAll('input')].some((element) => element.value === key), MADE_UP_ANTHROPIC_KEY)
    if (shown) throw new Error('the whole key came back on screen after Save')
    const [kept, pick] = await page.evaluate(() => [localStorage.getItem('kuna.secret.anthropic'), localStorage.getItem('kuna.assist-provider')])
    if (kept !== MADE_UP_ANTHROPIC_KEY) throw new Error(`this browser keeps "${kept}" as the Anthropic key`)
    if (pick !== 'anthropic') throw new Error(`a saved and accepted key leaves "${pick}" as the pick`)
    await inspect?.('an Anthropic key saved and tested')
    await shoot('assist-key')

    await pressSelector(page, press, `${ANTHROPIC_ROW} [data-testid="assist-key-replace"]`)
    await page.waitForSelector(`${ANTHROPIC_ROW} [data-testid="assist-key"]`, { visible: true, timeout: 5_000 })
    await inspect?.('replacing a key')
    await pressSelector(page, press, `${ANTHROPIC_ROW} [data-testid="assist-key-keep"]`)
    await page.waitForSelector('[data-testid="assist-key"]', { hidden: true, timeout: 5_000 })

    const modelField = `${ANTHROPIC_ROW} [data-testid="assist-model"]`
    await choose(page, press, await page.$(modelField), 'claude-opus-5-5')
    const model = await page.evaluate(() => localStorage.getItem('kuna.assist-model.anthropic'))
    if (model !== 'claude-opus-5-5') throw new Error(`this browser keeps "${model}" as the Anthropic model, not claude-opus-5-5`)
    const shownModel = await page.$eval(modelField, (element) => element.value)
    if (shownModel !== 'claude-opus-5-5') throw new Error(`the model field shows "${shownModel}" after picking claude-opus-5-5`)
    await elementSays(page, ANTHROPIC_ROW, ['Opus 5.5'], 'the model field does not name Opus 5.5')
    await inspect?.('Opus 5.5 picked')

    const typedField = await pressSelector(page, press, modelField)
    await typedField.evaluate((element) => element.select())
    await typedField.type('claude-made-up-model')
    await page.keyboard.press('Escape')
    await elementSays(page, ANTHROPIC_ROW, ['Kuna knows no price for this model, so its runs say price unknown.'], 'a typed model does not say its price is unknown')
    const typed = await page.evaluate(() => localStorage.getItem('kuna.assist-model.anthropic'))
    if (typed !== 'claude-made-up-model') throw new Error(`this browser keeps "${typed}" as the typed model`)
    await pressSelector(page, press, `${ANTHROPIC_ROW} [data-testid="assist-key-test"]`)
    await testLineSays(page, ANTHROPIC_ROW, 'model: claude-made-up-model', "Test does not show the provider's refusal of a typed model")
    if (await page.$('[data-testid="assist-key"]')) throw new Error('a refused model opened the key field, though the key may be fine')
    await inspect?.('a typed model refused')

    const emptiedField = await pressSelector(page, press, modelField)
    await emptiedField.evaluate((element) => element.select())
    await page.keyboard.press('Backspace')
    await page.keyboard.press('Escape')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-model.anthropic'))) !== null) throw new Error('an emptied model field did not go back to the default')

    await openCompanies(page, press)
    await pickCompany(page, press, 'OpenRouter')
    await elementSays(page, '[data-testid="assist-keeps-using"]', [words.card.keepsUsing('Anthropic', 'OpenRouter')], 'looking at a company with no key does not say the assistant stays')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'anthropic') throw new Error('looking at a company with no key moved the assistant')
    await inspect?.('OpenRouter on screen with no key')
    await saveTypedKey(page, press, OPENROUTER_ROW, 'made-up-openrouter-key-0042')
    await elementSays(
      page,
      `${ANTHROPIC_ROW} [data-testid="assist-saved-aside"]`,
      [words.card.accepted('OpenRouter'), words.card.savedKeepsUsing('OpenRouter', 'Anthropic')],
      'saving a key for another company does not say the assistant stays',
    )
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'anthropic') throw new Error('saving a key moved the assistant')
    await inspect?.("OpenRouter's key saved with Anthropic in use")
    await openCompanies(page, press)
    await pickCompany(page, press, 'OpenRouter')
    await page.waitForFunction(() => localStorage.getItem('kuna.assist-provider') === 'openrouter', { timeout: 5_000 })

    const searchingField = await pressSelector(page, press, `${OPENROUTER_ROW} [data-testid="assist-model"]`)
    await searchingField.evaluate((element) => element.select())
    await searchingField.type('made-up/model:online')
    await page.keyboard.press('Escape')
    await elementSays(
      page,
      OPENROUTER_ROW,
      ['This model id turns on web search, which Kuna keeps off, so runs stay on the default model.'],
      'a model id that turns on web search is not refused on the card',
    )
    await inspect?.('a model id that turns on web search refused')
    await searchingField.evaluate((element) => element.blur())
    await page
      .waitForFunction((selector) => document.querySelector(selector)?.value === 'anthropic/claude-sonnet-5-5', { timeout: 5_000 }, `${OPENROUTER_ROW} [data-testid="assist-model"]`)
      .catch(() => {
        throw new Error('the model field does not go back to the default after a refused id')
      })

    await pressSelector(page, press, `${OPENROUTER_ROW} [data-testid="assist-key-forget"]`)
    await page.waitForSelector(`${OPENROUTER_ROW}[data-kept="false"]`, { timeout: 5_000 }).catch(() => {
      throw new Error('Remove did not forget the key')
    })
    if ((await page.evaluate(() => localStorage.getItem('kuna.secret.openrouter'))) !== null) throw new Error('Remove left the key in this browser')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'openrouter') throw new Error('Remove moved the assistant to another saved key')
    await undoKeyRemoval(page, press, words)
    await page.waitForSelector(`${OPENROUTER_ROW}[data-kept="true"]`, { timeout: 5_000 }).catch(() => {
      throw new Error('Undo did not put the key back')
    })
    if ((await page.evaluate(() => localStorage.getItem('kuna.secret.openrouter'))) !== 'made-up-openrouter-key-0042') throw new Error('Undo put back another key')
  } finally {
    await forgetAssist(page)
  }
}

/**
 * With no pick stored and OpenAI's key kept, as an older Kuna left a browser, a key saved for Anthropic stays aside, and
 * the assistant stays on OpenAI until Anthropic is picked on the select.
 */
export async function assistSaveKeepsCompanyFlow(page, { press, inspect }) {
  const words = ASSIST_WORDS.en
  try {
    await page.evaluate(() => localStorage.setItem('kuna.secret.openai', 'made-up-openai-key-0077'))
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector(`${OPENAI_ROW} [data-testid="assist-key-kept"]`, { visible: true, timeout: 10_000 })
    await openCompanies(page, press)
    await pickCompany(page, press, 'Anthropic')
    await saveTypedKey(page, press, ANTHROPIC_ROW, MADE_UP_ANTHROPIC_KEY)
    await elementSays(page, `${OPENAI_ROW} [data-testid="assist-saved-aside"]`, [words.card.savedKeepsUsing('Anthropic', 'OpenAI')], 'a key saved aside does not say the assistant stays')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'openai') throw new Error('saving a key moved the assistant')
    await inspect?.('a key saved aside')
    await openCompanies(page, press)
    await pickCompany(page, press, 'Anthropic')
    await elementSays(page, `${ANTHROPIC_ROW} [data-testid="assist-moved"]`, [words.card.nowSends('Anthropic'), words.card.otherKept('OpenAI')], 'a pick on the select does not say what it did')
  } finally {
    await forgetAssist(page)
  }
}

/**
 * A button that opens the chat about one element: the tag shows and can be removed, and the element is marked while it stays.
 * A tagged card keeps its own surface under the wash, so its computed background colour does not change. A row takes the bar.
 */
export function chatTagFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const card = '[data-testid="gallery-chat-element"]'
    const row = '[data-testid="gallery-chat-row"]'
    const tagged = (selector) => page.$eval(selector, (element) => element.getAttribute('data-chat-tagged'))
    const surface = () => page.$eval(card, (element) => getComputedStyle(element).backgroundColor)
    try {
      await keepAiKey(page)
      await page.waitForSelector(card, { visible: true, timeout: 10_000 })
      const untagged = await surface()
      await pressSelector(page, press, '[data-testid="gallery-chat-ask"]')
      await elementSays(page, '[data-testid="chat-tag"]', ['Cash on hand'], 'the panel does not show the tag')
      // Below the dock's width the chat takes the page's place, so the marked elements show only beside a docked chat.
      const docked = await page.evaluate((selector) => (document.querySelector(selector)?.getClientRects().length ?? 0) > 0, card)
      if (docked) {
        if ((await tagged(card)) !== 'card') throw new Error('the tagged card is not highlighted as a card')
        const underWash = await surface()
        if (underWash !== untagged) throw new Error(`the tagged card lost its own surface: ${untagged} became ${underWash}`)
        await page.$eval(card, (element) => element.scrollIntoView({ block: 'center' }))
      }
      await inspect?.('a tagged chat')
      await shoot('chat-tag')
      if (docked) {
        await pressSelector(page, press, '[data-testid="gallery-chat-row-ask"]')
        await elementSays(page, '[data-testid="chat-tag"]', ['Rent'], 'the panel does not show the row as the tag')
        if ((await tagged(row)) !== 'row') throw new Error('the tagged row is not highlighted as a row')
        if ((await tagged(card)) !== null) throw new Error('the card stayed highlighted after the row was asked about')
        await shootAt(page, shoot, row, 'chat-tag-row')
      }
      await pressSelector(page, press, '[data-testid="chat-tag-remove"]')
      await page.waitForSelector('[data-testid="chat-tag"]', { hidden: true, timeout: 5_000 })
      if (docked && (await tagged(row)) !== null) throw new Error('the highlight stayed after the tag went')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** The AI company the flows' made-up key is for, which each file's note names. */
const AI_COMPANY = 'Anthropic'

/**
 * One file of a kind on the chat's prompt: its chip, and under it the note that names the AI company it goes to, whole for
 * a photo or a PDF with the cost line, or as text cell by cell for a sheet, with what Anonymise leaves as written.
 */
export function chatAttachFlow(kind, samples, language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples[kind])
      const states = await page.$$eval('[data-testid="chat-file"]', (chips) => chips.map((chip) => chip.getAttribute('data-state')))
      if (states.join() !== 'ready') throw new Error(`the ${kind} chip is ${states.join() || 'missing'}, not ready`)
      if (kind === 'sheet') {
        await elementSays(page, '[data-testid="chat-file-note"]', [words.files.goesAsCells(AI_COMPANY)], 'the sheet is not said to go to the AI company as text, cell by cell')
      } else {
        await elementSays(page, '[data-testid="chat-file-note"]', [words.files.goWhole(1, AI_COMPANY).one], 'the file is not said to go to the AI company whole')
        await page.waitForSelector('[data-testid="chat-files-cost"]', { visible: true, timeout: 5_000 }).catch(() => {
          throw new Error('the files show no cost line')
        })
      }
      await inspect?.(`a ${kind} on the prompt`)
      await shoot(`chat-attach-${kind}`)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A note beside a photo on the prompt: the note's chip is refused with the kinds Kuna takes, and the photo stays ready. */
export function chatAttachRefusedFlow(samples, language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.photo, samples.note)
      const states = await page.$$eval('[data-testid="chat-file"]', (chips) => chips.map((chip) => chip.getAttribute('data-state')).sort())
      if (states.join() !== 'ready,refused') throw new Error(`the photo and the note are ${states.join() || 'missing'}, not one ready and one refused`)
      await elementSays(page, '[data-testid="chat-file-note"]', [words.files.refused('chat-sample-note.docx', words.files.unknownKind)], 'the refused note does not say which kinds Kuna takes')
      await inspect?.('a note refused beside a photo on the prompt')
      await shoot('chat-attach-refused')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** An XML file that declares its own entities waits refused as one Kuna does not open, in the error colour, with the photo beside it ready. */
export function chatAttachUnsafeFlow(samples, language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.photo, samples.unsafe)
      const states = await page.$$eval('[data-testid="chat-file"]', (chips) => chips.map((chip) => chip.getAttribute('data-state')).sort())
      if (states.join() !== 'ready,refused') throw new Error(`the photo and the XML are ${states.join() || 'missing'}, not one ready and one refused`)
      await elementSays(page, '[data-testid="chat-file-note"]', [words.files.refused('chat-sample-entities.xml', words.files.unsafe)], 'the refused XML does not say Kuna does not open it')
      await inspect?.('an XML with its own entities refused on the prompt')
      await shoot('chat-attach-unsafe')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A sheet sent as cells: the read is a closed row under the answer, which says the rows went cell by cell. */
export function chatSheetSentFlow(samples, language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.sheet)
      await sendInChat(page, press, language === 'en' ? 'Read the file' : 'Pročitaj datoteku')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(page, '[data-testid="chat-sent"]', [words.sent.cellsRows('1-3', 'chat-sample-turnover.xlsx')], 'the read is not shown as rows sent cell by cell')
      await delay(300)
      await inspect?.('the sheet sent cell by cell')
      await shoot('chat-sent-cells')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A PDF waits refused while OpenRouter is picked, which reads none, and is ready again once Anthropic is picked back. */
export function chatAttachPdfOpenRouterFlow(samples) {
  return async (page, { press, shoot, inspect }) => {
    const pickProvider = (id) =>
      page.evaluate((picked) => {
        localStorage.setItem('kuna.assist-provider', picked)
        window.dispatchEvent(new StorageEvent('storage', { key: 'kuna.assist-provider', newValue: picked, storageArea: localStorage }))
      }, id)
    try {
      await keepAiKey(page, { 'kuna.secret.openrouter': MADE_UP_ANTHROPIC_KEY })
      await openChat(page, press)
      await attachToChat(page, samples.pdf)
      await pickProvider('openrouter')
      await page.waitForSelector('[data-testid="chat-file"][data-state="refused"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the PDF chip is not refused while OpenRouter is picked')
      })
      await elementSays(page, '[data-testid="chat-file-note"]', [ASSIST_WORDS.en.result.noPdf('OpenRouter')], 'the refused PDF does not say OpenRouter reads none')
      await inspect?.('a PDF refused by OpenRouter')
      await shoot('chat-attach-pdf-openrouter')
      await pickProvider('anthropic')
      await page.waitForSelector('[data-testid="chat-file"][data-state="ready"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the PDF chip is not ready again after Anthropic is picked back')
      })
      await inspect?.('the PDF ready again')
      await shoot('chat-attach-pdf-openrouter-back')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A drag of files over the panel shows the drop target. */
export function chatAttachDropFlow(language = 'en') {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await page.$eval('[data-testid="chat-panel"]', (panel) => {
        const transfer = new DataTransfer()
        transfer.items.add(new File(['x'], 'dragged.pdf', { type: 'application/pdf' }))
        panel.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer }))
      })
      await elementSays(page, '[data-testid="chat-drop"]', [words.files.drop], 'a drag of files shows no drop target')
      await inspect?.('a drag of files over the chat')
      await shoot('chat-attach-drop')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** The first send with a photo attached asks on its card, and the message sent shows the file under it, then a message with none shows no list. */
export function chatConsentFilesFlow(samples, language = 'en') {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.photo)
      await sendInChat(page, press, language === 'en' ? 'What is on this receipt?' : 'Što piše na ovom računu?')
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await elementSays(page, '[data-testid="chat-consent-caution"]', [ASSIST_WORDS[language].files.goWhole(1, AI_COMPANY).one], 'the card does not warn that the photo goes whole')
      if (await page.$('[data-testid="chat-file-note"]')) throw new Error('the files under the prompt say how they go while the card says it too')
      await delay(400)
      await inspect?.('the card before a send with a photo')
      await shoot('chat-consent-files')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * The card before the first send warns how a file of cells goes, in the prompt's own words, with Anonymise on or off, and
 * beside a photo warns once that it goes whole. The prompt's own lines wait while the card says them.
 */
export function chatConsentCellsFlow(samples, language = 'en', anonymise = true) {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page, anonymise ? {} : { 'kuna.assist-anonymise': 'anthropic' })
      await openChat(page, press)
      await attachToChat(page, ...(anonymise ? [samples.deposits, samples.photo] : [samples.deposits]))
      await sendInChat(page, press, language === 'en' ? 'What is in these?' : 'Što je u ovima?')
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      const cells = anonymise ? words.files.goesAsCells(AI_COMPANY) : words.files.goesAsCellsPlain(AI_COMPANY)
      await elementSays(page, '[data-testid="chat-consent-caution"]', [cells], 'the card does not warn how the CSV goes')
      if (anonymise) await elementSays(page, '[data-testid="chat-consent-caution"]', [words.files.goWhole(1, AI_COMPANY).one], 'the card does not warn that the photo goes whole')
      if (await page.$('[data-testid="chat-file-note"]')) throw new Error('the files under the prompt say how they go while the card says it too')
      await delay(400)
      await inspect?.(`the card before a send with a CSV${anonymise ? ' and a photo' : ' and Anonymise off'}`)
      await shoot(anonymise ? 'chat-consent-cells' : 'chat-consent-cells-plain')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A sent message with a file lists it under the text, and one without lists nothing. */
export function chatQuestionFilesFlow(samples, language = 'en') {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await attachToChat(page, samples.photo, samples.sheet)
      await sendInChat(page, press, language === 'en' ? 'What is on these?' : 'Što piše na ovima?')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(page, '[data-testid="chat-question-files"]', ['chat-sample-receipt.png', 'chat-sample-turnover.xlsx'], 'the sent message does not list its files')
      await sendInChat(page, press, language === 'en' ? 'And with no file?' : 'A bez datoteke?')
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length === 2, { timeout: 15_000 })
      const lists = await page.$$eval('[data-testid="chat-question-files"]', (elements) => elements.length)
      if (lists !== 1) throw new Error(`${lists} sent messages list files, not 1`)
      await inspect?.('a sent message with files and one without')
      await shoot('chat-question-files')
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * The select of AI companies with Anonymise off for Anthropic and Company's yes as an older Kuna kept it: that yes shows as
 * Always allow for Anthropic, a company with a key says so and takes over at once, Anonymise is on again and the card says
 * so, the other key stays with Remove and Undo, and the yes stays with Anthropic while the Assistant tab says OpenAI asks.
 */
export function assistProviderSwitchFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const anonymise = '[data-testid="assist-anonymise"]'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page, TWO_KEYS_ANONYMISE_OFF)
      await page.waitForSelector(`${ANTHROPIC_ROW} [data-testid="assist-key-kept"]`, { visible: true, timeout: 10_000 })
      await switchSays(page, anonymise, false, 'Anonymise does not show off for Anthropic')
      await switchSays(page, ALWAYS_ALLOW, true, "Company's old yes did not carry over to Anthropic")
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist.company'))) !== null) throw new Error("Company's old yes stayed in this browser after it carried over")
      const offered = await openCompanies(page, press)
      if (!offered.find((option) => option.startsWith('OpenAI'))?.includes(words.card.keySaved)) throw new Error(`the select does not mark the saved key: ${offered.join(' | ')}`)
      if (offered.find((option) => option.startsWith('OpenRouter'))?.includes(words.card.keySaved)) throw new Error('the select marks a key that is not saved')
      // The list fades in, and its options read only once it has.
      await delay(400)
      await inspect?.('the select open')
      await shoot('assist-companies')
      await pickCompany(page, press, 'OpenAI')

      await elementSays(
        page,
        `${OPENAI_ROW} [data-testid="assist-moved"]`,
        [words.card.nowSends('OpenAI'), words.card.anonymiseBack, words.card.otherKept('Anthropic')],
        'the switch does not say what it did',
      )
      await switchSays(page, anonymise, true, 'Anonymise is not on again after a change of company')
      await switchSays(page, ALWAYS_ALLOW, false, 'the yes for Anthropic went with the change to OpenAI')
      await elementSays(page, '[data-testid="assist-card"]', [words.card.anonymiseOn('OpenAI')], 'Anonymise does not describe itself for OpenAI')
      const [pick, anthropic, anonymiseOffFor, allowed] = await page.evaluate(() => [
        localStorage.getItem('kuna.assist-provider'),
        localStorage.getItem('kuna.secret.anthropic'),
        localStorage.getItem('kuna.assist-anonymise'),
        localStorage.getItem('kuna.assist-allowed.anthropic'),
      ])
      if (pick !== 'openai') throw new Error(`the pick is "${pick}" after picking OpenAI`)
      if (anthropic !== MADE_UP_ANTHROPIC_KEY) throw new Error('the switch lost the other key')
      if (anonymiseOffFor !== null) throw new Error(`Anonymise stays off for "${anonymiseOffFor}" through a change of company`)
      if (allowed !== 'on') throw new Error('the switch of company forgot the yes for Anthropic')
      await inspect?.('after a switch of company')
      await shoot('assist-provider-switched')

      await pressSelector(page, press, `${OPENAI_ROW} [data-testid="assist-other-forget"]`)
      await page.waitForSelector('[data-testid="assist-other-kept"]', { hidden: true, timeout: 5_000 }).catch(() => {
        throw new Error('Remove it left the line of the other key')
      })
      if ((await page.evaluate(() => localStorage.getItem('kuna.secret.anthropic'))) !== null) throw new Error('Remove it left the other key in this browser')
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-provider'))) !== 'openai') throw new Error('Remove it moved the assistant')
      await undoKeyRemoval(page, press, words)
      await page.waitForSelector('[data-testid="assist-other-kept"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('Undo did not bring back the other key')
      })

      await goToRoute(page, '#/company/settings?tab=assistant', APP_ALLOWED)
      await elementSays(page, '[data-testid="app-assist-card"]', [words.appCard.uses('OpenAI'), words.card.allowOff('OpenAI')], 'the tab does not say the new company asks')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A key the company refuses (`?ai=key-refused`): it is not kept, the field stays open beside Get a key, and the assistant does not move from the company it was on. */
export function assistKeyRefusedFlowIn(language) {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await page.evaluate(() => localStorage.setItem('kuna.assist-provider', 'anthropic'))
      await page.waitForSelector(COMPANY_SELECT, { visible: true, timeout: 10_000 })
      await openCompanies(page, press)
      await pickCompany(page, press, 'OpenAI')
      await saveTypedKey(page, press, OPENAI_ROW, 'made-up-openai-key-0077')
      await testLineSays(page, OPENAI_ROW, words.card.refused('OpenAI'), 'the refusal of the key does not show')
      await page.waitForSelector(`${OPENAI_ROW} [data-testid="assist-key"]`, { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the key field stays closed after a refusal')
      })
      await page.waitForSelector(`${OPENAI_ROW} [data-testid="assist-get-key"]`, { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('Get a key does not show after a refusal')
      })
      const [pick, kept] = await page.evaluate(() => [localStorage.getItem('kuna.assist-provider'), localStorage.getItem('kuna.secret.openai')])
      if (pick !== 'anthropic') throw new Error(`a refused key moved the assistant to "${pick}"`)
      if (kept !== null) throw new Error('a refused key was kept')
      await elementSays(page, '[data-testid="assist-keeps-using"]', [words.card.keepsUsing('Anthropic', 'OpenAI')], 'a refused key does not say the assistant stays')
      await inspect?.('a key refused')
      await shoot('assist-key-refused')
    } finally {
      await forgetAssist(page)
    }
  }
}

const SET_UP = '[data-testid="assist-set-up"]'

/** Answers yes to the welcome's AI question with the given apps picked and goes on to the key, which changes no answer yet and offers only the companies that read documents. */
async function reachKeyStep(page, press, language, appNames) {
  const screen = SCREEN_WORDS[language]
  const words = ASSIST_WORDS[language]
  await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 })
  for (const name of appNames) await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', name)
  await pressButton(page, press, '[data-testid="kuna-welcome-ai"] label', screen.home.welcome.aiYes)
  await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
  await page.waitForSelector(SET_UP, { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('a yes to the AI question does not lead to the key')
  })
  await screenTitled(page, words.card.title)
  if (await page.evaluate(() => localStorage.getItem('kuna.start'))) throw new Error('the welcome counted as answered before the key step ended')
  if (await page.$('[data-testid="home-card"]')) throw new Error('the key step shows beside the cards')
  if (await page.$('[role="dialog"]')) throw new Error('the key step opened a dialog')
  const companies = await openCompanies(page, press)
  if (companies.some((company) => company.startsWith('OpenRouter'))) throw new Error('the walk-through offers a company that cannot read documents')
  await pickCompany(page, press, 'Anthropic')
}

/**
 * Yes at the welcome, with Company and Loans picked: the key step in the same card, a key tested and kept, one line on the chat and the one consent, which turns on
 * Always allow for the company. Back on the way keeps what was picked.
 */
export function kunaWelcomeAiFlowIn(language) {
  const screen = SCREEN_WORDS[language]
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      const question = await page.waitForSelector('[data-testid="kuna-welcome-ai"]', { visible: true, timeout: 10_000 })
      await shootAt(page, shoot, question, 'kuna-welcome-ai-question')
      await reachKeyStep(page, press, language, [screen.company, screen.loans])
      await elementSays(page, SET_UP, [words.card.steps.credit, words.card.pay('Anthropic'), words.retention.anthropic], 'the key step leaves out what a key takes')
      await inspect?.('the key step')
      await shoot('kuna-welcome-ai-key')

      await pressSelector(page, press, '[data-testid="assist-set-up-back"]')
      await screenTitled(page, screen.home.welcome.title)
      const picked = await page.$$eval(
        '[data-testid="kuna-welcome-apps"] [role="checkbox"][aria-checked="true"], [data-testid="kuna-welcome-apps"] [data-state="checked"][role="checkbox"]',
        (boxes) => boxes.length,
      )
      if (picked !== 2) throw new Error(`Back keeps ${picked} apps picked, not 2`)
      await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
      await page.waitForSelector(SET_UP, { visible: true, timeout: 5_000 })

      await saveTypedKey(page, press, SET_UP, MADE_UP_ANTHROPIC_KEY)
      await testLineSays(page, SET_UP, words.card.accepted('Anthropic'), 'the key step does not say the company took the key')
      await elementSays(page, '[data-testid="assist-set-up-chat"]', [words.setUp.chat], 'the key step does not say what the key opens')
      await elementSays(
        page,
        '[data-testid="assist-set-up-consent"]',
        [words.setUp.sends, words.retention.anthropic, words.card.allow, words.card.allowOn('Anthropic'), words.setUp.turnOff],
        'the consent does not say what it covers',
      )
      if (await page.$(`${SET_UP} [data-testid="assist-key"]`)) throw new Error('the key field stays after the company took the key')
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('the consent turned on before anyone said so')
      await page.waitForSelector('[data-testid="chat-open"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the chat does not open with a key that works')
      })
      await inspect?.('the key accepted')
      await shoot('kuna-welcome-ai-accepted')

      await pressSelector(page, press, '[data-testid="assist-set-up-switch"]')
      await switchSays(page, '[data-testid="assist-set-up-switch"]', true, 'the consent did not turn on')
      await inspect?.('the consent switched on')
      await shoot('kuna-welcome-ai-allowed')
      await pressSelector(page, press, '[data-testid="assist-set-up-continue"]')
      await page.waitForSelector('[data-testid="home-card"][data-app="company"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the key step does not go on to the home')
      })
      const [allowed, kept, pick] = await page.evaluate(() => [
        localStorage.getItem('kuna.assist-allowed.anthropic'),
        localStorage.getItem('kuna.secret.anthropic'),
        localStorage.getItem('kuna.assist-provider'),
      ])
      if (allowed !== 'on') throw new Error('the consent left Anthropic asking')
      if (kept !== MADE_UP_ANTHROPIC_KEY) throw new Error('the key was not kept')
      if (pick !== 'anthropic') throw new Error(`the assistant is on "${pick}" after the walk-through`)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A key the company refuses at the welcome (`?ai=key-refused`): not kept, the field stays open, nothing moves, and Not now goes on with no AI, with Kuna settings still offering it. */
export function kunaWelcomeAiRefusedFlowIn(language) {
  const screen = SCREEN_WORDS[language]
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await reachKeyStep(page, press, language, [screen.loans])
      await saveTypedKey(page, press, SET_UP, MADE_UP_ANTHROPIC_KEY)
      await testLineSays(page, SET_UP, words.card.refused('Anthropic'), 'the refusal of the key does not show')
      await page.waitForSelector(`${SET_UP} [data-testid="assist-get-key"]`, { visible: true, timeout: 5_000 })
      const kept = await page.evaluate(() => localStorage.getItem('kuna.secret.anthropic'))
      if (kept !== null) throw new Error('a refused key was kept')
      if (await page.$('[data-testid="chat-open"]')) throw new Error('the chat opens with a refused key')
      await inspect?.('a key refused at the welcome')
      await shoot('kuna-welcome-ai-refused')
      await pressSelector(page, press, '[data-testid="assist-set-up-later"]')
      await page.waitForSelector('[data-testid="home-card"][data-app="loans"]', { visible: true, timeout: 10_000 })
      if (await page.$('[data-testid="chat-open"]')) throw new Error('the chat shows after Not now')
      await goToRoute(page, '#/settings', '[data-testid="assist-key-steps"]')
      await inspect?.('Kuna settings after Not now')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A key whose test could not finish at the welcome (a model no preset lists): it stays kept with Test beside it and no way back, and after a reload a device with a key is not asked about AI. */
export async function kunaWelcomeAiUnfinishedFlow(page, { press, shoot, inspect }) {
  const screen = SCREEN_WORDS.en
  try {
    await page.evaluate(() => localStorage.setItem('kuna.assist-model.anthropic', 'claude-made-up-model'))
    await page.reload({ waitUntil: 'networkidle0' })
    await reachKeyStep(page, press, 'en', [screen.loans])
    await saveTypedKey(page, press, SET_UP, MADE_UP_ANTHROPIC_KEY)
    await page.waitForSelector(`${SET_UP} [data-testid="assist-key-test"]`, { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('a test that could not finish offers no second try')
    })
    if ((await page.evaluate(() => localStorage.getItem('kuna.secret.anthropic'))) !== MADE_UP_ANTHROPIC_KEY) throw new Error('a test that could not finish lost the key')
    if (await page.$('[data-testid="assist-set-up-back"]')) throw new Error('the key step offers Back with a key kept')
    if (await page.$('[data-testid="assist-set-up-chat"]')) throw new Error('the key step says the chat is open before the company took the key')
    await inspect?.('a test that could not finish')
    await shoot('kuna-welcome-ai-unfinished')
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-testid="kuna-welcome"]', { visible: true, timeout: 10_000 })
    if (await page.$('[data-testid="kuna-welcome-ai"]')) throw new Error('a device with a key is asked about AI')
    await pressButton(page, press, '[data-testid="kuna-welcome-apps"] label', screen.loans)
    await pressSelector(page, press, '[data-testid="kuna-welcome-continue"]')
    await page.waitForSelector('[data-testid="home-card"][data-app="loans"]', { visible: true, timeout: 10_000 })
  } finally {
    await forgetAssist(page)
  }
}

/** A new browser with the sync on open off and a key on the fake Drive: Get it from Google brings the key, with no switch needed first. */
export async function assistFetchKeyFlow(page, { press, shoot, inspect }) {
  try {
    await page.evaluate(() => localStorage.setItem('kuna.auto-sync', 'off'))
    await forgetAssist(page)
    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector('[data-testid="assist-fetch-key"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the no-key card on Drive does not offer Get it from Google')
    })
    await inspect?.('Get it from Google offered')
    await pressSelector(page, press, '[data-testid="assist-fetch-key"]')
    await elementSays(page, `${ANTHROPIC_ROW} [data-testid="assist-key-kept"]`, ['A key ending in 0042 is kept in this browser.'], 'Get it from Google did not bring the key')
    await inspect?.('the key fetched')
    await shoot('assist-key-fetched')
    if ((await page.evaluate(() => localStorage.getItem('kuna.secret.anthropic'))) !== MADE_UP_ANTHROPIC_KEY) throw new Error('this browser keeps another key than the fake Drive held')
  } finally {
    await page.evaluate(() => localStorage.removeItem('kuna.auto-sync'))
    await forgetAssist(page)
  }
}

/** Get it from Google with no key in the Google account says so and leaves the steps on screen. */
export async function assistFetchNoneFlow(page, { press, inspect }) {
  try {
    await pressSelector(page, press, '[data-testid="assist-fetch-key"]')
    await elementSays(page, '[data-testid="assist-fetch-line"]', [ASSIST_WORDS.en.card.fetchNone('Anthropic')], 'Get it from Google does not say the account holds no key')
    if (!(await page.$('[data-testid="assist-key-steps"]'))) throw new Error('the steps went with no key fetched')
    await inspect?.('no key in the Google account')
  } finally {
    await forgetAssist(page)
  }
}

export function deleteKeysFlowIn(language) {
  const words = language === 'hr' ? kunaSettingsCroatian : kunaSettingsEnglish
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="delete-keys"]')
    await page.waitForSelector('[data-testid="delete-keys-dialog"]', { visible: true, timeout: 5_000 })
    await delay(250)
    await inspect?.('the delete keys dialog')
    await shoot('delete-keys-dialog')
    await pressSelector(page, press, '[data-testid="delete-keys-confirm"]')
    await toast(page, words.keys.deleted)
    if (await page.$('[data-testid="delete-keys-dialog"]')) throw new Error('the delete keys dialog stayed open')
    await inspect?.('the keys deleted')
    await shoot('delete-keys-done')
  }
}
