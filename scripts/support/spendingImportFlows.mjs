/**
 * Spending's flows for what comes in from outside, shared by the visual and the touch check: statement imports, receipts,
 * bank sync and the To review tab. `press` clicks or taps an element handle, and `shoot` takes a screenshot under a name.
 * A failure throws with what was missing.
 */

import { writeJpegWithPlace } from './importSampleFiles.mjs'
import { linkedAccountEnding } from '../../src/apps/spending/bankSync/domain/bankAccountSetup.ts'
import { UNKNOWN_IBAN } from '../../src/shared/bank-sync/infrastructure/fake/fakeBankSync.ts'
import { delay, pressSelector } from './pressing.mjs'
import {
  SCREEN_WORDS,
  SPENDING_ENTRY_DIALOG,
  SYNC_CARD,
  TOAST,
  USE_FILE_ROW,
  choose,
  chooseBySearch,
  chooseStartingWith,
  controlShows,
  countOf,
  countedIn,
  dialogGone,
  dismissToasts,
  elementSays,
  fill,
  openKunaSettings,
  pickLabel,
  pickRowNamed,
  pickedCountIs,
  pressButton,
  setField,
  shootAt,
  stepSays,
  toast,
  undoIn,
  waitForTextIn,
} from './flowHelpers.mjs'
import {
  SPENDING_PAYEE,
  SPENDING_RECEIPT_FORM,
  SPENDING_ROW,
  centreOn,
  dropSpendingFile,
  openReceiptDialog,
  openSpendingRow,
  reviewRowOf,
  rowLabels,
  rowLinesAre,
  spendingRowShown,
  uploadReceiptPhoto,
} from './spendingFlows.mjs'

/**
 * With the bank sync set up, a row the bank synced onto Revolut EUR opens with its amount, day and way its money went locked,
 * saying why, and a new entry lists only the accounts kept by hand, so Cash and none of the accounts the bank fills.
 */
export function spendingBankRowFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'CORNER MARKET', -1230)
    const locked = await page.$$eval('[data-testid="spending-entry-amount"], [data-testid="spending-entry-date"]', (fields) =>
      fields.map((field) => (field.matches('input') ? field : field.querySelector('input'))?.disabled ?? false),
    )
    if (locked.length !== 2 || locked.some((disabled) => !disabled)) throw new Error(`the bank's row leaves its amount or day open: ${locked.join(', ')}`)
    await waitForTextIn(page, '[data-testid="spending-entry-source-note"]', dialog.bookedByBank)
    const kinds = await page.$$eval('[data-testid="spending-entry-kind"] button', (buttons) => buttons.map((button) => button.textContent?.trim() ?? ''))
    if (kinds.includes(dialog.kinds.in)) throw new Error(`the bank's money out offers to become money in: ${kinds.join(', ')}`)
    await inspect?.("the bank's row in the entry dialog")
    await shoot('spending-entry-bank-row')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await pressSelector(page, press, '[data-testid="spending-add-entry"]')
    await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 10_000 })
    await delay(300)
    await pressSelector(page, press, '[data-testid="spending-entry-account"]')
    const listed = await page
      .waitForFunction(
        () => {
          const options = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent?.trim() ?? '')
          return options.length > 0 ? options : null
        },
        { timeout: 5_000 },
      )
      .then((handle) => handle.jsonValue())
    if (listed.some((option) => option.startsWith('OTP current') || option.startsWith('Revolut'))) throw new Error(`a new entry lists accounts the bank fills: ${listed.join(', ')}`)
    await waitForTextIn(page, SPENDING_ENTRY_DIALOG, dialog.bankAccountsHidden)
    await delay(300)
    await inspect?.('the accounts a new entry lists')
    await shoot('spending-entry-accounts')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[role="listbox"]') === null, { timeout: 5_000 })
    await delay(300)
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

const SPENDING_DRY_RUN_SUMMARY = '[data-testid="spending-dry-run-summary"]'

async function spendingDryRunSays(page, text) {
  await page
    .waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, SPENDING_DRY_RUN_SUMMARY, text)
    .catch(async () => {
      const said = await page.evaluate((selector) => document.querySelector(selector)?.textContent?.trim(), SPENDING_DRY_RUN_SUMMARY)
      throw new Error(`the dry run does not say "${text}", it says: ${said ?? 'nothing'}`)
    })
}

/**
 * On Spending's Import with the copied set: the sample Revolut export's Unknown shop looks like the row the AI copied a day before,
 * so the dry run asks about it above its rows, naming that copied row, and leaves it out until answered. Use the file's row makes
 * it take the copied row's place, which Import writes with the new rows and one Undo takes back.
 */
export function spendingImportLookAlikeFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const panel = words.spendingStatements.import
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.revolut)
    await spendingDryRunSays(page, panel.summary(9, 1, 1))
    await elementSays(page, '[data-testid="question"]', ['UNKNOWN SHOP ZAGREB'], 'the question does not name the copied row the file row looks like')
    if (await page.$('[data-testid="spending-dry-run"] [data-testid="show-all"]')) await pressSelector(page, press, '[data-testid="spending-dry-run"] [data-testid="show-all"]')
    await elementSays(page, '[data-testid="spending-dry-run-outcome"]', [panel.outcome.lookAlike], 'the look-alike does not say it waits for an answer')
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-import-lookalike')
    await pressSelector(page, press, `[data-testid="question-choice"] ${USE_FILE_ROW}`)
    await elementSays(page, '[data-testid="spending-dry-run-outcome"]', [panel.outcome.replaced], "the file's row does not say it takes the copied row's place")
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-import-lookalike-replaced')
    await pressSelector(page, press, '[data-testid="spending-import-confirm"]')
    await toast(page, panel.imported)
    await spendingDryRunSays(page, panel.summary(0, 12, 0))
    await undoIn(page, press, words)
    await elementSays(page, '[data-testid="spending-dry-run-outcome"]', [panel.outcome.replaced], 'Undo did not bring the replacement back to the dry run')
    await dismissToasts(page)
  }
}

/**
 * On Spending's Import with the synced set: the export's Corner market looks like the row the bank sync brought a day later,
 * so the dry run asks about it above its rows, naming that synced row. Use the file's row makes it take the synced row's place.
 * Nothing is imported.
 */
export function spendingImportSyncedLookAlikeFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const panel = words.spendingStatements.import
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.revolut)
    await elementSays(page, '[data-testid="question"]', ['CORNER MARKET D.O.O.'], 'the question does not name the synced row the file row looks like')
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-import-synced-lookalike')
    await pressSelector(page, press, `[data-testid="question-choice"] ${USE_FILE_ROW}`)
    await elementSays(page, '[data-testid="spending-dry-run-outcome"]', [panel.outcome.replacedSynced], "the file's row does not say it takes the synced row's place")
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-import-synced-lookalike-replaced')
  }
}

/**
 * On Spending's Import with the statements set: the sample Revolut export read as a dry run of 10 new rows, its payment the bank
 * has not booked yet among them, 1 already in and 1 paired with a typed row, its cash withdrawal going to Cash, with nothing written. Imported, nothing is new, and one Undo
 * brings the dry run back.
 */
export function spendingImportFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const panel = words.spendingStatements.import
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const before = panel.summary(10, 1, 1)
    await dropSpendingFile(page, paths.revolut)
    await spendingDryRunSays(page, before)
    await centreOn(page, '[data-testid="spending-dry-run-outcome"]', aroundAmount(words.spendingStatements.review.cash.toCash('\u0000', 'Cash')))
    await delay(300)
    await inspect?.('the Revolut dry run')
    await shoot('spending-import-revolut')
    await pressSelector(page, press, '[data-testid="spending-import-confirm"]')
    await toast(page, panel.imported)
    await spendingDryRunSays(page, panel.summary(0, 12, 0))
    await page.waitForSelector('[data-testid="spending-import-nothing"]', { visible: true, timeout: 10_000 })
    await undoIn(page, press, words)
    await spendingDryRunSays(page, before)
    await dismissToasts(page)
  }
}

/**
 * On Spending's Import with the statements set and the sample Loans file: the sample loan export's one row pays the home loan's
 * latest instalment, so the dry run names that instalment under the row with its interest and principal, as Entries shows a split
 * link. Imported, it is in, and one Undo brings the dry run back.
 */
export function spendingImportInstalmentFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const panel = words.spendingStatements.import
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const before = panel.summary(1, 0, 0)
    await dropSpendingFile(page, paths.loan)
    await spendingDryRunSays(page, before)
    await elementSays(page, '[data-testid="spending-dry-run-link"]', ['Home loan'], 'the dry run does not name the instalment the row pays')
    await countOf(page, '[data-testid="spending-dry-run"] [data-testid="spending-row-line"]', 2, "the dry run does not show the instalment's interest and principal")
    await elementSays(page, '[data-testid="spending-dry-run-outcome"]', [panel.outcome.linked], 'the dry run files the linked row whole under its interest category')
    await inspect?.('the dry run of a row that pays an instalment')
    await shootAt(page, shoot, '[data-testid="spending-dry-run"]', 'spending-import-instalment', { block: 'start' })
    await pressSelector(page, press, '[data-testid="spending-import-confirm"]')
    await toast(page, panel.imported)
    await spendingDryRunSays(page, panel.summary(0, 1, 0))
    await undoIn(page, press, words)
    await spendingDryRunSays(page, before)
    await dismissToasts(page)
  }
}

