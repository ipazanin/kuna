/**
 * Add, edit, delete and undo on the row editors, and where the books are kept, shared by the visual
 * and the touch check. `press` clicks or taps an element handle, and `shoot` takes a screenshot
 * under a name. Each flow starts on its screen and leaves the workbook as it found it, except the
 * flows that choose where the books are kept. A failure throws with what was missing.
 */

const TOAST = 'li[data-slot="base"]'

export function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function pressSelector(page, press, selector) {
  const handle = await page.waitForSelector(selector, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`no visible ${selector} within 10 s`)
  })
  await handle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(handle)
  return handle
}

/** Sets a field the way typing does, so Vue's v-model sees it. */
async function setField(input, value) {
  await input.evaluate((element, text) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(element, text)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

/** The row of an editor table whose first field reads `name`. */
async function rowNamed(page, rowSelector, name) {
  return page
    .waitForFunction(
      (selector, wanted) => [...document.querySelectorAll(selector)].find((row) => row.querySelector('input')?.value === wanted) ?? null,
      { timeout: 10_000 },
      rowSelector,
      name,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no ${rowSelector} named "${name}"`)
    })
}

async function rowGone(page, rowSelector, name) {
  await page
    .waitForFunction((selector, wanted) => ![...document.querySelectorAll(selector)].some((row) => row.querySelector('input')?.value === wanted), { timeout: 10_000 }, rowSelector, name)
    .catch(() => {
      throw new Error(`the ${rowSelector} named "${name}" is still there`)
    })
}

async function fieldIn(row, label) {
  const input = await row.$(`input[aria-label="${label}"]`)
  if (input === null) throw new Error(`no field "${label}" in the row`)
  return input
}

async function choose(page, press, trigger, option) {
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(150)
  await press(trigger)
  const handle = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim() === wanted) ?? null, { timeout: 5_000 }, option)
    .catch(() => {
      throw new Error(`no option "${option}"`)
    })
  await press(handle.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

/** Waits for a toast with this title, which must be the only one, since earlier ones were dismissed. */
async function toast(page, title) {
  await page
    .waitForFunction(
      (selector, wanted) => [...document.querySelectorAll(`${selector} [data-slot="title"]`)].some((element) => element.textContent?.trim() === wanted),
      { timeout: 10_000 },
      TOAST,
      title,
    )
    .catch(async () => {
      const shown = await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((element) => element.textContent?.trim()).join(' | '), TOAST)
      throw new Error(`no "${title}" toast within 10 s, the toasts say: ${shown || 'nothing'}`)
    })
  // The toast rises into place. A tap before it settles lands where it was.
  await delay(600)
}

async function dismissToasts(page) {
  await page.evaluate((selector) => {
    for (const close of document.querySelectorAll(`${selector} button[aria-label="Close"]`)) close.click()
  }, TOAST)
  await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 0, { timeout: 5_000 }, TOAST).catch(() => {
    throw new Error('the toasts did not close')
  })
}

/** Presses Undo on the one toast that offers it and waits for "Undone". */
async function undo(page, press) {
  const button = await page
    .waitForFunction((selector) => [...document.querySelectorAll(`${selector} button`)].find((element) => element.textContent?.trim() === 'Undo') ?? null, { timeout: 5_000 }, TOAST)
    .catch(() => {
      throw new Error('no toast offers Undo')
    })
  await press(button.asElement())
  await toast(page, 'Undone')
}

/**
 * Opens the colour pop-up of a categories row, checks its nine 44 px swatches after Bucket colour,
 * moves through them with the arrow keys, and picks `name`. Leaves the pop-up open.
 */
async function pickCategoryColour(page, press, row, name) {
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
  if (names !== 'Bucket colour, Green, Orange, Blue, Amber, Pink, Dark green, Violet, Red, Grey') throw new Error(`the colour pop-up offers ${names}`)
  const small = radios.filter((radio) => radio.width < 43.5 || radio.height < 43.5)
  if (small.length > 0) throw new Error(`swatches under 44 px: ${small.map((radio) => `${radio.name} ${Math.round(radio.width)}x${Math.round(radio.height)}`).join(', ')}`)
  if (!radios[0].checked) throw new Error('a new category does not start on Bucket colour')

  await page.focus('[data-testid="colour-swatch-picker"] [role="radio"][aria-checked="true"]')
  // The radio group checks the radio an arrow focuses only while the key is still down, as a finger on a key holds it.
  await page.keyboard.press('ArrowRight', { delay: 60 })
  await page.keyboard.press('ArrowRight', { delay: 60 })
  await page
    .waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Orange' && document.activeElement?.getAttribute('aria-checked') === 'true', { timeout: 5_000 })
    .catch(() => {
      throw new Error('two presses of the right arrow from Bucket colour did not check Orange')
    })

  await press(await page.$(`[data-testid="colour-swatch-picker"] [role="radio"][aria-label="${name}"]`))
  await page
    .waitForFunction((wanted) => document.querySelector(`[data-testid="colour-swatch-picker"] [role="radio"][aria-label="${wanted}"]`)?.getAttribute('aria-checked') === 'true', { timeout: 5_000 }, name)
    .catch(() => {
      throw new Error(`pressing ${name} did not pick it`)
    })
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
 * focuses its name, give it a colour from the pop-up, a label on a tab without the column and a
 * role, delete it, and Undo the delete.
 */
export async function categoryFlow(page, { press, shoot }) {
  await pressSelector(page, press, '[data-testid="add-category"]')
  await page
    .waitForFunction(
      () => {
        const added = [...document.querySelectorAll('[data-testid="category-row"]')].at(-1)
        const frame = document.querySelector('[data-testid="categories-frame"]')
        const header = frame?.querySelector('thead th')
        if (!added || !frame || !header || document.activeElement !== added.querySelector('input[aria-label="Category"]')) return false
        const frameBox = frame.getBoundingClientRect()
        const rowBox = added.getBoundingClientRect()
        return frame.scrollTop > 0 && Math.abs(header.getBoundingClientRect().top - frameBox.top) < 1 && rowBox.top >= frameBox.top && rowBox.bottom <= frameBox.bottom + 1
      },
      { timeout: 5_000 },
    )
    .catch(() => {
      throw new Error('Add category did not scroll the table to the new row under its header and focus its name')
    })
  const added = (await page.$$('[data-testid="category-row"]')).at(-1)
  await setField(await fieldIn(added, 'Category'), 'stationery')
  await setField(await fieldIn(added, 'Family'), 'operating')
  await delay(200)
  await shoot('categories-draft')
  await pressSelector(page, press, '[data-testid="save-categories"]')
  await toast(page, 'Categories saved')
  await shoot('categories-saved')
  await dismissToasts(page)

  await pickCategoryColour(page, press, await rowNamed(page, '[data-testid="category-row"]', 'stationery'), 'Blue')
  const note = await page.$eval('[data-testid="colour-swatch-note"]', (element) => element.textContent?.trim() ?? '')
  if (note !== 'Blue. Also used by Travel and Software subscriptions.') throw new Error(`the colour pop-up says "${note}"`)
  await shoot('categories-colour')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[data-testid="colour-swatch-picker"]'), { timeout: 5_000 })
  await pressSelector(page, press, '[data-testid="save-categories"]')
  await toast(page, 'Categories saved')
  await dismissToasts(page)

  const named = await rowNamed(page, '[data-testid="category-row"]', 'stationery')
  await setField(await fieldIn(named, 'Shown as'), 'Paper and pens')
  await chooseRole(page, press, named, 'representation')
  await shoot('categories-label-and-role')
  await pressSelector(page, press, '[data-testid="save-categories"]')
  await toast(page, 'Categories saved')
  await dismissToasts(page)

  const row = await rowNamed(page, '[data-testid="category-row"]', 'stationery')
  await press(await row.$('[data-testid="remove-category"]'))
  await pressSelector(page, press, '[data-testid="save-categories"]')
  await toast(page, 'Categories saved')
  await rowGone(page, '[data-testid="category-row"]', 'stationery')
  await undo(page, press)
  const back = await rowNamed(page, '[data-testid="category-row"]', 'stationery')
  const colour = await (await back.$('[data-testid="colour-swatch-button"]')).evaluate((button) => button.getAttribute('aria-label'))
  if (colour !== 'Colour of Paper and pens: Blue') throw new Error(`Undo brought stationery back as "${colour}"`)
  await dismissToasts(page)
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

/** Picks a bucket in the categories filters, from the sheet behind the Filters button on a phone. */
async function filterCategoriesByBucket(page, press, bucket) {
  const sheet = await page.$('[data-testid="open-category-filters"]')
  if (sheet !== null) {
    await press(sheet)
    await page.waitForSelector('[role="dialog"] [data-testid="category-bucket-filter"]', { visible: true, timeout: 5_000 })
    await delay(400)
  }
  await choose(page, press, await page.$('[data-testid="category-bucket-filter"]'), bucket)
  if (sheet !== null) {
    const close = await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === 'Show categories') ?? null)
    await press(close.asElement())
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
    await delay(300)
  }
}

async function sortDirection(page, label) {
  return page.$eval(`th:has(> button[aria-label="Sort by ${label}"])`, (header) => header.getAttribute('aria-sort'))
}

/**
 * Categories, found and sorted: a search with its count, the taxes bucket sorted by name with a
 * press and then the keyboard, and an edit while filtered and sorted by family. The row stays in
 * place while it is typed in, stays in view with its error once its new bucket leaves the filter,
 * leaves the list once saved and comes back with Undo.
 */
export async function categoryFiltersFlow(page, { press, shoot }) {
  await page.waitForSelector('input[data-testid="category-search"]', { visible: true })
  await categoryCountSays(page, '33 categories')
  await setField(await page.$('input[data-testid="category-search"]'), 'reimbursement')
  await categoriesShow(page, ['reimbursement-to-owner', 'reimbursement-from-owner'], 'a search for reimbursement')
  await categoryCountSays(page, '2 of 33 categories')
  await shoot('categories-search')
  await pressSelector(page, press, '[data-testid="category-filters"] button[aria-label="Clear the search"]')
  await categoryCountSays(page, '33 categories')

  await filterCategoriesByBucket(page, press, 'taxes')
  await categoriesShow(page, ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax'], 'the taxes bucket in the tab order')
  await categoryCountSays(page, '5 of 33 categories')
  await pressSelector(page, press, 'button[aria-label="Sort by category"]')
  await categoriesShow(page, ['corporate-income-tax', 'dividend-tax', 'payroll-contributions', 'payroll-tax', 'tax-refund'], 'a press on Category')
  if ((await sortDirection(page, 'category')) !== 'ascending') throw new Error('the Category header does not say it sorts ascending')
  await page.focus('button[aria-label="Sort by category"]')
  await page.keyboard.press('Enter')
  await categoriesShow(page, ['tax-refund', 'payroll-tax', 'payroll-contributions', 'dividend-tax', 'corporate-income-tax'], 'Enter on Category')
  if ((await sortDirection(page, 'category')) !== 'descending') throw new Error('the Category header does not say it sorts descending')
  await shoot('categories-sorted')
  await page.keyboard.press('Space')
  await categoriesShow(page, ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax'], 'a third press on Category')
  if ((await sortDirection(page, 'category')) !== null) throw new Error('the Category header still says it sorts')

  await pressSelector(page, press, 'button[aria-label="Sort by family"]')
  const order = ['tax-refund', 'payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax']
  await categoriesShow(page, order, 'a press on Family')
  const row = await rowNamed(page, '[data-testid="category-row"]', 'tax-refund')
  await setField(await fieldIn(row, 'Family'), '')
  await page
    .waitForFunction(() => [...document.querySelectorAll('[data-testid="category-row"]')][0]?.querySelector('.field-error')?.textContent?.trim() === 'Required', { timeout: 5_000 })
    .catch(() => {
      throw new Error('a blank family shows no error while the table is filtered and sorted')
    })
  if (!(await page.$eval('[data-testid="save-categories"]', (button) => button.disabled))) throw new Error('Save is on while a row is in error')
  await setField(await fieldIn(row, 'Family'), 'zz-refunds')
  await delay(200)
  await categoriesShow(page, order, 'typing a family that sorts last')
  await choose(page, press, await row.$('[aria-label="Bucket"]'), 'income')
  await categoriesShow(page, order, 'a new bucket outside the filter')
  await page.waitForFunction(() => document.querySelector('[data-testid="category-kept"]')?.textContent?.trim() === '1 of them shows only for an unsaved change or an error.', { timeout: 5_000 }).catch(() => {
    throw new Error('the count does not say a row shows only for its unsaved change')
  })
  await shoot('categories-edit-filtered')

  await pressSelector(page, press, '[data-testid="save-categories"]')
  await toast(page, 'Categories saved')
  await categoriesShow(page, ['payroll-contributions', 'payroll-tax', 'corporate-income-tax', 'dividend-tax'], 'tax-refund saved in the income bucket')
  await undo(page, press)
  await categoriesShow(page, order, 'Undo of the save')
  if ((await sortDirection(page, 'family')) !== 'ascending') throw new Error('the sort by family did not outlast the save')
  await dismissToasts(page)
  await pressSelector(page, press, '[data-testid="clear-category-filters"]')
  await categoryCountSays(page, '33 categories')
}

/** Owner: change the newest advance's description, delete it, and Undo the delete. */
export async function advanceFlow(page, { press, shoot }) {
  const first = async () => (await page.waitForSelector('[data-testid="advance-list"] li', { visible: true, timeout: 10_000 })).evaluate((element) => element.textContent ?? '')
  await pressSelector(page, press, '[data-testid="advance-edit"]')
  await page.waitForSelector('[data-testid="add-advance"]', { visible: true })
  const description = await page.waitForSelector('[data-testid="add-advance"] input[placeholder="Train tickets to the client"]')
  await setField(description, 'Train tickets, changed')
  await delay(200)
  await shoot('advance-edit')
  await pressSelector(page, press, 'button[form="add-advance"]')
  await toast(page, 'Advance changed')
  await dialogGone(page, '[data-testid="add-advance"]')
  if (!(await first()).includes('Train tickets, changed')) throw new Error('the changed advance does not show its new description')
  await dismissToasts(page)

  await pressSelector(page, press, '[data-testid="advance-edit"]')
  await pressSelector(page, press, '[data-testid="advance-delete"]')
  await toast(page, 'Advance deleted')
  await dialogGone(page, '[data-testid="add-advance"]')
  if ((await first()).includes('Train tickets, changed')) throw new Error('the deleted advance is still listed')
  await undo(page, press)
  await page.waitForFunction(() => document.querySelector('[data-testid="advance-list"] li')?.textContent?.includes('Train tickets, changed') ?? false, { timeout: 10_000 }).catch(() => {
    throw new Error('Undo did not bring the advance back')
  })
  await dismissToasts(page)
}

/** Assets: add a monitor, note it, delete it, and Undo the delete. */
export async function assetFlow(page, { press, shoot }) {
  await pressSelector(page, press, '#asset-rows [data-testid="add-row"]')
  const added = (await page.$$('#asset-rows [data-testid="fact-row"]')).at(-1)
  await setField(await fieldIn(added, 'Asset'), 'Monitor')
  await setField(await fieldIn(added, 'Bought'), '2026-10-01')
  await setField(await fieldIn(added, 'Cost without VAT'), '420')
  await choose(page, press, await added.$('[aria-label="Group"]'), 'computers')
  await shoot('assets-draft')
  await pressSelector(page, press, '#asset-rows [data-testid="save-rows"]')
  await toast(page, 'Assets saved')
  await dismissToasts(page)

  await setField(await fieldIn(await rowNamed(page, '#asset-rows [data-testid="fact-row"]', 'Monitor'), 'Note'), 'Second screen')
  await pressSelector(page, press, '#asset-rows [data-testid="save-rows"]')
  await toast(page, 'Assets saved')
  await shoot('assets-saved')
  await dismissToasts(page)

  const row = await rowNamed(page, '#asset-rows [data-testid="fact-row"]', 'Monitor')
  await press(await row.$('[data-testid="remove-row"]'))
  await pressSelector(page, press, '#asset-rows [data-testid="save-rows"]')
  await toast(page, 'Assets saved')
  await rowGone(page, '#asset-rows [data-testid="fact-row"]', 'Monitor')
  await undo(page, press)
  await rowNamed(page, '#asset-rows [data-testid="fact-row"]', 'Monitor')
  await dismissToasts(page)
}

/** Salaries: add an employee, change the dependants, delete the row, and Undo the delete. */
export async function employeeFlow(page, { press, shoot }) {
  const rows = '#employee-rows [data-testid="fact-row"]'
  await pressSelector(page, press, '#employee-rows [data-testid="add-row"]')
  const added = (await page.$$(rows)).at(-1)
  await setField(await fieldIn(added, 'Employee'), 'sam')
  await setField(await fieldIn(added, 'Lives in'), 'Split')
  await setField(await fieldIn(added, 'Employed from'), '2026-03-02')
  await shoot('employees-draft')
  await pressSelector(page, press, '#employee-rows [data-testid="save-rows"]')
  await toast(page, 'Employees saved')
  await dismissToasts(page)

  await setField(await fieldIn(await rowNamed(page, rows, 'sam'), 'Dependants'), '1')
  await pressSelector(page, press, '#employee-rows [data-testid="save-rows"]')
  await toast(page, 'Employees saved')
  await shoot('employees-saved')
  await dismissToasts(page)

  const row = await rowNamed(page, rows, 'sam')
  await press(await row.$('[data-testid="remove-row"]'))
  await pressSelector(page, press, '#employee-rows [data-testid="save-rows"]')
  await toast(page, 'Employees saved')
  await rowGone(page, rows, 'sam')
  await undo(page, press)
  await rowNamed(page, rows, 'sam')
  await dismissToasts(page)
}

function invoiceListed(page, number) {
  return page.evaluate((wanted) => [...document.querySelectorAll('[data-testid="invoice-list"] .figure')].some((element) => element.textContent?.trim() === wanted), number)
}

async function waitForInvoice(page, number, listed) {
  await page.waitForFunction(
    (wanted, shown) => [...document.querySelectorAll('[data-testid="invoice-list"] .figure')].some((element) => element.textContent?.trim() === wanted) === shown,
    { timeout: 10_000 },
    number,
    listed,
  ).catch(() => {
    throw new Error(`invoice ${number} is ${listed ? 'not' : 'still'} on the list`)
  })
}

async function dialogClosed(page) {
  await page.waitForFunction(() => !document.querySelector('[data-testid="invoice-form"]'), { timeout: 10_000 })
  await delay(300)
}

/** Invoices: add one, change its amount, delete it, and Undo the delete. */
export async function invoiceFlow(page, { press, shoot, inspect }) {
  const number = 'TEST-001'
  if (await invoiceListed(page, number)) throw new Error(`${number} is on the list before the flow adds it`)
  await pressSelector(page, press, '[data-testid="invoice-add"]')
  await page.waitForSelector('[data-testid="invoice-form"]')
  await delay(400)
  await setField(await page.$('[data-testid="invoice-number"]'), number)
  await setField(await page.$('[data-testid="invoice-item"]'), 'Workshop follow-up')
  await setField(await page.$('[data-testid="invoice-amount"]'), '1250.00')
  await choose(page, press, await page.$('[data-testid="invoice-client"]'), 'Lumen Labs')
  await inspect?.('add an invoice')
  await shoot('invoice-add')
  await pressSelector(page, press, '[data-testid="invoice-save"]')
  await toast(page, 'Invoice added')
  await dialogClosed(page)
  await waitForInvoice(page, number, true)
  await shoot('invoice-added')
  await dismissToasts(page)

  await pressSelector(page, press, `[data-testid="invoice-edit"][aria-label="Edit invoice ${number}"]`)
  await page.waitForSelector('[data-testid="invoice-form"]')
  await delay(400)
  await setField(await page.$('[data-testid="invoice-amount"]'), '1300')
  await inspect?.('edit an invoice')
  await shoot('invoice-edit')
  await pressSelector(page, press, '[data-testid="invoice-save"]')
  await toast(page, 'Invoice saved')
  await dialogClosed(page)
  await dismissToasts(page)

  await pressSelector(page, press, `[data-testid="invoice-edit"][aria-label="Edit invoice ${number}"]`)
  await page.waitForSelector('[data-testid="invoice-form"]')
  await delay(400)
  await pressSelector(page, press, '[data-testid="invoice-delete"]')
  await toast(page, 'Invoice deleted')
  await dialogClosed(page)
  await waitForInvoice(page, number, false)
  await undo(page, press)
  await waitForInvoice(page, number, true)
  await dismissToasts(page)
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
export async function invoiceRunFlow(page, { press, shoot, inspect }) {
  const answers = ['accept', 'accept', 'dismiss']
  const asked = []
  const answer = async (dialog) => {
    asked.push(dialog.message())
    if (answers.shift() === 'accept') await dialog.accept()
    else await dialog.dismiss()
  }
  page.on('dialog', answer)
  try {
    await pressSelector(page, press, '[data-testid="invoice-make"]')
    await waitForRunStage(page, '[data-testid="invoice-lines"]')
    const number = await page.$eval('[data-testid="invoice-run-number"]', (input) => input.value)
    if (number === '') throw new Error('the dialog suggests no invoice number')
    const google = (await page.$('[data-testid="invoice-run-draft"]')) !== null
    if (google) await pressSelector(page, press, '[data-testid="invoice-run-draft"]')
    await inspect?.('make an invoice')
    await shoot('invoice-run-form')
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
    await pressSelector(page, press, `[data-testid="invoice-edit"][aria-label="Edit invoice ${number}"]`)
    await page.waitForSelector('[data-testid="invoice-form"]')
    await delay(400)
    await pressSelector(page, press, '[data-testid="invoice-reexport"]')
    await waitForRunStage(page, '[data-testid="invoice-lines"]')
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

async function dialogGone(page, selector) {
  await page.waitForFunction((wanted) => !document.querySelector(wanted), { timeout: 10_000 }, selector).catch(() => {
    throw new Error(`${selector} is still open`)
  })
  await delay(300)
}

/** The component button of a scenario whose text starts with `text`, or null. */
function componentIn(page, scenario, text) {
  return page.evaluateHandle(
    (slug, wanted) => [...document.querySelectorAll(`[data-scenario="${slug}"] [data-testid="scenario-component"]`)].find((button) => button.textContent?.trim().startsWith(wanted)) ?? null,
    scenario,
    text,
  )
}

async function waitForComponent(page, scenario, text, shown) {
  await page
    .waitForFunction(
      (slug, wanted, present) => [...document.querySelectorAll(`[data-scenario="${slug}"] [data-testid="scenario-component"]`)].some((button) => button.textContent?.trim().startsWith(wanted)) === present,
      { timeout: 10_000 },
      scenario,
      text,
      shown,
    )
    .catch(() => {
      throw new Error(`"${text}" is ${shown ? 'not' : 'still'} in ${scenario}`)
    })
}

async function openComponent(page, press, scenario, text) {
  const button = (await componentIn(page, scenario, text)).asElement()
  if (button === null) throw new Error(`no "${text}" in ${scenario}`)
  await button.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(button)
  await page.waitForSelector('[data-testid="scenario-component-form"]')
  await delay(400)
}

/** Year, Pay: open the scenarios, add rent to the floor salary scenario, raise it, delete it, Undo the delete, then copy the scenario and Undo the copy. */
export async function scenarioFlow(page, { press, shoot, inspect }) {
  const scenario = 'floor-salary'
  await openCard(page, press, 'scenario-editor')
  await pressSelector(page, press, `[data-scenario="${scenario}"] [data-testid="scenario-add-component"]`)
  await page.waitForSelector('[data-testid="scenario-component-form"]')
  await delay(400)
  await choose(page, press, await page.$('[data-testid="component-kind"]'), 'Rent')
  await setField(await page.waitForSelector('[data-testid="component-amount"]'), '300')
  await setField(await page.$('[data-testid="component-from"]'), '2027-07-01')
  await inspect?.('add a component')
  await shoot('scenario-add')
  await pressSelector(page, press, '[data-testid="component-save"]')
  await toast(page, 'Component added')
  await dialogGone(page, '[data-testid="scenario-component-form"]')
  await waitForComponent(page, scenario, 'Rent of', true)
  await shoot('scenario-added')
  await dismissToasts(page)

  await openComponent(page, press, scenario, 'Rent of')
  await setField(await page.$('[data-testid="component-amount"]'), '320')
  await inspect?.('edit a component')
  await shoot('scenario-edit')
  await pressSelector(page, press, '[data-testid="component-save"]')
  await toast(page, 'Component saved')
  await dialogGone(page, '[data-testid="scenario-component-form"]')
  await waitForComponent(page, scenario, 'Rent of €320.00', true)
  await dismissToasts(page)

  await openComponent(page, press, scenario, 'Rent of')
  await pressSelector(page, press, '[data-testid="component-delete"]')
  await toast(page, 'Component deleted')
  await dialogGone(page, '[data-testid="scenario-component-form"]')
  await waitForComponent(page, scenario, 'Rent of', false)
  await undo(page, press)
  await waitForComponent(page, scenario, 'Rent of €320.00', true)
  await dismissToasts(page)

  await pressSelector(page, press, `[data-scenario="${scenario}"] [data-testid="scenario-copy"]`)
  await page.waitForSelector('[data-testid="scenario-name-form"]')
  await delay(400)
  await inspect?.('copy a scenario')
  await pressSelector(page, press, '[data-testid="scenario-name-save"]')
  await toast(page, 'Scenario copied')
  await page.waitForSelector('[data-scenario="floor-salary-copy"]')
  await undo(page, press)
  await page.waitForFunction(() => !document.querySelector('[data-scenario="floor-salary-copy"]'), { timeout: 10_000 })
  await dismissToasts(page)

  await openComponent(page, press, scenario, 'Rent of')
  await pressSelector(page, press, '[data-testid="component-delete"]')
  await toast(page, 'Component deleted')
  await dialogGone(page, '[data-testid="scenario-component-form"]')
  await dismissToasts(page)
}

/** Year, Pay with no scenarios yet, where the scenarios card opens itself: add the starting four, and Undo them. */
export async function startingScenariosFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector('[data-testid="scenario-editor"]')
  if (await page.$('[data-scenario]')) throw new Error('a scenario is on the screen before the flow adds the starting ones')
  await pressSelector(page, press, '[data-testid="add-starting-scenarios"]')
  await page.waitForSelector('[data-testid="starting-scenarios-form"]')
  await delay(400)
  await setField(await page.$('[data-testid="starting-rent"]'), '300')
  await inspect?.('add the starting scenarios')
  await shoot('starting-scenarios')
  await pressSelector(page, press, '[data-testid="starting-scenarios-save"]')
  await toast(page, 'Starting scenarios added')
  await dialogGone(page, '[data-testid="starting-scenarios-form"]')
  await page.waitForSelector('[data-scenario="floor-salary-2027"]')
  await shoot('starting-added')
  await undo(page, press)
  await page.waitForFunction(() => !document.querySelector('[data-scenario]'), { timeout: 10_000 }).catch(() => {
    throw new Error('Undo left starting scenarios on the screen')
  })
  await dismissToasts(page)
}

/** The text of a category's row in the plan editor, once it holds `wanted`. */
async function waitForPlanCategory(page, slug, wanted) {
  await page
    .waitForFunction(
      (category, text) => document.querySelector(`[data-testid="plan-category"][data-category="${category}"]`)?.textContent?.includes(text) ?? false,
      { timeout: 10_000 },
      slug,
      wanted,
    )
    .catch(() => {
      throw new Error(`the plan of ${slug} does not say "${wanted}"`)
    })
}

async function openPlanCategory(page, press, slug) {
  await pressSelector(page, press, `[data-testid="plan-category"][data-category="${slug}"]`)
  await page.waitForSelector('[data-testid="category-plan-form"]')
  await delay(400)
}

/** Year, Plan for 2027: plan a category for every month and one month of its own, raise it, clear it, Undo the clear, then clear it again. */
export async function planFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector('[data-testid="plan-editor"]')
  const slug = await page.evaluate(
    () => [...document.querySelectorAll('[data-testid="plan-category"]:not([disabled])')].find((button) => button.textContent?.includes('No plan row'))?.getAttribute('data-category') ?? null,
  )
  if (slug === null) throw new Error('no category without a plan row to plan')

  await openPlanCategory(page, press, slug)
  await setField(await page.$('[data-testid="plan-every-month"]'), '120')
  await setField(await page.$('[data-testid="plan-month-1"]'), '300')
  await inspect?.('plan a category')
  await shoot('plan-category')
  await pressSelector(page, press, '[data-testid="plan-save"]')
  await toast(page, 'Plan saved')
  await dialogGone(page, '[data-testid="category-plan-form"]')
  await waitForPlanCategory(page, slug, '€120.00 a month, one month of its own')
  await shoot('plan-category-saved')
  await dismissToasts(page)

  await openPlanCategory(page, press, slug)
  await setField(await page.$('[data-testid="plan-every-month"]'), '130')
  await inspect?.('edit a plan')
  await pressSelector(page, press, '[data-testid="plan-save"]')
  await toast(page, 'Plan saved')
  await dialogGone(page, '[data-testid="category-plan-form"]')
  await waitForPlanCategory(page, slug, '€130.00 a month')
  await dismissToasts(page)

  await openPlanCategory(page, press, slug)
  await pressSelector(page, press, '[data-testid="plan-clear"]')
  await toast(page, 'Plan cleared')
  await dialogGone(page, '[data-testid="category-plan-form"]')
  await waitForPlanCategory(page, slug, 'No plan row')
  await undo(page, press)
  await waitForPlanCategory(page, slug, '€130.00 a month, one month of its own')
  await dismissToasts(page)

  await openPlanCategory(page, press, slug)
  await pressSelector(page, press, '[data-testid="plan-clear"]')
  await toast(page, 'Plan cleared')
  await dialogGone(page, '[data-testid="category-plan-form"]')
  await dismissToasts(page)
}

/** Year, Plan for 2027 with no plan rows: plan a purchase, and Undo it. */
export async function planTabFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector('[data-testid="plan-editor"]')
  if (await page.$('[data-testid="plan-purchase"]')) throw new Error('a purchase is planned before the flow adds one')
  await pressSelector(page, press, '[data-testid="plan-add-purchase"]')
  await page.waitForSelector('[data-testid="purchase-plan-form"]')
  await delay(400)
  await setField(await page.$('[data-testid="purchase-name"]'), 'Replacement laptop')
  await setField(await page.$('[data-testid="purchase-date"]'), '2027-03-10')
  await setField(await page.$('[data-testid="purchase-amount"]'), '1600')
  await inspect?.('plan a purchase')
  await shoot('plan-purchase')
  await pressSelector(page, press, '[data-testid="purchase-save"]')
  await toast(page, 'Purchase planned')
  await dialogGone(page, '[data-testid="purchase-plan-form"]')
  await page.waitForSelector('[data-testid="plan-purchase"]')
  await shoot('plan-purchase-added')
  await undo(page, press)
  await page.waitForFunction(() => !document.querySelector('[data-testid="plan-purchase"]'), { timeout: 10_000 }).catch(() => {
    throw new Error('Undo left the planned purchase on the screen')
  })
  await dismissToasts(page)
}

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

/** Picks a category in the category picker, whose options end with the category's name. */
async function chooseCategory(page, press, trigger, label) {
  await trigger.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(150)
  await press(trigger)
  const handle = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null, { timeout: 5_000 }, label)
    .catch(() => {
      throw new Error(`no category "${label}"`)
    })
  await press(handle.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

async function setPart(page, index, amount) {
  const parts = await page.$$('[data-testid="split-part"]')
  const part = parts[index]
  if (part === undefined) throw new Error(`no part ${index + 1} in the split editor`)
  await setField(await part.$('[data-testid="split-part-amount"]'), amount)
  return part
}

async function waitForSplit(page, present) {
  await page.waitForFunction((wanted) => (document.querySelector('[data-testid="edit-split"]') !== null) === wanted, { timeout: 10_000 }, present).catch(() => {
    throw new Error(present ? 'the split row is not listed with its parts' : 'the split row is still listed with its parts')
  })
}

/** Transactions: split the one gadget purchase in two, change the parts, delete the split, and Undo the delete. */
export async function splitFlow(page, { press, shoot, inspect }) {
  await waitForSplit(page, false)
  await openSplitOfRow(page, press)
  await setPart(page, 0, '30.00')
  const second = await setPart(page, 1, '8.90')
  await chooseCategory(page, press, await second.$('[data-testid="split-part-category"]'), 'Office supplies')
  await setField(await second.$('[data-testid="split-part-note"]'), 'Printer paper')
  await inspect?.('split a row')
  await shoot('split-add')
  await pressSelector(page, press, '[data-testid="split-save"]')
  await toast(page, 'Split in 2 parts')
  await dialogGone(page, '[data-testid="split-form"]')
  await waitForSplit(page, true)
  await shoot('split-added')
  await dismissToasts(page)

  await pressSelector(page, press, '[data-testid="edit-split"]')
  await page.waitForSelector('[data-testid="split-form"]')
  await delay(400)
  await setPart(page, 0, '28.90')
  await setPart(page, 1, '5.00')
  await pressSelector(page, press, '[data-testid="split-add-part"]')
  await delay(200)
  const third = (await page.$$('[data-testid="split-part"]'))[2]
  await chooseCategory(page, press, await third.$('[data-testid="split-part-category"]'), 'Owner loan out')
  await inspect?.('edit a split')
  await shoot('split-edit')
  await pressSelector(page, press, '[data-testid="split-save"]')
  await toast(page, 'Split saved')
  await dialogGone(page, '[data-testid="split-form"]')
  await dismissToasts(page)

  await pressSelector(page, press, '[data-testid="edit-split"]')
  await page.waitForSelector('[data-testid="split-form"]')
  await delay(400)
  await pressSelector(page, press, '[data-testid="split-delete"]')
  await toast(page, 'Split deleted')
  await dialogGone(page, '[data-testid="split-form"]')
  await waitForSplit(page, false)
  await undo(page, press)
  await waitForSplit(page, true)
  await shoot('split-undone')
  await dismissToasts(page)
}

/**
 * The Change category action of the first row in view, or of the first part of a split row: in the
 * table's last column, or inside its card on a phone once the card is open.
 */
async function openChangeOfRow(page, press, part = false) {
  const button = part ? '[data-testid="change-category-row"][aria-label^="Change the category of part"]' : '[data-testid="change-category-row"]'
  const card = part ? '[data-testid="transaction-card"].part' : '[data-testid="transaction-card"]'
  const found = await page.waitForSelector(`${button}, ${card}`, { timeout: 10_000 })
  const visible = await found.evaluate((element, wanted) => element.matches(wanted) && element.getBoundingClientRect().width > 0, button)
  if (!visible) {
    await pressSelector(page, press, `${card} .card-summary`)
    await pressSelector(page, press, `${card} [data-testid="change-category-row"]`)
  } else {
    await pressSelector(page, press, button)
  }
}

async function pageSays(page, text, says) {
  await page.waitForFunction((wanted, shown) => document.body.innerText.includes(wanted) === shown, { timeout: 10_000 }, text, says).catch(() => {
    throw new Error(says ? `"${text}" is not on the page` : `"${text}" is still on the page`)
  })
}

/**
 * Transactions: the newest code host plan, which a rule files as a software subscription, filed as
 * office supplies with the rule named first, then undone. A part of a split row opens the split
 * editor instead, since the splits tab holds its category.
 */
export async function changeCategoryFlow(page, { press, shoot, inspect }) {
  await pageSays(page, 'Office supplies', false)
  await openChangeOfRow(page, press)
  await page.waitForSelector('[data-testid="change-category"]')
  await delay(400)
  await chooseCategory(page, press, await page.$('[data-testid="change-category-picker"]'), 'Office supplies')
  await page.waitForSelector('[data-testid="rule-against"]', { timeout: 5_000 }).catch(() => {
    throw new Error('the dialog does not name the rule that files the row elsewhere')
  })
  await inspect?.('change a category')
  await shoot('change-category')
  await pressSelector(page, press, '[data-testid="change-category-save"]')
  await toast(page, 'Filed as Office supplies')
  await dialogGone(page, '[data-testid="change-category"]')
  await pageSays(page, 'Office supplies', true)
  await shoot('change-category-filed')
  await undo(page, press)
  await pageSays(page, 'Office supplies', false)
  await dismissToasts(page)

  await page.evaluate(() => {
    window.location.hash = '#/company/transactions?p=all&q=PAPER'
  })
  await waitForSplit(page, true)
  await openChangeOfRow(page, press, true)
  await page.waitForSelector('[data-testid="split-form"]', { timeout: 5_000 }).catch(() => {
    throw new Error('Change category on a part of a split row did not open the split editor')
  })
  await delay(400)
  await shoot('change-category-part')
  await page.keyboard.press('Escape')
  await dialogGone(page, '[data-testid="split-form"]')
}

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

/**
 * Transactions: the laptop, which holds a 30% share of its own and so heads its two parts, changed
 * to 45% from its heading with the company's and the owner's parts shown, then undone, and cleared
 * through its category's default, which is none, then undone. Each Undo is checked from a part.
 */
export async function ownerShareFlow(page, { press, shoot, inspect }) {
  await openShareOfRow(page, press)
  if ((await shareTyped(page)) !== '30') throw new Error(`the laptop's share reads "${await shareTyped(page)}", not 30`)
  await setField(await page.$('[data-testid="owner-share-input"]'), '45')
  await page
    .waitForFunction(() => document.querySelector('[data-testid="owner-share-split"]')?.innerText.replace(/\s+/g, ' ').includes('You take €854.55') ?? false, { timeout: 5_000 })
    .catch(async () => {
      const said = await page.$eval('[data-testid="owner-share-split"]', (element) => element.innerText.replace(/\s+/g, ' ').trim())
      throw new Error(`45% of the laptop's €1,899.00 reads "${said}", not the company keeps €1,044.45 and you take €854.55`)
    })
  await inspect?.('owner share')
  await shoot('owner-share')
  await pressSelector(page, press, '[data-testid="owner-share-save"]')
  await toast(page, 'Owner share set to 45%')
  await dialogGone(page, '[data-testid="owner-share"]')
  await undo(page, press)
  await dismissToasts(page)
  await shareReads(page, press, '30')

  await openShareOfRow(page, press)
  await pressSelector(page, press, '[data-testid="owner-share-default"]')
  if ((await shareTyped(page)) !== '') throw new Error('the default of Equipment, which has none, did not clear the share')
  await shoot('owner-share-clear')
  await pressSelector(page, press, '[data-testid="owner-share-save"]')
  await toast(page, 'Owner share cleared')
  await dialogGone(page, '[data-testid="owner-share"]')
  await undo(page, press)
  await dismissToasts(page)
  await shareReads(page, press, '30')
}

/**
 * Owner, Taken on 2026 in the workbook kept in this browser: "Monthly net, profit included" beside
 * Monthly net pay splits into pay and profit a month, its figure opens the build-up with each part,
 * the taxes and what is left in the company, and the year's profit opens Year on that year.
 */
export async function ownerNetFlow(page, { press, shoot, inspect }) {
  const tile = '[data-testid="owner-net-with-profit"]'
  await page.waitForSelector(`${tile} [data-testid="build-up-button"]`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the monthly net with the profit included has no figure that opens its build-up')
  })
  const caption = await page.$eval(tile, (element) => element.textContent ?? '')
  if (!/€[\d,]+ pay and €[\d,]+ from profit, a month/.test(caption)) throw new Error(`the tile does not split into pay and profit a month, it says: ${caption.trim()}`)
  const tiles = await page.$eval('[data-testid="owner-taken-tiles"]', (element) => element.textContent ?? '')
  if (!tiles.includes('Monthly net pay')) throw new Error('Monthly net pay is gone from beside the new tile')
  await inspect?.('owner net')
  await shoot('owner-net')

  await pressSelector(page, press, `${tile} [data-testid="build-up-button"]`)
  await page.waitForSelector('[data-testid="figure-detail"]', { visible: true, timeout: 10_000 })
  await delay(400)
  const detail = await page.$eval('[data-testid="figure-detail"]', (element) => element.textContent ?? '')
  for (const line of ['Pay without loans and dividends, 10 months', 'Rent tax the owner pays the tax office', 'Pay after the rent tax', 'Profit before tax, Jan 2026 – Sept 2026', 'Corporate tax at', 'Dividend tax at', 'Profit after both taxes, 9 months', 'Left in the company']) {
    if (!detail.includes(line)) throw new Error(`the build-up lacks "${line}", it says: ${detail.slice(0, 300)}`)
  }
  await inspect?.('owner net build-up')
  await shoot('owner-net-build-up')

  await pressSelector(page, press, '[data-testid="figure-detail"] a[aria-label^="Profit before tax, Jan 2026"]')
  await screenTitled(page, 'Year')
  if (!(await page.evaluate(() => window.location.hash)).includes('year=2026')) throw new Error('the profit of 2026 did not open Year on 2026')
}

/** Owner, Taken in the fake file on Drive, which has no hr_company_registered: the tile reads – and its link opens the setting. */
export async function ownerNetUnregisteredFlow(page, { press, shoot, inspect }) {
  const note = '[data-testid="owner-net-unregistered"]'
  await page.waitForSelector(note, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the tile does not say the profit needs hr_company_registered')
  })
  const value = await page.$eval('[data-testid="owner-net-with-profit"] .text-figure-lg', (element) => element.textContent?.trim() ?? '')
  if (value !== '–') throw new Error(`the tile reads "${value}" without hr_company_registered, not –`)
  await inspect?.('owner net unregistered')
  await shoot('owner-net-unregistered')
  await pressSelector(page, press, `${note} a`)
  await screenTitled(page, 'Settings')
}

/**
 * Settings, Categories: a 40% default on software subscriptions, saved with the fill offer, which
 * fills the bank rows without a share and leaves the design tool advance's 25%, then undone whole.
 */
export async function shareFillFlow(page, { press, shoot, inspect }) {
  const row = await rowNamed(page, '[data-testid="category-row"]', 'software-subscriptions')
  await setField(await fieldIn(row, 'Owner share, in percent'), '40')
  await delay(200)
  await shoot('share-fill-draft')
  await pressSelector(page, press, '[data-testid="save-categories"]')
  await page.waitForSelector('[data-testid="share-fill"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('a new default did not offer to fill the rows without a share')
  })
  await delay(400)
  const offer = await page.$eval('[data-testid="share-fill"]', (element) => element.innerText.replace(/\s+/g, ' ').trim())
  const rows = /Software subscriptions 40% (\d+) rows/.exec(offer)?.[1]
  if (rows === undefined) throw new Error(`the fill offer says "${offer}"`)
  await inspect?.('share fill')
  await shoot('share-fill')
  await pressSelector(page, press, '[data-testid="share-fill-save"]')
  await toast(page, 'Categories saved')
  const said = await page.$eval(`${TOAST} [data-slot="description"]`, (element) => element.textContent?.trim() ?? '')
  if (said !== `${rows} rows without a share took the new default.`) throw new Error(`the save says "${said}" after filling ${rows} rows`)
  await dialogGone(page, '[data-testid="share-fill"]')
  await undo(page, press)
  await page
    .waitForFunction(() => [...document.querySelectorAll('[data-testid="category-row"]')].find((element) => element.querySelector('input')?.value === 'software-subscriptions')?.querySelector('[data-testid="category-owner-share"]')?.value === '', { timeout: 10_000 })
    .catch(() => {
      throw new Error('Undo did not take the default off software subscriptions')
    })
  await dismissToasts(page)
}

