/**
 * Company's sorting flows that the visual and the touch check share: categories, rules and labels. `press` clicks or
 * taps an element handle, and `shoot` takes a screenshot under a name. Each flow starts on its screen and leaves the
 * workbook as it found it. A failure throws with what was missing.
 */

import { openEachMenuIn } from './menuFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'
import { EVERY_RULE, RULE_ROW, editRule, fieldIn, openChangeOfRow, rowGone, rowNamed, ruleRowOf } from './companyFlows.mjs'
import {
  SCREEN_WORDS,
  TOAST,
  choose,
  chooseStartingWith,
  countOf,
  countedIn,
  dialogGone,
  dismissToasts,
  elementSays,
  fill,
  goTo,
  lookAtDialog,
  openCard,
  pickLabel,
  pressButton,
  queueRow,
  setField,
  shootAt,
  toast,
  toastMatching,
  undoIn,
} from './flowHelpers.mjs'

/**
 * Opens the colour pop-up of a categories row, checks its nine 44 px swatches after Bucket colour,
 * moves through them with the arrow keys, and picks `name`. Leaves the pop-up open.
 */
async function pickCategoryColour(page, press, row, words, name) {
  await press(await row.$('[data-testid="colour-swatch-button"]'))
  await page.waitForSelector('[data-testid="colour-swatch-picker"]', { visible: true })
  await delay(300)
  const radios = await page.$$eval('[data-testid="colour-swatch-picker"] [role="radio"]', (elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect()
      return { name: element.getAttribute('aria-label'), width: box.width, height: box.height, checked: element.getAttribute('aria-checked') === 'true' }
    }),
  )
  const names = radios.map((radio) => radio.name).join(', ')
  if (names !== [words.settings.categories.bucketColour, ...Object.values(words.swatches)].join(', ')) throw new Error(`the colour pop-up offers ${names}`)
  const small = radios.filter((radio) => radio.width < 43.5 || radio.height < 43.5)
  if (small.length > 0) throw new Error(`swatches under 44 px: ${small.map((radio) => `${radio.name} ${Math.round(radio.width)}x${Math.round(radio.height)}`).join(', ')}`)
  if (!radios[0].checked) throw new Error('a new category does not start on Bucket colour')

  await page.focus('[data-testid="colour-swatch-picker"] [role="radio"][aria-checked="true"]')
  // The radio group checks the radio an arrow focuses only while the key is still down, as a finger on a key holds it.
  await page.keyboard.press('ArrowRight', { delay: 60 })
  await page.keyboard.press('ArrowRight', { delay: 60 })
  await page
    .waitForFunction(
      (orange) => document.activeElement?.getAttribute('aria-label') === orange && document.activeElement?.getAttribute('aria-checked') === 'true',
      { timeout: 5_000 },
      words.swatches.orange,
    )
    .catch(() => {
      throw new Error('two presses of the right arrow from Bucket colour did not check Orange')
    })

  await press(await page.$(`[data-testid="colour-swatch-picker"] [role="radio"][aria-label="${name}"]`))
  await page
    .waitForFunction(
      (wanted) => document.querySelector(`[data-testid="colour-swatch-picker"] [role="radio"][aria-label="${wanted}"]`)?.getAttribute('aria-checked') === 'true',
      { timeout: 5_000 },
      name,
    )
    .catch(() => {
      throw new Error(`pressing ${name} did not pick it`)
    })
}

/** The selector of a categories row's "Tax class" menu. */
async function classSelectIn(row) {
  return `[data-position="${await row.evaluate((element) => element.getAttribute('data-position'))}"] [data-testid="category-class"]`
}

/** Picks a role in a categories row's menu of roles and checks it shows as a chip. */
async function chooseRole(page, press, row, role) {
  const trigger = await row.$('[data-testid="category-roles"]')
  if (trigger === null) throw new Error('no roles menu in the row')
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'center' }))
  await delay(150)
  await press(trigger)
  const option = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim() === wanted) ?? null, { timeout: 5_000 }, role)
    .catch(() => {
      throw new Error(`the roles menu offers no "${role}"`)
    })
  await press(option.asElement())
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  const chips = await trigger.evaluate((element) => element.textContent?.trim() ?? '')
  if (chips !== role) throw new Error(`the roles menu shows "${chips}" after picking ${role}`)
}

/**
 * Categories: add stationery, which scrolls the table to the new row under its sticky header and
 * focuses its name and waits on how Kuna counts it, count it as a deductible cost, give it a colour
 * from the pop-up, a label on a tab without the column, representation, which sets its VAT and locks
 * it, and a role, delete it, and Undo the delete.
 */