async function receiptPlaceSays(page, text) {
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="spending-receipt-place"]')?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, text)
    .catch(() => {
      throw new Error(`the receipt's payments do not say "${text}"`)
    })
}

async function pickReceiptCategory(page, press, words, name) {
  await choose(page, press, await page.$('[data-testid="spending-receipt-category"]'), words.spendingStarter[name])
}

async function saveReceipt(page, press, words) {
  await pressSelector(page, press, '[data-testid="spending-receipt-save"]')
  await toast(page, words.spendingReceipts.saved)
  await dialogGone(page, SPENDING_RECEIPT_FORM)
}

/** A file with no open euro account offers no receipt, since a fiscal total is in euros. */
export async function spendingReceiptNoEuroFlow(page, { inspect }) {
  await page.waitForSelector('[data-testid="spending-add-entry"]', { visible: true, timeout: 10_000 })
  if ((await page.$('[data-testid="spending-add-receipt"]')) !== null) throw new Error('Add a receipt shows with no open euro account')
  await inspect?.('Entries with no euro account')
}

/** Waits until the row of this payee and amount on Entries shows the receipt mark in its camera's box, or until it no longer does. */
async function rowMarksReceipt(page, title, cents, held) {
  await page
    .waitForFunction(
      (selector, wanted, amount, expected) =>
        [...document.querySelectorAll(selector)].some(
          (row) => row.dataset.amount === String(amount) && row.textContent?.includes(wanted) && (row.querySelector('[data-testid="spending-row-receipt-held"]') !== null) === expected,
        ),
      { timeout: 10_000 },
      SPENDING_ROW,
      title,
      cents,
      held,
    )
    .catch(() => {
      throw new Error(held ? `the "${title}" row of ${cents} cents shows no receipt mark` : `the "${title}" row of ${cents} cents still shows a receipt mark`)
    })
}

/**
 * On the receipts set's Entries: the two buttons, then a photo whose QR code matches the card payment, which is offered ready and
 * splits under one category with the keep-photo switch on. The row shows its line and files out of To review, its dialog holds
 * the amount and removes the receipt, and one Undo takes it all back.
 */
export function spendingReceiptFlowIn(language, photos) {
  const words = SCREEN_WORDS[language]
  const receipt = words.spendingReceipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openReceiptDialog(page, press)
    await page.waitForSelector('[data-testid="spending-receipt-take"]', { visible: true, timeout: 10_000 })
    await delay(300)
    const capture = await page.$eval('[data-testid="spending-receipt-camera"] input[type="file"]', (input) => input.getAttribute('capture'))
    if (capture !== 'environment') throw new Error(`Take a photo opens the camera "${capture}", not the rear one`)
    await inspect?.('the receipt dialog before a photo')
    await shoot('spending-receipt-take')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="spending-receipt-take"]')

    await uploadReceiptPhoto(page, press, photos.oneMatch)
    await waitForTextIn(page, '[data-testid="spending-receipt-qr"]', receipt.qrSays(''))
    await page.waitForSelector('[data-testid="spending-receipt-place"][data-match="ready"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the receipt is not offered its one payment ready')
    })
    await pickReceiptCategory(page, press, words, 'Furniture and household goods')
    await pressSelector(page, press, '[data-testid="spending-receipt-keep"]')
    await delay(300)
    await inspect?.('the receipt matched to its payment')
    await shoot('spending-receipt-matched')
    await saveReceipt(page, press, words)
    await rowMarksReceipt(page, 'Corner market', -2349, true)
    await inspect?.('the split row on Entries')
    await dismissToasts(page)

    await uploadReceiptPhoto(page, press, photos.oneMatch)
    await page.waitForSelector('[data-testid="spending-receipt-held"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the same fiscal receipt again does not say it is already saved')
    })
    await delay(300)
    await inspect?.('a fiscal receipt already saved')
    await shoot('spending-receipt-held')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_RECEIPT_FORM)

    await openSpendingRow(page, press, 'Corner market', -2349)
    await page.waitForSelector('[data-testid="spending-entry-lines"]', { visible: true, timeout: 10_000 })
    if (!(await page.$eval('[data-testid="spending-entry-amount"] input, input[data-testid="spending-entry-amount"]', (input) => input.disabled))) throw new Error('a split row lets its amount change')
    await inspect?.('a split row in the entry dialog')
    await pressSelector(page, press, '[data-testid="spending-entry-remove-receipt"]')
    await toast(page, receipt.removed)
    await rowMarksReceipt(page, 'Corner market', -2349, false)
    await undoIn(page, press, words)
    await rowMarksReceipt(page, 'Corner market', -2349, true)
    await dismissToasts(page)
  }
}

/**
 * On the receipts set's Entries: a photo two payments could match asks for a pick and refuses to save without one, a total near
 * a payment takes a Difference line and one Undo takes it back, a total nothing matches makes a new entry on the account picked, and a
 * photo with no code asks for its date and total.
 */
export function spendingReceiptPickFlowIn(language, photos) {
  const words = SCREEN_WORDS[language]
  const receipt = words.spendingReceipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await uploadReceiptPhoto(page, press, photos.twoMatches)
    await receiptPlaceSays(page, receipt.pick)
    await pressSelector(page, press, '[data-testid="spending-receipt-save"]')
    await page.waitForSelector('[data-testid="spending-receipt-place-error"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('a receipt two payments could match')
    await shoot('spending-receipt-pick')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_RECEIPT_FORM)

    await uploadReceiptPhoto(page, press, photos.near)
    await receiptPlaceSays(page, receipt.pick)
    await pressButton(page, press, '[data-testid="spending-receipt-place"] label', 'Harbour bistro')
    await delay(300)
    await inspect?.('a receipt near a payment')
    await saveReceipt(page, press, words)
    await rowLinesAre(page, 'Harbour bistro', -3300, 2)
    await undoIn(page, press, words)
    await rowLinesAre(page, 'Harbour bistro', -3300, 0)
    await dismissToasts(page)

    await uploadReceiptPhoto(page, press, photos.noMatch)
    await page.waitForSelector('[data-testid="spending-receipt-no-match"]', { visible: true, timeout: 10_000 })
    await pickReceiptCategory(page, press, words, 'Groceries')
    await fill(page, 'spending-receipt-merchant', SPENDING_PAYEE)
    await chooseStartingWith(page, press, '[data-testid="spending-receipt-account"]', 'Cash')
    await delay(300)
    await inspect?.('a receipt nothing matches')
    await shoot('spending-receipt-no-match')
    await pressSelector(page, press, '[data-testid="spending-receipt-keep"]')
    const saveButton = await page.$('[data-testid="spending-receipt-save"]')
    await page.evaluate((button) => {
      button.click()
      button.click()
    }, saveButton)
    await toast(page, receipt.saved)
    await dialogGone(page, SPENDING_RECEIPT_FORM)
    const made = await page.$$eval(SPENDING_ROW, (rows, payee) => rows.filter((row) => row.textContent?.includes(payee)).length, SPENDING_PAYEE)
    if (made !== 1) throw new Error(`two taps on Save made ${made} rows`)
    await rowMarksReceipt(page, SPENDING_PAYEE, -1700, true)
    await undoIn(page, press, words)
    await spendingRowShown(page, SPENDING_PAYEE, -1700, false)
    await dismissToasts(page)

    await uploadReceiptPhoto(page, press, photos.noCode, 'no-code')
    await page.waitForSelector('[data-testid="spending-receipt-total"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('a receipt photo with no QR code')
    await shoot('spending-receipt-no-code')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_RECEIPT_FORM)
  }
}

/**
 * The receipts set with the bank sync set up, so its accounts take their rows from the bank: a receipt nothing matches on OTP
 * makes no entry and waits on To review, beside the set's own waiting receipts, until removed with an Undo. The kiosk receipt
 * two payments may be asks which, and goes on the one picked.
 */
