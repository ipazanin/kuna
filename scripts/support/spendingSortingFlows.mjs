/**
 * Spending's sorting flows that the visual and the touch check share: rules, categories, limits, labels, events and
 * recipes. `press` clicks or taps an element handle, and `shoot` takes a screenshot under a name. Each flow starts on its
 * screen and leaves the workbook as it found it. A failure throws with what was missing.
 */

import { formatMoney } from '../../src/shared/money/moneyFormat.ts'
import { delay, pressSelector } from './pressing.mjs'
import {
  MONEY_FORMATS,
  SCREEN_WORDS,
  SPENDING_ENTRY_DIALOG,
  TOAST,
  choose,
  chooseAt,
  chooseCategory,
  chooseStartingWith,
  clearChoice,
  countOf,
  countedIn,
  dialogGone,
  dismissToasts,
  elementSays,
  fill,
  goTo,
  openCard,
  pressButton,
  shootAt,
  toast,
  toastMatching,
  triggerReads,
  undoIn,
} from './flowHelpers.mjs'
import { centreOn, dropSpendingFile, newSpendingEntry, openSpendingRow, payeeListGone, reviewRowOf, saveSpendingEntry, spendingRowShown, typeAmount, typePayee } from './spendingFlows.mjs'

/** The name a Spending flow gives a starter category, as anyone might type it. */
const SPENDING_RENAMED = 'Takeaway and delivery'

/**
 * On To review with the statements set: the first City pharmacy row takes a category, Always for this payee on its toast
 * says it files one row and can be cancelled, and confirmed it files the other row by the same IBAN, and the rule shows on Settings, Rules, where deleting it sends that row back.
 */
export function spendingRuleFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { review, rules } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const ROW = '[data-testid="spending-review-row"]'
    await countOf(page, ROW, 6, 'the set should wait with six rows')
    const fileThenAsk = async () => {
      const row = await reviewRowOf(page, 'City pharmacy')
      await choose(page, press, await row.$('[data-testid="spending-review-category"]'), words.spendingStarter.Pharmacy)
      await toast(page, review.filed)
      await countOf(page, ROW, 5, 'a category should take the row off review')
      const always = await page.waitForFunction(
        (label) => [...document.querySelectorAll('[data-sonner-toast] button, [role="alert"] button, li button')].find((button) => button.textContent?.trim() === label) ?? null,
        { timeout: 5_000 },
        review.always,
      )
      await press(always.asElement())
      const wanted = countedIn(words, rules.apply.changes(1), 1)
      await page
        .waitForFunction((text) => document.querySelector('[data-testid="spending-rule-files"]')?.textContent?.trim() === text, { timeout: 10_000 }, wanted)
        .catch(() => {
          throw new Error(`the rule dialog does not say "${wanted}"`)
        })
      await delay(300)
    }
    await fileThenAsk()
    await inspect?.('the rule dialog with how many rows already in the book it changes, Apply and Only new rows')
    await shoot('spending-rule-asks')
    await pressSelector(page, press, '[data-testid="spending-rule-cancel"]')
    await page.waitForFunction(() => document.querySelector('[data-testid="spending-rule-files"]') === null, { timeout: 5_000 })
    await countOf(page, ROW, 5, 'Cancel should file nothing more')
    await dismissToasts(page)
    // A fresh load seeds the set again, with no rule written.
    await page.reload({ waitUntil: 'load' })
    await countOf(page, ROW, 6, 'a fresh load should wait with six rows')
    await fileThenAsk()
    await pressSelector(page, press, '[data-testid="spending-rule-confirm"]')
    await toast(page, rules.made)
    await countOf(page, ROW, 4, 'the rule should file the other row of that payee')
    await inspect?.('To review after a rule')
    await dismissToasts(page)
    await page.evaluate(() => {
      window.location.hash = '#/spending/sorting#rules'
    })
    await page.waitForSelector('[data-testid="spending-rule"]', { visible: true, timeout: 10_000 })
    await countOf(page, '[data-testid="spending-rule"]', 5, 'Sorting should list the five rules')
    await delay(300)
    await inspect?.('Sorting with the new rule')
    await shoot('spending-rule-made')
    const buttons = await page.$$('[data-testid="spending-rule-delete"]')
    await press(buttons.at(-1))
    // The rule filed a row, so Delete asks whether it follows the rules that are left.
    await page.waitForSelector('[data-testid="spending-rule-apply-dialog"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('Delete on a rule that filed rows does not ask whether they follow the rules that are left')
    })
    await delay(300)
    await inspect?.('Delete asking whether the rows the rule filed follow the rules that are left')
    await shoot('spending-rule-delete-asks')
    await pressSelector(page, press, '[data-testid="spending-rule-confirm"]')
    await toast(page, rules.deleted)
    await countOf(page, '[data-testid="spending-rule"]', 4, 'Delete should take the rule off')
    await undoIn(page, press, words)
    await countOf(page, '[data-testid="spending-rule"]', 5, 'Undo should bring the rule back')
    await dismissToasts(page)
  }
}

