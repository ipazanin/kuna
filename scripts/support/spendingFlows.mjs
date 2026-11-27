/**
 * Spending's flows that the visual and the touch check share: entries, splits, shared costs, accounts, links, payees
 * and shortcuts. `press` clicks or taps an element handle, and `shoot` takes a screenshot under a name. Each flow starts
 * on its screen and leaves the workbook as it found it. A failure throws with what was missing.
 */

import { en as writesEnglish, hr as writesCroatian } from '../../src/shared/storage/presentation/words.ts'
import { en as quickAddEnglish, hr as quickAddCroatian } from '../../src/apps/spending/shortcuts/presentation/words.ts'
import { en as uiEnglish, hr as uiCroatian } from '../../src/shared/ui/words.ts'
import { en as spendingPayeesEnglish, hr as spendingPayeesCroatian } from '../../src/apps/spending/payees/presentation/words.ts'
import { addDays, today } from '../../src/shared/calendar/civilDate.ts'
import { monthOf } from '../../src/shared/calendar/monthKey.ts'
import { MADE_UP_ANTHROPIC_KEY } from './chatFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'
import { en as sharedCostEnglish, hr as sharedCostCroatian } from '../../src/apps/spending/sharedCosts/presentation/words.ts'
import {
  SCREEN_WORDS,
  SPENDING_ENTRY_DIALOG,
  TOAST,
  choose,
  chooseStartingWith,
  dialogGone,
  dismissToasts,
  elementSays,
  fill,
  goTo,
  pickLabel,
  pressButton,
  scrollIntoDialogView,
  shootAt,
  toast,
  undoIn,
  waitForTextIn,
} from './flowHelpers.mjs'

/** The labels the Entries row of this payee and amount names in its caption, or blank. */
export async function rowLabels(page, title, cents) {
  return page.$$eval(
    SPENDING_ROW,
    (rows, wanted, amount) =>
      rows
        .find((row) => row.dataset.amount === String(amount) && row.textContent?.includes(wanted))
        ?.querySelector('[data-testid="spending-row-labels"]')
        ?.textContent?.trim() ?? '',
    title,
    cents,
  )
}

/**
 * On the receipts Spending file's Entries: the receipt's groceries line labelled Garden in the entry dialog while its other line
 * keeps New flat, and a new entry given a label typed into its labels field, each saved and undone.
 */
export function spendingEntryLabelsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  const garden = language === 'en' ? 'Garden' : 'Vrt'
  const flat = language === 'en' ? 'New flat' : 'Novi stan'
  const typed = language === 'en' ? 'Weekend away' : 'Vikend'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Corner market', -6120)
    const parts = await page.$$('[data-testid="spending-entry-part-labels"]')
    if (parts.length !== 2) throw new Error(`the receipt's entry dialog shows ${parts.length} labels fields, not one per line`)
    if ((await page.$$(`${SPENDING_ENTRY_DIALOG} [data-testid="spending-entry-labels"]`)).length > 0) throw new Error('a split entry shows a labels field for the whole entry beside its parts')
    const held = await parts[1].evaluate((element) => element.textContent ?? '')
    if (!held.includes(flat)) throw new Error(`the receipt's second line shows "${held.trim()}", not its label ${flat}`)
    await inspect?.("the entry dialog of a receipt's row, a labels field on each line")
    await shoot('spending-entry-part-labels')
    await pickLabel(page, press, parts[0], garden, false)
    await delay(300)
    await inspect?.('a receipt line labelled in the entry dialog')
    await shoot('spending-entry-part-labelled')
    await pressSelector(page, press, '[data-testid="spending-entry-save"]')
    await toast(page, dialog.saved)
    const labelled = await rowLabels(page, 'Corner market', -6120)
    if (!labelled.includes(garden) || !labelled.includes(flat)) throw new Error(`the receipt's row names "${labelled}", not ${garden} and ${flat}`)
    await undoIn(page, press, words)
    if ((await rowLabels(page, 'Corner market', -6120)).includes(garden)) throw new Error(`Undo left ${garden} on the receipt's row`)
    await dismissToasts(page)

    await typeMoneyOut(page, press, words)
    const whole = await page.$$(`${SPENDING_ENTRY_DIALOG} [data-testid="spending-entry-labels"]`)
    if (whole.length !== 1) throw new Error(`a new entry shows ${whole.length} labels fields, not one`)
    await pickLabel(page, press, whole[0], typed, true)
    await delay(300)
    await inspect?.('a new entry with a label typed into its labels field')
    await shoot('spending-entry-labels')
    await pressSelector(page, press, '[data-testid="spending-entry-save"]')
    await toast(page, dialog.added)
    if (!(await rowLabels(page, SPENDING_PAYEE, -2500)).includes(typed)) throw new Error(`the new entry's row does not name ${typed}`)
    await undoIn(page, press, words)
    await spendingRowShown(page, SPENDING_PAYEE, -2500, false)
    await dismissToasts(page)
  }
}

/** The payee the Spending flows type, as anyone might. */
export const SPENDING_PAYEE = 'Bakery by the port'

export const SPENDING_ROW = '[data-testid="spending-row"]'

/** Taps an amount field, checks it opens the phone's number pad, and types the amount over what it holds. */
export async function typeAmount(page, press, testId, amount) {
  const field = await pressSelector(page, press, `[data-testid="${testId}"]`)
  const pad = await field.evaluate((element) => element.getAttribute('inputmode'))
  if (pad !== 'decimal') throw new Error(`${testId} opens no number pad on a phone, its inputmode is ${pad}`)
  await field.evaluate((element) => element.select())
  await page.keyboard.type(amount)
}

/** Waits until Transactions lists a row reading `title` with this amount in cents, or until it no longer does. */
export async function spendingRowShown(page, title, cents, shown) {
  await page
    .waitForFunction(
      (selector, wanted, amount, expected) => [...document.querySelectorAll(selector)].some((row) => row.dataset.amount === String(amount) && row.textContent?.includes(wanted)) === expected,
      { timeout: 10_000 },
      SPENDING_ROW,
      title,
      cents,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `Transactions lists no "${title}" row of ${cents} cents` : `Transactions still lists the "${title}" row of ${cents} cents`)
    })
}

export async function openSpendingRow(page, press, title, cents) {
  const row = await page
    .waitForFunction(
      (selector, wanted, amount) => [...document.querySelectorAll(selector)].find((element) => element.dataset.amount === String(amount) && element.textContent?.includes(wanted)) ?? null,
      { timeout: 10_000 },
      SPENDING_ROW,
      title,
      cents,
    )
    .then((handle) => handle.asElement())
  await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(row)
  await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 10_000 })
  await delay(300)
}

/** Opens a new entry on Transactions and picks its kind by the label of its button. */
export async function newSpendingEntry(page, press, words, kind) {
  await pressSelector(page, press, '[data-testid="spending-add-entry"]')
  await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 10_000 })
  await delay(300)
  await pressButton(page, press, '[data-testid="spending-entry-kind"] button', words.spendingEntries.dialog.kinds[kind])
}

/** Money out of 25 on Groceries to the checks' payee, typed into a new entry. */
async function typeMoneyOut(page, press, words) {
  await newSpendingEntry(page, press, words, 'out')
  await typeAmount(page, press, 'spending-entry-amount', '25')
  await choose(page, press, await page.$('[data-testid="spending-entry-category"]'), words.spendingStarter.Groceries)
  await fill(page, 'spending-entry-payee', SPENDING_PAYEE)
}

/** A move of 100 euros from OTP current that reaches Revolut USD as 108 dollars, typed into a new entry. */
async function typeTransfer(page, press, words) {
  await newSpendingEntry(page, press, words, 'transfer')
  await typeAmount(page, press, 'spending-entry-amount', '100')
  await chooseStartingWith(page, press, '[data-testid="spending-entry-account"]', 'OTP current')
  await chooseStartingWith(page, press, '[data-testid="spending-entry-to-account"]', 'Revolut USD')
  await typeAmount(page, press, 'spending-entry-to-amount', '108')
}

export async function saveSpendingEntry(page, press, title) {
  await pressSelector(page, press, '[data-testid="spending-entry-save"]')
  await toast(page, title)
}

/** What the sample Spending file's entry dialog lists for `ex`: the text as typed, then the known payees most recently paid first. */
const SPENDING_PAYEES_EX = ['ex', 'Example Studio d.o.o.', 'Example Broker', 'Example Bank']

/** The payee options the open list shows, once it shows `count` of them. */
async function payeeOptions(page, count) {
  return page
    .waitForFunction(
      (wanted) => {
        const shown = [...document.querySelectorAll('[role="listbox"] [role="option"]')].map((option) => option.textContent?.trim() ?? '')
        return shown.length === wanted ? shown : null
      },
      { timeout: 5_000 },
      count,
    )
    .then((handle) => handle.jsonValue())
    .catch(() => {
      throw new Error(`the payee field lists no ${count} known payees`)
    })
}

/** Types into the entry dialog's payee field from blank, key by key as a person does, which opens the list of known payees. */
export async function typePayee(page, press, text) {
  const field = await pressSelector(page, press, '[data-testid="spending-entry-payee"]')
  await field.evaluate((element) => element.select())
  await page.keyboard.type(text)
  return field
}

async function payeeTyped(field, wanted, after) {
  const shown = await field.evaluate((element) => element.value)
  if (shown !== wanted) throw new Error(`${after} left "${shown}" in the payee field, not "${wanted}"`)
}

export async function payeeListGone(page) {
  await page
    .waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    .catch(() => {
      throw new Error('the payee list stays open')
    })
}

const SPENDING_SPLIT_DIALOG = '[data-testid="spending-split-dialog"]'

/** The part at `place` of the split dialog, from 0. */
async function splitPart(page, place) {
  const parts = await page.$$(`${SPENDING_SPLIT_DIALOG} [data-testid="split-part"]`)
  const part = parts[place]
  if (part === undefined) throw new Error(`the split has no part ${place + 1}`)
  return part
}

async function typePartAmount(page, press, place, amount) {
  const field = await (await splitPart(page, place)).$('[data-testid="split-part-amount"]')
  if (field === null) throw new Error(`part ${place + 1} of the split has no amount to type`)
  const pad = await field.evaluate((element) => element.getAttribute('inputmode'))
  if (pad !== 'decimal') throw new Error(`the amount of part ${place + 1} opens no number pad on a phone, its inputmode is ${pad}`)
  await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(field)
  await field.evaluate((element) => element.select())
  await page.keyboard.type(amount)
}

async function choosePartCategory(page, press, place, name) {
  const picker = await (await splitPart(page, place)).$('[data-testid="split-part-category"]')
  if (picker === null) throw new Error(`part ${place + 1} of the split has no category to pick`)
  await choose(page, press, picker, name)
}

/**
 * On the sample Spending file's Transactions: the Corner market row of this month split by hand into three parts, one of
 * them For the company, one the rest and one given a label typed in the Split dialog, lands as three parts on the row with
 * that label. Its dialog then shows the parts, and Remove the split takes them off until Undo brings them back.
 */
export function spendingSplitFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { split } = words.spendingEntries
  const starter = words.spendingStarter
  const treat = language === 'en' ? 'Birthday treat' : 'Rođendanska čast'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Corner market', -4530)
    await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-entry-split"]')
    await page.waitForSelector(SPENDING_SPLIT_DIALOG, { visible: true, timeout: 10_000 })
    await typePartAmount(page, press, 0, '20')
    await choosePartCategory(page, press, 1, starter['Eating out'])
    const labels = await (await splitPart(page, 1)).$('[data-testid="split-part-labels"]')
    if (labels === null) throw new Error('part 2 of the split has no labels field')
    await pickLabel(page, press, labels, treat, true)
    await page.waitForSelector(SPENDING_SPLIT_DIALOG, { visible: true, timeout: 2_000 }).catch(() => {
      throw new Error('Escape on the labels list closed the Split dialog')
    })
    await pressSelector(page, press, '[data-testid="split-add-part"]')
    await typePartAmount(page, press, 2, '15.3')
    await choosePartCategory(page, press, 2, starter['For the company'])
    await page
      .waitForFunction((selector) => document.querySelector(selector)?.textContent?.includes('10') ?? false, { timeout: 5_000 }, '[data-testid="split-rest"]')
      .catch(() => {
        throw new Error('the rest does not show what the other parts leave')
      })
    await delay(300)
    await inspect?.('the split of an entry into three parts')
    await shoot('spending-split')

    await pressSelector(page, press, '[data-testid="spending-split-save"]')
    await toast(page, split.saved)
    await dialogGone(page, SPENDING_SPLIT_DIALOG)
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await dismissToasts(page)
    await rowLinesAre(page, 'Corner market', -4530, 3)
    if (!(await rowLabels(page, 'Corner market', -4530)).includes(treat)) throw new Error(`the split row does not name ${treat}, the label typed on its part`)
    await inspect?.('Transactions with the entry split by hand')
    await shoot('spending-split-done')

    await openSpendingRow(page, press, 'Corner market', -4530)
    await page.waitForSelector('[data-testid="spending-entry-remove-split"]', { visible: true, timeout: 10_000 })
    if (await page.$('[data-testid="spending-entry-remove-receipt"]')) throw new Error('a row split by hand offers to remove a receipt')
    if (!(await page.$eval('[data-testid="spending-entry-amount"] input, input[data-testid="spending-entry-amount"]', (input) => input.disabled))) throw new Error('a split row lets its amount change')
    await delay(300)
    await inspect?.('the entry dialog of a row split by hand')
    await shoot('spending-split-entry')
    await pressSelector(page, press, '[data-testid="spending-entry-remove-split"]')
    await toast(page, split.removed)
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await rowLinesAre(page, 'Corner market', -4530, 0)
    await undoIn(page, press, words)
    await rowLinesAre(page, 'Corner market', -4530, 3)
  }
}

