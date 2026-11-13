/**
 * The screens of the fake books with a donation above its cap and a sponsorship to a listed club, shared by the visual check.
 * `press` clicks or taps an element handle, and `shoot` takes a screenshot under a name. Year's PD return opens its increases
 * and decreases on PD lines 14 and 33.a, and the categories tab shows the two categories with their class. A failure throws
 * with what was missing.
 */

import { en as citEnglish, hr as citCroatian } from '../../src/apps/company/packs/hr-doo/domain/cit/words.ts'
import { en as classEnglish, hr as classCroatian } from '../../src/apps/company/packs/hr-doo/preset/presentation/classWords.ts'
import { elementSays, shootAt } from './editorFlows.mjs'
import { pressSelector } from './pressing.mjs'

const CIT_WORDS = { en: citEnglish, hr: citCroatian }
const CLASS_WORDS = { en: classEnglish, hr: classCroatian }

const PD_CARD = '[data-card="year.forecast-pd"]'
const PD_RETURN = '[data-testid="forecast-pd-return"]'

export function yearDonationsFlowIn(language) {
  const words = CIT_WORDS[language].base
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await page.waitForSelector(PD_CARD, { visible: true, timeout: 15_000 }).catch(() => {
      throw new Error('Year shows no PD return card')
    })
    if ((await page.$eval(PD_CARD, (card) => card.dataset.collapsed)) === 'true') await pressSelector(page, press, `${PD_CARD} [data-testid="card-toggle"]`)
    for (const line of ['increases', 'decreases']) await pressSelector(page, press, `${PD_RETURN} [aria-controls="forecast-pd-return-${line}"]`)
    await elementSays(page, PD_RETURN, [words.donationsAbove('').split(',')[0], words.listedSponsorships], 'the PD return does not show PD lines 14 and 33.a')
    await shootAt(page, shoot, `${PD_RETURN} [aria-controls="forecast-pd-return-increases"]`, 'year-pd-donations', {
      block: 'center',
      inspected: () => inspect?.('the PD return with the donations above the cap and the listed sponsorship'),
    })
  }
}

export function categoriesDonationsFlowIn(language) {
  const donation = CLASS_WORDS[language].classes.donation('').split(':')[0]
  return async (page, { shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    await elementSays(page, '[data-testid="categories-editor"]', [donation], 'the categories tab does not name the donation class')
    const donationClass = await page.evaluateHandle(
      () => [...document.querySelectorAll('[data-testid="category-row"]')].find((row) => row.querySelector('input')?.value === 'donations')?.querySelector('[data-testid="category-class"]') ?? null,
    )
    const element = donationClass.asElement()
    if (element === null) throw new Error('the categories tab has no donations row with a class')
    await shootAt(page, shoot, element, 'categories-donations', {
      block: 'start',
      inspected: () => inspect?.('the donations and sponsorships rows with their classes'),
    })
  }
}
