/**
 * Company's flows that the visual and the touch check share: invoices, splits, a row's category and share, imports,
 * IBANs, the assistant tab and the dialogs. `press` clicks or taps an element handle, and `shoot` takes a screenshot under
 * a name. Each flow starts on its screen and leaves the workbook as it found it. A failure throws with what was missing.
 */

import { en as companyEnglish, hr as companyCroatian } from '../../src/apps/company/words.ts'
import { en as companySettingsEnglish, hr as companySettingsCroatian } from '../../src/apps/company/settings/presentation/words.ts'
import { en as invoicingDomainEnglish, hr as invoicingDomainCroatian } from '../../src/apps/company/invoicing/domain/words.ts'
import { capitalised } from '../../src/shared/text/capitalised.ts'
import { en as uiEnglish, hr as uiCroatian } from '../../src/shared/ui/words.ts'
import { en as invoicingEnglish, hr as invoicingCroatian } from '../../src/apps/company/invoicing/presentation/words.ts'
import { allowIfAsked, forgetAssist, keepAiKey, newChat, openChat, sendInChat } from './chatFlows.mjs'
import { delay, pressSelector, typeDay } from './pressing.mjs'
import {
  ALWAYS_ALLOW,
  APP_ALLOWED,
  ASSIST_WORDS,
  SCREEN_WORDS,
  TOAST,
  USE_FILE_ROW,
  choose,
  chooseBySearch,
  chooseCategory,
  countedIn,
  dialogGone,
  dismissToasts,
  dropFile,
  elementSays,
  goTo,
  goToRoute,
  lookAtDialog,
  openCard,
  pageSays,
  pickRowNamed,
  pickedCountIs,
  pressButton,
  pressLabelled,
  queueRow,
  setField,
  shootAt,
  switchSays,
  toast,
  toastMatching,
  undoIn,
} from './flowHelpers.mjs'