export function categoryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.settings.categories
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await pressSelector(page, press, '[data-testid="add-category"]')
    await page
      .waitForFunction(
        (name) => {
          const added = [...document.querySelectorAll('[data-testid="category-row"]')].at(-1)
          const frame = document.querySelector('[data-testid="categories-frame"]')
          const header = frame?.querySelector('thead th')
          if (!added || !frame || !header || document.activeElement !== added.querySelector(`input[aria-label="${name}"]`)) return false
          const frameBox = frame.getBoundingClientRect()
          const rowBox = added.getBoundingClientRect()
          return frame.scrollTop > 0 && Math.abs(header.getBoundingClientRect().top - frameBox.top) < 1 && rowBox.top >= frameBox.top && rowBox.bottom <= frameBox.bottom + 1
        },
        { timeout: 5_000 },
        said.columns.category,
      )
      .catch(() => {
        throw new Error('Add category did not scroll the table to the new row under its header and focus its name')
      })
    const added = (await page.$$('[data-testid="category-row"]')).at(-1)
    await setField(await fieldIn(added, said.columns.category), 'stationery')
    await setField(await fieldIn(added, said.columns.family), 'operating')
    await delay(200)
    await shoot('categories-draft')
    await chooseStartingWith(page, press, await classSelectIn(added), words.classes.deductibleCost)
    await shoot('categories-class')
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await shoot('categories-saved')
    await dismissToasts(page)

    await pickCategoryColour(page, press, await rowNamed(page, '[data-testid="category-row"]', 'stationery'), words, words.swatches.blue)
    const warning = await page.$eval('[data-testid="colour-swatch-warning"]', (element) => element.textContent?.trim() ?? '')
    const others = new Intl.ListFormat(words.locale, { type: 'conjunction' }).format([words.categoryName('travel'), words.categoryName('software-subscriptions')])
    if (warning !== said.colourLooksLike(others)) throw new Error(`the colour pop-up warns "${warning}"`)
    await shoot('categories-colour')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[data-testid="colour-swatch-picker"]'), { timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await dismissToasts(page)

    const named = await rowNamed(page, '[data-testid="category-row"]', 'stationery')
    await setField(await fieldIn(named, said.columns.label), 'Paper and pens')
    await chooseStartingWith(page, press, await classSelectIn(named), words.classes.representation('').split(':')[0])
    const vat = await named.$('[data-testid="category-vat"]')
    const locked = await vat.evaluate((element) => ({ disabled: element.hasAttribute('disabled') || element.getAttribute('data-disabled') !== null, shown: element.textContent?.trim() ?? '' }))
    if (!locked.disabled || locked.shown !== said.vatTreatments.representation) throw new Error(`representation leaves the VAT select ${locked.disabled ? 'locked' : 'open'} at "${locked.shown}"`)
    await shoot('categories-class-vat-locked')
    await pressSelector(page, press, `${(await classSelectIn(named)).split(' ')[0]} [aria-label="${said.columns.bucket}"]`)
    const buckets = await page.$$eval('[role="option"]', (options) => options.map((option) => option.textContent?.trim() ?? ''))
    if (buckets.join() !== said.bucketChoice('operating')) throw new Error(`the bucket menu of representation offers ${buckets.join(', ')}`)
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await chooseStartingWith(page, press, await classSelectIn(named), words.classes.personalTransport('', '').split(':')[0])
    const refused = await named.$$eval('.field-error', (errors) => errors.map((error) => error.textContent?.trim() ?? ''))
    if (!refused.some((error) => error.includes(said.vatTreatments['car-50'])) || (await page.$eval('[data-testid="save-categories"]', (button) => !button.disabled))) {
      throw new Error(`personal transport with representation VAT shows ${refused.join(' | ') || 'no error'} and leaves Save open`)
    }
    await shoot('categories-class-vat-error')
    await chooseStartingWith(page, press, await classSelectIn(named), words.classes.representation('').split(':')[0])
    await chooseRole(page, press, named, 'watched')
    await shoot('categories-label-and-role')
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await dismissToasts(page)

    const row = await rowNamed(page, '[data-testid="category-row"]', 'stationery')
    await press(await row.$('[data-testid="remove-category"]'))
    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await rowGone(page, '[data-testid="category-row"]', 'stationery')
    await undoIn(page, press, words)
    const back = await rowNamed(page, '[data-testid="category-row"]', 'stationery')
    const colour = await (await back.$('[data-testid="colour-swatch-button"]')).evaluate((button) => button.getAttribute('aria-label'))
    if (colour !== `${said.colourOf('Paper and pens')}: ${words.swatches.blue}`) throw new Error(`Undo brought stationery back as "${colour}"`)
    await dismissToasts(page)
  }
}

export const categoryFlow = categoryFlowIn('en')

/** Presses the category picker under `trigger` and picks the option that names `slug`. */
async function pickCategoryNamed(page, press, trigger, slug) {
  await pressSelector(page, press, trigger)
  const option = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.includes(wanted)) ?? null, { timeout: 5_000 }, slug)
    .catch(() => {
      throw new Error(`the picker offers no category ${slug}`)
    })
  await option.asElement().evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(option.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(300)
}

/**
 * On Sorting, Categories of the books with the `category-move` plan rows: the bin of a category in use opens the move dialog. It
 * shows nothing picked, a target in the same bucket with what moves, a target in another bucket with the warning, and the save
 * lands with a toast and Undo. AI services into software subscriptions says its plan row joins the one already there, and the
 * save lands. Travel, which a plan row the plan tab cannot read still names, gets the warning with a button to Year, Plan and
 * Close only, the bin of a category in use waits while the table has unsaved edits, and the button opens Year on its Plan tab.
 */
