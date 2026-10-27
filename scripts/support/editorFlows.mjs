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
    window.location.hash = '#/transactions?p=all&q=PAPER'
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
    window.location.hash = '#/transactions?tab=import'
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
    window.location.hash = '#/'
  })
  const job = await page.waitForSelector('[data-job="statements"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Overview has no line for the statement the sync held')
  })
  const text = await job.evaluate((element) => element.textContent ?? '')
  if (!text.includes('1 statement was not filed')) throw new Error(`the held statement's line says: ${text}`)

  await page.evaluate(() => {
    window.location.hash = '#/transactions?tab=import'
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
  await page.evaluate(() => localStorage.setItem('ledgerboard.google-granted', JSON.stringify(['drive.file', 'gmail.compose'])))
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
  if (!control.name.includes('Statements and Accountant need your Drive read access')) throw new Error(`a screen reader hears "${control.name}"`)
  if (await page.$('[data-job="check-statements"]')) throw new Error('Overview still offers to check for new statements')
  await inspect?.('the sync control asking for access')
  await shoot('sync-allow-access')
  await syncAndSettle(page, press)
  await controlShows(page, 'ready')
  await noToast(page, 'the sync after Allow access showed a toast')
  await openDeviceSettings(page)
  await stepSays(page, SYNC_CARD, 'statements', 'done', FILED)
  await stepSays(page, SYNC_CARD, 'hr-doo.accountant', 'done', /Read \d+ workbooks/)
}

/** With a slow statements folder, the control names the running step and its place, and a screen reader hears it, until the sync is done. */
export async function syncRunningFlow(page, { press, shoot, inspect }) {
  await press(await syncButton(page))
  const running = await controlShows(page, 'running')
  await page
    .waitForFunction(() => document.querySelector('[data-testid="sync-button"]')?.getAttribute('aria-label')?.startsWith('Syncing, Statements, step 2 of 3') ?? false, { timeout: 10_000 })
    .catch(async () => {
      throw new Error(`the running control does not name the statements step, a screen reader hears "${running.name}"`)
    })
  const shown = await controlShows(page, 'running')
  if (!shown.disabled) throw new Error('the sync control takes a tap while the sync runs')
  if (!/^Statements 2\/3$|^Syncing$/.test(shown.label)) throw new Error(`the running control says "${shown.label}"`)
  await inspect?.('the sync control while the statements step runs')
  await shoot('sync-running')
  const ready = await controlShows(page, 'ready')
  if (!ready.name.startsWith('Synced ')) throw new Error(`the ready control is heard as "${ready.name}"`)
  await inspect?.('the sync control once the sync is done')
  await shoot('sync-ready')
}

const MAIL_CARD = '[data-testid="mail-settings"]'
const MAIL_PLAN = '[data-testid="mail-plan"]'
const MAIL_FILED = /Filed 2, would file 7, already there 4, 1 correction, 1 not compared, 2 unmatched\./

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
 * step files the bank's new PDF and lists the rest.
 */
export async function mailOffFlow(page, { press, shoot, inspect }) {
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
 * into the fake Drive, and the statements step of the same sync files that statement on the ledger.
 * Its link opens the list on the mail card, which marks what was filed beside what the accountant's
 * mail would file, with the accountant's mail fields on the facts card. A second sync files nothing new.
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
  const expected = ['Filed 2, already there 2, 1 unmatched.', 'Would file 5, already there 1, 1 unmatched.', 'Would file 1, 1 correction, 1 not compared.', 'Would file 1, already there 1.']
  if (JSON.stringify(lines) !== JSON.stringify(expected)) throw new Error(`the sources read ${JSON.stringify(lines)}`)
  for (const kind of ['filed', 'file', 'already', 'correction', 'unchecked', 'unmatched']) {
    if ((await page.$(`${MAIL_PLAN} [data-entry="${kind}"]`)) === null) throw new Error(`the list has no ${kind} entry`)
  }
  if ((await page.$(`${MAIL_PLAN} [data-source="statements"] [data-entry="file"]`)) !== null) throw new Error('the bank statements still list a file they would file')
  await scrollToTop(page, MAIL_PLAN)
  await inspect?.('the list of what the mail step filed and found')
  await shoot('mail-list')

  await syncAndSettle(page, press)
  const again = await mailListShows(page, ALL_SOURCES)
  if (again[0] !== 'Nothing new, already there 3.') throw new Error(`a second sync's bank mail reads "${again[0]}"`)
  await openDeviceSettings(page)
  const line = await stepSays(page, SYNC_CARD, 'mail', 'done', /Would file 7, already there 5, 1 correction, 1 not compared, 1 unmatched\./)
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
 * The upload of the bank's PDF fails beside its statement's: the mail step fails with the PDF named,
 * 1 problem in the control, the statement still on the ledger from the same sync, and the list marks
 * the PDF not filed with why.
 */
export async function mailUploadFailedFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}", not 1 problem`)
  await press(await syncButton(page))
  await stepSays(page, '', 'mail', 'failed', /Filed 1, would file 7, already there 4, 1 correction, 1 not compared, 2 unmatched\. Bank statements: \d{4}-\d{2}-\d{2}-statement-\d{3}\.pdf was not filed\./)
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
  await stepSays(page, '', 'mail', 'failed', /Filed 2, would file 6, already there 4, 2 unmatched\. VAT returns: Gmail did not answer the search/)
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
  await page.evaluate(() => localStorage.setItem('ledgerboard.google-granted', JSON.stringify(['drive.file', 'drive.readonly', 'gmail.compose'])))
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

const VAT_RETURNS = '[data-testid="vat-returns"]'
const ACCOUNTANT_PAYROLL = '[data-testid="accountant-payroll"]'
const ACCOUNTANT_READ = '[data-testid="accountant-read"]'
const ACCOUNTANT_RETURNS = '[data-testid="accountant-returns"]'

/** Waits until a row of an accountant card, by its period, says every text given. Returns the row. */
async function accountantRow(page, card, period, texts) {
  const selector = `${card} [data-period="${period}"]`
  return page
    .waitForFunction(
      (rowSelector, wanted) => {
        const row = document.querySelector(rowSelector)
        return row !== null && wanted.every((text) => row.textContent?.includes(text)) ? row : null
      },
      { timeout: 10_000 },
      selector,
      texts,
    )
    .then((handle) => handle.asElement())
    .catch(async () => {
      const said = await page.evaluate((rowSelector) => document.querySelector(rowSelector)?.textContent?.trim() ?? 'no such row', selector)
      throw new Error(`${period} in ${card} does not say ${texts.join(', ')}, it says: ${said}`)
    })
}

/** Waits until the read line above the accountant cards says the text. */
async function accountantReadSays(page, text, failure) {
  await page.waitForFunction((selector, wanted) => document.querySelector(selector)?.textContent?.includes(wanted) ?? false, { timeout: 10_000 }, ACCOUNTANT_READ, text).catch(async () => {
    const said = await page.evaluate((selector) => document.querySelector(selector)?.textContent?.trim() ?? 'nothing', ACCOUNTANT_READ)
    throw new Error(`${failure}, the read line says: ${said}`)
  })
}

/** Presses the badge of a row that says the label, which opens the rows it compared on Transactions. */
async function pressBadge(page, press, row, label) {
  const link = (await row.evaluateHandle((element, wanted) => [...element.querySelectorAll('a')].find((anchor) => anchor.textContent?.trim() === wanted) ?? null, label)).asElement()
  if (link === null) throw new Error(`the ${label} badge opens nothing`)
  await link.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await press(link)
  await page.waitForFunction(() => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === 'Transactions', { timeout: 10_000 }).catch(() => {
    throw new Error(`the ${label} badge did not open Transactions`)
  })
}

async function scrollToTopOf(page, selector) {
  await page.$eval(selector, (element) => element.scrollIntoView({ block: 'start' }))
  await delay(200)
}

/**
 * Year, Taxes in Google mode shows the fake accountant folders as a sync read them: each card shows
 * passing, differing and unread rows, a file that does not read names its tab and row, and a
 * differing badge opens the rows it compared.
 */
export async function accountantReturnsFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await accountantRow(page, VAT_RETURNS, '2026-06', ['Carry ok', 'Sales ok'])
  await accountantRow(page, VAT_RETURNS, '2026-08', ['Could not read', 'Lokalni U, row 5: the lines do not add up to the total row'])
  await accountantRow(page, VAT_RETURNS, '2026-05', ['No return filed'])
  await accountantRow(page, VAT_RETURNS, '2026-09', ['Sales differ', 'Sale 10-1-26'])
  await accountantRow(page, ACCOUNTANT_PAYROLL, '2026-06', ['Bank ok', 'Rules differ', 'Income tax'])
  await accountantRow(page, ACCOUNTANT_PAYROLL, '2026-08', ['Could not read', 'Obračun plaće_Alex Example, row 1'])
  await accountantReadSays(page, 'Read from Drive on', 'the cards do not say when they read Drive')
  await scrollToTopOf(page, ACCOUNTANT_RETURNS)
  await inspect?.('the accountant cards')
  await shoot('accountant-vat-returns')
  await scrollToTopOf(page, ACCOUNTANT_PAYROLL)
  await shoot('accountant-payroll')

  await pressBadge(page, press, await accountantRow(page, VAT_RETURNS, '2026-07', ['Carry differs']), 'Carry differs')
  await delay(400)
  await inspect?.('the rows the carry compared')
  await shoot('accountant-carry-rows')
  // The drill's filters stay set, so the next drill starts from Taxes with every row in view.
  await page.evaluate(() => {
    window.location.hash = '#/year?tab=taxes&p=all'
  })
  await pressBadge(page, press, await accountantRow(page, ACCOUNTANT_PAYROLL, '2026-07', ['Bank differs', 'Rules ok']), 'Bank differs')
  await delay(400)
  await shoot('accountant-bank-rows')
}

