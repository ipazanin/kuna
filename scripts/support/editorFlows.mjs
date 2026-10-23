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

/** Categories: add stationery, give it a colour from the pop-up, a label on a tab without the column and a role, delete it, and Undo the delete. */
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
  const inGoogle = !page.url().includes('fake=excel')
  const notice = await page
    .waitForSelector('[data-testid="add-column-notice"]', { visible: true, timeout: inGoogle ? 5_000 : 1_000 })
    .then((handle) => handle.evaluate((element) => element.textContent?.replace(/\s+/g, ' ').trim() ?? ''))
    .catch(() => null)
  if (inGoogle && !notice?.startsWith("The Sheet's categories tab has no label column.")) throw new Error(`a label on the fake Sheet, which lacks the column, says "${notice}"`)
  if (!inGoogle && notice !== null) throw new Error('a workbook kept in this browser says it lacks the label column')
  await chooseRole(page, press, named, 'representation')
  await shoot('categories-label-and-role')
  await pressSelector(page, press, '[data-testid="save-categories"]')
  await toast(page, 'Categories saved')
  await page.waitForFunction(() => !document.querySelector('[data-testid="add-column-notice"]'), { timeout: 5_000 }).catch(() => {
    throw new Error('the notice about the label column stayed once the save added it')
  })
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
 * Make invoice: the form from the billing plan, the checks, and the steps. With a Google Sheet the
 * fake Picker is the browser's confirm dialog: the invoice folder and the year folder are picked,
 * the month folder is not, so the flow makes it on request. A re-export then finds the folders
 * without asking. In Excel mode the PDF is saved through the browser.
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

/** Year, Pay with no scenarios yet, where the scenarios card opens itself: add the starting four, which adds the tab to a Sheet without one, and Undo them. */
export async function startingScenariosFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector('[data-testid="scenario-editor"]')
  if (await page.$('[data-scenario]')) throw new Error('a scenario is on the screen before the flow adds the starting ones')
  await pressSelector(page, press, '[data-testid="add-starting-scenarios"]')
  await page.waitForSelector('[data-testid="starting-scenarios-form"]')
  await delay(400)
  await setField(await page.$('[data-testid="starting-rent"]'), '300')
  await inspect?.('add the starting scenarios')
  await shoot('starting-scenarios')
  const missing = await page.evaluate(() => document.querySelector('[data-testid="add-tab-notice"]') !== null)
  await pressSelector(page, press, '[data-testid="starting-scenarios-save"]')
  await toast(page, missing ? 'Scenarios tab added' : 'Starting scenarios added')
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

/** Year, Plan for 2027 with no plan rows: plan a purchase, which adds the plan tab to a Sheet without one, and Undo it. */
export async function planTabFlow(page, { press, shoot, inspect }) {
  await page.waitForSelector('[data-testid="plan-editor"]')
  if (await page.$('[data-testid="plan-purchase"]')) throw new Error('a purchase is planned before the flow adds one')
  await pressSelector(page, press, '[data-testid="plan-add-purchase"]')
  await page.waitForSelector('[data-testid="purchase-plan-form"]')
  await delay(400)
  await setField(await page.$('[data-testid="purchase-name"]'), 'Replacement laptop')
  await setField(await page.$('[data-testid="purchase-date"]'), '2027-03-10')
  await setField(await page.$('[data-testid="purchase-amount"]'), '1600')
  const missing = await page.evaluate(() => document.querySelector('[data-testid="add-tab-notice"]') !== null)
  await inspect?.('plan a purchase')
  await shoot('plan-purchase')
  await pressSelector(page, press, '[data-testid="purchase-save"]')
  await toast(page, missing ? 'Plan tab added' : 'Purchase planned')
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
  const missing = await page.evaluate(() => document.querySelector('[data-testid="add-tab-notice"]') !== null)
  await setPart(page, 0, '30.00')
  const second = await setPart(page, 1, '8.90')
  await chooseCategory(page, press, await second.$('[data-testid="split-part-category"]'), 'Office supplies')
  await setField(await second.$('[data-testid="split-part-note"]'), 'Printer paper')
  await inspect?.('split a row')
  await shoot(missing ? 'split-add-tab' : 'split-add')
  await pressSelector(page, press, '[data-testid="split-save"]')
  await toast(page, 'Split in 2 parts')
  await dialogGone(page, '[data-testid="split-form"]')
  await waitForSplit(page, true)
  await shoot('split-added')
  await dismissToasts(page)
  if (missing) return

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

const SYNC_BUTTON = '[data-testid="sync-status"] button'

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

/** Presses the Sync button on screen, the top bar's or the sidebar's, and waits until the sync and its statements step are done. */
async function syncAndSettle(page, press) {
  const button = await page
    .waitForFunction((selector) => [...document.querySelectorAll(selector)].find((element) => element.offsetParent !== null) ?? null, { timeout: 10_000 }, SYNC_BUTTON)
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error('no Sync button on screen')
    })
  await press(button)
  await page
    .waitForFunction((selector) => [...document.querySelectorAll(selector)].some((element) => element.offsetParent !== null && !element.disabled), { timeout: 10_000, polling: 100 }, SYNC_BUTTON)
    .catch(() => {
      throw new Error('the sync did not finish within 10 s')
    })
}