export function categoryMoveFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.settings.categories
  const moved = said.moveAndDelete
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const dialog = '[role="dialog"] [data-testid="category-move"]'
    const openMove = async (slug) => {
      const row = await rowNamed(page, '[data-testid="category-row"]', slug)
      await row.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await delay(200)
      await press(await row.$('[data-testid="remove-category"]'))
    }

    await openMove('bank-fees')
    await page.waitForSelector(dialog, { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('category move, nothing picked')
    await shoot('category-move')

    await pickCategoryNamed(page, press, '[data-testid="category-move-into"]', 'software-subscriptions')
    await elementSays(page, dialog, [moved.moves('').split('.')[0].split(' ')[0]], 'the move dialog does not say what moves')
    if ((await page.$('[data-testid="category-move-buckets"]')) !== null) throw new Error('a target in the same bucket shows the bucket warning')
    await inspect?.('category move, same bucket')
    await shoot('category-move-picked')

    await pickCategoryNamed(page, press, '[data-testid="category-move-into"]', 'internal-transfer')
    await page.waitForSelector('[data-testid="category-move-buckets"]', { visible: true, timeout: 5_000 })
    await inspect?.('category move, other bucket')
    await shoot('category-move-buckets')

    await pickCategoryNamed(page, press, '[data-testid="category-move-into"]', 'software-subscriptions')
    await pressSelector(page, press, '[data-testid="confirm-category-move"]')
    await dialogGone(page, '[data-testid="category-move"]')
    await page.waitForFunction(
      (selector, start) => [...document.querySelectorAll(`${selector} [data-slot="title"]`)].some((element) => element.textContent?.trim().startsWith(start)),
      { timeout: 10_000 },
      TOAST,
      moved.deleted('', '').slice(0, 7),
    )
    await delay(400)
    await shoot('category-moved')
    await rowGone(page, '[data-testid="category-row"]', 'bank-fees')
    await undoIn(page, press, words)
    await rowNamed(page, '[data-testid="category-row"]', 'bank-fees')
    await shoot('category-move-undone')
    await dismissToasts(page)

    await openMove('ai-services')
    await page.waitForSelector(dialog, { visible: true, timeout: 10_000 })
    await pickCategoryNamed(page, press, '[data-testid="category-move-into"]', 'software-subscriptions')
    await elementSays(page, '[data-testid="category-move-joined"]', [words.pack.categoryNaming.planRowsJoined(1).one], 'the move dialog does not say the plan row joins the one already there')
    await delay(300)
    await inspect?.('category move, plan row joins')
    await shoot('category-move-joined')
    await pressSelector(page, press, '[data-testid="confirm-category-move"]')
    await dialogGone(page, '[data-testid="category-move"]')
    await rowGone(page, '[data-testid="category-row"]', 'ai-services')
    await undoIn(page, press, words)
    await rowNamed(page, '[data-testid="category-row"]', 'ai-services')
    await dismissToasts(page)

    await openMove('travel')
    await page.waitForSelector('[role="dialog"] [data-testid="category-move-kept"]', { visible: true, timeout: 10_000 })
    await elementSays(page, '[data-testid="category-move-fix-on"]', [words.pack.links.yearPlan], 'the blocked move does not link the screen that fixes the plan row')
    if ((await page.$('[data-testid="confirm-category-move"]')) !== null || (await page.$('[data-testid="category-move-into"]')) !== null)
      throw new Error('the blocked move dialog still offers a move')
    await delay(300)
    await inspect?.('category move, blocked')
    await shoot('category-move-blocked')
    await pressButton(page, press, '[role="dialog"] button', moved.close)
    await dialogGone(page, '[data-testid="category-move-kept"]')

    const named = await rowNamed(page, '[data-testid="category-row"]', 'telecom')
    await setField(await fieldIn(named, said.columns.label), 'Phone and internet')
    const bin = await (await rowNamed(page, '[data-testid="category-row"]', 'bank-fees')).$('[data-testid="remove-category"]')
    const waits = await bin.evaluate((button) => button.hasAttribute('disabled') || button.getAttribute('data-disabled') !== null)
    if (!waits) throw new Error('the bin of a category in use stays on while the table has unsaved edits')
    await pressButton(page, press, 'button', said.discard)

    await openMove('travel')
    await pressSelector(page, press, '[role="dialog"] [data-testid="category-move-fix-on"]')
    await page
      .waitForFunction(() => location.hash.startsWith('#/company/year') && location.hash.includes('tab=plan') && !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
      .catch(() => {
        throw new Error('the blocked move’s link does not open Year on its Plan tab with the dialog closed')
      })
  }
}

export const categoryMoveFlow = categoryMoveFlowIn('en')

/** On a phone, the rule editor opened from a review row shows the box that says Save files the rows it settles. */
export function ruleWaitingFlowIn(language) {
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await press(await queueRow(page, 'GADGET CORNER'))
    await pressSelector(page, press, '[data-testid="make-rule"]')
    await shootAt(page, shoot, '[data-testid="rule-files-waiting"]', 'rule-waiting')
  }
}

/** The names of the categories rows on screen, in their order. */
function categoriesShown(page) {
  return page.$$eval('[data-testid="category-row"]', (rows) => rows.map((row) => row.querySelector('input')?.value ?? ''))
}

async function categoriesShow(page, wanted, why) {
  await page
    .waitForFunction(
      (names) => JSON.stringify([...document.querySelectorAll('[data-testid="category-row"]')].map((row) => row.querySelector('input')?.value ?? '')) === JSON.stringify(names),
      { timeout: 5_000 },
      wanted,
    )
    .catch(async () => {
      throw new Error(`${why}: the table shows ${(await categoriesShown(page)).join(', ')}`)
    })
}

async function categoryCountSays(page, wanted) {
  await page
    .waitForFunction((text) => document.querySelector('[data-testid="category-count"]')?.textContent?.trim() === text, { timeout: 5_000 }, wanted)
    .catch(async () => {
      throw new Error(`the count says "${await page.$eval('[data-testid="category-count"]', (element) => element.textContent?.trim())}", not "${wanted}"`)
    })
}

/**
 * Waits for the count of `shown` of `total` categories. A Croatian count picks the plural of its
 * last word by the rules of the language a script runs in, which is English, so in Croatian only
 * the words before it are compared.
 */
async function categoryCountShows(page, words, shown, total) {
  const said = words.settings.categories.shownOf(shown, total)
  if (words.locale === 'en-GB') return categoryCountSays(page, said)
  const start = said.slice(0, said.lastIndexOf(' ') + 1)
  await page
    .waitForFunction((text) => document.querySelector('[data-testid="category-count"]')?.textContent?.trim().startsWith(text), { timeout: 5_000 }, start)
    .catch(async () => {
      throw new Error(`the count says "${await page.$eval('[data-testid="category-count"]', (element) => element.textContent?.trim())}", not "${start}…"`)
    })
}

/** Picks a choice of one of the categories filters, such as `category-bucket-filter`, from the sheet behind the Filters button on a phone. */
async function filterCategories(page, press, words, filter, choice) {
  const sheet = await page.$('[data-testid="open-category-filters"]')
  if (sheet !== null) {
    await press(sheet)
    await page.waitForSelector(`[role="dialog"] [data-testid="${filter}"]`, { visible: true, timeout: 5_000 })
    await delay(400)
  }
  await choose(page, press, await page.$(`[data-testid="${filter}"]`), choice)
  if (sheet !== null) {
    const close = await page.waitForFunction(
      (label) => [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === label) ?? null,
      {},
      words.settings.categories.show,
    )
    await press(close.asElement())
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
    await delay(300)
  }
}