async function dropFile(page, path) {
  const input = await page.waitForSelector('[data-testid="import-file"] input[type="file"]', { timeout: 10_000 }).catch(() => {
    throw new Error('Import offers no file input')
  })
  await input.uploadFile(path)
}

async function dryRunSays(page, text) {
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="dry-run-summary"]')?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, text)
    .catch(async () => {
      const said = await page.evaluate(() => document.querySelector('[data-testid="dry-run-summary"]')?.textContent?.trim())
      throw new Error(`the dry run does not say "${text}", it says: ${said ?? 'nothing'}`)
    })
  await delay(300)
}

/** After a confirmed import, the dry run says how the new rows stand on Review, and says nothing once Undo took them out. */
async function waitingOnReview(page, shown) {
  await page
    .waitForFunction(
      (wanted) => {
        const notice = document.querySelector('[data-testid="import-waiting"]')
        return wanted ? (notice?.textContent?.includes('on Review') ?? false) : notice === null
      },
      { timeout: 10_000 },
      shown,
    )
    .catch(() => {
      throw new Error(shown ? 'the confirmed import does not say how many new rows wait on Review' : 'the notice about the new rows stayed after Undo')
    })
}

/** Import: drop the sample camt.053 statement, read the dry run, confirm, find every row on the ledger, and Undo. */
export function importCamtFlow(path) {
  return async (page, { press, shoot, inspect }) => {
    await dropFile(page, path)
    await dryRunSays(page, 'Confirming adds 4 rows')
    if ((await page.$$('[data-testid="dry-run-row"]')).length !== 4) throw new Error('the dry run does not list the four entries')
    await inspect?.('the camt dry run')
    await shoot('import-camt-dry-run')
    await pressSelector(page, press, '[data-testid="import-confirm"]')
    await toast(page, 'Imported 4 rows')
    await dryRunSays(page, 'Confirming would write nothing. 4 rows are on the ledger already')
    await waitingOnReview(page, true)
    await shoot('import-camt-confirmed')
    await undo(page, press)
    await dryRunSays(page, 'Confirming adds 4 rows')
    await waitingOnReview(page, false)
    await shoot('import-camt-undone')
    await dismissToasts(page)
  }
}