/**
 * On the people Spending file's Entries: Half and half splits this month's Corner market row in two under its category, the
 * first part taking the odd cent and part 2's Counts under open, which Ana Horvat is picked for. The row then reads
 * "Corner market · Ana Horvat" with a part line under her, its entry dialog shows each part's Counts under, and Remove the split takes the parts off.
 */
export function spendingHalfAndHalfFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { split } = words.spendingEntries
  const ana = 'Ana Horvat'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Corner market', -4530)
    const folded = await page.$$(`${SPENDING_ENTRY_DIALOG} [data-testid="counts-under"][data-folded="true"]`)
    if (folded.length !== 1) throw new Error('the entry dialog shows no folded Counts under beside the category of an entry not split')
    await pressSelector(page, press, '[data-testid="spending-entry-split"]')
    await page.waitForSelector(SPENDING_SPLIT_DIALOG, { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="split-half-and-half"]')
    await delay(300)
    const parts = await page.$$(`${SPENDING_SPLIT_DIALOG} [data-testid="split-part"]`)
    if (parts.length !== 2) throw new Error(`Half and half left ${parts.length} parts, not two`)
    const first = await parts[0].$eval('[data-testid="split-part-amount"] input, input[data-testid="split-part-amount"]', (input) => input.value)
    if (!first.includes('22') || !first.includes('65')) throw new Error(`Half and half gave part 1 "${first}", not 22.65 with the odd cent`)
    if ((await parts[0].$('[data-testid="counts-under"][data-folded="true"]')) === null) throw new Error("part 1 of Half and half does not count under the entry's payee, folded")
    const picker = await parts[1].$('[data-testid="counts-under-pick"]')
    if (picker === null) throw new Error("Half and half leaves part 2's Counts under folded")
    await inspect?.("Half and half, part 2's Counts under open")
    await shoot('spending-half-and-half')
    await choose(page, press, picker, ana)
    await delay(300)
    await inspect?.('part 2 of Half and half counting under Ana Horvat')
    await shoot('spending-half-and-half-picked')
    await pressSelector(page, press, '[data-testid="spending-split-save"]')
    await toast(page, split.saved)
    await dialogGone(page, SPENDING_SPLIT_DIALOG)
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await dismissToasts(page)
    await rowLinesAre(page, `Corner market · ${ana}`, -4530, 2)
    await inspect?.('Entries with a part counting under Ana Horvat')
    await shoot('spending-half-and-half-done')

    await openSpendingRow(page, press, `Corner market · ${ana}`, -4530)
    const lineFields = await page.$$(`${SPENDING_ENTRY_DIALOG} [data-testid="spending-entry-part-fields"] [data-testid="counts-under"]`)
    if (lineFields.length !== 2) throw new Error(`the split entry's dialog shows ${lineFields.length} Counts under fields, not one per part`)
    await delay(300)
    await inspect?.("the entry dialog of the split entry, each part's Counts under")
    await shoot('spending-half-and-half-entry')
    await pressSelector(page, press, '[data-testid="spending-entry-remove-split"]')
    await toast(page, split.removed)
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await rowLinesAre(page, 'Corner market', -4530, 0)
    await dismissToasts(page)
  }
}

const SPENDING_SHARED_COST_DIALOG = '[data-testid="spending-shared-cost-dialog"]'

/**
 * On the sample Spending file's Entries of last month: the gift for Ana shows as one shared cost with its five entries under it,
 * Petra's repayment from this month among them. Its dialog, like the one that makes a shared cost, shows who it counts under
 * open. Settled marks it and Undo takes that back. An entry's category picker offers it under Shared costs. Two money-out entries
 * picked with Select, while the shared cost shows a dashed box, then make a shared cost of their own, which Undo takes back too.
 * Delete sends the gift's entries to To review and Undo brings it back. Once deleted for good and a new one made, the only one not
 * settled, To review offers Petra's repayment to it and Put it in joins it.
 */
export function spendingSharedCostFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const shared = language === 'en' ? sharedCostEnglish : sharedCostCroatian
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const sharedRows = async () => (await page.$$('[data-testid="spending-shared-cost"]')).length
    await page.evaluate(() => {
      const now = new Date()
      const back = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      location.hash = `#/spending/transactions?month=${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, '0')}`
    })
    const row = await page.waitForSelector('[data-testid="spending-shared-cost"]', { visible: true, timeout: 10_000 })
    const members = await row.$$('[data-testid="spending-shared-cost-member"]')
    if (members.length !== 5) throw new Error(`the gift for Ana lists ${members.length} entries under it, not five`)
    if (!(await row.evaluate((element) => element.textContent ?? '')).includes('Petra')) throw new Error("the gift for Ana does not list Petra's repayment from this month under it")
    await shootAt(page, shoot, row, 'spending-shared-cost', { inspected: () => inspect?.('a shared cost on Entries with its entries under it') })

    await pressSelector(page, press, '[data-testid="spending-shared-cost-open"]')
    await page.waitForSelector(SPENDING_SHARED_COST_DIALOG, { visible: true, timeout: 10_000 })
    await delay(300)
    if (!(await page.$(`${SPENDING_SHARED_COST_DIALOG} [data-testid="counts-under-pick"]`))) throw new Error('the shared cost dialog folds who it counts under, though that names it')
    await inspect?.('the shared cost dialog')
    await shoot('spending-shared-cost-dialog')
    await pressSelector(page, press, '[data-testid="spending-shared-cost-settled"]')
    await pressSelector(page, press, '[data-testid="spending-shared-cost-save"]')
    await toast(page, shared.dialog.saved)
    await dialogGone(page, SPENDING_SHARED_COST_DIALOG)
    await page.waitForSelector('[data-testid="spending-shared-cost"] [data-testid="spending-shared-cost-settled"]', { visible: true, timeout: 5_000 })
    await undoIn(page, press, words)
    await dismissToasts(page)

    await pressSelector(page, press, SPENDING_ROW)
    await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 10_000 })
    await delay(300)
    const entryCategory = await page.$(`${SPENDING_ENTRY_DIALOG} [data-testid="spending-entry-category"]`)
    await entryCategory.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(entryCategory)
    const group = await page
      .waitForFunction(
        (label) => [...document.querySelectorAll('[role="listbox"] *')].find((element) => element.children.length === 0 && element.textContent?.trim() === label) ?? null,
        { timeout: 5_000 },
        shared.sharedCosts,
      )
      .then((handle) => handle.asElement())
      .catch(() => {
        throw new Error("an entry's category picker offers no Shared costs group")
      })
    await shootAt(page, shoot, group, 'spending-shared-cost-picker', { inspected: () => inspect?.("an entry's category picker with its Shared costs group") })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)

    await pressSelector(page, press, '[data-testid="spending-select"]')
    const out = []
    for (const candidate of await page.$$(SPENDING_ROW)) {
      if (Number(await candidate.evaluate((element) => element.dataset.amount)) < 0) out.push(candidate)
      if (out.length === 2) break
    }
    if (out.length < 2) throw new Error('last month has fewer than two money-out entries to make a shared cost of')
    for (const picked of out) {
      await picked.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await press(picked)
      await delay(150)
    }
    if (!(await page.$eval('[data-testid="spending-shared-cost-open"] [data-testid="list-row-pick"]', (element) => element.disabled)))
      throw new Error('the shared cost still opens while entries are being picked')
    await shootAt(page, shoot, '[data-testid="spending-shared-cost-open"]', 'spending-shared-cost-picking', { inspected: () => inspect?.('a shared cost on Entries while entries are being picked') })
    await shootAt(page, shoot, '[data-testid="selection-bar"]', 'spending-shared-cost-selection-bar')
    await pressSelector(page, press, '[data-testid="spending-selection-shared-cost"]')
    await page.waitForSelector(SPENDING_SHARED_COST_DIALOG, { visible: true, timeout: 10_000 })
    await delay(300)
    if (!(await page.$(`${SPENDING_SHARED_COST_DIALOG} [data-testid="counts-under-pick"]`))) throw new Error('making a shared cost folds who it counts under, though that names it')
    const trigger = await page.$(`${SPENDING_SHARED_COST_DIALOG} [data-testid="spending-shared-cost-category"]`)
    await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(trigger)
    const option = await page.waitForSelector('[role="option"]', { visible: true, timeout: 5_000 })
    await press(option)
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await delay(300)
    await inspect?.('making a shared cost of two picked entries')
    await shoot('spending-shared-cost-make')
    await pressSelector(page, press, '[data-testid="spending-shared-cost-save"]')
    await toast(page, shared.dialog.made)
    await dialogGone(page, SPENDING_SHARED_COST_DIALOG)
    if ((await sharedRows()) !== 2) throw new Error('making a shared cost did not list a second one on Entries')
    await undoIn(page, press, words)
    if ((await sharedRows()) !== 1) throw new Error('Undo did not take back the shared cost just made')
    await dismissToasts(page)

    const deleteGift = async () => {
      await pressSelector(page, press, '[data-testid="spending-shared-cost-open"]')
      await page.waitForSelector(SPENDING_SHARED_COST_DIALOG, { visible: true, timeout: 10_000 })
      await delay(300)
      await pressSelector(page, press, '[data-testid="spending-shared-cost-delete"]')
      await toast(page, shared.dialog.deleted(5).other)
      await dialogGone(page, SPENDING_SHARED_COST_DIALOG)
      if ((await sharedRows()) !== 0) throw new Error('Delete left the gift for Ana on Entries')
    }
    await deleteGift()
    await undoIn(page, press, words)
    if ((await sharedRows()) !== 1) throw new Error('Undo did not bring the deleted gift for Ana back')
    await dismissToasts(page)

    await deleteGift()
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="spending-select"]')
    const spent = []
    for (const candidate of await page.$$(SPENDING_ROW)) {
      if (Number(await candidate.evaluate((element) => element.dataset.amount)) < 0) spent.push(candidate)
      if (spent.length === 2) break
    }
    for (const picked of spent) {
      await picked.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await press(picked)
      await delay(150)
    }
    await pressSelector(page, press, '[data-testid="spending-selection-shared-cost"]')
    await page.waitForSelector(SPENDING_SHARED_COST_DIALOG, { visible: true, timeout: 10_000 })
    await delay(300)
    const makeCategory = await page.$(`${SPENDING_SHARED_COST_DIALOG} [data-testid="spending-shared-cost-category"]`)
    await makeCategory.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(makeCategory)
    await press(await page.waitForSelector('[role="option"]', { visible: true, timeout: 5_000 }))
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="spending-shared-cost-save"]')
    await toast(page, shared.dialog.made)
    await dialogGone(page, SPENDING_SHARED_COST_DIALOG)
    await dismissToasts(page)

    await page.evaluate(() => {
      location.hash = '#/spending/transactions?tab=review'
    })
    const repayment = await page
      .waitForFunction(() => document.querySelector('[data-testid="spending-review-repayment"]')?.closest('li') ?? null, { timeout: 10_000 })
      .then((handle) => handle.asElement())
      .catch(() => {
        throw new Error('To review offers no repayment line once one shared cost is not settled')
      })
    if (!(await repayment.evaluate((element) => element.textContent ?? '')).includes('Petra')) throw new Error("To review's repayment line is not on Petra's repayment")
    await shootAt(page, shoot, repayment, 'spending-review-shared-cost-repayment', {
      inspected: () => inspect?.('a money-in row on To review that may be a repayment for the one shared cost not settled'),
    })
    await press(await repayment.$('[data-testid="spending-review-share"]'))
    await toast(page, shared.joined)
  }
}

const SPENDING_ACCOUNT_DIALOG = '[data-testid="spending-account-dialog"]'

/** Opens the account dialog from the account's own screen and waits for it to settle. */
async function openAccountDialog(page, press) {
  await pressSelector(page, press, '[data-testid="spending-account-edit"]')
  await page.waitForSelector(SPENDING_ACCOUNT_DIALOG, { visible: true, timeout: 10_000 })
  await delay(300)
}

/** The sample OTP account's dialog as it opens, the shot to compare a change of the dialog against. */
export function spendingAccountDialogFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openAccountDialog(page, press)
    await inspect?.('the account dialog')
    await shoot('spending-account-dialog')
  }
}

/**
 * The sample OTP account's cards: the dialog shows its card 3670, refuses a card that is not four digits with its reason under
 * the field, saves a second card, shows both once opened again, and clears them.
 */