/** The row of an editor table whose first field reads `name`. */
/** A row named by its first field, or by the button that opens it where its name is one. */
export async function rowNamed(page, rowSelector, name) {
  return page
    .waitForFunction(
      (selector, wanted) =>
        [...document.querySelectorAll(selector)].find((row) => (row.querySelector('[data-testid="open-row"]')?.textContent?.trim() ?? row.querySelector('input')?.value) === wanted) ?? null,
      { timeout: 10_000 },
      rowSelector,
      name,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no ${rowSelector} named "${name}"`)
    })
}

export async function rowGone(page, rowSelector, name) {
  await page
    .waitForFunction(
      (selector, wanted) =>
        ![...document.querySelectorAll(selector)].some((row) => (row.querySelector('[data-testid="open-row"]')?.textContent?.trim() ?? row.querySelector('input')?.value) === wanted),
      { timeout: 10_000 },
      rowSelector,
      name,
    )
    .catch(() => {
      throw new Error(`the ${rowSelector} named "${name}" is still there`)
    })
}

export async function fieldIn(row, label) {
  const input = await row.$(`input[aria-label="${label}"], [data-slot="base"][aria-label="${label}"]`)
  if (input === null) throw new Error(`no field "${label}" in the row`)
  return input
}

function invoiceListed(page, number) {
  return page.evaluate((wanted) => [...document.querySelectorAll('[data-testid="invoice-list"] .figure')].some((element) => element.textContent?.trim() === wanted), number)
}

async function waitForInvoice(page, number, listed) {
  await page
    .waitForFunction(
      (wanted, shown) => [...document.querySelectorAll('[data-testid="invoice-list"] .figure')].some((element) => element.textContent?.trim() === wanted) === shown,
      { timeout: 10_000 },
      number,
      listed,
    )
    .catch(() => {
      throw new Error(`invoice ${number} is ${listed ? 'not' : 'still'} on the list`)
    })
}

async function dialogClosed(page) {
  await page.waitForFunction(() => !document.querySelector('[data-testid="invoice-form"]'), { timeout: 10_000 })
  await delay(300)
}

/** The texts and amounts of the invoice dialog's lines, an amount ungrouped with a dot for the decimals whatever the language shows. */
async function invoiceLines(page) {
  return page.$$eval('[data-testid="invoice-line"]', (rows) =>
    rows.map((row) => [
      row.querySelector('[data-testid="invoice-line-text"]')?.value ?? '',
      (row.querySelector('[data-testid="invoice-line-amount"]')?.value ?? '').replace(/[.,](?=\d{3}(?:[.,]|$))/g, '').replace(',', '.'),
    ]),
  )
}

/** Types a line of the invoice dialog by its place from 0. */
async function typeInvoiceLine(page, index, text, amount) {
  await setField((await page.$$('[data-testid="invoice-line-text"]'))[index], text)
  await setField((await page.$$('[data-testid="invoice-line-amount"]'))[index], amount)
}

/** The invoice lines in `form` say `sentence` under the line at `index`, counted from the end when below zero, and no problem under any other line. */
async function problemUnderLineOnly(page, form, language, index, sentence) {
  const said = language === 'en' ? invoicingEnglish.lines : invoicingCroatian.lines
  const phrases = ['blank-text', 'not-above-zero', 'separator'].map((kind) => said.problem({ kind, line: 0 }).toLowerCase())
  const lines = `${form} [data-testid="invoice-line"]`
  await page
    .waitForFunction((css, wanted) => [...document.querySelectorAll(css)].some((line) => line.textContent?.includes(wanted)), { timeout: 10_000 }, lines, sentence)
    .catch(() => {
      throw new Error(`no invoice line says "${sentence}"`)
    })
  const texts = await page.$$eval(lines, (found) => found.map((line) => (line.textContent ?? '').toLowerCase()))
  const bad = index < 0 ? texts.length + index : index
  if (!texts[bad]?.includes(sentence.toLowerCase())) throw new Error(`invoice line ${bad + 1} does not say "${sentence}"`)
  const others = texts.flatMap((text, at) => (at !== bad && phrases.some((phrase) => text.includes(phrase)) ? [at + 1] : []))
  if (others.length > 0) throw new Error(`invoice lines ${others.join(', ')} show a problem that is only on line ${bad + 1}`)
}

/**
 * The line of `lines` at `index`, counted from the end when below zero, gives each of its controls an id no other element has. While
 * `marked` is false nothing in the line is red or invalid, as before Check or Save. Once it is true every control is invalid and described
 * by the problem under the line.
 */
async function lineMarkedOnlyWhen(page, lines, index, marked) {
  const found = await page.$$eval(
    lines,
    (rows, at) => {
      const line = rows.at(at)
      if (!line) return null
      const controls = [...line.querySelectorAll('[id][aria-invalid]')]
      return {
        ids: controls.map((control) => control.id),
        shared: controls.filter((control) => document.querySelectorAll(`[id="${CSS.escape(control.id)}"]`).length > 1).map((control) => control.id),
        invalid: controls.filter((control) => control.getAttribute('aria-invalid') === 'true').length,
        described: controls.filter((control) =>
          (control.getAttribute('aria-describedby') ?? '').split(' ').some((id) => id !== '' && line.querySelector(`[id="${CSS.escape(id)}"]`)?.textContent?.trim()),
        ).length,
        red: line.querySelectorAll('[class*="ring-error"], [class*="text-error"]').length,
      }
    },
    index,
  )
  const name = `invoice line ${index < 0 ? `${-index} from the end` : index + 1}`
  if (found === null) throw new Error(`${lines} has no ${name}`)
  if (found.ids.length < 2) throw new Error(`${name} has ${found.ids.length} controls with an id and a validity, not its text and at least one more`)
  if (found.shared.length > 0) throw new Error(`${name} shares the ids ${[...new Set(found.shared)].join(', ')} between its controls or with another element`)
  if (!marked && (found.invalid > 0 || found.red > 0)) throw new Error(`${name} shows a problem before Check or Save is pressed`)
  if (marked && (found.invalid !== found.ids.length || found.described !== found.ids.length)) {
    throw new Error(`${name} marks ${found.invalid} and describes ${found.described} of its ${found.ids.length} controls by its problem`)
  }
}

/**
 * Invoices in a language: add one of two lines, with an amount of 0 on the blank second line showing nothing wrong until Save, which says
 * its problems under it alone and connects them to each of its controls by their own ids, change its
 * due date and see both lines kept, change a line, delete it, and Undo the delete.
 */
export function invoiceFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const dialog = words.receivables.dialog
  const edit = (number) => `[data-testid="invoice-edit"][aria-label="${words.receivables.list.edit(number)}"]`
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const number = 'TEST-001'
    if (await invoiceListed(page, number)) throw new Error(`${number} is on the list before the flow adds it`)
    await pressSelector(page, press, '[data-testid="invoice-add"]')
    await page.waitForSelector('[data-testid="invoice-form"]')
    await delay(400)
    await setField(await page.$('[data-testid="invoice-number"]'), number)
    await typeInvoiceLine(page, 0, 'Workshop follow-up', '1250.00')
    await pressSelector(page, press, '[data-testid="invoice-line-add"]')
    await setField((await page.$$('[data-testid="invoice-line-amount"]'))[1], '0')
    await delay(300)
    const lines = '[data-testid="invoice-form"] [data-testid="invoice-line"]'
    await lineMarkedOnlyWhen(page, lines, 1, false)
    await pressSelector(page, press, '[data-testid="invoice-save"]')
    const said = language === 'en' ? invoicingEnglish.lines : invoicingCroatian.lines
    const blankLine = [said.problem({ kind: 'blank-text', line: 1 }), said.problem({ kind: 'not-above-zero', line: 1 })].join(', ')
    await problemUnderLineOnly(page, '[data-testid="invoice-form"]', language, 1, capitalised(blankLine))
    await lineMarkedOnlyWhen(page, lines, 1, true)
    await shoot('invoice-line-problem')
    await typeInvoiceLine(page, 1, 'Workshop follow-up II', '50.00')
    await choose(page, press, await page.$('[data-testid="invoice-client"]'), 'Lumen Labs')
    await inspect?.('add an invoice')
    await shoot('invoice-add')
    await pressSelector(page, press, '[data-testid="invoice-save"]')
    await toast(page, dialog.added)
    await dialogClosed(page)
    await waitForInvoice(page, number, true)
    await shoot('invoice-added')
    await dismissToasts(page)

    await pressSelector(page, press, edit(number))
    await page.waitForSelector('[data-testid="invoice-form"]')
    await delay(400)
    await setField(await page.$('[data-testid="invoice-due"]'), '2030-01-31')
    await pressSelector(page, press, '[data-testid="invoice-save"]')
    await toast(page, dialog.saved)
    await dialogClosed(page)
    await dismissToasts(page)

    await pressSelector(page, press, edit(number))
    await page.waitForSelector('[data-testid="invoice-form"]')
    await delay(400)
    const kept = JSON.stringify(await invoiceLines(page))
    const typed = JSON.stringify([
      ['Workshop follow-up', '1250.00'],
      ['Workshop follow-up II', '50.00'],
    ])
    if (kept !== typed) throw new Error(`a due date change left the lines ${kept}, not ${typed}`)
    await typeInvoiceLine(page, 1, 'Workshop follow-up II', '100')
    await inspect?.('edit an invoice')
    await shoot('invoice-edit')
    await pressSelector(page, press, '[data-testid="invoice-save"]')
    await toast(page, dialog.saved)
    await dialogClosed(page)
    await dismissToasts(page)

    await pressSelector(page, press, edit(number))
    await page.waitForSelector('[data-testid="invoice-form"]')
    await delay(400)
    await pressSelector(page, press, '[data-testid="invoice-delete"]')
    await toast(page, dialog.deleted)
    await dialogClosed(page)
    await waitForInvoice(page, number, false)
    await undoIn(page, press, words)
    await waitForInvoice(page, number, true)
    await dismissToasts(page)
  }
}

export const invoiceFlow = invoiceFlowIn('en')

/**
 * A client payment no invoice holds, in a language: Place opens the invoice the import's rule picks with the payment ticked under
 * Paid by, whose menu lists the payments on offer, Save places it, so the card of payments to place goes, and Undo brings it back.
 */
export function placePaymentFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const dialog = words.receivables.dialog
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await shootAt(page, shoot, '[data-testid="unplaced-place"]', 'unplaced-place')
    await pressSelector(page, press, '[data-testid="unplaced-place"]')
    await page.waitForSelector('[data-testid="invoice-paid-by"]')
    await delay(400)
    await shootAt(page, shoot, '[data-testid="invoice-paid-by"]', 'invoice-paid-by', { inspected: () => inspect?.('place a payment') })
    await pressSelector(page, press, '[data-testid="invoice-paid-by"]')
    await page.waitForSelector('[role="listbox"] [role="option"]')
    await delay(300)
    await inspect?.('the payments Paid by offers')
    await shoot('invoice-paid-by-menu')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await delay(300)
    if ((await page.$('[data-testid="invoice-form"]')) === null) throw new Error('Escape on the Paid by menu closed the invoice dialog')
    await pressSelector(page, press, '[data-testid="invoice-save"]')
    await toast(page, dialog.saved)
    await dialogClosed(page)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="unplaced-payments"]') === null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the payment still waits to be placed after Save')
      })
    await shoot('unplaced-placed')
    await undoIn(page, press, words)
    await page.waitForSelector('[data-testid="unplaced-place"]', { timeout: 10_000 })
    await dismissToasts(page)
  }
}

async function waitForRunStage(page, selector) {
  await page.waitForSelector(selector, { visible: true, timeout: 20_000 }).catch(async () => {
    const said = await page.evaluate(() => document.querySelector('[data-testid="invoice-run"]')?.textContent?.replace(/\s+/g, ' ').slice(0, 400))
    throw new Error(`no ${selector} within 20 s, the dialog says: ${said}`)
  })
  await delay(300)
}

async function runFinished(page) {
  await page
    .waitForFunction(
      () => {
        const steps = [...document.querySelectorAll('[data-testid="invoice-run-steps"] li')]
        return steps.length > 0 && steps.every((step) => step.dataset.status === 'done') && document.querySelector('[data-testid="invoice-run-close"]') !== null
      },
      { timeout: 20_000 },
    )
    .catch(async () => {
      const said = await page.evaluate(() => document.querySelector('[data-testid="invoice-run-steps"]')?.textContent?.replace(/\s+/g, ' '))
      throw new Error(`the run did not finish, its steps say: ${said}`)
    })
  await delay(300)
}

/**
 * Make invoice: the form from the billing plan, the checks, and the steps. With the file on Drive the
 * fake Picker is the browser's confirm dialog: the invoice folder and the year folder are picked,
 * the month folder is not, so the flow makes it on request. A re-export then finds the folders
 * without asking. With a workbook kept in this browser the PDF is saved through the browser.
 */
/** A link such as the chat's, followed from another screen, opens a made-up invoice's re-export with its number filled in, then the flow goes back to the invoices. */
async function reexportLinkOpensFilled(page, words, shoot) {
  const number = '1-1-26'
  await goTo(page, '#/company/owner?tab=owed', words.pack.screens.owner)
  await goToRoute(page, `#/company/invoicing?tab=invoices&reexport=${encodeURIComponent(`invoice:${JSON.stringify(['northwind', number])}`)}`, '[data-testid="invoice-run-number"]')
  await waitForRunStage(page, '[data-testid="invoice-lines"]')
  const shown = await page.$eval('[data-testid="invoice-run-number"]', (input) => input.value)
  if (shown !== number) throw new Error(`the reexport link opened the run with the number "${shown}", not ${number}`)
  const lines = await page.$$('[data-testid="invoice-line"]')
  if (lines.length === 0) throw new Error('the reexport link opened the run without the invoice lines')
  await shoot('invoice-reexport-link')
  await page.keyboard.press('Escape')
  await dialogGone(page, '[data-testid="invoice-run"]')
  await goToRoute(page, '#/company/invoicing?p=all', '[data-testid="invoice-make"]')
  await delay(300)
}

/** The day a day field shows, as YYYY-MM-DD. */
function dayIn(field) {
  return field.evaluate((element) => ['year', 'month', 'day'].map((part) => element.querySelector(`[data-segment="${part}"]`)?.textContent?.trim().padStart(2, '0') ?? '').join('-'))
}

/**
 * Make an invoice shows nothing wrong, the line not red, while the last line's amount is 0 and the due date is set before the issue date,
 * then one Check says each under its own field, the amount's under that line alone and tied to each of its controls, and asks the file nothing. The line is shot in view too, since a phone
 * shows the due date first. The amount and the due date go back before the run goes on.
 */
async function fieldProblemsShowAfterCheck(page, press, language, shoot) {
  const dialog = SCREEN_WORDS[language].receivables.dialog
  const said = language === 'en' ? invoicingEnglish.lines : invoicingCroatian.lines
  const amountProblem = capitalised(said.problem({ kind: 'not-above-zero', line: 0 }))
  const form = '[data-testid="invoice-run"]'
  const amounts = await page.$$(`${form} [data-testid="invoice-line-amount"]`)
  const lastAmount = amounts.at(-1)
  const amount = await lastAmount.evaluate((input) => input.value)
  const dueField = await page.$(`${form} [data-testid="invoice-run-due"]`)
  const due = await dayIn(dueField)
  await setField(lastAmount, '0')
  await typeDay(dueField, '2020-01-02')
  await delay(300)
  const early = await page.$eval(form, (element) => element.textContent ?? '')
  if (early.includes(dialog.dueBeforeIssue) || early.includes(amountProblem)) throw new Error('Make an invoice says the due date or the lines are wrong before Check is pressed')
  await lineMarkedOnlyWhen(page, `${form} [data-testid="invoice-line"]`, -1, false)
  await pressSelector(page, press, '[data-testid="invoice-run-check"]')
  await elementSays(page, form, [dialog.dueBeforeIssue], 'one Check does not say the due date under its field')
  await problemUnderLineOnly(page, form, language, -1, amountProblem)
  await lineMarkedOnlyWhen(page, `${form} [data-testid="invoice-line"]`, -1, true)
  if ((await page.$('[data-testid="invoice-run-ready"]')) !== null) throw new Error('Make an invoice went on to its checks with a line without an amount')
  await shoot('invoice-run-field-problems')
  const lastLine = (await page.$$(`${form} [data-testid="invoice-line"]`)).at(-1)
  await shootAt(page, shoot, lastLine, 'invoice-run-line-problem')
  await setField(lastAmount, amount)
  await typeDay(dueField, due)
  await delay(300)
}

export function invoiceRunFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const answers = ['accept', 'accept', 'dismiss']
    const asked = []
    const answer = async (dialog) => {
      asked.push(dialog.message())
      if (answers.shift() === 'accept') await dialog.accept()
      else await dialog.dismiss()
    }
    page.on('dialog', answer)
    try {
      await reexportLinkOpensFilled(page, words, shoot)
      await pressSelector(page, press, '[data-testid="invoice-make"]')
      await waitForRunStage(page, '[data-testid="invoice-lines"]')
      const number = await page.$eval('[data-testid="invoice-run-number"]', (input) => input.value)
      if (number === '') throw new Error('the dialog suggests no invoice number')
      const google = (await page.$('[data-testid="invoice-run-draft"]')) !== null
      if (google) await pressSelector(page, press, '[data-testid="invoice-run-draft"]')
      await inspect?.('make an invoice')
      await shoot('invoice-run-form')
      await fieldProblemsShowAfterCheck(page, press, language, shoot)
      await pressSelector(page, press, '[data-testid="invoice-run-check"]')
      if (google) {
        await waitForRunStage(page, '[data-testid="invoice-run-hidden"]')
        await shoot('invoice-run-hidden')
        await pressSelector(page, press, '[data-testid="invoice-run-create-folder"]')
      }
      await waitForRunStage(page, '[data-testid="invoice-run-ready"]')
      await shoot('invoice-run-ready')
      await pressSelector(page, press, '[data-testid="invoice-run-make"]')
      await runFinished(page)
      await shoot('invoice-run-done')
      await pressSelector(page, press, '[data-testid="invoice-run-close"]')
      await waitForInvoice(page, number, true)
      if (!google) return

      if (asked.length !== 3) throw new Error(`the Picker opened ${asked.length} times on the first run, not 3`)
      await pressSelector(page, press, `[data-testid="invoice-edit"][aria-label="${words.receivables.list.edit(number)}"]`)
      await page.waitForSelector('[data-testid="invoice-form"]')
      await delay(400)
      await pressSelector(page, press, '[data-testid="invoice-reexport"]')
      await waitForRunStage(page, '[data-testid="invoice-lines"]')
      await shoot('invoice-reexport-lines')
      await pressSelector(page, press, '[data-testid="invoice-run-check"]')
      await waitForRunStage(page, '[data-testid="invoice-run-ready"]')
      await pressSelector(page, press, '[data-testid="invoice-run-make"]')
      await runFinished(page)
      await shoot('invoice-reexport-done')
      if (asked.length !== 3) throw new Error('the re-export opened the Picker for a folder already in view')
      await pressSelector(page, press, '[data-testid="invoice-run-close"]')
    } finally {
      page.off('dialog', answer)
    }
  }
}

export const invoiceRunFlow = invoiceRunFlowIn('en')

