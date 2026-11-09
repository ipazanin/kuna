/**
 * Setting an app up with the chat, which the visual and touch checks share: the "Set up with the chat" button on a first run's home
 * and folder steps, on the empty overview and in the set-up card's header, a card made while the app is new that says the chat goes
 * on after Accept, and the first-send card that says a new app knows no names yet. Each flow keeps the made-up key, since the button
 * shows only while a key is kept.
 */

import { en as chatEnglish, hr as chatCroatian } from '../../src/shared/ai/presentation/words.ts'
import { en as onboardingEnglish, hr as onboardingCroatian } from '../../src/apps/company/onboarding/presentation/words.ts'
import { en as storageEnglish, hr as storageCroatian } from '../../src/shared/storage/presentation/words.ts'
import { forgetAssist, keepAiKey, sendInChat } from './chatFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'

const CHAT_WORDS = { en: chatEnglish, hr: chatCroatian }
const FIRST_RUN_WORDS = { en: storageEnglish.firstRun, hr: storageCroatian.firstRun }
const ONBOARDING_WORDS = { en: onboardingEnglish, hr: onboardingCroatian }
const STEP = '[data-testid="onboarding-step"]'

/** What the person types for a loan contract, which the fake Loans chat answers with a card adding the car loan. */
const CONTRACT = { en: 'Contract of my car loan, add the loan', hr: 'Ugovor o kreditu za automobil, dodaj kredit' }

/** The screenshot name in the flow's language: English as is, Croatian with `-hr`. */
function named(shoot, language) {
  return (name) => shoot(language === 'en' ? name : `${name}-${language}`)
}

async function stepShows(page, step) {
  await page
    .waitForFunction((selector, wanted) => document.querySelector(selector)?.dataset.step === wanted, { timeout: 10_000 }, STEP, step)
    .catch(async () => {
      const at = await page.evaluate((selector) => document.querySelector(selector)?.dataset.step ?? window.location.hash, STEP)
      throw new Error(`the first run is at ${at}, not ${step}`)
    })
  await delay(250)
}

/** Picks the radio card of a group whose label starts with `label`. */
async function choose(page, press, group, label) {
  const labels = await page.$$(`[data-testid="${group}"] label`)
  for (const handle of labels) {
    if ((await handle.evaluate((element) => element.textContent?.trim() ?? '')).startsWith(label)) {
      await press(handle)
      return
    }
  }
  throw new Error(`the ${group} choices hold no "${label}"`)
}

/** The files this browser keeps for the apps, one database each. */
async function filesInBrowser(page) {
  return page.evaluate(async () => (await indexedDB.databases()).filter((database) => database.name?.startsWith('kuna-document-')).length)
}

/** Where the app's chosen file lives, from what the page keeps of the choice, or null for none. */
async function chosenSource(page, app) {
  return page.evaluate((key) => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null')?.source ?? null
    } catch {
      return null
    }
  }, `kuna.workbook-file.${app}`)
}

/** Waits for the app's overview with the chat open on it, the address naming the chat. */
async function overviewWithChat(page, app) {
  await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 15_000 }).catch(() => {
    throw new Error(`Set up with the chat did not open the chat on ${app}`)
  })
  const at = await page.evaluate(() => window.location.hash)
  if (!at.startsWith(`#/${app}`) || at.includes('/start') || !at.includes('chat=1')) throw new Error(`Set up with the chat led to ${at}, not the ${app} overview with the chat`)
  await delay(300)
}

/**
 * The overview's own button, which every new app shows on its empty state or its set-up card. The flow opens the overview without the
 * chat by its address.
 */