const FILED = /^Filed statement \d+, 4 rows$/

/**
 * Sync files the sample statement from the fake statements folder with Undo, files it again once
 * undone, and Import lists it. A last sync finds nothing new, so it writes nothing and says nothing.
 */
export async function statementSyncFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  await toastMatching(page, FILED)
  await inspect?.('the statements filed')
  await shoot('statements-filed')
  await undo(page, press)
  await dismissToasts(page)

  await syncAndSettle(page, press)
  await toastMatching(page, FILED)
  await dismissToasts(page)
  await page.evaluate(() => {
    window.location.hash = '#/transactions?tab=import'
  })
  await page.waitForSelector('[data-testid="statement-folder-filed"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Import does not list the statement the sync filed')
  })
  await delay(300)
  await shoot('statements-folder-filed')

  await syncAndSettle(page, press)
  await delay(1_500)
  const toasts = await page.evaluate((selector) => document.querySelectorAll(selector).length, TOAST)
  if (toasts > 0) throw new Error('a sync that found nothing new showed a toast')
  if (await page.$('[data-testid="statement-folder"]')) throw new Error('the folder card stayed after a sync that found nothing new')
}

/** With a statement of an account the accounts tab lacks in the folder, Sync files the sample, holds the other, and Overview links to Import, which says why. */
export async function heldStatementFlow(page, { press, shoot, inspect }) {
  await syncAndSettle(page, press)
  const said = await toastMatching(page, FILED)
  if (!said.includes('1 statement was not filed')) throw new Error(`the toast does not say a statement was not filed, it says: ${said}`)
  await dismissToasts(page)
  const job = await page.waitForSelector('[data-job="statements"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Overview has no line for the statement the sync held')
  })
  const text = await job.evaluate((element) => element.textContent ?? '')
  if (!text.includes('1 statement was not filed')) throw new Error(`the held statement's line says: ${text}`)
  await inspect?.('the held statement on Overview')
  await shoot('statements-held-overview')
  await pressSelector(page, press, '[data-job="statements"] a')
  await page
    .waitForFunction(() => document.querySelector('[data-testid="statement-folder"] [data-testid="dry-run-refusal"]')?.textContent?.includes('names no account for IBAN') ?? false, { timeout: 10_000 })
    .catch(() => {
      throw new Error('Import does not show why the statement was held')
    })
  await delay(300)
  await inspect?.('the held statement on Import')
  await shoot('statements-held-import')
}

/** A tab Google gave no Drive read token: Overview offers to check for new statements, and the check files the sample. */
export async function statementCheckFlow(page, { press, shoot, inspect }) {
  await page.evaluate(() => sessionStorage.setItem('ledgerboard.drive-read-refused', 'true'))
  await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('[data-job="check-statements"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Overview does not offer to check for new statements')
  })
  await inspect?.('the offer to check for new statements')
  await shoot('statements-check')
  await pressSelector(page, press, '[data-testid="check-statements"]')
  await toastMatching(page, FILED)
  await page.waitForFunction(() => !document.querySelector('[data-job="check-statements"]'), { timeout: 5_000 }).catch(() => {
    throw new Error('the offer to check stayed after the check')
  })
  await dismissToasts(page)
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
 * Review, Rules: dismiss a group no rule settles, which in a Google Sheet without the dismissed
 * tab first asks to add it, find it under the dismissed suggestions, restore it, and Undo the restore.
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
  const asks = await page.$('[data-testid="dismiss-add-tab"]')
  if (asks !== null) {
    await page.waitForSelector('[data-testid="add-tab-notice"]')
    await inspect?.('dismiss asks to add the tab')
    await shoot('dismiss-add-tab')
    await press(asks)
  }
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
