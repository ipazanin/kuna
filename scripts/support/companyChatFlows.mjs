import { en as transactionsEnglish, hr as transactionsCroatian } from '../../src/apps/company/transactions/presentation/words.ts'
import { en as sharedEnglish, hr as sharedCroatian } from '../../src/shared/app/words.ts'
import { ASSIST_WORDS, MADE_UP_ANTHROPIC_KEY, delay, elementSays, pressSelector, queueRow, savedChatGone } from './editorFlows.mjs'

const TRANSACTIONS_WORDS = { en: transactionsEnglish, hr: transactionsCroatian }
const SHARED_WORDS = { en: sharedEnglish, hr: sharedCroatian }

/** What the person types for each card, which the fake Company chat and Kuna's fake reply answer. */
const PROMPTS = {
  sort: { en: 'Suggest categories for the rows waiting', hr: 'Predloži kategorije za retke koji čekaju' },
  invoice: { en: 'Invoice Lumen for October', hr: 'Izdaj fakturu Lumenu za listopad' },
  currency: { en: 'Show my figures in US dollars', hr: 'Prikaži moje iznose u američkim dolarima' },
  refile: { en: 'Always file Laptop Store under office supplies', hr: 'Uvijek stavi Laptop Store pod uredski materijal' },
  theme: { en: 'Switch Kuna to the dark look', hr: 'Prebaci Kunu na tamni izgled' },
}

async function keepKey(page) {
  await page.evaluate((key) => localStorage.setItem('kuna.secret.anthropic', key), MADE_UP_ANTHROPIC_KEY)
  await page.reload({ waitUntil: 'networkidle0' })
}

async function forgetKey(page) {
  await page.evaluate(() => {
    localStorage.removeItem('kuna.secret.anthropic')
    localStorage.removeItem('kuna.assist.company')
    localStorage.removeItem('kuna.assist-provider')
  })
}

/** Types into the open chat and sends, and allows the read when the chat asks first. */
async function ask(page, press, text) {
  const prompt = await pressSelector(page, press, 'textarea[data-testid="chat-prompt"]')
  await prompt.type(text)
  await pressSelector(page, press, '[data-testid="chat-send"]')
  const allow = await page.waitForSelector('[data-testid="chat-allow"]', { visible: true, timeout: 5_000 }).catch(() => null)
  if (allow !== null) await pressSelector(page, press, '[data-testid="chat-allow"]')
}

/** Starts a new chat, unless the chat is empty, and waits until this browser keeps none, so the next flow opens on an empty chat. */
async function newChat(page, press) {
  const started = await page.$('[data-testid="chat-new"]')
  if (started !== null) await press(started)
  await savedChatGone(page)
}

/** Closes the chat where it covers the page, below the width that docks it beside the page. */
async function giveThePageBack(page, press) {
  const close = await page.$('[data-testid="chat-close"]')
  const docked = await page.evaluate(() => window.matchMedia('(min-width: 1224px)').matches)
  if (close !== null && !docked) {
    await press(close)
    await page.waitForFunction(() => !document.querySelector('[data-testid="chat-panel"]'), { timeout: 5_000 })
  }
}

/**
 * Company's To review with a made-up key kept: the queue's header keeps Suggest categories, which opens the chat about the
 * queue with its card outlined. The chat files the row it is sure of on a card, which Accept writes with one Undo. An opened
 * row's Ask the chat then tags that row alone.
 */
