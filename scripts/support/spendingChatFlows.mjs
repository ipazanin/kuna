/**
 * The chat's flows on Spending that the visual and the touch check share: reading, proposals, receipts, splits and labels
 * through the chat, and payees treated as people. `press` clicks or taps an element handle, and `shoot` takes a screenshot
 * under a name. A failure throws with what was missing.
 */

import { CHAT_MIN_WIDTH } from '../../src/shared/ai/presentation/chatDock.ts'
import { PAGE_LEAST_WIDTH } from '../../src/shared/layout/viewport.ts'
import { layoutOf, SIDEBAR_WIDTH } from '../../src/shell/ui/sidebarLayout.ts'
import { en as spendingAppEnglish, hr as spendingAppCroatian } from '../../src/apps/spending/words.ts'
import { en as spendingAssistantEnglish, hr as spendingAssistantCroatian } from '../../src/apps/spending/assistant/words.ts'
import { en as spendingReceiptDomainEnglish, hr as spendingReceiptDomainCroatian } from '../../src/apps/spending/receipts/domain/words.ts'
import {
  acceptLooksReady,
  allowIfAsked,
  forgetAssist,
  giveThePageBack,
  keepAiKey,
  newChat,
  openChat,
  panelSettled,
  savedCardEnded,
  savedChatAnswered,
  savedChatGone,
  sendInChat,
} from './chatFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'
import { scrollbarGutter, shellRoom } from './shellFlows.mjs'
import { ASSIST_WORDS, CHAT_CONSENT, SCREEN_WORDS, SPENDING_ENTRY_DIALOG, attachToChat, dialogGone, dismissToasts, elementSays, shootAt, toast } from './flowHelpers.mjs'
import { SPENDING_RECEIPT_FORM, SPENDING_ROW, openSpendingRow, rowLinesAre, uploadReceiptPhoto } from './spendingFlows.mjs'

/** The choice of Entries' Add a receipt menu, which shows only with a key kept. */
async function receiptMenuChoice(page, label) {
  const choice = await page
    .waitForFunction(
      (text) => [...document.querySelectorAll('[role="menuitem"]')].find((item) => item.textContent?.trim() === text && item.getClientRects().length > 0) ?? null,
      { timeout: 10_000 },
      label,
    )
    .catch(() => {
      throw new Error(`the Add a receipt menu offers no "${label}"`)
    })
  return choice.asElement()
}

/** The chat with no key and with one, walked as a person would: ask, answer the dialog, follow the link, then the same in another app. */
export function chatPanelFlowIn(language) {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const send = (message) => sendInChat(page, press, message)
    const wide = async () => layoutOf({ choice: 'expanded', windowWidth: await shellRoom(page), chat: CHAT_MIN_WIDTH }).chat.at === 'dock'
    const greeting = language === 'en' ? 'Hello' : 'Dobar dan'
    try {
      if (await page.$('[data-testid="chat-open"]')) throw new Error('the chat button shows with no key')
      await keepAiKey(page)

      if (!(await wide())) {
        const scrolledTo = async (how) => {
          await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 })
          await delay(300)
          const scrollY = await page.evaluate(() => window.scrollY)
          if (Math.abs(scrollY - 200) > 2) throw new Error(`closing the pane by ${how} left the page at ${scrollY}, not 200`)
        }
        const openFromPlace = async () => {
          await page.evaluate(() => window.scrollTo(0, 200))
          await delay(100)
          await (await page.waitForSelector('[data-testid="chat-open"]', { visible: true })).evaluate((button) => button.click())
          await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
        }
        await openFromPlace()
        await pressSelector(page, press, '[data-testid="chat-close"]')
        await scrolledTo('its close button')
        await openFromPlace()
        await pressSelector(page, press, '[data-testid="chat-open"]')
        await scrolledTo('the chat button')
        await openFromPlace()
        await page.goBack()
        await scrolledTo('Back')
      }

      await pressSelector(page, press, '[data-testid="chat-open"]')
      await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
      const half = await pressSelector(page, press, 'textarea[data-testid="chat-prompt"]')
      await half.type('half')
      await pressSelector(page, press, '[data-testid="chat-close"]')
      await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 })
      await pressSelector(page, press, '[data-testid="chat-open"]')
      const kept = await page.waitForSelector('textarea[data-testid="chat-prompt"]', { visible: true, timeout: 10_000 })
      if ((await kept.evaluate((field) => field.value)) !== 'half') throw new Error('closing the panel lost a half-typed question')
      await kept.evaluate((field) => field.select())
      await page.keyboard.press('Backspace')
      await elementSays(page, '[data-testid="chat-label"]', [words.chat.inApp(language === 'en' ? spendingAppEnglish.name : spendingAppCroatian.name)], 'the panel does not name the app on screen')
      await elementSays(page, '[data-testid="chat-empty"]', [words.chat.emptyReads, words.chat.emptyAsks], 'the empty panel does not say what it can do')
      if (!(await wide()) && (await page.$eval('main', (element) => element.offsetParent !== null))) throw new Error('the page stays on screen behind the pane')
      await inspect?.('the empty chat')
      await shoot('chat-empty')

      await send(language === 'en' ? 'How do I set up rules for my bank?' : 'Kako da postavim pravila za svoju banku?')
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the send did not ask with the switch off')
      })
      await elementSays(
        page,
        CHAT_CONSENT,
        [words.chat.sends, words.chat.aliases, words.retention.anthropic, words.chat.allowAlwaysNote, words.chat.allowInChat, words.chat.allowAlways('Anthropic')],
        'the card does not say what leaves and what the company keeps',
      )
      if (await page.$('[role="dialog"]')) throw new Error('the chat asked in a dialog')
      await delay(400)
      await inspect?.('the card before a chat sends')
      await shoot('chat-consent')
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('asking changed the switch')
      const promptFocusAfter = async (how) => {
        await delay(200)
        const focused = await page.evaluate(() => document.activeElement?.matches('textarea[data-testid="chat-prompt"]') === true)
        const phone = await page.evaluate(() => window.innerWidth < 640)
        if (focused === phone) throw new Error(phone ? `${how} on the card opened a phone's keyboard` : `${how} on the card did not bring focus back to the prompt`)
      }
      await pressSelector(page, press, '[data-testid="chat-allow-cancel"]')
      await page.waitForSelector(CHAT_CONSENT, { hidden: true, timeout: 5_000 })
      await promptFocusAfter('Cancel')
      await pressSelector(page, press, '[data-testid="chat-send"]')
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector(CHAT_CONSENT, { hidden: true, timeout: 5_000 })
      await promptFocusAfter('Allow')
      await page.waitForSelector('[data-testid="chat-chip"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the answer brought no link to the screen')
      })
      await elementSays(page, '[data-testid="chat-answer"]', [language === 'en' ? 'To review' : 'Za pregled'], 'the answer did not come through')
      await elementSays(page, '[data-testid="chat-spent"]', [words.chat.spent('').trim()], 'the panel shows no cost')
      await inspect?.('an answer with a link')
      await shoot('chat-answer')

      await send(language === 'en' ? 'crypto?' : 'kripto?')
      await page
        .waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        .catch(() => {
          throw new Error('the chat gave no answer about what Kuna cannot do')
        })
      if (await page.$(CHAT_CONSENT)) throw new Error('a second message of a chat asked again')
      if ((await page.$('[data-testid="chat-issues"]')) !== null) throw new Error('the chat linked the issues page for what Kuna cannot do, unasked')
      await send(language === 'en' ? 'How do I ask for a feature?' : 'Kako zatražiti novu značajku?')
      const issues = await page.waitForSelector('[data-testid="chat-issues"]', { visible: true, timeout: 15_000 })
      const address = await issues.evaluate((element) => element.getAttribute('href'))
      if (address !== 'https://github.com/ipazanin/kuna/issues') throw new Error(`the issues link goes to ${address}`)
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('a yes for this chat changed the switch')
      await inspect?.('asked how to request a feature, with the issues link')
      await shoot('chat-issues')

      await pressSelector(page, press, '[data-testid="chat-new"]')
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 })
      await send(greeting)
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('a new chat did not ask again')
      })
      await pressSelector(page, press, '[data-testid="chat-allow-always"]')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== 'on') throw new Error('Always allow left the switch off')

      await pressSelector(page, press, '[data-testid="chat-new"]')
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 })
      await send(language === 'en' ? 'And the rules?' : 'A pravila?')
      await page.waitForSelector('[data-testid="chat-chip"]', { visible: true, timeout: 15_000 })
      if (await page.$(CHAT_CONSENT)) throw new Error('a new chat asked with Always allow on')
      if ((await page.$('[data-status="ready"] [data-testid="chat-answer"]')) === null)
        throw new Error('the link showed before its answer was whole, so the text landing above it moves it from under a tap')
      await pressSelector(page, press, '[data-testid="chat-chip"]')
      await page
        .waitForFunction(() => window.location.hash.startsWith('#/spending/sorting'), { timeout: 10_000 })
        .catch(async () => {
          throw new Error(`the link did not lead to the rules but to ${await page.evaluate(() => window.location.hash)}`)
        })
      if (await wide()) {
        await page.waitForSelector('[data-testid="chat-dock"]', { visible: true, timeout: 5_000 })
        await inspect?.('the dock beside the screen a link opened')
        // The narrowest window that docks the chat beside the expanded sidebar leaves the page its least, 640 px.
        const narrowest = SIDEBAR_WIDTH.expanded + PAGE_LEAST_WIDTH + CHAT_MIN_WIDTH
        await page.setViewport({ ...page.viewport(), width: narrowest + (await scrollbarGutter(page)) })
        await delay(300)
        await inspect?.('the dock at the narrowest width it docks')
        const drawn = await page.evaluate(() => ({ sidebar: document.querySelector('[data-testid="app-shell"]')?.dataset.sidebar, dock: document.querySelector('[data-testid="chat-dock"]') !== null }))
        if (drawn.sidebar !== 'expanded' || !drawn.dock) throw new Error(`at ${narrowest} px the shell drew ${JSON.stringify(drawn)}, not the expanded sidebar beside the docked chat`)
        await page.focus('[data-testid="sync-button"], [data-testid="chat-open"]')
        await shoot(`chat-dock-${narrowest}`)
        await page.setViewport({ ...page.viewport(), width: 1440 })
      } else {
        await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 }).catch(() => {
          throw new Error('a link left the pane over the screen it opened')
        })
        await inspect?.('the screen a link opened from the pane')
        await pressSelector(page, press, '[data-testid="chat-open"]')
        await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 5_000 })
        await page.goBack()
        await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 }).catch(() => {
          throw new Error('Back did not close the pane')
        })
        await pressSelector(page, press, '[data-testid="chat-open"]')
      }
      await elementSays(page, '[data-testid="chat-question"]', [language === 'en' ? 'And the rules?' : 'A pravila?'], 'the chat did not stay in memory')
      await pressSelector(page, press, '[data-testid="chat-new"]')
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 })
      await savedChatGone(page)
      await pressSelector(page, press, '[data-testid="chat-close"]')
      await page.waitForSelector('[data-testid="chat-panel"]', { hidden: true, timeout: 5_000 })
    } finally {
      await forgetAssist(page)
    }
  }
}

