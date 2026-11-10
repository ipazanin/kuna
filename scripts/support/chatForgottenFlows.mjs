/**
 * The chat forgotten with the Google sign-in: Sign out on Kuna settings, and the last file on Drive kept in this browser
 * in its place. Each leaves the chat empty and this browser keeping none of it.
 */

import { en as fileWords } from '../../src/apps/company/workbook-files/presentation/words.ts'
import { allowIfAsked, forgetAssist, giveThePageBack, keepAiKey, openChat, savedChatGone, sendInChat } from './chatFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'

const QUESTION = 'How do I set up rules for my bank?'

/** Asks the chat a question, and waits for its answer and until this browser keeps the chat. */
async function chatKept(page, press) {
  await openChat(page, press)
  await sendInChat(page, press, QUESTION)
  await allowIfAsked(page, press)
  await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 }).catch(() => {
    throw new Error('the chat gave no answer')
  })
  await page
    .waitForFunction(async () => (await indexedDB.databases()).some((database) => database.name === 'kuna-chat'), { timeout: 5_000, polling: 100 })
    .catch(() => {
      throw new Error('this browser never kept the chat')
    })
  await giveThePageBack(page, press)
}

/** Opens the chat and checks it shows nothing of the chat before, and that this browser keeps none of it. */
async function chatEmpty(page, press, after) {
  await savedChatGone(page).catch(() => {
    throw new Error(`${after} left the chat kept in this browser`)
  })
  await openChat(page, press)
  await page.waitForSelector('[data-testid="chat-empty"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error(`${after} left the chat on screen`)
  })
  if ((await page.$('[data-testid="chat-question"]')) !== null) throw new Error(`${after} left the question in the chat`)
  await giveThePageBack(page, press)
}

/** Kuna settings on the fake Drive: a chat, then Sign out of Google, then an empty chat. */
export function signOutClearsChatFlow() {
  return async (page, { press, shoot, inspect }) => {
    try {
      await keepAiKey(page)
      await page.waitForSelector('[data-testid="sync-card"]', { visible: true, timeout: 10_000 })
      await chatKept(page, press)
      await pressSelector(page, press, '[data-testid="sign-out"]')
      await chatEmpty(page, press, 'Sign out of Google')
      await inspect?.('Kuna settings after Sign out')
      await shoot('sign-out-chat-empty')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Company's books on the fake Drive, the last file there, opened from a file and kept in this browser in their place: the chat goes with Google. */
export function keptInBrowserClearsChatFlow(templateFile) {
  return async (page, { press, shoot, inspect }) => {
    try {
      await keepAiKey(page)
      await page.waitForSelector('[data-testid="data-source-card"]', { visible: true, timeout: 10_000 })
      await chatKept(page, press)
      await pressSelector(page, press, '[data-testid="switch-source"]')
      const input = await page.waitForSelector('[role="dialog"] [data-testid="data-source-choices"] input[type="file"]', { timeout: 10_000 })
      await input.uploadFile(templateFile)
      await page.waitForSelector('[role="dialog"] [data-testid="import-summary"] dl', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the file opened on Switch data source shows no summary')
      })
      await delay(300)
      const keep = await page.waitForFunction(
        (label) => [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === label && !button.disabled) ?? null,
        { timeout: 10_000 },
        fileWords.dialog.keepInBrowser,
      )
      await press(keep.asElement())
      await page.waitForSelector('[role="dialog"] [data-testid="import-summary"]', { hidden: true, timeout: 10_000 })
      await page
        .waitForFunction((kept) => document.body.innerText.includes(kept), { timeout: 10_000 }, fileWords.dialog.keptInBrowser)
        .catch(() => {
          throw new Error('the books were not kept in this browser')
        })
      await chatEmpty(page, press, 'keeping the last file on Drive in this browser')
      await inspect?.('Books file after the books moved into this browser')
      await shoot('kept-in-browser-chat-empty')
    } finally {
      await forgetAssist(page)
    }
  }
}