export function companyReviewAskFlowIn(language) {
  const words = TRANSACTIONS_WORDS[language]
  const assist = ASSIST_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepKey(page)
      await elementSays(page, '[data-testid="review-queue-ask"]', [words.review.suggestCategories], 'the queue does not keep Suggest categories on its header')
      await inspect?.('the queue with Suggest categories on its header')
      await shoot('company-review-ask')

      await pressSelector(page, press, '[data-testid="review-queue-ask"]')
      await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
      await elementSays(page, '[data-testid="chat-tag"]', [words.tabs.review], 'the chat is not about To review')
      if ((await page.$('[data-testid="review-queue"][data-chat-tagged="card"]')) === null) throw new Error('the queue card takes no outline while the chat is about it')
      await inspect?.('the chat about the queue')
      await shoot('company-review-tagged')

      await ask(page, press, PROMPTS.sort[language])
      await page.waitForSelector('[data-testid="chat-proposal-accept"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the chat proposed no card for the rows waiting')
      })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await elementSays(page, '[data-testid="chat-proposal"]', ['GADGET CORNER'], 'the card does not name the row it files')
      await inspect?.('the card that files the sure rows')
      await shoot('company-chat-filed')
      const waiting = () => page.evaluate(() => document.querySelectorAll('[data-testid="review-row"]').length)
      const before = await waiting()
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForSelector('[data-testid="chat-proposal-undo"]', { visible: true, timeout: 15_000 })
      await page
        .waitForFunction((count) => document.querySelectorAll('[data-testid="review-row"]').length === count - 1, { timeout: 10_000 }, before)
        .catch(() => {
          throw new Error('Accept left the filed row waiting')
        })
      await pressSelector(page, press, '[data-testid="chat-proposal-undo"]')
      await elementSays(page, '[data-testid="chat-proposal-over"]', [assist.proposal.undone], 'Undo did not say it was undone')
      await newChat(page, press)
      await giveThePageBack(page, press)

      const row = await queueRow(page, 'SNACK KIOSK')
      if ((await row.evaluate((element) => element.getAttribute('aria-expanded'))) !== 'true') await press(row)
      await pressSelector(page, press, '[data-testid="review-details"] [data-testid="review-row-ask"]')
      await page.waitForSelector('[data-testid="review-row"][data-chat-tagged="row"]', { timeout: 10_000 }).catch(() => {
        throw new Error('the row asked about takes no bar')
      })
      const tag = await page.$eval('[data-testid="chat-tag"]', (element) => element.textContent ?? '')
      if (tag.includes('SNACK')) throw new Error('the chip names the row by its counterparty')
      await delay(300)
      await inspect?.('the chat about one row')
      await shoot('company-review-row-tagged')
      await newChat(page, press)
    } finally {
      await forgetKey(page)
    }
  }
}

/** What each card flow waits for and checks, by the card it asks for. */
const CARDS = {
  invoice: async (page) => {
    await page.waitForSelector('[data-testid="chat-chip"][href*="tab=invoices"][href*="make="]', { visible: true, timeout: 15_000 }).catch(() => {
      throw new Error('the answer links no Invoices tab with the client picked')
    })
    if (await page.$('[data-testid="chat-proposal"]')) throw new Error('the chat proposed a card for an invoice it cannot make')
  },
  currency: async (page) => {
    await page.waitForSelector('[data-testid="chat-proposal-line-warning"]', { visible: true, timeout: 15_000 }).catch(() => {
      throw new Error('the currency card warns on no line')
    })
  },
  refile: async (page, language) => {
    await elementSays(page, '[data-testid="chat-proposal-line-warning"]', [SHARED_WORDS[language].confirmedRowMoves], 'the rule card does not warn on the confirmed row it re-files')
  },
}

/**
 * A chat on Company's Overview with a made-up key kept: an invoice is a link to the Invoices tab with the client picked, not a
 * card, dollars are a set-setting card with its line warned, and a rule for Laptop Store re-files the rows the owner confirmed, each on a warned line.
 */
export function companyChatCardFlowIn(language, card) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepKey(page)
      await pressSelector(page, press, '[data-testid="chat-open"]')
      await ask(page, press, PROMPTS[card][language])
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await CARDS[card](page, language)
      await delay(300)
      await inspect?.(`the chat's answer to ${PROMPTS[card].en}`)
      await shoot(`company-chat-${card}`)
      if (card !== 'invoice') await pressSelector(page, press, '[data-testid="chat-proposal-decline"]')
      await newChat(page, press)
    } finally {
      await forgetKey(page)
    }
  }
}

/** A chat on the home with a made-up key kept proposes Kuna's dark look, Accept turns the page dark, and Undo brings the look back. */
export function kunaChatThemeFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const dark = () => page.evaluate(() => document.documentElement.classList.contains('dark'))
    try {
      await keepKey(page)
      const before = await dark()
      await pressSelector(page, press, '[data-testid="chat-open"]')
      await ask(page, press, PROMPTS.theme[language])
      await page.waitForSelector('[data-testid="chat-proposal-accept"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the chat proposed no card for the look')
      })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await inspect?.('the card for the dark look')
      await shoot('kuna-chat-theme')
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page
        .waitForFunction(() => document.documentElement.classList.contains('dark'), { timeout: 10_000 })
        .catch(() => {
          throw new Error('Accept did not turn the page dark')
        })
      await delay(300)
      await inspect?.('the page dark after Accept')
      await shoot('kuna-chat-theme-done')
      await pressSelector(page, press, '[data-testid="chat-proposal-undo"]')
      await page
        .waitForFunction((was) => document.documentElement.classList.contains('dark') === was, { timeout: 10_000 }, before)
        .catch(() => {
          throw new Error('Undo did not bring the look back')
        })
      await newChat(page, press)
    } finally {
      await forgetKey(page)
      await page.evaluate(() => localStorage.removeItem('kuna.theme'))
    }
  }
}