export function spendingAccountCardsFlowIn(language) {
  const dialog = SCREEN_WORDS[language].spendingAccounts.dialog
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const cards = () => page.$eval('[data-testid="spending-account-cards"]', (input) => input.value)
    await openAccountDialog(page, press)
    if ((await cards()) !== '3670') throw new Error(`the cards field reads "${await cards()}" over the sample OTP card 3670`)
    await fill(page, 'spending-account-cards', '3670, 12')
    await pressSelector(page, press, '[data-testid="spending-account-save"]')
    await page
      .waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted) ?? false, { timeout: 5_000 }, SPENDING_ACCOUNT_DIALOG, dialog.cardsError)
      .catch(() => {
        throw new Error('a card of two digits is not refused under the field')
      })
    await delay(300)
    await inspect?.('the account dialog refusing a card that is not four digits')
    await shoot('spending-account-cards-refused')
    await fill(page, 'spending-account-cards', '3670, 1234')
    await pressSelector(page, press, '[data-testid="spending-account-save"]')
    await toast(page, dialog.saved)
    await dialogGone(page, SPENDING_ACCOUNT_DIALOG)
    // The toast lies over the dialog's Save on a phone.
    await dismissToasts(page)
    await openAccountDialog(page, press)
    if ((await cards()) !== '3670, 1234') throw new Error(`the cards field reads "${await cards()}" once saved with 3670, 1234`)
    await inspect?.('the account dialog with two cards')
    await shoot('spending-account-cards')
    await fill(page, 'spending-account-cards', '')
    await pressSelector(page, press, '[data-testid="spending-account-save"]')
    await toast(page, dialog.saved)
    await dialogGone(page, SPENDING_ACCOUNT_DIALOG)
  }
}

/**
 * The sample OTP account's start day moved 30 days back from today: the dialog lists what goes and fills in the opening that
 * keeps today's balance, Delete and save writes it, and Undo puts the rows back. Then a start day moved a year earlier says
 * the bank sync reaches back only about 90 days.
 */
export function spendingAccountStartDayFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const dialog = words.spendingAccounts.dialog
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const balance = () => page.$eval('[data-testid="spending-account-balance-today"]', (element) => element.textContent?.trim() ?? '')
    const before = await balance()
    await openAccountDialog(page, press)
    const opening = () => page.$eval('[data-testid="spending-account-opening"]', (input) => input.value)
    const typedOpening = await opening()
    await fill(page, 'spending-account-opened-on', addDays(today(), -30))
    await page.waitForSelector('[data-testid="spending-account-cutover"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('a later start day does not list what goes')
    })
    if ((await opening()) === typedOpening) throw new Error('a later start day leaves the opening as it was')
    const save = await page.$eval('[data-testid="spending-account-save"]', (button) => button.textContent?.trim() ?? '')
    if (save !== dialog.cutover.save) throw new Error(`the save button reads "${save}" over a start day that deletes rows`)
    await delay(300)
    await inspect?.('the account dialog listing what a later start day deletes')
    await shoot('spending-account-cutover')

    await pressSelector(page, press, '[data-testid="spending-account-save"]')
    await toast(page, dialog.saved)
    await dialogGone(page, SPENDING_ACCOUNT_DIALOG)
    if ((await balance()) !== before) throw new Error(`today's balance moved from ${before} to ${await balance()} with the start day`)
    await shoot('spending-account-cutover-done')
    await undoIn(page, press, words)
    await dismissToasts(page)

    await openAccountDialog(page, press)
    await fill(page, 'spending-account-opened-on', addDays(today(), -400))
    await page
      .waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted) ?? false, { timeout: 5_000 }, SPENDING_ACCOUNT_DIALOG, dialog.earlierStart)
      .catch(() => {
        throw new Error('an earlier start day does not say how far back the bank reaches')
      })
    await delay(300)
    await inspect?.('the account dialog over an earlier start day')
    await shoot('spending-account-earlier')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ACCOUNT_DIALOG)
  }
}

/**
 * The entry dialog opened on the sample Spending file's Transactions, as money out or as a move between two accounts in two currencies, and closed again.
 * Money out also lists the known payees after two typed letters. Escape closes the list and keeps the letters, so does Enter as the list opens, and Down then Enter picks the newest payee.
 */
export function spendingEntryDialogFlowIn(language, kind) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    if (kind === 'transfer') await typeTransfer(page, press, words)
    else await typeMoneyOut(page, press, words)
    // The dialog grows into place, so it is measured once it settles.
    await delay(300)
    await inspect?.(kind === 'transfer' ? 'the entry dialog between two currencies' : 'the entry dialog')
    await shoot(kind === 'transfer' ? 'spending-transfer' : 'spending-entry')
    if (kind === 'out') {
      const offered = await page.$$eval('[role="listbox"] [role="option"]', (options) => options.map((option) => option.textContent?.trim() ?? ''))
      if (offered.some((option) => option !== SPENDING_PAYEE_WORDS[language].newPayee(SPENDING_PAYEE))) throw new Error(`the payee field lists ${offered.join(', ')} for a new payee`)
      const field = await typePayee(page, press, 'ex')
      const listed = await payeeOptions(page, SPENDING_PAYEES_EX.length)
      if (listed.join('|') !== [SPENDING_PAYEE_WORDS[language].newPayee('ex'), ...SPENDING_PAYEES_EX.slice(1)].join('|')) throw new Error(`the payee field lists ${listed.join(', ')} for ex`)
      await delay(250)
      await inspect?.('the payee list')
      await shoot('spending-entry-payees')
      await page.keyboard.press('Escape')
      await payeeListGone(page)
      await page.waitForSelector(SPENDING_ENTRY_DIALOG, { visible: true, timeout: 2_000 }).catch(() => {
        throw new Error('Escape on the payee list closed the entry dialog')
      })
      await payeeTyped(field, 'ex', 'Escape on the payee list')
      await typePayee(page, press, 'ex')
      await payeeOptions(page, SPENDING_PAYEES_EX.length)
      await page.keyboard.press('Enter')
      await payeeListGone(page)
      await payeeTyped(field, 'ex', 'Enter on the payee list as it opens')
      await typePayee(page, press, 'ex')
      await payeeOptions(page, SPENDING_PAYEES_EX.length)
      await page.keyboard.press('ArrowDown')
      await page.keyboard.press('Enter')
      await payeeListGone(page)
      await payeeTyped(field, SPENDING_PAYEES_EX[1], 'Down and Enter on the payee list')
    }
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/** On the sample Spending file's Transactions: two letters of a payee in a new entry list it, and picking it fills the field with its name as the books spell it. */
export async function spendingPayeePickFlow(page, { press, shoot, inspect }) {
  const words = SCREEN_WORDS.en
  await newSpendingEntry(page, press, words, 'out')
  const field = await typePayee(page, press, 'ca')
  const listed = await payeeOptions(page, 2)
  if (listed[1] !== 'Café on the square') throw new Error(`the payee field lists ${listed.join(', ')} for ca`)
  await inspect?.('the payee list')
  await shoot('spending-payee-list')
  const options = await page.$$('[role="listbox"] [role="option"]')
  await press(options[1])
  await payeeListGone(page)
  await payeeTyped(field, 'Café on the square', 'Picking a payee')
  await shoot('spending-payee-picked')
  await page.keyboard.press('Escape')
  await dialogGone(page, SPENDING_ENTRY_DIALOG)
}

/**
 * On the sample Spending file's Transactions: money out typed in the entry dialog, its amount on the number pad, lands
 * on today's list. Changed, it shows its new amount, and deleted from its dialog it leaves the list until Undo brings
 * it back.
 */
export function spendingEntryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await typeMoneyOut(page, press, words)
    await saveSpendingEntry(page, press, dialog.added)
    await dismissToasts(page)
    await spendingRowShown(page, SPENDING_PAYEE, -2500, true)
    await inspect?.('Transactions with the new entry')
    await shoot('spending-entry-added')

    await openSpendingRow(page, press, SPENDING_PAYEE, -2500)
    await typeAmount(page, press, 'spending-entry-amount', '30')
    await saveSpendingEntry(page, press, dialog.saved)
    await dismissToasts(page)
    await spendingRowShown(page, SPENDING_PAYEE, -3000, true)

    await openSpendingRow(page, press, SPENDING_PAYEE, -3000)
    await pressSelector(page, press, '[data-testid="spending-entry-delete"]')
    await toast(page, dialog.deleted)
    await spendingRowShown(page, SPENDING_PAYEE, -3000, false)
    await undoIn(page, press, words)
    await spendingRowShown(page, SPENDING_PAYEE, -3000, true)
    await inspect?.('Transactions after Undo')
    await shoot('spending-entry-undo-delete')
    await dismissToasts(page)
  }
}

/**
 * On the sample's Transactions: money in on OTP current, reopened and turned into a move between two accounts, stays money in
 * on OTP current, with the money out on the other account, and Undo takes that back.
 */
export function spendingCreditToTransferFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await newSpendingEntry(page, press, words, 'in')
    await typeAmount(page, press, 'spending-entry-amount', '25')
    await chooseStartingWith(page, press, '[data-testid="spending-entry-account"]', 'OTP current')
    await choose(page, press, await page.$('[data-testid="spending-entry-category"]'), words.spendingStarter.Salary)
    await fill(page, 'spending-entry-payee', SPENDING_PAYEE)
    await saveSpendingEntry(page, press, dialog.added)
    await dismissToasts(page)
    await openSpendingRow(page, press, SPENDING_PAYEE, 2500)
    await pressButton(page, press, '[data-testid="spending-entry-kind"] button', dialog.kinds.transfer)
    await delay(300)
    await shoot('spending-credit-to-transfer')
    await saveSpendingEntry(page, press, dialog.saved)
    const betweenAccounts = words.spendingStarter['Between my accounts']
    await spendingRowShown(page, betweenAccounts, 2500, true)
    await spendingRowShown(page, betweenAccounts, -2500, true)
    await spendingRowShown(page, SPENDING_PAYEE, 2500, false)
    await spendingRowShown(page, 'OTP current', -2500, false)
    await undoIn(page, press, words)
    await spendingRowShown(page, SPENDING_PAYEE, 2500, true)
    await spendingRowShown(page, betweenAccounts, -2500, false)
    await dismissToasts(page)
  }
}

/**
 * A row linked to a Loans instalment, on Entries and in its dialog with the link to the loan's page and what it paid above the
 * plan, then a row whose instalment Loans no longer has, in `goneMonth`. That row's link comes off, and the row is linked again
 * from its dialog to the instalment due near its day, which splits it into the plan's interest, its principal under Loan principal
 * and the difference. A key is kept, so each row carries its receipt camera as it does for a person with one.
 */
