import { en as investmentsEnglish, hr as investmentsCroatian } from '../../src/apps/investments/words.ts'
import { en as companyEnglish, hr as companyCroatian } from '../../src/apps/company/assistant/operations/words.ts'
import { en as loansEnglish, hr as loansCroatian } from '../../src/apps/loans/assistant/words.ts'
import { acceptLooksReady, allowIfAsked, forgetAssist, keepAiKey, newChat, openChat, sendInChat } from './chatFlows.mjs'
import { ASSIST_WORDS, elementSays } from './editorFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'

const COMPANY_WORDS = { en: companyEnglish, hr: companyCroatian }
const LOANS_WORDS = { en: loansEnglish, hr: loansCroatian }
const INVESTMENTS_NAME = { en: investmentsEnglish.name, hr: investmentsCroatian.name }

/** What the person types for each card, which the fake Loans, Investments and Assets chats answer. */
const PROMPTS = {
  offer: { en: 'Offer from Example Bank, add it to my scenarios', hr: 'Ponuda banke Example Bank, dodaj je u scenarije' },
  extra: { en: 'Extra payment of 1,000 on my bank loan next week', hr: 'Prijevremena otplata od 1.000 na moj kredit idući tjedan' },
  buy: { en: 'Buy one unit of my first instrument', hr: 'Kupi jednu jedinicu mog prvog instrumenta' },
  sell: { en: 'Sell a million units of it', hr: 'Prodaj milijun jedinica toga' },
  workbook: { en: 'Import this portfolio workbook', hr: 'Uvezi ovu radnu knjigu portfelja' },
  report: { en: 'Import the new transactions from this report', hr: 'Uvezi nove transakcije iz ovog izvješća' },
  copy: { en: 'Copy these rows into my first account', hr: 'Prepiši ove retke u moj prvi račun' },
  copyAgain: { en: 'Copy them again with one more', hr: 'Prepiši ih ponovno s još jednim' },
  zero: { en: 'Import this statement', hr: 'Uvezi ovaj izvod' },
  file: { en: 'Copy the rows of this file into my first account', hr: 'Prepiši retke ove datoteke u moj prvi račun' },
  lookAlike: { en: 'Import the look-alike too, it is another deposit', hr: 'Uvezi i onaj sličan, to je druga uplata' },
  valuation: { en: 'Valuation of my newest asset at 210,000 today', hr: 'Procjena moje najnovije imovine na 210.000 danas' },
}

/** What the import card of the made-up workbook without its split says, as each language writes it. */
const WORKBOOK_IMPORT = {
  en: ['23 changes', '3 investment accounts'],
  hr: ['23 promjene', '3 investicijska računa'],
}

/** What the Investments copy cards say, as each language writes it: the cash adding up to the printed balances, a row Kuna has already, and the waiting row that looks like a record Kuna has. */
const COPY_WORDS = {
  en: { ties: 'cash adds up to the balances', inKuna: 'is in Kuna already', lookAlike: ['not imported', 'Say in the chat whether'] },
  hr: { ties: 'zbraja se do stanja', inKuna: 'već je u Kuni', lookAlike: ['uvez', 'Recite u razgovoru'] },
}

/** The amounts the fake chats propose, as each language writes them. */
const AMOUNTS = {
  extra: { en: '1,000', hr: '1.000' },
  valuation: { en: '210,000', hr: '210.000' },
}

/** Types into the open chat and sends, and allows the read when the chat asks first. */
async function ask(page, press, text) {
  await sendInChat(page, press, text)
  await allowIfAsked(page, press)
}

/** Waits for the chat's answer number `count` and the card it proposes. */
async function proposedCard(page, count, failure) {
  await page
    .waitForFunction((wanted) => document.querySelectorAll('[data-testid="chat-answer"]').length >= wanted, { timeout: 15_000 }, count)
    .catch(() => {
      throw new Error(`${failure}: the chat gave no answer`)
    })
  const card = await page.waitForSelector('[data-testid="chat-proposal"][data-state="open"]', { visible: true, timeout: 5_000 }).catch(() => null)
  if (card === null) throw new Error(failure)
  return card
}

