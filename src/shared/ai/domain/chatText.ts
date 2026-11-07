/** A stretch of a line: plain, bold or code. */
export interface ChatInline {
  readonly kind: 'plain' | 'bold' | 'code'
  readonly text: string
}

/** A paragraph, or a list with one entry per item. */
export type ChatBlock = { readonly kind: 'paragraph'; readonly inlines: readonly ChatInline[] } | { readonly kind: 'list'; readonly items: readonly (readonly ChatInline[])[] }

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`/g
const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/

function inlinesOf(line: string): readonly ChatInline[] {
  const inlines: ChatInline[] = []
  let at = 0
  for (const match of line.matchAll(INLINE)) {
    if (match.index > at) inlines.push({ kind: 'plain', text: line.slice(at, match.index) })
    inlines.push(match[1] === undefined ? { kind: 'code', text: match[2] ?? '' } : { kind: 'bold', text: match[1] })
    at = match.index + match[0].length
  }
  if (at < line.length) inlines.push({ kind: 'plain', text: line.slice(at) })
  return inlines
}

/** Reads a model's text into the few shapes a chat shows: paragraphs, lists, bold and code. Anything else stays the text it is, so no link, picture or HTML can come of it. */
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
