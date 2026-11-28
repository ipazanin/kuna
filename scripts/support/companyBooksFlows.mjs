/**
 * Company's flows about where the books are kept, shared by the visual and the touch check: onboarding, moving the
 * books, sync, saves that wait or fail, and mail. `press` clicks or taps an element handle, and `shoot` takes a screenshot
 * under a name. A failure throws with what was missing.
 */

import { en as companySettingsEnglish, hr as companySettingsCroatian } from '../../src/apps/company/settings/presentation/words.ts'
import { en as mailEnglish, hr as mailCroatian } from '../../src/apps/company/mail/presentation/words.ts'
import { en as writesEnglish, hr as writesCroatian } from '../../src/shared/storage/presentation/words.ts'
import { delay, pressSelector } from './pressing.mjs'
import { saveSettingsButton, toastCounted } from './companyFlows.mjs'
import {
  ALL_KINDS,
  SCREEN_WORDS,
  SYNC_BUTTON,
  SYNC_CARD,
  SYNC_STEPS,
  choose,
  chooseOption,
  controlLanded,
  controlSaving,
  controlShows,
  countedIn,
  dialogGone,
  dismissToasts,
  elementSays,
  exactly,
  inKunaFolder,
  noToast,
  onboardingAt,
  openKunaSettings,
  pageSays,
  pressButton,
  pressLabelled,
  savingControl,
  scrollToTop,
  setField,
  shootAt,
  shotInLanguage,
  stepSays,
  syncAndSettle,
  syncButton,
  toast,
  toastMatching,
  undoIn,
} from './flowHelpers.mjs'

/** A pattern for a counted phrase of the app's words with any count, given its forms as they read for 1000. */
function anyCount(forms) {
  return new RegExp(
    `^(?:${Object.values(forms)
      .map((form) => form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('1000', '\\d+'))
      .join('|')})$`,
  )
}

const FILED = /Filed statement \d+, 4 rows/

/**
 * Sync files the sample statement from the fake bank's mail and says so in the statement mail
 * step, not in a toast. Undo in the step's line on Kuna settings takes it out, the card's
 * Sync again files it again, and Import lists it. A last sync finds nothing new and says so there.
 */
export async function statementSyncFlow(page, { press, shoot }) {
  await syncAndSettle(page, press)
  await noToast(page, 'a sync that filed a statement showed a toast')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', FILED)
  await shootAt(page, shoot, SYNC_CARD, 'statements-filed', { block: 'start' })
  await pressSelector(page, press, `${SYNC_CARD} [data-step="mail"] [data-testid="sync-step-undo"]`)
  await toast(page, 'Undone')
  await page
    .waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, `${SYNC_CARD} [data-testid="sync-step-undo"]`)
    .catch(() => {
      throw new Error('the statement mail step still offers Undo after it was undone')
    })
  await dismissToasts(page)

  await pressSelector(page, press, `${SYNC_CARD} [data-testid="sync-again"]`)
  await stepSays(page, SYNC_CARD, 'mail', 'done', FILED)
  await noToast(page, 'a sync from the Sync card showed a toast')
  await page.evaluate(() => {
    window.location.hash = '#/company/transactions?tab=import'
  })
  await page.waitForSelector('[data-testid="mailed-statements-filed"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Import does not list the statement the sync filed')
  })
  await delay(300)
  await shoot('mailed-statements-filed')

  await syncAndSettle(page, press)
  await noToast(page, 'a sync that found nothing new showed a toast')
  if (await page.$('[data-testid="mailed-statements"]')) throw new Error("the card of the bank's mail stayed after a sync that found nothing new")
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', /Nothing new/)
}

/**
 * With a statement of an account the accounts tab lacks in the bank's mail, Sync files the sample and
 * holds the other: the control says 1 waiting, not a problem, and its steps, in a popover from 640 px and a bottom
 * sheet on a phone, link to Import, which offers to add the account. Overview lists the held
 * statement too. Named and confirmed on Import, the account is added and the statement filed.
 */
export async function heldStatementFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'waiting')
  if (control.label !== '1 waiting') throw new Error(`the sync control says "${control.label}", not 1 waiting`)
  await noToast(page, 'a sync that held a statement showed a toast')
  await inspect?.('the sync control with a step waiting for you')
  await shoot('sync-waiting')
  await press(await syncButton(page))
  const said = await stepSays(page, '', 'mail', 'waits', /1 statement was not filed/)
  if (!FILED.test(said)) throw new Error(`the statements step does not say what it filed, it says: ${said}`)
  await delay(400)
  await inspect?.('the steps of the last sync')
  await shoot('sync-steps')
  await pressSelector(page, press, `${SYNC_STEPS} [data-step="mail"] a`)
  await page
    .waitForFunction(() => document.querySelector('[data-testid="mailed-statements"] [data-testid="dry-run-new-account"]')?.textContent?.includes('is new') ?? false, { timeout: 10_000 })
    .catch(() => {
      throw new Error('Import does not offer the account the held statement names')
    })
  await page
    .waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, SYNC_STEPS)
    .catch(() => {
      throw new Error('the steps stayed open over Import')
    })
  await delay(300)
  await inspect?.('the held statement on Import')
  await shoot('statements-held-import')
  await page.evaluate(() => {
    window.location.hash = '#/company'
  })
  const job = await page.waitForSelector('[data-job="statements"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Overview has no line for the statement the sync held')
  })
  const text = await job.evaluate((element) => element.textContent ?? '')
  if (!text.includes('1 statement was not filed')) throw new Error(`the held statement's line says: ${text}`)

  await page.evaluate(() => {
    window.location.hash = '#/company/transactions?tab=import'
  })
  const name = await page.waitForSelector('[data-testid="mailed-statements"] input[data-testid="dry-run-account-name"]', { visible: true, timeout: 10_000 })
  await setField(name, 'second')
  await pressSelector(page, press, '[data-testid="mailed-statements-confirm"]')
  await toastMatching(page, /^Filed statement/)
  await page
    .waitForFunction(() => !document.querySelector('[data-testid="dry-run-new-account"]'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('the held statement still offers its account after it was filed')
    })
  await page.evaluate(() => {
    window.location.hash = '#/company/settings?tab=accounts'
  })
  await page
    .waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === 'second'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('Settings, Accounts does not list the account the import added')
    })
}

const LOAN_SWITCH = '[data-testid="loan-bucket"] [role="switch"]'

/** Settings, General, with saves that take seconds: the switch moves at once and spins while the form stays usable, and what is typed there survives the switch's save. */
export async function savesWaitingFlow(page, { press, shoot, inspect }) {
  const handle = await page.waitForSelector(LOAN_SWITCH, { visible: true, timeout: 10_000 })
  await handle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  const { value: was } = await savingControl(page, LOAN_SWITCH)
  await press(handle)
  await controlSaving(page, LOAN_SWITCH, was)
  await shoot(await shotInLanguage(page, 'saves-waiting-switch'))

  const name = await page.waitForSelector('input[data-testid="company-name"]', { visible: true, timeout: 5_000 })
  await setField(name, 'Primjer d.o.o.')
  await controlLanded(page, LOAN_SWITCH)
  await inspect?.('the switch once its save landed')
  if ((await name.evaluate((input) => input.value)) !== 'Primjer d.o.o.') throw new Error('the save that landed wiped what was typed in the form')
  if ((await savingControl(page, LOAN_SWITCH)).value === was) throw new Error('the switch went back after its save landed')

  // The fake books start on, so this tap saves towards On, where a track left amber would already read as on.
  const off = (await savingControl(page, LOAN_SWITCH)).value
  await press(handle)
  await controlSaving(page, LOAN_SWITCH, off)
  await shoot(await shotInLanguage(page, 'saves-waiting-switch-on'))
  await controlLanded(page, LOAN_SWITCH)

  const undo = await page.waitForFunction(
    () => [...document.querySelectorAll('[data-slot="actions"] button')].filter((button) => ['Undo', 'Poništi'].includes(button.textContent?.trim())).at(-1) ?? null,
    { timeout: 5_000 },
  )
  await undo.asElement().evaluate((button) => button.click())
  await controlSaving(page, LOAN_SWITCH, 'true')
  await controlLanded(page, LOAN_SWITCH)

  const save = await page.waitForSelector('form button[type="submit"]:not(:disabled)', { timeout: 5_000 })
  await save.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(save)
  await page.waitForSelector('form button[type="submit"] .animate-spin', { timeout: 2_000 }).catch(() => {
    throw new Error('the form Save does not spin while its save waits')
  })
  await shoot(await shotInLanguage(page, 'saves-waiting-form'))
  await page.waitForFunction(() => document.querySelector('[data-testid="write-progress"]') === null, { timeout: 15_000 })
}