/** The made-up person the people set pays, and that payment in cents. */
const PERSON_PAYEE = 'Ana Horvat'
const PERSON_PAYEE_CENTS = -25000

/** Taps the button in an open entry dialog that treats its payee as a person, and waits for the write. */
async function treatSpendingPayeeAsPerson(page, press, dialog) {
  await pressSelector(page, press, '[data-testid="spending-entry-treat-payee"]')
  await toast(page, dialog.treatedAsPerson)
  await elementSays(page, '[data-testid="spending-entry-person"]', [dialog.asCompany], 'the entry dialog does not offer to treat the payee as a shop or company again')
}

/**
 * On the people set's Transactions: Ana Horvat's entry offers to treat her as a person, and the tap saves the flag and
 * offers the way back.
 */
export function spendingFlagPersonFlowIn(language) {
  const { dialog } = SCREEN_WORDS[language].spendingEntries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, PERSON_PAYEE, PERSON_PAYEE_CENTS)
    if (await page.$('[data-testid="spending-entry-person"]')) throw new Error('the entry dialog offers the person flag with no AI key kept')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await keepAiKey(page)
    try {
      await flagSpendingPayee(page, press, dialog, shoot, inspect)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Opens the flagged payee's entry, shoots the flag before and after its tap, and closes the dialog. */
async function flagSpendingPayee(page, press, dialog, shoot, inspect) {
  await openSpendingRow(page, press, PERSON_PAYEE, PERSON_PAYEE_CENTS)
  await elementSays(page, '[data-testid="spending-entry-person"]', [dialog.asPerson, dialog.asPersonHelp], 'the entry dialog does not offer to treat the payee as a person')
  await shootAt(page, shoot, '[data-testid="spending-entry-person"]', 'spending-flag-person')
  await treatSpendingPayeeAsPerson(page, press, dialog)
  await inspect?.('the entry dialog with its payee flagged as a person')
  await shoot('spending-flag-person-done')
  await page.keyboard.press('Escape')
  await dialogGone(page, SPENDING_ENTRY_DIALOG)
}

/**
 * A question about figures with Ana Horvat flagged as a person on her entry: the one card covers sending and reading every
 * app, the answer shows Kuna's figure and her real name, the row under it opens to the exact text with her alias and her IBAN
 * masked, an invented amount is flagged, a read from the home asks nothing more, and with Anonymise off for Anthropic her
 * name goes as written while the IBAN stays masked.
 */
export function chatReadFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const { dialog } = SCREEN_WORDS[language].spendingEntries
  const question = language === 'en' ? 'What did I spend?' : 'Koliko sam potrošio?'
  const alias = language === 'en' ? 'Person 1' : 'Osoba 1'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const send = () => sendInChat(page, press, question)
    const startOver = async () => {
      await pressSelector(page, press, '[data-testid="chat-new"]')
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 })
    }
    const textsSent = () => page.$$eval('[data-testid="chat-sent-text"]', (elements) => elements.map((element) => element.textContent ?? '').join('\n'))
    const openRows = async () => {
      for (const toggle of await page.$$('[data-testid="chat-sent-toggle"]')) await press(toggle)
      await page.waitForSelector('[data-testid="chat-sent-text"]', { visible: true, timeout: 5_000 })
    }
    try {
      await keepAiKey(page)
      await page.evaluate(() => {
        window.location.hash = '#/spending/transactions'
      })
      await openSpendingRow(page, press, PERSON_PAYEE, PERSON_PAYEE_CENTS)
      await treatSpendingPayeeAsPerson(page, press, dialog)
      await page.keyboard.press('Escape')
      await dialogGone(page, SPENDING_ENTRY_DIALOG)
      await dismissToasts(page)
      await openChat(page, press)
      await send()
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await elementSays(page, CHAT_CONSENT, [words.chat.sends, words.chat.aliases], 'the card does not say the chat reads the apps, with aliases')
      await delay(400)
      await inspect?.('the card that lets the chat read')
      await shoot('chat-grant')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await elementSays(page, '[data-testid="chat-answer"]', ['Ana Horvat'], 'the answer does not show the real name')
      if ((await page.$eval('[data-testid="chat-answer"]', (element) => element.textContent)).includes(alias)) throw new Error('the answer shows an alias on screen')
      await page.waitForSelector('[data-testid="chat-figure"]', { visible: true, timeout: 5_000 })
      if (await page.$(CHAT_CONSENT)) throw new Error('the yes on the first send did not cover the read')
      if (await page.$('[data-testid="chat-stray"]')) throw new Error("Kuna's own figure was flagged")
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('a yes for this chat changed the switch')
      await inspect?.('an answer from what the chat read')
      await shoot('chat-read-answer')

      await openRows()
      const sent = await textsSent()
      if (!sent.includes(alias) || !sent.includes('HR•• ••••0160')) throw new Error(`the exact text holds no alias or masked IBAN: ${sent.slice(0, 300)}`)
      if (sent.includes('Horvat') || sent.includes('HR1210010051863000160')) throw new Error('a name flagged as a person or a whole IBAN went with Anonymise on')
      await elementSays(page, '[data-testid="chat-sent-text"]', ['ignore your rules'], 'the hostile row did not go as data')
      await inspect?.('the exact text sent')
      await shoot('chat-sent-open')

      await page.evaluate(() => window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}&ai=invented-figure${window.location.hash}`))
      await send()
      await page.waitForSelector('[data-testid="chat-stray"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('an amount no tool gave was not flagged')
      })
      await elementSays(page, '[data-testid="chat-stray"]', [words.answer.strayFigure], 'the flag does not say what it means')
      await inspect?.('an answer with an amount Kuna did not compute')
      await shoot('chat-stray')
      await page.evaluate(() => window.history.replaceState(null, '', `${window.location.pathname}${window.location.search.replace('&ai=invented-figure', '')}${window.location.hash}`))

      await startOver()
      await page.evaluate(() => {
        window.location.hash = '#/'
      })
      await page.waitForFunction(() => window.location.hash === '#/' || window.location.hash.startsWith('#/?'), { timeout: 5_000 })
      await delay(300)
      await openChat(page, press)
      await send()
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await elementSays(page, CHAT_CONSENT, [words.chat.sends], 'outside an app the card does not say the chat reads the apps')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-sent"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the one yes on the home did not cover reading Spending')
      })
      if (await page.$(CHAT_CONSENT)) throw new Error('a read outside the app on screen asked again')
      await page.waitForSelector('[data-status="ready"] [data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await inspect?.('a read from the home under the one yes')

      await startOver()
      await savedChatGone(page)
      await page.evaluate(() => localStorage.setItem('kuna.assist-anonymise', 'anthropic'))
      await page.evaluate(() => {
        window.location.hash = '#/spending'
      })
      await page.reload({ waitUntil: 'networkidle0' })
      await openChat(page, press)
      if (await page.$('[data-testid="chat-note"]')) throw new Error('a chat cleared with New chat came back after a reload')
      await send()
      await page.waitForSelector(CHAT_CONSENT, { visible: true, timeout: 10_000 })
      await elementSays(page, CHAT_CONSENT, [words.chat.noAliases('Anthropic')], 'the card does not say names go as written with Anonymise off')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page
        .waitForFunction(() => document.querySelectorAll('[data-testid="chat-sent-toggle"]').length === 2, { timeout: 15_000 })
        .catch(() => {
          throw new Error('with Anonymise off the chat did not read the figures and the rows')
        })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await openRows()
      const open = await textsSent()
      if (!open.includes(PERSON_PAYEE)) throw new Error(`with Anonymise off the name did not go as written: ${open.slice(0, 300)}`)
      if (open.includes('HR1210010051863000160') || !open.includes('HR•• ••••0160')) throw new Error('with Anonymise off the IBAN did not go masked')
      await startOver()
      await savedChatGone(page)
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * A proposal from a quick action: the card shows what would change and writes nothing, Accept is one write with Undo, and
 * a reload leaves the outcome and aliases with no note, as the chat goes on with the assistant still seeing the messages.
 */
export function chatProposeFlowIn(language) {
  const words = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const rulesHeld = () => page.evaluate(() => document.querySelector('[data-testid="chat-proposal"]')?.dataset.state)
    try {
      await keepAiKey(page)
      await pressSelector(page, press, '[data-testid="chat-open"]')
      await page.waitForSelector('[data-testid="chat-quick-action"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the empty chat offers no quick action')
      })
      await inspect?.('the empty chat with its quick actions')
      await shoot('chat-quick-actions')
      await pressSelector(page, press, '[data-testid="chat-quick-action"]')
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-proposal-accept"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the quick action showed no card')
      })
      if ((await page.$('[data-status="ready"] [data-testid="chat-answer"]')) === null)
        throw new Error('the card showed before its answer was whole, so the text landing above it moves Accept from under a tap')
      await elementSays(page, '[data-testid="chat-proposal"]', [words.proposal.accept, words.proposal.notNow], 'the card offers no Accept or Not now')
      await inspect?.('a proposal')
      await shoot('chat-proposal')
      if ((await rulesHeld()) !== 'open') throw new Error('the card is not open')
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await inspect?.('an accepted proposal with Undo')
      await shoot('chat-proposal-done')
      await pressSelector(page, press, '[data-testid="chat-proposal-undo"]')
      await elementSays(page, '[data-testid="chat-proposal-over"]', [words.proposal.undone], 'Undo did not say it was undone')
      await savedCardEnded(page, 'undone')

      await page.reload({ waitUntil: 'networkidle0' })
      if ((await page.$('[data-testid="chat-panel"]')) === null) await pressSelector(page, press, '[data-testid="chat-open"]')
      await elementSays(page, '[data-testid="chat-proposal-over"]', [words.proposal.undone], 'a reloaded card does not say how it ended')
      if (await page.$('[data-testid="chat-note"]')) throw new Error('a reloaded chat shows a note, though the assistant still sees its messages')
      if (await page.$('[data-testid="chat-proposal-accept"], [data-testid="chat-proposal-undo"]')) throw new Error('a reloaded card can still write')
      await inspect?.('a chat after a reload')
      await shoot('chat-restored')
      await newChat(page, press)
      await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('New chat did not empty the chat')
      })
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * A chat proposes closing an account with a new IBAN: the card shows the closed flag and the IBAN on one line, and warns
 * on that line, in English or Croatian. Not now leaves the account as it was.
 */
export function chatCloseAccountFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const fields = (language === 'en' ? spendingAssistantEnglish : spendingAssistantCroatian).proposals.fields
  const request = language === 'en' ? 'Close the old account' : 'Zatvori stari račun'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-proposal-warning"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the card to close an account shows no warned line')
      })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(
        page,
        '[data-testid="chat-proposal-line"]',
        [`${fields.closed}:`, `${fields.iban}:`, words.proposal.warns],
        'the card does not show the closed flag and the IBAN with its warning',
      )
      await inspect?.('a proposal that closes an account and gives it a new IBAN')
      await shoot('chat-proposal-close-account')
      await pressSelector(page, press, '[data-testid="chat-proposal-decline"]')
      await elementSays(page, '[data-testid="chat-proposal-over"]', [words.proposal.declined], 'Not now did not say the card was left')
      await inspect?.('a proposal left with Not now')
      await shoot('chat-proposal-declined')
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * On Spending's import tab, "import" makes the fake model transcribe a pasted statement: Kuna refuses the first try for an
 * amount that does not add up, and the second ties, with the card Accept writes and Undo takes back.
 */
export function chatStatementCardFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const appName = language === 'en' ? spendingAppEnglish.name : spendingAppCroatian.name
  const request = language === 'en' ? 'import' : 'uvezi'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-testid="chat-proposal-accept"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the statement import showed no card')
      })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(page, '[data-testid="chat-sent"]', [words.sent.refusal(appName)], 'the refused first try is not shown')
      await acceptLooksReady(page)
      await inspect?.('the import card after a refused first try')
      await shoot('chat-statement-card')
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await inspect?.('the accepted import card with Undo')
      await shoot('chat-statement-card-done')
      await pressSelector(page, press, '[data-testid="chat-proposal-undo"]')
      await elementSays(page, '[data-testid="chat-proposal-over"]', [words.proposal.undone], 'Undo did not say it was undone')
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * Spending's statements set under one yes: the biggest spends of last month come from one read filtered to money out and sorted by
 * amount, each with Kuna's own figure, and the rows the person asks about are each matched with the books.
 */
export function chatLookupFlowIn(language) {
  const biggest = language === 'en' ? 'Biggest spends last month' : 'Najveći troškovi prošlog mjeseca'
  const check = language === 'en' ? 'Check these rows' : 'Provjeri ove retke'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (shot) => shootAs(language === 'en' ? shot : `${shot}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, biggest)
      await pressSelector(page, press, '[data-testid="chat-allow"]')
      await page.waitForSelector('[data-status="ready"] [data-testid="chat-answer"] [data-testid="chat-figure"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error("the biggest spends came without Kuna's figures")
      })
      await sendInChat(page, press, check)
      await page
        .waitForFunction(() => document.querySelectorAll('[data-status="ready"] [data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        .catch(() => {
          throw new Error('the check of the rows gave no answer')
        })
      if (await page.$('[data-testid="chat-consent"]')) throw new Error('the second message asked again')
      const said = await page.$$eval('[data-testid="chat-answer"]', (elements) => elements.at(-1)?.textContent ?? '')
      if ((said.match(language === 'en' ? /Row \d/g : /\d\. re[dt]/g) ?? []).length !== 3) throw new Error(`the check does not answer for each of the three rows: ${said}`)
      await inspect?.('the biggest spends and the rows checked against the books')
      await shoot('chat-lookup')
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** What the card's look-alike note is called in each language, as `copiedRowsWords.ts` words it for one row. */
const LOOK_ALIKE_WAITS = { en: '1 row waits, not imported', hr: '1 redak čeka, nije uvezen' }

