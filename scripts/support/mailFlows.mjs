/**
 * The flows of every app's mail: Kuna settings' Mail card, which lists each app's mail source and stops them all with each app's
 * own Undo, and a statement the sync holds, which Pass over on Import leaves out with Undo.
 */

import { en as kunaSettingsEnglish, hr as kunaSettingsCroatian } from '../../src/shell/settings/words.ts'
import { en as companyMailEnglish, hr as companyMailCroatian } from '../../src/apps/company/mail/presentation/words.ts'
import { en as importEnglish, hr as importCroatian } from '../../src/apps/company/imports/presentation/words.ts'
import { en as writesEnglish, hr as writesCroatian } from '../../src/shared/storage/presentation/words.ts'
import { delay, pressSelector } from './pressing.mjs'

const TOAST = 'li[data-slot="base"]'
const SYNC_BUTTON = '[data-testid="sync-button"]'
const MAIL_CARD = '[data-testid="mail-card"]'
const COMPANY_MAIL_ROW = `${MAIL_CARD} [data-group="company"] [data-step="mail"]`

/** Presses the sync control on screen and waits until the sync is done. */
async function syncAndSettle(page, press) {
  const button = await page.waitForFunction((selector) => [...document.querySelectorAll(selector)].find((element) => element.offsetParent !== null) ?? null, { timeout: 10_000 }, SYNC_BUTTON)
  await press(button.asElement())
  await page
    .waitForFunction((selector) => [...document.querySelectorAll(selector)].some((element) => element.offsetParent !== null && !element.disabled), { timeout: 12_000, polling: 100 }, SYNC_BUTTON)
    .catch(() => {
      throw new Error('the sync did not finish within 12 s')
    })
}

/** Waits for a toast whose title starts with `title`. */
async function toastTitled(page, title) {
  await page
    .waitForFunction(
      (selector, wanted) => [...document.querySelectorAll(selector)].some((element) => (element.querySelector('[data-slot="title"]')?.textContent?.trim() ?? '').startsWith(wanted)),
      { timeout: 10_000 },
      TOAST,
      title,
    )
    .catch(async () => {
      const said = await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((element) => element.textContent?.trim()).join(' | '), TOAST)
      throw new Error(`no toast "${title}" within 10 s, the toasts say: ${said || 'nothing'}`)
    })
}

/** Presses Undo on the toast whose title starts with `title`. */
async function undoToast(page, press, title, undo) {
  const button = await page.waitForFunction(
    (selector, wanted, label) =>
      Array.from(
        [...document.querySelectorAll(selector)].find((element) => (element.querySelector('[data-slot="title"]')?.textContent?.trim() ?? '').startsWith(wanted))?.querySelectorAll('button') ?? [],
      ).find((candidate) => candidate.textContent?.trim() === label) ?? null,
    { timeout: 5_000 },
    TOAST,
    title,
    undo,
  )
  await press(button.asElement())
}

