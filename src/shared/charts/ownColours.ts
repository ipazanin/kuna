import { darkStepOf, swatchToken } from './swatches'
import type { Swatch } from './swatches'

/** The own colours already set on the page, by token. */
const defined = new Set<string>()
let sheet: CSSStyleSheet | null = null

function ownColourSheet(): CSSStyleSheet {
  if (sheet === null) {
    const element = document.createElement('style')
    element.dataset.ownColours = ''
    document.head.append(element)
    sheet = element.sheet!
  }
  return sheet
}

/**
 * The token a swatch paints with. An own colour has no line in tokens.css, so the first ask sets its light step and the
 * dark step worked out from it on the page, where `var()` and a chart's `tokenColour` read them as any other token.
 */
export function paintToken(swatch: Swatch): string {
  const token = swatchToken(swatch)
  if (swatch.own && !defined.has(token) && typeof document !== 'undefined') {
    const rules = ownColourSheet()
    rules.insertRule(`:root { ${token}: ${swatch.hex}; }`, rules.cssRules.length)
    rules.insertRule(`.dark { ${token}: ${darkStepOf(swatch.hex)}; }`, rules.cssRules.length)
    defined.add(token)
  }
  return token
}