/** The Split action of the one row in view: in the table's last column, or inside its card on a phone once the card is open. */
async function openSplitOfRow(page, press) {
  const button = await page.$('[data-testid="split-row"]')
  const visible = button !== null && (await button.evaluate((element) => element.getBoundingClientRect().width > 0))
  if (!visible) {
    await pressSelector(page, press, '[data-testid="transaction-card"] .card-summary')
  }
  await pressSelector(page, press, '[data-testid="split-row"]')
  await page.waitForSelector('[data-testid="split-form"]')
  await delay(400)
}

async function setPart(page, index, amount) {
  const parts = await page.$$('[data-testid="split-part"]')
  const part = parts[index]
  if (part === undefined) throw new Error(`no part ${index + 1} in the split editor`)
  await setField(await part.$('[data-testid="split-part-amount"]'), amount)
  return part
}

/** The part at `index` once it takes the rest and shows `shown` of it. */
async function restIs(page, index, shown) {
  const part = (await page.$$('[data-testid="split-part"]'))[index]
  if (part === undefined) throw new Error(`no part ${index + 1} in the split editor`)
  await page
    .waitForFunction((held, wanted) => held.querySelector('[data-testid="split-rest"]')?.textContent?.includes(wanted) ?? false, { timeout: 5_000 }, part, shown)
    .catch(async () => {
      throw new Error(`part ${index + 1} does not take the rest of ${shown}, it says "${await part.evaluate((held) => held.textContent?.trim() ?? '')}"`)
    })
  return part
}

async function waitForSplit(page, present) {
  await page
    .waitForFunction((wanted) => (document.querySelector('[data-testid="edit-split"]') !== null) === wanted, { timeout: 10_000 }, present)
    .catch(() => {
      throw new Error(present ? 'the split row is not listed with its parts' : 'the split row is still listed with its parts')
    })
}

/** An amount typed the way the language writes its decimals, as in 30,00 in Croatian. */
function typedIn(words, amount) {
  return words.locale === 'en-GB' ? amount : amount.replace('.', ',')
}

/** Transactions: split the one gadget purchase in two, change the parts, delete the split, and Undo the delete. */
export function splitFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.transactions
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await waitForSplit(page, false)
    await openSplitOfRow(page, press)
    await setPart(page, 0, typedIn(words, '30.00'))
    const second = await restIs(page, 1, typedIn(words, '8.90'))
    await chooseCategory(page, press, await second.$('[data-testid="split-part-category"]'), words.categoryName('office-supplies'))
    await setField(await second.$('[data-testid="split-part-note"]'), 'Printer paper')
    await inspect?.('split a row')
    await shoot('split-add')
    await pressSelector(page, press, '[data-testid="split-save"]')
    await toast(page, countedIn(words, said.splitInParts(2), 2))
    await dialogGone(page, '[data-testid="split-form"]')
    await waitForSplit(page, true)
    await shoot('split-added')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="edit-split"]')
    await page.waitForSelector('[data-testid="split-form"]')
    await delay(400)
    await setPart(page, 0, typedIn(words, '28.90'))
    await pressSelector(page, press, '[data-testid="split-add-part"]')
    await delay(200)
    const third = await setPart(page, 2, typedIn(words, '5.00'))
    await restIs(page, 1, typedIn(words, '5.00'))
    await chooseCategory(page, press, await third.$('[data-testid="split-part-category"]'), words.categoryName('owner-loan-out'))
    await inspect?.('edit a split')
    await shoot('split-edit')
    await pressSelector(page, press, '[data-testid="split-save"]')
    await toast(page, said.splitDialog.saved)
    await dialogGone(page, '[data-testid="split-form"]')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="edit-split"]')
    await page.waitForSelector('[data-testid="split-form"]')
    await delay(400)
    await pressSelector(page, press, '[data-testid="split-delete"]')
    await toast(page, said.splitDialog.deleted)
    await dialogGone(page, '[data-testid="split-form"]')
    await waitForSplit(page, false)
    await undoIn(page, press, words)
    await waitForSplit(page, true)
    await shoot('split-undone')
    await dismissToasts(page)
  }
}

export const splitFlow = splitFlowIn('en')

/**
 * Books with two splits the guards refuse (`?fake=refused-splits`). On the design invoice the dialog says Save replaces the parts
 * that no longer add up, and the toast says the save has no Undo. On the business lunch it names the part that cannot be read, links
 * to the problem list on Settings and offers no split.
 */
export function refusedSplitFlowIn(language, kind) {
  const words = SCREEN_WORDS[language]
  const said = words.transactions
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSplitOfRow(page, press)
    if (kind === 'unreadable') {
      await page.waitForSelector('[data-testid="split-unreadable"]')
      if ((await page.$('[data-testid="split-part"], [data-testid="split-save"]')) !== null) throw new Error('the parts editor or Split shows while a stored part cannot be read')
      await shootAt(page, shoot, '[data-testid="split-unreadable"]', 'split-unreadable', { inspected: () => inspect?.('a split with a part that cannot be read') })
      return
    }
    await shootAt(page, shoot, '[data-testid="split-replaces-refused"]', 'split-refused', { inspected: () => inspect?.('a split the guards refused') })
    await setPart(page, 0, typedIn(words, '100.00'))
    const second = (await page.$$('[data-testid="split-part"]'))[1]
    await chooseCategory(page, press, await second.$('[data-testid="split-part-category"]'), words.categoryName('consulting'))
    await pressSelector(page, press, '[data-testid="split-save"]')
    await toast(page, countedIn(words, said.splitInParts(2), 2))
    await dialogGone(page, '[data-testid="split-form"]')
    await waitForSplit(page, true)
    await shoot('split-refused-saved')
    await dismissToasts(page)
  }
}

/**
 * A client payment the books place on two invoices: Split says its split stays, with Delete off, and a change that moves money
 * between its parts is refused on Save, naming both invoices, with nothing written.
 */
export function placedSplitFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const words = SCREEN_WORDS[language]
    await pressSelector(page, press, '[data-testid="edit-split"]')
    await page.waitForSelector('[data-testid="split-form"]')
    await elementSays(page, '[data-testid="split-delete-refused"]', ['3\u20111\u201126', '4\u20111\u201126'], 'Split does not say the payment pays two invoices')
    if (!(await page.$eval('[data-testid="split-delete"]', (button) => button.disabled))) throw new Error('Delete stays on for a split that pays two invoices')
    await shootAt(page, shoot, '[data-testid="split-delete-refused"]', 'split-placed', { inspected: () => inspect?.('a split that pays two invoices') })
    await setPart(page, 0, typedIn(words, '2000.00'))
    await pressSelector(page, press, '[data-testid="split-save"]')
    await elementSays(page, '[data-testid="split-refusal"]', ['3\u20111\u201126', '4\u20111\u201126'], 'Save does not refuse a split that moves money between two invoices')
    await shootAt(page, shoot, '[data-testid="split-refusal"]', 'split-placed-refused')
    if ((await page.$('[data-testid="split-form"]')) === null) throw new Error('the refused split closed its dialog')
  }
}

/**
 * The same client payment, whose two parts are both revenue: a part's Change category opens on the whole payment, which a refile
 * takes off both invoices, rather than the split editor.
 */
export function placedRefileFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="edit-split"]', { timeout: 10_000 })
    // The payment's parts come after the day's other Northwind row, so its part's Change category is the last one shown.
    const shown = async () => {
      const buttons = await page.$$('[data-testid="change-category-row"]')
      const visible = await Promise.all(buttons.map((button) => button.evaluate((element) => element.getBoundingClientRect().width > 0)))
      return buttons.filter((_, index) => visible[index])
    }
    if ((await shown()).length === 0) await press(await page.$('[data-testid="transaction-card"].part .card-summary'))
    await press((await shown()).at(-1))
    await page.waitForSelector('[data-testid="change-category"]')
    await elementSays(page, '[data-testid="change-category"]', [language === 'en' ? '6,834.43' : '6.834,43'], 'Change category does not open on the whole payment')
    if ((await page.$('[data-testid="split-form"]')) !== null) throw new Error('a part of a payment in one category opened the split editor')
    await delay(400)
    await inspect?.('Change category on a payment placed on two invoices')
    await shoot('change-category-placed')
  }
}

/**
 * Books from before items and from before every ledger row had an id (`?fake=no-row-ids`): Overview's Waiting for you offers the
 * update in the notice's own words in place of counting the rows without an id, and its link opens Settings, Books file, which offers
 * the move to items in place of the prompt for ids, since the move gives every row its id. The move is one write, Undo takes it back and the offer returns. Moved again, a split row on Transactions still shows
 * its parts.
 */
export function rowIdsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.books.itemsMove
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const notice = '[data-testid="company-items-move"]'
    const waiting = '[data-testid="waiting-for-you"] [data-job="items-move"]'
    await page.waitForSelector(`${waiting} a`, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Waiting for you does not offer to update books from before items')
    })
    if ((await page.$('[data-testid="waiting-for-you"] [data-job="row-ids"]')) !== null) throw new Error('Waiting for you counts rows without an id beside the update, which gives them')
    await elementSays(page, waiting, [said.title, said.action], 'Waiting for you offers the update in other words than the notice')
    await shoot('row-ids-waiting')
    await pressSelector(page, press, `${waiting} a`)
    await page.waitForSelector(notice, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Settings, Books file does not offer to move books from before items')
    })
    if ((await page.$('[data-testid="row-ids-notice"]')) !== null) throw new Error('Settings, Books file offers ids beside the move, which gives them')
    await inspect?.('the move to items')
    await shoot('items-move-offer')
    await pressButton(page, press, `${notice} button`, said.action)
    await toast(page, said.moved)
    await page.waitForSelector(notice, { hidden: true, timeout: 10_000 }).catch(() => {
      throw new Error('the offer to move stays once the books keep items')
    })
    if ((await page.$('[data-testid="row-ids-notice"]')) !== null) throw new Error('rows are left without an id once the books moved')
    await shoot('items-move-done')
    await undoIn(page, press, words)
    await page.waitForSelector(notice, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Undo does not bring the offer to move back')
    })
    await dismissToasts(page)
    await pressButton(page, press, `${notice} button`, said.action)
    await toast(page, said.moved)
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/company/transactions?p=all&q=BISTRO'
    })
    await waitForSplit(page, true)
    await shoot('items-move-split-kept')
  }
}

/**
 * Books from before items with splits the guards refuse (`?fake=refused-splits`): Settings, Books file names what to fix, the parts of
 * one row in one line that counts them, and offers no move.
 */