/** Settings, General, with a save that fails: the switch moves at once, then flips back, a toast says why, and its Try again saves it. */
export async function saveFailsFlow(page, { press, shoot }) {
  const handle = await page.waitForSelector(LOAN_SWITCH, { visible: true, timeout: 10_000 })
  await handle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  const { value: was } = await savingControl(page, LOAN_SWITCH)
  await press(handle)
  await controlSaving(page, LOAN_SWITCH, was)
  const writes = (await page.evaluate(() => document.documentElement.lang)) === 'hr' ? writesCroatian : writesEnglish
  const plainSentence = writes.driveFailed
  await page
    .waitForFunction((sentence) => [...document.querySelectorAll('[data-slot="description"]')].some((toast) => toast.textContent?.endsWith(`: ${sentence}`)), { timeout: 15_000 }, plainSentence)
    .catch(() => {
      throw new Error('no toast names the write that failed in one plain sentence')
    })
  await controlLanded(page, LOAN_SWITCH)
  if ((await savingControl(page, LOAN_SWITCH)).value !== was) throw new Error('the switch did not flip back after its save failed')
  const tryAgain = await page
    .waitForFunction((label) => [...document.querySelectorAll('[data-slot="actions"] button')].find((button) => button.textContent?.trim() === label) ?? null, { timeout: 5_000 }, writes.tryAgain)
    .catch(() => {
      throw new Error('the toast of the failed save offers no Try again')
    })
  // The toast slides in, so the shot waits until it stands still and Try again sits inside the window.
  await page
    .waitForFunction(
      (button) => {
        const box = button.getBoundingClientRect()
        const still = window.tryAgainLeft === box.left
        window.tryAgainLeft = box.left
        return still && box.left >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight
      },
      { polling: 100, timeout: 5_000 },
      tryAgain,
    )
    .catch(() => {
      throw new Error('Try again on the toast of the failed save does not settle inside the window')
    })
  await shoot(await shotInLanguage(page, 'save-fails'))
  await press(tryAgain.asElement())
  await controlSaving(page, LOAN_SWITCH, was)
  await controlLanded(page, LOAN_SWITCH)
  if ((await savingControl(page, LOAN_SWITCH)).value === was) throw new Error('the switch went back after Try again saved it')
}

/** With a slow search of the bank's mail, the control names the running step and its place, and a screen reader hears it, until the sync is done. */
export async function syncRunningFlow(page, { press, shoot, inspect }) {
  await press(await syncButton(page))
  const running = await controlShows(page, 'running')
  await page
    .waitForFunction(() => document.querySelector('[data-testid="sync-button"]')?.getAttribute('aria-label')?.startsWith('Syncing, Statement mail, step 2 of 2') ?? false, { timeout: 10_000 })
    .catch(async () => {
      throw new Error(`the running control does not name the statement mail step, a screen reader hears "${running.name}"`)
    })
  const shown = await controlShows(page, 'running')
  if (!shown.disabled) throw new Error('the sync control takes a tap while the sync runs')
  if (!/^Statement mail 2\/2$|^Syncing$/.test(shown.label)) throw new Error(`the running control says "${shown.label}"`)
  await inspect?.('the sync control while the statement mail step runs')
  await shoot('sync-running')
  const ready = await controlShows(page, 'ready')
  if (!ready.name.startsWith('Synced ')) throw new Error(`the ready control is heard as "${ready.name}"`)
  await inspect?.('the sync control once the sync is done')
  await shoot('sync-ready')
}

/**
 * A held statement in a language: the sync control says 1 waiting, its steps name the statement mail
 * step and link to Import, which offers to add the account the statement names. Nothing is written.
 */
export function heldStatementFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await syncAndSettle(page, press)
    await controlShows(page, 'waiting')
    await press(await syncButton(page))
    const held = countedIn(words, words.imports.step.held(1), 1)
    await stepSays(page, '', 'mail', 'waits', new RegExp(held.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await delay(400)
    await inspect?.('the steps of the last sync')
    await shoot('sync-steps')
    await pressSelector(page, press, `${SYNC_STEPS} [data-step="mail"] a`)
    await page.waitForSelector('[data-testid="mailed-statements"] [data-testid="dry-run-new-account"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Import does not offer the account the held statement names')
    })
    await elementSays(page, '[data-testid="mailed-statements"]', [words.imports.mailed.title, words.imports.mailed.filedByLastSync], "the card of the bank's mail is not in its language")
    await delay(300)
    await inspect?.('the held statement on Import')
    await shoot('statements-held-import')
  }
}

const MAIL_CARD = '[data-testid="mail-settings"]'
const MAIL_PLAN = '[data-testid="mail-plan"]'

/** Waits until the mail card lists entries of each of these kinds, and returns the kind of every entry it lists. */
async function mailListShows(page, wanted) {
  return page
    .waitForFunction(
      (selector, expected) => {
        const kinds = [...document.querySelectorAll(`${selector} [data-testid="mail-entry"]`)].map((entry) => entry.dataset.entry)
        return expected.every((kind) => kinds.includes(kind)) ? kinds : null
      },
      { timeout: 10_000 },
      MAIL_PLAN,
      wanted,
    )
    .then((handle) => handle.jsonValue())
    .catch(async () => {
      const shown = await page.evaluate((selector) => [...document.querySelectorAll(`${selector} [data-testid="mail-entry"]`)].map((entry) => entry.dataset.entry).join(', '), MAIL_PLAN)
      throw new Error(`the mail card does not list ${wanted.join(', ')}, it lists ${shown || 'nothing'}`)
    })
}

/** Opens the mail card on Settings, General at #mail. */
async function openMailCard(page) {
  await page.evaluate(() => {
    window.location.hash = '#/company/settings#mail'
  })
  await page.waitForSelector(MAIL_CARD, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Settings, General has no mail card at #mail')
  })
}

/**
 * A sync in a language and every place that says how it went: the sync control before, during and
 * after it, the steps it opens when it has something to say, the sync card on Kuna settings, and the
 * mail card with what the mail step found. `stored` is what this device keeps before the page loads
 * again, such as a token without Gmail read, and a null takes the key away. Each state is inspected,
 * so the visual check reads its words, and the fake variant decides what the sync meets. It runs once for each variant, so
 * each run names its shots with its own `shots` prefix.
 */
export function syncStatesFlowIn(shots, stored = {}) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(`${shots}-${name}`)
    if (Object.keys(stored).length > 0) {
      await page.evaluate((entries) => {
        for (const [key, value] of Object.entries(entries)) {
          if (value === null) localStorage.removeItem(key)
          else localStorage.setItem(key, value)
        }
      }, stored)
      await page.reload({ waitUntil: 'networkidle0' })
    }
    await inspect?.('the sync control before the sync')
    await press(await syncButton(page))
    await inspect?.('the sync control as the sync runs')
    await page
      .waitForFunction((selector) => [...document.querySelectorAll(selector)].some((element) => element.offsetParent !== null && !element.disabled), { timeout: 12_000, polling: 100 }, SYNC_BUTTON)
      .catch(() => {
        throw new Error('the sync did not finish within 12 s')
      })
    await delay(400)
    await inspect?.('the sync control once the sync is done')
    await shoot('sync-control')
    const control = await page.evaluate(() => [...document.querySelectorAll('[data-testid="sync-status"]')].find((element) => element.offsetParent !== null)?.dataset.control ?? '')
    if (control === 'problems' || control === 'waiting') {
      await press(await syncButton(page))
      await page.waitForSelector(`${SYNC_STEPS} [data-step]`, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error(`the sync control with ${control} did not open its steps`)
      })
      await delay(400)
      await inspect?.('the steps the sync control opens')
      await shoot('sync-steps')
      await page.keyboard.press('Escape')
      await delay(300)
    }
    await openKunaSettings(page)
    await scrollToTop(page, SYNC_CARD)
    await inspect?.('the sync card on Kuna settings')
    await shoot('sync-card')
    await openMailCard(page)
    await scrollToTop(page, MAIL_CARD)
    await inspect?.('the mail card')
    await shoot('mail-card')
  }
}