/**
 * A token without Drive read shows the read this device kept, with its date, and offers no button
 * of its own: the sync control shows Allow access, after which the cards read Drive again.
 */
export async function accountantKeptReadFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await accountantRow(page, VAT_RETURNS, '2026-06', ['Carry ok'])
  await withoutDriveRead(page)
  await controlShows(page, 'allow-access')
  await accountantReadSays(page, 'kept on this device', 'the cards do not show the read this device kept')
  await accountantRow(page, VAT_RETURNS, '2026-06', ['Carry ok'])
  if (await page.$(`${ACCOUNTANT_READ} button`)) throw new Error('the accountant cards offer a button of their own')
  await scrollToTopOf(page, ACCOUNTANT_RETURNS)
  await inspect?.('the read this device kept')
  await shoot('accountant-kept-read')
  await syncAndSettle(page, press)
  await accountantReadSays(page, 'Read from Drive on', 'the cards did not read Drive after Allow access')
  await noToast(page, 'the sync after Allow access showed a toast')
}

/** Settings, General: the payroll folder saved as a new path, which the next sync reads for Year, Taxes and the fake Drive does not hold, so the accountant step waits for you. */
export async function accountantFoldersFlow(page, { press, shoot, inspect }) {
  const field = await page.waitForSelector('[data-testid="payroll-folder"] input', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the facts card has no payroll folder field')
  })
  const shown = await field.evaluate((element) => element.value)
  if (shown !== 'finance/payroll') throw new Error(`the payroll folder shows "${shown}", not the one the books name`)
  await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await inspect?.('the accountant folders')
  await shoot('accountant-folders')
  await setField(field, 'finance/salaries/')
  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  await saveSettingsButton(page, false)
  await dismissToasts(page)
  await page.evaluate(() => {
    window.location.hash = '#/year?tab=taxes'
  })
  await syncAndSettle(page, press)
  const control = await controlShows(page, 'problems')
  if (control.label !== '1 problem') throw new Error(`the sync control says "${control.label}" for the folder the fake Drive lacks`)
  await page
    .waitForFunction((selector) => document.querySelector(`${selector} [data-testid="accountant-payroll-problem"]`)?.textContent?.includes('not in finance/salaries') ?? false, { timeout: 10_000 }, ACCOUNTANT_PAYROLL)
    .catch(() => {
      throw new Error('the payroll card does not say the folder the settings name holds no workbooks')
    })
  await scrollToTopOf(page, ACCOUNTANT_PAYROLL)
  await shoot('accountant-folder-missing')
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
  await pageSays(page, 'ledgerboard-company.json', true)
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
  await toastMatching(page, /^Created ledgerboard-company\.json in Books$/)
  await dismissToasts(page)
  await onboardingAt(page, 'company')
  await inspect?.('the company step')
  await shoot('onboarding-company')
  if (await page.$('[data-testid="onboarding-back"]')) throw new Error('the company step goes back to the folder step, which would make the file again')
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
 * the folder confirm names the full path, and the toast does too. A Croatian d.o.o. chooses the VAT
 * returns folder in the company step and the statements folder in the statement step, skips the
 * statement, and Getting set up lists the first statement, the payslips folder, which shows only while the pack is on, and the categories.
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
  await toastMatching(page, /^Created ledgerboard-company\.json in My Drive › Books$/)
  await dismissToasts(page)
  await onboardingAt(page, 'company')
  await chooseOption(page, press, 'onboarding-pack', 'Yes')
  await pressButton(page, press, '[data-testid="onboarding-pack-folders"] button', 'Choose folder')
  await page.waitForFunction(() => document.querySelector('[data-testid="onboarding-pack-folders"]')?.textContent?.includes('My Drive › Books') ?? false, { timeout: 10_000 }).catch(() => {
    throw new Error('the company step does not show the path of the folder chosen')
  })
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
  if (JSON.stringify(lines) !== JSON.stringify(['first-statement', 'hr_payroll_folder', 'categories'])) throw new Error(`Getting set up lists ${lines.join(', ')}`)
  await shoot('onboarding-overview-pack')
}