export function itemsMoveBlockedFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const blocked = '[data-testid="company-items-move-blocked"]'
    await page.waitForSelector(blocked, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Settings, Books file does not say what keeps the books from moving to items')
    })
    const lines = await page.$$eval(`${blocked} li`, (items) => items.map((item) => ({ text: item.textContent ?? '', count: Number(item.dataset.count) })))
    if (lines.length === 0) throw new Error('the move names no blocker')
    if (new Set(lines.map((line) => line.text)).size !== lines.length) throw new Error(`the blocked notice says one line twice: ${lines.map((line) => line.text).join(' | ')}`)
    const counted = lines.reduce((sum, line) => sum + line.count, 0)
    if ((await page.$('[data-testid="company-items-move"]')) !== null) throw new Error('the move is offered beside what keeps it off')
    const title = await page.$eval(`${blocked} [data-slot="title"]`, (node) => node.textContent ?? '')
    if (!title.includes(String(counted))) throw new Error(`the blocked notice counts other than the ${counted} blockers it lists: ${title}`)
    if (!(await page.$eval(blocked, (node) => node.textContent ?? '')).includes(words.books.itemsMove.blockedFix)) throw new Error('the blocked notice says nothing of how to fix it')
    await inspect?.('what keeps the move to items off')
    await shoot('items-move-blocked')
  }
}

export const rowIdsFlow = rowIdsFlowIn('en')

/**
 * The Change category action of the first row in view, or with `words` of the first part of a split
 * row: in the table's last column, or inside its card on a phone once the card is open.
 */
export async function openChangeOfRow(page, press, words = null) {
  // The label around the row's counterparty, which differs per row.
  const [before, after] = words === null ? [] : words.transactions.changeCategoryOf(words.transactions.partName(1, '\u0000')).split('\u0000')
  const button = words === null ? '[data-testid="change-category-row"]' : `[data-testid="change-category-row"][aria-label^="${before}"]${after === '' ? '' : `[aria-label$="${after}"]`}`
  const card = words === null ? '[data-testid="transaction-card"]' : '[data-testid="transaction-card"].part'
  const found = await page.waitForSelector(`${button}, ${card}`, { timeout: 10_000 })
  const visible = await found.evaluate((element, wanted) => element.matches(wanted) && element.getBoundingClientRect().width > 0, button)
  if (!visible) {
    await pressSelector(page, press, `${card} .card-summary`)
    await pressSelector(page, press, `${card} [data-testid="change-category-row"]`)
  } else {
    await pressSelector(page, press, button)
  }
}

/**
 * Transactions: the newest code host plan, which a rule files as a software subscription, filed as
 * office supplies with the rule named first, then undone. A part of a split row opens the split
 * editor instead, since the splits tab holds its category.
 */
export function changeCategoryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const officeSupplies = words.categoryName('office-supplies')
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pageSays(page, officeSupplies, false)
    await openChangeOfRow(page, press)
    await page.waitForSelector('[data-testid="change-category"]')
    await delay(400)
    await chooseCategory(page, press, await page.$('[data-testid="change-category-picker"]'), officeSupplies)
    await page.waitForSelector('[data-testid="rule-against"]', { timeout: 5_000 }).catch(() => {
      throw new Error('the dialog does not name the rule that files the row elsewhere')
    })
    await inspect?.('change a category')
    await shoot('change-category')
    await pressSelector(page, press, '[data-testid="change-category-save"]')
    await toast(page, words.transactions.changeDialog.filedAs(officeSupplies))
    await dialogGone(page, '[data-testid="change-category"]')
    await pageSays(page, officeSupplies, true)
    await shoot('change-category-filed')
    await undoIn(page, press, words)
    await pageSays(page, officeSupplies, false)
    await dismissToasts(page)

    await page.evaluate(() => {
      window.location.hash = '#/company/transactions?p=all&q=INK%20STORE'
    })
    await waitForSplit(page, true)
    await openChangeOfRow(page, press, words)
    await page.waitForSelector('[data-testid="split-form"]', { timeout: 5_000 }).catch(() => {
      throw new Error('Change category on a part of a split row did not open the split editor')
    })
    await delay(400)
    await shoot('change-category-part')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="split-form"]')
  }
}

export const changeCategoryFlow = changeCategoryFlowIn('en')

/**
 * Opens the Owner share dialog of the shared row in view: from the pencil on its heading, or from
 * its first part, in the table's last column or inside the part's card on a phone.
 */
async function openShareOfRow(page, press, from = 'heading') {
  if (from === 'heading') {
    await pressSelector(page, press, '[data-testid="edit-owner-share"]')
  } else {
    await page.waitForSelector('[data-testid="owner-share-row"], [data-testid="transaction-card"].part', { timeout: 10_000 })
    const visible = await page.evaluate(() => [...document.querySelectorAll('[data-testid="owner-share-row"]')].some((element) => element.getBoundingClientRect().width > 0))
    if (!visible) {
      await pressSelector(page, press, '[data-testid="transaction-card"].part .card-summary')
    }
    await pressSelector(page, press, '[data-testid="owner-share-row"]')
  }
  await page.waitForSelector('[data-testid="owner-share"]', { visible: true })
  await delay(400)
}

async function shareTyped(page) {
  return page.$eval('[data-testid="owner-share-input"]', (input) => input.value)
}

/** Reopens the dialog from the row's first part and checks it starts on the share of the row as booked, then closes it. */
async function shareReads(page, press, wanted) {
  await openShareOfRow(page, press, 'part')
  const typed = await shareTyped(page)
  if (typed !== wanted) throw new Error(`the Owner share dialog starts on "${typed}", not "${wanted}"`)
  await page.keyboard.press('Escape')
  await dialogGone(page, '[data-testid="owner-share"]')
}

/** An amount in euros as the language writes it, with the spaces read as plain ones. */
export function eurosIn(words, amount) {
  return new Intl.NumberFormat(words.locale, { style: 'currency', currency: 'EUR' }).format(amount).replace(/\s+/g, ' ')
}

/**
 * Transactions: the laptop, which holds a 30% share of its own and so heads its two parts, changed
 * to 45% from its heading with the company's and the owner's parts shown, then undone, and cleared
 * through its category's default, which is none, then undone. Each Undo is checked from a part.
 */
export function ownerShareFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const dialog = words.ownerShare.shareDialog
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openShareOfRow(page, press)
    if ((await shareTyped(page)) !== '30') throw new Error(`the laptop's share reads "${await shareTyped(page)}", not 30`)
    await setField(await page.$('[data-testid="owner-share-input"]'), '45')
    const split = [`${dialog.companyKeeps} ${eurosIn(words, 1044.45)}`, `${dialog.youTake} ${eurosIn(words, 854.55)}`]
    await page
      .waitForFunction((wanted) => wanted.every((part) => document.querySelector('[data-testid="owner-share-split"]')?.innerText.replace(/\s+/g, ' ').includes(part)), { timeout: 5_000 }, split)
      .catch(async () => {
        const said = await page.$eval('[data-testid="owner-share-split"]', (element) => element.innerText.replace(/\s+/g, ' ').trim())
        throw new Error(`45% of the laptop's 1,899.00 reads "${said}", not ${split.join(' and ')}`)
      })
    await elementSays(page, '[role="dialog"]', [dialog.title, dialog.share], 'the Owner share dialog is not in its language')
    await inspect?.('owner share')
    await shoot('owner-share')
    await pressSelector(page, press, '[data-testid="owner-share-save"]')
    await toast(page, dialog.setTo(45))
    await dialogGone(page, '[data-testid="owner-share"]')
    await undoIn(page, press, words)
    await dismissToasts(page)
    await shareReads(page, press, '30')

    await openShareOfRow(page, press)
    await pressSelector(page, press, '[data-testid="owner-share-default"]')
    if ((await shareTyped(page)) !== '') throw new Error('the default of Equipment, which has none, did not clear the share')
    await shoot('owner-share-clear')
    await pressSelector(page, press, '[data-testid="owner-share-save"]')
    await toast(page, dialog.cleared)
    await dialogGone(page, '[data-testid="owner-share"]')
    await undoIn(page, press, words)
    await dismissToasts(page)
    await shareReads(page, press, '30')
  }
}

export const ownerShareFlow = ownerShareFlowIn('en')

/**
 * Sorting, Categories: a 40% default on software subscriptions, saved with the fill offer, which
 * fills the bank rows without a share and leaves the design tool advance's 25%, then undone whole.
 */
export function shareFillFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const row = await rowNamed(page, '[data-testid="category-row"]', 'software-subscriptions')
    await setField(await fieldIn(row, words.settings.categories.shareLabel), '40')
    await delay(200)
    await shoot('share-fill-draft')
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await page.waitForSelector('[data-testid="share-fill"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('a new default did not offer to fill the rows without a share')
    })
    await delay(400)
    await elementSays(page, '[role="dialog"]', [words.ownerShare.fillDialog.title, words.ownerShare.fillDialog.keepTheirs], 'the fill offer is not in its language')
    const offer = await page.$eval('[data-testid="share-fill"]', (element) => element.innerText.replace(/\s+/g, ' ').trim())
    const count = /40 ?% (\d+) /.exec(offer)?.[1]
    if (count === undefined || !offer.includes(countedIn(words, words.ownerShare.fillDialog.rows(Number(count)), Number(count)))) throw new Error(`the fill offer says "${offer}"`)
    const rows = Number(count)
    await inspect?.('share fill')
    await shoot('share-fill')
    await pressSelector(page, press, '[data-testid="share-fill-save"]')
    await toast(page, words.settings.categories.saved)
    const said = await page.$eval(`${TOAST} [data-slot="description"]`, (element) => element.textContent?.trim() ?? '')
    const filled = countedIn(words, words.settings.categories.filled(rows), rows)
    if (said !== filled) throw new Error(`the save says "${said}" after filling ${rows} rows, not "${filled}"`)
    await dialogGone(page, '[data-testid="share-fill"]')
    await undoIn(page, press, words)
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('[data-testid="category-row"]')]
            .find((element) => element.querySelector('input')?.value === 'software-subscriptions')
            ?.querySelector('[data-testid="category-owner-share"]')?.value === '',
        { timeout: 10_000 },
      )
      .catch(() => {
        throw new Error('Undo did not take the default off software subscriptions')
      })
    await dismissToasts(page)
  }
}

export const shareFillFlow = shareFillFlowIn('en')

async function dryRunSays(page, text) {
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="dry-run-summary"]')?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, text)
    .catch(async () => {
      const said = await page.evaluate(() => document.querySelector('[data-testid="dry-run-summary"]')?.textContent?.trim())
      throw new Error(`the dry run does not say "${text}", it says: ${said ?? 'nothing'}`)
    })
  await delay(300)
}

/** After a confirmed import, the dry run says how many new rows wait for review, and says nothing once Undo took them out. */
async function waitingOnReview(page, shown) {
  await page
    .waitForFunction((wanted) => (document.querySelector('[data-testid="import-waiting"]') !== null) === wanted, { timeout: 10_000 }, shown)
    .catch(() => {
      throw new Error(shown ? 'the confirmed import does not say how many new rows wait for review' : 'the notice about the new rows stayed after Undo')
    })
}