/** Sets a textarea the way typing does, so Vue's v-model sees it. */
async function setTextArea(textarea, value) {
  await textarea.evaluate((element, text) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    setter.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

/** The rule on Spending's Settings, Rules whose text holds these words. */
async function spendingRuleOf(page, words) {
  return page
    .waitForFunction((wanted) => [...document.querySelectorAll('[data-testid="spending-rule"]')].find((row) => row.textContent?.includes(wanted)) ?? null, { timeout: 10_000 }, words)
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no rule that reads "${words}"`)
    })
}

/** The condition at `place` in the rule dialog, its test picked and its values typed. */
async function fillCondition(page, press, place, test, values) {
  const conditions = await page.$$('[data-testid="spending-rule-condition"]')
  const condition = conditions[place]
  if (condition === undefined) throw new Error(`no condition ${place + 1} in the rule dialog`)
  await choose(page, press, await condition.$('[data-testid="spending-rule-condition-test"]'), test)
  if (values !== null) await setTextArea(await condition.$('textarea'), values)
  return condition
}

/**
 * On Settings, Rules with the statements set, whose rules show in the order they are tried: Add a rule files three Ina stations
 * into Fuel as one condition with three values, saved at once since no row already in the book changes, with one Undo. A rule for
 * Corner into Eating out then saves behind the Groceries rule, which the card warns about on the rows both fit, and moving it up
 * puts it first.
 */
export function spendingRulesAddFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { rules } = words.spendingStatements
  const fuel = words.spendingStarter.Fuel
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const RULE = '[data-testid="spending-rule"]'
    const OVERLAP = '[data-testid="spending-rule-overlap"]'
    await countOf(page, RULE, 4, 'the set should start with four rules')
    await pressSelector(page, press, '[data-testid="spending-rules-add"]')
    await page.waitForSelector('[data-testid="spending-rule-dialog"]', { visible: true, timeout: 5_000 })
    await fillCondition(page, press, 0, rules.tests.payee_starts_with, 'Ina Zadar\nIna Pleternica\nIna Kozjak Sjever')
    await chooseCategory(page, press, await page.$('[data-testid="spending-rule-dialog-category"]'), fuel)
    await delay(300)
    await inspect?.('the rule dialog with three payees for Fuel in one condition')
    await shoot('spending-rules-add-dialog')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await toast(page, rules.dialog.saved)
    await countOf(page, RULE, 5, 'the Fuel rule should join the list')
    await spendingRuleOf(page, 'Ina Kozjak Sjever')
    await undoIn(page, press, words)
    await countOf(page, RULE, 4, 'one Undo should take the rule back')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="spending-rules-add"]')
    await page.waitForSelector('[data-testid="spending-rule-dialog"]', { visible: true, timeout: 5_000 })
    await fillCondition(page, press, 0, rules.tests.payee_contains, 'Corner')
    await chooseCategory(page, press, await page.$('[data-testid="spending-rule-dialog-category"]'), words.spendingStarter['Eating out'])
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await toast(page, rules.dialog.saved)
    await countOf(page, RULE, 5, 'the Corner rule should join the list')
    await page.waitForSelector(OVERLAP, { visible: true, timeout: 10_000 })
    await dismissToasts(page)
    await delay(300)
    await inspect?.('Settings, Rules in the order they are tried, warning on the rows two rules fit')
    await shoot('spending-rules-ordered')
    await shootAt(page, shoot, OVERLAP, 'spending-rules-overlap')

    const last = (await page.$$('[data-testid="spending-rule-up"]')).at(-1)
    await press(last)
    await toast(page, rules.moved)
    const tests = await page.$$eval('[data-testid="spending-rule"]', (rows) => rows.map((row) => row.querySelector('[data-testid="spending-rule-test"]')?.textContent?.trim() ?? ''))
    if (!tests.at(-2)?.includes('Corner') || tests.at(-2) === tests[0]) throw new Error(`moving up should put the Corner rule one place earlier, the rules read ${tests.join(' | ')}`)
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/** Shoots and answers Apply when a change to the rules asks whether the rows already in the book follow, which it does only when some would change. */
async function applyIfAsked(page, press, shoot, name) {
  const asked = await page.waitForSelector('[data-testid="spending-rule-apply-dialog"]', { visible: true, timeout: 1_500 }).catch(() => null)
  if (asked === null) return
  await delay(300)
  await shoot(name)
  await pressSelector(page, press, '[data-testid="spending-rule-confirm"]')
}

/** The place of the rule whose first test names Corner alone, not Corner market, in the order the rules are tried. */
async function cornerPlace(page) {
  return page.$$eval('[data-testid="spending-rule"]', (rows) => rows.findIndex((row) => /corner(?! market)/i.test(row.querySelector('[data-testid="spending-rule-test"]')?.textContent ?? '')))
}

/**
 * On Settings, Rules with the statements set: a rule for Corner into Eating out saves behind the Groceries rule for Corner market.
 * Moving it up writes at once past rules that decide no row, and asks Apply or Only new rows, with how many rows would change, once
 * it would pass the Groceries rule. Only new rows writes the new order alone, with one Undo.
 */
export function spendingRulesMoveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { rules } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const RULE = '[data-testid="spending-rule"]'
    const ASKS = '[data-testid="spending-rule-apply-dialog"]'
    await countOf(page, RULE, 4, 'the set should start with four rules')
    await pressSelector(page, press, '[data-testid="spending-rules-add"]')
    await page.waitForSelector('[data-testid="spending-rule-dialog"]', { visible: true, timeout: 5_000 })
    await fillCondition(page, press, 0, rules.tests.payee_contains, 'Corner')
    await chooseCategory(page, press, await page.$('[data-testid="spending-rule-dialog-category"]'), words.spendingStarter['Eating out'])
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await toast(page, rules.dialog.saved)
    await countOf(page, RULE, 5, 'the Corner rule should join the list')
    await dismissToasts(page)
    for (let place = await cornerPlace(page); place > 0; place = await cornerPlace(page)) {
      await press((await page.$$('[data-testid="spending-rule-up"]'))[place])
      const outcome = await page
        .waitForFunction(
          (asks, selector, wanted) =>
            document.querySelector(asks) !== null
              ? 'asked'
              : [...document.querySelectorAll(`${selector} [data-slot="title"]`)].some((element) => element.textContent?.trim() === wanted)
                ? 'moved'
                : null,
          { timeout: 10_000 },
          ASKS,
          TOAST,
          rules.moved,
        )
        .then((handle) => handle.jsonValue())
        .catch(() => {
          throw new Error('moving the Corner rule up neither asked nor said it moved')
        })
      if (outcome === 'asked') break
      await delay(600)
      await dismissToasts(page)
      if ((await cornerPlace(page)) !== place - 1) throw new Error('Moving up should put the Corner rule one place earlier')
    }
    await page.waitForSelector(ASKS, { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('moving the Corner rule past the Groceries rule does not ask whether the rows already in the book follow')
    })
    const said = await page.$eval('[data-testid="spending-rule-files"]', (element) => element.textContent?.trim() ?? '')
    if (said === rules.apply.nothing) throw new Error('the move question says no row would change')
    await delay(300)
    await inspect?.('moving a rule asking Apply or Only new rows, with how many rows would change')
    await shoot('spending-rules-move-asks')
    await pressSelector(page, press, '[data-testid="spending-rule-only-new"]')
    await toast(page, rules.moved)
    if ((await cornerPlace(page)) !== 0) throw new Error('Only new rows should still move the Corner rule first')
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/**
 * On Settings, Rules with the statements set: a rule of several conditions, City pharmacy at the start of the payee, money out and an
 * account that is not Revolut, files into Pharmacy with a label and Stop here. Saving asks whether the waiting rows follow it with
 * how many would change, Only new rows writes the rule alone, and the rule reads its conditions one to a line with its label and
 * Stop here. One Undo takes it back.
 */
export function spendingRulesConditionsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { rules } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const RULE = '[data-testid="spending-rule"]'
    await countOf(page, RULE, 4, 'the set should start with four rules')
    await pressSelector(page, press, '[data-testid="spending-rules-add"]')
    await page.waitForSelector('[data-testid="spending-rule-dialog"]', { visible: true, timeout: 5_000 })
    await fillCondition(page, press, 0, rules.tests.payee_starts_with, 'City pharmacy')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-add-condition"]')
    await countOf(page, '[data-testid="spending-rule-condition"]', 2, 'Add a condition should add a second one')
    await fillCondition(page, press, 1, rules.tests.money_out, null)
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-add-condition"]')
    const account = await fillCondition(page, press, 2, rules.tests.accounts, null)
    await press(await account.$('[data-testid="spending-rule-condition-accounts"]'))
    const revolut = await page
      .waitForFunction(() => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim() === 'Revolut EUR') ?? null, { timeout: 5_000 })
      .catch(() => {
        throw new Error('the accounts of a condition do not offer Revolut EUR')
      })
    await press(revolut.asElement())
    // A list that picks several stays open, so a second tap on its field closes it.
    await press(await account.$('[data-testid="spending-rule-condition-accounts"]'))
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await press(await account.$('[data-testid="spending-rule-condition-not"]'))
    await chooseCategory(page, press, await page.$('[data-testid="spending-rule-dialog-category"]'), words.spendingStarter.Pharmacy)
    await press(await page.$('[data-testid="spending-rule-dialog-stop"]'))
    await delay(300)
    await inspect?.('the rule dialog with three conditions, one turned around, and Stop here')
    await shoot('spending-rules-conditions-dialog')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await page.waitForSelector('[data-testid="spending-rule-apply-dialog"]', { visible: true, timeout: 5_000 })
    await delay(300)
    await inspect?.('the question whether rows already in the book follow the rule')
    await shoot('spending-rules-apply')
    await pressSelector(page, press, '[data-testid="spending-rule-only-new"]')
    await toast(page, rules.dialog.saved)
    await countOf(page, RULE, 5, 'Only new rows should still write the rule')
    const made = await spendingRuleOf(page, 'City pharmacy')
    if ((await made.$$('[data-testid="spending-rule-test"]')).length !== 3) throw new Error('the rule should read its three conditions one to a line')
    if ((await made.$('[data-testid="spending-rule-stop"]')) === null) throw new Error('the rule should say Stop here')
    await inspect?.('Settings, Rules with the rule of three conditions, its label and Stop here')
    await shootAt(page, shoot, made, 'spending-rules-conditions')
    await undoIn(page, press, words)
    await countOf(page, RULE, 4, 'one Undo should take the rule back')
    await dismissToasts(page)
  }
}

/**
 * On Settings, Rules with the statements set: the Bankomat rule into Between my accounts says its cash goes to the cash account
 * of its currency, and its dialog offers where the money goes. Picking Cash names that account, and one Undo puts it back.
 */
export function spendingRuleWithdrawalFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { rules } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const group = await spendingRuleOf(page, 'Bankomat')
    await elementSays(page, '[data-testid="spending-rule-goes-to"]', [rules.withdrawalByCurrency], 'the Bankomat rule does not say where its cash goes')
    await shootAt(page, shoot, group, 'spending-rules-withdrawal')
    await press(await group.$('[data-testid="spending-rule-edit"]'))
    await page.waitForSelector('[data-testid="spending-rule-dialog-goes-to"]', { visible: true, timeout: 5_000 })
    await chooseCategory(page, press, await page.$('[data-testid="spending-rule-dialog-goes-to"]'), 'Cash')
    await delay(300)
    await inspect?.('the rule dialog with where the money goes')
    await shoot('spending-rule-dialog-withdrawal')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-save"]')
    await toast(page, rules.dialog.changed)
    await elementSays(page, '[data-testid="spending-rule-goes-to"]', [rules.withdrawalTo('Cash')], 'the Bankomat rule does not name Cash')
    await undoIn(page, press, words)
    await elementSays(page, '[data-testid="spending-rule-goes-to"]', [rules.withdrawalByCurrency], 'Undo did not put the rule back')
    await dismissToasts(page)
  }
}

/** The names of the rows of Spending's categories card, in their order. */
function spendingCategoryNames(page) {
  return page.$$eval('[data-testid="spending-category-row"]', (rows) => rows.map((row) => row.querySelector('.min-w-0')?.firstChild?.textContent?.trim() ?? ''))
}

async function spendingCategoryShown(page, name, shown) {
  await page
    .waitForFunction(
      (wanted, expected) => [...document.querySelectorAll('[data-testid="spending-category-row"] .min-w-0')].some((cell) => cell.textContent?.trim() === wanted) === expected,
      { timeout: 10_000 },
      name,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `the categories card lists no ${name}` : `the categories card still lists ${name}`)
    })
}

/**
 * On the sample Spending file's Settings: Delivery renamed in its dialog, moved up above Eating out, then deleted with its
 * entries moved to Groceries, which takes it off the card until Undo brings it back.
 */
export function spendingCategoryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const categories = words.spendingCategories
  const starter = words.spendingStarter
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, `[data-testid="spending-category-edit"][aria-label="${categories.edit(starter.Delivery)}"]`)
    await page.waitForSelector('[data-testid="spending-category-dialog"]', { visible: true, timeout: 10_000 })
    await fill(page, 'spending-category-name', SPENDING_RENAMED)
    await delay(300)
    await inspect?.('the category dialog')
    await shoot('spending-category-dialog')
    await pressSelector(page, press, '[data-testid="spending-category-save"]')
    await toast(page, categories.saved)
    await dismissToasts(page)
    await spendingCategoryShown(page, SPENDING_RENAMED, true)

    await pressSelector(page, press, `[data-testid="spending-category-up"][aria-label="${categories.moveUp(SPENDING_RENAMED)}"]`)
    await toast(page, categories.moved)
    await dismissToasts(page)
    const order = await spendingCategoryNames(page)
    if (order.indexOf(SPENDING_RENAMED) !== order.indexOf(starter['Eating out']) - 1) throw new Error(`${SPENDING_RENAMED} did not move above ${starter['Eating out']}: ${order.join(', ')}`)

    await pressSelector(page, press, `[data-testid="spending-category-edit"][aria-label="${categories.edit(SPENDING_RENAMED)}"]`)
    await page.waitForSelector('[data-testid="spending-category-dialog"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-category-delete-into"]')
    await choose(page, press, await page.waitForSelector('[data-testid="spending-category-target"]', { visible: true }), starter.Groceries)
    await delay(300)
    await inspect?.('the category dialog moving its entries')
    await shoot('spending-category-delete')
    await pressSelector(page, press, '[data-testid="spending-category-delete"]')
    await toast(page, categories.deleted)
    await spendingCategoryShown(page, SPENDING_RENAMED, false)
    await undoIn(page, press, words)
    await spendingCategoryShown(page, SPENDING_RENAMED, true)
    await inspect?.('the categories card after Undo')
    await dismissToasts(page)
  }
}

/**
 * In a list whose rows move with MoveButtons, the second row's up arrow moves it to the top, where that arrow goes disabled,
 * and focus lands on the moved row's down arrow rather than dropping to the page. `rows` picks the rows in their order, each
 * holding one pair of arrows whose test ids start with `testId`.
 */
export function moveToTopKeepsFocusFlow(rows, testId) {
  return async (page, { press, inspect }) => {
    await page.waitForSelector(`${rows} [data-testid="${testId}-up"]`, { visible: true, timeout: 10_000 })
    const names = () => page.$$eval(rows, (found) => found.map((row) => row.textContent?.trim() ?? ''))
    const [firstName, secondName] = await names()
    if (secondName === undefined) throw new Error(`${rows} has fewer than two rows to move`)
    const up = await (await page.$$(rows))[1].$(`[data-testid="${testId}-up"]`)
    await up.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(up)
    await page
      .waitForFunction(
        (selector, wanted) => {
          const first = document.querySelector(selector)
          return first?.textContent?.trim() === wanted && first.contains(document.activeElement)
        },
        { timeout: 10_000 },
        rows,
        secondName,
      )
      .catch(async () => {
        const order = await names()
        throw new Error(`after Move up the rows start ${order[0] === secondName ? 'with the moved row' : `with ${order[0]}, not ${secondName}`}, and focus is not in the moved row`)
      })
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    if (focused !== `${testId}-down`) throw new Error(`after Move up to the top focus is on ${focused}, not on the moved row's ${testId}-down`)
    if ((await names())[1] !== firstName) throw new Error(`the row that was first is not second after the move`)
    await inspect?.(`${testId} moved to the top with focus on its down arrow`)
  }
}

/**
 * On the sample Spending file's Settings: Coffee's colour pop-up opens Other colour, refuses a code too pale for the light theme and offers a darker one,
 * takes it, warns on a code that looks like Home's orange, and the dialog shows the own colour on its swatch button. Nothing is saved.
 */
export function spendingCategoryColourFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const categories = words.spendingCategories
  const starter = words.spendingStarter
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, `[data-testid="spending-category-edit"][aria-label="${categories.edit(starter['Eating out'])}"]`)
    await page.waitForSelector('[data-testid="spending-category-dialog"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-category-dialog"] [data-testid="colour-swatch-button"]')
    await page.waitForSelector('[data-testid="colour-swatch-picker"]', { visible: true })
    await pressSelector(page, press, '[data-testid="colour-swatch-other"]')
    await page.waitForSelector('[data-testid="colour-swatch-own"]', { visible: true })
    await fill(page, 'colour-swatch-code', '#ffd27a')
    await page.waitForSelector('[data-testid="colour-swatch-refused"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error('a code too pale for the light theme was not refused')
    })
    await shootAt(page, shoot, '[data-testid="colour-swatch-refused"]', 'spending-category-colour-refused', {
      block: 'nearest',
      inspected: () => inspect?.('the colour pop-up refusing a pale colour'),
    })
    await pressSelector(page, press, '[data-testid="colour-swatch-offered"]')
    await page
      .waitForFunction(() => !document.querySelector('[data-testid="colour-swatch-refused"]'), { timeout: 5_000 })
      .catch(() => {
        throw new Error('the offered colour was not taken')
      })
    await fill(page, 'colour-swatch-code', '#de601c')
    await page.waitForSelector('[data-testid="colour-swatch-warning"]', { visible: true, timeout: 5_000 }).catch(() => {
      throw new Error("a colour that looks like another group's gave no warning")
    })
    await shootAt(page, shoot, '[data-testid="colour-swatch-warning"]', 'spending-category-colour-alike', {
      block: 'nearest',
      inspected: () => inspect?.("the colour pop-up warning of another group's colour"),
    })
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="colour-swatch-picker"]'), { timeout: 5_000 })
    const label = await page.$eval('[data-testid="spending-category-dialog"] [data-testid="colour-swatch-button"]', (element) => element.getAttribute('aria-label') ?? '')
    if (!label.endsWith('#DE601C')) throw new Error(`the colour button reads "${label}"`)
    await delay(300)
    await shoot('spending-category-colour-own')
  }
}