/** Import: drop the sample bank export, make and save a profile from the guess, confirm the dry run, and Undo. */
export function importTableFlow(path) {
  return async (page, { press, shoot, inspect }) => {
    await dropFile(page, path)
    const name = await page.waitForSelector('[data-testid="profile-editor"] input[data-testid="profile-name"], [data-testid="profile-editor"] [data-testid="profile-name"] input', { timeout: 10_000 }).catch(() => {
      throw new Error('no profile editor for an export no saved profile fits')
    })
    await setField(name, 'example-bank')
    await dryRunSays(page, 'Confirming adds 4 rows')
    await inspect?.('the new profile')
    await shoot('import-profile')
    await pressSelector(page, press, '[data-testid="profile-save"]')
    await toast(page, 'Profile saved')
    await dismissToasts(page)
    await page.waitForFunction(() => !document.querySelector('[data-testid="profile-editor"]'), { timeout: 10_000 }).catch(() => {
      throw new Error('the saved profile is not the one picked')
    })
    await dryRunSays(page, 'Confirming adds 4 rows')
    await shoot('import-table-dry-run')
    await pressSelector(page, press, '[data-testid="import-confirm"]')
    await toast(page, 'Imported 4 rows')
    await dryRunSays(page, 'Confirming would write nothing')
    await waitingOnReview(page, true)
    await undo(page, press)
    await dryRunSays(page, 'Confirming adds 4 rows')
    await shoot('import-table-undone')
    await dismissToasts(page)

    await pressSelector(page, press, '[data-testid="profile-delete"]')
    await toast(page, 'Profile deleted')
    await page.waitForSelector('[data-testid="profile-editor"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the deleted profile is still the one picked')
    })
    if (await page.$('[data-testid="profile-choice"]')) throw new Error('the saved profile menu stayed after its only profile was deleted')
    await dismissToasts(page)
  }
}

const SYNC_BUTTON = '[data-testid="sync-button"]'
const SYNC_STEPS = '[data-testid="sync-steps"]'
const SYNC_CARD = '[data-testid="sync-card"]'

/** Waits for a toast whose title matches the pattern, which must be the only one, since earlier ones were dismissed. Returns its text. */
async function toastMatching(page, pattern) {
  const shown = await page
    .waitForFunction(
      (selector, source) => [...document.querySelectorAll(selector)].find((element) => new RegExp(source).test(element.querySelector('[data-slot="title"]')?.textContent?.trim() ?? ''))?.textContent ?? null,
      { timeout: 10_000 },
      TOAST,
      pattern.source,
    )
    .catch(async () => {
      const said = await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((element) => element.textContent?.trim()).join(' | '), TOAST)
      throw new Error(`no toast matching ${pattern} within 10 s, the toasts say: ${said || 'nothing'}`)
    })
  await delay(600)
  return shown.jsonValue()
}

/** Fails when a toast shows within a moment, since a sync reports in its control and its steps only. */
async function noToast(page, failure) {
  await delay(1_000)
  const said = await page.evaluate((selector) => [...document.querySelectorAll(selector)].map((element) => element.textContent?.trim()).join(' | '), TOAST)
  if (said !== '') throw new Error(`${failure}: ${said}`)
}

