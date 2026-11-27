/**
 * Flows that run in more than one app or on the gallery's shared components: an app's first run and the colour picker,
 * invalid field and optional select specimens. `press` clicks or taps an element handle, and `shoot` takes a screenshot
 * under a name. A failure throws with what was missing.
 */

import { delay, pressSelector } from './pressing.mjs'
import {
  ASSETS,
  LOANS,
  SCREEN_WORDS,
  SPENDING,
  choose,
  chooseOption,
  clearChoice,
  exactly,
  fill,
  firstRunAt,
  pageSays,
  settingsShowFile,
  shootAt,
  toastMatching,
  triggerReads,
} from './flowHelpers.mjs'

/** An app whose file the first run keeps: Loans or Assets, with what its screens call the file and its empty Overview. */
const FILE_APPS = {
  loans: { app: LOANS, file: 'kuna-loans.json', fileWords: (words) => words.loansFile, inBrowser: (words) => words.loansOverview.empty.inBrowser },
  assets: { app: ASSETS, file: 'kuna-assets.json', fileWords: (words) => words.assetsFile, inBrowser: (words) => words.assetsOverview.empty.inBrowser },
  spending: { app: SPENDING, file: 'kuna-spending.json', fileWords: (words) => words.spendingFile, inBrowser: (words) => words.spendingOverview.empty.inBrowser },
}

/** The app's first run keeps a new file in this browser: the empty Overview says so, and so does its Settings. */
export function firstRunBrowserFlowIn(id, language) {
  const words = SCREEN_WORDS[language]
  const { app, inBrowser } = FILE_APPS[id]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await firstRunAt(page, app, 'home')
    await chooseOption(page, press, `${app.id}-start-home`, words.writes.firstRun.home.browser)
    await pressSelector(page, press, `[data-testid="${app.id}-start-continue"]`)
    await firstRunAt(page, app, 'overview')
    await pageSays(page, inBrowser(words), true)
    await inspect?.(`the empty ${app.name} Overview in this browser`)
    await shoot(`${app.id}-overview-browser`)
    await settingsShowFile(page, press, app, words.writes.localFile.kept, words)
    await inspect?.(`the ${app.name} Settings in this browser`)
    await shoot(`${app.id}-settings-browser`)
  }
}

/** A new file of the app on Drive on a device that has not chosen the one another device made: the folder step refuses a second file and offers the find step, which opens it. */
export function firstRunOnDriveFlowIn(id, language) {
  const words = SCREEN_WORDS[language]
  const { app, file, fileWords } = FILE_APPS[id]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await firstRunAt(page, app, 'folder')
    await pressSelector(page, press, `[data-testid="${app.id}-start-create"]`)
    const alert = await page.waitForSelector(`[data-testid="${app.id}-start-on-drive"]`, { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error(`the ${app.name} folder step does not say Drive already holds the ${app.name} file`)
    })
    const said = await alert.evaluate((element) => element.textContent ?? '')
    const refusal = words.storage.alreadyOnDrive(file)
    if (!said.includes(refusal)) throw new Error(`the ${app.name} folder step says "${said}", not ${refusal}`)
    if (await page.$(`[data-testid="${app.id}-start-failure"]`)) throw new Error(`the ${app.name} folder step shows the refusal as a failure too`)
    await inspect?.(`the ${app.name} folder step when Drive holds the file`)
    await shoot(`${app.id}-start-on-drive`)
    await pressSelector(page, press, `[data-testid="${app.id}-start-open-on-drive"]`)
    await firstRunAt(page, app, 'find')
    await inspect?.(`the ${app.name} find step`)
    await pressSelector(page, press, `[data-testid="${app.id}-start-find"]`)
    await toastMatching(page, exactly(fileWords(words).opened(file)))
    await firstRunAt(page, app, 'overview')
  }
}

/**
 * The colour picker specimens in the gallery: an own colour's pop-up with Other colour open, refusing a code too pale for the light theme
 * and offering a darker one, then the pop-up whose warning names a lookalike. A screen reaches the refusal only by typing. The gallery is English only.
 */
export async function colourPickerSpecimenFlow(page, { press, shoot, inspect }) {
  const picker = '[data-testid="colour-swatch-picker"]'
  await page.waitForSelector('[data-testid="gallery-own-colour"]', { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error('the gallery has no own colour specimen')
  })
  await pressSelector(page, press, '[data-testid="gallery-own-colour"] [data-testid="colour-swatch-button"]')
  await page.waitForSelector(picker, { visible: true })
  await pressSelector(page, press, '[data-testid="colour-swatch-other"]')
  await page.waitForSelector('[data-testid="colour-swatch-own"]', { visible: true })
  if (await page.$(`${picker} [data-testid="colour-swatch"]`).then((swatch) => swatch?.isVisible() ?? false)) throw new Error('the swatches stay in view while Other colour is open')
  await fill(page, 'colour-swatch-code', '#ffd27a')
  await page.waitForSelector('[data-testid="colour-swatch-refused"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('the specimen did not refuse a code too pale for the light theme')
  })
  await shootAt(page, shoot, picker, 'colour-picker-specimen-refused', { block: 'nearest', inspected: () => inspect?.('the colour picker specimen refusing a pale colour') })
  await page.keyboard.press('Escape')
  await page.waitForFunction((css) => !document.querySelector(css), { timeout: 5_000 }, picker)
  await pressSelector(page, press, '[data-testid="gallery-alike-colour"] [data-testid="colour-swatch-button"]')
  await page.waitForSelector('[data-testid="colour-swatch-warning"]', { visible: true, timeout: 5_000 }).catch(() => {
    throw new Error('the lookalike specimen shows no warning')
  })
  await shootAt(page, shoot, picker, 'colour-picker-specimen-alike', { block: 'nearest', inspected: () => inspect?.('the colour picker specimen warning of a lookalike') })
  await page.keyboard.press('Escape')
}