/** The row of Spending's Limits whose category reads `name`, or null. */
function spendingLimitRow(page, name) {
  return page.evaluateHandle(
    (wanted) => [...document.querySelectorAll('[data-testid="spending-budget-row"]')].find((row) => row.querySelector('[data-testid="spending-limit-change"]')?.textContent?.trim() === wanted) ?? null,
    name,
  )
}

async function spendingLimitShown(page, name, shown) {
  await page
    .waitForFunction(
      (wanted, expected) =>
        [...document.querySelectorAll('[data-testid="spending-budget-row"] [data-testid="spending-limit-change"]')].some((button) => button.textContent?.trim() === wanted) === expected,
      { timeout: 10_000 },
      name,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `Limits lists no limit on ${name}` : `Limits still lists a limit on ${name}`)
    })
}

/** On the sample Spending file's Limits: a monthly limit set on Transport, then ended from its dialog, which takes it off until Undo puts it back. */
export function spendingLimitFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const limits = words.spendingBudgets
  const transport = words.spendingStarter.Transport
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="spending-limit-add"]')
    await page.waitForSelector('[data-testid="spending-limit-dialog"]', { visible: true, timeout: 10_000 })
    await choose(page, press, await page.$('[data-testid="spending-limit-category"]'), transport)
    await typeAmount(page, press, 'spending-limit-amount', '120')
    await delay(300)
    await inspect?.('the limit dialog')
    await shoot('spending-limit-dialog')
    await pressSelector(page, press, '[data-testid="spending-limit-save"]')
    await toast(page, limits.dialog.set)
    await dismissToasts(page)
    await spendingLimitShown(page, transport, true)
    await shoot('spending-limit-set')

    await pressSelector(page, press, `[data-testid="spending-limit-change"][aria-label="${limits.table.change(transport)}"]`)
    await page.waitForSelector('[data-testid="spending-limit-dialog"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-limit-end"]')
    await toast(page, limits.dialog.ended)
    await spendingLimitShown(page, transport, false)
    await undoIn(page, press, words)
    await spendingLimitShown(page, transport, true)
    await inspect?.('Limits after Undo')
    await dismissToasts(page)
  }
}

