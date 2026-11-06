/**
 * Finds text drawn over other text and labels cut down to a stub, on whatever the page shows now, an
 * open menu or dialog included. It measures the text itself with `Range.getClientRects`, since an
 * element's box says nothing about the text that spills out of it. Text meant to stack is a named
 * entry of `TEXT_OVERLAP_ALLOWED`, and nothing else gets through.
 */

/** What may overlap or be cut, each with why. An entry covers a text that sits inside its selector. */
export const TEXT_OVERLAP_ALLOWED = []

/** Runs in the page. Each overlap of more than `slack` px each way and each cut label, as a sentence. */
function textOverlapsOnScreen(allowedSelectors, slack) {
  const allowed = (element) => allowedSelectors.some((selector) => element.closest(selector) !== null)
  const clips = (overflow) => overflow === 'hidden' || overflow === 'clip'
  const quoted = (text) => {
    const line = text.replace(/\s+/g, ' ').trim()
    return `"${line.length > 48 ? `${line.slice(0, 48)}…` : line}"`
  }

  /** Whether the text is shown at all: visible, not see-through, and in no script, field or list a browser draws itself. */
  function drawn(parent) {
    if (parent.closest('script, style, noscript, template, select, textarea') !== null) return false
    const style = getComputedStyle(parent)
    if (style.visibility !== 'visible' || style.color === 'rgba(0, 0, 0, 0)') return false
    for (let element = parent; element !== null; element = element.parentElement) {
      if (getComputedStyle(element).opacity === '0') return false
    }
    return true
  }

  function cropped(rect, box) {
    const left = Math.max(rect.left, box.left)
    const right = Math.min(rect.right, box.right)
    const top = Math.max(rect.top, box.top)
    const bottom = Math.min(rect.bottom, box.bottom)
    return { left, right: Math.max(left, right), top, bottom: Math.max(top, bottom) }
  }

  /**
   * The boxes that crop a text, nearest first, and the fixed or sticky box it moves with, since a layer
   * like that passes over the text under it by design. A positioned box escapes the crop of what sits
   * between it and the box it is placed against.
   */
  function surroundings(parent) {
    const croppers = []
    let element = parent
    let escapes = false
    while (element !== null && element !== document.body) {
      const style = getComputedStyle(element)
      if (style.position === 'fixed' || style.position === 'sticky') return { croppers, layer: element }
      if (!(escapes && style.position === 'static') && style.overflowX !== 'visible') {
        croppers.push({ box: element.getBoundingClientRect(), style, sideways: clips(style.overflowX), own: element === parent })
      }
      if (!(escapes && style.position === 'static')) escapes = style.position === 'absolute'
      element = element.parentElement
    }
    return { croppers, layer: document.body }
  }

  /** Whether a text cropped by this box says so: an ellipsis with room for a letter or two beside it, or a line clamp. */
  function sayItIsCut(cropper) {
    if (cropper.style.webkitLineClamp !== 'none') return true
    return cropper.style.textOverflow === 'ellipsis' && cropper.box.width >= 3 * parseFloat(cropper.style.fontSize)
  }

  const boxes = []
  const problems = new Set()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const parent = node.parentElement
    if (parent === null || node.textContent.trim() === '' || !drawn(parent)) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    const lines = [...range.getClientRects()].filter((line) => line.width > 0 && line.height > 0)
    if (lines.length === 0) continue
    const { croppers, layer } = surroundings(parent)
    // Text for a screen reader sits in a box of one pixel, and a collapsed box shows nothing.
    if (croppers.some((cropper) => cropper.sideways && (cropper.box.width <= 1 || cropper.box.height <= 1))) continue
    const isAllowed = allowed(parent)
    let whole = 0
    let shown = 0
    for (const line of lines) {
      // A box that only hides overflow without saying so, around its own text, does not hide that text from the overlap rule.
      const seen = croppers.filter((cropper) => !(cropper.own && cropper.sideways && !sayItIsCut(cropper))).reduce((rect, cropper) => cropped(rect, cropper.box), cropped(line, line))
      const hidden = croppers.filter((cropper) => cropper.sideways).reduce((rect, cropper) => cropped(rect, cropper.box), cropped(line, line))
      if (hidden.bottom - hidden.top > 1) {
        whole += line.width
        shown += hidden.right - hidden.left
      }
      if (seen.right - seen.left > 1 && seen.bottom - seen.top > 1) boxes.push({ ...seen, node, parent, layer, isAllowed })
    }
    const cutBy = croppers.find((cropper) => cropper.sideways)
    if (!isAllowed && shown > 1 && shown < whole / 2 && cutBy !== undefined && !sayItIsCut(cutBy)) {
      problems.add(`the label ${quoted(node.textContent)} shows ${Math.round(shown)} of its ${Math.round(whole)} px, with no ellipsis`)
    }
  }

  boxes.sort((first, second) => first.top - second.top)
  for (const [index, box] of boxes.entries()) {
    for (let later = index + 1; later < boxes.length; later++) {
      const other = boxes[later]
      if (other.top >= box.bottom - slack) break
      if (other.node === box.node || other.layer !== box.layer || box.isAllowed || other.isAllowed) continue
      const across = Math.min(box.right, other.right) - Math.max(box.left, other.left)
      const down = Math.min(box.bottom, other.bottom) - other.top
      if (across > slack && down > slack) {
        problems.add(`the text ${quoted(box.node.textContent)} overlaps ${quoted(other.node.textContent)} by ${Math.round(across)} x ${Math.round(down)} px`)
      }
    }
  }
  return [...problems]
}

/** Each overlap and each cut label on the page now, as a sentence. */
export function textOverlapsOn(page) {
  const selectors = TEXT_OVERLAP_ALLOWED.map((entry) => entry.selector)
  return page.evaluate(textOverlapsOnScreen, selectors, 2)
}