/**
 * Import: drop the sample camt.053 statement, read the dry run, confirm, find every row on the ledger, and Undo. A flow that runs
 * it on other books names its shots with its own `shots` prefix.
 */
export function importCamtFlowIn(language, path, shots = 'import-camt') {
  const words = SCREEN_WORDS[language]
  const panel = words.imports.panel
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const addsFour = countedIn(words, panel.addsRows(4), 4)
    await dropFile(page, path)
    await dryRunSays(page, addsFour)
    if ((await page.$$('[data-testid="dry-run-row"]')).length !== 4) throw new Error('the dry run does not list the four entries')
    await elementSays(page, '[data-testid="dry-run-pays-invoice"]', ['10\u20111\u201126'], 'the dry run does not say which invoice the client payment pays')
    await inspect?.('the camt dry run')
    await shoot(`${shots}-dry-run`)
    await shootAt(page, shoot, '[data-testid="dry-run-pays-invoice"]', `${shots}-pays-invoice`)
    await pressSelector(page, press, '[data-testid="import-confirm"]')
    await toastCounted(page, (count) => words.importWrites.imported([], count))
    await dryRunSays(page, panel.writesNothing)
    await dryRunSays(page, countedIn(words, panel.inLedger(4), 4))
    await waitingOnReview(page, true)
    await shoot(`${shots}-confirmed`)
    await undoIn(page, press, words)
    await dryRunSays(page, addsFour)
    await waitingOnReview(page, false)
    await shoot(`${shots}-undone`)
    await dismissToasts(page)
  }
}

export const importCamtFlow = (path) => importCamtFlowIn('en', path)

/**
 * Import a payment to the owner in books with a cost the owner paid that nothing has paid back yet: the dry run says the payment
 * pays that cost back, and the import writes it.
 */
export function importRepaymentFlowIn(language, path) {
  const words = SCREEN_WORDS[language]
  const panel = words.imports.panel
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropFile(page, path)
    await dryRunSays(page, countedIn(words, panel.addsRows(1), 1))
    await elementSays(page, '[data-testid="dry-run-pays-back"]', ['Taxi to the client'], 'the dry run does not say which cost the payment pays back')
    await shootAt(page, shoot, '[data-testid="dry-run-pays-back"]', 'import-repayment-dry-run')
    await pressSelector(page, press, '[data-testid="import-confirm"]')
    await toastCounted(page, (count) => words.importWrites.imported([], count))
    await dryRunSays(page, panel.writesNothing)
    await dismissToasts(page)
  }
}

/**
 * Import with a ledger row the AI copied a day before the sample camt statement's client payment: the dry run holds that payment
 * until the person answers, asks about it above the rows, and adds the other three entries. Use the file's row makes the payment take
 * the copied row's place, so four entries go in. Nothing is confirmed.
 */
export function importCamtLookAlikeFlowIn(language, path) {
  const words = SCREEN_WORDS[language]
  const panel = words.imports.panel
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropFile(page, path)
    await dryRunSays(page, countedIn(words, panel.addsRows(3), 3))
    await elementSays(page, '[data-testid="dry-run-row"]', [words.imports.statement.waitsForAnswer], 'the payment does not say it waits for an answer')
    await elementSays(page, '[data-testid="question"]', ['NORTHWIND ANALYTICS'], 'the question does not name the copied row the payment looks like')
    await shootAt(page, shoot, '[data-testid="questions"]', 'import-camt-lookalike')
    await pressSelector(page, press, `[data-testid="question-choice"] ${USE_FILE_ROW}`)
    await dryRunSays(page, countedIn(words, panel.addsRows(4), 4))
    await elementSays(page, '[data-testid="dry-run-row"]', [words.imports.statement.replacesCopied], "the payment does not say it takes the copied row's place")
    await shootAt(page, shoot, '[data-testid="questions"]', 'import-camt-lookalike-replaced')
  }
}

/** The dry run refuses the sample bank export, since the bank's statements fill the fake books' main account and a sheet goes on no such account. */
async function sheetRefused(page) {
  await page.waitForSelector('[data-testid="dry-run-refusal"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error("the dry run takes a sheet onto an account the bank's statements fill")
  })
  await delay(300)
}

/** The name a flow gives the recipe it writes, in the language on screen. */
const RECIPE_NAMES = { en: 'Example banka export', hr: 'Izvoz Primjer banke' }

/** Opens the recipe dialog for a new recipe of the file on Import, gives it a name and returns once it shows. */
async function writeRecipe(page, press, name) {
  await pressSelector(page, press, '[data-testid="recipe-write"]')
  const input = await page
    .waitForSelector('[data-testid="recipe-dialog"] [data-testid="recipe-name"] input, [data-testid="recipe-dialog"] input[data-testid="recipe-name"]', { visible: true, timeout: 10_000 })
    .catch(() => {
      throw new Error('no recipe dialog for an export no saved recipe fits')
    })
  await setField(input, name)
  await delay(300)
}

/** Import: drop the sample bank export, write and save a recipe from the guess, see the dry run refuse it onto main, and delete the recipe. */
export function importTableFlowIn(language, path) {
  const words = SCREEN_WORDS[language]
  const recipe = words.imports.recipe
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropFile(page, path)
    await writeRecipe(page, press, RECIPE_NAMES[language])
    await inspect?.('the new recipe')
    await shoot('import-recipe')
    await pressSelector(page, press, '[data-testid="recipe-save"]')
    await toast(page, recipe.saved)
    await inspect?.('the recipe saved')
    await dismissToasts(page)
    await page.waitForSelector('[data-testid="recipe-reads-into"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the saved recipe is not the one picked')
    })
    await sheetRefused(page)
    await shoot('import-table-dry-run')

    await pressSelector(page, press, '[data-testid="recipe-edit"]')
    await pressSelector(page, press, '[data-testid="recipe-delete"]')
    await toast(page, recipe.deleted)
    await inspect?.('the recipe deleted')
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="recipe-reads-into"]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('the deleted recipe is still the one picked')
      })
    if (await page.$('[data-testid="recipe-choice"]')) throw new Error('the saved recipe menu stayed after its only recipe was deleted')
    await dismissToasts(page)
  }
}

export const importTableFlow = (path) => importTableFlowIn('en', path)

/**
 * The Import tab in a language: the sample camt.053 statement's dry run, confirmed with the rows
 * that wait for review said and undone, then the sample bank export with a recipe guessed from it
 * in its dialog, the recipe left unsaved.
 */
export function importFlowIn(language, paths) {
  const words = SCREEN_WORDS[language]
  const panel = words.imports.panel
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const addsFour = countedIn(words, panel.addsRows(4), 4)
    await dropFile(page, paths.camt)
    await dryRunSays(page, addsFour)
    await inspect?.('the camt dry run')
    await shoot('import-files-camt-dry-run')
    await pressSelector(page, press, '[data-testid="import-confirm"]')
    await dryRunSays(page, panel.writesNothing)
    await page.waitForSelector('[data-testid="import-waiting"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the confirmed import does not say how many new rows wait for review')
    })
    await delay(300)
    await shoot('import-files-camt-confirmed')
    await undoIn(page, press, words)
    await dryRunSays(page, addsFour)

    await dropFile(page, paths.table)
    await writeRecipe(page, press, RECIPE_NAMES[language])
    await elementSays(page, '[role="dialog"]', [words.imports.recipe.addTitle, words.imports.recipe.save], 'the recipe dialog is not in its language')
    await inspect?.('the guessed recipe')
    await shoot('import-files-recipe')
  }
}

/** Waits for a toast whose title matches the pattern, which must be the only one, since earlier ones were dismissed. Returns its text. */
/**
 * Waits for a toast that reads as `sentence` does for a count the flow cannot know ahead, such as the
 * rows of a statement: it starts with the words `sentence` gives every count and names a number.
 * Node picks plural forms by English rules, so the words are the ones 1 and 1000 share.
 */
export async function toastCounted(page, sentence) {
  const one = sentence(1)
  const many = sentence(1000)
  let shared = 0
  while (shared < one.length && one[shared] === many[shared]) shared += 1
  const start = one.slice(0, shared).replace(/\d+$/, '')
  const deadline = Date.now() + 10_000
  let titles = []
  while (Date.now() < deadline) {
    titles = await page.$$eval(`${TOAST} [data-slot="title"]`, (elements) => elements.map((element) => element.textContent?.trim() ?? ''))
    if (titles.some((title) => title.startsWith(start) && /\d/.test(title.slice(start.length)))) {
      await delay(600)
      return
    }
    await delay(200)
  }
  throw new Error(`no toast starting "${start}" and naming a count within 10 s, the toasts say: ${titles.join(' | ') || 'nothing'}`)
}

/** Transactions, To review: open the gadget purchase in the queue, then split it, edit and delete the split and Undo, as on Transactions. */
export function reviewSplitFlowIn(language) {
  const split = splitFlowIn(language)
  return async (page, context) => {
    const summary = await page
      .waitForFunction(() => [...document.querySelectorAll('[data-testid="review-row"] > button')].find((button) => button.textContent?.includes('GADGET CORNER')) ?? null, { timeout: 10_000 })
      .then((handle) => handle.asElement())
      .catch(() => {
        throw new Error('the queue does not hold the gadget purchase')
      })
    await summary.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await context.press(summary)
    await page.waitForSelector('[data-testid="review-details"]')
    await split(page, { ...context, shoot: (name) => context.shoot(`review-${name}`) })
  }
}

export const reviewSplitFlow = reviewSplitFlowIn('en')

/** The Save settings button once it is enabled or disabled, as `enabled` asks. */
export async function saveSettingsButton(page, enabled, words = SCREEN_WORDS.en) {
  return page
    .waitForFunction(
      (wanted, label) => [...document.querySelectorAll('button[type="submit"]')].find((button) => button.textContent?.trim() === label && button.disabled === !wanted) ?? null,
      { timeout: 10_000 },
      enabled,
      words.settings.general.save,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`Save settings did not become ${enabled ? 'enabled' : 'disabled'}`)
    })
}

const FACT_ROW = '[data-testid="fact-row"]'
const CARD_IBANS = '[data-testid="card-settlement-ibans"]'
const NEW_IBAN = 'GB82WEST12345698765432'

/** The tags an IBAN field under this selector shows, as their text. */
function tagsIn(page, selector) {
  return page.$$eval(`${selector} [data-slot="item"]`, (items) => items.map((item) => item.textContent?.trim() ?? ''))
}

async function waitForTags(page, selector, wanted, when) {
  await page
    .waitForFunction(
      (scope, tags) => JSON.stringify([...document.querySelectorAll(`${scope} [data-slot="item"]`)].map((item) => item.textContent?.trim() ?? '')) === JSON.stringify(tags),
      { timeout: 5_000 },
      selector,
      wanted,
    )
    .catch(async () => {
      throw new Error(`${when}: the IBAN field shows ${JSON.stringify(await tagsIn(page, selector))}, not ${JSON.stringify(wanted)}`)
    })
}