/**
 * On the sample Spending file's Limits: a yearly cost of 240 on Health, due eleven months on, sets aside
 * a twelfth of it in this month, as the dialog says, and the row says under its name when it is due. Undo takes it off.
 */
export function spendingYearlyCostFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const limits = words.spendingBudgets
  const health = words.spendingStarter.Health
  const setAside = formatMoney(2000, 'negative', MONEY_FORMATS[language])
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="spending-limit-add"]')
    await page.waitForSelector('[data-testid="spending-limit-dialog"]', { visible: true, timeout: 10_000 })
    await choose(page, press, await page.$('[data-testid="spending-limit-category"]'), health)
    await pressButton(page, press, '[data-testid="spending-limit-every"] button', limits.dialog.onceAYear)
    await typeAmount(page, press, 'spending-limit-amount', '240')
    await chooseAt(page, press, '[data-testid="spending-limit-due"]', 'last')
    await page
      .waitForFunction((wanted) => document.querySelector('[data-testid="spending-limit-dialog"]')?.textContent?.includes(wanted), { timeout: 5_000 }, setAside)
      .catch(() => {
        throw new Error(`the yearly cost dialog does not say it sets aside ${setAside} this month`)
      })
    await inspect?.('the yearly cost dialog')
    await shoot('spending-yearly-dialog')
    await pressSelector(page, press, '[data-testid="spending-limit-save"]')
    await toast(page, limits.dialog.set)
    await spendingLimitShown(page, health, true)
    await page
      .waitForFunction(
        (wanted) => [...document.querySelectorAll('[data-testid="spending-budget-due"]')].some((line) => line.textContent?.trim() === wanted),
        { timeout: 10_000 },
        limits.table.setAsideAmount(setAside),
      )
      .catch(() => {
        throw new Error(`${health} does not say it sets aside ${setAside} this month`)
      })
    await inspect?.('Limits with the yearly cost')
    await shoot('spending-yearly-set')
    await undoIn(page, press, words)
    await spendingLimitShown(page, health, false)
    await dismissToasts(page)
  }
}

/**
 * On the sample Spending file's Entries: 100 euros moved from OTP current to Revolut EUR with 99.30 arrived, which writes
 * two legs of 100 and a fee of 0.70 on Revolut EUR in one write, and one Undo takes all three off.
 */
export function spendingFeeTransferFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  const screens = words.spendingScreens
  const title = words.spendingStarter['Between my accounts']
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await goTo(page, '#/spending/transactions', screens.entries)
    await newSpendingEntry(page, press, words, 'transfer')
    await typeAmount(page, press, 'spending-entry-amount', '100')
    await chooseStartingWith(page, press, '[data-testid="spending-entry-account"]', 'OTP current')
    await chooseStartingWith(page, press, '[data-testid="spending-entry-to-account"]', 'Revolut EUR')
    await pressSelector(page, press, ':is([data-testid="spending-entry-less-arrived"][role="switch"], [data-testid="spending-entry-less-arrived"] [role="switch"])')
    await typeAmount(page, press, 'spending-entry-to-amount', '99.30')
    await page
      .waitForFunction((wanted) => document.querySelector('[data-testid="spending-entry-dialog"]')?.textContent?.includes(wanted), { timeout: 5_000 }, 'Revolut EUR')
      .catch(() => {
        throw new Error('the entry dialog does not name Revolut EUR as where the fee goes')
      })
    await inspect?.('the entry dialog with less arrived')
    await shoot('spending-fee-transfer-dialog')
    await saveSpendingEntry(page, press, dialog.added)
    await spendingRowShown(page, title, -10000, true)
    await spendingRowShown(page, title, 10000, true)
    await spendingRowShown(page, 'Revolut', -70, true)
    await inspect?.('Transactions with the fee row')
    await shoot('spending-fee-transfer-rows')
    await undoIn(page, press, words)
    await spendingRowShown(page, 'Revolut', -70, false)
    await spendingRowShown(page, title, -10000, false)
    await dismissToasts(page)
  }
}

/**
 * On the sample Spending file's Limits by touch: Food's limit raised to 450 from this month keeps what carried in, which
 * the row says under its name on a phone, and its available becomes 450 and that carry.
 */
