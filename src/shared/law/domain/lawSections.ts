import { parseCivilDate } from '../../calendar/civilDate'
import type { CivilDate } from '../../calendar/civilDate'

/** A file of `docs/law` an app rests on, by its name in the app's folder, such as `capital-gains`, read only when asked for. */
export interface LawSource {
  readonly name: string
  load(): Promise<string>
}

/** One heading of a law file with what it says up to the next heading of any level, outside fenced code. */
export interface LawSection {
  readonly heading: string
  /** 1 for the file's title, 2 for `##` and so on. */
  readonly depth: number
  readonly anchor: string
  readonly text: string
}

/** A law file as its frontmatter and headings give it. The first section is its title with the lines under it. */
export interface LawFile {
  readonly title: string
  /** The day its law was last verified. */
  readonly checked: CivilDate
  readonly summary: string
  readonly sections: readonly LawSection[]
}

/** The anchor GitHub gives a Markdown heading. */
export function anchorOf(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/
const HEADING = /^(#{1,6}) (.+)$/

function frontmatterValue(block: string, key: string): string | null {
  return new RegExp(`^${key}: (.+)$`, 'm').exec(block)?.[1]?.trim() ?? null
}

/** The headings of a Markdown text after any frontmatter, each with what it says up to the next heading, outside fenced code. Lines before the first heading are left out. */
export function sectionsOf(markdown: string): readonly LawSection[] {
  const sections: { heading: string; depth: number; lines: string[] }[] = []
  let fenced = false
  for (const line of markdown.replace(FRONTMATTER, '').split('\n')) {
    if (line.startsWith('```')) {
      fenced = !fenced
      continue
    }
    const heading = fenced ? null : HEADING.exec(line)
    if (heading !== null) sections.push({ heading: heading[2]!, depth: heading[1]!.length, lines: [] })
    else if (!fenced) sections.at(-1)?.lines.push(line)
  }
  return sections.map(({ heading, depth, lines }) => ({ heading, depth, anchor: anchorOf(heading), text: lines.join('\n').trim() }))
}

/** Reads a law file into its title, the day it was checked, its summary and its sections. Throws when the frontmatter or the title is missing, as `npm run law-index` does. */
export function lawFileOf(markdown: string): LawFile {
  const block = FRONTMATTER.exec(markdown)?.[1] ?? ''
  const checked = parseCivilDate(frontmatterValue(block, 'checked') ?? '')
  const summary = frontmatterValue(block, 'summary')
  const sections = sectionsOf(markdown)
  const [title] = sections
  if (checked === null || summary === null) throw new Error('A law file starts with frontmatter that gives the day it was checked and a summary.')
  if (title?.depth !== 1) throw new Error('A law file has a # title before its first section.')
  return { title: title.heading, checked, summary, sections }
}