/** What a row of the Mail card says. */
function rowText(page, selector) {
  return page.$eval(selector, (element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? '')
}

/**
 * Kuna settings lists Company's statement mail with its line from the sync, Stop reading mail asks first and names each source with
 * a link to its app, Confirm turns it off with Company's own toast, the row reads Off and the button is gone, and Undo turns it on again.
 */
export function kunaMailFlowIn(language) {
  const mail = (language === 'hr' ? kunaSettingsCroatian : kunaSettingsEnglish).mail
  const company = (language === 'hr' ? companyMailCroatian : companyMailEnglish).step
  const undo = (language === 'hr' ? writesCroatian : writesEnglish).undo
  return async (page, { press, shoot, inspect }) => {
    await syncAndSettle(page, press)
    await page.waitForSelector(COMPANY_MAIL_ROW, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error("Kuna settings' Mail card does not list Company's statement mail")
    })
    const ran = await rowText(page, COMPANY_MAIL_ROW)
    if (ran.includes(mail.off) || ran.includes(mail.notRun)) throw new Error(`the statement mail row does not show the sync's line, it says: ${ran}`)
    if (await page.$(`${MAIL_CARD} [data-testid="sync-step-undo"]`)) throw new Error('the Mail card offers Undo, which the Sync card above it already offers')
    await delay(300)
    await inspect?.("Kuna settings' Mail card")
    await shoot(`kuna-mail-card${language === 'hr' ? '-croatian' : ''}`)

    await pressSelector(page, press, '[data-testid="mail-stop"]')
    await page.waitForSelector('[data-testid="mail-stop-dialog"]', { visible: true, timeout: 5_000 })
    const listed = await page.$eval('[data-testid="mail-stop-dialog"]', (element) => element.textContent ?? '')
    if (!listed.includes(company.label)) throw new Error(`the stop dialog does not name Company's statement mail, it says: ${listed}`)
    await delay(300)
    await inspect?.('the dialog that stops every app reading mail')
    await shoot(`kuna-mail-stop-dialog${language === 'hr' ? '-croatian' : ''}`)

    await pressSelector(page, press, '[data-testid="mail-stop-confirm"]')
    await toastTitled(page, company.stoppedTitle)
    await page.waitForSelector('[data-testid="mail-all-off"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the Mail card does not say no app reads mail once every source is off')
    })
    const off = await rowText(page, COMPANY_MAIL_ROW)
    if (!off.includes(mail.off)) throw new Error(`the statement mail row does not read Off, it says: ${off}`)
    const offLink = await page.$eval(`${COMPANY_MAIL_ROW} a`, (element) => element.textContent?.trim() ?? '').catch(() => null)
    const appName = await page.$eval(`${MAIL_CARD} [data-group="company"] h3`, (element) => element.textContent?.trim() ?? '')
    if (offLink !== mail.settingsOf(appName)) throw new Error(`the statement mail row that is off does not link to Company's settings, it links to: ${offLink ?? 'nothing'}`)
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="mail-stop-dialog"]'), { timeout: 5_000 })
      .catch(() => {
        throw new Error('the stop dialog is still on screen after the confirm')
      })
    await inspect?.('every source off')
    await shoot(`kuna-mail-all-off${language === 'hr' ? '-croatian' : ''}`)

    await undoToast(page, press, company.stoppedTitle, undo)
    await page.waitForSelector('[data-testid="mail-stop"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Undo did not turn the statement mail on again')
    })
  }
}

/** A statement the sync held waits on Import with Pass over, which leaves it out with a toast, and Undo brings it back. */
export function heldPassOverFlowIn(language) {
  const mailed = (language === 'hr' ? importCroatian : importEnglish).mailed
  const undo = (language === 'hr' ? writesCroatian : writesEnglish).undo
  return async (page, { press, shoot, inspect }) => {
    await syncAndSettle(page, press)
    await page.evaluate(() => {
      window.location.hash = '#/company/transactions?tab=import'
    })
    const pass = await page.waitForSelector('[data-testid="mailed-statements"] [data-testid="mailed-statement-pass-over"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the held statement on Import offers no Pass over')
    })
    const summary = await page.$eval('[data-testid="mailed-statements-summary"]', (element) => element.textContent ?? '')
    if (!/passed over|preskoči/.test(summary)) throw new Error(`the held card does not say a held statement stays until it is filed or passed over: ${summary}`)
    await delay(300)
    await inspect?.('the held statement with Pass over')
    await shoot(`held-pass-over${language === 'hr' ? '-croatian' : ''}`)

    const label = await pass.evaluate((element) => element.getAttribute('aria-label') ?? '')
    await press(pass)
    const title = mailed.passedOver(label.replace(mailed.passOverNamed(''), ''))
    await toastTitled(page, title)
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="mailed-statement-pass-over"]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('the statement passed over still shows on Import')
      })
    await inspect?.('the statement passed over')
    await shoot(`held-passed-over${language === 'hr' ? '-croatian' : ''}`)

    await undoToast(page, press, title, undo)
    await page.waitForSelector('[data-testid="mailed-statement-pass-over"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Undo did not bring the statement passed over back')
    })
  }
}
