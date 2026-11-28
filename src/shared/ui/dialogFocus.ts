/** A control that can take focus: enabled, and not taken out of the tab order. */
export const FOCUSABLE = ':is(input, button, select, textarea, a[href], [tabindex]):not([disabled], [tabindex="-1"])'

/** The element that holds focus and the elements it sits in, nearest first, up to the body. */
export function focusPathOf(focused: Element | null): readonly Element[] {
  const path: Element[] = []
  for (let at = focused; at !== null && at !== at.ownerDocument.body; at = at.parentElement) path.push(at)
  return path
}

/**
 * Focuses the first element of the path that can take focus, or else the first control that can inside the nearest element still on the page.
 * Returns false when none can. A disabled or hidden control refuses focus, so the next one is tried.
 */
export function focusNearest(path: readonly Element[]): boolean {
  for (const around of path) {
    if (!around.isConnected) continue
    const candidates = around.matches(FOCUSABLE) ? [around] : around.querySelectorAll(FOCUSABLE)
    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) continue
      candidate.focus({ preventScroll: true })
      if (candidate.ownerDocument.activeElement === candidate) return true
    }
  }
  return false
}
