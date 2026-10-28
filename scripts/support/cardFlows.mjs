/**
 * Collapse and expand on a screen's collapsible cards, shared by the visual and the touch check.
 * `press` clicks or taps an element handle. A failure throws with what was wrong.
 */

import { delay } from './editorFlows.mjs'

/** Reads one collapsible card as a reader meets it: its toggle, its body and what this device remembers. */
function cardState(card) {
  const toggle = card.querySelector('[data-testid="card-toggle"]')
  const body = toggle === null ? null : document.getElementById(toggle.getAttribute('aria-controls') ?? '')
  return {
    id: card.dataset.card ?? '',
    title: card.querySelector('h2, h3')?.textContent?.trim() ?? '',
    expanded: toggle?.getAttribute('aria-expanded') ?? null,
    bodyInsideCard: body !== null && card.contains(body),
    bodyShown: body !== null && getComputedStyle(body).display !== 'none',
    summary: card.querySelector('[data-testid="card-summary"]')?.textContent?.trim() ?? '',
    stored: localStorage.getItem(`kuna.card.${card.dataset.card}`),
  }
}

/**
 * Collapses the first open collapsible card with its header toggle, checks it shows its title and a
 * summary line and that the choice is remembered, then opens it again. A screen whose collapsible
 * cards all start collapsed has its first one opened first. `whileCollapsed` runs with the card
 * collapsed, for a screenshot. Returns the card's title.
 */
export async function collapseAndExpand(page, press, whileCollapsed = async () => {}) {
  const card = (await page.$('[data-card][data-collapsed="false"]')) ?? (await page.$('[data-card][data-collapsed="true"]'))
  if (card === null) throw new Error('no collapsible card on the screen')
  const toggle = await card.$('[data-testid="card-toggle"]')
  await toggle.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await delay(200)
  if ((await card.evaluate((element) => element.dataset.collapsed)) === 'true') {
    await press(toggle)
    await delay(200)
  }

  await press(toggle)
  await delay(200)
  const collapsed = await card.evaluate(cardState)
  if (!collapsed.bodyInsideCard) throw new Error(`"${collapsed.title}": the toggle's aria-controls names no body inside the card`)
  if (collapsed.expanded !== 'false' || collapsed.bodyShown) throw new Error(`"${collapsed.title}" did not collapse`)
  if (collapsed.summary === '') throw new Error(`"${collapsed.title}" shows no summary line when collapsed`)
  if (collapsed.stored !== 'collapsed') throw new Error(`"${collapsed.title}" did not remember it is collapsed under ${collapsed.id}`)
  await whileCollapsed(card, collapsed)

  await press(toggle)
  await delay(200)
  const expanded = await card.evaluate(cardState)
  if (expanded.expanded !== 'true' || !expanded.bodyShown) throw new Error(`"${expanded.title}" did not expand again`)
  if (expanded.stored !== 'expanded') throw new Error(`"${expanded.title}" did not remember it is open again`)
  return expanded.title
}