/** The mail card in a language once a sync read the fake bank's mail: its search and what each attachment gave. */
export function mailListFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await syncAndSettle(page, press)
    await openKunaSettings(page)
    await stepSays(page, SYNC_CARD, 'mail', 'done', /./)
    await scrollToTop(page, SYNC_CARD)
    await shoot('mail-step')
    await openMailCard(page)
    await mailListShows(page, ALL_KINDS)
    await elementSays(page, MAIL_CARD, [words.mail.card.title, words.mail.card.lastSync, words.mail.card.kinds.read], 'the mail card is not in its language')
    await scrollToTop(page, MAIL_PLAN)
    await inspect?.('the mail list')
    await shoot('mail-list')
  }
}

/**
 * The mail list specimens in the Company gallery: the bank's statements with every kind of entry, more than ten so Show all shows
 * the rest, then a list whose step stopped. The fake bank's mail alone never shows that many. The gallery is English only.
 */
export async function mailPlanSpecimenFlow(page, { press, shoot, inspect }) {
  const specimen = '[data-testid="gallery-mail-plan"]'
  await page.waitForSelector(specimen, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the Company gallery has no mail list specimen')
  })
  const entries = () => page.$$eval(`${specimen} [data-entry]`, (rows) => rows.map((row) => row.dataset.entry))
  if ((await entries()).length !== 10) throw new Error(`the mail list specimen shows ${(await entries()).length} entries before Show all, not 10`)
  await scrollToTop(page, specimen)
  await inspect?.('the mail list specimen')
  await shoot('mail-plan-specimen')
  await pressSelector(page, press, `${specimen} [data-testid="show-all"]`)
  await page
    .waitForFunction((css) => document.querySelectorAll(css).length === 12, { timeout: 5_000 }, `${specimen} [data-entry]`)
    .catch(() => {
      throw new Error('Show all on the mail list specimen did not show all 12 entries')
    })
  const kinds = new Set(await entries())
  for (const kind of ALL_KINDS) {
    if (!kinds.has(kind)) throw new Error(`the mail list specimen has no ${kind} entry`)
  }
  await inspect?.('the mail list specimen with every entry')
  const stopped = await page.$eval('[data-testid="gallery-mail-stopped"] [data-testid="mail-stopped"]', (paragraph) => paragraph.textContent?.trim() ?? '').catch(() => '')
  if (stopped !== 'Gmail asked us to slow down. Sync again in a minute.') throw new Error(`the stopped mail list specimen says "${stopped}"`)
  await scrollToTop(page, '[data-testid="gallery-mail-stopped"]')
  await inspect?.('the mail list specimen whose step stopped')
  await shoot('mail-plan-specimen-stopped')
}

/**
 * With no sender named, the mail step is off in the steps of a sync. On Settings, General the mail
 * card takes a sender, asks for the subject a sender needs, and saves both, and the next sync's mail
 * step files the sample statement and lists the rest. The page holds every scope, as a first open
 * does, so the save asks Google nothing.
 */
export async function mailOffFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => {
    for (const key of ['kuna.google-granted', 'kuna.google-needed']) localStorage.removeItem(key)
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await syncAndSettle(page, press)
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'off', /Off in Settings/)
  const leftOut = await page.evaluate(
    (css) => ['rates', 'secrets', 'bank-sync'].filter((id) => document.querySelector(`${css} [data-step="${id}"][data-state="off"]`) !== null),
    `${SYNC_CARD} ${SYNC_STEPS}`,
  )
  if (leftOut.length > 0) throw new Error(`the step list shows ${leftOut.join(', ')}, which are left out while the file has nothing for them`)
  await openMailCard(page)
  const senders = await page.waitForSelector(`${MAIL_CARD} [data-testid="statements-mail-from"] input`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Settings, General has no mail card open at #mail')
  })
  await scrollToTop(page, MAIL_CARD)
  await inspect?.('the mail card with no sender')
  await shoot('mail-card-off')
  await setField(senders, 'statements@bank.example.com')
  await page
    .waitForFunction(
      (selector) => document.querySelector(`${selector} [data-testid="statements-mail-subject"]`)?.textContent?.includes('name the words before the statement number') ?? false,
      { timeout: 5_000 },
      MAIL_CARD,
    )
    .catch(() => {
      throw new Error('the mail card does not ask for a subject beside a sender')
    })
  await saveSettingsButton(page, false)
  await setField(await page.$(`${MAIL_CARD} [data-testid="statements-mail-subject"] input`), 'Izvadak')
  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  await dismissToasts(page)
  await syncAndSettle(page, press)
  await noToast(page, 'a sync with mail on showed a toast')
  await mailListShows(page, ALL_KINDS)
  await scrollToTop(page, MAIL_CARD)
  await inspect?.('the mail card once saved and synced')
  await shoot('mail-card-saved')
}

/**
 * The mail step reads the sample statement from the fake bank's mail and files it on the ledger in the same step, keeping
 * nothing on Drive. Its link opens the list on the mail card, which marks what it read beside what it passed over or could not
 * read. A second sync files nothing new.
 */
export async function mailFiledFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await noToast(page, 'a sync that filed mail showed a toast')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', FILED)
  await scrollToTop(page, SYNC_CARD)
  await inspect?.('the mail step that read and filed a statement')
  await shoot('mail-step')
  await openMailCard(page)
  const kinds = await mailListShows(page, ALL_KINDS)
  if (kinds.filter((kind) => kind === 'read').length !== 2) throw new Error(`the list reads ${JSON.stringify(kinds)}, not the sample statement from both of its mails`)
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list of what the mail step read and passed over')
  await shoot('mail-list')

  await syncAndSettle(page, press)
  await openKunaSettings(page)
  const line = await stepSays(page, SYNC_CARD, 'mail', 'done', /Nothing new/)
  if (line.includes('Filed')) throw new Error(`a second sync's mail step says "${line}"`)
}

/** Mail whose statements the books hold already says nothing new, and opens no problem. */
export async function mailNothingNewFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', /Nothing new/)
  await scrollToTop(page, SYNC_CARD)
  await inspect?.('the mail step with nothing new')
  await shoot('mail-nothing-new')
}

/** A search that fails fails the mail step with why in its line: 1 problem in the control, and the mail card says the same in place of its list. */
export async function mailFailedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(page, '', 'mail', 'failed', /Gmail did not answer the search/)
  await delay(400)
  await inspect?.('the steps with a mail search that failed')
  await shoot('mail-failed-steps')
  await page.keyboard.press('Escape')
  await delay(300)
  await openMailCard(page)
  const said = await page
    .waitForSelector(`${MAIL_PLAN} [data-testid="mail-stopped"]`, { visible: true, timeout: 10_000 })
    .then((element) => element.evaluate((paragraph) => paragraph.textContent?.trim() ?? ''))
  if (said !== 'Gmail did not answer the search. Sync again later') throw new Error(`the mail card says "${said}"`)
  await shootAt(page, shoot, `${MAIL_PLAN} [data-testid="mail-stopped"]`, 'mail-failed-list')
}