export function spendingLinkFlowIn(language, goneMonth) {
  const words = SCREEN_WORDS[language]
  const links = words.spendingLinks
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.evaluate((key) => localStorage.setItem('kuna.secret.anthropic', key), MADE_UP_ANTHROPIC_KEY)
    await page.reload({ waitUntil: 'networkidle0' })
    const shootLinked = async (state) => {
      await shootAt(page, shoot, '[data-testid="spending-row-link"]', state === 'there' ? 'spending-row-link' : 'spending-row-link-gone')
      await openSpendingRow(page, press, 'Example Bank', -65000)
      await shootAt(page, shoot, '[data-testid="spending-entry-link"]', state === 'there' ? 'spending-entry-link' : 'spending-entry-link-gone')
      await page.keyboard.press('Escape')
      await dialogGone(page, SPENDING_ENTRY_DIALOG)
    }
    await shootLinked('there')
    await page.evaluate((month) => (location.hash = `#/spending/transactions?month=${month}`), goneMonth)
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-row-link"]')?.classList.contains('text-warning') === true, { timeout: 10_000 })
    await shootLinked('gone')

    await openSpendingRow(page, press, 'Example Bank', -65000)
    await press(await page.waitForSelector('[data-testid="spending-entry-link-remove"]', { visible: true }))
    await toast(page, links.removed)
    await dismissToasts(page)
    await openSpendingRow(page, press, 'Example Bank', -65000)
    const picker = await page.waitForSelector('[data-testid="spending-entry-link-target"]', { visible: true })
    await picker.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(picker)
    const nearest = await page.waitForSelector('[role="option"]', { visible: true, timeout: 5_000 })
    const offered = await nearest.evaluate((option) => option.textContent ?? '')
    if (!offered.startsWith('Home loan')) throw new Error(`the nearest record offered is not the home loan's instalment: ${offered}`)
    await press(nearest)
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await page.waitForSelector('[data-testid="spending-entry-link-note"]', { visible: true, timeout: 10_000 })
    await shootAt(page, shoot, '[data-testid="spending-entry-link-pick"]', 'spending-entry-link-pick')
    await press(await page.waitForSelector('[data-testid="spending-entry-link-add"]:not([disabled])', { visible: true }))
    await toast(page, links.linked)
    await dismissToasts(page)
    await openSpendingRow(page, press, 'Example Bank', -65000)
    await waitForTextIn(page, '[data-testid="spending-entry-lines"]', words.spendingStarter['Loan principal'])
    await page.waitForSelector('[data-testid="spending-entry-link"]', { visible: true, timeout: 10_000 })
    await shootAt(page, shoot, '[data-testid="spending-entry-link"]', 'spending-entry-linked')
    await shootAt(page, shoot, '[data-testid="spending-entry-lines"]', 'spending-entry-linked-split')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/**
 * The company set's rows paid by the fake Company with one employee: To review with the trip's payout offered as a payment
 * from Company and the card of rows filed already, September's salary linked to its ledger row, then the trip's payout linked
 * from its dialog, which files its per diems and kilometres under Travel allowances and its costs under For the company.
 */
export function spendingCompanyLinkFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const links = words.spendingLinks
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-review-offer"]', { visible: true, timeout: 10_000 })
    await shootAt(page, shoot, '[data-testid="spending-review"]', 'spending-review-company-offer')
    await shootAt(page, shoot, '[data-testid="spending-review-company-payments"]', 'spending-review-company-payments')
    await page.evaluate(() => (location.hash = '#/spending/transactions?month=2026-09'))
    await openSpendingRow(page, press, 'Example Studio', 103626)
    await shootAt(page, shoot, '[data-testid="spending-entry-link"]', 'spending-entry-company-link')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await page.evaluate(() => (location.hash = '#/spending/transactions?month=2026-03'))
    await openSpendingRow(page, press, 'Example Studio', 38340)
    const picker = await page.waitForSelector('[data-testid="spending-entry-link-target"]', { visible: true })
    await picker.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(picker)
    const payment = await page.waitForSelector('[role="option"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await shoot('spending-entry-company-picker-open')
    await press(payment)
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await waitForTextIn(page, '[data-testid="spending-entry-link-note"]', words.spendingStarter['For the company'])
    await shootAt(page, shoot, '[data-testid="spending-entry-link-pick"]', 'spending-entry-company-pick')
    await press(await page.waitForSelector('[data-testid="spending-entry-link-add"]:not([disabled])', { visible: true }))
    await toast(page, links.linked)
    await dismissToasts(page)
    await openSpendingRow(page, press, 'Example Studio', 38340)
    await waitForTextIn(page, '[data-testid="spending-entry-lines"]', words.spendingStarter['Travel allowances'])
    await shootAt(page, shoot, '[data-testid="spending-entry-lines"]', 'spending-entry-company-linked')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/**
 * The company set's office supplies of last month, money out the owner paid privately: Add to Company opens from the entry's link
 * field, adds the cost to Company as an owner advance in one write and links the entry under For the company in another, and one
 * Undo takes both back. Last, September's printer paper, linked to the cost Company keeps.
 */
export function spendingAddToCompanyFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const links = words.spendingLinks
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Office supplies shop', -4500)
    await shootAt(page, shoot, '[data-testid="spending-entry-link-pick"]', 'spending-entry-company-cost-offer')
    await press(await page.waitForSelector('[data-testid="spending-entry-add-to-company"]:not([disabled])', { visible: true }))
    const category = await page.waitForSelector('[data-testid="spending-add-to-company-category"]', { visible: true })
    if (await page.$('[data-testid="spending-entry-save"]')) throw new Error('the entry dialog still offers its own Save while it adds a cost to Company')
    await category.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(category)
    const option = await page.waitForSelector('[role="option"]', { visible: true, timeout: 5_000 })
    await press(option)
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await shootAt(page, shoot, '[data-testid="spending-add-to-company"]', 'spending-entry-add-to-company')
    await press(await page.waitForSelector('[data-testid="spending-add-to-company-save"]:not([disabled])', { visible: true }))
    await toast(page, links.company.add.done)
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await undoIn(page, press, words)
    await dismissToasts(page)

    await page.evaluate(() => (location.hash = '#/spending/transactions?month=2026-09'))
    await openSpendingRow(page, press, 'Office supplies shop', -3420)
    await waitForTextIn(page, '[data-testid="spending-entry-link"]', 'Printer paper')
    await shootAt(page, shoot, '[data-testid="spending-entry-link"]', 'spending-entry-company-cost-link')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/**
 * The broker set's waiting transfer to Example Broker beside the fake Investments file: To review offers the deposit into
 * Broker Two two days later with what less arrived, Link files the row under Saved to investments, and the row's dialog in
 * `rowMonth` names the deposit, the account and the difference, with Open in Investments.
 */
export function spendingBrokerLinkFlowIn(language, rowMonth) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const offered = '[data-testid="spending-review-row"]'
    const row = await page
      .waitForFunction((selector) => [...document.querySelectorAll(selector)].find((element) => element.textContent?.includes('Broker Two')) ?? null, { timeout: 10_000 }, offered)
      .then((handle) => handle.asElement())
    await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await shootAt(page, shoot, '[data-testid="spending-review"]', 'spending-review-broker-offer')
    await press(await row.$('[data-testid="spending-review-link"]'))
    await toast(page, words.spendingLinks.linked)
    await dismissToasts(page)
    await page.evaluate((month) => (location.hash = `#/spending/transactions?month=${month}`), rowMonth)
    await openSpendingRow(page, press, 'Example Broker', -100000)
    await waitForTextIn(page, '[data-testid="spending-entry-link"]', 'Broker Two')
    await waitForTextIn(page, '[data-testid="spending-entry-link"]', language === 'en' ? '2.32' : '2,32')
    await shootAt(page, shoot, '[data-testid="spending-entry-link"]', 'spending-entry-broker-link')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/** Link on the company set's waiting trip payout on To review, which links it to Company's payment and takes it off the queue. */
export function spendingCompanyReviewLinkFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-review-link"]', { visible: true, timeout: 10_000 })
    await shootAt(page, shoot, '[data-testid="spending-review-offer"]', 'spending-review-company-link')
    await press(await page.$('[data-testid="spending-review-link"]'))
    await toast(page, words.spendingLinks.linked)
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-review-offer"]') === null, { timeout: 10_000 })
  }
}

/**
 * The sample's standing order below the home loan's instalment, split by hand: its parts, the open Link to Loans picker and what
 * linking it to the instalment would do, then the dialog switches to adding a movement to an informal loan, which says it replaces
 * the parts, adds a repayment to the loan from Marko and links the row in one write each, and one Undo takes both back. Last, the row from `movementMonth` linked to a movement of that loan.
 */
export function spendingAddToLoansFlowIn(language, movementMonth) {
  const words = SCREEN_WORDS[language]
  const links = words.spendingLinks
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Standing order', -60000)
    await shootAt(page, shoot, '[data-testid="spending-entry-lines"]', 'spending-entry-hand-split')
    const picker = await page.waitForSelector('[data-testid="spending-entry-link-target"]', { visible: true })
    await picker.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(picker)
    const nearest = await page.waitForSelector('[role="option"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await shoot('spending-entry-link-picker-open')
    const offered = await nearest.evaluate((option) => option.textContent ?? '')
    if (!offered.startsWith('Home loan')) throw new Error(`the nearest record offered is not the home loan's instalment: ${offered}`)
    await press(nearest)
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await waitForTextIn(page, '[data-testid="spending-entry-link-note"]', links.replacesParts)
    await shootAt(page, shoot, '[data-testid="spending-entry-link-pick"]', 'spending-entry-link-below-plan')

    await press(await page.waitForSelector('[data-testid="spending-entry-add-to-loans"]:not([disabled])', { visible: true }))
    const loan = await page.waitForSelector('[data-testid="spending-add-to-loans-loan"]', { visible: true })
    await loan.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(loan)
    const marko = await page
      .waitForFunction(() => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim().startsWith('From Marko')) ?? null, { timeout: 5_000 })
      .catch(() => {
        throw new Error('adding a movement offers no loan from Marko')
      })
    await press(marko.asElement())
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await page.waitForSelector('[data-testid="spending-add-to-loans-kind"]', { visible: true })
    await waitForTextIn(page, '[data-testid="spending-add-to-loans-replaces"]', links.replacesParts)
    if (await page.$('[data-testid="spending-entry-save"]')) throw new Error('the entry dialog still offers its own Save while it adds a movement')
    await shootAt(page, shoot, '[data-testid="spending-add-to-loans"]', 'spending-entry-add-to-loans')
    await press(await page.waitForSelector('[data-testid="spending-add-to-loans-save"]:not([disabled])', { visible: true }))
    await toast(page, links.add.done)
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
    await waitForTextIn(page, '[data-testid="spending-row-link"]', 'From Marko')
    await undoIn(page, press, words)
    await dismissToasts(page)
    await page.waitForFunction(() => ![...document.querySelectorAll('[data-testid="spending-row-link"]')].some((element) => element.textContent?.includes('From Marko')), { timeout: 10_000 })

    await page.evaluate((month) => (location.hash = `#/spending/transactions?month=${month}`), movementMonth)
    await openSpendingRow(page, press, 'Marko', -150000)
    await waitForTextIn(page, '[data-testid="spending-entry-link"]', 'From Marko')
    await shootAt(page, shoot, '[data-testid="spending-entry-link"]', 'spending-entry-link-movement')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/**
 * The sample's repayment to Marko with its link taken off, linked again from its dialog to the movement of his loan, where the
 * note says the whole entry goes under Loans to and from people and counts as neither spending nor income.
 */
export function spendingLinkMovementFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const links = words.spendingLinks
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Marko', -150000)
    await press(await page.waitForSelector('[data-testid="spending-entry-link-remove"]', { visible: true }))
    await toast(page, links.removed)
    await dismissToasts(page)
    await openSpendingRow(page, press, 'Marko', -150000)
    const picker = await page.waitForSelector('[data-testid="spending-entry-link-target"]', { visible: true })
    await picker.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(picker)
    const movement = await page
      .waitForFunction(() => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim().startsWith('From Marko')) ?? null, { timeout: 5_000 })
      .catch(() => {
        throw new Error('the link picker offers no movement of the loan from Marko')
      })
    await press(movement.asElement())
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await waitForTextIn(page, '[data-testid="spending-entry-link-note"]', words.spendingStarter['Loans to and from people'])
    await shootAt(page, shoot, '[data-testid="spending-entry-link-pick"]', 'spending-entry-link-pick-movement')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/**
 * To review with the sample Loans file: the waiting row that pays the home loan's last instalment links with Link and comes back with Undo,
 * and the card of the row filed already that looks like an older instalment goes with Not now and with Link all, each undone.
 */
export function spendingInstalmentOffersFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const links = words.spendingLinks
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const shown = (selector, wanted) =>
      page
        .waitForFunction((where, on) => (document.querySelector(where) !== null) === on, { timeout: 10_000 }, selector, wanted)
        .catch(() => {
          throw new Error(`${selector} is ${wanted ? 'not' : 'still'} on To review`)
        })
    await shootAt(page, shoot, '[data-testid="spending-review-offer"]', 'spending-review-offer')
    await pressSelector(page, press, '[data-testid="spending-review-link"]')
    await toast(page, links.linked)
    await shown('[data-testid="spending-review-offer"]', false)
    await undoIn(page, press, words)
    await shown('[data-testid="spending-review-offer"]', true)
    await dismissToasts(page)

    await shootAt(page, shoot, '[data-testid="spending-review-instalments"]', 'spending-review-instalments', { block: 'start' })
    await pressSelector(page, press, '[data-testid="spending-review-instalments-not-now"]')
    await toast(page, links.past.putOff)
    await shown('[data-testid="spending-review-instalments"]', false)
    await undoIn(page, press, words)
    await shown('[data-testid="spending-review-instalments"]', true)
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="spending-review-instalments-link"]')
    await toast(page, links.past.linked(1).one)
    await shown('[data-testid="spending-review-instalments"]', false)
    await undoIn(page, press, words)
    await shown('[data-testid="spending-review-instalments"]', true)
    await dismissToasts(page)
  }
}

/** A statement row of the statements set opened in its dialog says that deleting it brings it back with the next export. */
export function spendingDeleteNoteFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, inspect }) => {
    const month = monthOf(addDays(today(), -2))
    await page.evaluate((wanted) => {
      window.location.hash = `#/spending/transactions?month=${wanted}`
    }, month)
    await openSpendingRow(page, press, 'Transfer to Revolut', -7500)
    const wanted = words.spendingEntries.dialog.comesBack
    await page
      .waitForFunction((text) => document.querySelector('[data-testid="spending-entry-source-note"]')?.textContent?.includes(text) ?? false, { timeout: 10_000 }, wanted)
      .catch(() => {
        throw new Error('a statement row does not say that deleting it brings it back')
      })
    await delay(300)
    await inspect?.('a statement row in the entry dialog')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

export async function dropSpendingFile(page, path) {
  const input = await page.waitForSelector('[data-testid="spending-import-file"] input[type="file"]', { timeout: 10_000 }).catch(() => {
    throw new Error('Import offers no file input')
  })
  await input.uploadFile(path)
}

export const SPENDING_RECEIPT_FORM = '[data-testid="spending-receipt-form"]'

/** Presses Add a receipt on Entries and, where it opens a menu because a key is kept, picks typing it in, the menu's first choice. */
export async function openReceiptDialog(page, press) {
  const button = await pressSelector(page, press, '[data-testid="spending-add-receipt"]')
  if ((await button.evaluate((element) => element.getAttribute('aria-haspopup'))) !== 'menu') return
  const typeIn = await page.waitForSelector('[role="menuitem"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Add a receipt opened no menu')
  })
  await press(typeIn)
}