async function overviewButton(page, app, shoot) {
  await page.evaluate((hash) => {
    window.location.hash = hash
  }, `#/${app}`)
  await page.waitForFunction(() => !document.querySelector('[data-chat-place="pane"] [data-testid="chat-panel"]') && !window.location.hash.includes('chat='), { timeout: 5_000 }).catch(() => null)
  await page.mouse.move(0, 0)
  const shown = await page.waitForSelector('[data-testid="set-up-chat"]', { visible: true, timeout: 5_000 }).catch(() => null)
  await delay(300)
  await shoot(`${app}-overview-set-up-chat`)
  if (shown === null) throw new Error('the overview shows no Set up with the chat button')
}

/** Presses the home step's chat button after choosing this browser, and checks it made exactly one file in this browser. */
async function madeInBrowser(page, press, app, language, chat, shoot, inspect) {
  const before = await filesInBrowser(page)
  await press(chat)
  await overviewWithChat(page, app)
  const made = (await filesInBrowser(page)) - before
  if (made !== 1) throw new Error(`Set up with the chat made ${made} files in this browser, not one`)
  if ((await chosenSource(page, app)) !== 'browser') throw new Error(`the ${app} file is not the one kept in this browser`)
  await inspect?.(`the ${app} overview with the chat open after Set up with the chat`)
  await shoot(`${app}-set-up-chat-opened`)
}