/** A token without Gmail read shows Allow access for the mail step as the app opens, and that tap runs it. */
export async function mailAccessFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'gmail.compose'])))
  await page.reload({ waitUntil: 'networkidle0' })
  const control = await controlShows(page, 'allow-access')
  if (control.label !== 'Allow access') throw new Error(`the sync control says "${control.label}", not Allow access`)
  if (!control.name.includes('Statement mail needs your Gmail read access')) throw new Error(`a screen reader hears "${control.name}"`)
  await inspect?.('the sync control asking for Gmail read access')
  await shoot('mail-allow-access')
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await noToast(page, 'the sync after Allow access showed a toast')
  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', FILED)
}

/**
 * Books kept in this browser whose bank still mails statements: the top bar shows their Export beside Sync, whose first tap finds
 * no Gmail access, and Allow access asks Google for Gmail read alone. The sync then files the statement while the books step reads
 * nothing and no Drive step runs, its Undo takes it out, Kuna settings shows the Sync and Mail cards, and Import lists what it filed.
 */
export async function browserMailFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector('[data-testid="local-status"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('books kept in this browser show no Export')
  })
  await controlShows(page, 'ready')
  const exportLabels = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="local-status"] button')]
      .filter((button) => button.offsetParent !== null)
      .map((button) => ({ topBar: button.closest('header') !== null, text: button.textContent?.trim() ?? '' })),
  )
  if (exportLabels.some((label) => label.topBar && label.text !== ''))
    throw new Error(`the top bar's Export beside Sync reads "${exportLabels.find((label) => label.topBar)?.text}", not its icon alone`)
  if (exportLabels.some((label) => !label.topBar && label.text === '')) throw new Error("the sidebar's Export shows its icon alone")
  const needed = await page.evaluate(() => JSON.parse(localStorage.getItem('kuna.google-needed') ?? 'null'))
  if (JSON.stringify(needed) !== JSON.stringify(['gmail.readonly'])) throw new Error(`the page needs ${JSON.stringify(needed)} of Google, not Gmail read alone`)
  await inspect?.('Export beside Sync for books kept in this browser that read the mail')
  await shoot('mail-browser-top-bar')

  await syncAndSettle(page, press)
  const control = await controlShows(page, 'allow-access')
  if (!control.name.includes('Statement mail needs your Gmail read access')) throw new Error(`a screen reader hears "${control.name}"`)
  await inspect?.('Allow access beside Export for books kept in this browser')
  await shoot('mail-browser-allow-access')
  await syncAndSettle(page, press)
  const synced = await controlShows(page, 'ready')
  if (/Not synced yet/.test(synced.name)) throw new Error(`after a sync the control still says "${synced.name}"`)
  await noToast(page, 'a sync that filed mail into books kept in this browser showed a toast')

  await openKunaSettings(page)
  await stepSays(page, SYNC_CARD, 'books', 'done', /Kept in this browser/)
  await stepSays(page, SYNC_CARD, 'mail', 'done', FILED)
  const steps = await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((step) => step.dataset.step), `${SYNC_CARD} ${SYNC_STEPS} [data-step]`)
  if (JSON.stringify(steps) !== JSON.stringify(['books', 'mail'])) throw new Error(`the sync of books kept in this browser lists ${JSON.stringify(steps)}, not their books and mail alone`)
  await page.waitForSelector('[data-testid="mail-card"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('Kuna settings has no Mail card for books kept in this browser')
  })
  await scrollToTop(page, SYNC_CARD)
  await inspect?.('the Sync card of books kept in this browser that read the mail')
  await shoot('mail-browser-settings')

  await pressSelector(page, press, `${SYNC_CARD} [data-step="mail"] [data-testid="sync-step-undo"]`)
  await toast(page, 'Undone')
  await dismissToasts(page)
  await pressSelector(page, press, `${SYNC_CARD} [data-testid="sync-again"]`)
  await stepSays(page, SYNC_CARD, 'mail', 'done', FILED)
  await page.evaluate(() => {
    window.location.hash = '#/company/transactions?tab=import'
  })
  await page.waitForSelector('[data-testid="mailed-statements-filed"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Import does not list the statement the sync filed into books kept in this browser')
  })
  await delay(300)
  await shoot('mail-browser-filed')
}

/**
 * A token without Gmail read and the mail step off: saving a sender and subject on the Mail card
 * asks Google in that same tap, so the sync control never shows Allow access, and the sync that
 * follows the save reads the bank's mail.
 */
export function mailSaveAsksFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.evaluate(() => {
      for (const key of ['kuna.google-needed', 'kuna.google-silent-refused']) localStorage.removeItem(key)
      localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'gmail.compose']))
    })
    await page.reload({ waitUntil: 'networkidle0' })
    await controlShows(page, 'ready')
    await openMailCard(page)
    const senders = await page.waitForSelector(`${MAIL_CARD} [data-testid="statements-mail-from"] input`, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Settings, General has no mail card open at #mail')
    })
    await setField(senders, 'statements@bank.example.com')
    await setField(await page.$(`${MAIL_CARD} [data-testid="statements-mail-subject"] input`), 'Izvadak')
    await press(await saveSettingsButton(page, true, words))
    await toast(page, words.settings.saved)
    await mailListShows(page, ALL_KINDS)
    const control = await controlShows(page, 'ready')
    if (control.label === words.sync.allowAccess) throw new Error('the sync control asks for access after a save that asked for it')
    const granted = await page.evaluate(() => JSON.parse(localStorage.getItem('kuna.google-granted') ?? '[]'))
    if (!granted.includes('gmail.readonly')) throw new Error(`the save asked Google for ${granted.join(', ')}, without Gmail read`)
    await scrollToTop(page, MAIL_CARD)
    await inspect?.('the mail card saved with Gmail read asked in the same tap')
    await shoot('mail-save-asks')
    await page.evaluate(() => localStorage.removeItem('kuna.google-granted'))
  }
}

export const mailSaveAsksFlow = mailSaveAsksFlowIn('en')

/**
 * With no account taking the bank's statements, the mail card's Accounts it fills says so and links to the Accounts tab, and the
 * mail step asks for no Gmail access and links there too.
 */
export function mailNoAccountFlowIn(language) {
  const settingsWords = language === 'en' ? companySettingsEnglish : companySettingsCroatian
  const mailWords = language === 'en' ? mailEnglish : mailCroatian
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.evaluate(() => {
      window.location.hash = '#/company/settings?tab=accounts'
    })
    await page.waitForSelector('[data-testid="accounts-editor"]', { visible: true, timeout: 10_000 })
    const byBank = await page.waitForFunction(
      (wanted) => [...document.querySelectorAll('[data-testid="account-rows-from"]')].find((select) => select.textContent?.includes(wanted)) ?? null,
      { timeout: 5_000 },
      settingsWords.accounts.rowsFrom.mail,
    )
    await choose(page, press, byBank.asElement(), settingsWords.accounts.rowsFrom.byHand)
    await pressLabelled(page, press, 'body', settingsWords.accounts.save)
    await toast(page, settingsWords.accounts.saved)
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/company/settings#mail'
    })
    await page.waitForSelector(`${MAIL_CARD} [data-testid="mail-accounts"]`, { visible: true, timeout: 10_000 })
    await elementSays(
      page,
      `${MAIL_CARD} [data-testid="mail-accounts"]`,
      [mailWords.card.noAccount, mailWords.step.seeAccounts],
      "the mail card does not say that no account takes the bank's statements",
    )
    await scrollToTop(page, MAIL_CARD)
    await inspect?.("the mail card with no account taking the bank's statements")
    await shoot('mail-card-no-account')
  }
}

