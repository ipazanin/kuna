/** A stretch of a line: plain, bold, code, or the ref of a figure Kuna computed, as `f3`, which the screen shows in Kuna's own amount. */
export interface ChatInline {
  readonly kind: 'plain' | 'bold' | 'code' | 'figure'
  readonly text: string
}

/** A paragraph, or a list with one entry per item. */
export type ChatBlock = { readonly kind: 'paragraph'; readonly inlines: readonly ChatInline[] } | { readonly kind: 'list'; readonly items: readonly (readonly ChatInline[])[] }

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`/g
const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/
const FIGURE_REF = /\[(f\d+)\]/g

/** The stretch with each `[f3]` in it split out as a figure. */
function withFigures(kind: 'plain' | 'bold', text: string): readonly ChatInline[] {
  const inlines: ChatInline[] = []
  let at = 0
  for (const match of text.matchAll(FIGURE_REF)) {
    if (match.index > at) inlines.push({ kind, text: text.slice(at, match.index) })
    inlines.push({ kind: 'figure', text: match[1] ?? '' })
    at = match.index + match[0].length
  }
  if (at < text.length) inlines.push({ kind, text: text.slice(at) })
  return inlines
}

function inlinesOf(line: string): readonly ChatInline[] {
  const inlines: ChatInline[] = []
  let at = 0
  for (const match of line.matchAll(INLINE)) {
    if (match.index > at) inlines.push(...withFigures('plain', line.slice(at, match.index)))
    if (match[1] === undefined) inlines.push({ kind: 'code', text: match[2] ?? '' })
    else inlines.push(...withFigures('bold', match[1]))
    at = match.index + match[0].length
  }
  if (at < line.length) inlines.push(...withFigures('plain', line.slice(at)))
  return inlines
}

/** Reads a model's text into the few shapes a chat shows: paragraphs, lists, bold, code and figure refs. Anything else stays the text it is, so no link, picture or HTML can come of it. */
export function chatBlocksOf(text: string): readonly ChatBlock[] {
  const blocks: ChatBlock[] = []
  let items: (readonly ChatInline[])[] = []
  const endList = (): void => {
    if (items.length > 0) blocks.push({ kind: 'list', items })
    items = []
  }
  for (const line of text.split('\n')) {
    if (LIST_ITEM.test(line)) {
      items.push(inlinesOf(line.replace(LIST_ITEM, '')))
    } else {
      endList()
      if (line.trim() !== '') blocks.push({ kind: 'paragraph', inlines: inlinesOf(line) })
    }
  }
  endList()
  return blocks
}