export function spendingReceiptWaitsFlowIn(language, photos) {
  const words = SCREEN_WORDS[language]
  const receipt = words.spendingReceipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await uploadReceiptPhoto(page, press, photos.noMatch)
    await waitForTextIn(page, '[data-testid="spending-receipt-no-match"]', receipt.noMatchWaits)
    await pickReceiptCategory(page, press, words, 'Groceries')
    await fill(page, 'spending-receipt-merchant', SPENDING_PAYEE)
    await chooseStartingWith(page, press, '[data-testid="spending-receipt-account"]', 'OTP')
    await waitForTextIn(page, '[data-testid="spending-receipt-waits"]', receipt.accountWaits)
    await delay(300)
    await inspect?.('a receipt on an account the bank fills')
    await shoot('spending-receipt-waits')
    await saveReceipt(page, press, words)
    await spendingRowShown(page, SPENDING_PAYEE, -1700, false)
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions?tab=review'
    })
    await page
      .waitForFunction(() => document.querySelectorAll('[data-testid="spending-review-receipt"]').length === 2, { timeout: 10_000 })
      .catch(() => {
        throw new Error('To review does not list both waiting receipts')
      })
    await waitForTextIn(page, '[data-testid="spending-review-receipts"]', SPENDING_PAYEE)
    await delay(300)
    await inspect?.('To review with receipts waiting for the bank')
    await shoot('spending-review-receipts')
    const removing = await page.$$('[data-testid="spending-review-receipt-remove"]')
    await press(removing.at(-1))
    await toast(page, receipt.waiting.removed)
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="spending-review-receipt"]').length === 1, { timeout: 10_000 })
    await undoIn(page, press, words)
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="spending-review-receipt"]').length === 2, { timeout: 10_000 })
    await dismissToasts(page)
    await waitForTextIn(page, '[data-testid="spending-review-receipt-place"]', receipt.waiting.pick)
    const [payment] = await page.$$('[data-testid="spending-review-receipt-place"] [data-testid="question-choice"] button')
    await payment.evaluate((button) => button.scrollIntoView({ block: 'center' }))
    await press(payment)
    await toast(page, receipt.waiting.placed)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="spending-review-receipt-place"]') === null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the kiosk receipt still asks which payment it is')
      })
    await page
      .waitForFunction(() => document.activeElement?.closest('[data-testid="spending-review-receipts"]') != null, { timeout: 5_000 })
      .catch(() => {
        throw new Error('focus dropped to the page once the last question was answered and the card moved')
      })
    await delay(300)
    await inspect?.('To review once the kiosk receipt is on its payment')
    await shoot('spending-review-receipt-placed')
  }
}

/**
 * A made-up JPEG with GPS in its Exif: the dialog shows the place before Save, and the entry shows the coordinates with a link
 * that leaves only on a tap. The set's own split row shows its place too.
 */
export function spendingReceiptPlaceFlowIn(language, photos) {
  const words = SCREEN_WORDS[language]
  const receipt = words.spendingReceipts
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const jpeg = await writeJpegWithPlace(page, photos.oneMatch, photos.oneMatch.replace(/\.png$/, `-place-${language}.jpg`))
    await uploadReceiptPhoto(page, press, jpeg)
    await waitForTextIn(page, '[data-testid="spending-receipt-place-found"]', '43.508100, 16.440200')
    await pickReceiptCategory(page, press, words, 'Groceries')
    await delay(300)
    await inspect?.('a receipt photo with a place')
    await shoot('spending-receipt-place-found')
    await saveReceipt(page, press, words)
    await dismissToasts(page)
    await openSpendingRow(page, press, 'Corner market', -2349)
    await waitForTextIn(page, '[data-testid="spending-entry-place"]', receipt.place('43.508100', '16.440200'))
    const link = await page.$eval('[data-testid="spending-entry-place-link"]', (anchor) => [anchor.getAttribute('href'), anchor.getAttribute('rel')])
    if (link[0] !== 'https://www.openstreetmap.org/?mlat=43.5081&mlon=16.4402#map=18/43.5081/16.4402' || !link[1].includes('noreferrer')) throw new Error(`the place links to ${link.join(' ')}`)
    await delay(300)
    await inspect?.('an entry with a place')
    await shoot('spending-entry-place')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await openSpendingRow(page, press, 'Corner market', -6120)
    await waitForTextIn(page, '[data-testid="spending-entry-place"]', '43.508100')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/** The sample export on the statements set: the row the rule would file near what was typed waits on To review as maybe the same money, with the rule's category. It files by that, and joins, each with one Undo. */
export function spendingReviewNearFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const { review, import: panel } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.revolut)
    await pressSelector(page, press, '[data-testid="spending-import-confirm"]')
    await toast(page, panel.imported)
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions?tab=review'
    })
    const row = await reviewRowOf(page, 'Corner market')
    await row.waitForSelector('[data-testid="spending-review-maybe-typed"]', { timeout: 10_000 })
    await row.waitForSelector('[data-testid="spending-review-rule-says"]', { timeout: 10_000 })
    await waitForTextIn(page, '[data-testid="spending-review-rule-says"]', review.ruleSays(words.spendingStarter.Groceries))
    await delay(300)
    await inspect?.('a row a rule would file, near what was typed')
    await shoot('spending-review-near')
    await press(await row.$('[data-testid="spending-review-file-as-rule"]'))
    await toast(page, review.filed)
    await undoIn(page, press, words)
    await dismissToasts(page)
    const back = await reviewRowOf(page, 'Corner market')
    await press(await back.$('[data-testid="spending-review-join"]'))
    await toast(page, review.joined)
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/** What the Bank sync tab's last sync says, or fails with, once it says something. A sync of the page may have run before the flow, so Sync now is tapped only when none has. */
async function bankSyncSettled(page, press, selector) {
  const shown = await page.waitForSelector(selector, { visible: true, timeout: 4_000 }).catch(() => null)
  if (shown !== null) return
  await pressSelector(page, press, '[data-testid="spending-bank-sync-now"]')
  await page.waitForSelector(selector, { visible: true, timeout: 10_000 })
}

/**
 * On Settings, Bank sync with nothing set up: the set-up's four steps and no link. Walk through them, bring a made-up key
 * and Check it, which the fake twin answers with an active application and whose toast offers Undo, open Link a bank, which
 * lists the banks that take a personal login with OTP banka in beta and leaves out the one with business logins only, link
 * Revolut, come back on the fake return with the code taken out of the address, read the synced rows on Entries, then Undo the import.
 */
export function spendingBankSyncFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const bank = { ...words.spendingBankSync, ...words.bankSyncShared }
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-bank-sync-setup"] [data-step="start"]', { visible: true, timeout: 10_000 })
    if ((await page.$('[data-testid="spending-bank-link"]')) !== null) throw new Error('Bank sync offers a link with no application set up')
    await delay(300)
    await inspect?.('the first step of the bank sync set-up')
    await shoot('spending-bank-sync-setup-start')
    await pressSelector(page, press, '[data-testid="spending-bank-setup-next"]')
    await page.waitForSelector('[data-testid="spending-bank-setup-values"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await inspect?.('the values the Enable Banking form asks for')
    await shoot('spending-bank-sync-setup-make')
    await pressSelector(page, press, '[data-testid="spending-bank-setup-next"]')
    await page.waitForSelector('[data-testid="spending-bank-key-pem"] textarea', { visible: true, timeout: 5_000 })
    await page.type('[data-testid="spending-bank-key-pem"] textarea', '-----BEGIN PRIVATE KEY-----\nbWFkZS11cA==\n-----END PRIVATE KEY-----')
    await page.type('[data-testid="spending-bank-key-application"] input', '00000000-0000-4000-8000-00000000fa4e')
    await delay(300)
    await inspect?.('the key brought, before Check')
    await shoot('spending-bank-sync-setup-key')
    await pressSelector(page, press, '[data-testid="spending-bank-key-check"]')
    await page.waitForSelector('[data-testid="spending-bank-setup-ready"]', { visible: true, timeout: 10_000 })
    await toast(page, bank.key.saved)
    if (!(await offersUndo(page, words, bank.key.saved))) throw new Error(`the "${bank.key.saved}" toast offers no ${words.writes.undo}, which puts back the book`)
    await delay(300)
    await inspect?.('the application checked and active')
    await shoot('spending-bank-sync-setup-active')
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="spending-bank-setup-done"]')
    await page.waitForSelector('[data-testid="spending-bank-link-add"]', { visible: true, timeout: 10_000 })
    await waitForTextIn(page, '[data-testid="spending-bank-application-name"]', bank.application.named('Kuna'))
    await page.waitForSelector('[data-testid="spending-bank-link-none"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await inspect?.('the bank sync with an application set up')
    await shoot('spending-settings-bank-sync-saved')
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="spending-bank-link-add"]')
    await page.waitForSelector('[data-testid="spending-bank-pick-bank"]', { visible: true, timeout: 10_000 })
    const offered = await page.$$eval('[data-testid="spending-bank-pick-bank"]', (rows) => rows.map((row) => row.textContent ?? ''))
    if (offered.some((row) => row.includes('Example Business Bank'))) throw new Error('Link a bank offers a bank that takes business logins only')
    if (!offered.some((row) => row.includes('OTP banka') && row.includes(bank.pick.betaCaption))) throw new Error(`Link a bank does not mark OTP banka as beta: ${offered.join(' | ')}`)
    await delay(300)
    await inspect?.('the banks Link a bank offers')
    await shoot('spending-bank-sync-pick')
    const revolut = (await page.$$('[data-testid="spending-bank-pick-bank"]'))[offered.findIndex((row) => row.includes('Revolut'))]
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30_000 }), press(revolut)])
    await page.waitForSelector('[data-testid="spending-bank-link-finish"], [data-testid="spending-bank-sync-result"]', { visible: true, timeout: 15_000 })
    if ((await page.$('[data-testid="spending-bank-sync-result"]')) === null) await pressSelector(page, press, '[data-testid="spending-bank-link-finish"]')
    await page.waitForSelector('[data-testid="spending-bank-sync-result"]', { visible: true, timeout: 15_000 })
    const address = await page.evaluate(() => window.location.search)
    if (address.includes('code=') || address.includes('state=')) throw new Error(`the address still holds the bank's answer: ${address}`)
    await waitForTextIn(page, '[data-testid="spending-bank-link-state"]', bank.linkedUntil(''))
    await toast(page, words.spendingBankSyncReading.imported)
    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions'
    })
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="spending-row"]')].some((row) => row.textContent?.includes('Corner market')), { timeout: 10_000 })
    await delay(300)
    await inspect?.('the synced rows on Entries')
    await shoot('spending-bank-sync-rows')
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/**
 * On Settings, Bank sync with OTP banka and Revolut linked while Enable Banking lists no Revolut: Link a bank offers no Revolut,
 * and once it has the list, Revolut's link says the list no longer has it and offers Remove in place of Link again, while OTP banka's still
 * offers Link again. Remove asks first, and once confirmed takes Revolut's row away, leaves OTP banka's and offers no Undo.
 */
export function spendingBankSyncNotListedFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const bank = { ...words.spendingBankSync, ...words.bankSyncShared }
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="spending-bank-link-add"]')
    await page.waitForSelector('[data-testid="spending-bank-pick-bank"]', { visible: true, timeout: 10_000 })
    const offered = await page.$$eval('[data-testid="spending-bank-pick-bank"]', (rows) => rows.map((row) => row.textContent ?? ''))
    if (offered.some((row) => row.includes('Revolut'))) throw new Error('Link a bank offers Revolut, which the list does not have')
    if (!offered.some((row) => row.includes(bank.pick.linked('').split(' ')[0]))) throw new Error(`Link a bank does not say which bank is linked already: ${offered.join(' | ')}`)
    await delay(300)
    await inspect?.('Link a bank with a bank linked already')
    await shoot('spending-bank-sync-pick-linked')
    await pressSelector(page, press, '[data-testid="spending-bank-pick-cancel"]')
    await page.waitForSelector('[data-testid="spending-bank-link-not-listed"]', { visible: true, timeout: 10_000 })
    const rows = await page.$$eval('[data-testid="spending-bank-link"]', (links) =>
      links.map((link) => ({ text: link.textContent ?? '', again: link.querySelector('[data-testid="spending-bank-link-again"]') !== null })),
    )
    const revolut = rows.find((row) => row.text.includes('Revolut'))
    const otp = rows.find((row) => row.text.includes('OTP banka'))
    if (revolut === undefined || revolut.again || !revolut.text.includes(bank.notListed)) throw new Error(`Revolut's link does not say the list no longer has it: ${revolut?.text}`)
    if (otp === undefined || !otp.again) throw new Error("OTP banka's link offers no Link again")
    await delay(300)
    await inspect?.('a linked bank the list no longer has')
    await shoot('spending-settings-bank-sync-not-listed')
    await pressSelector(page, press, '[data-testid="spending-bank-link"]:has([data-testid="spending-bank-link-not-listed"]) [data-testid="spending-bank-link-remove"]')
    await page.waitForSelector('[role="dialog"] [data-testid="spending-bank-link-remove-confirm"]', { visible: true, timeout: 10_000 })
    await waitForTextIn(page, '[role="dialog"]', bank.removeLinkTitle('Revolut'))
    if ((await page.$$('[data-testid="spending-bank-link"]')).length !== 2) throw new Error('Remove took a link away before it was confirmed')
    await delay(300)
    await inspect?.('Remove asking first for the bank the list no longer has')
    await shoot('spending-settings-bank-sync-not-listed-remove-confirm')
    await pressSelector(page, press, '[data-testid="spending-bank-link-remove-confirm"]')
    await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="spending-bank-link"]')].some((link) => link.textContent?.includes('Revolut')), { timeout: 10_000 })
    await toast(page, bank.linkRemoved('Revolut'))
    if (await offersUndo(page, words, bank.linkRemoved('Revolut'))) throw new Error(`the "${bank.linkRemoved('Revolut')}" toast offers ${words.writes.undo}, though the ended session cannot come back`)
    const left = await page.$$eval('[data-testid="spending-bank-link"]', (links) => links.map((link) => link.textContent ?? ''))
    if (left.length !== 1 || !left[0].includes('OTP banka')) throw new Error(`Remove took more than Revolut's link: ${left.join(' | ')}`)
    await delay(300)
    await inspect?.('the bank sync after Remove on the bank the list no longer has')
    await shoot('spending-settings-bank-sync-not-listed-removed')
    await dismissToasts(page)
  }
}

/** On Settings, Bank sync when Enable Banking's list cannot be read: Link a bank says so in a line and offers no bank. */
export function spendingBankSyncListFailedFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="spending-bank-link-add"]')
    await page.waitForSelector('[data-testid="spending-bank-pick-failed"]', { visible: true, timeout: 10_000 })
    if ((await page.$('[data-testid="spending-bank-pick-bank"]')) !== null) throw new Error('Link a bank offers a bank while the list could not be read')
    await delay(300)
    await inspect?.('Link a bank when the list cannot be read')
    await shoot('spending-bank-sync-pick-failed')
    await pressSelector(page, press, '[data-testid="spending-bank-pick-retry"]')
    await page.waitForSelector('[data-testid="spending-bank-pick-failed"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-bank-pick-cancel"]')
  }
}

/** On Settings, Bank sync when the script refuses to start a link: the tap on a bank says why inside Link a bank, which stays open with its banks. */
export function spendingBankSyncLinkRefusedFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="spending-bank-link-add"]')
    await page.waitForSelector('[data-testid="spending-bank-pick-bank"]', { visible: true, timeout: 10_000 })
    const offered = await page.$$eval('[data-testid="spending-bank-pick-bank"]', (rows) => rows.map((row) => row.textContent ?? ''))
    const revolut = (await page.$$('[data-testid="spending-bank-pick-bank"]'))[offered.findIndex((row) => row.includes('Revolut'))]
    await press(revolut)
    await page.waitForSelector('[data-testid="spending-bank-pick-link-failed"]', { visible: true, timeout: 10_000 })
    if ((await page.$('[data-testid="spending-bank-pick-bank"]')) === null) throw new Error('Link a bank no longer offers its banks after a refused link')
    await delay(300)
    await inspect?.('Link a bank after the script refused a link')
    await shoot('spending-bank-sync-pick-link-refused')
    await pressSelector(page, press, '[data-testid="spending-bank-pick-cancel"]')
  }
}

/** On Settings, Bank sync with both banks linked: the last sync's rows, the one a file brought skipped, and the account Kuna does not keep offered in the setup list. */
export function spendingBankSyncRowsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const days = '\u0000'
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-result"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-notes"] li', words.spendingFileReading.leftOut.notTaken(1, 'OTP current', days, '').one.split(days)[0])
    await page.waitForSelector('[data-testid="spending-bank-account"][data-kind="missing"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await inspect?.('the bank sync with rows a file brought')
    await shoot('spending-import-bank-sync')
  }
}

/**
 * On Kuna settings, a sync within six hours of the last bank fetch with an account at OTP and one at Revolut that Kuna does not keep: the
 * bank step ends done with both in one plain note. The OTP one, beside the OTP euro account Kuna keeps, takes the end of its number, never
 * the whole IBAN, and the Revolut one only its bank and currency. The control counts no problem.
 */
export function spendingBankSyncHeldNoteFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const bank = { ...words.spendingBankSync, ...words.bankSyncShared }
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const literally = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    const accounts = new Intl.ListFormat(words.locale, { type: 'conjunction' }).format([
      bank.linkedAccount('OTP banka', 'EUR', linkedAccountEnding({ iban: UNKNOWN_IBAN })),
      bank.linkedAccount('Revolut', 'GBP', ''),
    ])
    const note = literally(bank.unknownAccounts(2, accounts).other)
    await openKunaSettings(page)
    // A sync asks the banks, if none did within six hours, and the next one is held back.
    await pressSelector(page, press, `${SYNC_CARD} [data-testid="sync-again"]`)
    await stepSays(page, SYNC_CARD, 'bank-sync', 'done', note)
    await pressSelector(page, press, `${SYNC_CARD} [data-testid="sync-again"]`)
    const said = await stepSays(page, SYNC_CARD, 'bank-sync', 'done', literally(bank.step.tooSoon))
    if (!note.test(said)) throw new Error(`the held bank step does not note the accounts Kuna does not keep, it says: ${said}`)
    if (said.includes(UNKNOWN_IBAN)) throw new Error(`the held bank step spells the whole IBAN: ${said}`)
    await controlShows(page, 'ready')
    await shootAt(page, shoot, SYNC_CARD, 'spending-bank-sync-held-note')
    await inspect?.('the held bank step with accounts Kuna does not keep')
  }
}

/** On Settings, Bank sync when OTP states an available balance Kuna does not reach with every row, its pending one among them: the warning, with the opening that makes them agree. */
export function spendingBankSyncBalanceFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-difference"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-difference"]', words.spendingBankSync.setOpeningCaption)
    if ((await page.$('[data-testid="spending-bank-sync-set-opening"]')) === null) throw new Error('no opening is offered for a balance that differs')
    await dismissToasts(page)
    // Below the top bar and the tabs, which stay on screen.
    await page.$eval('[data-testid="spending-bank-sync-setup"]', (card) => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 140 }))
    await delay(300)
    await inspect?.('the bank sync when a balance differs')
    await shoot('spending-bank-sync-balance')
  }
}