export async function spendingFoodLimitFlow(page, { press, shoot, inspect }) {
  const words = SCREEN_WORDS.en
  const food = words.spendingStarter.Food
  const read = async () => {
    const row = await spendingLimitRow(page, food)
    if ((await row.jsonValue()) === null) throw new Error(`Limits lists no limit on ${food}`)
    return row.evaluate((element) => ({
      carriedIn: Number(element.dataset.carriedIn),
      available: Number(element.dataset.available),
      carry: [...element.querySelectorAll('[data-testid="spending-budget-carry"]')].filter((caption) => caption.getClientRects().length > 0).map((caption) => caption.textContent?.trim()),
    }))
  }
  const before = await read()
  if (before.carriedIn === 0 || before.carry.length !== 1) throw new Error(`${food} shows no carry on a phone: ${JSON.stringify(before)}`)
  await pressSelector(page, press, `[data-testid="spending-limit-change"][aria-label="${words.spendingBudgets.table.change(food)}"]`)
  await page.waitForSelector('[data-testid="spending-limit-dialog"]', { visible: true, timeout: 10_000 })
  await typeAmount(page, press, 'spending-limit-amount', '450')
  await delay(300)
  await inspect?.('the limit dialog on Food')
  await pressSelector(page, press, '[data-testid="spending-limit-save"]')
  await toast(page, words.spendingBudgets.dialog.set)
  await dismissToasts(page)
  await page
    .waitForFunction(
      (wanted, carried, available) =>
        [...document.querySelectorAll('[data-testid="spending-budget-row"]')].some(
          (row) =>
            row.querySelector('[data-testid="spending-limit-change"]')?.textContent?.trim() === wanted && row.dataset.carriedIn === String(carried) && row.dataset.available === String(available),
        ),
      { timeout: 10_000 },
      food,
      before.carriedIn,
      45000 + before.carriedIn,
    )
    .catch(async () => {
      throw new Error(`${food} at 450 does not keep its carry of ${before.carriedIn} cents and make ${45000 + before.carriedIn} available: ${JSON.stringify(await read())}`)
    })
  const after = await read()
  if (JSON.stringify(after.carry) !== JSON.stringify(before.carry)) throw new Error(`${food} read ${before.carry.join()} carried in, then ${after.carry.join()}`)
  await shoot('spending-limit-food')
}

/**
 * On the sample Spending file's Labels: a label added, renamed and deleted with Undo, then the trip's row opening its entries of
 * every month on Entries, filtered by the label.
 */
export function spendingLabelsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const labels = words.spendingLabels
  const added = language === 'en' ? 'Summer house' : 'Vikendica'
  const renamed = language === 'en' ? 'Summer cottage' : 'Kuća za odmor'
  const trip = language === 'en' ? 'Boston trip' : 'Put u Boston'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const says = async (wanted, problem) => {
      await page
        .waitForFunction((text) => document.body.textContent?.includes(text), { timeout: 5_000 }, wanted)
        .catch(() => {
          throw new Error(problem)
        })
    }
    await page.waitForSelector('[data-testid="spending-labels"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-label-add"]')
    await page.waitForSelector('[data-testid="label-dialog"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="label-save"]')
    await says(words.labelName.blank, 'the label dialog takes a blank name')
    await fill(page, 'label-name', trip.toUpperCase())
    await pressSelector(page, press, '[data-testid="label-save"]')
    await says(words.labelName.taken, 'the label dialog takes the name of another label')
    await fill(page, 'label-name', added)
    await delay(300)
    await inspect?.('the label dialog')
    await shoot('spending-label-dialog')
    await pressSelector(page, press, '[data-testid="label-save"]')
    await toast(page, labels.added)
    await dismissToasts(page)
    await pressSelector(page, press, `[data-testid="spending-label-change"][aria-label="${labels.change(added)}"]`)
    await page.waitForSelector('[data-testid="label-dialog"]', { visible: true, timeout: 10_000 })
    await fill(page, 'label-name', renamed)
    await pressSelector(page, press, '[data-testid="label-save"]')
    await toast(page, labels.saved)
    await dismissToasts(page)
    await pressSelector(page, press, `[data-testid="spending-label-change"][aria-label="${labels.change(renamed)}"]`)
    await page.waitForSelector('[data-testid="label-dialog"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="label-delete"]')
    await toast(page, labels.deleted)
    await undoIn(page, press, words)
    await says(renamed, 'Undo did not bring the deleted label back')
    await dismissToasts(page)
    await inspect?.('Labels after Undo')
    await shoot('spending-labels-after-undo')

    const links = await page.$$('[data-testid="spending-label-open"]')
    const named = await Promise.all(links.map((link) => link.evaluate((element) => element.textContent ?? '')))
    const tripRow = links[named.findIndex((text) => text.includes(trip))]
    if (tripRow === undefined) throw new Error(`Labels lists no ${trip}`)
    await press(tripRow)
    await page
      .waitForFunction(() => window.location.hash.includes('label=') && window.location.hash.includes('month=all'), { timeout: 10_000 })
      .catch(() => {
        throw new Error("the label's row did not open its entries of every month")
      })
    await page.waitForSelector('[data-testid="spending-row-labels"]', { visible: true, timeout: 10_000 })
    const shown = await page.$$eval('[data-testid="spending-row-labels"]', (lines) => lines.map((line) => line.textContent ?? ''))
    if (shown.some((line) => !line.includes(trip))) throw new Error(`Entries filtered by ${trip} shows rows without it: ${shown.join(' | ')}`)
    await inspect?.('Entries filtered by a label')
    await shoot('spending-entries-by-label')
  }
}

/**
 * On the sample Spending file's Events: a blank name is refused, an event ahead is added and says when it starts, then renamed
 * with new days, Prague's dialog says Delete puts its hand-picked parts back on their days, Delete is undone, and Prague's row
 * opens its entries of every month with its total and split by group above them.
 */
export function spendingEventsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const events = words.spendingEvents
  const added = language === 'en' ? 'Ski week' : 'Skijanje'
  const renamed = language === 'en' ? 'Ski fortnight' : 'Dva tjedna skijanja'
  const prague = language === 'en' ? 'Prague' : 'Prag'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const says = async (wanted, problem) => {
      await page
        .waitForFunction((text) => document.body.textContent?.includes(text), { timeout: 5_000 }, wanted)
        .catch(() => {
          throw new Error(problem)
        })
    }
    await page.waitForSelector('[data-testid="spending-events"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-event-add"]')
    await page.waitForSelector('[data-testid="spending-event-dialog"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="spending-event-save"]')
    await says(words.spendingEventRules.blank, 'the event dialog takes a blank name')
    await fill(page, 'spending-event-name', added)
    await fill(page, 'spending-event-from', '2027-02-10')
    await fill(page, 'spending-event-to', '2027-02-16')
    await delay(300)
    await inspect?.('the event dialog')
    await shoot('spending-event-dialog')
    await pressSelector(page, press, '[data-testid="spending-event-save"]')
    await toast(page, events.added)
    await dismissToasts(page)
    await says(events.starts('').trim(), 'Events does not say when an event ahead starts')
    await pressSelector(page, press, `[data-testid="spending-event-change"][aria-label="${events.change(added)}"]`)
    await page.waitForSelector('[data-testid="spending-event-dialog"]', { visible: true, timeout: 10_000 })
    await fill(page, 'spending-event-name', renamed)
    await fill(page, 'spending-event-to', '2027-02-23')
    await pressSelector(page, press, '[data-testid="spending-event-save"]')
    await toast(page, events.saved)
    await dismissToasts(page)
    await says(renamed, 'Events does not show the renamed event')
    await pressSelector(page, press, `[data-testid="spending-event-change"][aria-label="${events.change(prague)}"]`)
    await page.waitForSelector('[data-testid="spending-event-dialog"]', { visible: true, timeout: 10_000 })
    await says(events.dialog.deleteHelp(events.dialog.parts(1).one), 'the dialog of an event with a part put in by hand does not say Delete puts it back on its day')
    await inspect?.('the dialog of an event with a part put in by hand')
    await shoot('spending-event-dialog-change')
    await pressSelector(page, press, '[data-testid="spending-event-delete"]')
    await toast(page, events.deleted)
    await undoIn(page, press, words)
    await says(prague, 'Undo did not bring the deleted event back')
    await dismissToasts(page)
    await inspect?.('Events after Undo')
    await shoot('spending-events-after-undo')

    const links = await page.$$('[data-testid="spending-event-open"]')
    const named = await Promise.all(links.map((link) => link.evaluate((element) => element.textContent ?? '')))
    const pragueRow = links[named.findIndex((text) => text.includes(prague))]
    if (pragueRow === undefined) throw new Error(`Events lists no ${prague}`)
    await press(pragueRow)
    await page
      .waitForFunction(() => window.location.hash.includes('event=') && window.location.hash.includes('month=all'), { timeout: 10_000 })
      .catch(() => {
        throw new Error("the event's row did not open its entries of every month")
      })
    await page.waitForSelector('[data-testid="spending-filter-total"]', { visible: true, timeout: 10_000 })
    const total = await page.$eval('[data-testid="spending-filter-total"]', (row) => row.textContent ?? '')
    if (!total.includes(prague)) throw new Error(`Entries filtered by ${prague} sums up another: ${total}`)
    await inspect?.('Entries filtered by an event')
    await shoot('spending-entries-by-event')
  }
}

