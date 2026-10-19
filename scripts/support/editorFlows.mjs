/**
 * Add, edit, delete and undo on the row editors, shared by the visual and the touch check. `press`
 * clicks or taps an element handle, and `shoot` takes a screenshot under a name. Each flow starts
 * on its screen and leaves the workbook as it found it. A failure throws with what was missing.
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

/** Categories: add stationery, give it a colour, delete it, and Undo the delete. */
export async function categoryFlow(page, { press, shoot }) {
  await pressSelector(page, press, '[data-testid="add-category"]')
  const added = (await page.$$('[data-testid="category-row"]')).at(-1)
  await setField(await fieldIn(added, 'Category'), 'stationery')
  await setField(await fieldIn(added, 'Family'), 'operating')
  await delay(200)
  await shoot('categories-draft')
  await pressSelector(page, press, '[data-testid="save-categories"]')
  await toast(page, 'Categories saved')
  await shoot('categories-saved')
  await dismissToasts(page)

  await setField(await fieldIn(await rowNamed(page, '[data-testid="category-row"]', 'stationery'), 'Colour'), '#ffeedd')
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
  const colour = await (await fieldIn(back, 'Colour')).evaluate((input) => input.value)
  if (colour !== '#ffeedd') throw new Error(`Undo brought stationery back with the colour "${colour}"`)
  await dismissToasts(page)
}

/** Assets: add a monitor, note it, delete it, and Undo the delete. */
export async function assetFlow(page, { press, shoot }) {
  await pressSelector(page, press, '[data-testid="add-row"]')
  const added = (await page.$$('[data-testid="fact-row"]')).at(-1)
  await setField(await fieldIn(added, 'Asset'), 'Monitor')
  await setField(await fieldIn(added, 'Bought'), '2026-10-01')
  await setField(await fieldIn(added, 'Cost without VAT'), '420')
  await choose(page, press, await added.$('[aria-label="Group"]'), 'computers')
  await shoot('assets-draft')
  await pressSelector(page, press, '[data-testid="save-rows"]')
  await toast(page, 'Assets saved')
  await dismissToasts(page)

  await setField(await fieldIn(await rowNamed(page, '[data-testid="fact-row"]', 'Monitor'), 'Note'), 'Second screen')
  await pressSelector(page, press, '[data-testid="save-rows"]')
  await toast(page, 'Assets saved')
  await shoot('assets-saved')
  await dismissToasts(page)

  const row = await rowNamed(page, '[data-testid="fact-row"]', 'Monitor')
  await press(await row.$('[data-testid="remove-row"]'))
  await pressSelector(page, press, '[data-testid="save-rows"]')
  await toast(page, 'Assets saved')
  await rowGone(page, '[data-testid="fact-row"]', 'Monitor')
  await undo(page, press)
  await rowNamed(page, '[data-testid="fact-row"]', 'Monitor')
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