/** Accepts the open card, which must land with Undo, and undoes it. */
async function acceptAndUndo(page, press, language, shoot, inspect, name) {
  await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
  await page.waitForSelector('[data-testid="chat-proposal-undo"]', { visible: true, timeout: 15_000 }).catch(async () => {
    const refused = await page.evaluate(() => document.querySelector('[data-testid="chat-proposal-refused"]')?.textContent?.trim())
    throw new Error(`Accept did not land: ${refused ?? 'no Undo and no refusal'}`)
  })
  await delay(300)
  await inspect?.('the card accepted, with Undo')
  await shoot(`${name}-done`)
  await pressSelector(page, press, '[data-testid="chat-proposal-undo"]')
  await elementSays(page, '[data-testid="chat-proposal-over"]', [ASSIST_WORDS[language].proposal.undone], 'Undo did not say it was undone')
}

/**
 * Each card: what it is named in the screenshots, the file it puts on the prompt first, and what the card must show. A
 * card with `accept` is accepted and undone, and `after` asks again on the same chat.
 */
const CARDS = {
  offer: {
    name: 'chat-offer-card',
    accept: true,
    shows: async (page, card, language) => {
      const fields = LOANS_WORDS[language].proposals.fields
      await elementSays(page, '[data-testid="chat-proposal"]', [fields.kunaEks, fields.bankEks], "the offer card does not set Kuna's EKS beside the printed one")
      if ((await card.$('[data-testid="chat-proposal-line-warning"], [data-testid="chat-proposal-warning"]')) === null)
        throw new Error('the offer card does not warn that its EKS differs from the printed one')
    },
  },
  extra: {
    name: 'loans-chat-extra-payment',
    accept: true,
    shows: async (page, card, language) => {
      await elementSays(page, '[data-testid="chat-proposal"]', [AMOUNTS.extra[language]], 'the card does not show the extra payment of 1,000')
    },
  },
  buy: {
    name: 'investments-chat-trade',
    accept: true,
    after: async (page, press, language, shoot, inspect) => {
      await ask(page, press, PROMPTS.sell[language])
      await page
        .waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        .catch(() => {
          throw new Error('the chat gave no answer to the sale')
        })
      if ((await page.$('[data-testid="chat-proposal"][data-state="open"]')) !== null) throw new Error('the chat proposed a sale over the units held instead of saying it was refused')
      await elementSays(page, '[data-testid="chat-sent"]', [ASSIST_WORDS[language].sent.refusal(INVESTMENTS_NAME[language])], 'the chat did not send why Investments refused the sale')
      await delay(300)
      await inspect?.('the sale over the units held, refused')
      await shoot('investments-chat-trade-refused')
    },
  },
  workbook: {
    name: 'investments-chat-workbook',
    attach: 'withoutSplit',
    accept: true,
    shows: async (page, card, language) => {
      await elementSays(page, '[data-testid="chat-proposal"]', WORKBOOK_IMPORT[language], "the import card does not add the workbook's three accounts in 23 changes")
    },
  },
  report: {
    name: 'investments-chat-flex-report',
    attach: 'flexReport',
    accept: true,
    shows: async (page) => {
      await elementSays(page, '[data-testid="chat-proposal"]', ['552'], "the import card does not show the report's conversions of 552 USD")
    },
  },
  copy: {
    name: 'investments-chat-copy',
    after: async (page, press, language, shoot, inspect) => {
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForSelector('[data-testid="chat-proposal-undo"]', { visible: true, timeout: 15_000 })
      await ask(page, press, PROMPTS.copyAgain[language])
      await page
        .waitForFunction(() => document.querySelectorAll('[data-testid="chat-answer"]').length >= 2, { timeout: 15_000 })
        .catch(() => {
          throw new Error('the chat gave no answer to the second copy')
        })
      await elementSays(page, '[data-testid="chat-proposal"]', [COPY_WORDS[language].inKuna], 'the second card does not say a row is in Kuna already')
      await delay(300)
      await inspect?.('the second copy with a row already in Kuna')
      await shoot('investments-chat-copy-in-kuna')
    },
    shows: async (page, card, language) => {
      await elementSays(page, '[data-testid="chat-proposal"]', [COPY_WORDS[language].ties], 'the copy card does not say the cash adds up to the printed balances')
    },
  },
  file: {
    name: 'investments-chat-file-copy',
    attach: 'deposits',
    answersBefore: 1,
    before: async (page, press, language) => {
      await ask(page, press, PROMPTS.copy[language])
      await proposedCard(page, 1, 'the chat proposed no card for the typed rows')
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForSelector('[data-testid="chat-proposal-undo"]', { visible: true, timeout: 15_000 })
    },
    shows: async (page, card, language) => {
      await elementSays(page, '[data-testid="chat-proposal-note"][data-tone="info"]', COPY_WORDS[language].lookAlike, 'the file card does not ask about the waiting row that looks like one Kuna has')
      await elementSays(
        page,
        '[data-testid="chat-proposal-read-files"]',
        [ASSIST_WORDS[language].proposal.madeAfterReading('chat-sample-deposits.csv')],
        'the file card does not say it was made after reading the file',
      )
    },
    after: async (page, press, language, shoot, inspect) => {
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page.waitForFunction(() => document.querySelectorAll('[data-testid="chat-proposal-undo"]').length >= 2, { timeout: 15_000 })
      await ask(page, press, PROMPTS.lookAlike[language])
      await proposedCard(page, 3, 'the chat proposed no card for the look-alike')
      await elementSays(page, '[data-testid="chat-proposal"][data-state="open"]', [COPY_WORDS[language].inKuna], 'the look-alike card does not say the other row is in Kuna already')
      await delay(300)
      await acceptLooksReady(page)
      await inspect?.('the look-alike imported once the person says it is another deposit')
      await shoot('investments-chat-look-alike')
    },
  },
  zero: {
    name: 'company-chat-statement-zero',
    shows: async (page, card, language) => {
      await elementSays(page, '[data-testid="chat-proposal"]', [COMPANY_WORDS[language].accountStartsAtZero('').slice(0, 24)], 'the statement card does not say the account starts at zero')
    },
  },
  valuation: {
    name: 'assets-chat-valuation',
    accept: true,
    shows: async (page, card, language) => {
      await elementSays(page, '[data-testid="chat-proposal"]', [AMOUNTS.valuation[language]], 'the card does not show the valuation of 210,000')
    },
  },
}