/** Gmail still asking to slow down after the retries fails the mail step with one plain sentence, and none of Google's answer. The mail card says the same sentence in place of its list. */
export async function mailRateLimitedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  const line = await stepSays(page, '', 'mail', 'failed', /Gmail asked us to slow down\. Sync again in a minute\.$/)
  if (/[{}]|rateLimit|403|429/.test(line)) throw new Error(`the mail step shows Google's answer: "${line}"`)
  await delay(400)
  await inspect?.('the steps after Gmail asked to slow down')
  await shoot('mail-rate-limited')
  await page.keyboard.press('Escape')
  await delay(300)
  await openMailCard(page)
  const said = await page
    .waitForSelector(`${MAIL_PLAN} [data-testid="mail-stopped"]`, { visible: true, timeout: 10_000 })
    .then((element) => element.evaluate((paragraph) => paragraph.textContent?.trim() ?? ''))
    .catch(() => {
      throw new Error('the mail card does not say why the last sync stopped')
    })
  if (said !== 'Gmail asked us to slow down. Sync again in a minute.') throw new Error(`the mail card says "${said}"`)
  await shootAt(page, shoot, `${MAIL_PLAN} [data-testid="mail-stopped"]`, 'mail-rate-limited-card')
}

/** With the main account's newest statement on the books, the search starts a week before it and not from the start day. */
export async function mailWindowFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await openMailCard(page)
  await mailListShows(page, ['passed-over'])
  const windows = await page.$$eval(`${MAIL_PLAN} [data-testid="mail-source-window"]`, (lines) => lines.map((line) => line.textContent?.trim() ?? ''))
  if (windows.length !== 1 || !windows.every((line) => /^Searched from \d{1,2} \w{3,4} 2026, a week before the day the mail must still reach back to$/.test(line)))
    throw new Error(`the search started ${JSON.stringify(windows)}`)
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list searched from a week before the newest statement')
  await shoot('mail-window')
}

/**
 * A device whose silent trip Google refused, as Firefox does, shows Allow access before any sync.
 * With `?fake=google-closed` Google's window closes in that tap: the control stays in Allow access
 * with a line that says what happened and that a tap tries again, beside the sidebar's button or in
 * what a screen reader hears and the top bar button's tooltip, and no toast shows.
 */
export async function accessClosedFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => localStorage.setItem('kuna.google-silent-refused', 'interaction_required'))
  await page.reload({ waitUntil: 'networkidle0' })
  await controlShows(page, 'allow-access')
  await press(await syncButton(page))
  const said = "Google's window was closed before access was allowed. Tap Allow access to try again."
  await page
    .waitForFunction(
      (text) => [...document.querySelectorAll('[data-testid="sync-button"]')].some((button) => button.offsetParent !== null && (button.getAttribute('aria-label') ?? '').includes(text)),
      { timeout: 10_000 },
      said,
    )
    .catch(async () => {
      throw new Error(`a screen reader does not hear why Google gave no token, it hears "${(await controlShows(page, 'allow-access')).name}"`)
    })
  const control = await controlShows(page, 'allow-access')
  if (control.label !== 'Allow access') throw new Error(`the sync control says "${control.label}", not Allow access`)
  const shown = await page.evaluate(() => {
    const line = [...document.querySelectorAll('[data-testid="sync-line"]')].find((element) => element.offsetParent !== null)
    const button = [...document.querySelectorAll('[data-testid="sync-button"]')].find((element) => element.offsetParent !== null)
    return line === undefined ? (button?.getAttribute('title') ?? '') : (line.textContent?.trim() ?? '')
  })
  if (shown !== said) throw new Error(`the sync control says "${shown}" after Google's window closed`)
  if (await page.$('[data-testid="sync-steps"] [data-step]')) throw new Error('a sync ran after Google gave no token')
  await noToast(page, 'a closed Google window showed a toast')
  await inspect?.("the sync control after Google's window closed")
  await shoot('sync-access-closed')
  await page.evaluate(() => localStorage.removeItem('kuna.google-silent-refused'))
}

/** Settings, Books file names the file on the fake Drive, its folder, and that no backup is made yet, or with `saved` that the save onboarding made today made one. */
async function booksShowDriveFile(page, saved, words, inKuna = true) {
  await page.evaluate(() => {
    window.location.hash = '#/company/settings?tab=books'
  })
  await page
    .waitForFunction((folder) => document.querySelector('[data-testid="drive-file-place"] a')?.textContent?.trim() === folder, { timeout: 10_000 }, inKuna ? 'company' : 'Books')
    .catch(() => {
      throw new Error('Settings, Books file does not name the folder the file sits in')
    })
  await pageSays(page, 'kuna-company.json', true)
  await pageSays(page, words.writes.booksFile.noBackup, !saved)
}

/** Continue to Google, which the fake build's Google grants at once, unless the page holds a token already, then Continue once the step says Allowed. */
async function allowGoogle(page, press, { shoot, inspect }, words = SCREEN_WORDS.en) {
  await onboardingAt(page, 'access')
  await inspect?.('the access step')
  await shoot('onboarding-access')
  if (await page.$('[data-testid="onboarding-google"]')) await pressSelector(page, press, '[data-testid="onboarding-google"]')
  await page
    .waitForFunction(
      (allowed) => [...document.querySelectorAll('[data-testid="access-status"]')].some((badge) => badge.textContent?.trim() === allowed),
      { timeout: 10_000 },
      words.onboarding.access.allowed,
    )
    .catch(() => {
      throw new Error('the access step does not say Google allowed the books file')
    })
  await shoot('onboarding-access-allowed')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
}

/** The folder step: the confirm names the new Kuna folder at the top of My Drive, and Create the file here makes the folders and the file. */
async function confirmFolder(page, press, { shoot, inspect }, named) {
  await onboardingAt(page, 'folder')
  const confirm = await page.waitForSelector('[data-testid="company-start-folder-confirm"]', { visible: true, timeout: 10_000 })
  const said = await confirm.evaluate((element) => element.textContent ?? '')
  if (!said.includes(named)) throw new Error(`the folder confirm says "${said}", not ${named}`)
  await inspect?.('the folder confirm')
  await shoot('onboarding-folder')
  await pressSelector(page, press, '[data-testid="company-start-create"]')
}

/** Back from the step after the one that made the books: that step shows them made, saying each of `says`, and offers Continue and Start over. */
async function backToMade(page, press, step, says) {
  await pressSelector(page, press, '[data-testid="onboarding-back"]')
  await onboardingAt(page, step)
  const made = await page.waitForSelector('[data-testid="onboarding-made"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`Back to the ${step} step does not show the books made`)
  })
  const said = await made.evaluate((element) => element.textContent ?? '')
  for (const text of says) if (!said.includes(text)) throw new Error(`the ${step} step says "${said}" of the books made, not ${text}`)
  if (!(await page.$('[data-testid="onboarding-start-over"]'))) throw new Error(`the ${step} step of the books made offers no Start over`)
}

/** Start over asks first: its dialog says each of `says`, among them what the books hold now, and Start over drops nothing until it is confirmed. */
async function startOverAsks(page, press, says) {
  await pressSelector(page, press, '[data-testid="onboarding-start-over"]')
  const dialog = await page.waitForSelector('[role="dialog"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Start over did not ask first')
  })
  // The dialog grows in, and its controls reach their size once it has.
  await delay(400)
  const said = await dialog.evaluate((element) => element.textContent ?? '')
  for (const text of says) if (!said.includes(text)) throw new Error(`Start over asks "${said}", without ${text}`)
}

/** Confirms the dialog Start over opened, which drops the books. */
async function confirmStartOver(page, press) {
  await pressSelector(page, press, '[data-testid="onboarding-confirm-start-over"]')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
}

/** The folder step's choice refused since Drive already holds the books: it says so, keeps "trash it in Drive first", and `dropsBrowserBooks` says whether it warns that opening them deletes the books in this browser. */
async function folderRefusedOnDrive(page, press, dropsBrowserBooks, words) {
  await onboardingAt(page, 'folder')
  await pressSelector(page, press, '[data-testid="company-start-create"]')
  const alert = await page.waitForSelector('[data-testid="company-start-on-drive"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the folder step does not say Drive already holds the books')
  })
  const said = await alert.evaluate((element) => element.textContent ?? '')
  const refusal = words.storage.alreadyOnDrive('kuna-company.json')
  if (!said.includes(refusal)) throw new Error(`the folder step says "${said}", not ${refusal}`)
  if (said.includes(words.onboarding.folder.onDriveDrops('').trim()) !== dropsBrowserBooks)
    throw new Error(`the folder step says "${said}", which ${dropsBrowserBooks ? 'does not warn' : 'warns'} that the books in this browser are deleted`)
  if (await page.$('[data-testid="company-start-failure"]')) throw new Error('the folder step shows the refusal as a failure too')
}