/** The sync control on screen, the top bar's or the sidebar's. */
async function syncButton(page) {
  return page
    .waitForFunction((selector) => [...document.querySelectorAll(selector)].find((element) => element.offsetParent !== null) ?? null, { timeout: 10_000 }, SYNC_BUTTON)
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error('no Sync button on screen')
    })
}

/** Waits until the sync control shows the state, and returns what its button says and what a screen reader hears. */
async function controlShows(page, kind) {
  await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[data-testid="sync-status"]')].some((element) => element.offsetParent !== null && element.dataset.control === wanted), { timeout: 12_000, polling: 100 }, kind)
    .catch(async () => {
      const shown = await page.evaluate(() => [...document.querySelectorAll('[data-testid="sync-status"]')].map((element) => element.dataset.control).join(', '))
      throw new Error(`the sync control does not show ${kind}, it shows ${shown || 'nothing'}`)
    })
  return (await syncButton(page)).evaluate((element) => ({ label: element.textContent?.trim() ?? '', name: element.getAttribute('aria-label') ?? '', disabled: element.disabled }))
}

/** Presses the sync control, the top bar's or the sidebar's, and waits until the sync and its steps are done. */
async function syncAndSettle(page, press) {
  await press(await syncButton(page))
  await page
    .waitForFunction((selector) => [...document.querySelectorAll(selector)].some((element) => element.offsetParent !== null && !element.disabled), { timeout: 12_000, polling: 100 }, SYNC_BUTTON)
    .catch(() => {
      throw new Error('the sync did not finish within 12 s')
    })
}

/** Waits until a step's line in the steps under `scope` is in the state and says the text. Returns the line's text. */
async function stepSays(page, scope, step, state, pattern) {
  const selector = `${scope} ${SYNC_STEPS} [data-step="${step}"]`
  return page
    .waitForFunction(
      (css, wanted, source) => {
        const line = [...document.querySelectorAll(css)].find((element) => element.offsetParent !== null)
        return line !== undefined && line.dataset.state === wanted && new RegExp(source).test(line.textContent ?? '') ? line.textContent : null
      },
      { timeout: 10_000 },
      selector,
      state,
      pattern.source,
    )
    .then((handle) => handle.jsonValue())
    .catch(async () => {
      const said = await page.evaluate((css) => [...document.querySelectorAll(css)].map((line) => `${line.dataset.state}: ${line.textContent?.trim()}`).join(' | '), selector)
      throw new Error(`the ${step} step is not ${state} matching ${pattern}, it says: ${said || 'nothing'}`)
    })
}

async function openDeviceSettings(page) {
  await page.evaluate(() => {
    window.location.hash = '#/settings?tab=device'
  })
  await page.waitForSelector(SYNC_CARD, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Settings, This device has no Sync card')
  })
}

const FILED = /Filed statement \d+, 4 rows/

/**
 * Sync files the sample statement from the fake statements folder and says so in the statements
 * step, not in a toast. Undo in the step's line on Settings, This device takes it out, the card's
 * Sync again files it again, and Import lists it. A last sync finds nothing new and says so there.
 */
export async function statementSyncFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await noToast(page, 'a sync that filed a statement showed a toast')
  await openDeviceSettings(page)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
  await page.$eval(SYNC_CARD, (element) => element.scrollIntoView({ block: 'start' }))
  await delay(300)
  await inspect?.('the statements filed')
  await shoot('statements-filed')
  await pressSelector(page, press, `${SYNC_CARD} [data-step="statements"] [data-testid="sync-step-undo"]`)
  await toast(page, 'Undone')
  await page.waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, `${SYNC_CARD} [data-testid="sync-step-undo"]`).catch(() => {
    throw new Error('the statements step still offers Undo after it was undone')
  })
  await dismissToasts(page)

  await pressSelector(page, press, `${SYNC_CARD} [data-testid="sync-again"]`)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
  await noToast(page, 'a sync from the Sync card showed a toast')
  await page.evaluate(() => {
    window.location.hash = '#/company/transactions?tab=import'
  })
  await page.waitForSelector('[data-testid="statement-folder-filed"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Import does not list the statement the sync filed')
  })
  await delay(300)
  await shoot('statements-folder-filed')

  await syncAndSettle(page, press)
  await noToast(page, 'a sync that found nothing new showed a toast')
  if (await page.$('[data-testid="statement-folder"]')) throw new Error('the folder card stayed after a sync that found nothing new')
  await openDeviceSettings(page)
  await stepSays(page, SYNC_CARD, 'statements', 'done', /Nothing new/)
}

/**
 * With a statement of an account the accounts tab lacks in the folder, Sync files the sample and
 * holds the other: the control says 1 problem, and its steps, in a popover from 640 px and a bottom
 * sheet on a phone, link to Import, which offers to add the account. Overview lists the held
 * statement too. Named and confirmed on Import, the account is added and the statement filed.
 */
export async function heldStatementFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await noToast(page, 'a sync that held a statement showed a toast')
  await inspect?.('the sync control with a problem')
  await shoot('sync-problem')
  await press(await syncButton(page))
  const said = await stepSays(page, '', 'statements', 'waits', /1 statement was not filed/)
  if (!FILED.test(said)) throw new Error(`the statements step does not say what it filed, it says: ${said}`)
  await delay(400)
  await inspect?.('the steps of the last sync')
  await shoot('sync-steps')
  await pressSelector(page, press, `${SYNC_STEPS} [data-step="statements"] a`)
  await page
    .waitForFunction(() => document.querySelector('[data-testid="statement-folder"] [data-testid="dry-run-new-account"]')?.textContent?.includes('is new') ?? false, { timeout: 10_000 })
    .catch(() => {
      throw new Error('Import does not offer the account the held statement names')
    })
  await page.waitForFunction((selector) => !document.querySelector(selector), { timeout: 5_000 }, SYNC_STEPS).catch(() => {
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
  const name = await page.waitForSelector('[data-testid="statement-folder"] input[data-testid="dry-run-account-name"]', { visible: true, timeout: 10_000 })
  await setField(name, 'second')
  await pressSelector(page, press, '[data-testid="statement-folder-confirm"]')
  await toastMatching(page, /^Filed statement/)
  await page.waitForFunction(() => !document.querySelector('[data-testid="dry-run-new-account"]'), { timeout: 10_000 }).catch(() => {
    throw new Error('the held statement still offers its account after it was filed')
  })
  await page.evaluate(() => {
    window.location.hash = '#/settings?tab=accounts'
  })
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === 'second'), { timeout: 10_000 }).catch(() => {
    throw new Error('Settings, Accounts does not list the account the import added')
  })
}

/** Makes the next load's token come without Drive read, as when the person unticked it on Google's consent screen. */
async function withoutDriveRead(page) {
  await page.evaluate(() => localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'gmail.compose'])))
  await page.reload({ waitUntil: 'networkidle0' })
}

/**
 * A token Google gave without Drive read: Overview offers nothing, the sync control shows Allow
 * access as the app opens, and that tap asks Google and files the sample, with no toast.
 */
export async function statementAccessFlow(page, { press, shoot, inspect }) {
  await withoutDriveRead(page)
  const control = await controlShows(page, 'allow-access')
  if (control.label !== 'Allow access') throw new Error(`the sync control says "${control.label}", not Allow access`)
  if (!control.name.includes('Statements needs your Drive read access')) throw new Error(`a screen reader hears "${control.name}"`)
  if (await page.$('[data-job="check-statements"]')) throw new Error('Overview still offers to check for new statements')
  await inspect?.('the sync control asking for access')
  await shoot('sync-allow-access')
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await noToast(page, 'the sync after Allow access showed a toast')
  await openDeviceSettings(page)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
}

/** With a slow statements folder, the control names the running step and its place, and a screen reader hears it, until the sync is done. */
export async function syncRunningFlow(page, { press, shoot, inspect }) {
  await press(await syncButton(page))
  const running = await controlShows(page, 'running')
  await page
    .waitForFunction(() => document.querySelector('[data-testid="sync-button"]')?.getAttribute('aria-label')?.startsWith('Syncing, Statements, step 2 of 2') ?? false, { timeout: 10_000 })
    .catch(async () => {
      throw new Error(`the running control does not name the statements step, a screen reader hears "${running.name}"`)
    })
  const shown = await controlShows(page, 'running')
  if (!shown.disabled) throw new Error('the sync control takes a tap while the sync runs')
  if (!/^Statements 2\/2$|^Syncing$/.test(shown.label)) throw new Error(`the running control says "${shown.label}"`)
  await inspect?.('the sync control while the statements step runs')
  await shoot('sync-running')
  const ready = await controlShows(page, 'ready')
  if (!ready.name.startsWith('Synced ')) throw new Error(`the ready control is heard as "${ready.name}"`)
  await inspect?.('the sync control once the sync is done')
  await shoot('sync-ready')
}

const MAIL_CARD = '[data-testid="mail-settings"]'
const MAIL_PLAN = '[data-testid="mail-plan"]'
const MAIL_FILED = /Filed 9, already there 4, 1 correction, 1 not compared, 2 unmatched\./

/** Waits until the mail card lists the sources in these states, and returns what each source's line says. */
async function mailListShows(page, wanted) {
  return page
    .waitForFunction(
      (selector, expected) => {
        const sources = [...document.querySelectorAll(`${selector} [data-source]`)].map((source) => `${source.dataset.source}:${source.dataset.state}`)
        return JSON.stringify(sources) === JSON.stringify(expected) ? [...document.querySelectorAll(`${selector} [data-testid="mail-source-line"]`)].map((line) => line.textContent?.trim()) : null
      },
      { timeout: 10_000 },
      MAIL_PLAN,
      wanted,
    )
    .then((handle) => handle.jsonValue())
    .catch(async () => {
      const shown = await page.evaluate((selector) => [...document.querySelectorAll(`${selector} [data-source]`)].map((source) => `${source.dataset.source}:${source.dataset.state}`).join(', '), MAIL_PLAN)
      throw new Error(`the mail card does not list ${wanted.join(', ')}, it lists ${shown || 'nothing'}`)
    })
}

/** Presses the link of the mail step's line, the one in the steps on screen, and waits for the mail card to open on its list. */
async function openMailList(page, press, scope) {
  await pressSelector(page, press, `${scope} ${SYNC_STEPS} [data-step="mail"] a`)
  await page.waitForFunction((selector) => document.querySelector(selector)?.getAttribute('data-collapsed') === 'false', { timeout: 10_000 }, MAIL_CARD).catch(() => {
    throw new Error('the link of the mail step did not open the mail card')
  })
}

/** Scrolls the element under the selector to the top of the window, below the bars that stick there. */
async function scrollToTop(page, selector) {
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'start' }))
  await delay(300)
}

const ALL_SOURCES = ['statements:planned', 'hr-doo.payroll:planned', 'hr-doo.vat-returns:planned', 'hr-doo.invoices:planned']

/**
 * With no sender named, the mail step is off in the steps of a sync. On Settings, General the mail
 * card takes a sender, asks for the subject a sender needs, and saves both, and the next sync's mail
 * step files the bank's new PDF and lists the rest. The page holds every scope, as a first open
 * does, so the save asks Google nothing.
 */
export async function mailOffFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => {
    for (const key of ['kuna.google-granted', 'kuna.google-needed']) localStorage.removeItem(key)
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await syncAndSettle(page, press)
  await openDeviceSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'off', /Off in Settings/)
  await page.evaluate(() => {
    window.location.hash = '#/settings#mail'
  })
  const senders = await page.waitForSelector(`${MAIL_CARD} [data-testid="statements-mail-from"] input`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Settings, General has no mail card open at #mail')
  })
  await scrollToTop(page, MAIL_CARD)
  await inspect?.('the mail card with no sender')
  await shoot('mail-card-off')
  await setField(senders, 'statements@bank.example.com')
  await page
    .waitForFunction((selector) => document.querySelector(`${selector} [data-testid="statements-mail-subject"]`)?.textContent?.includes('name the words before the statement number') ?? false, { timeout: 5_000 }, MAIL_CARD)
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
  const lines = await mailListShows(page, ['statements:planned'])
  if (!/^Filed 1, already there 3, 1 unmatched\.$/.test(lines[0] ?? '')) throw new Error(`the bank's mail reads "${lines[0]}"`)
  await scrollToTop(page, MAIL_CARD)
  await inspect?.('the mail card once saved and synced')
  await shoot('mail-card-saved')
}

/**
 * With the bank's and the accountant's mail named, the mail step files the bank's PDF and statement
 * and the accountant's new mail into the fake Drive, and the statements step of the same sync files
 * that statement on the ledger. Its link opens the list on the mail card, which marks what was filed
 * beside what was there already or needs a look, with the accountant's mail fields on the facts card.
 * A second sync files nothing new.
 */
export async function mailFiledFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await noToast(page, 'a sync that filed mail showed a toast')
  await openDeviceSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', MAIL_FILED)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
  await scrollToTop(page, SYNC_CARD)
  await inspect?.('the mail step that filed a statement, and the statements step that read it')
  await shoot('mail-step')
  await openMailList(page, press, SYNC_CARD)
  const lines = await mailListShows(page, ALL_SOURCES)
  const expected = ['Filed 2, already there 2, 1 unmatched.', 'Filed 5, already there 1, 1 unmatched.', 'Filed 1, 1 correction, 1 not compared.', 'Filed 1, already there 1.']
  if (JSON.stringify(lines) !== JSON.stringify(expected)) throw new Error(`the sources read ${JSON.stringify(lines)}`)
  for (const kind of ['filed', 'already', 'correction', 'unchecked', 'unmatched']) {
    if ((await page.$(`${MAIL_PLAN} [data-entry="${kind}"]`)) === null) throw new Error(`the list has no ${kind} entry`)
  }
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list of what the mail step filed and found')
  await shoot('mail-list')

  await syncAndSettle(page, press)
  const again = await mailListShows(page, ALL_SOURCES)
  if (again[0] !== 'Nothing new, already there 3.') throw new Error(`a second sync's bank mail reads "${again[0]}"`)
  await openDeviceSettings(page)
  const line = await stepSays(page, SYNC_CARD, 'mail', 'done', /Nothing new, already there 10, 1 unmatched\./)
  if (line.includes('Filed')) throw new Error(`a second sync's mail step says "${line}"`)
  await stepSays(page, SYNC_CARD, 'statements', 'done', /Nothing new/)

  await page.evaluate(() => {
    window.location.hash = '#/settings#accountant-mail'
  })
  const sender = await page.waitForSelector('[data-testid="accountant-mail-from"] input', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the facts card has no accountant mail fields at #accountant-mail')
  })
  if ((await sender.evaluate((element) => element.value)) !== 'office@accountant.example.com') throw new Error('the accountant mail field does not show the sender the books name')
  await scrollToTop(page, '[data-testid="accountant-mail"]')
  await inspect?.("the accountant's mail fields")
  await shoot('accountant-mail-fields')
}

/**
 * The upload of every PDF fails beside the other files: the mail step fails with each PDF named by
 * its source, 1 problem in the control, the statement still on the ledger from the same sync, and the
 * list marks the bank's PDF not filed with why.
 */
export async function mailUploadFailedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(
    page,
    '',
    'mail',
    'failed',
    /Filed 5, already there 4, 1 correction, 1 not compared, 2 unmatched\. Bank statements: \d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf was not filed\. Payroll: 2026-09-payment-order-salary\.pdf and 2026-09-payment-order-rent\.pdf were not filed\. Accountant's invoices: 2026-10-03-accounting\.pdf was not filed\./,
  )
  await stepSays(page, '', 'statements', 'done', FILED)
  await delay(400)
  await inspect?.('the steps with an upload that failed')
  await shoot('mail-upload-failed-steps')
  await openMailList(page, press, '')
  const lines = await mailListShows(page, ALL_SOURCES)
  if (!/^Filed 1, already there 2, 1 unmatched\. \d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf was not filed\.$/.test(lines[0] ?? '')) throw new Error(`the bank's mail reads "${lines[0]}"`)
  const entry = await page.$(`${MAIL_PLAN} [data-source="statements"] [data-entry="not-filed"]`)
  if (entry === null) throw new Error('the list marks no entry not filed')
  if (!(await entry.evaluate((element) => element.textContent ?? '')).includes('Drive did not take the upload. Sync again later.')) throw new Error('the entry not filed does not say why')
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list with an upload that failed')
  await shoot('mail-upload-failed-list')
}