/** Puts a file on the open chat's prompt through its file input, as a person picks it, and waits until Kuna has read it. */
async function attachToChat(page, path) {
  const input = await page.waitForSelector('[data-testid="chat-attach-input"]', { timeout: 10_000 })
  await input.uploadFile(path)
  await page.waitForSelector('[data-testid="chat-file"][data-state="ready"]', { visible: true, timeout: 15_000 }).catch(() => {
    throw new Error('the file is not ready on the chat prompt')
  })
}

/**
 * A chat in Loans, Investments or Assets with a made-up key kept: a loan offer is a card that sets Kuna's EKS beside the
 * printed one and warns where they differ, an extra payment on a bank loan, a buy of one unit and an Assets valuation are
 * cards with one Undo, a sale over the units held is refused, and an attached portfolio workbook or IBKR Flex report,
 * which Kuna reads itself, becomes an import card with Undo. `files` holds the paths a card puts on the prompt.
 */
export function appChatCardFlowIn(language, card, files = {}) {
  const shape = CARDS[card]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await shape.before?.(page, press, language)
      if (shape.attach !== undefined) await attachToChat(page, files[shape.attach])
      await ask(page, press, PROMPTS[card][language])
      const proposed = await proposedCard(page, (shape.answersBefore ?? 0) + 1, `the chat proposed no card for "${PROMPTS[card].en}"`)
      await shape.shows?.(page, proposed, language)
      await delay(300)
      await acceptLooksReady(page)
      await inspect?.(`the card for "${PROMPTS[card].en}"`)
      await shoot(shape.name)
      if (shape.accept) await acceptAndUndo(page, press, language, shoot, inspect, shape.name)
      await shape.after?.(page, press, language, shoot, inspect)
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}