/** Opens the receipt dialog on Entries and uploads a photo, then waits for its QR code to be read or found missing. */
export async function uploadReceiptPhoto(page, press, path, reading = 'read') {
  await openReceiptDialog(page, press)
  const input = await page.waitForSelector('[data-testid="spending-receipt-upload"] input[type="file"]', { timeout: 10_000 }).catch(() => {
    throw new Error('the receipt dialog offers no file input')
  })
  await input.uploadFile(path)
  await page.waitForSelector(`[data-testid="spending-receipt-reading"][data-reading="${reading}"]`, { visible: true, timeout: 15_000 }).catch(async () => {
    const shown = await page.$eval('[data-testid="spending-receipt-reading"]', (element) => element.dataset.reading).catch(() => 'no form')
    throw new Error(`the receipt photo reads as ${shown}, not ${reading}`)
  })
  // The preview goes through `img-src`, so a policy without blob: leaves it empty.
  await page
    .waitForFunction(() => (document.querySelector('[data-testid="spending-receipt-preview"]')?.naturalWidth ?? 0) > 0, { timeout: 5_000 })
    .catch(() => {
      throw new Error('the receipt photo shows no preview')
    })
  await delay(300)
}

/** How many lines the row of this payee and amount shows on Entries. */
export async function rowLinesAre(page, title, cents, count) {
  await page
    .waitForFunction(
      (selector, wanted, amount, lines) =>
        [...document.querySelectorAll(selector)].some(
          (row) => row.dataset.amount === String(amount) && row.textContent?.includes(wanted) && row.querySelectorAll('[data-testid="spending-row-line"]').length === lines,
        ),
      { timeout: 10_000 },
      SPENDING_ROW,
      title,
      cents,
      count,
    )
    .catch(() => {
      throw new Error(`Transactions lists no "${title}" row of ${cents} cents with ${count} lines`)
    })
}

/** Waits for the element under `selector` that says `text`, and scrolls it to the middle of the screen. */
export async function centreOn(page, selector, text) {
  await waitForTextIn(page, selector, text)
  await page.evaluate(
    (where, wanted) => [...document.querySelectorAll(where)].find((element) => element.textContent?.includes(wanted))?.scrollIntoView({ block: 'center' }),
    selector,
    text.trim().replace(/\s+\S*$/, ''),
  )
}

export async function reviewRowOf(page, payee) {
  const handle = await page.evaluateHandle((wanted) => [...document.querySelectorAll('[data-testid="spending-review-row"]')].find((row) => row.textContent?.includes(wanted)) ?? null, payee)
  const row = handle.asElement()
  if (row === null) throw new Error(`To review has no row for ${payee}`)
  return row
}

/** Money out added by touch on the sample Spending file's Transactions: the amount on the number pad, a category, saved onto today's list, and taken off again with Undo. */
export async function spendingMoneyOutFlow(page, { press, shoot, inspect }) {
  const words = SCREEN_WORDS.en
  await typeMoneyOut(page, press, words)
  await delay(300)
  await inspect?.('the entry dialog with its amount typed')
  await shoot('spending-money-out-dialog')
  await saveSpendingEntry(page, press, words.spendingEntries.dialog.added)
  await spendingRowShown(page, SPENDING_PAYEE, -2500, true)
  await inspect?.('Transactions with the new entry')
  await shoot('spending-money-out')
  await undoIn(page, press, words)
  await spendingRowShown(page, SPENDING_PAYEE, -2500, false)
  await dismissToasts(page)
}

/** The balance an account's row on Spending's Accounts shows, in cents of the account's own currency. */
async function spendingBalanceOf(page, name) {
  const text = await page
    .waitForFunction(
      (wanted) =>
        [...document.querySelectorAll('[data-testid="spending-account-row"]')]
          .find((row) => row.textContent?.includes(wanted))
          ?.querySelector('[data-testid="spending-account-balance"]')
          ?.textContent?.trim() ?? null,
      { timeout: 10_000 },
      name,
    )
    .then((handle) => handle.jsonValue())
    .catch(() => {
      throw new Error(`Accounts shows no balance for ${name}`)
    })
  const cents = Number(text.replace(/\D/g, ''))
  return /[−-]/.test(text) ? -cents : cents
}

/**
 * From the sample Spending file's Accounts: 100 euros moved from OTP current to Revolut USD, arriving as 108 dollars,
 * lists both legs on Transactions and moves both balances by as much. Deleting one leg takes both off until Undo puts
 * them back.
 */
export function spendingTransferFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  const screens = words.spendingScreens
  const title = words.spendingStarter['Between my accounts']
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const before = { out: await spendingBalanceOf(page, 'OTP current'), into: await spendingBalanceOf(page, 'Revolut USD') }
    await goTo(page, '#/spending/transactions', screens.entries)
    await typeTransfer(page, press, words)
    await saveSpendingEntry(page, press, dialog.added)
    await dismissToasts(page)
    await spendingRowShown(page, title, -10000, true)
    await spendingRowShown(page, title, 10800, true)

    await goTo(page, '#/spending/accounts', screens.accounts)
    const after = { out: await spendingBalanceOf(page, 'OTP current'), into: await spendingBalanceOf(page, 'Revolut USD') }
    if (after.out !== before.out - 10000 || after.into !== before.into + 10800)
      throw new Error(`the move took OTP current from ${before.out} to ${after.out} cents and Revolut USD from ${before.into} to ${after.into}, not by 100 euros and 108 dollars`)
    await inspect?.('Accounts after the move')
    await shoot('spending-transfer-balances')

    await goTo(page, '#/spending/transactions', screens.entries)
    await openSpendingRow(page, press, title, -10000)
    await pressSelector(page, press, '[data-testid="spending-entry-delete"]')
    await toast(page, dialog.deleted)
    await spendingRowShown(page, title, -10000, false)
    await spendingRowShown(page, title, 10800, false)
    await undoIn(page, press, words)
    await spendingRowShown(page, title, -10000, true)
    await spendingRowShown(page, title, 10800, true)
    await inspect?.('Transactions after Undo')
    await dismissToasts(page)
  }
}

export const spendingTransferFlow = spendingTransferFlowIn('en')

/**
 * The Spending entry dialog opened on a file a newer Kuna saved: it opens with the reason at the top of its body, keeps Save off with no spinner,
 * and what was typed stays after the reason shows.
 */
export function newerFileDialogFlowIn(language) {
  return async (page, { press, shoot: shootAs }) => {
    await pressSelector(page, press, '[data-testid="spending-add-entry"]')
    await page.waitForSelector('[data-testid="dialog-changes-refused"]', { visible: true, timeout: 10_000 })
    const save = await page.$eval('[data-testid="spending-entry-save"]', (button) => ({ disabled: button.disabled, loading: button.querySelector('.animate-spin') !== null }))
    if (!save.disabled || save.loading) throw new Error(`Save is disabled=${save.disabled} and spinning=${save.loading} on a file a newer Kuna saved`)
    await delay(400)
    await shootAs(language === 'en' ? 'dialog-newer-file-entry' : `dialog-newer-file-entry-${language}`)
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="dialog-changes-refused"]')
  }
}

/** A new account from Accounts starts today, so a balance typed from the bank's screen is not counted twice. */
export async function spendingAccountOpensTodayFlow(page, { press }) {
  await pressSelector(page, press, '[data-testid="spending-add-account"]')
  await page.waitForSelector('[data-testid="spending-account-dialog"]', { visible: true, timeout: 10_000 })
  const shown = await page.$eval('[data-testid="spending-account-opened-on"] input', (input) => input.value)
  const local = await page.evaluate(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  if (shown !== local) throw new Error(`a new account from Accounts opens on ${shown}, not today`)
  await delay(300)
}

/**
 * A new Spending file with the bank sync set up offers Link a bank beside Add by hand. Link a bank opens the account
 * dialog with its rows from the bank, and Add asks for the IBAN the bank sync finds the account by.
 */
export function spendingFirstAccountBankFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const choice = words.spendingAccounts.rowsFromChoice
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-empty"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('the empty Overview with the bank sync set up')
    await shoot('spending-first-account-bank-empty')
    await pressSelector(page, press, '[data-testid="spending-overview-link-bank"]')
    await page.waitForSelector(SPENDING_ACCOUNT_DIALOG, { visible: true, timeout: 10_000 })
    await delay(300)
    const picked = await page.$eval('[data-testid="spending-account-rows-from"] [aria-pressed="true"]', (button) => button.textContent?.trim() ?? '')
    if (picked !== words.spendingAccounts.rowsFrom['bank-link']) throw new Error(`Link a bank opens the account dialog with "${picked}" picked`)
    await fill(page, 'spending-account-name', language === 'en' ? 'Current account' : 'Tekući račun')
    await pressSelector(page, press, '[data-testid="spending-account-save"]')
    await waitForTextIn(page, SPENDING_ACCOUNT_DIALOG, choice.ibanNeeded)
    await delay(300)
    await inspect?.('the account dialog linked to a bank with no IBAN')
    await shoot('spending-first-account-bank')
    // A later source, such as the statement file for days a lapsed link missed, is added under the first.
    await pressSelector(page, press, '[data-testid="spending-account-source-add"]')
    await page.waitForSelector('[data-testid="spending-account-source-from"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('Add a later source shows no day it starts on')
    })
    await scrollIntoDialogView(page, '[data-testid="spending-account-sources"]')
    await delay(300)
    await shoot('spending-first-account-bank-statement-file')
  }
}

/** A new Spending file asks for one account in place, then says what comes next and opens Import. */
export function spendingFirstAccountFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-empty"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-overview-add-account"]')
    await page.waitForSelector('[data-testid="spending-account-dialog"]', { visible: true, timeout: 10_000 })
    await delay(300)
    const openedOn = await page.$eval('[data-testid="spending-account-opened-on"] input', (input) => input.value)
    if (!openedOn.endsWith('-01')) throw new Error(`the first account on Overview opens on ${openedOn}, not the first of the month`)
    await inspect?.('the account dialog on an empty Overview')
    await shoot('spending-first-account')
    await fill(page, 'spending-account-name', 'Current account')
    await pressSelector(page, press, '[data-testid="spending-account-save"]')
    await page.waitForSelector('[data-testid="getting-set-up"] [data-line="first-entries"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Overview does not say what comes after the first account')
    })
    await dismissToasts(page)
    await pressSelector(page, press, '[data-line="first-entries"] a')
    await page
      .waitForFunction(() => window.location.hash.includes('tab=import'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('The first entries line did not open Import')
      })
  }
}

export const spendingFirstAccountFlow = spendingFirstAccountFlowIn('en')

/**
 * On the sample Spending file's Entries opened as Analysis opens it, with the new flat's label over the two whole months before
 * this one in `?from=` and `?to=`: the span shows in the month select, or as a chip on a phone, and the label's total counts
 * only those two months' rent and bills, 2 × (600.00 + 118.40). On a phone no chip that fits is folded into "+N more", and taking
 * off the span chip goes to every month, as a label picked by hand does.
 */
export function spendingEntriesSpanFlowIn(language) {
  const flat = language === 'en' ? 'New flat' : 'Novi stan'
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-transactions"]', { visible: true, timeout: 10_000 })
    await page.evaluate(() => {
      const day = new Date()
      const first = new Date(day.getFullYear(), day.getMonth() - 2, 1)
      const last = new Date(day.getFullYear(), day.getMonth(), 0)
      const text = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      window.location.hash = `#/spending/transactions?from=${text(first)}&to=${text(last)}&label=fa4e3000-0000-4000-8000-000000002002`
    })
    await page.waitForSelector('[data-testid="spending-filter-total"]', { visible: true, timeout: 10_000 })
    const total = await page.$eval('[data-testid="spending-filter-total"]', (row) => ({ text: row.textContent ?? '', spent: row.querySelector('[data-spent]')?.getAttribute('data-spent') ?? null }))
    if (!total.text.includes(flat)) throw new Error(`Entries over a span sums up another: ${total.text}`)
    if (total.spent !== '143680') throw new Error(`the new flat over two months sums ${total.spent} cents, not 143680`)
    const phone = (await page.$('[data-testid="spending-filter-chips"]')) !== null
    const shown = phone
      ? await page.$$eval('[data-testid="spending-filter-chips"] [data-testid="filter-chip"], [data-testid="filter-chip-copy"] > div:first-child > *', (chips) =>
          chips.map((chip) => chip.textContent?.trim() ?? ''),
        )
      : [await page.$eval('[data-testid="spending-filter-month"]', (select) => select.textContent?.trim() ?? '')]
    if (!shown.some((text) => text.includes('–'))) throw new Error(`Entries over a span names no span: ${shown.join(', ')}`)
    if (phone) await expectNoFittingChipFolded(page)
    const cut = phone
      ? []
      : await page.$eval('[data-testid="spending-filter-month"]', (select) =>
          [select, ...select.querySelectorAll('*')].filter((part) => part.scrollWidth > part.clientWidth + 1).map((part) => part.textContent?.trim() ?? ''),
        )
    if (cut.length > 0) throw new Error(`the month select cuts the span short: ${cut.join(', ')}`)
    await inspect?.("Entries over Analysis's span")
    await shoot('spending-entries-span')
    if (!phone) return
    const spanChip = () =>
      page.evaluate(() => {
        const chip = [...document.querySelectorAll('[aria-label*="–"]')].find((each) => each.closest('[data-testid="filter-chip-copy"]') === null)
        if (!(chip instanceof HTMLElement)) return false
        chip.click()
        return true
      })
    if (!(await spanChip())) {
      await page.click('[data-testid="spending-filter-chips"] [data-testid="more-filters"]')
      await page.waitForFunction(() => [...document.querySelectorAll('[aria-label*="–"]')].some((each) => each.closest('[data-testid="filter-chip-copy"]') === null), { timeout: 10_000 })
      if (!(await spanChip())) throw new Error('Entries over a span shows no span chip to take off')
    }
    await page.waitForFunction(() => window.location.hash.includes('month=all') && !window.location.hash.includes('from='), { timeout: 10_000 })
  }
}