/** Mail that is all filed already says nothing new, and opens no problem. */
export async function mailNothingNewFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await openDeviceSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', /Nothing new, already there 5\./)
  await scrollToTop(page, SYNC_CARD)
  await inspect?.('the mail step with nothing new')
  await shoot('mail-nothing-new')
}

/** A source whose search fails fails the mail step with the others' counts in its line: 1 problem in the control, and the steps open on it with the list a link away. */
export async function mailFailedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(page, '', 'mail', 'failed', /Filed 8, already there 4, 2 unmatched\. VAT returns: Gmail did not answer the search/)
  await delay(400)
  await inspect?.('the steps with a mail source that failed')
  await shoot('mail-failed-steps')
  await openMailList(page, press, '')
  const lines = await mailListShows(page, ['statements:planned', 'hr-doo.payroll:planned', 'hr-doo.vat-returns:failed', 'hr-doo.invoices:planned'])
  if (lines[2] !== 'Gmail did not answer the search. Sync again later.') throw new Error(`the failed source reads "${lines[2]}"`)
  await page.$eval(`${MAIL_PLAN} [data-source="hr-doo.vat-returns"]`, (element) => element.scrollIntoView({ block: 'center' }))
  await delay(300)
  await shoot('mail-failed-list')
}

/** A token without Gmail read shows Allow access for the mail step as the app opens, and that tap runs it. */
export async function mailAccessFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'drive.readonly', 'gmail.compose'])))
  await page.reload({ waitUntil: 'networkidle0' })
  const control = await controlShows(page, 'allow-access')
  if (control.label !== 'Allow access') throw new Error(`the sync control says "${control.label}", not Allow access`)
  if (!control.name.includes('Mail needs your Gmail read access')) throw new Error(`a screen reader hears "${control.name}"`)
  await inspect?.('the sync control asking for Gmail read access')
  await shoot('mail-allow-access')
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await openDeviceSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', MAIL_FILED)
}

/**
 * A token without Gmail read and the mail step off: saving a sender and subject on the Mail card
 * asks Google in that same tap, so the sync control never shows Allow access, and the sync that
 * follows the save files the bank's mail.
 */
export async function mailSaveAsksFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => {
    for (const key of ['kuna.google-needed', 'kuna.google-silent-refused']) localStorage.removeItem(key)
    localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'drive.readonly', 'gmail.compose']))
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await controlShows(page, 'ready')
  await page.evaluate(() => {
    window.location.hash = '#/settings#mail'
  })
  const senders = await page.waitForSelector(`${MAIL_CARD} [data-testid="statements-mail-from"] input`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Settings, General has no mail card open at #mail')
  })
  await setField(senders, 'statements@bank.example.com')
  await setField(await page.$(`${MAIL_CARD} [data-testid="statements-mail-subject"] input`), 'Izvadak')
  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  const lines = await mailListShows(page, ['statements:planned'])
  if (!/^Filed 1, already there 3, 1 unmatched\.$/.test(lines[0] ?? '')) throw new Error(`the sync after the save reads the bank's mail as "${lines[0]}"`)
  const control = await controlShows(page, 'ready')
  if (control.label === 'Allow access') throw new Error('the sync control asks for access after a save that asked for it')
  const granted = await page.evaluate(() => JSON.parse(localStorage.getItem('kuna.google-granted') ?? '[]'))
  if (!granted.includes('gmail.readonly')) throw new Error(`the save asked Google for ${granted.join(', ')}, without Gmail read`)
  await scrollToTop(page, MAIL_CARD)
  await inspect?.('the mail card saved with Gmail read asked in the same tap')
  await shoot('mail-save-asks')
  await page.evaluate(() => localStorage.removeItem('kuna.google-granted'))
}

/** Waits until the switch under the test id is on or off, and returns it. */
async function switchIs(page, testId, checked) {
  const selector = `:is([data-testid="${testId}"][role="switch"], [data-testid="${testId}"] [role="switch"])`
  await page
    .waitForFunction((css, wanted) => document.querySelector(css)?.getAttribute('aria-checked') === wanted, { timeout: 10_000 }, selector, String(checked))
    .catch(() => {
      throw new Error(`the ${testId} switch is not ${checked ? 'on' : 'off'}`)
    })
  return page.$(selector)
}

/** Opens the facts card on the accountant's mail and scrolls to it. */
async function openAccountantMail(page) {
  await page.evaluate(() => {
    window.location.hash = '#/settings#accountant-mail'
  })
  await page.waitForSelector('[data-testid="accountant-mail-from"] input', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the facts card has no accountant mail fields at #accountant-mail')
  })
  await scrollToTop(page, '[data-testid="accountant-mail"]')
}

/**
 * With every kind of the accountant's mail switched off, as new books have them, the mail step reads
 * the bank's mail alone, and the facts card shows the three switches off above their subjects and
 * folders.
 */
export async function mailSwitchesOffFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await openDeviceSettings(page)
  await stepSays(page, SYNC_CARD, 'mail', 'done', /Filed 2, already there 2, 1 unmatched\./)
  await page.evaluate(() => {
    window.location.hash = '#/settings#mail'
  })
  await mailListShows(page, ['statements:planned'])
  await openAccountantMail(page)
  for (const kind of ['payroll', 'vat', 'invoices']) await switchIs(page, `${kind}-mail-sync`, false)
  if (await page.$('[data-testid="mail-kind-missing"]')) throw new Error('a kind switched off says what it lacks')
  await inspect?.("the accountant's mail switched off")
  await shoot('mail-switches-off')
}

/**
 * The payroll switched on without the accountant's address fails the mail step with what it lacks:
 * 1 problem in the control, the step's line naming the sender, the list marking the payroll failed,
 * and the facts card saying it under the switch.
 */
export async function mailNoSenderFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(page, '', 'mail', 'failed', /Filed 2, already there 2, 1 unmatched\. Payroll: It is on, but has no sender on Settings, General\./)
  await delay(400)
  await inspect?.('the steps with the payroll switched on without a sender')
  await shoot('mail-no-sender-steps')
  await openMailList(page, press, '')
  const lines = await mailListShows(page, ['statements:planned', 'hr-doo.payroll:failed'])
  if (lines[1] !== 'It is on, but has no sender on Settings, General.') throw new Error(`the payroll reads "${lines[1]}"`)
  await openAccountantMail(page)
  await switchIs(page, 'payroll-mail-sync', true)
  const missing = await page.$eval('[data-testid="payroll-mail-kind"] [data-testid="mail-kind-missing"]', (element) => element.textContent?.trim()).catch(() => null)
  if (missing !== 'It is on, but has no sender.') throw new Error(`the payroll switch says "${missing}" under it`)
  await inspect?.("the payroll switched on without the accountant's address")
  await shoot('mail-no-sender-card')
}

/** Gmail still asking to slow down after the retries fails the mail step with one plain sentence, and none of Google's answer. The mail card says the same sentence in place of its list. */
export async function mailRateLimitedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  const line = await stepSays(page, '', 'mail', 'failed', /Mail: Gmail asked us to slow down\. Sync again in a minute\.$/)
  if (/[{}]|rateLimit|403|429/.test(line)) throw new Error(`the mail step shows Google's answer: "${line}"`)
  await delay(400)
  await inspect?.('the steps after Gmail asked to slow down')
  await shoot('mail-rate-limited')
  await page.keyboard.press('Escape')
  await delay(300)
  await page.evaluate(() => {
    window.location.hash = '#/settings#mail'
  })
  const said = await page
    .waitForSelector(`${MAIL_PLAN} [data-testid="mail-stopped"]`, { visible: true, timeout: 10_000 })
    .then((element) => element.evaluate((paragraph) => paragraph.textContent?.trim() ?? ''))
    .catch(() => {
      throw new Error('the mail card does not say why the last sync stopped')
    })
  if (said !== 'Gmail asked us to slow down. Sync again in a minute.') throw new Error(`the mail card says "${said}"`)
  await page.$eval(`${MAIL_PLAN} [data-testid="mail-stopped"]`, (paragraph) => paragraph.scrollIntoView({ block: 'center' }))
  await delay(300)
  await inspect?.('the mail card after Gmail asked to slow down')
  await shoot('mail-rate-limited-card')
}

/** With every mail already in its folder, filed by another app, each source searches from a week before the newest file there and not from the mail-since day. */
export async function mailWindowFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await page.evaluate(() => {
    window.location.hash = '#/settings#mail'
  })
  await mailListShows(page, ALL_SOURCES)
  const windows = await page.$$eval(`${MAIL_PLAN} [data-testid="mail-source-window"]`, (lines) => lines.map((line) => line.textContent?.trim() ?? ''))
  if (windows.length !== 4 || !windows.every((line) => /^Searched from \d{1,2} \w{3,4} 2026, a week before the newest file in its folder$/.test(line))) throw new Error(`the sources searched ${JSON.stringify(windows)}`)
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list searched from a week before the newest file in each folder')
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
    .waitForFunction((text) => [...document.querySelectorAll('[data-testid="sync-button"]')].some((button) => button.offsetParent !== null && (button.getAttribute('aria-label') ?? '').includes(text)), { timeout: 10_000 }, said)
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
  await noToast(page, "a closed Google window showed a toast")
  await inspect?.("the sync control after Google's window closed")
  await shoot('sync-access-closed')
  await page.evaluate(() => localStorage.removeItem('kuna.google-silent-refused'))
}

/** Review: open the gadget purchase in the queue, then split it, edit and delete the split and Undo, as on Transactions. */
export async function reviewSplitFlow(page, context) {
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
  await splitFlow(page, { ...context, shoot: (name) => context.shoot(`review-${name}`) })
}

/** Opens a collapsed card by its test id, scrolled to the middle first. */
async function openCard(page, press, testId) {
  const toggle = await page.waitForSelector(`[data-testid="${testId}"] [data-testid="card-toggle"]`, { timeout: 10_000 }).catch(() => {
    throw new Error(`no card ${testId}`)
  })
  if ((await toggle.evaluate((element) => element.getAttribute('aria-expanded'))) === 'true') return
  await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(toggle)
  await delay(300)
}

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
 * Review, Rules: dismiss a group no rule settles, find it under the dismissed suggestions, restore
 * it, and Undo the restore.
 */
export async function dismissFlow(page, { press, shoot, inspect }) {
  await openCard(page, press, 'rule-coverage')
  await coverageGroupShown(page, 'Laptop Store', true)
  const group = await page.evaluateHandle(() => [...document.querySelectorAll('[data-testid="coverage-gap"]')].find((row) => row.textContent?.includes('Laptop Store')))
  const dismiss = await group.asElement().$('[data-testid="coverage-dismiss"]')
  await dismiss.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(dismiss)
  await delay(400)
  await toast(page, 'Dismissed Laptop Store')
  await coverageGroupShown(page, 'Laptop Store', false)
  await dismissToasts(page)
  await openCard(page, press, 'dismissed-suggestions')
  await page.waitForFunction(() => document.querySelector('[data-testid="dismissed-suggestion"]')?.textContent?.includes('Laptop Store') ?? false, { timeout: 10_000 }).catch(() => {
    throw new Error('the dismissed group is not under the dismissed suggestions')
  })
  await inspect?.('dismissed suggestions')
  await shoot('dismissed-suggestions')
  await pressSelector(page, press, '[data-testid="restore-suggestion"]')
  await toast(page, 'Suggestion restored')
  await coverageGroupShown(page, 'Laptop Store', true)
  await undo(page, press)
  await coverageGroupShown(page, 'Laptop Store', false)
  await shoot('dismiss-undone')
  await dismissToasts(page)
}

const STATEMENTS_FOLDER = '[data-testid="statements-folder"]'

/** The Save settings button once it is enabled or disabled, as `enabled` asks. */
async function saveSettingsButton(page, enabled) {
  return page
    .waitForFunction(
      (wanted) => [...document.querySelectorAll('button[type="submit"]')].find((button) => button.textContent?.trim() === 'Save settings' && button.disabled === !wanted) ?? null,
      { timeout: 10_000 },
      enabled,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`Save settings did not become ${enabled ? 'enabled' : 'disabled'}`)
    })
}

/**
 * Settings, General shows the statements folder the books name, Save waits for a change, and a new
 * path is written to the same row. Settings keep no Undo, so the flow leaves the row in the workbook.
 */
export async function statementsFolderFlow(page, { press, shoot, inspect }) {
  const field = await page.waitForSelector(`${STATEMENTS_FOLDER} input`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Settings, General has no statements folder field')
  })
  await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  const shown = await field.evaluate((element) => element.value)
  if (shown !== 'finance/statements') throw new Error(`the field shows "${shown}", not the path the books name`)
  await saveSettingsButton(page, false)
  await inspect?.('the statements folder the books name')
  await shoot('statements-folder-named')

  await setField(field, 'finance/bank statements/')
  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  await saveSettingsButton(page, false)
  await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await inspect?.('the statements folder saved')
  await shoot('statements-folder-saved')
  await dismissToasts(page)
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
export async function clientIbansFlow(page, { press, shoot, inspect }) {
  const position = await (await rowNamed(page, FACT_ROW, 'lumen')).evaluate((row) => [...row.parentElement.children].indexOf(row) + 1)
  const lumen = `${FACT_ROW}:nth-child(${position})`
  const before = await tagsIn(page, lumen)
  if (before.length !== 1) throw new Error(`the fake client lumen shows ${before.length} IBANs, not one`)
  const input = async () => fieldIn(await rowNamed(page, FACT_ROW, 'lumen'), 'IBANs')

  await typeIban(page, press, await input(), 'GB82 WEST 1234 5698 7654 32')
  await waitForTags(page, lumen, [...before, NEW_IBAN], 'a typed IBAN')
  await inspect?.('a client with a second IBAN')
  await shoot('client-ibans-added')
  await pressSelector(page, press, '[data-testid="save-rows"]:not([disabled])')
  await toast(page, 'Clients saved')
  await waitForTags(page, lumen, [...before, NEW_IBAN], 'after the save')
  await undo(page, press)
  await waitForTags(page, lumen, before, 'after Undo')
  await dismissToasts(page)

  await typeIban(page, press, await input(), NEW_IBAN)
  await waitForTags(page, lumen, [...before, NEW_IBAN], 'a typed IBAN again')
  await removeLastTag(page, press, lumen)
  await waitForTags(page, lumen, before, 'after its remove button')
  await page.waitForSelector('[data-testid="save-rows"][disabled]', { timeout: 5_000 }).catch(() => {
    throw new Error('Save clients is still on after the new IBAN was taken off')
  })
}

/**
 * On Settings, General the card settlement IBANs are the same tags field. A tag that is not an IBAN
 * is said under the field and keeps Save off until its remove button takes it off. A valid one is
 * saved, then taken off and saved again, since settings keep no Undo.
 */
export async function cardSettlementIbansFlow(page, { press, shoot, inspect }) {
  const input = () =>
    page.waitForSelector(`${CARD_IBANS} input`, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('Settings, General has no card settlement IBANs field')
    })
  const before = await tagsIn(page, CARD_IBANS)

  await typeIban(page, press, await input(), 'GB82 WEST 1234 5698 7654 32')
  await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN], 'a typed IBAN')
  await typeIban(page, press, await input(), 'XX00 NOT AN IBAN')
  await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN, 'XX00NOTANIBAN'], 'an entry that is not an IBAN')
  await page.waitForFunction((selector) => document.querySelector(selector)?.textContent?.includes('"XX00NOTANIBAN" is not an IBAN'), { timeout: 5_000 }, CARD_IBANS).catch(() => {
    throw new Error('the field does not say the entry is not an IBAN')
  })
  await saveSettingsButton(page, false)
  await inspect?.('card settlement IBANs with one that is not an IBAN')
  await shoot('card-ibans-invalid')
  await removeLastTag(page, press, CARD_IBANS)
  await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN], 'after its remove button')

  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  await waitForTags(page, CARD_IBANS, [...before, NEW_IBAN], 'after the save')
  await dismissToasts(page)
  await removeLastTag(page, press, CARD_IBANS)
  await waitForTags(page, CARD_IBANS, before, 'after the saved IBAN was taken off')
  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  await dismissToasts(page)
}

const RULE_ROW = '[data-testid="rule-row"]'

