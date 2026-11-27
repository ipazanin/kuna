/**
 * Assets' flows that the visual and the touch check share: the editor, valuations and shares. `press` clicks or taps an
 * element handle, and `shoot` takes a screenshot under a name. A failure throws with what was missing.
 */

import { delay, pressSelector } from './pressing.mjs'
import { SCREEN_WORDS, choose, dismissToasts, elementSays, fill, goToRoute, lookAtDialog, pressButton, screenTitled, toast, undoIn } from './flowHelpers.mjs'

async function assetCardShown(page, name, shown) {
  await page
    .waitForFunction(
      (wanted, expected) => [...document.querySelectorAll('[data-testid="asset-card"] h2')].some((heading) => heading.textContent?.trim() === wanted) === expected,
      { timeout: 10_000 },
      name,
      shown,
    )
    .catch(() => {
      throw new Error(shown ? `the Assets Overview has no card for ${name}` : `the Assets Overview still has a card for ${name}`)
    })
}

/**
 * On an empty Assets file beside the sample Loans file: a flat added in the asset dialog with its region and the
 * Home loan opens its page, which shows what is owed on the loan and what is yours. Its loan cleared, the page shows
 * neither, and the flat deleted from its dialog leaves the Overview until Undo brings it back.
 */
export function assetsEditorFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { assetDialog } = words.assetPage
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const toastShown = async (title) => {
      await toast(page, title)
      await delay(600)
      await inspect?.(title)
    }
    await pressSelector(page, press, '[data-testid="add-asset"]')
    await page.waitForSelector('[data-testid="asset-form"]', { visible: true })
    await fill(page, 'asset-name', 'Flat by the sea')
    await pressButton(page, press, '[data-testid="asset-kind"] button', words.assetValues.kinds.home)
    await fill(page, 'asset-bought', '2024-05-20')
    await fill(page, 'asset-price', '150000')
    await choose(page, press, await page.$('[data-testid="asset-region"]'), words.assetValues.regions.adriatic)
    await choose(page, press, await page.$('[data-testid="asset-loan"]'), 'Home loan')
    // The dialog grows into place, so it is measured once it settles.
    await delay(300)
    await inspect?.('the asset dialog')
    await shoot('assets-new-flat-dialog')
    await pressSelector(page, press, '[data-testid="asset-save"]')
    await screenTitled(page, 'Flat by the sea')
    await toastShown(assetDialog.added)
    await dismissToasts(page)
    await elementSays(page, '[data-testid="asset-owed"]', [words.assetPage.tiles.owedOn('Home loan')], 'the new flat does not show what is owed on its loan')
    await page.waitForSelector('[data-testid="asset-yours"]', { visible: true, timeout: 10_000 }).catch(() => {
      throw new Error('the new flat does not show what is yours after its loan')
    })
    await shoot('assets-new-flat')

    await pressSelector(page, press, '[data-testid="asset-edit"]')
    await page.waitForSelector('[data-testid="asset-form"]', { visible: true })
    await choose(page, press, await page.$('[data-testid="asset-loan"]'), assetDialog.noLoan)
    await pressSelector(page, press, '[data-testid="asset-save"]')
    await toastShown(assetDialog.saved)
    await dismissToasts(page)
    await page
      .waitForFunction(() => document.querySelector('[data-testid="asset-owed"], [data-testid="asset-yours"]') === null, { timeout: 10_000 })
      .catch(() => {
        throw new Error('the flat still shows its loan once the loan was cleared')
      })

    await pressSelector(page, press, '[data-testid="asset-edit"]')
    await pressSelector(page, press, '[data-testid="asset-delete"]')
    await screenTitled(page, words.assetsOverview.title)
    await assetCardShown(page, 'Flat by the sea', false)
    await toastShown(assetDialog.deleted)
    await undoIn(page, press, words)
    await assetCardShown(page, 'Flat by the sea', true)
    await inspect?.('the Assets Overview after Undo')
    await shoot('assets-undo-delete')
    await dismissToasts(page)
  }
}

export const assetsEditorFlow = assetsEditorFlowIn('en')