/**
 * On the sample Spending file's Entries: a label picked shows its total above the list. At a phone's width the first entry
 * starts on the first screen, the filters sit in a sheet behind a Filters button, and the picked label's chip, the only one
 * since every month goes with it, takes it off and goes back to this month.
 */
export function spendingEntryFiltersFlowIn(language) {
  const { filterChips } = SCREEN_WORDS[language]
  const trip = language === 'en' ? 'Boston trip' : 'Put u Boston'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-transactions"]', { visible: true, timeout: 10_000 })
    const phone = (await page.$('[data-testid="open-filters"]')) !== null
    if (phone) {
      const firstRow = await page.$eval('[data-testid="spending-row"]', (row) => row.getBoundingClientRect().top + window.scrollY)
      const height = await page.evaluate(() => window.innerHeight)
      if (firstRow > height) throw new Error(`the first entry starts at ${Math.round(firstRow)} px, below a phone's first screen of ${height} px`)
      await pressSelector(page, press, '[data-testid="open-filters"]')
      await page.waitForSelector('[data-testid="spending-filter-sheet"]', { visible: true, timeout: 10_000 })
      await chooseStartingWith(page, press, '[data-testid="spending-filter-sheet"] [data-testid="spending-filter-label"]', trip)
      await inspect?.('the filter sheet with a label picked')
      await shoot('spending-filter-sheet')
      await pressSelector(page, press, '[data-testid="filters-show"]')
      await page.waitForFunction(() => !document.querySelector('[data-testid="spending-filter-sheet"]'), { timeout: 5_000 })
    } else {
      await chooseStartingWith(page, press, '[data-testid="spending-filter-label"]', trip)
    }
    await page.waitForSelector('[data-testid="spending-filter-total"]', { visible: true, timeout: 10_000 })
    const total = await page.$eval('[data-testid="spending-filter-total"]', (row) => row.textContent ?? '')
    if (!total.includes(trip)) throw new Error(`Entries filtered by ${trip} sums up another: ${total}`)
    await inspect?.('Entries filtered by a label')
    await shoot('spending-entries-label-total')
    if (!phone) return
    const chipsShown = () => page.$$eval('[data-testid="spending-filter-chips"] [data-testid="filter-chip"]', (found) => found.map((chip) => chip.textContent?.trim() ?? ''))
    const chips = await chipsShown()
    if (chips.join() !== trip) throw new Error(`the chips name ${chips.join(', ')}, not ${trip} alone`)
    await pressSelector(page, press, `[data-testid="spending-filter-chips"] [data-testid="filter-chip"][aria-label="${filterChips.remove(trip)}"]`)
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="spending-filter-total"]'), { timeout: 5_000 })
      .catch(() => {
        throw new Error("the label's chip did not take the label off")
      })
    const left = await chipsShown()
    if (left.length > 0) throw new Error(`taking the label off left ${left.join(', ')}, not this month`)
  }
}

/**
 * Spending's To review on the statements set with the sample Loans file: the early repayment the home loan's rule filed whole
 * is offered as an extra payment, its dialog records it in Loans and links the row, which leaves the card, and one Undo takes back both.
 */
export function spendingExtraPaymentFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { extra } = words.spendingLinks
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await elementSays(page, '[data-testid="spending-review-extra-payments"]', [extra.title, extra.record], 'To review offers no extra payment to record')
    await inspect?.('To review with an extra payment to record')
    await shootAt(page, shoot, '[data-testid="spending-review-extra-payments"]', 'spending-review-extra-payments')
    await pressSelector(page, press, '[data-testid="spending-review-extra-payment"]:not([data-with-instalment]) [data-testid="spending-review-extra-payment-record"]')
    await page.waitForSelector('[data-testid="spending-extra-payment"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await inspect?.('the dialog that records an extra payment')
    await shoot('spending-extra-payment-dialog')
    await pressSelector(page, press, '[data-testid="spending-extra-payment-save"]')
    await toast(page, extra.done)
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="spending-review-extra-payment"]:not([data-with-instalment])').length === 0, { timeout: 10_000 })
    await undoIn(page, press, words)
    await page.waitForSelector('[data-testid="spending-review-extra-payment"]:not([data-with-instalment])', { visible: true, timeout: 10_000 })
    await dismissToasts(page)
  }
}

/**
 * To review with the statements set and the sample Loans file: the debit that pays the home loan's latest instalment and an
 * extra payment opens a dialog naming the instalment it links as well, starting at what the row pays beyond it. Saving splits
 * the row and links both, and Undo brings the offer back.
 */
export function spendingExtraPaymentWithInstalmentFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { extra } = words.spendingLinks
  const OFFER = '[data-testid="spending-review-extra-payment"][data-with-instalment]'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector(OFFER, { visible: true, timeout: 10_000 })
    await inspect?.('To review with a debit that pays an instalment and an extra payment')
    await shootAt(page, shoot, OFFER, 'spending-review-extra-payment-with-instalment')
    await pressSelector(page, press, `${OFFER} [data-testid="spending-review-extra-payment-record"]`)
    await page.waitForSelector('[data-testid="spending-extra-payment-instalment"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await inspect?.('the dialog that records an extra payment and links the instalment as well')
    await shoot('spending-extra-payment-with-instalment-dialog')
    await pressSelector(page, press, '[data-testid="spending-extra-payment-save"]')
    await toast(page, extra.done)
    await page.waitForSelector(OFFER, { hidden: true, timeout: 10_000 })
    await undoIn(page, press, words)
    await page.waitForSelector(OFFER, { visible: true, timeout: 10_000 })
    await dismissToasts(page)
  }
}

/** The quick add button whose words hold the name. */
async function quickAddButton(page, name) {
  const handle = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[data-testid="spending-quick-add-button"]')].find((button) => button.textContent?.includes(wanted)) ?? null, { timeout: 10_000 }, name)
    .catch(() => {
      throw new Error(`no Quick add button for ${name}`)
    })
  return handle.asElement()
}

/** Presses the toast's button with these words. */
async function pressToastButton(page, press, label) {
  const button = await page
    .waitForFunction((selector, wanted) => [...document.querySelectorAll(`${selector} button`)].find((element) => element.textContent?.trim() === wanted) ?? null, { timeout: 5_000 }, TOAST, label)
    .catch(() => {
      throw new Error(`no toast offers ${label}`)
    })
  await press(button.asElement())
}

/** On the sample Spending file's Entries: the coffee's Quick add button adds one entry for today, split into the coffee and its tip, and Undo takes it back. */
export function spendingQuickAddFlowIn(language) {
  const quick = language === 'en' ? quickAddEnglish : quickAddCroatian
  const writes = language === 'en' ? writesEnglish : writesCroatian
  const coffee = language === 'en' ? 'Coffee' : 'Kava'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs?.(language === 'en' ? name : `${name}-${language}`)
    const rowCount = () => page.$$eval('[data-testid="spending-row"]', (rows) => rows.length)
    const rowsAre = (count, why) =>
      page
        .waitForFunction((wanted) => document.querySelectorAll('[data-testid="spending-row"]').length === wanted, { timeout: 10_000 }, count)
        .catch(() => {
          throw new Error(why)
        })
    await page.waitForSelector('[data-testid="spending-quick-add"]', { visible: true, timeout: 10_000 })
    const before = await rowCount()
    await inspect?.('Entries with its Quick add card')
    await shoot('spending-entries-quick-add')
    await press(await quickAddButton(page, coffee))
    await toast(page, quick.added(coffee))
    await rowsAre(before + 1, 'the Quick add button added no entry')
    const amount = language === 'en' ? '2.00' : '2,00'
    const added = await page.$$eval('[data-testid="spending-row"]', (rows, wanted) => rows.some((row) => row.textContent?.includes('Café on the square') && row.textContent?.includes(wanted)), amount)
    if (!added) throw new Error('the new entry is not the coffee and its tip of 2.00')
    await inspect?.('Entries after a quick add, with its toast')
    await shoot('spending-quick-add-added')
    await pressToastButton(page, press, writes.undo)
    await toast(page, writes.undone)
    await rowsAre(before, 'Undo did not take the quick add back')
  }
}

/** On the sample Spending file's Entries: a third entry like two before it offers Make a Quick add, whose button then shows on the Quick add card. */
export function spendingShortcutOfferFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const quick = language === 'en' ? quickAddEnglish : quickAddCroatian
  const payee = 'Kiosk on the corner'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs?.(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-quick-add"]', { visible: true, timeout: 10_000 })
    for (const time of [1, 2, 3]) {
      await newSpendingEntry(page, press, words, 'out')
      await chooseStartingWith(page, press, '[data-testid="spending-entry-account"]', 'Cash')
      await typeAmount(page, press, 'spending-entry-amount', '1.5')
      await choose(page, press, await page.$('[data-testid="spending-entry-category"]'), words.spendingStarter.Groceries)
      await fill(page, 'spending-entry-payee', payee)
      await pressSelector(page, press, '[data-testid="spending-entry-save"]')
      await toast(page, words.spendingEntries.dialog.added)
      const offered = await page.evaluate((selector, wanted) => [...document.querySelectorAll(`${selector} button`)].some((element) => element.textContent?.trim() === wanted), TOAST, quick.make)
      if (offered !== (time === 3)) throw new Error(`entry ${time} of three ${offered ? 'offers' : 'does not offer'} a quick add`)
      if (time < 3) await dismissToasts(page)
    }
    await inspect?.('the toast that offers a quick add')
    await shoot('spending-shortcut-offer')
    await pressToastButton(page, press, quick.make)
    await toast(page, quick.made)
    await quickAddButton(page, payee)
    await inspect?.('the Quick add card with the new quick add')
    await shoot('spending-shortcut-offer-made')
  }
}

/** On Settings, Quick add of the sample Spending file: the coffee's dialog with its two parts, a third part added and taken off again. */
export function spendingShortcutDialogFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs?.(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-shortcuts"]', { visible: true, timeout: 10_000 })
    await inspect?.('Settings, Quick add')
    await shoot('spending-settings-quick-add')
    await pressSelector(page, press, '[data-testid="spending-shortcut-edit"]')
    await page.waitForSelector('[data-testid="spending-shortcut-dialog"]', { visible: true, timeout: 10_000 })
    await delay(300)
    const parts = () => page.$$eval('[data-testid="spending-shortcut-part"]', (found) => found.length)
    if ((await parts()) !== 2) throw new Error('the coffee quick add does not show its coffee and its tip')
    if ((await page.$('[data-testid="spending-shortcut-total"]')) === null) throw new Error('the quick add dialog does not say what a tap writes')
    await inspect?.('the quick add dialog with two parts')
    await shoot('spending-shortcut-dialog')
    await pressSelector(page, press, '[data-testid="spending-shortcut-add-part"]')
    if ((await parts()) !== 3) throw new Error('Add a part added no part')
    await pressSelector(page, press, '[data-testid="spending-shortcut-part"]:last-child [data-testid="spending-shortcut-remove-part"]')
    if ((await parts()) !== 2) throw new Error('Remove did not take the part off')
    const payee = await pressSelector(page, press, '[data-testid="spending-shortcut-payee"]')
    const held = await payee.evaluate((element) => element.value)
    await payee.evaluate((element) => element.select())
    await page.keyboard.type(held.slice(0, 3))
    await page.waitForSelector('[role="listbox"] [role="option"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the quick add payee field offers no known payees')
    })
    await delay(300)
    await shoot('spending-shortcut-payees')
    await page.keyboard.press('Escape')
  }
}

const SPENDING_PAYEE_WORDS = { en: spendingPayeesEnglish, hr: spendingPayeesCroatian }

/**
 * On the sample Spending file's Payees: This month and All time each keep the period in the address, and Last 12 months
 * takes it out again. The largest payee of money out opens their page on the period, showing the money out the row showed, and
 * its Money out tile opens Entries on the same months filtered to them, with a chip for each and the same total, on Last 12
 * months and again on All time. The payee's chip takes the payee off.
 */
