/**
 * The chat's own steps that the visual, touch and Firefox checks share: keeping a made-up key, opening the chat, sending,
 * starting a new chat and giving the page back. `press` clicks or taps an element handle.
 */

import { pressSelector } from './pressing.mjs'

/** A made-up Anthropic key the assistant is given, whose whole text must never come back on screen. */
export const MADE_UP_ANTHROPIC_KEY = 'made-up-anthropic-key-0042'

/** With the Anthropic key, a made-up OpenAI key kept, Anthropic picked, Company sending without asking and Anonymise off for Anthropic. */
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

/** Allows the read when the chat asks first, and goes on when it does not ask within five seconds. */
export async function allowIfAsked(page, press) {
  const allow = await page.waitForSelector('[data-testid="chat-allow"]', { visible: true, timeout: 5_000 }).catch(() => null)
  if (allow !== null) await press(allow)
}

/**
 * Waits until this browser keeps no chat, as New chat forgets it in the background. A reload must not race that, and
 * neither must the next flow of a touch session, or that flow opens on the chat brought back instead of an empty one.
 */
export async function savedChatGone(page) {
  await page
    .waitForFunction(
      async () => {
        if (!(await indexedDB.databases()).some((database) => database.name === 'kuna-chat')) return true
        return new Promise((resolve) => {
          const opening = indexedDB.open('kuna-chat')
          opening.onerror = () => resolve(false)
          opening.onsuccess = () => {
            const database = opening.result
            const reading = database.transaction('chat').objectStore('chat').get('last')
            reading.onsuccess = () => {
              database.close()
              resolve(reading.result === undefined)
            }
          }
        })
      },
      { timeout: 5_000, polling: 100 },
    )
    .catch(() => {
      throw new Error('New chat left the chat kept in this browser')
    })
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
  const docked = await page.evaluate(() => window.matchMedia('(min-width: 1224px)').matches)
  if (close !== null && !docked) {
    await press(close)
    await page.waitForFunction(() => !document.querySelector('[data-testid="chat-panel"]'), { timeout: 5_000 })
  }
}