/** The rules tab's row of this rule, by its id. */
async function ruleRowOf(page, id) {
  return page
    .waitForFunction((selector, wanted) => [...document.querySelectorAll(selector)].find((row) => row.querySelector('.identifier')?.textContent?.trim() === wanted) ?? null, { timeout: 10_000 }, RULE_ROW, id)
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`the rules tab has no rule ${id}`)
    })
}

async function ruleGone(page, id) {
  await page
    .waitForFunction((selector, wanted) => ![...document.querySelectorAll(selector)].some((row) => row.querySelector('.identifier')?.textContent?.trim() === wanted), { timeout: 10_000 }, RULE_ROW, id)
    .catch(() => {
      throw new Error(`the rule ${id} is still on the rules tab`)
    })
}

/** Waits until the rule's note on the rules tab reads `note`, blank for none. */
async function ruleNoteReads(page, id, note, when) {
  await page
    .waitForFunction(
      (selector, wanted, text) => {
        const row = [...document.querySelectorAll(selector)].find((candidate) => candidate.querySelector('.identifier')?.textContent?.trim() === wanted)
        return row !== undefined && (row.querySelector('.rule-main > p.text-xs')?.textContent?.trim() ?? '') === text
      },
      { timeout: 10_000 },
      RULE_ROW,
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

async function editRule(page, press, id) {
  const row = await ruleRowOf(page, id)
  const edit = await row.$('[data-testid="edit-rule"]')
  await edit.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(edit)
  await page.waitForSelector('[role="dialog"] [data-testid="rule-editor"]', { visible: true, timeout: 10_000 })
  await delay(300)
}

/**
 * On Review, Rules: a rule's note changed in its editor, the toast with Undo once the editor closes,
 * and Undo putting the note back. Then the same rule deleted from its editor after the back-test of
 * taking it off, and brought back with Undo.
 */
export async function rulesEditorFlow(page, { press, shoot, inspect }) {
  const id = 'merchant-airline'
  const added = 'Checked in the editor.'
  await ruleNoteReads(page, id, '', 'before the flow')

  await editRule(page, press, id)
  const note = await page.waitForSelector('[data-testid="rule-form"] textarea', { visible: true })
  await note.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(note)
  await page.keyboard.type(added)
  await acceptBacktest(page, press)
  await pressSelector(page, press, '[data-testid="save-rule"]')
  await page.waitForSelector('[role="dialog"] [data-testid="rule-saved"]', { visible: true, timeout: 10_000 })
  await inspect?.('rule saved')
  const early = await page.evaluate((selector) => [...document.querySelectorAll(`${selector} [data-slot="title"]`)].map((title) => title.textContent?.trim()), TOAST)
  if (early.includes(`Edited ${id}: note`)) throw new Error('the save toast shows while the saved rule editor is still open')
  const done = await page.waitForFunction(() => [...document.querySelectorAll('[role="dialog"] button')].find((button) => button.textContent?.trim() === 'Done') ?? null)
  await press(done.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 5_000 })
  await toast(page, `Edited ${id}: note`)
  await ruleNoteReads(page, id, added, 'after the save')
  await shoot('rule-edited')
  await undo(page, press)
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
  await toast(page, `Deleted ${id}`)
  await ruleGone(page, id)
  await undo(page, press)
  await ruleNoteReads(page, id, '', 'after Undo of the delete')
  await shoot('rule-deleted-undone')
  await dismissToasts(page)
}

/** Presses the visible button under `selector` whose text starts with `label`. */
async function pressButton(page, press, selector, label) {
  const button = await page
    .waitForFunction(
      (css, wanted) => [...document.querySelectorAll(css)].find((element) => element.offsetParent !== null && !element.disabled && element.textContent?.trim().startsWith(wanted)) ?? null,
      { timeout: 10_000 },
      selector,
      label,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no enabled ${selector} reading "${label}" within 10 s`)
    })
  await button.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(button)
}

const MOVED = /^Moved \d+ records$/

/** Settings, This device names the file on the fake Drive, its folder, and that no backup is made yet, or with `saved` that the save onboarding made today made one. */
async function deviceShowsDriveFile(page, saved = false) {
  await page.evaluate(() => {
    window.location.hash = '#/settings?tab=device'
  })
  await page.waitForFunction(() => document.querySelector('[data-testid="drive-file-place"] a')?.textContent?.trim() === 'Books', { timeout: 10_000 }).catch(() => {
    throw new Error('Settings, This device does not name the Books folder the file sits in')
  })
  await pageSays(page, 'kuna-company.json', true)
  await pageSays(page, 'None yet. The first save of a day makes one.', !saved)
}

const STEP = '[data-testid="onboarding-step"]'

/** Waits for onboarding to show this step, or for Overview once it is over. */
async function onboardingAt(page, step) {
  await page
    .waitForFunction(
      (selector, wanted) =>
        wanted === 'overview' ? document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === 'Overview' : document.querySelector(selector)?.dataset.step === wanted,
      { timeout: 10_000 },
      STEP,
      step,
    )
    .catch(async () => {
      const at = await page.evaluate((selector) => document.querySelector(selector)?.dataset.step ?? window.location.hash, STEP)
      throw new Error(`onboarding is at ${at}, not ${step}`)
    })
  await delay(250)
}

/** Picks the choice of a radio group in an onboarding step by the start of its label. */
async function chooseOption(page, press, group, label) {
  await pressButton(page, press, `[data-testid="${group}"] label`, label)
}

/** Continue to Google, which the fake build's Google grants at once, unless the page holds a token already, then Continue once the step says Allowed. */
async function allowGoogle(page, press, { shoot, inspect }) {
  await onboardingAt(page, 'access')
  await inspect?.('the access step')
  await shoot('onboarding-access')
  if (await page.$('[data-testid="onboarding-google"]')) await pressSelector(page, press, '[data-testid="onboarding-google"]')
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="access-status"]')].some((badge) => badge.textContent?.trim() === 'Allowed'), { timeout: 10_000 }).catch(() => {
    throw new Error('the access step does not say Google allowed the books file')
  })
  await shoot('onboarding-access-allowed')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
}

/** The folder step: the fake Picker picks Books, the confirm names it as `named`, and Create the file here makes the file. */
async function confirmFolder(page, press, { shoot, inspect }, named) {
  await onboardingAt(page, 'folder')
  await pressSelector(page, press, '[data-testid="onboarding-choose-folder"]')
  const confirm = await page.waitForSelector('[data-testid="onboarding-folder-confirm"]', { visible: true, timeout: 10_000 })
  const said = await confirm.evaluate((element) => element.textContent ?? '')
  if (!said.includes(named)) throw new Error(`the folder confirm says "${said}", not ${named}`)
  if (!(await page.$('[data-testid="onboarding-folder-link"]'))) throw new Error('the folder confirm has no link to the folder in Drive')
  await inspect?.('the folder confirm')
  await shoot(named.startsWith('My Drive') ? 'onboarding-folder-path' : 'onboarding-folder-name')
  await pressSelector(page, press, '[data-testid="onboarding-create"]')
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
async function folderRefusedOnDrive(page, press, dropsBrowserBooks) {
  await onboardingAt(page, 'folder')
  await pressSelector(page, press, '[data-testid="onboarding-choose-folder"]')
  const alert = await page.waitForSelector('[data-testid="onboarding-folder-on-drive"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the folder step does not say Drive already holds the books')
  })
  const said = await alert.evaluate((element) => element.textContent ?? '')
  for (const text of ['Drive already holds kuna-company.json', 'trash it in Drive first']) if (!said.includes(text)) throw new Error(`the folder step says "${said}", not ${text}`)
  if (said.includes('deletes the books in this browser') !== dropsBrowserBooks) throw new Error(`the folder step says "${said}", which ${dropsBrowserBooks ? 'does not warn' : 'warns'} that the books in this browser are deleted`)
  if (await page.$('[data-testid="onboarding-folder-failure"]')) throw new Error('the folder step shows the refusal as a failure too')
}


/** The lines Overview's Getting set up card shows, by key. */
async function setUpLines(page) {
  await page.waitForSelector('[data-testid="getting-set-up"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Overview shows no Getting set up card')
  })
  return page.$$eval('[data-testid="getting-set-up"] [data-line]', (lines) => lines.map((line) => line.dataset.line))
}

/**
 * New books on the fake Drive with statements by hand: the access step asks for the books file
 * alone, so the folder confirm names Books with no path, as `drive.file` cannot read its parents.
 * The file's toast names where it was made. The first statement's IBAN becomes the account main,
 * and Overview's Getting set up card asks only for a look over the categories.
 */
export async function onboardingDriveFlow(page, { press, shoot, inspect }) {
  await onboardingAt(page, 'welcome')
  await inspect?.('the welcome step')
  await shoot('onboarding-welcome')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'home')
  await shoot('onboarding-home')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await allowGoogle(page, press, { shoot, inspect })
  await confirmFolder(page, press, { shoot, inspect }, 'Books, inside folders the app cannot see')
  await toastMatching(page, /^Created kuna-company\.json in Books$/)
  await dismissToasts(page)
  await onboardingAt(page, 'company')
  await inspect?.('the company step')
  await shoot('onboarding-company')
  await backToMade(page, press, 'folder', ['Books', 'kuna-company.json'])
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
  if (!(await offer.evaluate((element) => element.textContent ?? '')).includes('is new')) throw new Error('the new account offer does not say the IBAN is new')
  const name = await page.$eval('input[data-testid="dry-run-account-name"]', (input) => input.value)
  if (name !== 'main') throw new Error(`the account offered is named "${name}", not main`)
  await inspect?.('the first statement')
  await shoot('onboarding-statement')
  await pressButton(page, press, '[data-testid="onboarding-step"] button', 'Add and import')
  await toastMatching(page, /^Added main and imported \d+ rows$/)
  await onboardingAt(page, 'overview')
  const lines = await setUpLines(page)
  if (JSON.stringify(lines) !== JSON.stringify(['categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}, not the categories alone`)
  await inspect?.('Overview getting set up')
  await shoot('onboarding-overview')
  await dismissToasts(page)
  await deviceShowsDriveFile(page, true)
}

/**
 * New books on the fake Drive with statements from a Drive folder: the token carries Drive read, so
 * the folder confirm names the full path, and the toast does too. A Croatian d.o.o. answers Yes in
 * the company step, which asks for no folder of the accountant's, chooses the statements folder in
 * the statement step, skips the statement, and Getting set up lists the first statement and the
 * categories.
 */
export async function onboardingDriveReadFlow(page, { press, shoot, inspect }) {
  await onboardingAt(page, 'welcome')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'home')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'access')
  await chooseOption(page, press, 'onboarding-statements', 'From a folder in my Drive')
  await page.waitForFunction(() => window.location.hash.includes('statements=folder'), { timeout: 5_000 }).catch(() => {
    throw new Error('the statements choice did not reach the address, so a trip to Google would lose it')
  })
  await allowGoogle(page, press, { shoot, inspect })
  await confirmFolder(page, press, { shoot, inspect }, 'My Drive › Books')
  await toastMatching(page, /^Created kuna-company\.json in My Drive › Books$/)
  await dismissToasts(page)
  await onboardingAt(page, 'company')
  await chooseOption(page, press, 'onboarding-pack', 'Yes')
  const asksFolder = await page.$$eval('[data-testid="onboarding-step"] button', (buttons) => buttons.some((button) => button.textContent?.trim() === 'Choose folder'))
  if (asksFolder) throw new Error('the company step of a Croatian d.o.o. still asks for a folder')
  await inspect?.('the company step of a Croatian d.o.o.')
  await shoot('onboarding-company-pack')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'statement')
  await pressButton(page, press, '[data-testid="onboarding-statements-folder"] button', 'Choose folder')
  await page.waitForFunction(() => document.querySelector('[data-testid="onboarding-statements-folder"]')?.textContent?.includes('My Drive › Books') ?? false, { timeout: 10_000 }).catch(() => {
    throw new Error('the statement step does not show the statements folder chosen')
  })
  await shoot('onboarding-statements-folder')
  await pressSelector(page, press, '[data-testid="onboarding-skip"]')
  await onboardingAt(page, 'overview')
  const lines = await setUpLines(page)
  if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)
  await shoot('onboarding-overview-pack')
}

/**
 * New books on the fake Drive with statements from mail: the access step offers Erste with its
 * sender and mail since at the first day of this year, then another bank typed in, all kept in the
 * address, and asks Google for Gmail read beside the books file and never for Drive read. The folder
 * confirm names the statements folder the app makes beside the books, and the statement step says
 * each sync files the mail there. A sync then files the bank's mail into that folder, and the same
 * sync holds the statement of the account the new books lack, with 1 problem in the sync control.
 */
export async function onboardingMailFlow(page, { press, shoot, inspect }) {
  const shootMail = (name) => shoot(name.replace(/^onboarding-/, 'onboarding-mail-'))
  await onboardingAt(page, 'welcome')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'home')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'access')
  await chooseOption(page, press, 'onboarding-statements', 'From my mail')
  const fields = await page.waitForSelector('[data-testid="onboarding-mail"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('From my mail shows no bank and mail since')
  })
  if (!(await fields.evaluate((element) => element.textContent ?? '')).includes('netbanking.support@erstebank.hr')) throw new Error('the Erste preset does not name the address it mails from')
  const since = await page.$eval('input[data-testid="onboarding-mail-since"]', (input) => input.value)
  if (since !== `${new Date().getFullYear()}-01-01`) throw new Error(`mail since starts at ${since}, not the first day of this year`)
  await inspect?.('the access step with mail from Erste')
  await shoot('onboarding-access-mail')
  await choose(page, press, await page.waitForSelector('[data-testid="onboarding-bank"]'), 'Another bank')
  if (!(await page.$eval('[data-testid="onboarding-google"], [data-testid="onboarding-continue"]', (button) => button.disabled))) throw new Error('the access step goes on before another bank is named')
  await setField(await page.waitForSelector('input[data-testid="onboarding-mail-from"]', { visible: true }), 'statements@bank.example.com')
  await setField(await page.waitForSelector('input[data-testid="onboarding-mail-subject"]'), 'Izvadak')
  await page.waitForFunction(() => /statements=mail/.test(window.location.hash) && /bank=other/.test(window.location.hash) && /subject=Izvadak/.test(window.location.hash), { timeout: 5_000 }).catch(() => {
    throw new Error('the mail typed did not reach the address, so a trip to Google would lose it')
  })
  await shoot('onboarding-access-mail-other')
  await allowGoogle(page, press, { shoot: shootMail, inspect })
  const asked = await page.evaluate(() => JSON.parse(window.localStorage.getItem('kuna.google-needed') ?? '[]'))
  if (JSON.stringify(asked) !== JSON.stringify(['drive.file', 'gmail.readonly'])) throw new Error(`the access step asked Google for ${asked.join(', ')}, not Gmail read beside the books file alone`)
  await onboardingAt(page, 'folder')
  await pressSelector(page, press, '[data-testid="onboarding-choose-folder"]')
  await page.waitForSelector('[data-testid="onboarding-folder-confirm"] [data-testid="onboarding-folder-statements"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the folder confirm does not name the statements folder the app makes')
  })
  await inspect?.('the folder confirm with the statements folder')
  await shoot('onboarding-folder-mail')
  await pressSelector(page, press, '[data-testid="onboarding-create"]')
  await toastMatching(page, /^Created kuna-company\.json in Books$/)
  await dismissToasts(page)
  await onboardingAt(page, 'company')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'statement')
  await page.waitForSelector('[data-testid="onboarding-statements-mail"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the statement step does not say where each sync files the mail')
  })
  if (await page.$('[data-testid="onboarding-statements-folder"]')) throw new Error('statements from mail are offered a Drive folder to choose')
  await inspect?.('the statement step with statements from mail')
  await shoot('onboarding-statement-mail')
  await pressSelector(page, press, '[data-testid="onboarding-skip"]')
  await onboardingAt(page, 'overview')
  const lines = await setUpLines(page)
  if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)

  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(page, '', 'mail', 'done', /Filed \d+/)
  await stepSays(page, '', 'statements', 'waits', /1 statement was not filed/)
  await delay(400)
  await inspect?.('the first sync of books whose statements come from mail')
  await shoot('onboarding-mail-sync')
}

/**
 * New books in this browser: no Google at all. Back from the company step shows them made on the
 * home step, whose Start over asks first, says they cannot be recovered, and deletes them once
 * confirmed, so they are made again. The company step names the company, the statement
 * step says such books take statements by hand and is skipped, and Getting set up's first line
 * opens Import.
 */