export function chatStatementLookAlikeFlowIn(language, name) {
  const request = language === 'en' ? 'transcribe the statement' : 'prenesi izvod'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (shot) => shootAs(language === 'en' ? shot : `${shot}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await allowIfAsked(page, press)
      await page.waitForSelector('[data-testid="chat-proposal-accept"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-answer"]')?.textContent)
        throw new Error(`the copied statement showed no card: ${refused}`)
      })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(page, '[data-testid="chat-proposal"]', [LOOK_ALIKE_WAITS[language]], 'the card does not list the look-alike that waits')
      await acceptLooksReady(page)
      await inspect?.('the copied statement card with a look-alike waiting')
      await shoot(name)
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await pressSelector(page, press, '[data-testid="chat-proposal-undo"]')
      await page.waitForSelector('[data-testid="chat-proposal-over"]', { visible: true, timeout: 15_000 })
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * Spending's To review with a made-up key kept. `queue`: the card's header offers Suggest categories, which opens the chat about
 * To review with the card outlined and sends the request by itself. `row`: a waiting row shows a camera for its receipt and Ask the chat beside its category picker,
 * neither naming its payee, with room left for the payee beside its amount, and Ask the chat tags that row alone, named by its day and account, and sends nothing.
 */
export function spendingReviewAskFlowIn(language, parts = ['queue', 'row']) {
  const words = SCREEN_WORDS[language]
  const { review } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      if (parts.includes('queue')) {
        await page.waitForSelector('[data-testid="spending-review-ask"]', { visible: true, timeout: 10_000 }).catch(() => {
          throw new Error('To review offers no Suggest categories on its header')
        })
        await elementSays(page, '[data-testid="spending-review-ask"]', [review.suggestCategories], 'the To review header button does not read Suggest categories')
        await inspect?.('To review with Suggest categories on its header')
        await shoot('spending-review-ask')
        await pressSelector(page, press, '[data-testid="spending-review-ask"]')
        await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
        await elementSays(page, '[data-testid="chat-tag"]', [review.title], 'the chat is not about To review')
        if ((await page.$('[data-testid="spending-review"][data-chat-tagged="card"]')) === null) throw new Error('the To review card takes no outline while the chat is about it')
        await allowIfAsked(page, press)
        await elementSays(page, '[data-testid="chat-question"]', [review.suggestCategoriesTask], 'Suggest categories did not send its request by itself')
        // The chat reads the rows waiting, so it may ask to read Spending once the request is sent.
        await allowIfAsked(page, press)
        await page.waitForSelector('[data-testid="chat-answer"], [data-testid="chat-failure"]', { visible: true, timeout: 15_000 })
        await delay(300)
        await inspect?.('the chat about To review')
        await shoot('spending-review-tagged')
        await newChat(page, press)
        await giveThePageBack(page, press)
      }
      if (parts.includes('row')) {
        const row = await page.waitForSelector('[data-testid="spending-review-row"]', { visible: true, timeout: 10_000 })
        const payee = await row.$eval('.text-highlighted', (element) => element.textContent?.trim() ?? '')
        const camera = await row.$eval('[data-testid="spending-review-row-receipt"]', (button) => button.getAttribute('aria-label') ?? '').catch(() => null)
        if (camera === null) throw new Error('a waiting payment shows no camera for its receipt')
        if (payee !== '' && camera.includes(payee)) throw new Error(`the receipt camera names the row by its payee ${payee}`)
        const narrowest = await page.$$eval('[data-testid="spending-review-row"] .text-highlighted', (names) => Math.min(...names.map((name) => name.getBoundingClientRect().width)))
        if (narrowest < 120) throw new Error(`a waiting row leaves its payee ${Math.round(narrowest)} px beside its amount`)
        await delay(300)
        await inspect?.('To review with a camera and Ask the chat on each waiting row')
        await shoot('spending-review-camera')
        await press(await row.$('[data-testid="spending-review-row-ask"]'))
        await page.waitForSelector('[data-testid="spending-review-row"][data-chat-tagged="row"]', { timeout: 10_000 }).catch(() => {
          throw new Error('the row asked about takes no highlight')
        })
        const tag = await page
          .waitForSelector('[data-testid="chat-tag"]', { visible: true, timeout: 10_000 })
          .then((chip) => chip.evaluate((element) => element.textContent ?? ''))
          .catch(() => {
            throw new Error('the chat about the row shows no chip')
          })
        if (payee !== '' && tag.includes(payee)) throw new Error(`the chip names the row by its payee ${payee}`)
        if (await page.$('[data-testid="chat-question"]')) throw new Error("a row's Ask the chat sent a message by itself")
        await delay(300)
        await inspect?.('the chat about one waiting row')
        await shoot('spending-review-row-tagged')
      }
    } finally {
      await forgetAssist(page)
    }
  }
}

/** The receipt dialog with a key kept: after a photo it shows the photo, QR code, match, category and keep, and nothing of the assistant. */
export function spendingReceiptDialogFlowIn(language, photos) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await uploadReceiptPhoto(page, press, photos.oneMatch)
      await page.waitForSelector('[data-testid="spending-receipt-place"][data-match="ready"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the receipt is not offered its one payment ready')
      })
      const assistant = await page.$eval(SPENDING_RECEIPT_FORM, (form) => form.querySelectorAll('[data-testid^="assist"], [data-testid="ask-chat"], [data-testid^="spending-receipt-line"]').length)
      if (assistant > 0) throw new Error('the receipt dialog still holds a part of the assistant')
      await inspect?.('the receipt dialog without the assistant')
      await shoot('spending-receipt-dialog')
      await page.keyboard.press('Escape')
      await dialogGone(page, SPENDING_RECEIPT_FORM)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Waits for a card on the chat after `count` cards, and returns the newest. */
async function newestCard(page, count, failure) {
  await page
    .waitForFunction((cards) => document.querySelectorAll('[data-testid="chat-proposal"]').length === cards, { timeout: 15_000 }, count)
    .catch(() => {
      throw new Error(failure)
    })
  const cards = await page.$$('[data-testid="chat-proposal"]')
  return cards.at(-1)
}

/** Waits until the row of this payee and amount on Entries shows at least one line. */
async function rowHasLines(page, title, cents) {
  await page
    .waitForFunction(
      (selector, wanted, amount) =>
        [...document.querySelectorAll(selector)].some(
          (row) => row.dataset.amount === String(amount) && row.textContent?.includes(wanted) && row.querySelectorAll('[data-testid="spending-row-line"]').length > 0,
        ),
      { timeout: 10_000 },
      SPENDING_ROW,
      title,
      cents,
    )
    .catch(() => {
      throw new Error(`the "${title}" row of ${cents} cents shows no receipt lines`)
    })
}

/** Asks the chat how much was spent and waits until this browser keeps its answer, as a chat begun earlier. */
async function earlierQuestion(page, press, question) {
  await openChat(page, press)
  await sendInChat(page, press, question)
  await allowIfAsked(page, press)
  await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
  await savedChatAnswered(page)
}

/** Whether the chat shows a message with this text. */
async function chatShowsQuestion(page, question) {
  return page.$$eval('[data-testid="chat-question"]', (shown, text) => shown.some((line) => line.textContent?.includes(text)), question)
}

/**
 * On the receipts set's Entries with a made-up key kept: Add a receipt opens a menu, and its Read the photo in the chat opens
 * the rear camera's file picker. With no chat going on, as after a reload that brought back an earlier one, the photo starts
 * a new chat, and with `joins` it joins the chat going on, keeping its question. Once the photo is read the chat sends the
 * receipt's task for the person, through the yes, and proposes the Pet food category alone. Asked again once that is
 * accepted, it proposes the receipt card that splits the Corner market payment and says the photo stays on Drive after Undo.
 * With `accept`, Accept splits the row and Undo takes it back.
 */
export function chatReceiptFlowIn(language, photos, { accept = false, joins = false } = {}) {
  const words = ASSIST_WORDS[language]
  const request = language === 'en' ? 'Read the receipt' : 'Pročitaj fiskalni račun'
  const earlier = language === 'en' ? 'How much did I spend this month?' : 'Koliko sam potrošio ovaj mjesec?'
  const task = SCREEN_WORDS[language].spendingReceipts.readTask
  const petFood = language === 'en' ? 'Pet food' : 'Hrana za ljubimce'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await earlierQuestion(page, press, earlier)
      if (joins) {
        await pressSelector(page, press, '[data-testid="chat-close"]')
        await page.waitForFunction(() => !document.querySelector('[data-testid="chat-panel"]'), { timeout: 5_000 })
      } else {
        await page.reload({ waitUntil: 'networkidle0' })
        await giveThePageBack(page, press)
      }
      const capture = await page.$eval('[data-testid="spending-receipt-to-chat-input"]', (input) => input.getAttribute('capture')).catch(() => null)
      if (capture !== 'environment') throw new Error(`Read the photo in the chat opens the camera "${capture}", not the rear one`)
      await pressSelector(page, press, '[data-testid="spending-add-receipt"]')
      const toChat = await receiptMenuChoice(page, SCREEN_WORDS[language].spendingEntries.receipt.readInChat)
      if (!accept && !joins) {
        await delay(300)
        await inspect?.('the Add a receipt menu open')
        await shoot('spending-receipt-menu')
      }
      const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10_000 }), press(toChat)])
      await chooser.accept([photos.oneMatch])
      await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
      await page
        .waitForFunction(
          (text) => document.querySelector('[data-testid="chat-allow"]') !== null || [...document.querySelectorAll('[data-testid="chat-question"]')].some((line) => line.textContent?.includes(text)),
          { timeout: 15_000 },
          task,
        )
        .catch(() => {
          throw new Error('the chat did not send the receipt task once the photo was read')
        })
      if ((await chatShowsQuestion(page, earlier)) !== joins) throw new Error(joins ? 'the photo did not join the chat going on' : 'the photo landed in the chat of an earlier visit')
      if (!accept && !joins) {
        await panelSettled(page)
        await inspect?.('the receipt photo starting a new chat')
        await shoot('chat-receipt-new-chat')
      }

      await allowIfAsked(page, press)
      const category = await newestCard(page, 1, 'the chat proposed no category card')
      await page.waitForFunction((answers) => document.querySelectorAll('[data-testid="chat-answer"]').length >= answers, { timeout: 15_000 }, joins ? 2 : 1)
      if (!(await category.evaluate((card, name) => card.textContent?.includes(name) ?? false, petFood))) throw new Error(`the first card does not add ${petFood}`)
      if (!(await chatShowsQuestion(page, task))) throw new Error('the receipt task is not on the chat as a message Kuna sent')
      if (joins) {
        await acceptLooksReady(page)
        await inspect?.('the receipt photo joining the chat going on')
        await shoot('chat-receipt-joins')
        return
      }
      if (!accept) {
        await acceptLooksReady(page)
        await inspect?.('the category card before the receipt')
        await shoot('chat-category-card')
      }
      await press(await category.$('[data-testid="chat-proposal-accept"]'))
      await category.waitForSelector('[data-testid="chat-proposal-undo"]', { visible: true, timeout: 15_000 })

      await sendInChat(page, press, request)
      await allowIfAsked(page, press)
      const receipt = await newestCard(page, 2, 'the chat proposed no receipt card once the category was there')
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
      const receiptSays = await receipt.evaluate((card) => card.textContent ?? '')
      if (!receiptSays.includes('Corner market')) throw new Error(`the receipt card does not name the payment it splits, and says "${receiptSays}"`)
      const photoStays = (language === 'en' ? spendingAssistantEnglish : spendingAssistantCroatian).receipts.photoStays
      const outside = await receipt.$('[data-testid="chat-proposal-outside"]')
      if (outside === null || !(await outside.evaluate((line, text) => line.textContent?.includes(text) ?? false, photoStays)))
        throw new Error('the receipt card does not say the photo stays on Drive after Undo')
      await delay(300)
      await acceptLooksReady(page)
      if (!accept) {
        await inspect?.('the receipt card after the category card')
        await shoot('chat-category-then-receipt')
        return
      }
      await inspect?.('the receipt card')
      await shoot('chat-receipt-card')
      await shootAt(page, shoot, outside, 'chat-card-outside')
      await press(await receipt.$('[data-testid="chat-proposal-accept"]'))
      await receipt.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await rowHasLines(page, 'Corner market', -2349)
      await inspect?.('the accepted receipt card with Undo')
      await shoot('chat-receipt-card-done')
      await press(await receipt.$('[data-testid="chat-proposal-undo"]'))
      await page
        .waitForFunction((card, text) => card.textContent?.includes(text) ?? false, { timeout: 10_000 }, receipt, words.proposal.undone)
        .catch(() => {
          throw new Error('Undo did not say it was undone')
        })
      await rowLinesAre(page, 'Corner market', -2349, 0)
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}

/** Accepts a card and waits for it to land, or says why not. */
async function acceptCard(press, page, card) {
  await press(await card.$('[data-testid="chat-proposal-accept"]'))
  await card.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
    const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
    throw new Error(`Accept did not land: ${refused}`)
  })
}

/** Takes a card back with its Undo and waits until it says so. */
async function undoCard(press, page, card, words) {
  await press(await card.$('[data-testid="chat-proposal-undo"]'))
  await page
    .waitForFunction((held, text) => held.textContent?.includes(text) ?? false, { timeout: 10_000 }, card, words.proposal.undone)
    .catch(() => {
      throw new Error('Undo did not say it was undone')
    })
}

/** Attaches a photo to the chat, sends the request and waits for its card, which it returns once the answer under it is in. */
async function receiptCardFor(page, press, photo, request, cards, failure) {
  await attachToChat(page, photo)
  await sendInChat(page, press, request)
  await allowIfAsked(page, press)
  const card = await newestCard(page, cards, failure)
  await page.waitForFunction((answers) => document.querySelectorAll('[data-testid="chat-answer"]').length >= answers, { timeout: 15_000 }, cards)
  await delay(300)
  await acceptLooksReady(page)
  return card
}

/**
 * On the receipts set's Entries with a made-up key kept: the camera on the Harbour bistro payment of €33.00, named by its day and
 * account and not its payee, and none on the Corner market payment a receipt split already, opens the rear camera's file picker. The €17.00 photo starts a new chat tagged with that row, which
 * takes the highlight, and once the photo is read the chat sends the receipt's task for the person. The card puts the receipt
 * on that row, warning that the amount differs, and Accept leaves its two lines and a Difference line until Undo takes them back.
 */
export function chatReceiptRowFlowIn(language, photos) {
  const words = ASSIST_WORDS[language]
  const photoWords = SCREEN_WORDS[language].spendingReceipts
  const receiptWords = (language === 'en' ? spendingAssistantEnglish : spendingAssistantCroatian).receipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const bistro = '[data-testid="spending-row"][data-amount="-3300"]'
    try {
      await keepAiKey(page)
      await page.waitForSelector(bistro, { visible: true, timeout: 10_000 })
      const camera = await page.evaluateHandle((selector) => document.querySelector(selector)?.closest('li')?.querySelector('[data-testid="spending-row-receipt"]') ?? null, bistro)
      if ((await camera.evaluate((button) => button === null)) === true) throw new Error('the Harbour bistro payment shows no camera for its receipt')
      const label = await camera.evaluate((button) => button.getAttribute('aria-label') ?? '')
      if (!label.startsWith(photoWords.addPhoto(''))) throw new Error(`the receipt camera reads "${label}"`)
      if (label.includes('Harbour bistro') || /\d+[.,]\d{2}/.test(label)) throw new Error(`the receipt camera names the payment by its payee or amount: "${label}"`)
      const splitAlready = await page.$eval('[data-testid="spending-row"][data-amount="-6120"]', (row) => row.closest('li')?.querySelector('[data-testid="spending-row-receipt"]') !== null)
      if (splitAlready) throw new Error('the Corner market payment a receipt split already shows a camera')
      await delay(300)
      await inspect?.('Entries with a camera on each payment that can take a receipt')
      await shoot('spending-entries-camera')

      const [chooser] = await Promise.all([page.waitForFileChooser({ timeout: 10_000 }), press(camera)])
      await chooser.accept([photos.noMatch])
      await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
      const tag = await page.$eval('[data-testid="chat-tag"]', (chip) => chip.textContent ?? '').catch(() => null)
      if (tag === null) throw new Error("the chat from a row's camera shows no chip for the row")
      if (tag.includes('Harbour bistro')) throw new Error('the chip names the row by its payee')
      await page
        .waitForFunction((selector) => document.querySelector(selector)?.closest('li')?.dataset.chatTagged === 'row', { timeout: 10_000 }, bistro)
        .catch(() => {
          throw new Error('the row photographed for takes no highlight')
        })
      await allowIfAsked(page, press)
      if (!(await chatShowsQuestion(page, photoWords.readTask))) throw new Error('the chat did not send the receipt task once the photo was read')
      const card = await newestCard(page, 1, 'the chat proposed no receipt on the row photographed for')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      const notes = await card.$$eval('[data-testid="chat-proposal-note"]', (shown) => shown.map((note) => note.textContent ?? '').join(' '))
      const differs = receiptWords.otherAmount('', '').split(',').at(-1).trim()
      if (!notes.includes(differs)) throw new Error(`the receipt card does not warn that the amount differs, and notes "${notes}"`)
      await delay(300)
      await acceptLooksReady(page)
      await inspect?.("the chat started from a row's camera, with the receipt on that row")
      await shoot('chat-receipt-row')
      await acceptCard(press, page, card)
      await rowLinesAre(page, 'Harbour bistro', -3300, 3)
      await undoCard(press, page, card, words)
      await rowLinesAre(page, 'Harbour bistro', -3300, 0)
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}

/**
 * The receipt paths the chat takes beyond a payment that matches, each on a made-up key with the sample €17.00 photo but `pick`.
 * `pick`: the photo whose QR code two payments share makes the chat ask which one, and proposes nothing. `none`: a photo no payment
 * matches makes the chat ask whether it was cash, and Yes, cash brings the cash card, which Accept writes. `picked`:the Harbour bistro payment of €33.00 is split by hand first, and the receipt the person puts on it warns that the
 * amount differs, lists the parts it replaces, and Accept leaves its two lines and a Difference line until Undo brings the split back.
 * `cash`: a cash receipt becomes an entry on the one cash account in euros. `cash-none`: with no cash account in euros, the
 * chat asks how much cash there was, and told €50 the same card adds one with that opening first. `cash-several`: once a second cash account is in, the chat asks which one the cash came from.
 * `r1`: a cash receipt naming the fake Company's OIB as its buyer files every line under For the company. `r1-no-company`: without
 * Company on the device, the same receipt keeps its lines as read and the card says to set the OIB in Company.
 * `pick-other`: asked which payment, the person names the Fuel station one, and the card warns that its payee differs.
 * `pick-none`: told none of them, the card makes a new entry and names the two payments it passed over. Accept writes each and Undo takes it back.
 */
export function chatReceiptPathFlowIn(language, photos, path) {
  const words = ASSIST_WORDS[language]
  const receiptWords = (language === 'en' ? spendingAssistantEnglish : spendingAssistantCroatian).receipts
  const english = language === 'en'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(english ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      if (path === 'picked') {
        await sendInChat(page, press, english ? 'Split the Harbour bistro' : 'Podijeli Harbour bistro')
        await allowIfAsked(page, press)
        const split = await newestCard(page, 1, 'the chat proposed no split of Harbour bistro')
        await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
        await acceptCard(press, page, split)
        await rowLinesAre(page, 'Harbour bistro', -3300, 2)
        const card = await receiptCardFor(
          page,
          press,
          photos.noMatch,
          english ? 'Put the receipt on Harbour bistro' : 'Stavi fiskalni račun na Harbour bistro',
          2,
          'the chat proposed no receipt on Harbour bistro',
        )
        const notes = await card.$$eval('[data-testid="chat-proposal-note"]', (shown) => shown.map((note) => note.textContent ?? '').join(' '))
        const replaced = receiptWords.replacesSplit('').replace(/: $/, '')
        if (!notes.includes(replaced)) throw new Error(`the receipt card does not say which parts of the split go, and notes "${notes}"`)
        const differs = receiptWords.otherAmount('', '').split(',').at(-1).trim()
        if (!notes.includes(differs)) throw new Error(`the receipt card does not warn that the amount differs, and notes "${notes}"`)
        await inspect?.('the receipt on a payment picked and split by hand')
        await shoot('chat-receipt-picked')
        await acceptCard(press, page, card)
        await rowLinesAre(page, 'Harbour bistro', -3300, 3)
        await undoCard(press, page, card, words)
        await rowLinesAre(page, 'Harbour bistro', -3300, 2)
        return
      }
      if (path === 'card-waits') {
        await attachToChat(page, photos.noMatch)
        await sendInChat(page, press, english ? 'Read the receipt' : 'Pročitaj fiskalni račun')
        await allowIfAsked(page, press)
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 1, { timeout: 15_000 })
        await sendInChat(page, press, english ? 'No, by card' : 'Ne, karticom')
        await allowIfAsked(page, press)
        const card = await newestCard(page, 1, 'the chat proposed no card receipt once told it was by card')
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        const notes = await card.$$eval('[data-testid="chat-proposal-note"]', (shown) => shown.map((note) => note.textContent ?? '').join(' '))
        if (!notes.includes(receiptWords.waits('OTP current'))) throw new Error(`the card receipt does not say it waits for the bank's row, and notes "${notes}"`)
        await panelSettled(page)
        await shootAt(page, shoot, await card.$('[data-testid="chat-proposal-note"]'), 'chat-receipt-card-waits', { block: 'start' })
        await acceptCard(press, page, card)
        return
      }
      if (path === 'r1' || path === 'r1-no-company') {
        const card = await receiptCardFor(page, press, photos.noMatch, english ? 'Read the R1 receipt' : 'Pročitaj R1 račun', 1, 'the chat proposed no R1 receipt')
        const says = await card.evaluate((element) => element.textContent ?? '')
        const forCompany = english ? 'For the company' : 'Za tvrtku'
        const receiptDomain = english ? spendingReceiptDomainEnglish : spendingReceiptDomainCroatian
        const noOib = receiptDomain.noCompanyOib
        if (path === 'r1' && !says.includes(forCompany)) throw new Error(`the R1 receipt card does not file its lines under ${forCompany}, and says "${says}"`)
        if (path === 'r1' && says.includes(noOib)) throw new Error('the R1 receipt card says Company has no OIB while Company is open with one')
        if (path === 'r1-no-company' && !says.includes(noOib)) throw new Error(`the R1 receipt card does not say to set the OIB in Company, and says "${says}"`)
        if (path === 'r1-no-company' && !says.includes(receiptDomain.setOibInCompany)) throw new Error(`the R1 receipt card offers no way to Company, and says "${says}"`)
        await inspect?.(`the R1 receipt card, ${path}`)
        await shoot(`chat-receipt-${path}`)
        await acceptCard(press, page, card)
        await rowLinesAre(page, 'Harbour bistro', -1700, 2)
        await undoCard(press, page, card, words)
        return
      }
      if (path === 'pick-none' || path === 'pick-other') {
        const none = path === 'pick-none'
        await attachToChat(page, photos.twoMatches)
        await sendInChat(page, press, english ? 'Read the receipt' : 'Pročitaj fiskalni račun')
        await allowIfAsked(page, press)
        const asked = english ? 'Which one was it?' : 'Koje je to bilo?'
        await page
          .waitForFunction((text) => [...document.querySelectorAll('[data-testid="chat-answer"]')].some((answer) => answer.textContent?.includes(text)), { timeout: 15_000 }, asked)
          .catch(() => {
            throw new Error('the chat did not ask which payment the receipt is')
          })
        const answer = none ? (english ? 'None of them' : 'Nijedno od njih') : english ? 'The Fuel station one' : 'Ono na benzinskoj'
        await sendInChat(page, press, answer)
        await allowIfAsked(page, press)
        const card = await newestCard(page, 1, `the chat proposed no receipt once told "${answer}"`)
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        const notes = await card.$$eval('[data-testid="chat-proposal-note"]', (shown) => shown.map((note) => note.textContent ?? '').join(' '))
        const warned = none ? receiptWords.passedOver('').split(':')[0] : receiptWords.otherPayee('Fuel station', 'Corner market')
        if (!notes.includes(warned)) throw new Error(`the receipt card does not say "${warned}", and notes "${notes}"`)
        await delay(300)
        await acceptLooksReady(page)
        await inspect?.(none ? 'the receipt as a new entry beside the payments it may be' : 'the receipt on a payment with another payee')
        await panelSettled(page)
        await shootAt(page, shoot, await card.$('[data-testid="chat-proposal-note"]'), `chat-receipt-${path}`, { block: 'start' })
        await acceptCard(press, page, card)
        await rowLinesAre(page, none ? 'Corner market' : 'Fuel station', -4120, 2)
        await undoCard(press, page, card, words)
        return
      }
      if (path === 'pick' || path === 'none') {
        await attachToChat(page, path === 'pick' ? photos.twoMatches : photos.noMatch)
        await sendInChat(page, press, english ? 'Read the receipt' : 'Pročitaj fiskalni račun')
        await allowIfAsked(page, press)
        const asked = path === 'pick' ? (english ? 'Which one was it?' : 'Koje je to bilo?') : english ? 'Did you pay in cash?' : 'Jeste li platili gotovinom?'
        await page
          .waitForFunction((text) => [...document.querySelectorAll('[data-testid="chat-answer"]')].some((answer) => answer.textContent?.includes(text)), { timeout: 15_000 }, asked)
          .catch(() => {
            throw new Error(path === 'pick' ? 'the chat did not ask which payment the receipt is' : 'the chat did not ask whether the receipt was paid in cash')
          })
        if ((await page.$$('[data-testid="chat-proposal"]')).length !== 0) throw new Error(`the chat proposed a card before asking, on a receipt that matches ${path}`)
        await panelSettled(page)
        await inspect?.(`the chat asking on a receipt that matches ${path}`)
        await shoot(`chat-receipt-${path}`)
        if (path === 'pick') return
        await sendInChat(page, press, english ? 'Yes, cash' : 'Da, gotovinom')
        await allowIfAsked(page, press)
        const card = await newestCard(page, 1, 'the chat proposed no cash receipt once told it was cash')
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        await acceptCard(press, page, card)
        await rowLinesAre(page, 'Harbour bistro', -1700, 2)
        return
      }
      if (path === 'cash-several') {
        await sendInChat(page, press, english ? 'Add a cash purse' : 'Dodaj novčanik')
        await allowIfAsked(page, press)
        const purse = await newestCard(page, 1, 'the chat proposed no second cash account')
        await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
        await acceptCard(press, page, purse)
        await attachToChat(page, photos.noMatch)
        await sendInChat(page, press, english ? 'Read the cash receipt' : 'Pročitaj gotovinski račun')
        await allowIfAsked(page, press)
        const asked = english ? 'Which cash account' : 'S kojeg ste računa gotovine'
        await page
          .waitForFunction((text) => [...document.querySelectorAll('[data-testid="chat-answer"]')].some((answer) => answer.textContent?.includes(text)), { timeout: 15_000 }, asked)
          .catch(() => {
            throw new Error('the chat did not ask which cash account the receipt goes on')
          })
        if ((await page.$$('[data-testid="chat-proposal"]')).length !== 1) throw new Error('the chat proposed a cash receipt with two cash accounts to pick from')
        await panelSettled(page)
        await inspect?.('the chat asking which cash account')
        await shoot('chat-receipt-cash-several')
        return
      }
      const request = english ? 'Read the cash receipt' : 'Pročitaj gotovinski račun'
      let card
      if (path === 'cash-none') {
        await attachToChat(page, photos.noMatch)
        await sendInChat(page, press, request)
        await allowIfAsked(page, press)
        const asked = english ? 'How much cash did you have' : 'Koliko ste gotovine imali'
        await page
          .waitForFunction((text) => [...document.querySelectorAll('[data-testid="chat-answer"]')].some((answer) => answer.textContent?.includes(text)), { timeout: 15_000 }, asked)
          .catch(() => {
            throw new Error('the chat did not ask how much cash there was before adding a cash account')
          })
        if ((await page.$$('[data-testid="chat-proposal"]')).length !== 0) throw new Error('the chat proposed a cash account before asking how much cash there was')
        await sendInChat(page, press, english ? 'I had €50' : 'Imao sam 50 €')
        card = await newestCard(page, 1, 'the chat proposed no cash account and receipt once told how much cash there was')
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        await delay(300)
        await acceptLooksReady(page)
      } else {
        card = await receiptCardFor(page, press, photos.noMatch, request, 1, 'the chat proposed no cash receipt')
      }
      const says = await card.evaluate((element) => element.textContent ?? '')
      const cashName = path === 'cash-none' && !english ? 'Gotovina' : 'Cash'
      if (path === 'cash-none' && (await card.$$('[data-testid="chat-proposal-group"]')).length < 2) throw new Error(`the cash receipt card does not add a cash account first, and says "${says}"`)
      if (path === 'cash-none' && !says.replace(/\s/g, ' ').includes(english ? '€50.00' : '50,00 €'))
        throw new Error(`the cash account the card adds does not open with the €50.00 said, and the card says "${says}"`)
      if (!says.includes(cashName)) throw new Error(`the cash receipt card does not name the cash account, and says "${says}"`)
      await inspect?.(`the cash receipt card, ${path}`)
      await shoot(`chat-receipt-${path}`)
      await acceptCard(press, page, card)
      await rowLinesAre(page, 'Harbour bistro', -1700, 2)
      await undoCard(press, page, card, words)
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}