/**
 * On Settings, Bank sync when a synced row looks like the file's Old Town Bookshop three days before: the card asks about it and
 * puts it on hold, To review lists it with the same answers, and Keep both there books it and takes the hold off in one write.
 */
export function spendingBankSyncLookAlikeFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="questions"]')
    await elementSays(page, '[data-testid="question"]', ['OLD TOWN BOOKSHOP D.O.O.', 'Old Town Bookshop'], 'the sync card does not name both rows of the look-alike')
    await shootAt(page, shoot, '[data-testid="questions"]', 'spending-bank-sync-lookalike')
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions?tab=review'
    })
    await page.waitForSelector('[data-testid="spending-review-held"] [data-testid="question"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('To review with a bank row on hold')
    await shoot('spending-review-held')
    await pressSelector(page, press, '[data-testid="spending-review-held"] [data-testid="question-choice"] button:nth-child(2)')
    await toast(page, words.spendingBankSync.heldBooked)
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-review-held"]') === null, { timeout: 10_000 })
    await dismissToasts(page)
  }
}

/**
 * On Settings, Bank sync with OTP's cash machine row, which the Bankomat rule spots: the last sync's dry run says its money
 * went to Cash.
 */
export function spendingBankSyncWithdrawalFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-result"]')
    await dismissToasts(page)
    await centreOn(page, '[data-testid="spending-bank-sync-result"] [data-testid="spending-dry-run-outcome"]', aroundAmount(words.spendingStatements.review.cash.toCash('\u0000', 'Cash')))
    await delay(300)
    await inspect?.('the bank sync with cash taken out going to Cash')
    await shoot('spending-bank-sync-withdrawal')
  }
}

/**
 * On To review with the cash set: the withdrawals with no cash leg, two moving to Cash together, one asking which dollar cash
 * account and one offering to add a pound one. Move 2 to cash writes both legs in one write that one Undo takes back, Not cash
 * takes one off the list until Undo, picking a dollar account moves that one, and Add a cash account opens the account dialog
 * as a pound cash account.
 */
export function spendingReviewCashFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const cash = words.spendingStatements.review.cash
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const card = '[data-testid="spending-review-cash"]'
    await page.waitForSelector(`${card} [data-testid="spending-review-cash-row"]`, { visible: true, timeout: 10_000 })
    await elementSays(page, card, [cash.title, 'Bankomat Ilica', 'Cash at Boston ATM', 'Dollars at home', cash.noAccount('GBP')], 'the cash card does not list the three kinds of withdrawal')
    await delay(300)
    await inspect?.('To review with cash withdrawals')
    await shoot('spending-review-cash')
    const rows = async () => page.$$eval(`${card} [data-testid="spending-review-cash-row"]`, (found) => found.length)
    if ((await rows()) !== 2) throw new Error(`the cash card proposes ${await rows()} withdrawals, not 2`)
    await pressSelector(page, press, '[data-testid="spending-review-cash-move"]')
    await toast(page, countedIn(words, cash.moved(2), 2))
    await page.waitForFunction((where) => document.querySelector(`${where} [data-testid="spending-review-cash-row"]`) === null, { timeout: 10_000 }, card)
    await undoIn(page, press, words)
    await page.waitForFunction((where) => document.querySelectorAll(`${where} [data-testid="spending-review-cash-row"]`).length === 2, { timeout: 10_000 }, card)
    await dismissToasts(page)
    await pressSelector(page, press, `${card} [data-testid="spending-review-cash-not-cash"]`)
    await toast(page, cash.leftFiled)
    await page.waitForFunction((where) => document.querySelectorAll(`${where} [data-testid="spending-review-cash-row"]`).length === 1, { timeout: 10_000 }, card)
    await undoIn(page, press, words)
    await page.waitForFunction((where) => document.querySelectorAll(`${where} [data-testid="spending-review-cash-row"]`).length === 2, { timeout: 10_000 }, card)
    await dismissToasts(page)
    await pressSelector(page, press, `${card} [data-testid="question-choice"] button:nth-child(1)`)
    await toast(page, countedIn(words, cash.moved(1), 1))
    await page.waitForFunction((where) => document.querySelector(`${where} [data-testid="question"]`) === null, { timeout: 10_000 }, card)
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="spending-review-cash-add-account"] button')
    await page.waitForSelector('[data-testid="spending-account-dialog"]', { visible: true, timeout: 10_000 })
    await elementSays(page, '[data-testid="spending-account-currency"]', ['GBP'], "the account dialog does not start in the withdrawal's currency")
    if ((await page.$('[data-testid="spending-account-bank"]')) !== null) throw new Error('the account dialog does not start as a cash account')
    await delay(300)
    await inspect?.('the account dialog To review opens for a cash account')
    await shoot('spending-review-cash-add-account')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-account-dialog"]') === null, { timeout: 10_000 })
  }
}

/** The longest stretch of a line around the amount it names, which is the same in every build whatever the amount reads as. */
function aroundAmount(line) {
  return line.split('\u0000').reduce((longest, part) => (part.trim().length > longest.length ? part.trim() : longest), '')
}

/**
 * On Settings, Bank sync when OTP's balances count a transfer it holds as not booked and does not list: a plain line that says so,
 * with no warning, since the booked balance agrees with the booked rows.
 */
export function spendingBankSyncUnlistedFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-unlisted"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-unlisted"]', aroundAmount(words.spendingBankSync.unlistedPending('\u0000', '\u0000')))
    if ((await page.$('[data-testid="spending-bank-sync-difference"]')) !== null) throw new Error('a booked balance that agrees shows as a warning')
    await dismissToasts(page)
    // Below the top bar and the tabs, which stay on screen.
    await page.$eval('[data-testid="spending-bank-sync-setup"]', (card) => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 140 }))
    await delay(300)
    await inspect?.('the bank sync when a bank holds money it does not list')
    await shoot('spending-bank-sync-unlisted')
  }
}

/**
 * On Settings, Bank sync, the setup list after a fetch: shoots it under `shot`, then when `tap` names a button, taps the
 * first, waits for the toast `done` names, shoots it under `shot` and `after` when that is given, and takes it back.
 * `openKept` opens the card of accounts kept before that second shot and shoots it from its top.
 */
export function spendingBankSyncSetupFlowIn(language, shot, { waitFor, tap = null, done = null, after = null, openKept = false }) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-setup"]')
    await page.waitForSelector(waitFor, { visible: true, timeout: 5_000 })
    await dismissToasts(page)
    // Below the top bar and the tabs, which stay on screen.
    await page.$eval('[data-testid="spending-bank-sync-setup"]', (card) => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 140 }))
    await delay(300)
    await inspect?.(`the setup list for ${shot}`)
    await shoot(shot)
    if (tap === null) return
    await pressSelector(page, press, tap)
    await toast(page, done(words))
    if (after !== null) {
      if (openKept) {
        const kept = '[data-card="spending.bank-sync.kept"]'
        if ((await page.$eval(kept, (card) => card.dataset.collapsed)) === 'true') await pressSelector(page, press, `${kept} .card-toggle`)
        await page.waitForSelector(`${kept}[data-collapsed="false"] [data-testid="spending-bank-account-bring-back-mine"]`, { visible: true, timeout: 5_000 })
        await page.$eval(kept, (card) => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 140 }))
      }
      await delay(300)
      await shoot(after)
    }
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/**
 * The earliest and the latest day a day field's calendar offers, as YYYY-MM-DD. The calendar opens on the field's month and
 * steps back a month at a time until it offers no earlier month, and closes again.
 */
async function calendarLimitsOf(page, press, field) {
  const header = '[data-reka-popper-content-wrapper] [data-slot="header"]'
  const offered = (edge) =>
    page.$$eval(
      '[data-reka-popper-content-wrapper] [data-reka-calendar-cell-trigger]:not([data-disabled]):not([data-outside-view])',
      (cells, wanted) => cells.at(wanted === 'first' ? 0 : -1)?.dataset.value ?? '',
      edge,
    )
  await pressSelector(page, press, `${field} button`)
  await page.waitForSelector(header, { visible: true, timeout: 5_000 })
  const max = (await page.$(`${header} > button:nth-last-of-type(2)[data-disabled]`)) === null ? '' : await offered('last')
  const previousMonth = `${header} > button:nth-of-type(2)`
  for (let month = 0; month < 24 && (await page.$(`${previousMonth}[data-disabled]`)) === null; month += 1) await pressSelector(page, press, previousMonth)
  const min = await offered('first')
  await page.keyboard.press('Escape')
  await page.waitForSelector(header, { hidden: true, timeout: 5_000 })
  return { min, max }
}

/**
 * On Settings, Bank sync with two accounts to add: each starts on the day of the fetch, a day before the bank's first row is
 * refused with the days it can start on, and the earliest day works the opening back to an empty account and adds it.
 */
export function spendingBankSyncStartDayFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const setup = words.spendingBankSync.setup
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const line = '[data-testid="spending-bank-account"][data-kind="missing"]'
    const start = `${line} [data-testid="spending-bank-account-start"]`
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-setup"]')
    await page.waitForSelector(start, { visible: true, timeout: 5_000 })
    await dismissToasts(page)
    const input = await page.$(start)
    const value = await input.$eval('input', (element) => element.value)
    const { min, max } = await calendarLimitsOf(page, press, start)
    if (value !== max || min >= max) throw new Error(`the first account to add should start on the day of the fetch, ${max}, and reach back to ${min}, not ${value}`)
    const before = new Date(Date.parse(`${min}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
    await setField(input, before)
    await pressSelector(page, press, `${line} [data-testid="spending-bank-account-add"]`)
    await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('aria-invalid') === 'true', { timeout: 5_000 }, start)
    await page.$eval('[data-testid="spending-bank-sync-setup"]', (card) => window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 140 }))
    await delay(300)
    await inspect?.('a start day before the bank gave rows')
    await shoot('spending-bank-sync-setup-start-day-refused')
    await setField(input, min)
    await waitForTextIn(page, line, setup.openingStart)
    await delay(300)
    await inspect?.('the earliest start day')
    await shoot('spending-bank-sync-setup-start-day')
    await pressSelector(page, press, `${line} [data-testid="spending-bank-account-add"]`)
    await toast(page, words.spendingAccounts.addedCount(1).one)
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/** On Settings, Bank sync when one bank gives no rows: the line about it, with the other bank's rows in. */
export function spendingBankSyncPartFlowIn(language, shot, line) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-problem"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-problem"]', line(words.spendingBankSyncReading))
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-bank-sync-result"]')?.textContent?.includes('Corner market') ?? false, { timeout: 5_000 })
    await delay(300)
    await inspect?.('the bank sync when one bank gives no rows')
    await shoot(shot)
  }
}

/** On Settings, Bank sync when the script answers an error: the reason shows with what is saved still there. */
export function spendingBankSyncFailedFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-failed"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-failed"]', words.bankScript.didNotAnswer(''))
    await delay(300)
    await inspect?.('the bank sync when the script fails')
    await shoot('spending-bank-sync-failed')
  }
}

/**
 * On Settings, Bank sync with an application whose accounts are not linked in Enable Banking's panel: Check again says it is not
 * active yet, Replace key opens the key form beside the kept one, and an id of another application warns that the links end.
 */
export function spendingBankApplicationFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const bank = { ...words.spendingBankSync, ...words.bankSyncShared }
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-bank-application-check"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-bank-application-check"]')
    await waitForTextIn(page, '[data-testid="spending-bank-application-problem"]', bank.application.problems['not-active'])
    await delay(300)
    await inspect?.('the application checked and not active yet')
    await shoot('spending-bank-sync-application-inactive')
    await pressSelector(page, press, '[data-testid="spending-bank-key-replace"]')
    await page.waitForSelector('[data-testid="spending-bank-key-application"] input', { visible: true, timeout: 5_000 })
    await page.type('[data-testid="spending-bank-key-application"] input', '00000000-0000-4000-8000-000000000001')
    await page.waitForSelector('[data-testid="spending-bank-key-other"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await inspect?.('replacing the key with one of another application')
    await shoot('spending-bank-sync-key-replace')
    await pressSelector(page, press, '[data-testid="spending-bank-key-cancel"]')
    await pressSelector(page, press, '[data-testid="spending-bank-sync-remove"]')
    await page.waitForSelector('[data-testid="spending-bank-sync-remove-confirm"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await inspect?.('Remove bank sync asking first')
    await shoot('spending-bank-sync-remove-ask')
    await pressSelector(page, press, '[data-testid="spending-bank-sync-remove-confirm"]')
    await toast(page, bank.application.removed)
    if (await offersUndo(page, words, bank.application.removed)) throw new Error(`the "${bank.application.removed}" toast offers ${words.writes.undo}, which cannot reach the key or the bank's links`)
    await page.waitForSelector('[data-testid="spending-bank-sync-setup"]', { visible: true, timeout: 10_000 })
    await dismissToasts(page)
  }
}

/** Whether the toast under the title offers Undo. */
async function offersUndo(page, words, title) {
  return await page.evaluate(
    (selector, wanted, label) =>
      [...document.querySelectorAll(selector)]
        .filter((shown) => shown.querySelector('[data-slot="title"]')?.textContent?.trim() === wanted)
        .some((shown) => [...shown.querySelectorAll('button')].some((button) => button.textContent?.trim() === label)),
    TOAST,
    title,
    words.writes.undo,
  )
}

/** On Spending's Import: the export without a Fee column is refused, naming the column, with no dry run. */
export function spendingImportRefusedFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.refused)
    const wanted = words.spendingFileReading.refused.recipeMiss('Revolut', 'Fee')
    await page
      .waitForFunction((text) => document.querySelector('[data-testid="spending-import-refused"]')?.textContent?.includes(text) ?? false, { timeout: 10_000 }, wanted)
      .catch(() => {
        throw new Error(`the refused file does not say "${wanted}"`)
      })
    if ((await page.$('[data-testid="spending-dry-run"]')) !== null) throw new Error('a refused file still shows a dry run')
    await delay(300)
    await inspect?.('the refused Revolut export')
    await shoot('spending-import-refused')
  }
}

/**
 * Drops an export in currencies no account keeps: Import says which two accounts to add, drafted from the file, and adds
 * both with one tap, after which the file's dry run shows. Undo takes both away and the offer comes back.
 */
export function spendingImportMissingFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const reading = words.spendingFileReading.refused
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const offer = '[data-testid="spending-import-missing-accounts"]'
    const wanted = reading.addToBringIn(language === 'en' ? 'bank accounts in GBP and CHF' : 'bankovne račune u valutama GBP i CHF', 'Revolut')
    await dropSpendingFile(page, paths.missing)
    await waitForTextIn(page, offer, wanted)
    await countOf(page, '[data-testid="spending-import-missing-account"]', 2, 'the offer for the missing accounts')
    if ((await page.$('[data-testid="spending-dry-run"]')) !== null) throw new Error('a file refused for its accounts still shows a dry run')
    await delay(300)
    await inspect?.('the accounts a Revolut export needs')
    await shoot('spending-import-missing')
    await pressSelector(page, press, '[data-testid="spending-import-add-accounts"]')
    const added = words.spendingAccounts.addedCount(2)
    await toast(page, language === 'en' ? added.other : added.few)
    await spendingDryRunSays(page, words.spendingStatements.import.summary(4, 0, 0))
    await delay(300)
    await inspect?.('the dry run once its accounts are added')
    await shoot('spending-import-missing-added')
    await undoIn(page, press, words)
    await waitForTextIn(page, offer, wanted)
    await dismissToasts(page)
  }
}

/**
 * With the bank sync set up, the offer for the accounts an export needs asks how each one's rows come in. Each draft
 * starts on the statement file it is made from, and From the bank links it after the file under the IBAN the file's Revolut
 * account holds. A cleared IBAN stops Add with the reason under it, and the IBAN typed back adds both.
 */
export function spendingImportMissingBankFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const choice = words.spendingAccounts.rowsFromChoice
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const offer = '[data-testid="spending-import-missing-accounts"]'
    const ibans = '[data-testid="spending-import-missing-account-iban"]'
    await dropSpendingFile(page, paths.missing)
    await countOf(page, '[data-testid="spending-import-missing-account-rows-from"]', 2, 'the choice of how each missing account takes its rows')
    const picked = await page.$$eval('[data-testid="spending-import-missing-account-rows-from"] [aria-pressed="true"]', (buttons) => buttons.map((button) => button.textContent?.trim() ?? ''))
    if (picked.some((label) => label !== words.spendingAccounts.rowsFrom['provider-file'])) throw new Error(`the drafts start as ${picked.join(', ')}, not on the statement file`)
    for (const choice of await page.$$('[data-testid="spending-import-missing-account-rows-from"] [data-value="bank-link"]')) {
      await choice.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await press(choice)
    }
    const filled = await page.$$eval(`input${ibans}, ${ibans} input`, (inputs) => inputs.map((input) => input.value))
    if (filled.length !== 2 || filled.some((iban) => iban !== 'LT000000000000000001')) throw new Error(`the drafts do not share the Revolut account's IBAN: ${filled.join(', ')}`)
    await fill(page, 'spending-import-missing-account-iban', '')
    await pressSelector(page, press, '[data-testid="spending-import-add-accounts"]')
    await waitForTextIn(page, offer, choice.ibanNeeded)
    await delay(300)
    await inspect?.('the missing accounts linked to the bank, one with its IBAN cleared')
    await shoot('spending-import-missing-bank')
    await fill(page, 'spending-import-missing-account-iban', 'LT000000000000000001')
    await pressSelector(page, press, '[data-testid="spending-import-add-accounts"]')
    const added = words.spendingAccounts.addedCount(2)
    await toast(page, language === 'en' ? added.other : added.few)
    await dismissToasts(page)
  }
}