async function sortDirection(page, sortLabel) {
  return page.$eval(`th:has(> button[aria-label="${sortLabel}"])`, (header) => header.getAttribute('aria-sort'))
}

/**
 * Categories, found and sorted: a search with its count, the categories of one tax class picked by its name, the taxes bucket sorted by name with a
 * press and then the keyboard, and an edit while filtered and sorted by family. The row stays in
 * place while it is typed in, stays in view with its error once its new bucket leaves the filter,
 * leaves the list once saved and comes back with Undo.
 */
export function categoryFiltersFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const said = words.settings.categories
  const all = countedIn(words, said.count(33), 33)
  const byCategory = words.sortBy(said.columns.category)
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('input[data-testid="category-search"]', { visible: true })
    await categoryCountSays(page, all)
    await setField(await page.$('input[data-testid="category-search"]'), 'reimbursement')
    await categoriesShow(page, ['reimbursement-to-owner', 'reimbursement-from-owner'], 'a search for reimbursement')
    await categoryCountShows(page, words, 2, 33)
    await shoot('categories-search')
    await pressSelector(page, press, `[data-testid="category-filters"] button[aria-label="${said.clearSearch}"]`)
    await categoryCountSays(page, all)

    await filterCategories(page, press, words, 'category-class-filter', words.classes.revenue)
    const classesShown = await page.$$eval('[data-testid="category-row"] [data-testid="category-class"]', (selects) => selects.map((select) => select.textContent?.trim() ?? ''))
    if (classesShown.length === 0 || classesShown.length === 33 || classesShown.some((name) => name !== words.classes.revenue)) {
      throw new Error(`the tax class filter for "${words.classes.revenue}" shows the classes ${classesShown.join(', ')}`)
    }
    await categoryCountShows(page, words, classesShown.length, 33)
    await shoot('categories-tax-class')
    await pressSelector(page, press, '[data-testid="clear-category-filters"]')
    await categoryCountSays(page, all)

    await filterCategories(page, press, words, 'category-bucket-filter', words.settings.categories.bucketChoice('taxes'))
    await categoriesShow(page, ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax'], 'the taxes bucket in the tab order')
    await categoryCountShows(page, words, 5, 33)
    await pressSelector(page, press, `button[aria-label="${byCategory}"]`)
    await categoriesShow(page, ['corporate-income-tax', 'dividend-tax', 'payroll-contributions', 'payroll-tax', 'tax-refund'], 'a press on Category')
    if ((await sortDirection(page, byCategory)) !== 'ascending') throw new Error('the Category header does not say it sorts ascending')
    await page.focus(`button[aria-label="${byCategory}"]`)
    await page.keyboard.press('Enter')
    await categoriesShow(page, ['tax-refund', 'payroll-tax', 'payroll-contributions', 'dividend-tax', 'corporate-income-tax'], 'Enter on Category')
    if ((await sortDirection(page, byCategory)) !== 'descending') throw new Error('the Category header does not say it sorts descending')
    await shoot('categories-sorted')
    await page.keyboard.press('Space')
    await categoriesShow(page, ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax'], 'a third press on Category')
    if ((await sortDirection(page, byCategory)) !== null) throw new Error('the Category header still says it sorts')

    const byFamily = words.sortBy(said.columns.family)
    await pressSelector(page, press, `button[aria-label="${byFamily}"]`)
    const order = ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax']
    await categoriesShow(page, order, 'a press on Family')
    // The dividend tax's class sits in owner pay or taxes, so the row can leave the taxes filter without another class.
    const moved = 'dividend-tax'
    const row = await rowNamed(page, '[data-testid="category-row"]', moved)
    await setField(await fieldIn(row, said.columns.family), '')
    await page
      .waitForFunction(
        (required, at) => [...document.querySelectorAll('[data-testid="category-row"]')][at]?.querySelector('.field-error')?.textContent?.trim() === required,
        { timeout: 5_000 },
        words.editorFields.required,
        order.indexOf(moved),
      )
      .catch(() => {
        throw new Error('a blank family shows no error while the table is filtered and sorted')
      })
    if (!(await page.$eval('[data-testid="save-categories"]', (button) => button.disabled))) throw new Error('Save is on while a row is in error')
    await setField(await fieldIn(row, said.columns.family), 'zz-payouts')
    await delay(200)
    await categoriesShow(page, order, 'typing a family that sorts last')
    await choose(page, press, await row.$(`[aria-label="${said.columns.bucket}"]`), said.bucketChoice('owner-pay'))
    await categoriesShow(page, order, 'a new bucket outside the filter')
    await page
      .waitForFunction((kept) => document.querySelector('[data-testid="category-kept"]')?.textContent?.trim() === kept, { timeout: 5_000 }, countedIn(words, said.kept(1), 1))
      .catch(() => {
        throw new Error('the count does not say a row shows only for its unsaved change')
      })
    await shoot('categories-edit-filtered')

    await pressSelector(page, press, '[data-testid="save-categories"]')
    await toast(page, said.saved)
    await categoriesShow(page, ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax'], 'dividend-tax saved in the owner-pay bucket')
    await undoIn(page, press, words)
    await categoriesShow(page, order, 'Undo of the save')
    if ((await sortDirection(page, byFamily)) !== 'ascending') throw new Error('the sort by family did not outlast the save')
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="clear-category-filters"]')
    await categoryCountSays(page, all)
  }
}

export const categoryFiltersFlow = categoryFiltersFlowIn('en')

function coverageGroupShown(page, name, shown) {
  return page
    .waitForFunction(
      (wanted, present) => [...document.querySelectorAll('[data-testid="coverage-gap"]')].some((group) => group.textContent?.includes(wanted)) === present,
      { timeout: 10_000 },
      name,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `${name} is not listed among the rows no rule settles` : `${name} is still listed among the rows no rule settles`)
    })
}