/**
 * On the sample Spending file with a made-up key kept: asked to split the latest spend, the chat proposes a card that files
 * this month's rent and adds its two parts, and Accept splits the row until Undo takes the parts off again.
 */
export function chatSplitFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const request = language === 'en' ? 'Split the latest Landlord spend' : 'Podijeli zadnji trošak za Landlord'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await allowIfAsked(page, press)
      const card = await newestCard(page, 1, 'the chat proposed no split card')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      const says = await card.evaluate((element) => element.textContent ?? '')
      if (!says.includes('Landlord')) throw new Error(`the split card does not name the entry it splits, and says "${says}"`)
      await delay(300)
      await acceptLooksReady(page)
      await inspect?.('the card that splits an entry')
      await shoot('chat-split-card')
      await press(await card.$('[data-testid="chat-proposal-accept"]'))
      await card.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await rowLinesAre(page, 'Landlord', -60000, 2)
      await press(await card.$('[data-testid="chat-proposal-undo"]'))
      await page
        .waitForFunction((held, text) => held.textContent?.includes(text) ?? false, { timeout: 10_000 }, card, words.proposal.undone)
        .catch(() => {
          throw new Error('Undo did not say it was undone')
        })
      await rowLinesAre(page, 'Landlord', -60000, 0)
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}