export function spendingPayeesFlowIn(language) {
  const words = SPENDING_PAYEE_WORDS[language]
  const lastTwelveMonths = SCREEN_WORDS[language].spendingEntries.filters.lastTwelveMonths
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-payees-paid"]', { visible: true, timeout: 10_000 })
    for (const [label, period] of [
      [words.period.month, 'month'],
      [words.period.all, 'all'],
      [words.period.year, null],
    ]) {
      await pressButton(page, press, '[data-testid="spending-payees-period"] button', label)
      await page
        .waitForFunction((wanted) => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('period') === wanted, { timeout: 5_000 }, period)
        .catch(() => {
          throw new Error(`${label} left the address at ${page.url()}`)
        })
    }
    await inspect?.('the Payees tab')
    await shoot('spending-payees')
    const { name } = await openPayeeEntries(page, press, 'last-12-months', () => shoot('spending-payee'))
    const phone = (await page.$('[data-testid="spending-filter-chips"]')) !== null
    if (phone) await expectNoFittingChipFolded(page)
    // A phone's one line of chips folds those it has no room for behind "+N more", whose pop-up lists them.
    const more = phone ? await page.$('[data-testid="spending-filter-chips"] [data-testid="more-filters"]') : null
    if (more !== null) {
      await press(more)
      await page.waitForSelector('[data-reka-popper-content-wrapper] button', { visible: true, timeout: 5_000 })
      await delay(250)
    }
    const chips = phone
      ? [...(await page.$$('[data-testid="spending-filter-chips"] [data-testid="filter-chip"]')), ...(await page.$$('[data-reka-popper-content-wrapper] button'))]
      : [await page.$('[data-testid="spending-filter-month"]'), await page.$('[data-testid="spending-filter-payee"]')]
    const chipTexts = await Promise.all(chips.map((chip) => chip.evaluate((element) => element.textContent?.trim() ?? '')))
    if (chipTexts.join('|') !== `${lastTwelveMonths}|${name}`) throw new Error(`Entries opened from ${name} shows ${chipTexts.join(', ')}, not ${lastTwelveMonths} and ${name}`)
    await inspect?.("a payee's entries")
    await shoot('spending-entries-by-payee')
    const chip = chips[1]
    await press(chip)
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="spending-filter-total"]') && !new URLSearchParams(window.location.hash.split('?')[1] ?? '').has('payee'), { timeout: 5_000 })
      .catch(() => {
        throw new Error("the payee's chip did not take the payee off")
      })
    await page.evaluate(() => (window.location.hash = '#/spending/payees?period=all'))
    await page.waitForSelector('[data-testid="spending-payees-paid"] [data-testid="spending-payee-open"]', { visible: true, timeout: 10_000 })
    await openPayeeEntries(page, press, 'all')
  }
}

/**
 * Opens the largest payee of money out on Payees, checks that their page keeps the period and shows the money out the row showed,
 * then opens Entries from the page's Money out tile and checks it shows the months of the period and sums the same. Gives the
 * payee's name.
 */
async function openPayeeEntries(page, press, months, onPage = async () => {}) {
  const period = new URLSearchParams(page.url().split('#')[1]?.split('?')[1] ?? '').get('period')
  const first = await page.waitForSelector('[data-testid="spending-payees-paid"] [data-testid="spending-payee-open"]', { visible: true, timeout: 5_000 })
  const name = await first.$eval('.list-row-title', (title) => title.textContent?.trim() ?? '')
  const paid = await first.$eval('[data-amount]', (amount) => amount.getAttribute('data-amount'))
  await first.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(first)
  const tile = await page.waitForSelector('[data-testid="spending-payee-out"]', { visible: true, timeout: 10_000 })
  const address = await page.evaluate(() => ({ path: window.location.hash.split('?')[0], period: new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('period') }))
  if (address.path !== '#/spending/payee' || address.period !== period)
    throw new Error(`${name} on Payees opened ${address.path} on ${address.period ?? 'Last 12 months'}, not their page on ${period ?? 'Last 12 months'}`)
  const title = await page.$eval('[data-testid="screen-title"]', (heading) => heading.textContent?.trim() ?? '')
  if (title !== name) throw new Error(`${name} on Payees opened the page of ${title}`)
  const shown = await tile.$eval('[data-amount]', (amount) => amount.getAttribute('data-amount'))
  if (shown !== paid) throw new Error(`${name}'s page shows ${shown} out where Payees shows ${paid}`)
  await onPage()
  const link = await tile.$('a')
  await link.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(link)
  await page.waitForSelector('[data-testid="spending-filter-total"]', { visible: true, timeout: 10_000 })
  const opened = await page.evaluate(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('month'))
  if (opened !== months) throw new Error(`Entries opened from ${name}'s page shows ${opened ?? 'this month'}, not ${months}`)
  const total = await page.$eval('[data-testid="spending-filter-total"]', (row) => ({ text: row.textContent ?? '', spent: row.querySelector('[data-spent]')?.getAttribute('data-spent') ?? null }))
  if (!total.text.includes(name)) throw new Error(`Entries opened from ${name} sums up another: ${total.text}`)
  if (total.spent !== paid) throw new Error(`Entries opened from ${name} sums ${total.spent} where Payees shows ${paid}`)
  return { name }
}

/** Every one line of filter chips folds a chip behind "+N more" only when that chip has no room left beside Clear. */
async function expectNoFittingChipFolded(page) {
  const fitting = await page.$$eval('[data-testid="filter-chip-copy"]', (copies) =>
    copies.flatMap((copy) => {
      const line = copy.parentElement
      if (line?.querySelector('[data-testid="more-filters"]') === null) return []
      const shown = line.querySelectorAll('[data-testid="filter-chip"]').length
      const folded = copy.firstElementChild?.children[shown]
      const last = [...line.children].filter((child) => child !== copy).at(-1)
      if (!(folded instanceof HTMLElement) || last === undefined) return []
      const room = line.getBoundingClientRect().right - last.getBoundingClientRect().right
      return folded.offsetWidth + 6 <= room ? [`${folded.textContent?.trim() ?? ''} (${folded.offsetWidth} px folded with ${Math.round(room)} px free)`] : []
    }),
  )
  if (fitting.length > 0) throw new Error(`a chip that fits is folded into "+N more": ${fitting.join(', ')}`)
}

/** On the sample Spending file's Entries: a payee the books do not hold lists only itself as a new payee, which Enter keeps as typed. */
export function spendingPayeeNewFlowIn(language) {
  const words = SPENDING_PAYEE_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await newSpendingEntry(page, press, SCREEN_WORDS[language], 'out')
    const field = await typePayee(page, press, 'Bakery by the port')
    const listed = await payeeOptions(page, 1)
    if (listed[0] !== words.newPayee('Bakery by the port')) throw new Error(`the payee field lists ${listed.join(', ')} for a new payee`)
    await delay(250)
    await inspect?.('a new payee in the payee list')
    await shoot('spending-entry-new-payee')
    await page.keyboard.press('Enter')
    await payeeListGone(page)
    await payeeTyped(field, 'Bakery by the port', 'Enter on a new payee')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/**
 * On the sample Spending file's Entries: a known payee typed in full, in other case, is that payee and fills the empty category
 * with the one its entries usually go under and says so, and a category picked by hand takes the line away.
 */
export function spendingPayeeMemoryFlowIn(language) {
  const words = SPENDING_PAYEE_WORDS[language]
  const screen = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await newSpendingEntry(page, press, screen, 'out')
    const field = await typePayee(page, press, 'corner market')
    await page.keyboard.press('Escape')
    await payeeListGone(page)
    await payeeTyped(field, 'corner market', 'Escape on the payee list')
    const category = await page.$eval('[data-testid="spending-entry-category"]', (trigger) => trigger.textContent?.trim() ?? '')
    if (category !== screen.spendingStarter.Groceries) throw new Error(`Corner market filled the category with ${category || 'nothing'}, not ${screen.spendingStarter.Groceries}`)
    const help = () =>
      page.$$eval('[data-testid="spending-entry-dialog"] [id$="-help"], [data-testid="spending-entry-dialog"] [data-slot="help"]', (lines) => lines.map((line) => line.textContent?.trim() ?? ''))
    if (!(await help()).includes(words.filledFromPayee)) throw new Error('the category filled from the payee does not say so')
    await delay(250)
    await inspect?.('a category filled from the payee')
    await shoot('spending-entry-payee-memory')
    await choose(page, press, await page.$('[data-testid="spending-entry-category"]'), screen.spendingStarter['Eating out'])
    if ((await help()).includes(words.filledFromPayee)) throw new Error('a category picked by hand still says the payee filled it')
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/**
 * The sample OTP account's dialog takes any bank's name: it opens with the bank the file names, offers the book's other bank as
 * a name is typed, and marks a name no account has as a new bank.
 */
export function spendingAccountBankNameFlowIn(language) {
  const ui = language === 'en' ? uiEnglish : uiCroatian
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openAccountDialog(page, press)
    const field = '[data-testid="spending-account-bank"]'
    const named = await page.$eval(`input${field}, ${field} input`, (input) => input.value)
    if (named !== 'OTP banka') throw new Error(`the account dialog names the bank "${named}", not OTP banka`)
    const input = await pressSelector(page, press, `input${field}, ${field} input`)
    await input.evaluate((element) => element.select())
    await page.keyboard.type('Erste')
    const offered = await page
      .waitForFunction(() => [...document.querySelectorAll('[role="listbox"] [role="option"]')].map((option) => option.textContent?.trim() ?? ''), { timeout: 5_000 })
      .then((handle) => handle.jsonValue())
    if (offered[0] !== ui.bankName.fresh('Erste')) throw new Error(`the bank field offers ${offered.join(', ')} for a new bank`)
    await delay(250)
    await inspect?.('the bank field with a new bank typed')
    await shoot('spending-account-bank-name')
  }
}

/** Picks the link picker's option whose text holds the words, on the entry dialog open. */
async function pickLinkTarget(page, press, wanted) {
  const picker = await page.waitForSelector('[data-testid="spending-entry-link-target"]', { visible: true })
  await picker.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(picker)
  const option = await page
    .waitForFunction((text) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.includes(text)) ?? null, { timeout: 5_000 }, wanted)
    .then((handle) => handle.asElement())
  await press(option)
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

/**
 * The assets set beside the sample Assets file: the land registry fee waiting on To review links as the plot's purchase and
 * leaves under Bought assets, the car's waiting roadside cover links as a cost of the car with the dialog's Category filled
 * from its last cost while a changed note turns Link off, and the car service split by hand offers its parts once a cost of the car is picked.
 */
export function spendingAssetLinkFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const links = words.spendingLinks
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Land registry', -9500)
    await pickLinkTarget(page, press, links.assets.uses.bought('Plot by the sea'))
    await waitForTextIn(page, '[data-testid="spending-entry-link-note"]', words.spendingStarter['Bought assets'])
    await inspect?.('the entry dialog linking a row as the purchase of an asset')
    await shootAt(page, shoot, '[data-testid="spending-entry-link-pick"]', 'spending-entry-asset-bought')
    await press(await page.waitForSelector('[data-testid="spending-entry-link-add"]:not([disabled])', { visible: true }))
    await toast(page, links.linked)
    await dismissToasts(page)
    await openSpendingRow(page, press, 'Example Insurance', -6240)
    await pickLinkTarget(page, press, links.assets.uses.cost('Family car'))
    await waitForTextIn(page, '[data-testid="spending-entry-category"]', words.spendingStarter['Car registration and insurance'])
    await page.waitForSelector('[data-testid="spending-entry-link-add"]:not([disabled])', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('filling Category from the asset turned Link off')
    })
    await inspect?.('the entry dialog linking a waiting row as a cost of an asset, with its Category filled')
    await shootAt(page, shoot, '[data-testid="spending-entry-link-pick"]', 'spending-entry-asset-cost', { block: 'end' })
    const note = await page.$eval('[data-testid="spending-entry-note"]', (input) => input.value)
    await fill(page, 'spending-entry-note', `${note} changed`)
    await page.waitForSelector('[data-testid="spending-entry-link-add"][disabled]', { timeout: 5_000 }).catch(() => {
      throw new Error('a changed note left Link on')
    })
    await fill(page, 'spending-entry-note', note)
    await press(await page.waitForSelector('[data-testid="spending-entry-link-add"]:not([disabled])', { visible: true }))
    await toast(page, links.linked)
    await dismissToasts(page)
    await openSpendingRow(page, press, 'Example Car Service', -30000)
    await pickLinkTarget(page, press, links.assets.uses.cost('Family car'))
    const parts = await page.waitForSelector('[data-testid="spending-entry-link-parts"]', { visible: true, timeout: 5_000 })
    await inspect?.('the entry dialog linking some parts of a split row to an asset')
    await shootAt(page, shoot, '[data-testid="spending-entry-link-pick"]', 'spending-entry-asset-parts')
    await press(parts)
    await page.waitForSelector('[role="listbox"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await shoot('spending-entry-asset-parts-open')
    await page.keyboard.press('Escape')
    await delay(200)
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}

