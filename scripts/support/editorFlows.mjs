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
 * Settings, General shows the statements folder the app uses while the settings name none, and Save
 * writes it with nothing else changed. Once written, Save waits for a change, and a new path is
 * written to the same row. Settings keep no Undo, so the flow leaves the row in the workbook.
 */
export async function statementsFolderFlow(page, { press, shoot, inspect }) {
  const field = await page.waitForSelector(`${STATEMENTS_FOLDER} input`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('Settings, General has no statements folder field')
  })
  await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  const said = () => page.$eval(STATEMENTS_FOLDER, (element) => element.textContent ?? '')
  const unsetNote = 'names no statements folder yet'
  if (!(await said()).includes(unsetNote)) throw new Error(`the field does not say the settings name no folder, it says: ${await said()}`)
  const shown = await field.evaluate((element) => element.value)
  if (shown !== 'work/dss/business-bank-account/erste/statements') throw new Error(`the field shows "${shown}", not the path the app uses`)
  await inspect?.('the statements folder the settings lack')
  await shoot('statements-folder-unset')

  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  await page.waitForFunction((selector, note) => !document.querySelector(selector)?.textContent?.includes(note), { timeout: 5_000 }, STATEMENTS_FOLDER, unsetNote).catch(() => {
    throw new Error('the field still says the settings name no folder after the save')
  })
  await saveSettingsButton(page, false)
  await dismissToasts(page)

  await setField(field, 'finance/bank statements/')
  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  await saveSettingsButton(page, false)
  if ((await said()).includes(unsetNote)) throw new Error('the field says the settings name no folder after a new path was saved')
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
 * Year, Taxes in Google mode reads the fake accountant folders: each card shows passing, differing
 * and unread rows, a file that does not read names its tab and row, and a differing badge opens the
 * rows it compared.
 */