export async function onboardingBrowserFlow(page, { press, shoot, inspect }) {
  await onboardingAt(page, 'welcome')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'home')
  await chooseOption(page, press, 'onboarding-home', 'Only this browser')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'company')
  await backToMade(page, press, 'home', ['kept in this browser', 'New books'])
  await inspect?.('the home step of the books made in this browser')
  await shoot('onboarding-home-made')
  await startOverAsks(page, press, ['cannot be recovered', 'They hold 0 transactions and'])
  await inspect?.('Start over asking before it deletes the books in this browser')
  await shoot('onboarding-start-over-browser')
  await confirmStartOver(page, press)
  await page.waitForSelector('[data-testid="onboarding-home"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Start over did not bring back the choice of where the books live')
  })
  await onboardingAt(page, 'home')
  if (await page.$('[data-testid="onboarding-made"]')) throw new Error('the home step still shows the books made after Start over')
  await chooseOption(page, press, 'onboarding-home', 'Only this browser')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'company')
  await setField(await page.waitForSelector('input[data-testid="onboarding-company-name"]'), 'Example Studio')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'statement')
  if (await page.$('[data-testid="onboarding-statements-folder"]')) throw new Error('books kept in this browser are offered a statements folder')
  if (!(await page.$('[data-testid="onboarding-statements-by-hand"]'))) throw new Error('the statement step does not say books kept in this browser take statements by hand')
  await pressSelector(page, press, '[data-testid="onboarding-skip"]')
  await onboardingAt(page, 'overview')
  await page.waitForSelector('[data-testid="local-status"]', { timeout: 10_000 }).catch(() => {
    throw new Error('the new books in this browser show no export status')
  })
  const lines = await setUpLines(page)
  if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)
  await inspect?.('new books in this browser')
  await shoot('onboarding-browser')
  await pressButton(page, press, '[data-line="first-statement"] a', 'Import')
  await page.waitForSelector('[data-testid="import-file"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Getting set up did not open Import')
  })
  await page.evaluate(() => {
    window.location.hash = '#/settings'
  })
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some((input) => input.value === 'Example Studio'), { timeout: 10_000 }).catch(() => {
    throw new Error('Settings, General does not name the company the company step named')
  })
}

/**
 * Books brought from an xlsx file to the fake Drive: access first, then the file's summary with its
 * records by tab, then the folder. The toast says how many records moved, the company step confirms
 * what the file says, and Overview draws the moved books.
 */
export function onboardingBringFlow(path) {
  return async (page, { press, shoot, inspect }) => {
    await onboardingAt(page, 'welcome')
    await chooseOption(page, press, 'onboarding-path', 'Bring my books')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'home')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await allowGoogle(page, press, { shoot, inspect })
    await onboardingAt(page, 'file')
    const input = await page.waitForSelector('input[data-testid="onboarding-file"]')
    await input.uploadFile(path)
    await page.waitForFunction(() => /^\d+ records, by tab$/.test(document.querySelector('[data-testid="record-counts"] h3')?.textContent?.trim() ?? ''), { timeout: 10_000 }).catch(() => {
      throw new Error('the file step does not count the records by tab')
    })
    await delay(400)
    await inspect?.('the file summary')
    await shoot('onboarding-file')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await confirmFolder(page, press, { shoot, inspect }, 'Books, inside folders the app cannot see')
    await toastMatching(page, MOVED)
    await dismissToasts(page)
    await onboardingAt(page, 'company')
    const named = await page.$eval('input[data-testid="onboarding-company-name"]', (input) => input.value)
    if (named === '') throw new Error('the company step does not show the name the file gives')
    await pressSelector(page, press, '[data-testid="onboarding-continue"]')
    await onboardingAt(page, 'overview')
    await page.waitForSelector('.chart-body canvas', { timeout: 10_000 }).catch(() => {
      throw new Error('Overview drew no chart from the moved books')
    })
    await shoot('moved')
    // The file already holds every answer of the company step, so Continue writes nothing and makes no backup.
    await deviceShowsDriveFile(page)
  }
}

/** Open my books on Drive, on a device that keeps the fake Drive's books: Find the file says they are open, and onboarding ends on Overview. */
export async function onboardingOpenFlow(page, { press, shoot, inspect }) {
  await onboardingAt(page, 'welcome')
  await chooseOption(page, press, 'onboarding-path', 'Open my books on Google Drive')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await allowGoogle(page, press, { shoot, inspect })
  await onboardingAt(page, 'find')
  await inspect?.('the find step')
  await shoot('onboarding-find')
  await pressSelector(page, press, '[data-testid="onboarding-find"]')
  await toastMatching(page, /^Your books are already open$/)
  await onboardingAt(page, 'overview')
}

/**
 * New books on the fake Drive, then Back from the company step to the folder step, whose Start over
 * asks first, keeps the file on Keep them and trashes it once confirmed. The folder is chosen again
 * without a refusal, since the search leaves trashed files out, and a second file is made in its
 * place. The statement step goes back to the company step. Once a statement is imported, the
 * browser's back button and Back lead to the folder step again, whose Start over counts the
 * transactions imported, and Keep them keeps them.
 */
export async function onboardingStartOverFlow(page, { press, shoot, inspect }) {
  await onboardingAt(page, 'welcome')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'home')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await allowGoogle(page, press, { shoot: () => {} })
  await confirmFolder(page, press, { shoot: () => {} }, 'Books, inside folders the app cannot see')
  await toastMatching(page, /^Created kuna-company\.json in Books$/)
  await dismissToasts(page)
  await onboardingAt(page, 'company')
  await backToMade(page, press, 'folder', ['Books', 'kuna-company.json'])
  await startOverAsks(page, press, ['Trash kuna-company.json', 'Drive bin', '30 days', 'They hold 0 transactions and'])
  await pressSelector(page, press, '[data-testid="onboarding-keep-books"]')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
  if (!(await page.$('[data-testid="onboarding-made"]'))) throw new Error('Keep them dropped the books')
  await startOverAsks(page, press, ['Trash kuna-company.json'])
  await confirmStartOver(page, press)
  await page.waitForSelector('[data-testid="onboarding-choose-folder"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Start over did not bring back the choice of a folder')
  })
  if (await page.$('[data-testid="onboarding-made"]')) throw new Error('the folder step still shows the books made after Start over')
  await inspect?.('the folder step after Start over')
  await shoot('onboarding-start-over')
  await confirmFolder(page, press, { shoot: () => {} }, 'Books, inside folders the app cannot see')
  await toastMatching(page, /^Created kuna-company\.json in Books$/)
  await dismissToasts(page)
  await onboardingAt(page, 'company')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'statement')
  await pressSelector(page, press, '[data-testid="onboarding-back"]')
  await onboardingAt(page, 'company')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'statement')
  await pressSelector(page, press, '[data-testid="sample-camt"]')
  await pressButton(page, press, '[data-testid="onboarding-step"] button', 'Add and import')
  await toastMatching(page, /^Added main and imported \d+ rows$/)
  await onboardingAt(page, 'overview')
  await dismissToasts(page)
  // The browser's back button leads back into onboarding after the books hold work, so Start over has to say so.
  await page.goBack()
  await onboardingAt(page, 'statement')
  await pressSelector(page, press, '[data-testid="onboarding-back"]')
  await onboardingAt(page, 'company')
  await backToMade(page, press, 'folder', ['kuna-company.json'])
  await startOverAsks(page, press, ['Trash kuna-company.json'])
  const holds = await page.$eval('[data-testid="onboarding-start-over-holds"]', (element) => element.textContent?.trim() ?? '')
  const transactions = Number(/They hold (\d+) transactions?/.exec(holds)?.[1] ?? 0)
  if (transactions === 0) throw new Error(`Start over on books with an imported statement says "${holds}"`)
  await inspect?.('Start over asking before it trashes books with work in them')
  await shoot('onboarding-start-over-holds')
  await pressSelector(page, press, '[data-testid="onboarding-keep-books"]')
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
  if (!(await page.$('[data-testid="onboarding-made"]'))) throw new Error('Keep them dropped the books with work in them')
}

/**
 * New books on Drive on a device whose books the fake Drive already holds: the folder step refuses a
 * second file, and opening the books on Drive takes the find step, which finds them open already.
 */
export async function onboardingOnDriveFlow(page, { press, shoot, inspect }) {
  await folderRefusedOnDrive(page, press, false)
  await inspect?.('the folder step when Drive holds the books')
  await shoot('onboarding-folder-on-drive')
  await pressSelector(page, press, '[data-testid="onboarding-open-on-drive"]')
  await onboardingAt(page, 'find')
  await pressSelector(page, press, '[data-testid="onboarding-find"]')
  await toastMatching(page, /^Your books are already open$/)
  await onboardingAt(page, 'overview')
}

/**
 * Settings, This device: books kept in this browser move to Drive, which already holds a file another
 * device made. The folder step refuses a second file, warns that opening those deletes the books in
 * this browser, and the find step opens them.
 */
export async function moveOntoDriveFlow(page, { press, shoot, inspect }) {
  await pageSays(page, 'Kept in this browser', true)
  await pressSelector(page, press, '[data-testid="keep-on-drive"]')
  await allowGoogle(page, press, { shoot: () => {} })
  await folderRefusedOnDrive(page, press, true)
  await inspect?.('the move when Drive holds the books')
  await shoot('onboarding-move-on-drive')
  await pressSelector(page, press, '[data-testid="onboarding-open-on-drive"]')
  await onboardingAt(page, 'find')
  await pressSelector(page, press, '[data-testid="onboarding-find"]')
  await toastMatching(page, /^Opened kuna-company\.json$/)
  await onboardingAt(page, 'overview')
  await dismissToasts(page)
  await deviceShowsDriveFile(page)
}

/**
 * Settings, This device: the books kept in this browser move to a new file on the fake Drive through
 * onboarding's access and folder steps. The access step asks for the Drive read their statements
 * folder needs, so the folder confirm names the full path, and the sync control
 * shows no Allow access once they are there.
 */
export async function moveFromBrowserFlow(page, { press, shoot, inspect }) {
  await pageSays(page, 'Kept in this browser', true)
  await pressSelector(page, press, '[data-testid="keep-on-drive"]')
  await onboardingAt(page, 'access')
  await page.waitForSelector(`${STEP} [data-scope="drive.readonly"]`, { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('the access step of the move does not name the Drive read the books need')
  })
  await allowGoogle(page, press, { shoot, inspect })
  const asked = await page.evaluate(() => JSON.parse(window.localStorage.getItem('kuna.google-needed') ?? '[]'))
  if (JSON.stringify(asked) !== JSON.stringify(['drive.file', 'drive.readonly'])) throw new Error(`the move asked Google for ${asked.join(', ')}, not the books file and Drive read`)
  await confirmFolder(page, press, { shoot, inspect }, 'My Drive › Books')
  await toastMatching(page, MOVED)
  await onboardingAt(page, 'overview')
  await dismissToasts(page)
  await controlShows(page, 'ready')
  await deviceShowsDriveFile(page)
  await inspect?.('this device once moved')
  await shoot('moved-from-browser')
}

/**
 * The statement step of statements from a Drive folder on a page whose token lacks Drive read, as
 * after a reload: Choose folder asks Google in the same tap before the Picker, so the folder comes
 * back with its path, and nothing points to a sync control onboarding does not show.
 */
export async function onboardingStatementAccessFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => localStorage.setItem('kuna.google-granted', JSON.stringify(['drive.file', 'gmail.compose'])))
  await page.reload({ waitUntil: 'networkidle0' })
  await onboardingAt(page, 'statement')
  await pressButton(page, press, '[data-testid="onboarding-statements-folder"] button', 'Choose folder')
  await page.waitForFunction(() => document.querySelector('[data-testid="onboarding-statements-folder"]')?.textContent?.includes('My Drive › Books') ?? false, { timeout: 10_000 }).catch(async () => {
    const said = await page.$eval(STEP, (element) => element.textContent ?? '')
    throw new Error(`the statement step does not show the folder chosen with its path, it says: ${said}`)
  })
  if ((await page.$eval(STEP, (element) => element.textContent ?? '')).includes('sync control')) throw new Error('the statement step points to the sync control')
  const granted = await page.evaluate(() => JSON.parse(localStorage.getItem('kuna.google-granted') ?? '[]'))
  if (!granted.includes('drive.readonly')) throw new Error(`Choose folder asked Google for ${granted.join(', ')}, without Drive read`)
  await inspect?.('the statement step once Drive read was asked in the tap')
  await shoot('onboarding-statement-access')
  await page.evaluate(() => localStorage.removeItem('kuna.google-granted'))
}

function queueLength(page) {
  return page.evaluate(() => document.querySelectorAll('[data-testid="review-row"]').length)
}

async function queueHolds(page, count, failure) {
  await page.waitForFunction((wanted) => document.querySelectorAll('[data-testid="review-row"]').length === wanted, { timeout: 10_000 }, count).catch(async () => {
    throw new Error(`${failure} (the queue holds ${await queueLength(page)})`)
  })
}

/**
 * Review: a row confirmed while a phone files the other waiting row on the fake Drive at the same
 * moment. Both saves stand, so the queue empties, and Undo takes back only this device's.
 */
export async function raceFlow(page, { press, shoot, inspect }) {
  await queueHolds(page, 2, 'the queue does not hold the two fake rows')
  const summary = await page
    .waitForFunction(() => [...document.querySelectorAll('[data-testid="review-row"] > button')].find((button) => button.textContent?.includes('GADGET CORNER')) ?? null, { timeout: 10_000 })
    .then((handle) => handle.asElement())
  await summary.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(summary)
  await page.waitForSelector('[data-testid="review-details"]')
  await pressButton(page, press, '[data-testid="review-details"] button', 'Confirm')
  await toastMatching(page, /^Confirmed/)
  await queueHolds(page, 0, "the phone's save or this one is missing after the race")
  await inspect?.('both saves of the race')
  await shoot('race')
  await undo(page, press)
  await queueHolds(page, 1, "Undo did not bring back this device's row alone")
  await pageSays(page, 'GADGET CORNER', true)
  await shoot('race-undone')
}

const SALARIES_TABS = '[data-testid="salaries-tabs"] [role="tab"]'

/** Waits until the element under `selector` says every text given. */
async function elementSays(page, selector, texts, failure) {
  await page
    .waitForFunction((css, wanted) => [...document.querySelectorAll(css)].some((element) => wanted.every((text) => element.textContent?.includes(text))), { timeout: 10_000 }, selector, texts)
    .catch(async () => {
      const said = await page.evaluate((css) => document.querySelector(css)?.textContent?.trim().slice(0, 300) ?? 'nothing', selector)
      throw new Error(`${failure}, it says: ${said}`)
    })
}

async function screenTitled(page, title) {
  await page.waitForFunction((wanted) => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === wanted, { timeout: 10_000 }, title).catch(() => {
    throw new Error(`${title} did not open`)
  })
}

/**
 * Salaries with the five made-up employees: the newest payday's health insurance row 10.00 short
 * is the one problem, its build-up opens and its bank figure opens the rows, the People tab opens
 * one employee's month, and a month of the Over time table opens on the Month tab.
 */
