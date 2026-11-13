/**
 * The Trips screen of the one-employee fake, shared by the visual and the touch check. `press` clicks or taps an
 * element handle, and `shoot` takes a screenshot under a name. Each dialog opens and closes without saving, so the
 * flow leaves the workbook as it found it. A failure throws with what was missing.
 */

import { en as tripsEnglish, hr as tripsCroatian } from '../../src/apps/company/packs/hr-doo/presentation/trips/words.ts'
import { delay, pressSelector } from './pressing.mjs'

const TRIP_WORDS = { en: tripsEnglish, hr: tripsCroatian }

async function shows(page, selector, failure) {
  await page.waitForSelector(selector, { visible: true, timeout: 10_000 }).catch(() => {
    throw new Error(failure)
  })
  // A dialog grows in, and its controls reach their size once it has.
  await delay(400)
}

/** Closes the open dialog with Escape and waits for its overlay to go, which would take the next press. */
async function closeDialog(page) {
  await page.keyboard.press('Escape')
  await page
    .waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 10_000 })
    .catch(() => {
      throw new Error('Escape did not close the dialog')
    })
  await delay(400)
}

async function pressTab(page, press, label) {
  const tab = await page
    .waitForFunction(
      (wanted) => [...document.querySelectorAll('[data-testid="trip-tabs"] [role="tab"]')].find((element) => element.textContent?.trim().startsWith(wanted)) ?? null,
      { timeout: 10_000 },
      label,
    )
    .then((handle) => handle.asElement())
    .catch(() => {
      throw new Error(`no tab "${label}" on the trip's page`)
    })
  await press(tab)
}

/**
 * The list of 2026 with the order waiting for its settlement, the new-order dialog, the Zadar trip's order and
 * settlement with its per diems and payout, the settlement dialog, and the dialogs of a leg and of a new cost.
 */
export function tripsFlowIn(language) {
  const words = TRIP_WORDS[language]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await shows(page, '[data-testid="trip-row"][data-trip="3/2026"]', 'the list of 2026 does not show travel order 3/2026')
    await inspect?.('the travel orders of 2026')
    await shoot('trips-list')

    await pressSelector(page, press, '[data-testid="trips-new"]')
    await shows(page, '[data-testid="trip-order-form"]', 'New travel order did not open its dialog')
    const number = await page.$eval('input[data-testid="trip-number"], [data-testid="trip-number"] input', (input) => input.value).catch(() => '')
    if (!/^\d+\/\d{4}$/.test(number)) throw new Error(`the new order proposes "${number}", not a number of its issue year`)
    await inspect?.('the new-order dialog')
    await shoot('trips-new-order')
    await closeDialog(page)

    await pressSelector(page, press, '[data-testid="trip-row"][data-trip="1/2026"] a')
    await shows(page, '[data-testid="trip-order"]', 'travel order 1/2026 did not open on its order')
    await inspect?.('the order of a trip')
    await shoot('trips-order')

    await pressTab(page, press, words.trip.settlement)
    await shows(page, '[data-testid="trip-per-diems"]', 'the settlement of 1/2026 shows no per diems')
    await shows(page, '[data-testid="trip-payout"]', 'the settlement of 1/2026 shows no payout')
    await inspect?.('the settlement of a trip')
    await shoot('trips-settlement')

    await pressSelector(page, press, '[data-testid="trip-settlement-edit"]')
    await shows(page, '[data-testid="trip-settlement-form"]', 'Edit settlement did not open its dialog')
    await inspect?.('the settlement dialog')
    await shoot('trips-settlement-dialog')
    await closeDialog(page)

    await pressSelector(page, press, '[data-testid="trip-leg-edit"]')
    await shows(page, '[data-testid="trip-leg-form"]', 'a leg did not open its dialog')
    await inspect?.('the leg dialog')
    await shoot('trips-leg-dialog')
    await closeDialog(page)

    await pressSelector(page, press, '[data-testid="trip-cost-add"]')
    await shows(page, '[data-testid="trip-cost-form"]', 'Add cost did not open its dialog')
    await inspect?.('the cost dialog')
    await shoot('trips-cost-dialog')
    await closeDialog(page)
  }
}

/** The overpaid fake's London payout on its trip's Settlement tab before and after a person files it, each showing what it pays outside the travel order. */
export function overpaidFilingFlowIn(language) {
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await shows(page, '[data-testid="trip-bank-outside"]', 'the payout shows nothing outside the travel order')
    await inspect?.('a payout that pays more than its trip')
    await shoot('trips-overpaid-unfiled')

    await pressSelector(page, press, '[data-testid="trip-bank-file"]')
    await page
      .waitForFunction(() => document.querySelector('[data-testid="trip-bank-file"]') === null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('File by the settlement did not file the payout')
      })
    await shows(page, '[data-testid="trip-bank-outside"]', 'the filed payout no longer shows what it pays outside the travel order')
    await inspect?.('a filed payout that pays more than its trip')
    await shoot('trips-overpaid-filed')
  }
}

export const tripsFlow = tripsFlowIn('en')