/**
 * Sorting, Rules: dismiss a group no rule settles, find it under the dismissed suggestions, restore
 * it, and Undo the restore.
 */
export function dismissFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openCard(page, press, 'rule-coverage')
    await coverageGroupShown(page, 'Laptop Store', true)
    const group = await page.evaluateHandle(() => [...document.querySelectorAll('[data-testid="coverage-gap"]')].find((row) => row.textContent?.includes('Laptop Store')))
    const dismiss = await group.asElement().$('[data-testid="coverage-dismiss"]')
    await dismiss.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await press(dismiss)
    await delay(400)
    await toast(page, words.rules.suggestions.dismissed('Laptop Store'))
    await coverageGroupShown(page, 'Laptop Store', false)
    await dismissToasts(page)
    await openCard(page, press, 'dismissed-suggestions')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="dismissed-suggestion"]')?.textContent?.includes('Laptop Store') ?? false, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the dismissed group is not under the dismissed suggestions')
      })
    await inspect?.('dismissed suggestions')
    await shoot('dismissed-suggestions')
    await pressSelector(page, press, '[data-testid="restore-suggestion"]')
    await toast(page, words.rules.suggestions.restored)
    await coverageGroupShown(page, 'Laptop Store', true)
    await undoIn(page, press, words)
    await coverageGroupShown(page, 'Laptop Store', false)
    await shoot('dismiss-undone')
    await dismissToasts(page)
  }
}

export const dismissFlow = dismissFlowIn('en')

/** Waits until Categories to sort shows the button with this test id, as `shown` asks, and brings a shown one to the middle. */
async function toSortButtonShown(page, testId, shown) {
  const selector = `[data-testid="categories-to-sort"] [data-testid="${testId}"]`
  await page
    .waitForFunction((wanted, present) => (document.querySelector(wanted) !== null) === present, { timeout: 10_000 }, selector, shown)
    .catch(() => {
      throw new Error(shown ? `Categories to sort has no ${testId}` : `Categories to sort still has ${testId}`)
    })
  if (!shown) return
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
}

/**
 * Sorting in books that keep interest on the other income class: dismiss the suggested class in Categories to
 * sort, find it there with Restore, restore it, and Undo the restore.
 */
export function newerClassFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await openCard(page, press, 'categories-to-sort')
    await toSortButtonShown(page, 'dismiss-newer-class', true)
    await inspect?.('the suggested class with Dismiss')
    await shoot('newer-class-suggested')
    await pressSelector(page, press, '[data-testid="categories-to-sort"] [data-testid="dismiss-newer-class"]')
    await toastMatching(page, new RegExp(words.categoriesToSort.dismissedToast('.+')))
    await toSortButtonShown(page, 'dismiss-newer-class', false)
    await toSortButtonShown(page, 'restore-newer-class', true)
    await dismissToasts(page)
    await inspect?.('the dismissed class with Restore')
    await shoot('newer-class-dismissed')
    await pressSelector(page, press, '[data-testid="categories-to-sort"] [data-testid="restore-newer-class"]')
    await toast(page, words.categoriesToSort.restored)
    await toSortButtonShown(page, 'dismiss-newer-class', true)
    await undoIn(page, press, words)
    await toSortButtonShown(page, 'restore-newer-class', true)
    await shoot('newer-class-restore-undone')
    await dismissToasts(page)
  }
}

export const newerClassFlow = newerClassFlowIn('en')

/**
 * Sorting in books from before late payment interest: Add puts the category and its rules in with one Undo, then
 * Dismiss hides the offer, Restore shows it again and Undo takes the restore back.
 */
export function missingCategoryFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const offer = '[data-testid="categories-to-sort"] [data-testid="add-missing-category"]'
    await openCard(page, press, 'categories-to-sort')
    await toSortButtonShown(page, 'add-missing-category', true)
    await inspect?.('a missing starting category with Add and Dismiss')
    await shoot('missing-category-offered')
    const offers = await page.$$eval(offer, (buttons) => buttons.length)
    await pressSelector(page, press, offer)
    await toastMatching(page, new RegExp(words.categoriesToSort.added('.+')))
    await page
      .waitForFunction((css, before) => document.querySelectorAll(css).length === before - 1, { timeout: 10_000 }, offer, offers)
      .catch(() => {
        throw new Error('Add left the offer on Categories to sort')
      })
    await undoIn(page, press, words)
    await page
      .waitForFunction((css, before) => document.querySelectorAll(css).length === before, { timeout: 10_000 }, offer, offers)
      .catch(() => {
        throw new Error('Undo did not bring the offer back')
      })
    await dismissToasts(page)
    await pressSelector(page, press, '[data-testid="categories-to-sort"] [data-testid="dismiss-missing-category"]')
    await toastMatching(page, new RegExp(words.categoriesToSort.dismissedToast('.+')))
    await toSortButtonShown(page, 'restore-missing-category', true)
    await dismissToasts(page)
    await inspect?.('the dismissed offer with Restore')
    await shoot('missing-category-dismissed')
    await pressSelector(page, press, '[data-testid="categories-to-sort"] [data-testid="restore-missing-category"]')
    await toast(page, words.categoriesToSort.restored)
    await toSortButtonShown(page, 'restore-missing-category', false)
    await undoIn(page, press, words)
    await toSortButtonShown(page, 'restore-missing-category', true)
    await dismissToasts(page)
  }
}

async function ruleGone(page, id) {
  await page
    .waitForFunction(
      (selector, everyRule, wanted) => {
        document.querySelector(everyRule)?.click()
        return document.querySelector(everyRule) === null && ![...document.querySelectorAll(selector)].some((row) => row.querySelector('.identifier')?.textContent?.trim() === wanted)
      },
      { timeout: 10_000 },
      RULE_ROW,
      EVERY_RULE,
      id,
    )
    .catch(() => {
      throw new Error(`the rule ${id} is still on the rules tab`)
    })
}