/** An app's own first run, kept in this browser: the home step offers the chat once this browser is chosen, and the chat opens on the new file's overview. */
export function setUpChatHomeFlowIn(app, language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = named(shootAs, language)
    try {
      await keepAiKey(page)
      await stepShows(page, 'home')
      if ((await page.$(`[data-testid="${app}-start-chat"]`)) !== null) throw new Error('the home step offers the chat before this browser is chosen')
      await choose(page, press, `${app}-start-home`, FIRST_RUN_WORDS[language].home.browser)
      const chat = await page.waitForSelector(`[data-testid="${app}-start-chat"]`, { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error('the home step offers no Set up with the chat for this browser')
      })
      await inspect?.(`the ${app} home step with Set up with the chat`)
      await shoot(`${app}-start-chat-home`)
      await madeInBrowser(page, press, app, language, chat, shoot, inspect)
      await overviewButton(page, app, shoot)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** An app's own first run on Drive: the folder step offers the chat, which makes the file on the fake Drive and opens on its overview. */
export function setUpChatFolderFlowIn(app, language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = named(shootAs, language)
    try {
      await keepAiKey(page)
      await stepShows(page, 'folder')
      const chat = await page.waitForSelector(`[data-testid="${app}-start-chat"]`, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the folder step offers no Set up with the chat')
      })
      await inspect?.(`the ${app} folder step with Set up with the chat`)
      await shoot(`${app}-start-chat-folder`)
      await press(chat)
      await overviewWithChat(page, app)
      if ((await chosenSource(page, app)) !== 'drive') throw new Error(`the ${app} file is not on Drive`)
      await shoot(`${app}-set-up-chat-drive-opened`)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Company's new books kept in this browser: its own home step offers the chat, which makes the books and opens on the overview with the set-up card. */
export function setUpChatCompanyHomeFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = named(shootAs, language)
    try {
      await keepAiKey(page)
      await stepShows(page, 'welcome')
      await pressSelector(page, press, '[data-testid="onboarding-continue"]')
      await stepShows(page, 'home')
      await choose(page, press, 'onboarding-home', ONBOARDING_WORDS[language].home.browser)
      const chat = await page.waitForSelector('[data-testid="onboarding-chat"]', { visible: true, timeout: 5_000 }).catch(() => {
        throw new Error("Company's home step offers no Set up with the chat for new books in this browser")
      })
      await inspect?.("Company's home step with Set up with the chat")
      await shoot('company-start-chat-home')
      await madeInBrowser(page, press, 'company', language, chat, shoot, inspect)
      await overviewButton(page, 'company', shoot)
      if ((await page.$('[data-testid="getting-set-up"] [data-testid="set-up-chat"]')) === null) throw new Error("Company's set-up card has no Set up with the chat in its header")
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Company's new books on Drive: past Google's step, the folder step offers the chat, which makes the books on the fake Drive. */
export function setUpChatCompanyFolderFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = named(shootAs, language)
    try {
      await keepAiKey(page)
      await stepShows(page, 'welcome')
      await pressSelector(page, press, '[data-testid="onboarding-continue"]')
      await stepShows(page, 'home')
      await pressSelector(page, press, '[data-testid="onboarding-continue"]')
      await stepShows(page, 'access')
      if (await page.$('[data-testid="onboarding-google"]')) await pressSelector(page, press, '[data-testid="onboarding-google"]')
      await page.waitForSelector('[data-testid="access-status"]', { visible: true, timeout: 10_000 })
      await delay(300)
      await pressSelector(page, press, '[data-testid="onboarding-continue"]')
      await stepShows(page, 'folder')
      const chat = await page.waitForSelector('[data-testid="company-start-chat"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error("Company's folder step offers no Set up with the chat")
      })
      await inspect?.("Company's folder step with Set up with the chat")
      await shoot('company-start-chat-folder')
      await press(chat)
      await overviewWithChat(page, 'company')
      if ((await chosenSource(page, 'company')) !== 'drive') throw new Error('the Company books are not on Drive')
      await shoot('company-set-up-chat-drive-opened')
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * Makes the app's file in this browser through the home step's chat button, which opens the chat on the new overview with its opening
 * message waiting on the first-send card. `answer` presses Allow here or Cancel on that card.
 */
async function newAppWithChat(page, press, app, language, answer) {
  await keepAiKey(page)
  await stepShows(page, 'home')
  await choose(page, press, `${app}-start-home`, FIRST_RUN_WORDS[language].home.browser)
  await pressSelector(page, press, `[data-testid="${app}-start-chat"]`)
  await overviewWithChat(page, app)
  await page.waitForSelector('[data-testid="chat-consent"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Set up with the chat did not send its opening message')
  })
  const waiting = await page.$eval('textarea[data-testid="chat-prompt"]', (prompt) => prompt.value.trim())
  if (waiting === '') throw new Error('the opening message does not show in the prompt while the first-send card asks')
  await pressSelector(page, press, answer === 'allow' ? '[data-testid="chat-allow"]' : '[data-testid="chat-allow-cancel"]')
  if (answer !== 'allow') {
    // Cancel keeps the message in the prompt, as it does for a typed one, so the flow empties it before typing its own.
    await page.click('textarea[data-testid="chat-prompt"]', { clickCount: 3 })
    await page.keyboard.press('Backspace')
  }
  if (answer === 'allow') {
    await page.waitForSelector('[data-testid="chat-question-by-kuna"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the opening message does not say Kuna sent it')
    })
    await page.waitForSelector('[data-testid="chat-send"]:not([disabled])', { timeout: 15_000 }).catch(() => null)
  }
}

/**
 * A card made while Loans is new says the chat goes on once it is accepted, and Accept sends Go on by itself. `accepts` stops after
 * the card for a check that only shoots it.
 */