/**
 * New books in this browser: no Google at all. The company step names the company, the statement
 * is skipped, and Getting set up's first line opens Import.
 */
export async function onboardingBrowserFlow(page, { press, shoot, inspect }) {
  await onboardingAt(page, 'welcome')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'home')
  await chooseOption(page, press, 'onboarding-home', 'Only this browser')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'company')
  await setField(await page.waitForSelector('input[data-testid="onboarding-company-name"]'), 'Example Studio')
  await pressSelector(page, press, '[data-testid="onboarding-continue"]')
  await onboardingAt(page, 'statement')
  if (await page.$('[data-testid="onboarding-statements-folder"]')) throw new Error('books kept in this browser are offered a statements folder')
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
    await deviceShowsDriveFile(page, true)
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

/** Settings, This device: the books kept in this browser move to a new file on the fake Drive through onboarding's access and folder steps. */
export async function moveFromBrowserFlow(page, { press, shoot, inspect }) {
  await pageSays(page, 'Kept in this browser', true)
  await pressSelector(page, press, '[data-testid="keep-on-drive"]')
  await allowGoogle(page, press, { shoot, inspect })
  await confirmFolder(page, press, { shoot, inspect }, 'Books, inside folders the app cannot see')
  await toastMatching(page, MOVED)
  await onboardingAt(page, 'overview')
  await dismissToasts(page)
  await deviceShowsDriveFile(page)
  await inspect?.('this device once moved')
  await shoot('moved-from-browser')
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
 * Salaries with the five made-up employees, as a sync read their payslips: the newest payday's net
 * row 10.00 short is the one problem, its build-up opens and its bank figure opens the rows, the
 * People tab opens one employee's month, and a month of the Over time table opens on the Month tab.
 */
export async function salariesFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await elementSays(page, '[data-testid="salaries-tiles"]', ['10.00 less'], 'the paid tile does not say the bank paid 10.00 less')
  await elementSays(page, '[data-testid="salaries-problem"]', ['Mia Primjer, paid to the employee'], 'the problems do not name the row 10.00 short')
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

  await pressSelector(page, press, '[data-testid="salaries-reconciliation"] [data-section="mia"] [data-agrees="false"] a')
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