/** Waits until the rule's note on the rules tab reads `note`, blank for none. */
async function ruleNoteReads(page, id, note, when) {
  await page
    .waitForFunction(
      (selector, everyRule, wanted, text) => {
        document.querySelector(everyRule)?.click()
        const row = [...document.querySelectorAll(selector)].find((candidate) => candidate.querySelector('.identifier')?.textContent?.trim() === wanted)
        return row !== undefined && (row.querySelector('[data-testid="rule-note"]')?.textContent?.trim() ?? '') === text
      },
      { timeout: 10_000 },
      RULE_ROW,
      EVERY_RULE,
      id,
      note,
    )
    .catch(() => {
      throw new Error(`${when}, the note of ${id} on the rules tab does not read "${note}"`)
    })
}

/** Ticks the back-test's "I have looked at these rows" when the change needs it. */
async function acceptBacktest(page, press) {
  await page.waitForSelector('[data-testid="rule-backtest"]', { visible: true, timeout: 10_000 })
  await delay(300)
  const accept = await page.$('[data-testid="accept-backtest"][role="checkbox"], [data-testid="accept-backtest"] [role="checkbox"]')
  if (accept === null) return
  await accept.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(accept)
}

/**
 * On Sorting, Rules: a rule's note changed in its editor, the toast with Undo once the editor closes,
 * and Undo putting the note back. Then the same rule deleted from its editor after the back-test of
 * taking it off, and brought back with Undo.
 */
export function rulesEditorFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const id = 'merchant-airline'
  const edited = words.ruleChanges.edited(id, ['note'], words.ruleChanges.renumbered(0))
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const added = 'Checked in the editor.'
    await ruleNoteReads(page, id, '', 'before the flow')

    await editRule(page, press, id)
    const note = await page.waitForSelector('[data-testid="rule-form"] textarea', { visible: true })
    await note.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await press(note)
    await page.keyboard.type(added)
    await acceptBacktest(page, press)
    await pressSelector(page, press, '[data-testid="save-rule"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
    await toast(page, edited)
    await ruleNoteReads(page, id, added, 'after the save')
    await shoot('rule-edited')
    await undoIn(page, press, words)
    await ruleNoteReads(page, id, '', 'after Undo')
    await dismissToasts(page)

    await editRule(page, press, id)
    await pressSelector(page, press, '[data-testid="delete-rule"]')
    await page.waitForSelector('[role="dialog"] [data-testid="rule-delete"]', { visible: true, timeout: 10_000 })
    await acceptBacktest(page, press)
    await inspect?.('rule delete back-test')
    await shoot('rule-delete')
    await pressSelector(page, press, '[data-testid="confirm-delete-rule"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    await toast(page, words.ruleChanges.deleted(id))
    await ruleGone(page, id)
    await undoIn(page, press, words)
    await ruleNoteReads(page, id, '', 'after Undo of the delete')
    await shoot('rule-deleted-undone')
    await dismissToasts(page)
  }
}

export const rulesEditorFlow = rulesEditorFlowIn('en')

/**
 * On Sorting, Rules: Berlin conference picked in a rule's Labels field, the change preview saying the rows it files
 * from now on take it while the rows it filed keep theirs, the label on the rule's row once saved, and Undo taking it off.
 */
export function ruleLabelsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const id = 'merchant-airline'
  const label = 'Berlin conference'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await editRule(page, press, id)
    const field = await page.waitForSelector('[data-testid="rule-labels"] [data-testid="labels-select"]', { visible: true, timeout: 10_000 })
    await pickLabel(page, press, field, label, false, '[role="dialog"] [data-testid="rule-editor"]')
    await inspect?.('the label a rule gains in its preview')
    await shootAt(page, shoot, '[data-testid="rule-labels-gained"]', 'rule-label-preview')
    await acceptBacktest(page, press)
    await pressSelector(page, press, '[data-testid="save-rule"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    await toast(page, words.ruleChanges.edited(id, [words.ruleChanges.labelIds], words.ruleChanges.renumbered(0)))
    await page
      .waitForFunction((wanted) => [...document.querySelectorAll('[data-testid="rule-label"]')].some((badge) => badge.textContent?.trim() === wanted), { timeout: 10_000 }, label)
      .catch(() => {
        throw new Error(`the rules tab shows no ${label} on ${id}`)
      })
    await inspect?.('the label on the rule')
    await shootAt(page, shoot, await ruleRowOf(page, id), 'rule-label-saved')
    await undoIn(page, press, words)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="rule-label"]') === null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('Undo left the label on the rule')
      })
    await dismissToasts(page)
  }
}

/**
 * The category picker wherever it sits: on a queue row, searched down to the category with the longest name and slug,
 * in the rule editor and the split dialog of that row, and in the dialog that changes a settled row's category.
 */
export function categoryPickerFlowIn(language) {
  const words = SCREEN_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await press(await queueRow(page, 'GADGET CORNER'))
    await page.waitForSelector('[data-testid="recategorise-row"]', { visible: true, timeout: 5_000 })
    await pressSelector(page, press, '[data-testid="recategorise-row"]')
    await page.waitForSelector('[role="listbox"]', { visible: true, timeout: 5_000 })
    await page.keyboard.type('benefits')
    await page
      .waitForFunction(() => document.querySelectorAll('[role="option"]').length === 1, { timeout: 5_000 })
      .catch(() => {
        throw new Error('searching the picker for benefits does not leave one category')
      })
    await delay(250)
    await inspect?.('the picker on the long category')
    await shoot('category-picker-long')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await lookAtDialog(page, press, shoot, '[data-testid="make-rule"]', '[data-testid="rule-category"]', 'category-picker-rule')
    await lookAtDialog(page, press, shoot, '[data-testid="split-row"]', '[data-testid="split-part-category"]', 'category-picker-split')
    await goTo(page, '#/company/transactions?p=all&q=CODE%20HOST', words.transactions.title)
    await openChangeOfRow(page, press)
    await page.waitForSelector('[data-testid="change-category"]', { visible: true, timeout: 5_000 })
    await delay(400)
    await openEachMenuIn(page, press, '[data-testid="change-category"]')
    await page.keyboard.press('Escape')
    await dialogGone(page, '[data-testid="change-category"]')
  }
}

