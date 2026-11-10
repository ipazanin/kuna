import { forgetAssist, keepAiKey } from './chatFlows.mjs'
import { delay, pressSelector } from './pressing.mjs'

/** Opens each card, unless it is open. */
function openCards(cards) {
  return async (page, press) => {
    for (const card of cards) {
      const toggle = await page.waitForSelector(`[data-card="${card}"] [data-testid="card-toggle"]`, { timeout: 10_000 })
      if ((await toggle.evaluate((element) => element.getAttribute('aria-expanded'))) === 'false') {
        await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
        await delay(200)
        await press(toggle)
        await delay(300)
      }
    }
  }
}

/** The width from which a side-by-side table holds an amount and its ask on one line, the `@4xl` container query on the table. */
const ROOMY_TABLE = 56 * 16
/** Below this width the comparison is a card for each scenario and has no table. */
const NARROW_TABLE = 768

/**
 * Where each page shows a build-up amount with its ask: the element that takes the highlight, the shape it takes, and for
 * the comparison table the container whose width decides whether the cells have asks. The first is the one the flow asks about.
 */
export const FIGURE_ASKS = {
  owner: {
    figures: [
      { at: '[data-testid="owner-benefits-dividend"] [data-figure-ask]', shape: 'row' },
      { at: '[data-testid="owner-net-with-profit"][data-figure-ask]', shape: 'card' },
    ],
  },
  salaries: {
    figures: [
      { at: '[data-testid="salaries-reconciliation"] [data-figure-ask]', shape: 'row' },
      { at: '[data-testid="salaries-problems"] [data-figure-ask]', shape: 'row' },
    ],
  },
  pay: {
    figures: [
      { at: '[data-testid="marginal-euro"] [data-figure-ask]', shape: 'row' },
      { at: '[data-testid="scenario-comparison"] [data-line="net-salary"] [data-figure-ask]', shape: 'row', roomIn: '[data-testid="scenario-comparison"] table' },
    ],
    before: openCards(['year.comparison', 'year.marginal']),
  },
  'open-items': {
    figures: [{ at: '[data-testid="open-items"] [data-figure-ask]', shape: 'row' }],
    before: openCards(['year.open-items']),
  },
}

/**
 * A page's build-up amounts with a made-up key kept: each has Ask the chat beside it, which opens the chat with the figure
 * as its tag. A cell of the side-by-side table has it only while the table has room for both on one line, and the cards drawn below 768 px have none. Beside a docked
 * chat the row takes the highlight, and removing the tag takes it off.
 */
export function figureAskFlowIn(language, screen) {
  const { figures, before } = FIGURE_ASKS[screen]
  return async (page, { press, shoot: shootAs, inspect }) => {
    const shoot = (name) => shootAs(language === 'en' ? name : `${name}-${language}`)
    const [{ at: asked, shape }] = figures
    const askButton = `${asked} [data-testid="ask-chat"]`
    try {
      await keepAiKey(page)
      await before?.(page, press)
      for (const { at, roomIn } of figures) {
        if (roomIn !== undefined && (await page.evaluate(() => window.innerWidth)) < NARROW_TABLE) continue
        await page.waitForSelector(at, { timeout: 10_000 }).catch(() => {
          throw new Error(`no build-up amount at ${at}`)
        })
        const roomy = roomIn === undefined || (await page.$eval(roomIn, (element) => element.getBoundingClientRect().width)) >= ROOMY_TABLE
        const shown = await page.$eval(`${at} [data-testid="ask-chat"]`, (element) => element.getClientRects().length > 0).catch(() => false)
        if (roomy && !shown) throw new Error(`the build-up amount at ${at} has no Ask the chat beside it`)
        if (!roomy && shown) throw new Error(`the build-up amount at ${at} shows Ask the chat in a table with no room for it beside the amount`)
        if (shown) {
          const [amount, ask] = await page.$eval(at, (element) =>
            [element.querySelector('[data-testid="build-up-button"], button:not([data-testid="ask-chat"])'), element.querySelector('[data-testid="ask-chat"]')].map(
              (part) => part?.getBoundingClientRect().top ?? 0,
            ),
          )
          if (roomIn !== undefined && Math.abs(amount - ask) > 12) throw new Error(`the ask at ${at} sits under its amount, not beside it`)
        }
      }
      await page.$eval(asked, (element) => element.scrollIntoView({ block: 'center' }))
      await delay(300)
      await inspect?.(`the asks beside the build-up amounts on ${screen}`)
      await shoot(`${screen}-figure-ask`)

      const named = await page.$eval(askButton, (element) => element.getAttribute('aria-label') ?? '')
      if (/\d[.,]\d{2}\b/.test(named)) throw new Error(`the ask's name holds an amount: ${named}`)
      await pressSelector(page, press, askButton)
      await page.waitForSelector('[data-testid="chat-panel"]', { visible: true, timeout: 10_000 })
      const tag = await page.waitForSelector('[data-testid="chat-tag"]', { visible: true, timeout: 10_000 }).catch(() => {
        throw new Error('the chat opened with no tag for the figure')
      })
      const tagged = (await tag.evaluate((element) => element.textContent ?? '')).trim()
      if (tagged === '' || !named.includes(tagged)) throw new Error(`the chat's tag "${tagged}" is not the figure the ask names: ${named}`)
      // Below the dock's width the chat takes the page's place, so the highlight shows only beside a docked chat.
      const docked = await page.evaluate((selector) => (document.querySelector(selector)?.getClientRects().length ?? 0) > 0, asked)
      if (docked) {
        const marked = await page.$eval(asked, (element) => element.getAttribute('data-chat-tagged'))
        if (marked !== shape) throw new Error(`the asked figure is highlighted as ${marked}, not as a ${shape}`)
        await page.$eval(asked, (element) => element.scrollIntoView({ block: 'center' }))
        await delay(200)
      }
      await inspect?.(`the chat about a build-up on ${screen}`)
      await shoot(`${screen}-figure-asked`)

      await pressSelector(page, press, '[data-testid="chat-tag-remove"]')
      await page.waitForSelector('[data-testid="chat-tag"]', { hidden: true, timeout: 5_000 })
      if (docked && (await page.$eval(asked, (element) => element.getAttribute('data-chat-tagged'))) !== null) throw new Error('the highlight stayed after the tag went')
    } finally {
      await forgetAssist(page)
    }
  }
}
