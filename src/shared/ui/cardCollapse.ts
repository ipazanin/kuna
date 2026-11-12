import { deviceChoice, keptKeys } from '../device/deviceChoice'

/** Whether each collapsible card is open is remembered on this device, under one key per screen and card. */

const KEY_PREFIX = 'kuna.card.'

function collapseOf(cardId: string) {
  return deviceChoice<boolean | null>(`${KEY_PREFIX}${cardId}`, null, {
    read: (stored) => (stored === 'collapsed' ? true : stored === 'expanded' ? false : null),
    write: (collapsed) => (collapsed ? 'collapsed' : 'expanded'),
  })
}

/** What this device last chose for the card, or null when it chose nothing or storage is denied. */
export function storedCollapse(cardId: string): boolean | null {
  return collapseOf(cardId).read()
}

/** Keeps the card's state on this device. Where storage is denied the card keeps it until the page reloads. */
export function rememberCollapse(cardId: string, collapsed: boolean): void {
  collapseOf(cardId).remember(collapsed)
}

/** Each card this device keeps folded, by its id, or none when storage is denied. */
export function foldedCards(): readonly string[] {
  return keptKeys(KEY_PREFIX)
    .map((key) => key.slice(KEY_PREFIX.length))
    .filter((cardId) => storedCollapse(cardId) === true)
    .sort()
}