export async function accountantReturnsFlow(page, { press, shoot, inspect }) {
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
 * A tab Google gave no Drive read token shows the read this device kept, with its date, and offers
 * the check for new statements, after which the cards read Drive again.
 */
export async function accountantKeptReadFlow(page, { press, shoot, inspect }) {
  await accountantRow(page, VAT_RETURNS, '2026-06', ['Carry ok'])
  await page.evaluate(() => sessionStorage.setItem('ledgerboard.drive-read-refused', 'true'))
  await page.reload({ waitUntil: 'networkidle0' })
  await accountantReadSays(page, 'kept on this device', 'the cards do not show the read this device kept')
  await accountantRow(page, VAT_RETURNS, '2026-06', ['Carry ok'])
  await scrollToTopOf(page, ACCOUNTANT_RETURNS)
  await inspect?.('the read this device kept')
  await shoot('accountant-kept-read')
  await pressSelector(page, press, '[data-testid="accountant-check-statements"]')
  await accountantReadSays(page, 'Read from Drive on', 'the cards did not read Drive after the check')
  await toastMatching(page, FILED)
  await dismissToasts(page)
}

/** Settings, General: the payroll folder saved as a new path, which Year, Taxes then reads and the fake Drive does not hold. */
export async function accountantFoldersFlow(page, { press, shoot, inspect }) {
  const field = await page.waitForSelector('[data-testid="payroll-folder"] input', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the facts card has no payroll folder field')
  })
  const shown = await field.evaluate((element) => element.value)
  if (shown !== 'work/dss/dss-finance/payroll') throw new Error(`the payroll folder shows "${shown}", not the default`)
  await field.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  await inspect?.('the accountant folders')
  await shoot('accountant-folders')
  await setField(field, 'finance/payroll/')
  await press(await saveSettingsButton(page, true))
  await toast(page, 'Settings saved')
  await saveSettingsButton(page, false)
  await dismissToasts(page)
  await page.evaluate(() => {
    window.location.hash = '#/year?tab=taxes'
  })
  await page
    .waitForFunction((selector) => document.querySelector(`${selector} [data-testid="accountant-payroll-problem"]`)?.textContent?.includes('not in finance/payroll') ?? false, { timeout: 10_000 }, ACCOUNTANT_PAYROLL)
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

/** Settings, This device names the file on the fake Drive, its folder and that no backup is made yet. */
async function deviceShowsDriveFile(page) {
  await page.evaluate(() => {
    window.location.hash = '#/settings?tab=device'
  })
  await page.waitForFunction(() => document.querySelector('[data-testid="drive-file-place"] a')?.textContent?.trim() === 'Books', { timeout: 10_000 }).catch(() => {
    throw new Error('Settings, This device does not name the Books folder the file sits in')
  })
  await pageSays(page, 'ledgerboard-company.json', true)
  await pageSays(page, 'None yet. The first save of a day makes one.', true)
}

/**
 * The first run: an empty workbook kept on the fake Drive, which Settings, This device then names
 * with its folder. Find the file and Pick another file, whose fake Picker picks the file in Books,
 * each say it is open already.
 */
export async function firstRunDriveFlow(page, { press, shoot, inspect }) {
  await pressSelector(page, press, '[data-testid="start-empty-drive"]')
  await toastMatching(page, MOVED)
  await page.waitForFunction(() => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === 'Overview', { timeout: 10_000 }).catch(() => {
    throw new Error('the empty workbook on Drive did not open Overview')
  })
  await pageSays(page, 'The ledger has no transactions yet', true)
  await shoot('first-run-drive')
  await dismissToasts(page)
  await deviceShowsDriveFile(page)
  await inspect?.('this device with the file on Drive')
  await shoot('first-run-drive-device')
  for (const action of ['Find the file', 'Pick another file']) {
    await pressButton(page, press, 'button', 'Switch data source')
    await pressButton(page, press, '[role="dialog"] button', action)
    await toastMatching(page, /^Your books are already open$/)
    await pageSays(page, 'in Books on Google Drive is the file on screen', true)
    await dismissToasts(page)
  }
}

/** The first run: an empty workbook kept in this browser, which offers the import and the export. */
export async function firstRunBrowserFlow(page, { press, shoot }) {
  await pressSelector(page, press, '[data-testid="start-empty-browser"]')
  await page.waitForFunction(() => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === 'Overview', { timeout: 10_000 }).catch(() => {
    throw new Error('the empty workbook in this browser did not open Overview')
  })
  await pageSays(page, 'Import a statement', true)
  await page.waitForSelector('[data-testid="local-status"]', { timeout: 10_000 }).catch(() => {
    throw new Error('the empty workbook in this browser shows no export status')
  })
  await shoot('first-run-browser')
}

/** The move from an xlsx download: the summary counts the records by tab, then Keep on Google Drive writes the file, reads it back and opens it. */
export function moveFromXlsxFlow(path) {
  return async (page, { press, shoot, inspect }) => {
    const input = await page.waitForSelector('[data-testid="data-source-choices"] input[type="file"]')
    await input.uploadFile(path)
    await page.waitForSelector('[data-testid="record-counts"] dl', { timeout: 10_000 }).catch(() => {
      throw new Error('the summary does not count the records by tab')
    })
    await page.waitForFunction(() => /^\d+ records, by tab$/.test(document.querySelector('[data-testid="record-counts"] h3')?.textContent?.trim() ?? ''), { timeout: 5_000 }).catch(() => {
      throw new Error('the summary does not say how many records the file holds')
    })
    await delay(600)
    await inspect?.('the move summary')
    await shoot('move-summary')
    await pressButton(page, press, '[role="dialog"] button', 'Keep on Google Drive')
    await toastMatching(page, MOVED)
    await page.waitForFunction(() => document.querySelector('[data-testid="screen-title"]')?.textContent?.trim() === 'Overview', { timeout: 10_000 }).catch(() => {
      throw new Error('the moved workbook did not open Overview')
    })
    await page.waitForSelector('.chart-body canvas', { timeout: 10_000 }).catch(() => {
      throw new Error('Overview drew no chart from the moved workbook')
    })
    await shoot('moved')
    await dismissToasts(page)
    await deviceShowsDriveFile(page)
  }
}

/** Settings, This device: the workbook kept in this browser moves to a new file on the fake Drive. */
export async function moveFromBrowserFlow(page, { press, shoot, inspect }) {
  await pageSays(page, 'Kept in this browser', true)
  await pressSelector(page, press, '[data-testid="keep-on-drive"]')
  await toastMatching(page, MOVED)
  await page.waitForSelector('[data-testid="drive-file-place"]', { timeout: 10_000 }).catch(() => {
    throw new Error('the moved workbook is not shown as a file on Drive')
  })
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