/**
 * On the fake Company books' Labels: a label added, renamed and deleted with Undo, then Berlin conference opening its rows on
 * Transactions, filtered by the label.
 */
export function companyLabelsFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const labels = words.companyLabels
  const added = language === 'en' ? 'Trade fair' : 'Sajam'
  const renamed = language === 'en' ? 'Trade fair 2027' : 'Sajam 2027'
  const berlin = 'Berlin conference'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const says = async (wanted, problem) => {
      await page
        .waitForFunction((text) => document.body.textContent?.includes(text), { timeout: 5_000 }, wanted)
        .catch(() => {
          throw new Error(problem)
        })
    }
    await page.waitForSelector('[data-testid="company-labels"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="company-label-add"]')
    await page.waitForSelector('[data-testid="label-dialog"]', { visible: true, timeout: 10_000 })
    await pressSelector(page, press, '[data-testid="label-save"]')
    await says(words.labelName.blank, 'the label dialog takes a blank name')
    await fill(page, 'label-name', berlin.toUpperCase())
    await pressSelector(page, press, '[data-testid="label-save"]')
    await says(words.labelName.taken, 'the label dialog takes the name of another label')
    await fill(page, 'label-name', added)
    await delay(300)
    await inspect?.('the label dialog')
    await shoot('company-label-dialog')
    await pressSelector(page, press, '[data-testid="label-save"]')
    await toast(page, labels.added)
    await dismissToasts(page)
    await pressSelector(page, press, `[data-testid="company-label-change"][aria-label="${labels.change(added)}"]`)
    await page.waitForSelector('[data-testid="label-dialog"]', { visible: true, timeout: 10_000 })
    await fill(page, 'label-name', renamed)
    await pressSelector(page, press, '[data-testid="label-save"]')
    await toast(page, labels.saved)
    await dismissToasts(page)
    await pressSelector(page, press, `[data-testid="company-label-change"][aria-label="${labels.change(berlin)}"]`)
    await page.waitForSelector('[data-testid="label-dialog"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('the label dialog of a label rows carry')
    await shoot('company-label-dialog-carried')
    await pressSelector(page, press, '[data-testid="label-delete"]')
    await toast(page, labels.deleted)
    await undoIn(page, press, words)
    await says(berlin, 'Undo did not bring the deleted label back')
    await dismissToasts(page)
    await inspect?.('Labels after Undo')
    await shoot('company-labels-after-undo')

    const links = await page.$$('[data-testid="company-label-open"]')
    const named = await Promise.all(links.map((link) => link.evaluate((element) => element.textContent ?? '')))
    const berlinRow = links[named.findIndex((text) => text.includes(berlin))]
    if (berlinRow === undefined) throw new Error(`Labels lists no ${berlin}`)
    await press(berlinRow)
    await page
      .waitForFunction(() => window.location.hash.includes('lb='), { timeout: 10_000 })
      .catch(() => {
        throw new Error("the label's row did not open its rows on Transactions")
      })
    await page.waitForSelector('[data-testid="company-row-labels"]', { visible: true, timeout: 10_000 })
    const shown = await page.$$eval('[data-testid="company-row-labels"]', (lines) => lines.map((line) => line.textContent ?? ''))
    if (shown.some((line) => !line.includes(berlin))) throw new Error(`Transactions filtered by ${berlin} shows rows without it: ${shown.join(' | ')}`)
    await inspect?.('Transactions filtered by a label')
    await shoot('company-transactions-by-label')
  }
}

/**
 * On the fake Company books' Transactions: three rows picked, the first on a desktop by a click on its row rather than its tick,
 * then labelled in one write, which one Undo takes back. In English they take New office 2027 of the books, and in Croatian a new label
 * typed into the picker, since the books name their labels in English.
 */
export function companySelectLabelFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const office = language === 'en' ? 'New office 2027' : 'Uređenje ureda'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const carrying = () => page.$$eval('[data-testid="company-row-labels"]', (lines, wanted) => lines.filter((line) => line.textContent?.includes(wanted)).length, office)
    const pickedCount = () => page.$eval('[data-testid="selection-bar-count"]', (count) => Number.parseInt(count.textContent ?? '', 10) || 0)
    await pressSelector(page, press, '[data-testid="company-select-rows"]')
    await page.waitForSelector('[data-testid="selection-bar"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('Transactions with nothing picked')
    await shoot('company-select-none')
    const firstCell = await page.$('tbody tr:has([data-testid="pick-row"]) td:nth-child(2)')
    if (firstCell !== null) {
      await press(firstCell)
      await delay(100)
      if ((await pickedCount()) !== 1) throw new Error('a click on a table row did not pick it')
    }
    for (const tick of await page.$$('[data-testid="pick-row"]')) {
      if ((await pickedCount()) >= 3) break
      const before = await pickedCount()
      await press(tick)
      await delay(100)
      // A part's tick picks the row it belongs to, so a tick of a row already picked takes it off, and a second press puts it back.
      if ((await pickedCount()) < before) {
        await press(tick)
        await delay(100)
      }
    }
    if ((await pickedCount()) !== 3) throw new Error(`${await pickedCount()} rows picked, not three`)
    await delay(300)
    await inspect?.('Transactions with three rows picked')
    await shoot('company-select-three')
    await pressSelector(page, press, '[data-testid="company-selection-label"]')
    await page.waitForSelector('[data-testid="label-picker"]', { visible: true, timeout: 10_000 })
    await delay(300)
    await inspect?.('the label picker')
    await shoot('company-label-picker')
    if (language === 'en') {
      const choices = await page.$$('[data-testid="label-choice"]')
      const named = await Promise.all(choices.map((choice) => choice.evaluate((element) => element.textContent ?? '')))
      const choice = choices[named.findIndex((text) => text.includes(office))]
      if (choice === undefined) throw new Error(`the label picker offers no ${office}`)
      await press(await choice.$('[data-testid="label-apply"]'))
    } else {
      await fill(page, 'label-new-name', office)
      await pressSelector(page, press, '[data-testid="label-new-add"]')
    }
    await toastMatching(page, new RegExp(office))
    if ((await page.$('[data-testid="selection-bar"]')) !== null) throw new Error('the selection stays after labelling')
    const labelled = await carrying()
    if (labelled < 3) throw new Error(`${labelled} rows carry ${office} after labelling three`)
    await inspect?.('Transactions after labelling')
    await shoot('company-select-labelled')
    await undoIn(page, press, words)
    if ((await carrying()) !== 0) throw new Error(`Undo left ${office} on rows`)
    await dismissToasts(page)
  }
}