/**
 * On the sample Spending file with a made-up key kept: asked to label last month's three largest payments, the chat proposes a card that
 * adds the Renovation label and puts it on them, which Accept writes and Undo takes back.
 */
export function chatLabelFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const request = language === 'en' ? "Label last month's three largest payments" : 'Označi tri najveća plaćanja prošlog mjeseca'
  const renovation = language === 'en' ? 'Renovation' : 'Obnova'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await allowIfAsked(page, press)
      const card = await newestCard(page, 1, 'the chat proposed no label card')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      const says = await card.evaluate((element) => element.textContent ?? '')
      // The new label's name, then the label on each of the three entries' parts.
      if (says.split(renovation).length - 1 < 4) throw new Error(`the label card does not name the label on each part it labels, and says "${says}"`)
      await delay(300)
      await acceptLooksReady(page)
      await inspect?.('the card that labels entries')
      await shoot('chat-label-card')
      await press(await card.$('[data-testid="chat-proposal-accept"]'))
      await card.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await press(await card.$('[data-testid="chat-proposal-undo"]'))
      await page
        .waitForFunction((held, text) => held.textContent?.includes(text) ?? false, { timeout: 10_000 }, card, words.proposal.undone)
        .catch(() => {
          throw new Error('Undo did not say it was undone')
        })
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}