/** The lines Overview's Getting set up card shows, by key. */
async function setUpLines(page) {
  await page.waitForSelector('[data-testid="getting-set-up"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Overview shows no Getting set up card')
  })
  return page.$$eval('[data-testid="getting-set-up"] [data-line]', (lines) => lines.map((line) => line.dataset.line))
}

/**
 * New books on the fake Drive: the access step asks for the books file alone, and the folder confirm
 * names the app's subfolder of a new Kuna folder. The file's toast names where it was made. The first
 * statement's IBAN becomes the account main, and Overview's Getting set up card asks for the first
 * rules and a look over the categories, then offers how later statements arrive.
 */
export function onboardingDriveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await inspect?.('the welcome step')
    await shoot('onboarding-welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await shoot('onboarding-home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot, inspect }, words)
    await confirmFolder(page, press, { shoot, inspect }, inKunaFolder(words, 'company'))
    await toast(page, words.writes.firstRun.folder.created('kuna-company.json', inKunaFolder(words, 'company')))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await inspect?.('the company step')
    await shoot('onboarding-company')
    await backToMade(page, press, 'folder', ['company', 'kuna-company.json'])
    await inspect?.('the folder step of the books made')
    await shoot('onboarding-folder-made')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'company')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="sample-camt"]')
    const offer = await page.waitForSelector('[data-testid="dry-run-new-account"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the first statement does not offer its account')
    })
    const isNew = words.imports.statement.isNew(null, null).split('.')[0]
    if (!(await offer.evaluate((element) => element.textContent ?? '')).includes(isNew)) throw new Error(`the new account offer does not say "${isNew}"`)
    const name = await page.$eval('input[data-testid="dry-run-account-name"]', (input) => input.value)
    if (name !== 'main') throw new Error(`the account offered is named "${name}", not main`)
    await inspect?.('the first statement')
    await shoot('onboarding-statement')
    await pressButton(page, press, '[data-testid="onboarding-step"] button', words.onboarding.statement.addAndImport)
    await toastCounted(page, (count) => words.importWrites.imported(['main'], count))
    await onboardingAt(page, 'overview')
    const lines = await setUpLines(page)
    if (JSON.stringify(lines) !== JSON.stringify(['first-rules', 'categories', 'statement-delivery']))
      throw new Error(`Getting set up lists ${lines.join(', ')}, not the first rules, the categories and delivery`)
    await inspect?.('Overview getting set up')
    await shoot('onboarding-overview')
    await dismissToasts(page)
    await booksShowDriveFile(page, true, words)
  }
}

export const onboardingDriveFlow = onboardingDriveFlowIn('en')

/**
 * New books of a Croatian d.o.o. on the fake Drive: the company step answers Yes, the statement is skipped, and Getting set up lists the first statement and the categories.
 */
export function onboardingPackFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot: () => {} }, words)
    await confirmFolder(page, press, { shoot: () => {} }, inKunaFolder(words, 'company'))
    await toastMatching(page, exactly(words.writes.firstRun.folder.created('kuna-company.json', inKunaFolder(words, 'company'))))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await chooseOption(page, press, 'onboarding-pack', words.pack.onboarding.yes)
    await inspect?.('the company step of a Croatian d.o.o.')
    await shoot('onboarding-company-pack')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="onboarding-skip"]')
    await onboardingAt(page, 'overview')
    const lines = await setUpLines(page)
    if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)
    await inspect?.('Getting set up')
    await shoot('onboarding-overview-pack')
  }
}

export const onboardingPackFlow = onboardingPackFlowIn('en')

/**
 * Delivery comes after the first statement: the access step offers no statements choice, and Getting set up offers how later ones arrive.
 * Its dialog names the Erste preset, then another bank typed in, which goes on only once named. Saving takes the
 * line away. A sync then asks Google for Gmail read, as any sync of books with mail settings does. "I import by hand" takes the line away too.
 */
export function onboardingDeliveryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { delivery } = words.onboarding
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'access')
    if (await page.$('[data-testid="onboarding-statements"]')) throw new Error('the access step still asks how statements arrive')
    await allowGoogle(page, press, { shoot: () => {} }, words)
    await confirmFolder(page, press, { shoot: () => {} }, inKunaFolder(words, 'company'))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="sample-camt"]')
    await page.waitForSelector('[data-testid="dry-run-new-account"]', { visible: true, timeout: 10_000 })
    await pressButton(page, press, '[data-testid="onboarding-step"] button', words.onboarding.statement.addAndImport)
    await onboardingAt(page, 'overview')
    await dismissToasts(page)
    if (!(await setUpLines(page)).includes('statement-delivery')) throw new Error('Getting set up does not offer delivery after the first statement')
    await pressSelector(page, press, '[data-testid="set-up-delivery"]')
    const fields = await page.waitForSelector('[data-testid="statement-delivery-mail"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the delivery dialog shows no bank and start day')
    })
    await delay(400)
    if (!(await fields.evaluate((element) => element.textContent ?? '')).includes('netbanking.support@erstebank.hr')) throw new Error('the Erste preset does not name the address it mails from')
    const since = await page.$eval('[data-testid="statement-delivery-since"] input', (input) => input.value)
    if (since !== `${new Date().getFullYear()}-01-01`) throw new Error(`the statements start on ${since}, not the first day of this year`)
    await inspect?.('the delivery dialog with mail from Erste')
    await shoot('onboarding-delivery')
    await choose(page, press, await page.waitForSelector('[data-testid="statement-delivery-bank"]'), delivery.anotherBank)
    if (!(await page.$eval('[data-testid="statement-delivery-save"]', (button) => button.disabled))) throw new Error('the delivery dialog goes on before another bank is named')
    await setField(await page.waitForSelector('input[data-testid="statement-delivery-from"]', { visible: true }), 'statements@bank.example.com')
    await setField(await page.waitForSelector('input[data-testid="statement-delivery-subject"]'), 'Izvadak')
    await delay(200)
    await inspect?.('the delivery dialog with another bank')
    await shoot('onboarding-delivery-other')
    await pressSelector(page, press, '[data-testid="statement-delivery-save"]')
    await page.waitForFunction(() => !document.querySelector('[data-testid="statement-delivery"]'), { timeout: 10_000 })
    await dismissToasts(page)
    const lines = await setUpLines(page)
    if (lines.includes('statement-delivery')) throw new Error('Getting set up still offers delivery once it is set up')
    await inspect?.('Getting set up once delivery is set up')
    await shoot('onboarding-delivered')
  }
}

export const onboardingDeliveryFlow = onboardingDeliveryFlowIn('en')

/**
 * New books in this browser: no Google at all. Back from the company step shows them made on the
 * home step, whose Start over asks first, says they cannot be recovered, and deletes them once
 * confirmed, so they are made again. The company step names the company, the statement
 * step says such books take statements by hand and is skipped, and Getting set up's first line
 * opens Import.
 */
