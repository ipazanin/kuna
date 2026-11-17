/**
 * Cut text shows its full text only while it is cut: on hover, on keyboard focus of the text or the link that holds it, and on
 * a long press of a text outside any control, where a tap elsewhere closes it again. The gallery's specimen holds each case,
 * the sidebar shows a long company name under its app with room above the first page, and Transactions' group headings
 * wrap their names on a phone.
 */

import { en as transactionsEnglish, hr as transactionsCroatian } from '../../src/apps/company/transactions/presentation/words.ts'
import { PHONE_BELOW } from '../../src/shared/layout/viewport.ts'
import { OPEN_DELAY } from '../../src/shared/ui/cutText.ts'
import { shootAt } from './editorFlows.mjs'
import { delay } from './pressing.mjs'

/** A long name of the kind the owner's books hold, which the sidebar cuts at every width. */
export const LONG_COMPANY_NAME = 'Primjerna tvrtka za razvoj softvera i savjetovanje d.o.o.'

const SPECIMEN = '#cut-text'
const FULL_TEXTS = { outside: 'Domain Software Solutions d.o.o., Zagreb', link: 'Corner Market and Bakery on the Main Square' }

function tooltipText(page) {
  return page.evaluate(() => document.querySelector('[data-reka-popper-content-wrapper] [data-slot="text"]')?.textContent?.trim() ?? null)
}

async function waitForTooltip(page, expected, what) {
  await page
    .waitForFunction((text) => document.querySelector('[data-reka-popper-content-wrapper] [data-slot="text"]')?.textContent?.trim() === text, { timeout: 3_000 }, expected)
    .catch(async () => {
      throw new Error(`${what} showed ${JSON.stringify(await tooltipText(page))}, not its full text ${JSON.stringify(expected)}`)
    })
}

async function waitForNoTooltip(page, what) {
  await delay(OPEN_DELAY + 300)
  const shown = await tooltipText(page)
  if (shown !== null) throw new Error(`${what} left the tooltip ${JSON.stringify(shown)} open`)
}

/** The specimen's texts by their part: whether each is cut and whether it takes a tab stop. */
function specimenTexts(page) {
  return page.$$eval(`${SPECIMEN} [data-cut-text]`, (texts) =>
    texts.map((text) => ({
      text: text.textContent?.trim() ?? '',
      cut: text.scrollWidth > text.clientWidth + 1 || text.scrollHeight > text.clientHeight + 1,
      tabStop: text.getAttribute('tabindex') === '0',
      inLink: text.closest('a') !== null,
    })),
  )
}

async function specimenText(page, full) {
  const handles = await page.$$(`${SPECIMEN} [data-cut-text]`)
  for (const handle of handles) {
    if ((await handle.evaluate((element) => element.textContent?.trim())) === full) return handle
  }
  throw new Error(`the specimen holds no text ${JSON.stringify(full)}`)
}

/** The gallery's specimen with a pointer and a keyboard: short text shows nothing, cut text its full text on hover and focus. */
export function cutTextFlow() {
  return async (page, { shoot }) => {
    await page.waitForSelector(SPECIMEN, { visible: true, timeout: 10_000 })
    await page.$eval(SPECIMEN, (section) => section.scrollIntoView({ block: 'start' }))
    await delay(200)
    const texts = await specimenTexts(page)
    const short = texts.find((text) => text.text === 'Rent')
    const outside = texts.find((text) => text.text === FULL_TEXTS.outside)
    const inLink = texts.find((text) => text.text === FULL_TEXTS.link)
    if (short === undefined || short.cut || short.tabStop) throw new Error(`the short text is cut or takes a tab stop: ${JSON.stringify(short)}`)
    if (outside === undefined || !outside.cut || !outside.tabStop) throw new Error(`the cut text outside any control is not cut or takes no tab stop: ${JSON.stringify(outside)}`)
    if (inLink === undefined || !inLink.cut || inLink.tabStop) throw new Error(`the cut text inside a link is not cut or takes a tab stop of its own: ${JSON.stringify(inLink)}`)

    await (await specimenText(page, 'Rent')).hover()
    await waitForNoTooltip(page, 'a hover on the short text')

    await (await specimenText(page, FULL_TEXTS.outside)).hover()
    await waitForTooltip(page, FULL_TEXTS.outside, 'a hover on the cut text')
    await shoot('cut-text-hover')
    await page.mouse.move(1, 1)
    await waitForNoTooltip(page, 'the pointer leaving the cut text')

    // Tab from the cut text outside any control reaches the link next, whose focus shows the cut text inside it.
    await (await specimenText(page, FULL_TEXTS.outside)).focus()
    await waitForTooltip(page, FULL_TEXTS.outside, 'keyboard focus on the cut text')
    await page.keyboard.press('Tab')
    await waitForTooltip(page, FULL_TEXTS.link, 'keyboard focus on the link that holds a cut text')
    await shoot('cut-text-focus')
    await page.keyboard.press('Escape')
    await waitForNoTooltip(page, 'Escape')
  }
}

/**
 * A long company name typed on Settings, General shows under Company in the sidebar, cut with room above the first page,
 * and its full text on hover.
 */
