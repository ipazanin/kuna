import { en as classEnglish, hr as classCroatian } from '../../src/apps/company/packs/hr-doo/preset/presentation/classWords.ts'
import { en as transactionsEnglish, hr as transactionsCroatian } from '../../src/apps/company/transactions/presentation/words.ts'
import { en as sharedEnglish, hr as sharedCroatian } from '../../src/shared/app/words.ts'
import { TWO_KEYS_ANONYMISE_OFF, acceptLooksReady, allowIfAsked, forgetAssist, giveThePageBack, keepAiKey, newChat, openChat, sendInChat } from './chatFlows.mjs'
import { ASSIST_WORDS, elementSays, goToRoute, openCompanies, pickCompany, queueRow } from './editorFlows.mjs'
import { FIGURE_ASKS } from './figureAskFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'

const TRANSACTIONS_WORDS = { en: transactionsEnglish, hr: transactionsCroatian }
const SHARED_WORDS = { en: sharedEnglish, hr: sharedCroatian }
const CLASS_WORDS = { en: classEnglish, hr: classCroatian }

/** What the person types for each card, which the fake Company chat and Kuna's fake reply answer. */
const PROMPTS = {
  sort: { en: 'Suggest categories for the rows waiting', hr: 'Predloži kategorije za retke koji čekaju' },
  invoice: { en: 'Invoice Lumen for October', hr: 'Izdaj fakturu Lumenu za listopad' },
  currency: { en: 'Show my figures in US dollars', hr: 'Prikaži moje iznose u američkim dolarima' },
  refile: { en: 'Always file Laptop Store under office supplies', hr: 'Uvijek stavi Laptop Store pod uredski materijal' },
  category: { en: 'Add a category for training courses', hr: 'Dodaj kategoriju za edukacije' },
  theme: { en: 'Switch Kuna to the dark look', hr: 'Prebaci Kunu na tamni izgled' },
  explain: { en: 'Explain this figure', hr: 'Objasni ovaj iznos' },
}

/** Types into the open chat and sends, and allows the read when the chat asks first. */
async function ask(page, press, text) {
  await sendInChat(page, press, text)
  await allowIfAsked(page, press)
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
      await keepAiKey(page)
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
      await forgetAssist(page)
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
  category: async (page, language) => {
    await elementSays(page, '[data-testid="chat-proposal"]', [CLASS_WORDS[language].classes.deductibleCost], 'the category card does not name its tax class as the categories editor does')
  },
}

/**
 * A chat on Company's Overview with a made-up key kept: an invoice is a link to the Invoices tab with the client picked, not a
 * card, dollars are a set-setting card with its line warned, a rule for Laptop Store re-files the rows the owner confirmed, each on a warned
 * line, and a category for training is an add-category card that names its tax class as the categories editor does.
 */
export function companyChatCardFlowIn(language, card) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await ask(page, press, PROMPTS[card][language])
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await CARDS[card](page, language)
      await delay(300)
      await acceptLooksReady(page)
      await inspect?.(`the chat's answer to ${PROMPTS[card].en}`)
      await shoot(`company-chat-${card}`)
      if (card !== 'invoice') await pressSelector(page, press, '[data-testid="chat-proposal-decline"]')
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** A chat on the home with a made-up key kept proposes Kuna's dark look, Accept turns the page dark, and Undo brings the look back. */
export function kunaChatThemeFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const dark = () => page.evaluate(() => document.documentElement.classList.contains('dark'))
    try {
      await keepAiKey(page)
      const before = await dark()
      await openChat(page, press)
      await ask(page, press, PROMPTS.theme[language])
      await page.waitForSelector('[data-testid="chat-proposal-accept"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the chat proposed no card for the look')
      })
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      await acceptLooksReady(page)
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
      await forgetAssist(page)
      await page.evaluate(() => localStorage.removeItem('kuna.theme'))
    }
  }
}

/** How the fake chat's answer names Anonymise when it keeps a figure on the device, in English or Croatian. */
const KEPT_BY_ANONYMISE = /Anonymise|anonimizacij/

/**
 * A salary figure on Salaries with Anthropic picked, a second key kept and Anonymise off for Anthropic: Explain reads its
 * build-up and answers in prose. A change of company in Kuna settings and back turns Anonymise on again, and the same
 * Explain is then refused with nothing sent, asking to turn Anonymise off.
 */
export function companyChatAnonymiseFlowIn(language) {
  const assist = ASSIST_WORDS[language]
  const [{ at: figure }] = FIGURE_ASKS.salaries.figures
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const explainFigure = async () => {
      await pressSelector(page, press, `${figure} [data-testid="ask-chat"]`)
      await page.waitForSelector('[data-testid="chat-tag"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the chat opened with no tag for the salary figure')
      })
      await sendInChat(page, press, PROMPTS.explain[language])
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      return page.$eval('[data-testid="chat-answer"]', (answer) => answer.textContent ?? '')
    }
    try {
      await keepAiKey(page, TWO_KEYS_ANONYMISE_OFF)
      const explained = await explainFigure()
      if (KEPT_BY_ANONYMISE.test(explained)) throw new Error('with Anonymise off the build-up was still refused')
      await page.waitForSelector('[data-testid="chat-sent"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('with Anonymise off the answer shows no row of what was sent')
      })
      await delay(300)
      await inspect?.('a salary build-up explained with Anonymise off')
      await shoot('chat-build-up-answer')
      await newChat(page, press)
      await giveThePageBack(page, press)

      await goToRoute(page, '#/settings', '[data-testid="assist-provider-select"]')
      await openCompanies(page, press)
      await pickCompany(page, press, 'OpenAI')
      await elementSays(page, '[data-testid="assist-moved"]', [assist.card.anonymiseBack], 'the change of company does not say Anonymise is on again')
      await openCompanies(page, press)
      await pickCompany(page, press, 'Anthropic')
      if ((await page.evaluate(() => localStorage.getItem('kuna.assist-anonymise'))) !== null) throw new Error('Anonymise stays off after a change of company and back')

      await goToRoute(page, '#/company/salaries', figure)
      const refused = await explainFigure()
      if (!KEPT_BY_ANONYMISE.test(refused)) throw new Error(`with Anonymise on again the answer does not ask to turn it off: ${refused}`)
      if (await page.$('[data-testid="chat-sent"]')) throw new Error("with Anonymise on the build-up of employees' pay was sent")
      await delay(300)
      await inspect?.('a salary build-up refused with Anonymise on')
      await shoot('company-chat-anonymise-refused')
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}