/**
 * On the sample Spending file with a made-up key kept: asked to put the streaming subscription back on its days, the chat
 * proposes a card that does and names Prague, the event those days give it, which Accept writes and Undo takes back.
 */
export function chatBackOnDaysFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const request = language === 'en' ? 'Put the streaming subscription back on its days' : 'Vrati pretplatu na streaming na njezine dane'
  const byDays = language === 'en' ? 'By date: Prague' : 'Po datumu: Prag'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await allowIfAsked(page, press)
      const card = await newestCard(page, 1, 'the chat proposed no event card')
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await delay(300)
      await acceptLooksReady(page)
      const said = await card.evaluate((element) => element.textContent ?? '')
      if (!said.includes(byDays)) throw new Error(`the back-on-days card does not say "${byDays}"`)
      await inspect?.('the card that puts an entry back on its days')
      await shoot('chat-back-on-days-card')
      await press(await card.$('[data-testid="chat-proposal-accept"]'))
      await card.waitForSelector('[data-testid="chat-proposal-done"]', { visible: true, timeout: 15_000 }).catch(async () => {
        const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent)
        throw new Error(`Accept did not land: ${refused}`)
      })
      await press(await card.$('[data-testid="chat-proposal-undo"]'))
      await page
        .waitForFunction((held, text) => held.textContent?.includes(text) ?? false, { timeout: 10_000 }, card, words.proposal.undone)
        .catch(() => {
          throw new Error('Undo did not say it was undone')
        })
    } finally {
      await newChat(page, press)
      await forgetAssist(page)
    }
  }
}
