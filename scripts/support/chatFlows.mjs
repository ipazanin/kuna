/**
 * The chat's own steps that the visual, touch and Firefox checks share: keeping a made-up key, opening the chat, sending,
 * starting a new chat and giving the page back. `press` clicks or taps an element handle.
 */

import { pressSelector } from './pressing.mjs'

/** A made-up Anthropic key the assistant is given, whose whole text must never come back on screen. */
export const MADE_UP_ANTHROPIC_KEY = 'made-up-anthropic-key-0042'

/** With the Anthropic key, a made-up OpenAI key kept, Anthropic picked, Anonymise off for Anthropic and Company's yes as an older Kuna kept it, which becomes the yes for Anthropic. */
export const TWO_KEYS_ANONYMISE_OFF = {
  'kuna.secret.openai': 'made-up-openai-key-0077',
  'kuna.assist-provider': 'anthropic',
  'kuna.assist.company': 'on',
  'kuna.assist-anonymise': 'anthropic',
}

/** Keeps the made-up Anthropic key in this browser with any other choices `stored` names, then loads the page again with them. */
export async function keepAiKey(page, stored = {}) {
  await page.evaluate(
    (key, choices) => {
      localStorage.setItem('kuna.secret.anthropic', key)
      for (const [name, choice] of Object.entries(choices)) localStorage.setItem(name, choice)
    },
    MADE_UP_ANTHROPIC_KEY,
    stored,
  )
  await page.reload({ waitUntil: 'networkidle0' })
}

/** Forgets the AI keys, the times of their last changes, the assistant's switches, Anonymise and the models in this browser, so the next flows start without them. */
export async function forgetAssist(page) {
  await page.evaluate(() =>
    Object.keys(localStorage)
      .filter((key) => /^kuna\.secret(-changed)?\.(anthropic|openai|openrouter)$/.test(key) || key.startsWith('kuna.assist'))
      .forEach((key) => localStorage.removeItem(key)),
  )
}

/** Opens the chat from the shell, unless it shows already. */
export async function openChat(page, press) {
  const shown = await page.$eval('[data-testid="chat-panel"]', (panel) => panel.getClientRects().length > 0).catch(() => false)
  if (!shown) await pressSelector(page, press, '[data-testid="chat-open"]')
  await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
}

/** Types a message in the open chat and sends it. */
export async function sendInChat(page, press, text) {
  const prompt = await pressSelector(page, press, 'textarea[data-testid="chat-prompt"]')
  await prompt.type(text)
  await pressSelector(page, press, '[data-testid="chat-send"]')
}

/**
 * Moves the pointer off the page, where a press may have left it over Accept, waits until Accept's colour has settled,
 * and checks that every open card's Accept is neither disabled nor hovered, so a screenshot never catches it faded.
 */
export async function acceptLooksReady(page) {
  await page.mouse.move(0, 0)
  await page
    .waitForFunction(() => [...document.querySelectorAll('[data-testid="chat-proposal-accept"]')].every((button) => button.getAnimations().length === 0), { timeout: 5_000 })
    .catch(() => {
      throw new Error("a card's Accept is still changing colour")
    })
  const faded = await page.$$eval('[data-testid="chat-proposal"][data-state="open"] [data-testid="chat-proposal-accept"]', (buttons) =>
    buttons.flatMap((button) => [...(button.disabled ? ['disabled'] : []), ...(button.matches(':hover') ? ['hovered'] : [])]),
  )
  if (faded.length > 0) throw new Error(`a card's Accept shows ${faded.join(' and ')} just before the screenshot`)
}

/** Allows the chat when it asks first, and goes on when it does not ask within five seconds. */
export async function allowIfAsked(page, press) {
  const allow = await page.waitForSelector('[data-testid="chat-allow"]', { visible: true, timeout: 5_000 }).catch(() => null)
  if (allow !== null) await press(allow)
}

/**
 * Waits until this browser keeps the chat a reload should bring back: none at all when `cardState` is null, or one whose
 * card ended in `cardState`. The chat is kept in the background, so a reload that does not wait can race it.
 */
async function savedChatSettled(page, cardState, failure) {
  await page
    .waitForFunction(
      async (wanted) => {
        if (!(await indexedDB.databases()).some((database) => database.name === 'kuna-chat')) return wanted === null
        return new Promise((resolve) => {
          const opening = indexedDB.open('kuna-chat')
          opening.onerror = () => resolve(false)
          opening.onsuccess = () => {
            const database = opening.result
            const reading = database.transaction('chat').objectStore('chat').get('last')
            reading.onsuccess = () => {
              database.close()
              const kept = reading.result
              resolve(wanted === null ? kept === undefined : (kept?.lines ?? []).some((line) => line.proposals.some((proposal) => proposal.state === wanted)))
            }
          }
        })
      },
      { timeout: 5_000, polling: 100 },
      cardState,
    )
    .catch(() => {
      throw new Error(failure)
    })
}

/** Waits until this browser keeps no chat, so neither a reload nor the next flow of a touch session opens on the chat brought back. */
export async function savedChatGone(page) {
  await savedChatSettled(page, null, 'New chat left the chat kept in this browser')
}

/** Waits until this browser keeps a card that ended in `state`, so a reload brings it back as it ended. */
export async function savedCardEnded(page, state) {
  await savedChatSettled(page, state, `this browser never kept a card that ended ${state}`)
}

/** Starts a new chat, unless the chat is empty, and waits until this browser keeps none, so the next flow opens on an empty chat. */
export async function newChat(page, press) {
  const started = await page.$('[data-testid="chat-new"]')
  if (started !== null) await press(started)
  await savedChatGone(page)
}

/** Closes the chat where it covers the page, below the width that docks it beside the page. */
export async function giveThePageBack(page, press) {
  const close = await page.$('[data-testid="chat-close"]')
  const docked = await page.evaluate(() => document.querySelector('[data-chat-place="dock"]') !== null)
  if (close !== null && !docked) {
    await press(close)
    await page.waitForFunction(() => !document.querySelector('[data-testid="chat-panel"]'), { timeout: 5_000 })
  }
}