export function onboardingBrowserFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { home, made, setUp } = words.onboarding
  const holdsNone = made.holds(0, 0).slice(0, made.holds(0, 0).indexOf('0') + 1)
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await chooseOption(page, press, 'onboarding-home', home.browser)
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'company')
    await backToMade(page, press, 'home', [made.inBrowser, words.settings.books.newBooks])
    await inspect?.('the home step of the books made in this browser')
    await shoot('onboarding-home-made')
    await startOverAsks(page, press, [made.deleteNote, holdsNone])
    await inspect?.('Start over asking before it deletes the books in this browser')
    await shoot('onboarding-start-over-browser')
    await confirmStartOver(page, press)
    await page.waitForSelector('[data-testid="onboarding-in-browser"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Start over did not bring back the step that makes the books')
    })
    await onboardingAt(page, 'home')
    if (await page.$('[data-testid="onboarding-made"]')) throw new Error('the home step still shows the books made after Start over')
    if (await page.$('[data-testid="onboarding-home"]')) throw new Error('Start over asks where the books live again, after the person said')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'company')
    await setField(await page.waitForSelector('input[data-testid="onboarding-company-name"]'), 'Example Studio')
    await inspect?.('the company step')
    await shoot('onboarding-company-browser')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    if (!(await page.$('[data-testid="onboarding-statements-by-hand"]'))) throw new Error('the statement step does not say books kept in this browser take statements by hand')
    await inspect?.('the statement step of books kept in this browser')
    await shoot('onboarding-statement-browser')
    await pressSelector(page, press, '[data-testid="onboarding-skip"]')
    await onboardingAt(page, 'overview')
    await page.waitForSelector('[data-testid="local-status"]', { timeout: 10_000 }).catch(() => {
      throw new Error('the new books in this browser show no export status')
    })
    const lines = await setUpLines(page)
    if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)
    await inspect?.('new books in this browser')
    await shoot('onboarding-browser')
    await pressSelector(page, press, '[data-testid="set-up-categories-look-right"]')
    await page
      .waitForFunction(() => !document.querySelector('[data-line="categories"]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('These look right did not clear the categories line')
      })
    await pressButton(page, press, '[data-line="first-statement"] a', setUp.importLink)
    await page.waitForSelector('[data-testid="import-file"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Getting set up did not open Import')
    })
    await page.evaluate(() => {
      window.location.hash = '#/company/settings'
    })
    await page
      .waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === 'Example Studio'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('Settings, General does not name the company the company step named')
      })
  }
}

export const onboardingBrowserFlow = onboardingBrowserFlowIn('en')

/**
 * Books brought from an xlsx file to the fake Drive: access first, then the file's summary with its
 * records by tab, then the folder. The toast says how many records moved, the company step confirms
 * what the file says, and Overview draws the moved books.
 */
export function onboardingBringFlowIn(language, path) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await chooseOption(page, press, 'onboarding-path', words.onboarding.welcome.bring)
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot: (name) => shoot(`${name}-bring`), inspect }, words)
    await onboardingAt(page, 'file')
    await page.waitForSelector('[data-testid="download-template"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the file step offers no template download')
    })
    const input = await page.waitForSelector('input[data-testid="onboarding-file"]')
    await input.uploadFile(path)
    await page
      .waitForFunction(
        (source) => new RegExp(source).test(document.querySelector('[data-testid="record-counts"] h3')?.textContent?.trim() ?? ''),
        { timeout: 10_000 },
        anyCount(words.files.summary.records(1000)).source,
      )
      .catch(() => {
        throw new Error('the file step does not count the records by tab')
      })
    await delay(400)
    await inspect?.('the file summary')
    await shoot('onboarding-file')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await confirmFolder(page, press, { shoot: (name) => shoot(`${name}-bring`), inspect }, inKunaFolder(words, 'company'))
    await toastMatching(page, anyCount(words.writes.firstRun.folder.moved(1000)))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    const named = await page.$eval('input[data-testid="onboarding-company-name"]', (input) => input.value)
    if (named === '') throw new Error('the company step does not show the name the file gives')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'overview')
    await page.waitForSelector('.chart-body canvas', { timeout: 10_000 }).catch(() => {
      throw new Error('Overview drew no chart from the moved books')
    })
    await inspect?.('Overview of the moved books')
    await shoot('moved')
    // The file already holds every answer of the company step, so Continue writes nothing and makes no backup.
    await booksShowDriveFile(page, false, words)
    await inspect?.('Settings, Books file of the moved books')
  }
}

export const onboardingBringFlow = (path) => onboardingBringFlowIn('en', path)

/** Open my books on Drive, on a device that keeps the fake Drive's books: Find the file says they are open, and onboarding ends on Overview. */
export function onboardingOpenFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await chooseOption(page, press, 'onboarding-path', words.onboarding.welcome.open)
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot: (name) => shoot(`${name}-open`), inspect }, words)
    await onboardingAt(page, 'find')
    await inspect?.('the find step')
    await shoot('onboarding-find')
    await pressSelector(page, press, '[data-testid="company-start-find"]')
    await toastMatching(page, exactly(words.books.find.alreadyOpen))
    await onboardingAt(page, 'overview')
  }
}

export const onboardingOpenFlow = onboardingOpenFlowIn('en')

/**
 * New books on the fake Drive, then Back from the company step to the folder step, whose Start over
 * asks first, keeps the file on Keep them and trashes it once confirmed. The folder is chosen again
 * without a refusal, since the search leaves trashed files out, and a second file is made in its
 * place. The statement step goes back to the company step. Once a statement is imported, the
 * browser's back button and Back lead to the folder step again, whose Start over counts the
 * transactions imported, and Keep them keeps them.
 */
export function onboardingStartOverFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { made, statement } = words.onboarding
  const created = exactly(words.writes.firstRun.folder.created('kuna-company.json', inKunaFolder(words, 'company')))
  const trash = made.trash('kuna-company.json')
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await onboardingAt(page, 'welcome')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot: () => {} }, words)
    await confirmFolder(page, press, { shoot: () => {} }, 'company')
    await toastMatching(page, created)
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await backToMade(page, press, 'folder', ['company', 'kuna-company.json'])
    await startOverAsks(page, press, [trash, made.trashNote, made.holds(0, 1000).split('1000')[0]])
    await inspect?.('Start over asking before it trashes the books')
    await pressSelector(page, press, '[data-testid="onboarding-keep-books"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    if (!(await page.$('[data-testid="onboarding-made"]'))) throw new Error('Keep them dropped the books')
    await startOverAsks(page, press, [trash])
    await confirmStartOver(page, press)
    await page.waitForSelector('[data-testid="company-start-create"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Start over did not bring back the folder step')
    })
    if (await page.$('[data-testid="onboarding-made"]')) throw new Error('the folder step still shows the books made after Start over')
    await inspect?.('the folder step after Start over')
    await shoot('onboarding-start-over')
    await confirmFolder(page, press, { shoot: () => {} }, 'company')
    await toastMatching(page, exactly(words.writes.firstRun.folder.created('kuna-company.json', 'Kuna › company')))
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="onboarding-back"]')
    await onboardingAt(page, 'company')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="sample-camt"]')
    await pressButton(page, press, '[data-testid="onboarding-step"] button', statement.addAndImport)
    await toastCounted(page, (rows) => words.importWrites.imported(['main'], rows))
    await onboardingAt(page, 'overview')
    await dismissToasts(page)
    // The browser's back button leads back into onboarding after the books hold work, so Start over has to say so.
    await page.goBack()
    await onboardingAt(page, 'statement')
    await pressSelector(page, press, '[data-testid="onboarding-back"]')
    await onboardingAt(page, 'company')
    await backToMade(page, press, 'folder', ['kuna-company.json'])
    await startOverAsks(page, press, [trash])
    const holds = await page.$eval('[data-testid="onboarding-start-over-holds"]', (element) => element.textContent?.trim() ?? '')
    const transactions = Number(/\d+/.exec(holds)?.[0] ?? 0)
    if (transactions === 0) throw new Error(`Start over on books with an imported statement says "${holds}"`)
    await inspect?.('Start over asking before it trashes books with work in them')
    await shoot('onboarding-start-over-holds')
    await pressSelector(page, press, '[data-testid="onboarding-keep-books"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    if (!(await page.$('[data-testid="onboarding-made"]'))) throw new Error('Keep them dropped the books with work in them')
  }
}

export const onboardingStartOverFlow = onboardingStartOverFlowIn('en')

/**
 * New books on Drive on a device whose books the fake Drive already holds: the folder step refuses a
 * second file, and opening the books on Drive takes the find step, which finds them open already.
 */