/** Drops the export whose pocket moves have no savings account: Import says what the file holds, with the offer to add that account under it, and the dry run has no second note for the same gap. */
export function spendingImportMissingSavingsFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const offer = '[data-testid="spending-import-file"] [data-testid="spending-import-missing-accounts"]'
    await dropSpendingFile(page, paths.revolut)
    await spendingDryRunSays(page, words.spendingStatements.import.summary(10, 1, 1))
    await page.waitForSelector(offer, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Import offers no savings account under what the file holds')
    })
    await countOf(page, '[data-testid="spending-import-holding"]', 3, 'what the file holds, by product and currency')
    const notes = await page.$eval('[data-testid="spending-dry-run-notes"]', (element) => element.textContent ?? '')
    if (/savings rows? left out|redaka štednje/i.test(notes)) throw new Error(`the dry run notes repeat the savings gap: ${notes}`)
    await delay(300)
    await inspect?.('the dry run with its savings offer')
    await shoot('spending-import-missing-savings')
  }
}

/**
 * On To review with the statements set: Not a pair sends both legs back to review, and a leg takes a category until Undo.
 * On a fresh load Not a pair is undone, a near match is joined with the typed row and undone, an offered transfer is paired
 * and undone, and money in is filed as a lone leg under Between my accounts and undone, then as a refund.
 */
export function spendingReviewFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const review = words.spendingStatements.review
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const ROW = '[data-testid="spending-review-row"]'
    const PAIR = '[data-testid="spending-pair"]'
    await countOf(page, ROW, 6, 'the set should wait with six rows')
    await pressSelector(page, press, '[data-testid="spending-not-a-pair"]')
    await toast(page, review.pairUndone)
    await countOf(page, ROW, 8, 'Not a pair should send both legs back')
    await countOf(page, PAIR, 0, 'Not a pair should end the pair')
    await dismissToasts(page)
    const leg = await reviewRowOf(page, 'Top-up from OTP')
    await choose(page, press, await leg.$('[data-testid="spending-review-category"]'), words.spendingStarter['Other income'])
    await toast(page, review.filed)
    await countOf(page, ROW, 7, 'a category should take the leg off review')
    await inspect?.('To review after Not a pair')
    await shoot('spending-review-not-a-pair')
    await undoIn(page, press, words)
    await countOf(page, ROW, 8, 'Undo should bring the leg back')
    await dismissToasts(page)
    // A fresh load seeds the set again.
    await page.reload({ waitUntil: 'load' })
    await countOf(page, ROW, 6, 'a fresh load should wait with six rows')

    await pressSelector(page, press, '[data-testid="spending-not-a-pair"]')
    await toast(page, review.pairUndone)
    await countOf(page, ROW, 8, 'Not a pair should send both legs back')
    await undoIn(page, press, words)
    await countOf(page, ROW, 6, 'Undo should put the pair back')
    await countOf(page, PAIR, 1, 'Undo should put the pair back')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="spending-review-join"]')
    await toast(page, review.joined)
    await countOf(page, ROW, 5, 'joining should take the bank row off review')
    await undoIn(page, press, words)
    await countOf(page, ROW, 6, 'Undo should bring the bank row back')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="spending-review-pair"]')
    await toast(page, review.paired)
    await countOf(page, ROW, 4, 'pairing should take both rows off review')
    await countOf(page, PAIR, 2, 'pairing should list the new pair')
    await undoIn(page, press, words)
    await countOf(page, ROW, 6, 'Undo should bring both rows back')
    await dismissToasts(page)

    const topUp = await reviewRowOf(page, 'Top-up by card')
    await choose(page, press, await topUp.$('[data-testid="spending-review-category"]'), words.spendingStarter['Between my accounts'])
    await toast(page, review.filed)
    await countOf(page, ROW, 5, 'Between my accounts should take the top-up off review')
    await countOf(page, '[data-testid="spending-lone-leg"]', 3, 'the top-up should wait as a lone leg')
    await undoIn(page, press, words)
    await countOf(page, ROW, 6, 'Undo should bring the top-up back')
    await dismissToasts(page)
    const refund = await reviewRowOf(page, 'Top-up by card')
    await choose(page, press, await refund.$('[data-testid="spending-review-category"]'), words.spendingStarter.Pharmacy)
    await toast(page, review.filed)
    await countOf(page, ROW, 5, 'a spending category should file money in as a refund')
    await dismissToasts(page)
  }
}

/**
 * On the receipts set's Entries: a receipt of one line reads as a typed entry, its category and words under the payee with one
 * amount and the receipt's mark in the camera's box, which every row keeps so the amounts stay in one column. The Corner market receipt's first line is then filed under Eating out with
 * words of its own in the entry dialog, its amount staying the receipt's, the row's lines show it, and one Undo puts it back.
 */
export function spendingReceiptRefileFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const starter = words.spendingStarter
  const note = language === 'en' ? 'Dinner shopping' : 'Kupnja za večeru'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await rowMarksReceipt(page, 'Espresso bar', -460, true)
    const oneLine = await page.$$eval(SPENDING_ROW, (rows) => {
      const row = rows.find((candidate) => candidate.dataset.amount === '-460')
      return { text: row?.textContent ?? '', lines: row?.querySelectorAll('[data-testid="spending-row-line"]').length ?? -1 }
    })
    if (oneLine.lines !== 0) throw new Error(`the receipt of one line shows ${oneLine.lines} lines under its row, not none`)
    if (!oneLine.text.includes(starter['Eating out']) || !oneLine.text.includes('Two espressos')) throw new Error(`the receipt of one line reads "${oneLine.text.trim()}", not its category and words`)
    const amountEdges = await page.$$eval(SPENDING_ROW, (rows) => [
      ...new Set(rows.map((row) => Math.round(row.querySelector('.list-row-amount > :first-child')?.getBoundingClientRect().right ?? -1))),
    ])
    if (amountEdges.length !== 1) throw new Error(`the amounts on Entries end at ${amountEdges.join(', ')} px, not in one column beside the receipt marks`)
    await inspect?.('a receipt of one line on Entries, read as a typed entry with the receipt mark')
    await shoot('spending-receipt-one-line')

    await openSpendingRow(page, press, 'Corner market', -6120)
    const filings = await page.$$('[data-testid="spending-entry-line-filing"]')
    if (filings.length !== 2) throw new Error(`the receipt's entry dialog files ${filings.length} lines, not its two`)
    await choose(page, press, await filings[0].$('[data-testid="spending-entry-line-category"]'), starter['Eating out'])
    const noteField = await filings[0].$('[data-testid="spending-entry-line-note"]')
    await noteField.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(noteField)
    await page.keyboard.type(note)
    await delay(300)
    await inspect?.("a receipt's line filed anew in the entry dialog")
    await shoot('spending-entry-receipt-refile')
    await pressSelector(page, press, '[data-testid="spending-entry-save"]')
    await toast(page, words.spendingEntries.dialog.saved)
    await rowLinesAre(page, 'Corner market', -6120, 2)
    await page
      .waitForFunction(
        (selector, wanted) => [...document.querySelectorAll(selector)].some((row) => row.dataset.amount === '-6120' && row.textContent?.includes(wanted)),
        { timeout: 10_000 },
        SPENDING_ROW,
        note,
      )
      .catch(() => {
        throw new Error(`the Corner market row does not show its line's new words "${note}"`)
      })
    await inspect?.("the row with its receipt's line filed anew")
    await shoot('spending-receipt-refiled')
    await undoIn(page, press, words)
    const back = await page.$$eval(SPENDING_ROW, (rows, wanted) => rows.some((row) => row.dataset.amount === '-6120' && row.textContent?.includes(wanted)), note)
    if (back) throw new Error("Undo left the line's new words on the Corner market row")
    await dismissToasts(page)
  }
}

/**
 * On the receipts set's Entries: a photo whose QR code matches the Corner market payment takes its lines typed by hand, the first
 * of 20 under Groceries and the rest under Furniture and household goods. The row shows both lines, and one Undo takes them off.
 */
export function spendingReceiptLinesFlowIn(language, photos) {
  const words = SCREEN_WORDS[language]
  const starter = words.spendingStarter
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await uploadReceiptPhoto(page, press, photos.oneMatch)
    await page.waitForSelector('[data-testid="spending-receipt-place"][data-match="ready"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the receipt is not offered its one payment ready')
    })
    await pickReceiptCategory(page, press, words, 'Groceries')
    await pressSelector(page, press, '[data-testid="spending-receipt-type-lines"]')
    await page.waitForSelector('[data-testid="spending-receipt-typed-lines"] [data-testid="split-part"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Type its lines shows no lines')
    })
    const [first, second] = await page.$$('[data-testid="spending-receipt-typed-lines"] [data-testid="split-part"]')
    const amount = await first.$('[data-testid="split-part-amount"]')
    await amount.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(amount)
    await amount.evaluate((element) => element.select())
    await page.keyboard.type('20')
    await choose(page, press, await second.$('[data-testid="spending-receipt-line-category"]'), starter['Furniture and household goods'])
    const labels = await second.$('[data-testid="spending-receipt-line-labels"]')
    if (labels === null) throw new Error('line 2 of the receipt has no labels field')
    await pickLabel(page, press, labels, language === 'en' ? 'Housewarming' : 'Useljenje', true, SPENDING_RECEIPT_FORM)
    await delay(300)
    await inspect?.("a receipt's lines typed by hand, each with its category, labels and event")
    await shoot('spending-receipt-lines')
    await saveReceipt(page, press, words)
    await rowLinesAre(page, 'Corner market', -2349, 2)
    if (!(await rowLabels(page, 'Corner market', -2349)).includes(language === 'en' ? 'Housewarming' : 'Useljenje'))
      throw new Error("the receipt's row does not name the label typed on its second line")
    await undoIn(page, press, words)
    await rowLinesAre(page, 'Corner market', -2349, 0)
    await dismissToasts(page)
  }
}

