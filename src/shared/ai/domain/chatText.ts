/**
 * A stretch of a line: plain, bold, code, the ref of a figure Kuna computed, as `f3`, which the screen shows in Kuna's own
 * amount, or the ref of a law section a page handed out, as `law-1`, which the screen shows as its file, heading and day.
 */
export interface ChatInline {
  readonly kind: 'plain' | 'bold' | 'code' | 'figure' | 'citation'
  readonly text: string
}

/** A paragraph, or a list with one entry per item. */
export type ChatTextBlock = { readonly kind: 'paragraph'; readonly inlines: readonly ChatInline[] } | { readonly kind: 'list'; readonly items: readonly (readonly ChatInline[])[] }

/** A run of blocks, set apart as the model's own knowledge when its lines start with `>`. */
export interface ChatBlock {
  readonly ownKnowledge: boolean
  readonly blocks: readonly ChatTextBlock[]
}

const INLINE = /\*\*([^*]+)\*\*|`([^`]+)`/g
const LIST_ITEM = /^\s*(?:[-*]|\d+\.)\s+/
const QUOTED = /^\s*>\s?/
const REF = /\[(f\d+|law-\d+)\]/g

/** The stretch with each `[f3]` in it split out as a figure, and each `[law-1]` as a citation, which sits against the word before it. */
function withRefs(kind: 'plain' | 'bold', text: string): readonly ChatInline[] {
  const inlines: ChatInline[] = []
  let at = 0
  for (const match of text.matchAll(REF)) {
    const ref = match[1] ?? ''
    const citation = ref.startsWith('law-')
    const before = citation ? text.slice(at, match.index).trimEnd() : text.slice(at, match.index)
    if (before !== '') inlines.push({ kind, text: before })
    inlines.push({ kind: citation ? 'citation' : 'figure', text: ref })
    at = match.index + match[0].length
  }
  if (at < text.length) inlines.push({ kind, text: text.slice(at) })
  return inlines
}

function inlinesOf(line: string): readonly ChatInline[] {
  const inlines: ChatInline[] = []
  let at = 0
  for (const match of line.matchAll(INLINE)) {
    if (match.index > at) inlines.push(...withRefs('plain', line.slice(at, match.index)))
    if (match[1] === undefined) inlines.push({ kind: 'code', text: match[2] ?? '' })
    else inlines.push(...withRefs('bold', match[1]))
    at = match.index + match[0].length
  }
  if (at < line.length) inlines.push(...withRefs('plain', line.slice(at)))
  return inlines
}

function textBlocksOf(lines: readonly string[]): readonly ChatTextBlock[] {
  const blocks: ChatTextBlock[] = []
  let items: (readonly ChatInline[])[] = []
  const endList = (): void => {
    if (items.length > 0) blocks.push({ kind: 'list', items })
    items = []
  }
  for (const line of lines) {
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

/**
 * Reads a text into the few shapes a chat shows: paragraphs, lists, bold, code, figure refs and citations. With `asides`, as in a
 * model's answer, lines that start with `>` go apart as its own knowledge. Anything else stays the text it is, so no link,
 * picture or HTML can come of it.
 */
export function chatBlocksOf(text: string, asides = false): readonly ChatBlock[] {
  const runs: { ownKnowledge: boolean; lines: string[] }[] = []
  for (const line of text.split('\n')) {
    // A blank line stays with the run before it, so two quoted paragraphs make one aside.
    const ownKnowledge = line.trim() === '' ? (runs.at(-1)?.ownKnowledge ?? false) : asides && QUOTED.test(line)
    if (runs.at(-1)?.ownKnowledge !== ownKnowledge) runs.push({ ownKnowledge, lines: [] })
    runs.at(-1)!.lines.push(ownKnowledge ? line.replace(QUOTED, '') : line)
  }
  return runs.map(({ ownKnowledge, lines }) => ({ ownKnowledge, blocks: textBlocksOf(lines) })).filter((run) => run.blocks.length > 0)
}