/** Presses the remove button of the last tag of the IBAN field under this selector. */
async function removeLastTag(page, press, selector) {
  const buttons = await page.$$(`${selector} [data-slot="itemDelete"]`)
  const last = buttons.at(-1)
  if (last === undefined) throw new Error(`the IBAN field under ${selector} has no tag to remove`)
  await last.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(last)
}

/** Types into an IBAN field the way a person does: a press on the field, the IBAN with its grouping spaces, and a comma that makes it a tag. */
async function typeIban(page, press, input, text) {
  await input.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(input)
  await page.keyboard.type(`${text},`)
}

/**
 * On Invoicing, Clients a client's IBANs are tags. A second IBAN typed with its spaces becomes a tag
 * without them, Save writes it with Undo, and Undo takes it off again. A tag's remove button takes a
 * new IBAN off before a save, which leaves nothing to save.
 */
export function clientIbansFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const position = await (await rowNamed(page, FACT_ROW, 'lumen')).evaluate((row) => [...row.parentElement.children].indexOf(row) + 1)
    const lumen = `${FACT_ROW}:nth-child(${position})`
    const before = await tagsIn(page, lumen)
    if (before.length !== 1) throw new Error(`the fake client lumen shows ${before.length} IBANs, not one`)
    const input = async () => fieldIn(await rowNamed(page, FACT_ROW, 'lumen'), words.clientColumns.iban)

    await typeIban(page, press, await input(), 'GB82 WEST 1234 5698 7654 32')
    await waitForTags(page, lumen, [...before, NEW_IBAN], 'a typed IBAN')
    await inspect?.('a client with a second IBAN')
    await shoot('client-ibans-added')
    await pressSelector(page, press, '[data-testid="save-rows"]:not([disabled])')
    await toast(page, words.invoicing.clients.saved)
    await waitForTags(page, lumen, [...before, NEW_IBAN], 'after the save')
    await undoIn(page, press, words)
    await waitForTags(page, lumen, before, 'after Undo')
    await dismissToasts(page)

    await typeIban(page, press, await input(), NEW_IBAN)
    await waitForTags(page, lumen, [...before, NEW_IBAN], 'a typed IBAN again')
    await removeLastTag(page, press, lumen)
    await waitForTags(page, lumen, before, 'after its remove button')
    await page.waitForSelector('[data-testid="save-rows"][disabled]', { timeout: 5_000 }).catch(() => {
      throw new Error('Save is still on after the new IBAN was taken off')
    })
  }
}

export const clientIbansFlow = clientIbansFlowIn('en')

/**
 * On Settings, General the card settlement IBANs are the same tags field. A tag that is not an IBAN
 * is said under the field and keeps Save off until its remove button takes it off. A valid one is
 * saved, then taken off and saved again, since settings keep no Undo.
 */
export function cardSettlementIbansFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const input = () =>
      page.waitForSelector(`${CARD_IBANS} input`, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('Settings, General has no card settlement IBANs field')
      })
    const before = await tagsIn(page, CARD_IBANS)
    const refusal = words.settingsReasons.settings.notIbans(['XX00NOTANIBAN'])

    await typeIban(page, press, await input(), 'GB82 WEST 1234 5698 7654 32')
    await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN], 'a typed IBAN')
    await typeIban(page, press, await input(), 'XX00 NOT AN IBAN')
    await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN, 'XX00NOTANIBAN'], 'an entry that is not an IBAN')
    await page
      .waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted), { timeout: 5_000 }, CARD_IBANS, refusal)
      .catch(() => {
        throw new Error(`the field does not say ${refusal}`)
      })
    await saveSettingsButton(page, false, words)
    await inspect?.('card settlement IBANs with one that is not an IBAN')
    await shoot('card-ibans-invalid')
    await removeLastTag(page, press, CARD_IBANS)
    await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN], 'after its remove button')

    await press(await saveSettingsButton(page, true, words))
    await toast(page, words.settings.saved)
    await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN], 'after the save')
    await dismissToasts(page)
    await removeLastTag(page, press, CARD_IBANS)
    await waitForTags(page, CARD_IBANS, before, 'after the saved IBAN was taken off')
    await press(await saveSettingsButton(page, true, words))
    await toast(page, words.settings.saved)
    await dismissToasts(page)
  }
}

export const cardSettlementIbansFlow = cardSettlementIbansFlowIn('en')

export const RULE_ROW = '[data-testid="rule-row"]'
/** The Rules card's Show all while it shows only its first ten rules. Each wait below presses it, so a rule further down is on the page. */
export const EVERY_RULE = '[data-testid="company-rules"] [data-testid="show-all"][aria-expanded="false"]'

/** The rules tab's row of this rule, by its id. */
export async function ruleRowOf(page, id) {
  return page
    .waitForFunction(
      (selector, everyRule, wanted) => {
        document.querySelector(everyRule)?.click()
        return [...document.querySelectorAll(selector)].find((row) => row.querySelector('.identifier')?.textContent?.trim() === wanted) ?? null
      },
      { timeout: 10_000 },
      RULE_ROW,
      EVERY_RULE,
      id,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`the rules tab has no rule ${id}`)
    })
}

export async function editRule(page, press, id) {
  const row = await ruleRowOf(page, id)
  const edit = await row.$('[data-testid="edit-rule"]')
  await edit.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(edit)
  await page.waitForSelector('[role="dialog"] [data-testid="rule-editor"]', { visible: true, timeout: 10_000 })
  await delay(300)
}

/** Opens the filter sheet of a phone, shoots it under `name` and closes it. A wider screen keeps its filters in a bar and has no sheet. */
async function lookAtSheet(page, press, shoot, opener, name) {
  const button = await page.$(opener)
  if (button === null || !(await button.evaluate((element) => element.getBoundingClientRect().width > 0))) return
  await press(button)
  await page.waitForSelector('[role="dialog"]', { visible: true, timeout: 10_000 })
  await delay(400)
  await shoot(name)
  await page.keyboard.press('Escape')
  await dialogGone(page, '[role="dialog"]')
}

/**
 * The dialogs and sheets of Transactions, its To review tab and Sorting, Categories, opened and closed
 * again: a payment's split, a settled row's change of category with the rule it contradicts named,
 * the laptop's owner share, the filter sheets of a phone, a rule's editor, switching a rule off
 * with its back-test, and a row of the To review queue opened.
 */
export function rowsDialogsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSplitOfRow(page, press)
    await elementSays(page, '[role="dialog"]', [words.transactions.splitDialog.addTitle, words.splitEditor.addPart], 'the split dialog is not in its language')
    await shoot('dialog-split')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="split-form"]')
    await lookAtSheet(page, press, shoot, '[data-testid="open-filters"]', 'sheet-transaction-filters')

    await goTo(page, '#/company/transactions?p=all', words.transactions.title)
    for (const grouping of ['category', 'month']) {
      await choose(page, press, await page.$(`button[aria-label="${words.transactions.groupLabel}"]`), words.transactions.groupings[grouping])
      await page.waitForSelector('[data-testid="group-toggle"]', { visible: true, timeout: 10_000 })
      await shoot(`transactions-by-${grouping}`)
    }

    await goTo(page, '#/company/transactions?p=all&q=CODE%20HOST', words.transactions.title)
    await openChangeOfRow(page, press)
    await page.waitForSelector('[data-testid="change-category"]', { visible: true })
    await delay(400)
    await chooseCategory(page, press, await page.$('[data-testid="change-category-picker"]'), words.categoryName('office-supplies'))
    await page.waitForSelector('[data-testid="rule-against"]', { timeout: 5_000 }).catch(() => {
      throw new Error('the dialog does not name the rule that files the row elsewhere')
    })
    await elementSays(page, '[role="dialog"]', [words.transactions.changeDialog.title, words.transactions.changeDialog.ruleAgainst.before], 'the change of category is not in its language')
    await shoot('dialog-change-category')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="change-category"]')

    await goTo(page, '#/company/transactions?p=all&q=purchase%2C%20laptop', words.transactions.title)
    await openShareOfRow(page, press)
    await shoot('dialog-owner-share')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="owner-share"]')

    await goTo(page, '#/company/sorting#rules', words.companySorting)
    await editRule(page, press, 'merchant-airline')
    await elementSays(page, '[role="dialog"]', [words.rules.form.conditions, words.rules.editor.backtest], 'the rule editor is not in its language')
    await shoot('dialog-rule-editor')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[role="dialog"] [data-testid="rule-editor"]')
    const row = await ruleRowOf(page, 'merchant-airline')
    const toggle = await row.$('[role="switch"]')
    await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(toggle)
    await page.waitForSelector('[data-testid="save-rules-change"]', { visible: true, timeout: 10_000 })
    await elementSays(page, '[role="dialog"]', [words.rules.tab.switchOff], 'switching a rule off is not in its language')
    await delay(400)
    await shoot('dialog-rule-switch')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="save-rules-change"]')

    // The period in the address sets every filter afresh, so the laptop search from Transactions no longer narrows the queue.
    await goTo(page, '#/company/transactions?tab=review&p=l12', words.transactions.title)
    await pressSelector(page, press, '[data-testid="review-row"] button[aria-expanded]')
    await elementSays(page, '[data-testid="review-details"]', [words.transactions.review.item.rulesSay], 'the row of the queue is not in its language')
    await shoot('review-row-open')
    await lookAtSheet(page, press, shoot, '[data-testid="open-filters"]', 'sheet-review-filters')

    await goTo(page, '#/company/sorting#categories', words.companySorting)
    await lookAtSheet(page, press, shoot, '[data-testid="open-category-filters"]', 'sheet-category-filters')
  }
}

/**
 * Invoicing's dialogs in a language, opened and closed again: a new invoice and a recorded one,
 * the invoice run's form, and on the Plan tab a new plan row, a recorded one and the fill of the year.
 */
export function invoicingDialogsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-add"]', '[data-testid="invoice-form"]', 'dialog-invoice', words.receivables.dialog.workFrom)
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-edit"]', '[data-testid="invoice-form"]', 'dialog-invoice-edit', words.receivables.dialog.periodHelp)
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-make"]', '[data-testid="invoice-run"]', 'dialog-invoice-run', words.invoicing.lines.title)
    await goTo(page, '#/company/invoicing?tab=plan', words.invoicing.title)
    await lookAtDialog(page, press, shoot, '[data-testid="billing-add"]', '[data-testid="billing-row-form"]', 'dialog-billing-row', words.billing.dialog.billableFrom)
    await lookAtDialog(page, press, shoot, '[data-testid="billing-row-edit"]', '[data-testid="billing-row-form"]', 'dialog-billing-row-edit', words.billing.dialog.descriptionHelp)
    await lookAtDialog(page, press, shoot, '[data-testid="billing-fill"]', '[data-testid="fill-preview"]', 'dialog-billing-fill')
  }
}