/** Waits for the focus to sit inside the element the selector finds. */
async function focusIsIn(page, selector, problem) {
  await page
    .waitForFunction((within) => document.activeElement?.closest(within) != null, { timeout: 5_000 }, selector)
    .catch(() => {
      throw new Error(problem)
    })
}

/**
 * On OTP's page in the statements set with the bank sync linked and a transfer on hold: the card of where its rows come from lists
 * the statement file and then the bank. Each Change opens the account dialog with that period's first day focused, the start day
 * for the first, and giving every day to the bank link warns which file rows go first. Keeping the bank's days by hand deletes
 * only the row on hold, so the warning says so in its title and lists no rows.
 */
export function spendingAccountHandoverFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="spending-account-sources-card"]', { visible: true, timeout: 10_000 })
    await waitForTextIn(page, '[data-testid="spending-account-sources-card"]', words.spendingAccounts.rowsFrom['provider-file'])
    await shootAt(page, shoot, '[data-testid="spending-account-sources-card"]', 'spending-account-sources')
    await pressSelector(page, press, '[data-testid="spending-account-sources-card"] [data-testid="change-line"]:nth-child(2) [data-testid="change-edit"]')
    await page.waitForSelector(SPENDING_ACCOUNT_DIALOG, { visible: true, timeout: 10_000 })
    await focusIsIn(page, '[data-testid="spending-account-source-from"]', "the bank link's Change does not focus the day it starts on")
    await page.keyboard.press('Escape')
    await page.waitForSelector(SPENDING_ACCOUNT_DIALOG, { hidden: true, timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="spending-account-sources-card"] [data-testid="change-edit"]')
    await page.waitForSelector(SPENDING_ACCOUNT_DIALOG, { visible: true, timeout: 10_000 })
    await focusIsIn(page, '[data-testid="spending-account-opened-on"]', "the statement file's Change does not focus the start day")
    await pressSelector(page, press, '[data-testid="spending-account-source-remove"]')
    await pressSelector(page, press, '[data-testid="spending-account-rows-from"] [data-value="bank-link"]')
    await page.waitForSelector('[data-testid="spending-account-handover"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('giving the statement file days to the bank link shows no warning of the rows that go')
    })
    const save = await page.$eval('[data-testid="spending-account-save"]', (button) => button.textContent?.trim() ?? '')
    if (save !== words.spendingAccounts.dialog.cutover.save) throw new Error(`the dialog saves the handover with "${save}"`)
    await scrollIntoDialogView(page, '[data-testid="spending-account-handover"]')
    await delay(300)
    await inspect?.('the account dialog warning which rows go when the bank link takes the statement file days')
    await shoot('spending-account-handover')
    await page.keyboard.press('Escape')
    await page.waitForSelector(SPENDING_ACCOUNT_DIALOG, { hidden: true, timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="spending-account-sources-card"] [data-testid="change-line"]:nth-child(2) [data-testid="change-edit"]')
    await page.waitForSelector(SPENDING_ACCOUNT_DIALOG, { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-account-source"] [data-value="by-hand"]')
    await waitForTextIn(page, '[data-testid="spending-account-handover"]', words.spendingAccounts.dialog.handover.heldTitle(1).one).catch(() => {
      throw new Error('keeping the bank days by hand does not warn that the row on hold goes')
    })
    if ((await page.$('[data-testid="spending-account-handover"] ul')) !== null) throw new Error('the warning of a row on hold alone draws a list of rows')
    await scrollIntoDialogView(page, '[data-testid="spending-account-handover"]')
    await delay(300)
    await inspect?.('the account dialog warning that only a bank row on hold goes when the bank days are kept by hand')
    await shoot('spending-account-handover-held')
  }
}

/** What the address of the page names in `?key=`. */
async function addressQuery(page, key) {
  return page.evaluate((wanted) => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(wanted), key)
}

/**
 * On the people Spending file's page of Corner market: the average tile opens Entries over the whole months it reads for them,
 * and a saved entry opened from the page has no link back to the page it is on. Edit details opens the dialog filled from the
 * record, a note saved shows on the page and one Undo takes it off, the spelling CORNER MARKET D.O.O. shows as a tag with how
 * many entries leave with it and, taken off, goes from the page until one Undo, a rename keeps the page and its old name among the other
 * names until Undo, and Same payee as joins Ana Horvat in until Undo. On Entries filtered to Corner market, the name in the
 * totals line opens the page on the period Entries shows, and a saved entry's dialog links its payee's page and closes.
 */
export function spendingPayeeDetailsFlowIn(language) {
  const words = SPENDING_PAYEE_WORDS[language]
  const shared = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const title = () => page.$eval('[data-testid="screen-title"]', (heading) => heading.textContent?.trim() ?? '')
    const pageHeader = () => page.$eval('[data-testid="screen-title"]', (heading) => heading.closest('header')?.textContent ?? '')
    await page.waitForSelector('[data-testid="spending-payee-average"]', { visible: true, timeout: 10_000 })
    const average = await page.$eval('[data-testid="spending-payee-average"] a', (link) => link.getAttribute('href') ?? '')
    const averaged = new URLSearchParams(average.split('?')[1] ?? '')
    if (averaged.get('payee') !== 'CORNER MARKET' || !/^\d{4}-\d{2}-01$/.test(averaged.get('from') ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(averaged.get('to') ?? ''))
      throw new Error(`the average tile opens ${average}, not Corner market's entries over the months it reads`)

    await pressSelector(page, press, '[data-testid="spending-payee-entries"] [data-testid="spending-row"]')
    await page.waitForSelector('[data-testid="spending-entry-dialog"]', { visible: true, timeout: 10_000 })
    await delay(300)
    if ((await page.$('[data-testid="spending-entry-payee-page"]')) !== null) throw new Error("a saved entry opened on its payee's page links to that same page")
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="spending-entry-dialog"]'), { timeout: 5_000 })

    await pressSelector(page, press, '[data-testid="spending-payee-edit"]')
    await page.waitForSelector('[data-testid="spending-payee-dialog"]', { visible: true, timeout: 10_000 })
    const shown = await page.$eval('[data-testid="spending-payee-dialog"]', (dialog) => dialog.textContent ?? '')
    const name = await page.$eval('[data-testid="spending-payee-name"]', (input) => (input instanceof HTMLInputElement ? input.value : (input.querySelector('input')?.value ?? '')))
    if (name !== 'Corner market' || !shown.includes('CORNER MARKET D.O.O.') || !shown.includes('HR6212345670000000001'))
      throw new Error(`the details dialog opens on ${name}, not filled from Corner market's record: ${shown.slice(0, 200)}`)
    const ibanTags = await page.$$eval('[data-testid="spending-payee-dialog"] [data-slot="itemText"]', (tags) => tags.map((tag) => (tag.textContent ?? '').trim().replace(/\s+/g, ' ')))
    if (ibanTags.length === 0 || !ibanTags.every((tag) => /^HR\d{19} · \d+ \S+$/.test(tag)))
      throw new Error(`the IBAN tags read ${ibanTags.join(', ')}, not each IBAN with how many entries leave with it`)
    await delay(300)
    await inspect?.("a payee's details dialog")
    await shoot('spending-payee-dialog')

    const note = await page.$('[data-testid="spending-payee-note"] textarea, textarea[data-testid="spending-payee-note"]')
    await note.evaluate((element) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      setter.call(element, 'Open on Sundays')
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await pressSelector(page, press, '[data-testid="spending-payee-save"]')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="spending-payee-details"]')?.textContent?.includes('Open on Sundays'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('the note saved in the details dialog does not show on the page')
      })
    await page.waitForFunction(() => !document.querySelector('[data-testid="spending-payee-dialog"]'), { timeout: 5_000 })
    await undoIn(page, press, shared)
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="spending-payee-details"]')?.textContent?.includes('Open on Sundays'), { timeout: 10_000 })
      .catch(() => {
        throw new Error("Undo left the note on the payee's page")
      })
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="spending-payee-edit"]')
    const spelling = await page.waitForSelector('[data-testid="spending-payee-other-names"] [data-name="CORNER MARKET D.O.O."]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the details dialog does not show CORNER MARKET D.O.O. as a spelling to take off')
    })
    const tag = (await spelling.evaluate((chip) => chip.textContent?.trim() ?? '')).replace(/\s+/g, ' ')
    if (!/^CORNER MARKET D\.O\.O\. · \d+ \S+$/.test(tag)) throw new Error(`the spelling's tag reads ${tag}, not the spelling with how many entries leave with it`)
    await spelling.click()
    await page.waitForSelector('[data-testid="spending-payee-other-names"] [data-name="CORNER MARKET D.O.O."]', { hidden: true, timeout: 5_000 }).catch(() => {
      throw new Error('pressing the spelling did not take it off')
    })
    await pressSelector(page, press, '[data-testid="spending-payee-save"]')
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="screen-title"]')?.closest('header')?.textContent?.includes('CORNER MARKET D.O.O.'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('the spelling taken off still shows on the page after Save')
      })
    await page.waitForFunction(() => !document.querySelector('[data-testid="spending-payee-dialog"]'), { timeout: 5_000 })
    await undoIn(page, press, shared)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="screen-title"]')?.closest('header')?.textContent?.includes('CORNER MARKET D.O.O.'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('Undo did not put the spelling back')
      })
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="spending-payee-edit"]')
    await fill(page, 'spending-payee-name', 'Corner shop')
    await pressSelector(page, press, '[data-testid="spending-payee-save"]')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === 'Corner shop', { timeout: 10_000 })
      .catch(() => {
        throw new Error('the page does not show the new name after a rename')
      })
    const renamed = await pageHeader()
    if (!renamed.includes('Corner market')) throw new Error(`a rename does not keep the old name among the other names: ${renamed}`)
    await page.waitForFunction(() => !document.querySelector('[data-testid="spending-payee-dialog"]'), { timeout: 5_000 })
    await undoIn(page, press, shared)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === 'Corner market', { timeout: 10_000 })
      .catch(() => {
        throw new Error('Undo did not put the old name back')
      })
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="spending-payee-edit"]')
    await choose(page, press, await page.$('[data-testid="spending-payee-same-as"]'), 'Ana Horvat')
    await delay(300)
    await inspect?.('a payee to join picked in the details dialog')
    await shoot('spending-payee-dialog-join')
    await pressSelector(page, press, '[data-testid="spending-payee-save"]')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="screen-title"]')?.closest('header')?.textContent?.includes('Ana Horvat'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('Same payee as did not join Ana Horvat into Corner market')
      })
    await page.waitForFunction(() => !document.querySelector('[data-testid="spending-payee-dialog"]'), { timeout: 5_000 })
    await undoIn(page, press, shared)
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="screen-title"]')?.closest('header')?.textContent?.includes('Ana Horvat'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('Undo did not take Ana Horvat back out')
      })
    await dismissToasts(page)
    if ((await title()) !== 'Corner market') throw new Error(`the page shows ${await title()} after the joins were undone`)

    await page.evaluate(() => (window.location.hash = '#/spending/transactions?month=all&payee=CORNER%20MARKET'))
    const named = await page.waitForSelector('[data-testid="spending-filter-payee-page"]', { visible: true, timeout: 10_000 })
    const target = await named.evaluate((link) => link.getAttribute('href') ?? '')
    const opens = new URLSearchParams(target.split('?')[1] ?? '')
    if (!target.includes('/spending/payee?') || opens.get('payee') !== 'CORNER MARKET' || opens.get('period') !== 'all')
      throw new Error(`the payee's name in the totals line opens ${target}, not Corner market's page on All time`)
    await delay(300)
    await inspect?.("Entries' totals line with the payee's name as a link")
    await shoot('spending-entries-payee-link')

    await pressSelector(page, press, '[data-testid="spending-row"]')
    const link = await page.waitForSelector('[data-testid="spending-entry-payee-page"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error("a saved entry's dialog on Entries has no link to its payee's page")
    })
    if ((await link.evaluate((element) => element.textContent?.trim())) !== words.page.open('Corner market')) throw new Error("the entry dialog's payee link does not name Corner market")
    await delay(300)
    await inspect?.("the entry dialog's link to its payee's page")
    await shoot('spending-entry-payee-link')
    const savedNote = await page.$eval('[data-testid="spending-entry-note"]', (input) => input.value)
    await fill(page, 'spending-entry-note', `${savedNote} changed`)
    await page.waitForSelector('[data-testid="spending-entry-payee-page"]', { hidden: true, timeout: 5_000 }).catch(() => {
      throw new Error('the entry dialog kept its payee page link while it held a change that leaving would lose')
    })
    await fill(page, 'spending-entry-note', savedNote)
    const unchanged = await page.waitForSelector('[data-testid="spending-entry-payee-page"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('the entry dialog did not bring back its payee page link once the change was undone')
    })
    await unchanged.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(unchanged)
    await page
      .waitForFunction(() => window.location.hash.startsWith('#/spending/payee?') && !document.querySelector('[data-testid="spending-entry-dialog"]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error("the entry dialog's payee link did not open the page and close the dialog")
      })
    if ((await addressQuery(page, 'payee')) !== 'CORNER MARKET') throw new Error(`the entry dialog's payee link opened ${page.url()}`)
  }
}