/**
 * On the gallery: the amount with no error, reached by Tab, shows Kuna's accent ring rather than Nuxt UI's own focus look.
 * The amount and the currency that show an error keep their red border and show their focus ring in the same red as the
 * error under them.
 */
export async function invalidFieldFocusFlow(page, { shoot }) {
  const valid = await focusFieldByTab(page, 'gallery-money')
  const ring = await valid.control.evaluate((element) => {
    const token = document.createElement('span')
    token.style.color = 'var(--accent)'
    document.body.append(token)
    const accent = getComputedStyle(token).color
    token.remove()
    const style = getComputedStyle(element)
    return { shown: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} offset ${style.outlineOffset}`, expected: `solid 2px ${accent} offset 2px` }
  })
  if (ring.shown !== ring.expected) throw new Error(`gallery-money shows its focus as ${ring.shown}, not Kuna's ring of --accent, ${ring.expected}`)
  for (const [testId, name] of [
    ['gallery-money-error', 'invalid-field-focus-input'],
    ['gallery-currency-error', 'invalid-field-focus-select'],
  ]) {
    const { field, control } = await focusFieldByTab(page, testId)
    const look = await control.evaluate((element) => {
      const error = document.getElementById((element.getAttribute('aria-describedby') ?? '').split(' ').find((id) => id.endsWith('-error')) ?? '')
      const style = getComputedStyle(element)
      return {
        invalid: element.getAttribute('aria-invalid') === 'true',
        outline: `${style.outlineStyle} ${style.outlineColor}`,
        error: error ? `solid ${getComputedStyle(error).color}` : null,
        border: style.boxShadow.includes(error ? getComputedStyle(error).color : 'no error'),
      }
    })
    if (!look.invalid || look.error === null) throw new Error(`${testId} is not marked invalid with an error under it`)
    if (look.outline !== look.error) throw new Error(`${testId} shows its focus as ${look.outline}, not in the red of its error, ${look.error}`)
    if (!look.border) throw new Error(`${testId} loses its red border while focused`)
    await shootAt(page, shoot, field, name)
  }
}

/** The gallery field under `testId` and its input or button, which takes the keyboard's focus by Shift+Tab and Tab. */
async function focusFieldByTab(page, testId) {
  const field = await page.waitForSelector(`[data-testid="${testId}"]`, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(`the gallery has no ${testId} specimen`)
  })
  const control = await field.evaluateHandle((root) => (root.matches('input, button') ? root : root.querySelector('input, button')))
  await control.evaluate((element) => element.focus())
  await page.keyboard.down('Shift')
  await page.keyboard.press('Tab')
  await page.keyboard.up('Shift')
  await page.keyboard.press('Tab')
  // The field fades its colours in, so its ring is read once the fade is over.
  await delay(300)
  if (!(await control.evaluate((element) => document.activeElement === element && element.matches(':focus-visible')))) {
    throw new Error(`${testId} did not take the keyboard's focus back by Tab`)
  }
  return { field, control }
}

/**
 * On the gallery's OptionalSelect: the cross empties the picked field, which then reads Not set in grey and offers no cross,
 * and the keyboard picks Kitchen and then the Not set row, the list's first, with the arrows and Enter.
 */
export function optionalSelectFlow() {
  return async (page, { press, shoot }) => {
    const trigger = '[data-testid="gallery-optional-picked"]'
    await shootAt(page, shoot, trigger, 'optional-select-picked')
    await clearChoice(page, press, trigger, 'en')
    await triggerReads(page, trigger, 'Not set')
    await shootAt(page, shoot, trigger, 'optional-select-cleared')
    await choose(page, press, await page.$(trigger), 'Kitchen')
    await triggerReads(page, trigger, 'Kitchen')
    await page.$eval(trigger, (element) => element.focus())
    await page.keyboard.press('ArrowDown')
    await page.waitForSelector('[role="listbox"]', { visible: true, timeout: 5_000 })
    await delay(200)
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
    await triggerReads(page, trigger, 'Not set')
    const focused = await page.evaluate((selector) => document.activeElement === document.querySelector(selector), trigger)
    if (!focused) throw new Error('the focus left the field once Not set was picked by the keyboard')
  }
}