/**
 * The Company dialogs whose fields sit two to a row, opened and closed again in a language: an
 * invoice and the invoice run on Invoicing, a plan row, an owner advance, the plan dialogs of Year,
 * a pay scenario's component and a rule's editor.
 */
export function companyDialogsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-add"]', '[data-testid="invoice-form"]', 'dialog-invoice')
    await lookAtDialog(page, press, shoot, '[data-testid="invoice-make"]', '[data-testid="invoice-run-number"]', 'dialog-invoice-run')
    await goTo(page, '#/company/invoicing?tab=plan', words.invoicing.title)
    await lookAtDialog(page, press, shoot, '[data-testid="billing-add"]', '[data-testid="billing-row-form"]', 'dialog-billing-row')
    await goTo(page, '#/company/owner?tab=owed', words.pack.screens.owner)
    await lookAtDialog(page, press, shoot, '[data-testid="advance-edit"]', '[data-testid="add-advance"]', 'dialog-advance')
    await goTo(page, '#/company/year?year=2027&tab=plan', words.pack.screens.year)
    await lookAtDialog(page, press, shoot, '[data-testid="plan-category"]:not([disabled])', '[data-testid="category-plan-form"]', 'dialog-category-plan')
    await lookAtDialog(page, press, shoot, '[data-testid="plan-add-purchase"]', '[data-testid="purchase-plan-form"]', 'dialog-purchase-plan')
    await lookAtDialog(page, press, shoot, ':is([data-testid="plan-add-dividend"], [data-testid="plan-dividend-row"])', '[data-testid="dividend-plan-form"]', 'dialog-dividend-plan')
    await goTo(page, '#/company/year?year=2027&tab=pay', words.pack.screens.year)
    await openCard(page, press, 'scenario-editor')
    await lookAtDialog(page, press, shoot, '[data-scenario="floor-salary"] [data-testid="scenario-add-component"]', '[data-testid="scenario-component-form"]', 'dialog-component')
    await goTo(page, '#/company/sorting#rules', words.companySorting)
    await editRule(page, press, 'merchant-airline')
    await shoot('dialog-rule')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[role="dialog"] [data-testid="rule-editor"]')
  }
}

export const companyDialogsFlow = companyDialogsFlowIn('en')

/** Whether a switch is on, as it tells a screen reader. */
function switchOn(page, selector) {
  return page.$eval(selector, (element) => element.getAttribute('aria-checked') === 'true')
}

/**
 * Company's Assistant tab with a made-up key kept says the chat asks, and links Kuna settings, whose Always allow turned on
 * stays on after a reload and shows on the tab, and turned off again forgets the choice.
 */
export async function assistSwitchFlow(page, { press, shoot, inspect }) {
  const words = ASSIST_WORDS.en
  try {
    await keepAiKey(page)
    await page.waitForSelector(`${APP_ALLOWED}[data-allowed="false"]`, { visible: true, timeout: 10_000 })
    await elementSays(page, APP_ALLOWED, [words.card.allowOff('Anthropic')], 'the tab does not say the chat asks')
    await pressSelector(page, press, '[data-testid="assist-allow-link"]')
    await page.waitForSelector(ALWAYS_ALLOW, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the tab did not lead to Always allow in Kuna settings')
    })
    if (await switchOn(page, ALWAYS_ALLOW)) throw new Error('Always allow is on before it was switched on')
    await pressSelector(page, press, ALWAYS_ALLOW)
    await switchSays(page, ALWAYS_ALLOW, true, 'Always allow did not turn on')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== 'on') throw new Error('this browser does not keep Anthropic allowed')
    await elementSays(page, '[data-testid="assist-card"]', [words.card.allowOn('Anthropic')], 'Always allow does not say what it allows')
    await inspect?.('Always allow on')
    await shoot('assist-switch')

    await page.reload({ waitUntil: 'networkidle0' })
    await page.waitForSelector(ALWAYS_ALLOW, { visible: true, timeout: 10_000 })
    if (!(await switchOn(page, ALWAYS_ALLOW))) throw new Error('Always allow is off again after a reload')
    await goToRoute(page, '#/company/settings?tab=assistant', `${APP_ALLOWED}[data-allowed="true"]`)
    await elementSays(page, APP_ALLOWED, [words.card.allowOn('Anthropic')], 'the tab does not follow Always allow')
    await inspect?.('the Assistant tab with Always allow on')

    await goToRoute(page, '#/settings', ALWAYS_ALLOW)
    await pressSelector(page, press, ALWAYS_ALLOW)
    await switchSays(page, ALWAYS_ALLOW, false, 'Always allow did not turn off')
    if ((await page.evaluate(() => localStorage.getItem('kuna.assist-allowed.anthropic'))) !== null) throw new Error('switching Always allow off left the choice in this browser')
  } finally {
    await forgetAssist(page)
  }
}

/**
 * The Assistant tab and Kuna settings over one state: with no key the tab says what could be done and links to Kuna
 * settings, and with a key the tab says whether the chat asks and links Always allow there. Spending's tab says the same.
 */
export function assistTabFlowIn(language) {
  const words = ASSIST_WORDS[language]
  const companyName = (language === 'en' ? companyEnglish : companyCroatian).name
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    try {
      await page.waitForSelector('[data-testid="assist-add-key"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the tab with no key does not link to Kuna settings')
      })
      if (await page.$(APP_ALLOWED)) throw new Error('the tab says whether the chat asks with no key')
      await elementSays(page, '[data-testid="app-assist-card"]', [words.appCard.addKey], 'the tab with no key does not offer to add one')
      await inspect?.('the Assistant tab with no key')
      await pressSelector(page, press, '[data-testid="assist-add-key"]')
      await page.waitForSelector('[data-testid="assist-card"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the link did not open Kuna settings')
      })

      await keepAiKey(page)
      await page.waitForSelector(ALWAYS_ALLOW, { visible: true, timeout: 10_000 })
      if (await switchOn(page, ALWAYS_ALLOW)) throw new Error('Always allow is on with nothing allowed')
      await elementSays(page, '[data-testid="assist-card"]', [words.card.allow, words.card.allowOff('Anthropic')], 'Always allow does not say the chat asks')
      await inspect?.('Always allow in Kuna settings')
      await shoot('assist-allow')

      await goToRoute(page, '#/company/settings?tab=assistant', APP_ALLOWED)
      await elementSays(
        page,
        '[data-testid="app-assist-card"]',
        [words.card.allowOff('Anthropic'), words.appCard.change, words.appCard.chatTitle, words.appCard.chatSends(companyName)],
        'the tab does not say whether the chat asks and what it reads',
      )
      await inspect?.("Company's Assistant tab")
      await shoot('assist-tab')

      await pressSelector(page, press, '[data-testid="assist-allow-link"]')
      await page.waitForSelector(ALWAYS_ALLOW, { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the tab did not link Kuna settings')
      })
      await pressSelector(page, press, ALWAYS_ALLOW)
      await switchSays(page, ALWAYS_ALLOW, true, 'Always allow did not turn on')
      await goToRoute(page, '#/spending/settings?tab=assistant', `${APP_ALLOWED}[data-allowed="true"]`)
      await elementSays(page, APP_ALLOWED, [words.card.allowOn('Anthropic')], "Spending's tab does not follow Always allow")
      await inspect?.("Spending's Assistant tab")
      await shoot('assist-tab-spending')
    } finally {
      await forgetAssist(page)
    }
  }
}

/** On the To review tab, a row of the queue opened offers to treat its counterparty as a person, and the tap saves the flag and offers the way back. */
export function reviewFlagPersonFlowIn(language) {
  const { review } = SCREEN_WORDS[language].transactions
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await keepAiKey(page)
    try {
      await flagReviewCounterparty(page, press, review, shoot, inspect)
    } finally {
      await forgetAssist(page)
    }
  }
}

/** Opens a queue row, shoots the flag before and after its tap. */
async function flagReviewCounterparty(page, press, review, shoot, inspect) {
  const row = await queueRow(page, 'SNACK KIOSK')
  await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(row)
  await page.waitForSelector('[data-testid="review-details"] [data-testid="review-person"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('the opened row does not offer to treat its counterparty as a person')
  })
  await elementSays(page, '[data-testid="review-person"]', [review.item.asPerson, review.item.asPersonHelp], 'the opened row does not offer to treat its counterparty as a person')
  await shootAt(page, shoot, '[data-testid="review-person"]', 'review-flag-person')
  await pressSelector(page, press, '[data-testid="treat-counterparty"]')
  await toast(page, review.treatedAsPerson)
  await elementSays(page, '[data-testid="review-person"]', [review.item.asCompany], 'the row does not offer to treat its counterparty as a shop or company again')
  await inspect?.('a row of the queue with its counterparty flagged as a person')
  await shoot('review-flag-person-done')
}

/**
 * In Spending or Company, "transcribe" makes the fake model copy a statement onto an account that holds rows from another source:
 * the card skips the row the books have, lists the look-alike that waits beside the row it looks like, and Accept writes the
 * rest with one Undo. `name` is what the screenshot is called.
 */
/** The chat copies a statement onto Company's main account, which the bank's statements fill, so Kuna refuses it and the chat says so with no card. */
export function chatStatementRefusedFlowIn(language, name) {
  const request = language === 'en' ? 'transcribe the statement' : 'prenesi izvod'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (shot) => shootAs(language === 'en' ? shot : `${shot}-${language}`)
    try {
      await keepAiKey(page)
      await openChat(page, press)
      await sendInChat(page, press, request)
      await allowIfAsked(page, press)
      await page.waitForSelector('[data-testid="chat-answer"]', { visible: true, timeout: 15_000 })
      if (await page.$('[data-testid="chat-proposal-accept"]')) throw new Error("the chat offers a card that copies rows onto an account the bank's statements fill")
      await inspect?.('the copied statement refused')
      await shoot(name)
      await newChat(page, press)
    } finally {
      await forgetAssist(page)
    }
  }
}

/**
 * On Company's To review: Select picks two queue rows, which file under one category in one write that SessionChanges lists with
 * one Undo, then Pick all and Confirm as filed confirm every confirmable row in one write, which Undo takes back too.
 */
