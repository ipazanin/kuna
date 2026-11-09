/** Whether each collapsible card is open is remembered on this device, under one key per screen and card. */

const KEY_PREFIX = 'kuna.card.'

/** What this device last chose for the card, or null when it chose nothing or storage is denied. */
export function storedCollapse(cardId: string): boolean | null {
  try {
    const stored = localStorage.getItem(`${KEY_PREFIX}${cardId}`)
    return stored === 'collapsed' ? true : stored === 'expanded' ? false : null
  } catch {
    return null
  }
}

export function rememberCollapse(cardId: string, collapsed: boolean): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${cardId}`, collapsed ? 'collapsed' : 'expanded')
  } catch {
    // Storage denied, as in some private windows. The card keeps its state until the page reloads.
  }
}

/** Each card this device keeps folded, by its id, or none when storage is denied. */
export function foldedCards(): readonly string[] {
  try {
    return Array.from({ length: localStorage.length }, (_, at) => localStorage.key(at) ?? '')
      .filter((key) => key.startsWith(KEY_PREFIX) && localStorage.getItem(key) === 'collapsed')
      .map((key) => key.slice(KEY_PREFIX.length))
      .sort()
  } catch {
    return []
  }
}