export function onboardingOnDriveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await folderRefusedOnDrive(page, press, false, words)
    await inspect?.('the folder step when Drive holds the books')
    await shoot('onboarding-folder-on-drive')
    await pressSelector(page, press, '[data-testid="company-start-open-on-drive"]')
    await onboardingAt(page, 'find')
    await pressSelector(page, press, '[data-testid="company-start-find"]')
    await toastMatching(page, exactly(words.books.find.alreadyOpen))
    await onboardingAt(page, 'overview')
  }
}

export const onboardingOnDriveFlow = onboardingOnDriveFlowIn('en')

/**
 * Settings, Books file: books kept in this browser move to Drive, which already holds a file another
 * device made. The folder step refuses a second file, warns that opening those deletes the books in
 * this browser, and the find step opens them.
 */
export function moveOntoDriveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pageSays(page, words.writes.localFile.kept, true)
    await pressSelector(page, press, '[data-testid="keep-on-drive"]')
    await allowGoogle(page, press, { shoot: () => {} }, words)
    await folderRefusedOnDrive(page, press, true, words)
    await inspect?.('the move when Drive holds the books')
    await shoot('onboarding-move-on-drive')
    await pressSelector(page, press, '[data-testid="company-start-open-on-drive"]')
    await onboardingAt(page, 'find')
    await pressSelector(page, press, '[data-testid="company-start-find"]')
    await toastMatching(page, exactly(words.books.find.opened('kuna-company.json')))
    await onboardingAt(page, 'overview')
    await dismissToasts(page)
    await booksShowDriveFile(page, false, words, false)
    await inspect?.('Settings, Books file once the books on Drive are open')
  }
}

export const moveOntoDriveFlow = moveOntoDriveFlowIn('en')

/**
 * Settings, Books file: the books kept in this browser move to a new file on the fake Drive through
 * onboarding's access and folder steps. The access step asks for the books file alone, since the books
 * name no bank's mail, the folder confirm names the app's subfolder of the Kuna folder, and the sync control
 * shows no Allow access once they are there.
 */
export function moveFromBrowserFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pageSays(page, words.writes.localFile.kept, true)
    await pressSelector(page, press, '[data-testid="keep-on-drive"]')
    await onboardingAt(page, 'access')
    await allowGoogle(page, press, { shoot: (name) => shoot(`${name}-move`), inspect }, words)
    const asked = await page.evaluate(() => JSON.parse(window.localStorage.getItem('kuna.google-needed') ?? '[]'))
    if (JSON.stringify(asked) !== JSON.stringify(['drive.file'])) throw new Error(`the move asked Google for ${asked.join(', ')}, not the books file alone`)
    await confirmFolder(page, press, { shoot: (name) => shoot(`${name}-move`), inspect }, inKunaFolder(words, 'company'))
    await toastMatching(page, anyCount(words.writes.firstRun.folder.moved(1000)))
    await onboardingAt(page, 'overview')
    await dismissToasts(page)
    await controlShows(page, 'ready')
    await booksShowDriveFile(page, false, words)
    await inspect?.('this device once moved')
    await shoot('moved-from-browser')
  }
}

export const moveFromBrowserFlow = moveFromBrowserFlowIn('en')

/**
 * Settings, Books file on the fake Drive: the file sits outside the Kuna folder and stays there until the person presses. The dialog names what
 * goes, the file and its backups, and nothing stays, since the books keep no folder of their own beside the file. Moving keeps the file open and working, the
 * Settings then names its new folder and stops offering the move, and a sync afterwards still reads it.
 */
export function moveIntoKunaFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const text = words.writes.moveIntoKuna
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="drive-file-place"] a')?.textContent?.trim() === 'Books', { timeout: 10_000 })
      .catch(() => {
        throw new Error('the seeded file does not start in its own folder')
      })
    await inspect?.('Settings, Books file offering the move')
    await shoot('move-into-kuna-offer')
    await pressSelector(page, press, '[data-testid="move-into-kuna-open"]')
    const goes = await page.waitForSelector('[data-testid="move-into-kuna-goes"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the move does not list what goes')
    })
    await delay(400)
    if (!(await goes.evaluate((element) => element.textContent ?? '')).includes('kuna-company.json')) throw new Error('the move does not name the file')
    if (await page.$('[data-testid="move-into-kuna-stays"]')) throw new Error('the move says something stays, though the books keep nothing beside the file but backups')
    await inspect?.('the move dialog')
    await shoot('move-into-kuna')
    await pressSelector(page, press, '[data-testid="move-into-kuna-confirm"]')
    await toastMatching(page, exactly(text.moved('kuna-company.json', inKunaFolder(words, 'company'))))
    await page
      .waitForFunction(() => document.querySelector('[data-testid="drive-file-place"] a')?.textContent?.trim() === 'company', { timeout: 10_000 })
      .catch(() => {
        throw new Error('Settings does not name the new folder')
      })
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="move-into-kuna-open"]'), { timeout: 5_000 })
      .catch(() => {
        throw new Error('Settings still offers the move')
      })
    await dismissToasts(page)
    await inspect?.('Settings, Books file after the move')
    await shoot('move-into-kuna-done')
    await syncAndSettle(page, press)
    await pageSays(page, 'kuna-company.json', true)
  }
}

export const moveIntoKunaFlow = moveIntoKunaFlowIn('en')

function queueLength(page) {
  return page.evaluate(() => document.querySelectorAll('[data-testid="review-row"]').length)
}

async function queueHolds(page, count, failure) {
  await page
    .waitForFunction((wanted) => document.querySelectorAll('[data-testid="review-row"]').length === wanted, { timeout: 10_000 }, count)
    .catch(async () => {
      throw new Error(`${failure} (the queue holds ${await queueLength(page)})`)
    })
}

/**
 * Transactions, To review: a row confirmed while a phone files the other waiting row on the fake Drive at the same
 * moment. Both saves stand, so the queue empties, and Undo takes back only this device's.
 */
export function raceFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await queueHolds(page, 2, 'the queue does not hold the two fake rows')
    const summary = await page
      .waitForFunction(() => [...document.querySelectorAll('[data-testid="review-row"] > button')].find((button) => button.textContent?.includes('GADGET CORNER')) ?? null, { timeout: 10_000 })
      .then((handle) => handle.asElement())
    await summary.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(summary)
    await page.waitForSelector('[data-testid="review-details"]')
    await pressButton(page, press, '[data-testid="review-details"] button', words.transactions.review.item.confirm('').trim())
    await toastMatching(
      page,
      new RegExp(
        `^${words.transactions.review
          .confirmed('')
          .trim()
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      ),
    )
    await queueHolds(page, 0, "the phone's save or this one is missing after the race")
    await inspect?.('both saves of the race')
    await shoot('race')
    await undoIn(page, press, words)
    await queueHolds(page, 1, "Undo did not bring back this device's row alone")
    await pageSays(page, 'GADGET CORNER', true)
    await inspect?.('the race undone')
    await shoot('race-undone')
  }
}

export const raceFlow = raceFlowIn('en')

/**
 * Settings, Books file of a workbook kept in this browser, in a language: the switch of data source
 * with its warning and its three choices, and a file opened there with its summary, each closed again.
 */
export function dataSourceDialogsFlowIn(language, importFile) {
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="switch-source"]')
    await page.waitForSelector('[role="dialog"] [data-testid="data-source-choices"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Switch data source opened no choices')
    })
    if ((await page.$('[role="dialog"] [data-testid="data-source-choices"] [data-testid="download-template"]')) === null) throw new Error('Open a file offers no template download')
    await delay(400)
    await shoot('dialog-switch-source')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="data-source-choices"]')
    const input = await page.waitForSelector('[data-testid="data-source-card"] input[type="file"]', { timeout: 10_000 })
    await input.uploadFile(importFile)
    await page.waitForSelector('[role="dialog"] [data-testid="import-summary"] dl', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the file opened on Books file shows no summary')
    })
    await delay(400)
    await shoot('dialog-import-file')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="import-summary"]')
  }
}