/**
 * On To review with the statements set after twelve payments at unknown shops are imported: more rows wait than To review first shows,
 * so Pick all opens Show all and picks every waiting row, not only the first ones in sight.
 */
export function spendingReviewPickAllFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const ROW = '[data-testid="spending-review-row"]'
    await dropSpendingFile(page, paths.manyShops)
    await pressSelector(page, press, '[data-testid="spending-import-confirm"]')
    await toast(page, words.spendingStatements.import.imported)
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions?tab=review'
    })
    await page.waitForSelector('[data-testid="spending-review"] [data-testid="show-all"]', { visible: true, timeout: 10_000 }).catch(async () => {
      throw new Error(`To review shows its ${await page.$$eval(ROW, (rows) => rows.length)} rows at once, so Pick all has nothing out of sight to pick`)
    })
    const firstShown = await page.$$eval(ROW, (rows) => rows.length)
    await pressSelector(page, press, '[data-testid="spending-review-select"]')
    await pressSelector(page, press, '[data-testid="selection-bar-pick-all"]')
    await page
      .waitForFunction(
        (rows, before) => {
          const shown = document.querySelectorAll(rows).length
          return shown > before && document.querySelectorAll('[data-testid="list-row-pick"][aria-checked="true"]').length === shown
        },
        { timeout: 5_000 },
        ROW,
        firstShown,
      )
      .catch(() => {
        throw new Error(`Pick all did not show and pick every waiting row beyond the first ${firstShown}`)
      })
    if (!(await page.$eval('[data-testid="selection-bar-pick-all"]', (button) => button.disabled))) throw new Error('Pick all stays on with every waiting row picked')
    await inspect?.('To review with every waiting row picked')
    await shoot('spending-review-select-all-many')
    await pressSelector(page, press, '[data-testid="selection-bar-cancel"]')
  }
}

/**
 * On To review with the statements set: Select picks rows, Pick all picks every waiting row, and one City pharmacy row with
 * Pick the same payee picks the other. Both are filed under Pharmacy in one write, and one Undo brings them back.
 */
export function spendingReviewSelectFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { review } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const ROW = '[data-testid="spending-review-row"]'
    const pharmacyRows = () => page.$$eval(ROW, (rows) => rows.filter((row) => row.textContent?.includes('City pharmacy')).length)
    await countOf(page, ROW, 6, 'the set should wait with six rows')
    await pressSelector(page, press, '[data-testid="spending-review-select"]')
    await page.waitForSelector('[data-testid="selection-bar"]', { visible: true, timeout: 10_000 })
    await inspect?.('To review with nothing picked')
    await shoot('spending-review-select-none')
    await pressSelector(page, press, '[data-testid="selection-bar-pick-all"]')
    await pickedCountIs(page, 6, 'Pick all')
    await inspect?.('To review with every row picked')
    await shoot('spending-review-select-all')
    await pressSelector(page, press, '[data-testid="selection-bar-cancel"]')
    await page.waitForFunction(() => !document.querySelector('[data-testid="selection-bar"]'), { timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="spending-review-select"]')
    await pickRowNamed(page, press, ROW, 'City pharmacy')
    await pickedCountIs(page, 1, 'one tap')
    await page.waitForSelector('[data-testid="spending-review-same-payee"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error(`a City pharmacy row picked does not offer ${review.pickSamePayee}`)
    })
    await inspect?.('To review with one City pharmacy row picked')
    await shoot('spending-review-select-one')
    await pressSelector(page, press, '[data-testid="spending-review-same-payee"]')
    await pickedCountIs(page, 2, review.pickSamePayee)
    await shoot('spending-review-select-payee')
    await chooseBySearch(page, press, '[data-testid="spending-review-file-picked"]', words.spendingStarter.Pharmacy)
    await toast(page, countedIn(words, review.filedUnder(2, words.spendingStarter.Pharmacy), 2))
    if ((await page.$('[data-testid="selection-bar"]')) !== null) throw new Error('the selection stays after filing')
    await countOf(page, ROW, 4, 'filing two rows should take them off review')
    await inspect?.('To review after filing two rows')
    await shoot('spending-review-select-filed')
    await undoIn(page, press, words)
    await countOf(page, ROW, 6, 'Undo should bring both rows back')
    if ((await pharmacyRows()) !== 2) throw new Error('Undo did not bring both City pharmacy rows back')
    await dismissToasts(page)
  }
}

/**
 * On Entries with the statements set: the City pharmacy payment the bank has not booked yet carries the Not booked yet mark under
 * its details, and its dialog says its amount and day may still change.
 */
export function spendingPendingRowFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const entries = words.spendingEntries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await waitForTextIn(page, '[data-testid="spending-row-pending"]', entries.notBookedYet)
    await centreOn(page, SPENDING_ROW, 'City pharmacy')
    await delay(300)
    await inspect?.('a row the bank has not booked yet')
    await shoot('spending-entry-pending-row')
    await openSpendingRow(page, press, 'City pharmacy', -1890)
    await waitForTextIn(page, '[data-testid="spending-entry-source-note"]', entries.dialog.pending)
    await inspect?.('the dialog of a row the bank has not booked yet')
    await shoot('spending-entry-pending')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/**
 * On To review with the bakery payment the bank booked since: the card of payments the bank dropped names the hotel hold with how
 * it was filed, the City pharmacy row waiting for a category carries the Not booked yet mark, and OK takes the note away, which
 * Undo brings back.
 */
export function spendingReviewPendingFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dropped } = words.spendingStatements.review
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await waitForTextIn(page, '[data-testid="spending-review-dropped-filing"]', dropped.filedAs('\u0000').split('\u0000')[0] ?? '')
    await shootAt(page, shoot, '[data-testid="spending-review-dropped"]', 'spending-review-dropped')
    await waitForTextIn(page, '[data-testid="spending-review-row-pending"]', words.spendingEntries.notBookedYet)
    await centreOn(page, '[data-testid="spending-review-row"]', 'City pharmacy')
    await delay(300)
    await inspect?.('a row to review the bank has not booked yet')
    await shoot('spending-review-pending')
    await pressSelector(page, press, '[data-testid="spending-review-dropped-ok"]')
    await toast(page, dropped.seen)
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-review-dropped"]') === null, { timeout: 10_000 })
    await undoIn(page, press, words)
    await page.waitForSelector('[data-testid="spending-review-dropped"]', { visible: true, timeout: 10_000 })
    await dismissToasts(page)
  }
}

/** On Settings, Bank sync when OTP books the bakery payment it had not booked: the step says the payment is booked now and keeps how you filed it. */
export function spendingBankSyncBookedFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await bankSyncSettled(page, press, '[data-testid="spending-bank-sync-result"]')
    await waitForTextIn(page, '[data-testid="spending-bank-sync-notes"] li', words.spendingStatementReading.pendingBooked(1).one)
    await delay(300)
    await inspect?.('the bank sync once a pending payment books')
    await shootAt(page, shoot, '[data-testid="spending-bank-sync-result"]', 'spending-bank-sync-booked')
  }
}

/**
 * On Import in the statements set with the bank sync linked: the export's rows on days the bank link fills are left out, and
 * the note offers to give those days to the statement file. Giving them says the import takes them, and Keep puts the offer back.
 */
export function spendingImportGiveDaysFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.revolut)
    await page.waitForSelector('[data-testid="spending-dry-run-give-days"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error("the export's rows on the bank link's days offer no way to give those days to the statement file")
    })
    await shootAt(page, shoot, '[data-testid="spending-dry-run-notes"]', 'spending-import-give-days')
    await pressSelector(page, press, '[data-testid="spending-dry-run-give-days"]')
    await page.waitForSelector('[data-testid="spending-dry-run-keep-days"]', { visible: true, timeout: 5_000 })
    await waitForTextIn(page, '[data-testid="spending-dry-run-notes"]', words.spendingStatements.import.keepSource)
    await delay(300)
    await inspect?.('the import with the days given to the statement file')
    await shootAt(page, shoot, '[data-testid="spending-dry-run"]', 'spending-import-given-days')
    await pressSelector(page, press, '[data-testid="spending-dry-run-keep-days"]')
    await page.waitForSelector('[data-testid="spending-dry-run-give-days"]', { visible: true, timeout: 5_000 })
  }
}