/** On the sample car's page: a valuation added in its dialog takes the place of the customs table's estimate, and once deleted from its dialog Undo puts it back. */
export function assetsValuationFlowIn(language) {
  const words = SCREEN_WORDS[language]
  const { valuationDialog } = words.assetPage
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const lines = () => page.evaluate(() => document.querySelectorAll('[data-testid="valuation-list"] [data-testid="change-line"]').length)
    const linesAre = (count, failure) =>
      page
        .waitForFunction((wanted) => document.querySelectorAll('[data-testid="valuation-list"] [data-testid="change-line"]').length === wanted, { timeout: 10_000 }, count)
        .catch(() => {
          throw new Error(failure)
        })
    const before = await lines()
    await pressSelector(page, press, '[data-testid="valuation-add"]')
    await page.waitForSelector('[data-testid="valuation-form"]', { visible: true })
    await fill(page, 'valuation-value', '19000')
    await fill(page, 'valuation-note', 'Dealer offer')
    // The dialog grows into place, so it is measured once it settles.
    await delay(300)
    await inspect?.('the valuation dialog')
    await shoot('assets-valuation-dialog')
    await pressSelector(page, press, '[data-testid="valuation-save"]')
    await toast(page, valuationDialog.added)
    await dismissToasts(page)
    await linesAre(before + 1, 'the valuation is not in the list')
    await elementSays(page, '[data-testid="asset-value"]', [words.assetValues.valuation('')], 'the car does not show the value typed')
    const estimate = words.assetValues.customsNew('', '').split(':')[0]
    if (await page.$eval('[data-testid="asset-value"]', (tile, said) => tile.textContent?.includes(said) ?? false, estimate)) throw new Error('the car still shows the estimate by the customs table')
    await shoot('assets-valuation-added')

    await pressSelector(page, press, '[data-testid="valuation-list"] [data-testid="change-edit"]')
    await page.waitForSelector('[data-testid="valuation-form"]', { visible: true })
    await pressSelector(page, press, '[data-testid="valuation-delete"]')
    await toast(page, valuationDialog.deleted)
    await linesAre(before, 'the deleted valuation is still in the list')
    await undoIn(page, press, words)
    await linesAre(before + 1, 'Undo did not bring the valuation back')
    await inspect?.("the car's page after Undo")
    await dismissToasts(page)
  }
}

export const assetsValuationFlow = assetsValuationFlowIn('en')

/**
 * The flat you own with others and the home loan you took out with others on the co-owned books, their dialogs opened and closed again:
 * the asset's own with your part from the day it was bought, a new change of its part, the change that bought out the other owner,
 * the loan's own with your part from the payout, its first line of the Your part card opening that dialog, and a new change of the loan's part.
 */
export function sharesDialogsFlowIn(language) {
  return async (page, { press, shoot: shootAs }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await goToRoute(page, '#/assets/asset?asset=fa4e2000-0000-4000-8000-000000000001', '[data-testid="asset-shares"]')
    await lookAtDialog(page, press, shoot, '[data-testid="asset-edit"]', '[data-testid="asset-form"]', 'dialog-asset-with-part')
    await lookAtDialog(page, press, shoot, '[data-testid="asset-shares"] [data-testid="change-add"]', '[data-testid="asset-share-form"]', 'dialog-add-asset-share')
    await lookAtDialog(
      page,
      press,
      shoot,
      '[data-testid="asset-shares"] [data-testid="change-line"]:nth-child(2) [data-testid="change-edit"]',
      '[data-testid="asset-share-form"]',
      'dialog-asset-share',
    )
    await goToRoute(page, '#/loans/bank-loan?loan=fa4e0000-0000-4000-8000-000000000001', '[data-testid="loan-shares"]')
    await lookAtDialog(page, press, shoot, '[data-testid="bank-loan-edit"]', '[data-testid="bank-loan-form"]', 'dialog-bank-loan-with-part')
    await lookAtDialog(page, press, shoot, '[data-testid="loan-shares"] [data-testid="change-edit"]', '[data-testid="bank-loan-form"]', 'dialog-bank-loan-from-part')
    await lookAtDialog(page, press, shoot, '[data-testid="loan-shares"] [data-testid="change-add"]', '[data-testid="loan-share-form"]', 'dialog-add-loan-share')
  }
}