/** An old address of Company's labels or of Settings' Categories or Category rules tab, kept from before Sorting held them, opens Sorting with that card open and in view. */
export function companyOldAddressFlowIn(language, card) {
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page
      .waitForFunction((wanted) => window.location.hash.startsWith('#/company/sorting') && window.location.hash.endsWith(`#${wanted}`), { timeout: 10_000 }, card)
      .catch(async () => {
        throw new Error(`the old address did not land on Sorting's ${card} card but on ${await page.evaluate(() => window.location.hash)}`)
      })
    const landed = await page.waitForSelector(`[id="${card}"]`, { visible: true, timeout: 10_000 })
    if ((await landed.evaluate((element) => element.dataset.collapsed)) === 'true') throw new Error(`Sorting's ${card} card stays folded after the old address`)
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
    await shoot(`company-old-${card}-address`)
  }
}

/** Presses a rule count and checks the Rules card then shows that many rules, its chip and no move arrows, and that the chip shows every rule again. */
async function companyRulesShownFor(page, press, link, name, words, every, shoot, inspect, shot) {
  const counted = Number.parseInt((await link.evaluate((element) => element.textContent ?? '')).trim(), 10)
  await press(link)
  await page
    .waitForFunction(() => /[?&](category|label)=/.test(window.location.hash) && window.location.hash.endsWith('#rules'), { timeout: 10_000 })
    .catch(async () => {
      throw new Error(`the count of ${name} did not open its rules but ${await page.evaluate(() => window.location.hash)}`)
    })
  await countOf(page, '[data-testid="rule-row"]', counted, `only the rules for ${name} should show`)
  await page.waitForSelector('[data-testid="company-rules-shown-for"]', { visible: true, timeout: 5_000 })
  await countOf(page, '[data-testid="rule-row"] [data-testid="move-up"], [data-testid="rule-row"] [data-testid="move-down"]', 0, 'a filtered list should offer no moves')
  await delay(300)
  await inspect?.(`the rules for ${name}`)
  await shoot(shot)
  await pressSelector(page, press, `[aria-label="${words.rules.tab.showAll(name)}"]`)
  await countOf(page, '[data-testid="rule-row"]', every, 'the chip should show every rule again')
  if (await page.evaluate(() => /[?&](category|label)=/.test(window.location.hash))) throw new Error('the chip left the category or label in the address')
}

/**
 * On Company's Sorting: the Categories card starts folded on a first visit, and once opened, a category's rule count opens the Rules
 * card with only the rules that file under it, a chip and no move arrows, and the chip shows every rule again. Then Berlin conference
 * goes on a rule, and its count on the Labels card does the same for the rules that put it on. The rule keeps the label, since
 * each flow reads the fake books afresh.
 */
export function companyRulesForFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const id = 'merchant-airline'
  const label = 'Berlin conference'
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector('[data-testid="rule-row"]', { timeout: 10_000 })
    if (await page.$(EVERY_RULE)) await pressSelector(page, press, EVERY_RULE)
    const every = await page.$$eval('[data-testid="rule-row"]', (rows) => rows.length)
    if (every < 2) throw new Error('the set should start with more than one rule')
    const categories = await page.waitForSelector('[data-testid="company-categories"]', { timeout: 10_000 })
    if ((await categories.evaluate((card) => card.dataset.collapsed)) !== 'true') throw new Error('the Categories card should start folded on a first visit')
    await openCard(page, press, 'company-categories')
    const categoryLink = await page.waitForSelector('[data-testid="company-categories"] [data-testid="company-rules-link"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('no category counts its rules')
    })
    await categoryLink.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    const [text, spoken] = await categoryLink.evaluate((element) => [(element.textContent ?? '').trim(), element.getAttribute('aria-label') ?? ''])
    const [before, after] = words.rules.tab.countOf(text, '\u0000').split('\u0000')
    const category = spoken.slice(before.length, spoken.length - after.length)
    await companyRulesShownFor(page, press, categoryLink, category, words, every, shoot, inspect, 'company-rules-for-category')

    await editRule(page, press, id)
    const field = await page.waitForSelector('[data-testid="rule-labels"] [data-testid="labels-select"]', { visible: true, timeout: 10_000 })
    await pickLabel(page, press, field, label, false, '[role="dialog"] [data-testid="rule-editor"]')
    await acceptBacktest(page, press)
    await pressSelector(page, press, '[data-testid="save-rule"]')
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    const labelLink = await page
      .waitForSelector(`[data-testid="company-labels"] [data-testid="company-rules-link"][aria-label="${words.rules.tab.countOf(words.rules.tab.count(1).one, label)}"]`, {
        visible: true,
        timeout: 10_000,
      })
      .catch(() => {
        throw new Error(`${label} does not say 1 rule once a rule puts it on`)
      })
    await labelLink.evaluate((element) => element.scrollIntoView({ block: 'center' }))
    await delay(200)
    await companyRulesShownFor(page, press, labelLink, label, words, every, shoot, inspect, 'company-rules-for-label')
    await dismissToasts(page)
  }
}