export async function salariesFlow(page, { press, shoot, inspect }) {
  await elementSays(page, '[data-testid="salaries-tiles"]', ['10.00 less'], 'the state tile does not say the bank paid 10.00 less')
  await elementSays(page, '[data-testid="salaries-problem"]', ['Health insurance, everyone paid'], 'the problems do not name the health insurance row 10.00 short')
  const problems = await page.$$('[data-testid="salaries-problem"]')
  if (problems.length !== 1) throw new Error(`the payday shows ${problems.length} problems, not the one row 10.00 short`)
  await inspect?.('the month of five employees')
  await shoot('salaries-month')

  await pressButton(page, press, '[data-testid="salaries-problem"] button', 'How it is worked out')
  await page.waitForSelector('[data-testid="figure-detail"]', { visible: true, timeout: 10_000 })
  // The dialog grows in, and its controls reach their size once it has.
  await delay(400)
  await inspect?.('the build-up of the line that differs')
  await shoot('salaries-build-up')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('[data-testid="figure-detail"]') && !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
  // The dialog's overlay fades out after its content, and would take the next press.
  await delay(400)

  await pressSelector(page, press, '[data-testid="salaries-reconciliation"] [data-section="contributions"] [data-verdict="differs"] a')
  await screenTitled(page, 'Transactions')
  await shoot('salaries-bank-rows')
  await page.goBack()
  await screenTitled(page, 'Salaries')

  await pressButton(page, press, SALARIES_TABS, 'People')
  await elementSays(page, '[data-testid="salaries-people"]', ['Mia Primjer', 'Everyone'], 'the People tab does not list everyone paid')
  await inspect?.('the People tab')
  await shoot('salaries-people')
  await pressSelector(page, press, '[data-testid="salaries-people"] [data-person="mia"] a')
  await elementSays(page, '[data-testid="salaries-strip"]', ['Mia Primjer'], 'a name on the People tab did not open that employee’s month')
  await shoot('salaries-employee')

  await pressButton(page, press, SALARIES_TABS, 'Over time')
  await page.waitForSelector('[data-testid="salaries-over-time"] canvas', { visible: true, timeout: 10_000 })
  await inspect?.('the Over time tab')
  await shoot('salaries-over-time')
  await pressSelector(page, press, '[data-testid="salaries-months"] [data-payday="2026-04"] a')
  await page.waitForSelector('[data-testid="salaries-paydays"] [data-payday="2026-04"][aria-pressed="true"]', { timeout: 10_000 }).catch(() => {
    throw new Error('a month of the Over time table did not open on the Month tab')
  })
  await elementSays(page, '[data-testid="salaries-strip"]', ['Mia Primjer'], 'the month opened without the employee picked')
}

const LOANS_STEP = '[data-testid="loans-start-step"]'

/** Waits for the Loans first run to show this step, or for the Loans Overview once it is over. */
async function loansStartAt(page, step) {
  await page
    .waitForFunction(
      (selector, wanted) => (wanted === 'overview' ? document.querySelector('[data-testid="loans-empty"]') !== null : document.querySelector(selector)?.dataset.step === wanted),
      { timeout: 10_000 },
      LOANS_STEP,
      step,
    )
    .catch(async () => {
      const at = await page.evaluate((selector) => document.querySelector(selector)?.dataset.step ?? window.location.hash, LOANS_STEP)
      throw new Error(`the Loans first run is at ${at}, not ${step}`)
    })
  await delay(250)
}

/** Settings, This device: a card for each app's file, the Loans card naming where its file is. */
async function deviceShowsBothFiles(page, loansSays) {
  await page.evaluate(() => {
    window.location.hash = '#/settings?tab=device'
  })
  await page.waitForSelector('[data-testid="data-source-card"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Settings, This device has no Company books card')
  })
  await page
    .waitForFunction((wanted) => document.querySelector('[data-testid="loans-books-card"]')?.textContent?.includes(wanted) === true, { timeout: 10_000 }, loansSays)
    .catch(() => {
      throw new Error(`the Loans books card does not say "${loansSays}"`)
    })
}

/**
 * The Loans first run with the company books on the fake Drive: Loans opens on it, a new file on the
 * fake Drive lands in Books as kuna-loans.json, the Loans Overview says it holds no loans yet, and This
 * device shows a card for each app's file.
 */
export async function loansDriveFlow(page, { press, shoot, inspect }) {
  await loansStartAt(page, 'home')
  await inspect?.('the Loans first run')
  await shoot('loans-start')
  await chooseOption(page, press, 'loans-start-home', 'A new file on Google Drive')
  await pressSelector(page, press, '[data-testid="loans-start-continue"]')
  await loansStartAt(page, 'folder')
  await pressSelector(page, press, '[data-testid="loans-start-choose-folder"]')
  const confirm = await page.waitForSelector('[data-testid="loans-start-folder-confirm"]', { visible: true, timeout: 10_000 })
  const said = await confirm.evaluate((element) => element.textContent ?? '')
  if (!said.includes('Books') || !said.includes('kuna-loans.json')) throw new Error(`the folder confirm says "${said}", not Books and kuna-loans.json`)
  await inspect?.('the Loans folder confirm')
  await shoot('loans-start-folder')
  await pressSelector(page, press, '[data-testid="loans-start-create"]')
  await toastMatching(page, /^Created kuna-loans\.json in (My Drive › )?Books$/)
  await loansStartAt(page, 'overview')
  await pageSays(page, 'on Google Drive as kuna-loans.json', true)
  await inspect?.('the empty Loans Overview')
  await shoot('loans-overview')
  await dismissToasts(page)
  await deviceShowsBothFiles(page, 'kuna-loans.json')
  await inspect?.('This device with two files')
  await shoot('loans-device')
}

/** The Loans first run with the company books in this browser: a new Loans file in this browser, which This device offers to export. */
export async function loansBrowserFlow(page, { press, shoot, inspect }) {
  await loansStartAt(page, 'home')
  await chooseOption(page, press, 'loans-start-home', 'A new file in this browser')
  await pressSelector(page, press, '[data-testid="loans-start-continue"]')
  await loansStartAt(page, 'overview')
  await pageSays(page, 'kept in this browser', true)
  await inspect?.('the empty Loans Overview in this browser')
  await shoot('loans-overview-browser')
  await deviceShowsBothFiles(page, 'Kept in this browser')
  await inspect?.('This device with two files in this browser')
  await shoot('loans-device-browser')
}

/** The Loans first run on a device that has not chosen the Loans file another device made on the fake Drive: Find the file opens it by its mark. */
export async function loansOpenFlow(page, { press, shoot, inspect }) {
  await loansStartAt(page, 'home')
  await chooseOption(page, press, 'loans-start-home', 'My file on Google Drive')
  await pressSelector(page, press, '[data-testid="loans-start-continue"]')
  await loansStartAt(page, 'find')
  await inspect?.('the Loans find step')
  await shoot('loans-start-find')
  await pressSelector(page, press, '[data-testid="loans-start-find"]')
  await toastMatching(page, /^Opened kuna-loans\.json$/)
  await loansStartAt(page, 'overview')
}

/** A new Loans file on Drive on a device that has not chosen the one another device made: the folder step refuses a second file and offers the find step, which opens it. */
export async function loansStartOnDriveFlow(page, { press, shoot, inspect }) {
  await loansStartAt(page, 'folder')
  await pressSelector(page, press, '[data-testid="loans-start-choose-folder"]')
  const alert = await page.waitForSelector('[data-testid="loans-start-on-drive"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the Loans folder step does not say Drive already holds the Loans file')
  })
  const said = await alert.evaluate((element) => element.textContent ?? '')
  if (!said.includes('Drive already holds kuna-loans.json') || !said.includes('trash it in Drive first')) throw new Error(`the Loans folder step says "${said}"`)
  if (await page.$('[data-testid="loans-start-failure"]')) throw new Error('the Loans folder step shows the refusal as a failure too')
  await inspect?.('the Loans folder step when Drive holds the file')
  await shoot('loans-start-on-drive')
  await pressSelector(page, press, '[data-testid="loans-start-open-on-drive"]')
  await loansStartAt(page, 'find')
  await pressSelector(page, press, '[data-testid="loans-start-find"]')
  await toastMatching(page, /^Opened kuna-loans\.json$/)
  await loansStartAt(page, 'overview')
}

/**
 * The menu with two apps, in the sidebar or the phone's drawer: a heading per app, the company's
 * screens under Company, Overview alone under Loans with no line under its heading and marked as the
 * screen on show, and the browser tab naming the app.
 */
export async function menuGroupsFlow(page, { press, shoot, inspect }) {
  const drawer = await page.$('[data-testid="open-navigation"]')
  if (drawer !== null && (await drawer.boundingBox()) !== null) {
    await press(drawer)
    await page.waitForSelector('[role="dialog"] [data-testid="nav-group"]', { visible: true, timeout: 10_000 })
    await delay(300)
  }
  const groups = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="nav-group"]')]
      .filter((group) => group.getClientRects().length > 0)
      .map((group) => ({
        name: group.querySelector('p')?.textContent?.trim() ?? '',
        subtitle: group.querySelectorAll('p')[1]?.textContent?.trim() ?? null,
        entries: [...group.querySelectorAll('a')].map((link) => link.textContent?.trim() ?? ''),
        current: group.querySelector('a[aria-current="page"]')?.textContent?.trim() ?? null,
      })),
  )
  const [company, loans] = groups
  if (groups.length !== 2 || company.name !== 'Company' || loans.name !== 'Loans') throw new Error(`the menu shows ${JSON.stringify(groups.map((group) => group.name))}, not Company and Loans`)
  if (!company.entries.includes('Overview') || !company.entries.some((entry) => entry.startsWith('Transactions'))) throw new Error(`Company lists ${company.entries.join(', ')}`)
  if (loans.subtitle !== null) throw new Error(`Loans shows "${loans.subtitle}" under its heading`)
  if (JSON.stringify(loans.entries) !== JSON.stringify(['Overview']) || loans.current !== 'Overview') throw new Error(`Loans lists ${loans.entries.join(', ')} with ${loans.current} marked`)
  const title = await page.title()
  if (title !== 'Overview, Loans – Kuna') throw new Error(`the browser tab says "${title}"`)
  await inspect?.('the menu with two apps')
  await shoot('menu-groups')
}

async function fill(page, testId, value) {
  const input = await page.waitForSelector(`[data-testid="${testId}"]`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`no visible ${testId} field within 10 s`)
  })
  await setField(input, value)
}

/** Picks the option of an open select menu whose text starts with `start`. */
async function chooseStartingWith(page, press, trigger, start) {
  await pressSelector(page, press, trigger)
  const option = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null, { timeout: 5_000 }, start)
    .catch(() => {
      throw new Error(`no option starting "${start}"`)
    })
  await option.asElement().evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await press(option.asElement())
  await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
  await delay(200)
}

async function loanCardShown(page, name, shown) {
  await page
    .waitForFunction((wanted, expected) => [...document.querySelectorAll('[data-testid="loan-card"] h2')].some((heading) => heading.textContent?.trim() === wanted) === expected, { timeout: 10_000 }, name, shown)
    .catch(() => {
      throw new Error(shown ? `the Loans Overview has no card for ${name}` : `the Loans Overview still has a card for ${name}`)
    })
}

/** Opens a loan's page from its card on the Loans Overview. */
async function openLoanCard(page, press, name) {
  await page.evaluate(() => {
    window.location.hash = '#/loans'
  })
  await screenTitled(page, 'Overview')
  const card = await page
    .waitForFunction((wanted) => [...document.querySelectorAll('[data-testid="loan-card"]')].find((element) => element.querySelector('h2')?.textContent?.trim() === wanted) ?? null, { timeout: 10_000 }, name)
    .catch(() => {
      throw new Error(`no card for ${name} on the Loans Overview`)
    })
  await card.asElement().evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(card.asElement())
  await screenTitled(page, name)
}

/** Presses Add on the change card with this test id. */
async function addChange(page, press, card) {
  await pressSelector(page, press, `[data-testid="${card}"] [data-testid="change-add"]`)
}

/**
 * Loans with the sample file: a bank loan added with its first rate, which opens its page, a rate
 * period, an extra payment and a late instalment added there, a movement added to the informal loan,
 * and the new bank loan deleted with its records and brought back with Undo.
 */
export async function loansEditorFlow(page, { press, shoot, inspect }) {
  await pressSelector(page, press, '[data-testid="add-bank-loan"]')
  await page.waitForSelector('[data-testid="bank-loan-form"]', { visible: true })
  await fill(page, 'bank-loan-name', 'Car loan')
  await fill(page, 'bank-loan-principal', '12000')
  await fill(page, 'bank-loan-instalments', '48')
  await fill(page, 'bank-loan-drawdown', '2026-01-10')
  await fill(page, 'bank-loan-first-instalment', '2026-02-10')
  await fill(page, 'rate-field', '6.5')
  await delay(200)
  await inspect?.('the bank loan dialog')
  await shoot('loans-add-bank-loan')
  await pressSelector(page, press, '[data-testid="bank-loan-save"]')
  await toast(page, 'Bank loan added')
  await screenTitled(page, 'Car loan')
  await dismissToasts(page)

  await addChange(page, press, 'rate-periods')
  await page.waitForSelector('[data-testid="rate-period-form"]', { visible: true })
  await chooseStartingWith(page, press, '[data-testid="rate-period-from"]', '10 Feb 2027')
  await fill(page, 'rate-field', '5.9')
  await shoot('loans-add-rate-period')
  await pressSelector(page, press, '[data-testid="rate-period-save"]')
  await toast(page, 'Rate period added')
  await elementSays(page, '[data-testid="rate-periods"]', ['5.9%, variable', 'From 10 Feb 2027'], 'the new rate period is not listed')
  await dismissToasts(page)

  await addChange(page, press, 'extra-payments')
  await page.waitForSelector('[data-testid="extra-payment-form"]', { visible: true })
  await fill(page, 'extra-payment-date', '2026-09-10')
  await fill(page, 'extra-payment-amount', '2000')
  await pressSelector(page, press, '[data-testid="extra-payment-save"]')
  await toast(page, 'Extra payment added')
  await elementSays(page, '[data-testid="extra-payments"]', ['€2,000.00', '10 Sept 2026, shorter term'], 'the extra payment is not listed')
  await dismissToasts(page)

  await addChange(page, press, 'late-instalments')
  await page.waitForSelector('[data-testid="late-instalment-form"]', { visible: true })
  await chooseStartingWith(page, press, '[data-testid="late-instalment-due"]', '10 Mar 2026')
  await fill(page, 'late-instalment-paid', '2026-03-20')
  await pressSelector(page, press, '[data-testid="late-instalment-save"]')
  await toast(page, 'Late instalment added')
  await elementSays(page, '[data-testid="late-instalments"]', ['Due 10 Mar 2026', '10 days late'], 'the late instalment is not listed')
  await inspect?.('the new bank loan with its changes')
  await shoot('loans-new-bank-loan')
  await dismissToasts(page)

  await openLoanCard(page, press, 'From Marko')
  await pressSelector(page, press, '[data-testid="movement-add"]')
  await page.waitForSelector('[data-testid="movement-form"]', { visible: true })
  await fill(page, 'movement-amount', '250')
  await fill(page, 'movement-note', 'Paid back by the flow')
  await shoot('loans-add-movement')
  await pressSelector(page, press, '[data-testid="movement-save"]')
  await toast(page, 'Movement added')
  await elementSays(page, '[data-testid="movement-list"]', ['Paid back by the flow'], 'the movement is not listed')
  await dismissToasts(page)

  await openLoanCard(page, press, 'Car loan')
  await pressSelector(page, press, '[data-testid="bank-loan-edit"]')
  await pressSelector(page, press, '[data-testid="bank-loan-delete"]')
  await toast(page, 'Bank loan deleted')
  await screenTitled(page, 'Overview')
  await loanCardShown(page, 'Car loan', false)
  await undo(page, press)
  await loanCardShown(page, 'Car loan', true)
  await inspect?.('the Loans Overview after Undo')
  await shoot('loans-undo-delete')
  await dismissToasts(page)
}

/** The bank loan's what-if: an extra payment inside the subsidy's window shows both effects and the warning, and Apply fills the extra payment dialog. */
export async function loansWhatIfFlow(page, { press, shoot, inspect }) {
  await fill(page, 'what-if-amount', '10000')
  await fill(page, 'what-if-date', '2027-06-20')
  await elementSays(page, '[data-testid="what-if-outcomes"]', ['Shorter term', 'Lower instalment', 'Interest saved', 'New instalment'], 'the what-if does not show both effects')
  await elementSays(page, '[data-testid="what-if-subsidy"]', ['paying the subsidy back'], 'the what-if does not warn about the subsidy')
  const panel = await page.$('[data-testid="what-if"]')
  await panel.evaluate((element) => element.scrollIntoView({ block: 'start' }))
  await delay(200)
  await inspect?.('the what-if panel')
  await shoot('loans-what-if')
  await pressSelector(page, press, '[data-testid="what-if-apply-lower"]')
  await page.waitForSelector('[data-testid="extra-payment-form"]', { visible: true })
  const filled = await page.$eval('[data-testid="extra-payment-amount"]', (input) => input.value)
  if (filled !== '10000.00') throw new Error(`Apply filled the amount with "${filled}"`)
  await shoot('loans-what-if-apply')
  await page.keyboard.press('Escape')
  await dialogGone(page, '[data-testid="extra-payment-form"]')
}