/** On the sample Spending file's Entries: three rows selected and labelled Garden in one write, which one Undo takes back. */
export function spendingSelectLabelFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const garden = language === 'en' ? 'Garden' : 'Vrt'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const carrying = () => page.$$eval('[data-testid="spending-row-labels"]', (lines, wanted) => lines.filter((line) => line.textContent?.includes(wanted)).length, garden)
    await pressSelector(page, press, '[data-testid="spending-select"]')
    await page.waitForSelector('[data-testid="selection-bar"]', { visible: true, timeout: 10_000 })
    await inspect?.('Entries with nothing picked')
    await shoot('spending-select-none')
    const rows = await page.$$('[data-testid="spending-row"]')
    for (const row of rows.slice(0, 3)) await press(row)
    await page
      .waitForFunction(() => document.querySelectorAll('[data-testid="spending-row"] [data-testid="list-row-pick"][aria-checked="true"]').length === 3, { timeout: 5_000 })
      .catch(() => {
        throw new Error('three taps did not pick three rows')
      })
    await inspect?.('Entries with three rows picked')
    await shoot('spending-select-three')
    // Room under the short sample month, so the page scrolls far enough for the tab row and the bar to stick.
    await page.evaluate(() => {
      document.body.style.paddingBottom = '150vh'
      window.scrollTo(0, document.querySelector('[data-testid="spending-transactions"]').getBoundingClientRect().top + window.scrollY)
    })
    await delay(300)
    const stuck = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="selection-bar"]')?.getBoundingClientRect()
      const tabs = document.querySelector('.page-tabs-list')?.getBoundingClientRect()
      return bar === undefined || tabs === undefined ? null : { overlap: tabs.bottom - bar.top, barTop: bar.top }
    })
    if (stuck === null) throw new Error('Entries shows no selection bar or tab row once scrolled')
    if (stuck.overlap > 1) throw new Error(`the stuck selection bar sits ${Math.round(stuck.overlap)} px under the tab row`)
    await inspect?.('Entries scrolled with three rows picked')
    await shoot('spending-select-scrolled')
    await page.evaluate(() => {
      document.body.style.paddingBottom = ''
      window.scrollTo(0, 0)
    })
    await delay(300)
    await pressSelector(page, press, '[data-testid="spending-selection-label"]')
    await page.waitForSelector('[data-testid="label-picker"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('the label picker')
    await shoot('spending-label-picker')
    const choices = await page.$$('[data-testid="label-choice"]')
    const named = await Promise.all(choices.map((choice) => choice.evaluate((element) => element.textContent ?? '')))
    const choice = choices[named.findIndex((text) => text.includes(garden))]
    if (choice === undefined) throw new Error(`the label picker offers no ${garden}`)
    await press(await choice.$('[data-testid="label-apply"]'))
    await toastMatching(page, new RegExp(garden))
    if ((await page.$('[data-testid="selection-bar"]')) !== null) throw new Error('the selection stays after labelling')
    const labelled = await carrying()
    if (labelled !== 3) throw new Error(`${labelled} rows carry ${garden} after labelling three`)
    await inspect?.('Entries after labelling')
    await shoot('spending-select-labelled')
    await undoIn(page, press, words)
    if ((await carrying()) !== 0) throw new Error(`Undo left ${garden} on rows`)
    await dismissToasts(page)
  }
}

/**
 * On the sample Spending file's Entries: two rows selected and put in Prague in one write, which one Undo takes back. The picker
 * lists the file's events with their days, and offers Take out of events beside them.
 */
export function spendingSelectEventFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const prague = language === 'en' ? 'Prague' : 'Prag'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="spending-select"]')
    await page.waitForSelector('[data-testid="selection-bar"]', { visible: true, timeout: 10_000 })
    const rows = await page.$$('[data-testid="spending-row"]')
    for (const row of rows.slice(0, 2)) await press(row)
    await page
      .waitForFunction(() => document.querySelectorAll('[data-testid="spending-row"] [data-testid="list-row-pick"][aria-checked="true"]').length === 2, { timeout: 5_000 })
      .catch(() => {
        throw new Error('two taps did not pick two rows')
      })
    await inspect?.('Entries with two rows picked and Event beside Label')
    await shoot('spending-select-event-bar')
    await pressSelector(page, press, '[data-testid="spending-selection-event"]')
    await page.waitForSelector('[data-testid="spending-event-picker"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('the event picker')
    await shoot('spending-event-picker')
    const choices = await page.$$('[data-testid="spending-event-choice"]')
    const named = await Promise.all(choices.map((choice) => choice.evaluate((element) => element.textContent ?? '')))
    const choice = choices[named.findIndex((text) => text.includes(prague))]
    if (choice === undefined) throw new Error(`the event picker offers no ${prague}, only ${named.join(', ')}`)
    if ((await page.$('[data-testid="spending-event-take-out"]')) === null) throw new Error('the event picker offers no Take out of events')
    await press(await choice.$('[data-testid="spending-event-put-in"]'))
    await toastMatching(page, new RegExp(prague))
    if ((await page.$('[data-testid="selection-bar"]')) !== null) throw new Error('the selection stays after putting rows in an event')
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/**
 * On the sample Spending file's Entries: the streaming subscription, taken out of every event by hand, opens with its Event
 * field on Kept out of events, and By date, which names Prague, puts it back on its days with Save, which one Undo takes back.
 */
export function spendingEntryEventFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { dialog } = words.spendingEntries
  const prague = language === 'en' ? 'Prague' : 'Prag'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Streaming service', -1399)
    const field = await page.waitForSelector('[data-testid="spending-entry-event"]', { visible: true, timeout: 10_000 })
    const shown = await field.evaluate((element) => element.textContent?.trim() ?? '')
    if (shown !== dialog.noEvent) throw new Error(`the streaming subscription's Event field shows "${shown}", not ${dialog.noEvent}`)
    await inspect?.("the entry dialog's Event field on a part taken out of every event")
    await shoot('spending-entry-event')
    await chooseStartingWith(page, press, '[data-testid="spending-entry-event"]', dialog.byDays(prague))
    await pressSelector(page, press, '[data-testid="spending-entry-save"]')
    await toast(page, dialog.saved)
    await undoIn(page, press, words)
    await dismissToasts(page)
  }
}