export function setUpChatGoesOnFlowIn(language, accepts = true) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = named(shootAs, language)
    const words = CHAT_WORDS[language]
    try {
      await newAppWithChat(page, press, 'loans', language, 'allow')
      await sendInChat(page, press, CONTRACT[language])
      for (let asked = 0; asked < 2; asked += 1) {
        const allow = await page.waitForSelector('[data-testid="chat-allow"]', { visible: true, timeout: 5_000 }).catch(() => null)
        if (allow === null) break
        await press(allow)
      }
      const line = await page.waitForSelector('[data-testid="chat-proposal"][data-state="open"] [data-testid="chat-proposal-goes-on"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the card made while Loans is new does not say the chat goes on')
      })
      const said = await line.evaluate((element) => element.textContent?.trim() ?? '')
      if (said !== words.proposal.goesOn) throw new Error(`the goes-on line says "${said}"`)
      await page.mouse.move(0, 0)
      await delay(300)
      await inspect?.('the card made while Loans is new, with the goes-on line')
      await shoot('loans-chat-goes-on')
      if (!accepts) return
      await pressSelector(page, press, '[data-testid="chat-proposal-accept"]')
      await page
        .waitForFunction(
          (goOn) => [...document.querySelectorAll('[data-testid="chat-messages"] *')].some((element) => element.childElementCount === 0 && element.textContent?.trim() === goOn),
          { timeout: 15_000 },
          words.chat.goOn,
        )
        .catch(() => {
          throw new Error('Accept on the card did not send Go on by itself')
        })
      await page.waitForSelector('[data-testid="chat-send"]:not([disabled])', { timeout: 15_000 }).catch(() => null)
      await delay(400)
      await inspect?.('the chat going on by itself after Accept')
      await shoot('loans-chat-went-on')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** The first send in a new Spending with a file of cells on the prompt asks first, and says the new app knows no names yet. */
export function setUpChatNamesFlowIn(language, cells) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = named(shootAs, language)
    const words = CHAT_WORDS[language]
    try {
      await newAppWithChat(page, press, 'spending', language, 'cancel')
      const input = await page.waitForSelector('[data-testid="chat-attach-input"]', { timeout: 10_000 })
      await input.uploadFile(cells)
      await page.waitForSelector('[data-testid="chat-file"][data-state="ready"]', { visible: true, timeout: 15_000 }).catch(() => {
        throw new Error('the file is not ready on the chat prompt')
      })
      await sendInChat(page, press, language === 'en' ? 'Set up Spending from this file' : 'Postavi Potrošnju iz ove datoteke')
      const card = await page.waitForSelector('[data-testid="chat-consent"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the first send did not ask first')
      })
      const said = await card.evaluate((element) => element.textContent ?? '')
      if (!said.includes(words.chat.newAppNames)) throw new Error('the first-send card does not say the new app knows no names yet')
      await page.mouse.move(0, 0)
      await delay(300)
      await inspect?.('the first-send card of a new Spending with a file of cells')
      await shoot('spending-chat-names-line')
      await pressSelector(page, press, '[data-testid="chat-allow-cancel"]')
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * Runs a flow on a device that keeps nothing yet, for a check that reuses one page across flows: it forgets what this browser keeps,
 * then loads the app's address `hash` again as a first run.
 */
export function onFreshDevice(run, hash) {
  return async (page, tools) => {
    await page.evaluate(async () => {
      localStorage.clear()
      sessionStorage.clear()
      const databases = await indexedDB.databases()
      await Promise.all(
        databases.map(
          (database) =>
            new Promise((resolve) => {
              const deleting = indexedDB.deleteDatabase(database.name ?? '')
              deleting.onsuccess = deleting.onerror = deleting.onblocked = () => resolve(undefined)
            }),
        ),
      )
    })
    await page.goto(page.url().replace(/#.*$/, hash), { waitUntil: 'networkidle0' })
    await page.reload({ waitUntil: 'networkidle0' })
    await run(page, tools)
  }
}

/** An app's sample with records and set-up lines left: the set-up card leaves the chat out, as the app is no longer new. */
export function setUpCardHeaderFlowIn(app, language) {
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = named(shootAs, language)
    try {
      await keepAiKey(page)
      await page.waitForSelector('[data-testid="getting-set-up"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error(`the ${app} sample shows no set-up card`)
      })
      const button = await page.$('[data-testid="getting-set-up"] [data-testid="set-up-chat"]')
      await page.mouse.move(0, 0)
      await delay(300)
      await inspect?.(`the ${app} set-up card of a file with records`)
      await shoot(`${app}-set-up-card-chat`)
      if (button !== null) throw new Error(`the ${app} set-up card offers Set up with the chat though the file has records`)
    } finally {
      await forgetAssist(page)
    }
  }
}