export function cutSidebarFlowIn(language) {
  return async (page, { shoot }) => {
    const field = await page.waitForSelector('input[data-testid="company-name"]', { visible: true, timeout: 10_000 })
    await field.click({ count: 3 })
    await field.type(LONG_COMPANY_NAME)
    await page.$eval('input[data-testid="company-name"]', (input) => input.form?.requestSubmit())
    await page
      .waitForFunction((name) => document.querySelector('aside [data-testid="nav-subtitle"]')?.textContent?.trim() === name, { timeout: 10_000 }, LONG_COMPANY_NAME)
      .catch(() => {
        throw new Error(`the sidebar does not show the company's new name ${LONG_COMPANY_NAME} in ${language}`)
      })
    await page.evaluate(() => {
      window.location.hash = '#/company'
    })
    await delay(500)
    const subtitle = await page.waitForSelector('aside [data-testid="nav-subtitle"]', { visible: true })
    const placed = await subtitle.evaluate((element) => {
      // The room is measured from the name's own line, since the line box is what reads as the name.
      const text = document.createRange()
      text.selectNodeContents(element)
      const list = element.nextElementSibling?.querySelector('li a')
      return {
        cut: element.scrollWidth > element.clientWidth + 1,
        room: list === null || list === undefined ? null : Math.round(list.getBoundingClientRect().top - text.getBoundingClientRect().bottom),
      }
    })
    if (!placed.cut) throw new Error(`the long company name is not cut in the sidebar: ${JSON.stringify(placed)}`)
    if (placed.room === null || placed.room < 4) throw new Error(`the company name has ${placed.room} px above the first page, under 4 px`)
    await shoot('cut-sidebar')
    await subtitle.hover()
    await waitForTooltip(page, LONG_COMPANY_NAME, "a hover on the sidebar's company name")
    await shoot('cut-sidebar-hover')
  }
}

/**
 * Company's Transactions grouped by month, by category and by counterparty. Below 640 px a group's name wraps in full,
 * since its heading is a toggle a phone cannot long press, and a counterparty's IBAN stays 12 px.
 */
export function transactionGroupsFlowIn(language) {
  const words = language === 'en' ? transactionsEnglish : transactionsCroatian
  return async (page, { press, shoot }) => {
    for (const grouping of ['month', 'category', 'counterparty']) {
      const select = await page.waitForSelector(`button[aria-label="${words.groupLabel}"]`, { visible: true, timeout: 10_000 })
      await select.evaluate((element) => element.scrollIntoView({ block: 'center' }))
      await press(select)
      const option = await page
        .waitForFunction((wanted) => [...document.querySelectorAll('[role="option"]')].find((element) => element.textContent?.trim() === wanted) ?? null, { timeout: 5_000 }, words.groupings[grouping])
        .catch(() => {
          throw new Error(`no grouping "${words.groupings[grouping]}"`)
        })
      await press(option.asElement())
      await page.waitForFunction(() => !document.querySelector('[role="listbox"]'), { timeout: 5_000 })
      await page.waitForSelector('[data-testid="group-toggle"]', { visible: true, timeout: 10_000 })
      await delay(300)
      const headings = await page.$$eval('[data-testid="group-toggle"]', (toggles) =>
        toggles.map((toggle) => {
          const [name] = toggle.querySelectorAll('[data-cut-text]')
          const iban = toggle.querySelector('.font-mono[data-cut-text]')
          return {
            name: name?.textContent?.trim() ?? '',
            cut: name !== undefined && (name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1),
            ibanSize: iban === null ? null : getComputedStyle(iban).fontSize,
          }
        }),
      )
      if (headings.length === 0) throw new Error(`grouping ${grouping} shows no group`)
      const phone = await page.evaluate((below) => window.innerWidth < below, PHONE_BELOW)
      const cut = headings.filter((heading) => heading.cut)
      if (phone && cut.length > 0) throw new Error(`below 640 px grouping ${grouping} cuts the names ${JSON.stringify(cut.map((heading) => heading.name))}`)
      const wrongIban = headings.filter((heading) => heading.ibanSize !== null && heading.ibanSize !== '12px')
      if (wrongIban.length > 0) throw new Error(`a counterparty's IBAN is ${wrongIban[0].ibanSize}, not 12px`)
      await shootAt(page, shoot, '[data-testid="group-toggle"]', `transactions-group-${grouping}`)
    }
  }
}

/**
 * The specimen with a thumb: a long press on a cut text outside any control shows its full text and a tap elsewhere closes it,
 * while a long press on the cut text inside a link shows nothing and a tap on it opens the link.
 */
export async function cutTextTouchStep(page, shoot) {
  await page.waitForSelector(SPECIMEN, { visible: true, timeout: 10_000 })
  await page.$eval(SPECIMEN, (section) => section.scrollIntoView({ block: 'start' }))
  await delay(300)
  const pressOn = async (full, hold) => {
    const box = await (await specimenText(page, full)).boundingBox()
    await page.touchscreen.touchStart(box.x + box.width / 2, box.y + box.height / 2)
    await delay(hold)
    await page.touchscreen.touchEnd()
  }

  await pressOn(FULL_TEXTS.outside, 150)
  await waitForNoTooltip(page, 'a short tap on the cut text')
  await pressOn(FULL_TEXTS.outside, OPEN_DELAY + 200)
  await waitForTooltip(page, FULL_TEXTS.outside, 'a long press on the cut text')
  await shoot('cut-text-long-press')
  const heading = await page.$(`${SPECIMEN} h2`)
  const headingBox = await heading.boundingBox()
  await page.touchscreen.tap(headingBox.x + 4, headingBox.y + headingBox.height / 2)
  await waitForNoTooltip(page, 'a tap elsewhere')

  await pressOn(FULL_TEXTS.link, OPEN_DELAY + 200)
  await waitForNoTooltip(page, 'a long press on the cut text inside a link')
  const box = await (await specimenText(page, FULL_TEXTS.link)).boundingBox()
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
  await page
    .waitForFunction(() => window.location.hash.endsWith('#list-row'), { timeout: 5_000 })
    .catch(async () => {
      throw new Error(`a tap on the cut text inside a link did not open it, the address is ${await page.evaluate(() => window.location.hash)}`)
    })
}