/**
 * Spending's Rules tab on the sample set with the sample Loans file, which has no rules yet: the card offers rows to Example Bank
 * as paying the home loan, Make rule writes it with its loan named on its line and in its dialog, and deleting it puts the offer back.
 */
export function spendingLoanRuleFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { rules } = words.spendingStatements
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await elementSays(page, '[data-testid="spending-rule-offer"]', [rules.offerTitle(rules.quoted('Example Bank'), 'Home loan')], 'the Rules card offers no rule for the home loan')
    await inspect?.('the Rules card with the offer of a loan rule')
    await shootAt(page, shoot, '[data-testid="spending-rules"]', 'spending-rules-loan-offer', { block: 'start' })
    await pressSelector(page, press, '[data-testid="spending-rule-offer-make"]')
    await applyIfAsked(page, press, shoot, 'spending-rules-loan-asks')
    await toast(page, rules.made)
    await page.waitForSelector('[data-testid="spending-rule-offers"]', { hidden: true, timeout: 10_000 })
    await elementSays(page, '[data-testid="spending-rule-goes-to"]', [rules.paysLoan('Home loan')], 'the rule made from the offer does not name the loan')
    await shootAt(page, shoot, '[data-testid="spending-rule-goes-to"]', 'spending-rules-loan-made')
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="spending-rule-edit"]')
    await elementSays(page, '[data-testid="spending-rule-dialog"]', [rules.dialog.pays, rules.dialog.paysHelp, rules.dialog.interestUnder], 'the rule dialog does not show the loan its rows pay')
    await delay(300)
    await inspect?.('the rule dialog of a rule whose rows pay the home loan')
    await shoot('spending-rule-dialog-loan')
    await pressSelector(page, press, '[data-testid="spending-rule-dialog-cancel"]')
    await page.waitForSelector('[data-testid="spending-rule-dialog"]', { hidden: true, timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="spending-rule-delete"]')
    await applyIfAsked(page, press, shoot, 'spending-rules-loan-delete-asks')
    await toast(page, rules.deleted)
    await page.waitForSelector('[data-testid="spending-rule-offer"]', { visible: true, timeout: 10_000 })
    await dismissToasts(page)
  }
}

/** An old address of Spending's labels or of Settings' Rules tab, kept from before Sorting held them, opens Sorting with that card in view. */
export function spendingOldAddressFlowIn(language, card) {
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page
      .waitForFunction((wanted) => window.location.hash.startsWith('#/spending/sorting') && window.location.hash.endsWith(`#${wanted}`), { timeout: 10_000 }, card)
      .catch(async () => {
        throw new Error(`the old address did not land on Sorting's ${card} card but on ${await page.evaluate(() => window.location.hash)}`)
      })
    await page.waitForSelector(`[id="${card}"]`, { visible: true, timeout: 10_000 })
    await page
      .waitForFunction(
        (wanted) => {
          const top = document.getElementById(wanted)?.getBoundingClientRect().top
          return top !== undefined && top >= 0 && top < window.innerHeight - 80
        },
        { timeout: 5_000 },
        card,
      )
      .catch(() => {
        throw new Error(`Sorting's ${card} card is not in view after the old address`)
      })
    await delay(300)
    await inspect?.(`Sorting from the old ${card} address`)
    await shoot(`spending-old-${card}-address`)
  }
}

/**
 * On Sorting with the statements set: the Categories card starts folded on a first visit, and once opened, Groceries' rule count
 * opens the Rules card with only its rule and a chip, and the chip shows every rule again.
 */
export function spendingRulesForFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { rules } = words.spendingStatements
  const groceries = words.spendingStarter.Groceries
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const RULE = '[data-testid="spending-rule"]'
    await countOf(page, RULE, 4, 'the set should start with four rules')
    const categories = await page.waitForSelector('[data-testid="spending-categories"]', { timeout: 10_000 })
    if ((await categories.evaluate((card) => card.dataset.collapsed)) !== 'true') throw new Error('the Categories card should start folded on a first visit')
    await openCard(page, press, 'spending-categories')
    const link = await page.waitForSelector(`[data-testid="spending-rules-link"][aria-label="${rules.countOf(rules.count(1).one, groceries)}"]`, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error(`${groceries} does not say 1 rule`)
    })
    await press(link)
    await page
      .waitForFunction(() => window.location.hash.includes('category=') && window.location.hash.endsWith('#rules'), { timeout: 10_000 })
      .catch(async () => {
        throw new Error(`the count did not open the rules of ${groceries} but ${await page.evaluate(() => window.location.hash)}`)
      })
    await countOf(page, RULE, 1, `only the rule for ${groceries} should show`)
    await page.waitForSelector('[data-testid="spending-rules-shown-for"]', { visible: true, timeout: 5_000 })
    await countOf(page, '[data-testid="spending-rule-up"], [data-testid="spending-rule-down"]', 0, 'a filtered list should offer no moves')
    await delay(300)
    await inspect?.('the rules for one category')
    await shoot('spending-rules-for')
    await pressSelector(page, press, `[aria-label="${rules.showAll(groceries)}"]`)
    await countOf(page, RULE, 4, 'the chip should show every rule again')
    if (await page.evaluate(() => window.location.hash.includes('category='))) throw new Error('the chip left the category in the address')
  }
}

/**
 * Settings, General on the statements set lists its saved recipe by name, bank and format. Its row opens the editor, whose
 * Delete leaves the card with Add recipe and Undo brings the recipe back. Add recipe opens a blank recipe that shows no
 * problem until Save shows each one under its field. A second Save keeps them, and typing a name clears the name's. A second
 * kind moves up above the first, with focus kept on the moved kind.
 */