export function companyReviewSelectFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { review } = words.transactions
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const ROW = '[data-testid="review-row"]'
    const queued = () => page.$$eval(ROW, (rows) => rows.length)
    const before = await queued()
    await pressSelector(page, press, '[data-testid="review-select"]')
    await page.waitForSelector('[data-testid="selection-bar"]', { visible: true, timeout: 10_000 })
    await inspect?.("Company's To review with nothing picked")
    await shoot('company-review-select-none')
    await pickRowNamed(page, press, ROW, 'GADGET CORNER')
    await pickRowNamed(page, press, ROW, 'SNACK KIOSK')
    await pickedCountIs(page, 2, 'two taps')
    await inspect?.("Company's To review with two rows picked")
    await shoot('company-review-select-two')
    await chooseBySearch(page, press, '[data-testid="review-file-picked"]', 'equipment')
    await toastMatching(page, /2/)
    if ((await page.$('[data-testid="selection-bar"]')) !== null) throw new Error('the selection stays after filing')
    await page
      .waitForFunction((count) => document.querySelectorAll('[data-testid="review-row"]').length === count, { timeout: 10_000 }, before - 2)
      .catch(() => {
        throw new Error('filing two rows did not take them off the queue')
      })
    await inspect?.("Company's To review after filing two rows")
    await shoot('company-review-select-filed')
    await undoIn(page, press, words)
    await page
      .waitForFunction((count) => document.querySelectorAll('[data-testid="review-row"]').length === count, { timeout: 10_000 }, before)
      .catch(() => {
        throw new Error('Undo did not bring both rows back to the queue')
      })
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="review-select"]')
    await pressSelector(page, press, '[data-testid="selection-bar-pick-all"]')
    const pickable = await page.$$eval('[data-testid="list-row-pick"]:not([disabled])', (boxes) => boxes.length)
    await pickedCountIs(page, pickable, 'Pick all')
    await inspect?.("Company's To review with every row picked")
    await shoot('company-review-select-all')
    const confirm = await page.$('[data-testid="review-confirm-picked"]')
    if (await confirm.evaluate((button) => button.disabled)) throw new Error(`${review.confirmAsFiled(0).other} is off with every row picked`)
    await press(confirm)
    await toastMatching(page, /./)
    if ((await page.$('[data-testid="selection-bar"]')) !== null) throw new Error('the selection stays after confirming')
    await inspect?.("Company's To review after confirming every confirmable row")
    await shoot('company-review-select-confirmed')
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/**
 * Settings, Accounts: main's list of where its rows come from, mail and then its camt file, and a camt file's day moved earlier
 * over days the mail filled, which warns of the rows saving takes out. Nothing is saved.
 */
export function companyAccountSourcesFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.evaluate(() => {
      window.location.hash = '#/company/settings?tab=accounts'
    })
    await page.waitForSelector('[data-testid="accounts-editor"] [data-testid="account-source-from"]', { visible: true, timeout: 10_000 })
    await shootAt(page, shoot, '[data-testid="account-sources"] .sources', 'company-account-sources')
    await typeDay(await page.$('[data-testid="account-source-from"]'), '2026-10-01')
    await page.waitForSelector('[data-testid="account-handover"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('moving the camt file over days the mail filled warns of no rows')
    })
    await inspect?.('the warning of the rows saving the periods takes out')
    await shootAt(page, shoot, '[data-testid="account-handover"]', 'company-account-handover')
    await pressLabelled(page, press, 'body', language === 'en' ? companySettingsEnglish.accounts.discard : companySettingsCroatian.accounts.discard)
  }
}

/**
 * Settings, Accounts: a new account given a Croatian IBAN offers the bank its bank code names first in the Bank field, marked as from the
 * IBAN. Nothing is saved.
 */
export function companyAccountBankFromIbanFlowIn(language) {
  const settingsWords = language === 'en' ? companySettingsEnglish : companySettingsCroatian
  const ui = language === 'en' ? uiEnglish : uiCroatian
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.evaluate(() => {
      window.location.hash = '#/company/settings?tab=accounts'
    })
    await page.waitForSelector('[data-testid="accounts-editor"]', { visible: true, timeout: 10_000 })
    await pressLabelled(page, press, 'body', settingsWords.accounts.add)
    const rows = await page.$$('[data-testid="account-row"]')
    const added = rows[rows.length - 1]
    const iban = await added.$(`input[aria-label="${settingsWords.accounts.columns.iban}"]`)
    await iban.evaluate((input) => input.scrollIntoView({ block: 'center', inline: 'nearest' }))
    await press(iban)
    await page.keyboard.type('HR12 1001 0051 8630 0016 0')
    const bank = await added.$('[data-testid="account-bank"] input, input[data-testid="account-bank"]')
    await bank.evaluate((input) => input.scrollIntoView({ block: 'center', inline: 'nearest' }))
    await press(bank)
    const offered = await page
      .waitForFunction(() => [...document.querySelectorAll('[role="listbox"] [role="option"]')].map((option) => option.textContent?.trim() ?? ''), { timeout: 5_000 })
      .then((handle) => handle.jsonValue())
    if (!(offered[0]?.includes('Hrvatska narodna banka') && offered[0].includes(ui.bankName.fromIban))) {
      throw new Error(`the bank field offers ${offered.join(', ')} for an IBAN of Hrvatska narodna banka`)
    }
    await delay(250)
    await inspect?.("the bank field offering the bank the IBAN's bank code names")
    await shoot('company-account-bank-from-iban')
    await page.keyboard.press('Escape')
    await pressLabelled(page, press, 'body', settingsWords.accounts.discard)
  }
}

/**
 * On Invoicing, Clients the client's name on its row of the clients grid opens every field of the client, and so does a tap on the row
 * outside its cells' fields. A tag that is not an IBAN and an invoice line with no text are each said under their own field after Save,
 * the line's under it and tied to each of its controls, and the new line shows nothing wrong before Save. A
 * line moves down and back up, focus following it to its up arrow at the end. An address change is saved with Undo, and Undo puts the address back. A line added on Lumen, which the
 * billing plan names no item for, offers none of Northwind's plan items.
 */
export function clientDialogFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const domain = language === 'en' ? invoicingDomainEnglish : invoicingDomainCroatian
  const form = '[data-testid="client-form"]'
  const lineTexts = (page) => page.$$eval(`${form} [data-testid="client-line-text"]`, (inputs) => inputs.map((input) => input.value))
  const northwindRow = (page) => rowNamed(page, FACT_ROW, 'northwind')
  const dialogOpened = async (page, how) => {
    await page.waitForSelector(form, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error(`${how} opened no client dialog`)
    })
    await delay(400)
  }
  const openByName = async (page, press) => {
    const row = await northwindRow(page)
    await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(await row.$('[data-testid="open-row"]'))
    await dialogOpened(page, 'the name northwind')
  }
  const openByRow = async (page) => {
    const row = await northwindRow(page)
    await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    const box = await row.boundingBox()
    const spot = { x: box.x + 3, y: box.y + 3 }
    const onControl = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('a, button, input, label, [role="combobox"], [role="checkbox"]') !== null, spot)
    if (onControl) throw new Error("the northwind row's corner is a control, so a tap there cannot test the row")
    await page.mouse.click(spot.x, spot.y)
    await dialogOpened(page, 'a tap on the northwind row outside its fields')
  }
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openByName(page, press)
    const lines = await lineTexts(page)
    if (lines.length !== 2) throw new Error(`the Northwind dialog shows ${lines.length} invoice lines, not the two of the fake books`)
    const address = await page.$eval('[data-testid="client-address"]', (input) => input.value)
    await inspect?.('the client dialog on Northwind')
    await shoot('dialog-client')

    await typeIban(page, press, await page.$('[data-testid="client-ibans"]'), 'XX00 NOT AN IBAN')
    await pressSelector(page, press, '[data-testid="client-line-add"]')
    await lineMarkedOnlyWhen(page, `${form} [data-testid="client-line"]`, -1, false)
    await pressSelector(page, press, '[data-testid="client-save"]')
    await elementSays(
      page,
      form,
      [words.notAnIban('XX00NOTANIBAN'), capitalised(domain.templateProblem({ kind: 'blank-text', line: 2 }))],
      'the client dialog does not say the refusals under their fields',
    )
    await lineMarkedOnlyWhen(page, `${form} [data-testid="client-line"]`, -1, true)
    await inspect?.('the client dialog refusing an IBAN and a blank line')
    await shoot('dialog-client-refused')
    await removeLastTag(page, press, form)
    const lineButtons = await page.$$(`${form} [data-testid="client-line-remove"]`)
    await press(lineButtons.at(-1))

    await pressSelector(page, press, `${form} [data-testid="client-line-down"]`)
    const moved = await lineTexts(page)
    if (JSON.stringify(moved) !== JSON.stringify([...lines].reverse())) throw new Error(`moving the first line down shows ${JSON.stringify(moved)}`)
    const focusedLine = await page.evaluate((selector) => {
      const rows = [...document.querySelectorAll(selector)]
      return { at: rows.findIndex((row) => row.contains(document.activeElement)), button: document.activeElement?.getAttribute('data-testid') }
    }, `${form} [data-testid="client-line"]`)
    if (focusedLine.at !== 1 || focusedLine.button !== 'client-line-up')
      throw new Error(`after moving the first line down to the end focus is on ${focusedLine.button} of line ${focusedLine.at + 1}, not on the moved line's up arrow`)
    const ups = await page.$$(`${form} [data-testid="client-line-up"]`)
    await press(ups.at(-1))
    if (JSON.stringify(await lineTexts(page)) !== JSON.stringify(lines)) throw new Error('moving the line back up does not give the lines as they were')

    await setField(await page.$('[data-testid="client-address"]'), '2 Example Street, Leeds')
    await pressSelector(page, press, '[data-testid="client-save"]')
    await toast(page, words.invoicing.clientDialog.saved)
    await dialogGone(page, form)
    await undoIn(page, press, words)
    await dismissToasts(page)
    await openByRow(page)
    const after = await page.$eval('[data-testid="client-address"]', (input) => input.value)
    if (after !== address) throw new Error(`after Undo the address reads "${after}", not "${address}"`)
    await page.keyboard.press('Escape')
    await dialogGone(page, form)

    const lumenRow = await rowNamed(page, FACT_ROW, 'lumen')
    await lumenRow.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(await lumenRow.$('[data-testid="open-row"]'))
    await dialogOpened(page, 'the name lumen')
    await pressSelector(page, press, `${form} [data-testid="client-line-add"]`)
    await page.waitForSelector(`${form} [data-testid="client-line"]`, { visible: true, timeout: 5_000 })
    if ((await page.$(`${form} [data-testid="client-line-items"]`)) !== null) throw new Error('a new line on Lumen, whose plan names no items, shows a plan items picker')
    await inspect?.('a new line on Lumen, with no plan items picker since its plan names none')
    await shoot('dialog-client-lumen-line')
    await page.keyboard.press('Escape')
    await dialogGone(page, form)
  }
}

export const clientDialogFlow = clientDialogFlowIn('en')