export function spendingSettingsRecipesFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await countOf(page, '[data-testid="spending-recipe"]', 1, 'the saved recipes on Settings')
    await centreOn(page, '[data-testid="spending-recipes"]', 'Promet Primjer banke')
    await delay(300)
    await inspect?.('the saved recipes on Settings')
    await shoot('spending-settings-recipes')
    await pressSelector(page, press, '[data-testid="spending-recipe"]')
    await page.waitForSelector('[data-testid="recipe-dialog"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a saved recipe row opens no editor')
    })
    await delay(400)
    await inspect?.('a saved recipe in its editor')
    await shoot('spending-settings-recipe-dialog')
    await pressSelector(page, press, '[data-testid="recipe-delete"]')
    await page.waitForSelector('[data-testid="spending-recipe"]', { hidden: true, timeout: 10_000 }).catch(() => {
      throw new Error('Delete of the last recipe left its row on Settings')
    })
    await page.waitForSelector('[data-testid="spending-recipe-add"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('a file with no recipe offers no Add recipe on Settings')
    })
    await delay(300)
    await shoot('spending-settings-recipes-deleted')
    await undoIn(page, press, words)
    await countOf(page, '[data-testid="spending-recipe"]', 1, 'Undo should bring the recipe back')
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="spending-recipe-add"]')
    await page.waitForSelector('[data-testid="recipe-dialog"]', { visible: true, timeout: 10_000 })
    await delay(400)
    if ((await page.$('[data-testid="recipe-dialog"] [data-slot="error"], [data-testid="recipe-problem"]')) !== null) throw new Error('a new recipe shows a problem before Save')
    await inspect?.('a blank recipe before Save')
    await shoot('spending-settings-recipe-blank')
    await pressSelector(page, press, '[data-testid="recipe-save"]')
    await page
      .waitForFunction(() => document.querySelectorAll('[data-testid="recipe-dialog"] [data-slot="error"]').length >= 3, { timeout: 5_000 })
      .catch(() => {
        throw new Error('Save of a blank recipe shows no problem under its name, bank and amount')
      })
    await delay(300)
    await inspect?.('a blank recipe after Save')
    await shoot('spending-settings-recipe-new')
    const problemCount = () => page.$$eval('[data-testid="recipe-dialog"] [data-slot="error"]', (problems) => problems.length)
    const shown = await problemCount()
    await pressSelector(page, press, '[data-testid="recipe-save"]')
    await delay(300)
    if ((await problemCount()) !== shown) throw new Error('a second Save of a blank recipe changed the problems it shows')
    await fill(page, 'recipe-name', 'Example bank statement')
    await page
      .waitForFunction((before) => document.querySelectorAll('[data-testid="recipe-dialog"] [data-slot="error"]').length === before - 1, { timeout: 5_000 }, shown)
      .catch(() => {
        throw new Error('typing a name left its problem under the name')
      })
    await pressSelector(page, press, '[data-testid="recipe-add-kind"]')
    await countOf(page, '[data-testid="recipe-kind"]', 2, 'the kinds after Add a kind')
    const tests = await page.$$('[data-testid="recipe-kind"] [data-testid="recipe-kind-test"]')
    await choose(page, press, tests[1], words.recipeEditor.isFilled)
    const testsInOrder = () => page.$$eval('[data-testid="recipe-kind"] [data-testid="recipe-kind-test"]', (fields) => fields.map((field) => field.textContent?.trim() ?? ''))
    const { everyRow, isFilled } = words.recipeEditor
    if ((await testsInOrder()).join() !== [everyRow, isFilled].join()) throw new Error(`the kinds before a move test ${(await testsInOrder()).join(', ')}`)
    const ups = await page.$$('[data-testid="recipe-kind"] [data-testid="recipe-kind-up"]')
    const downs = await page.$$('[data-testid="recipe-kind"] [data-testid="recipe-kind-down"]')
    const disabled = (button) => button.evaluate((element) => element.disabled)
    if (!(await disabled(ups[0])) || !(await disabled(downs[1]))) throw new Error('the first kind can move up or the last kind down')
    await press(ups[1])
    await page
      .waitForFunction(
        (wanted) => [...document.querySelectorAll('[data-testid="recipe-kind"] [data-testid="recipe-kind-test"]')].map((field) => field.textContent?.trim()).join() === wanted,
        { timeout: 5_000 },
        [isFilled, everyRow].join(),
      )
      .catch(async () => {
        throw new Error(`Move up left the kinds testing ${(await testsInOrder()).join(', ')}`)
      })
    const focused = await page.evaluate(() => {
      const kinds = [...document.querySelectorAll('[data-testid="recipe-kind"]')]
      return { at: kinds.findIndex((kind) => kind.contains(document.activeElement)), button: document.activeElement?.getAttribute('data-testid') }
    })
    if (focused.at !== 0 || focused.button !== 'recipe-kind-down') throw new Error(`after Move up focus is on ${focused.button} of kind ${focused.at + 1}, not on the moved kind`)
    await inspect?.('a recipe with its second kind moved up')
    await shootAt(page, shoot, '[data-testid="recipe-kinds"]', 'spending-settings-recipe-kinds', { block: 'start' })
  }
}

/**
 * On Spending's Import: a file of the bank the statements set keeps a recipe for, whose amount column the bank renamed, is
 * refused with Edit beside Ask the chat. Edit opens the recipe with the file's header to pick from, and once the amount
 * reads Iznos EUR and the recipe is saved, Import reads the file and offers the bank's account it lacks.
 */
export function spendingRecipeEditFlowIn(language, paths) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await dropSpendingFile(page, paths.renamed)
    await page.waitForSelector('[data-testid="spending-import-recipe-edit"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the refused file offers no Edit for its recipe')
    })
    await delay(300)
    await inspect?.('a file a saved recipe stopped reading')
    await shoot('spending-recipe-misfit')
    await pressSelector(page, press, '[data-testid="spending-import-recipe-edit"]')
    await page.waitForSelector('[data-testid="recipe-dialog"]', { visible: true, timeout: 10_000 })
    await delay(400)
    await inspect?.('the recipe editor with the file header')
    await shoot('spending-recipe-dialog')
    await choose(page, press, await page.waitForSelector('[data-testid="recipe-amount"]'), 'Iznos EUR')
    await pressSelector(page, press, '[data-testid="recipe-save"]')
    await page.waitForSelector('[data-testid="spending-import-missing-accounts"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the changed recipe does not read the file')
    })
    await delay(400)
    await inspect?.('the file read with the changed recipe')
    await shoot('spending-recipe-fixed')
  }
}

/** Opens To review and waits until a row of this payee waits there. */
async function waitsOnReview(page, payee) {
  await page.evaluate(() => {
    window.location.hash = '#/spending/transactions?tab=review'
  })
  await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[data-testid="spending-review-row"]')].some((row) => row.textContent?.includes(wanted)), { timeout: 10_000 }, payee)
    .catch(() => {
      throw new Error(`${payee} with no category does not wait on To review`)
    })
}

/**
 * On the sample Spending file's Entries: the category of a filed row is cleared by the cross in the field, which then reads
 * No category in grey, and once saved the row waits on To review until Undo files it again. A new entry added with
 * no category waits there too until its Undo. A category cleared by hand stays clear when the payee is typed again.
 */
export function spendingCategoryClearFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const dialog = words.spendingEntries.dialog
  const trigger = `${SPENDING_ENTRY_DIALOG} [data-testid="spending-entry-category"]`
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openSpendingRow(page, press, 'Hotel Old Town', -24000)
    await shootAt(page, shoot, trigger, 'spending-entry-category-filled', { inspected: () => inspect?.("a filed entry's category with its cross") })
    await clearChoice(page, press, trigger, language)
    await triggerReads(page, trigger, dialog.noCategory)
    await shootAt(page, shoot, trigger, 'spending-entry-category-cleared', { inspected: () => inspect?.("an entry's category cleared by the cross") })
    await saveSpendingEntry(page, press, dialog.saved)
    await waitsOnReview(page, 'Hotel Old Town')
    await delay(300)
    await inspect?.('a cleared row waiting on To review')
    await shoot('spending-review-cleared-row')
    await undoIn(page, press, words)
    await dismissToasts(page)

    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions'
    })
    await newSpendingEntry(page, press, words, 'out')
    await typeAmount(page, press, 'spending-entry-amount', '12')
    await fill(page, 'spending-entry-payee', 'Market stall by the station')
    await triggerReads(page, trigger, dialog.noCategory)
    await saveSpendingEntry(page, press, dialog.added)
    await waitsOnReview(page, 'Market stall by the station')
    await undoIn(page, press, words)
    await dismissToasts(page)

    await page.evaluate(() => {
      window.location.hash = '#/spending/transactions'
    })
    await newSpendingEntry(page, press, words, 'out')
    await typePayee(page, press, 'corner market')
    await page.keyboard.press('Escape')
    await payeeListGone(page)
    await triggerReads(page, trigger, words.spendingStarter.Groceries)
    await clearChoice(page, press, trigger, language)
    await typePayee(page, press, 'corner market')
    await page.keyboard.press('Escape')
    await payeeListGone(page)
    await triggerReads(page, trigger, dialog.noCategory)
    await page.keyboard.press('Escape')
    await dialogGone(page, SPENDING_ENTRY_DIALOG)
  }
}
