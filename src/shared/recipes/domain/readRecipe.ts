import type { Recipe, RecipeField, RecipeFields, RecipeFile, RecipeSection, RowKind, RowTest } from './recipe'

type Shape = Readonly<Record<string, unknown>>

function isShape(value: unknown): value is Shape {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string'
}

function isTexts(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isText)
}

function listOf<Item>(value: unknown, read: (item: unknown) => Item | null): readonly Item[] | null {
  if (!Array.isArray(value)) return null
  const items = value.map(read)
  return items.every((item) => item !== null) ? (items as Item[]) : null
}

function rowTestOf(value: unknown): RowTest | null {
  if (!isShape(value) || !isText(value.column) || value.column.trim() === '') return null
  const { column } = value
  if (isTexts(value.is) && (value.anyCase === undefined || value.anyCase === true)) return value.anyCase === true ? { column, is: value.is, anyCase: true } : { column, is: value.is }
  if (isTexts(value.partsWithin) && isText(value.separator) && value.separator !== '') return { column, partsWithin: value.partsWithin, separator: value.separator }
  if (value.sign === 'above-zero' || value.sign === 'below-zero') return { column, sign: value.sign }
  if (value.filled === true) return { column, filled: true }
  return null
}

function fieldOf(value: unknown): RecipeField | null {
  if (!isShape(value) || !isText(value.from) || value.from.trim() === '' || (value.blank !== undefined && value.blank !== true)) return null
  const { from } = value
  const blank = value.blank === true ? { blank: true as const } : {}
  switch (value.as) {
    case 'text':
      return { from, as: 'text', ...blank }
    case 'decimal':
      if (value.mark !== undefined && value.mark !== 'comma' && value.mark !== 'point') return null
      return { from, as: 'decimal', ...blank, ...(value.mark === undefined ? {} : { mark: value.mark }) }
    case 'currency': {
      const part = value.part
      if (part === undefined) return { from, as: 'currency', ...blank }
      if (!isShape(part) || !isText(part.separator) || part.separator === '' || !Number.isInteger(part.at) || (part.at as number) < 0) return null
      return { from, as: 'currency', ...blank, part: { separator: part.separator, at: part.at as number } }
    }
    case 'date':
    case 'time':
      return isTexts(value.formats) && value.formats.length > 0 ? { from, as: value.as, formats: value.formats, ...blank } : null
    default:
      return null
  }
}

function fieldsOf(value: unknown): RecipeFields | null {
  if (!isShape(value)) return null
  const fields: [string, RecipeField][] = []
  for (const [name, stored] of Object.entries(value)) {
    const field = fieldOf(stored)
    if (field === null) return null
    fields.push([name, field])
  }
  return Object.fromEntries(fields)
}

function kindOf(value: unknown): RowKind | null {
  if (!isShape(value) || !isText(value.kind) || value.kind.trim() === '') return null
  const when = listOf(value.when, rowTestOf)
  const fields = fieldsOf(value.fields ?? {})
  return when === null || fields === null ? null : { kind: value.kind, when, fields }
}

function sectionOf(value: unknown): RecipeSection | null {
  if (!isShape(value) || !isText(value.name) || value.name.trim() === '' || !isText(value.rows) || !isTexts(value.shown ?? [])) return null
  const keep = listOf(value.keep ?? [], rowTestOf)
  const fields = fieldsOf(value.fields ?? {})
  const kinds = listOf(value.kinds, kindOf)
  if (keep === null || fields === null || kinds === null || kinds.length === 0) return null
  if ((value.within !== undefined && (!isText(value.within) || value.within.trim() === '')) || (value.cells !== undefined && value.cells !== 'elements')) return null
  const within = value.within === undefined ? {} : { within: value.within }
  const cells = value.cells === undefined ? {} : { cells: 'elements' as const }
  return { name: value.name, rows: value.rows, ...within, ...cells, keep, shown: (value.shown as readonly string[] | undefined) ?? [], fields, kinds }
}

/** Whether each section a section sits within comes before it, so a file's rows are read in one pass. */
function withinEarlier(sections: readonly RecipeSection[]): boolean {
  return sections.every((section, at) => section.within === undefined || sections.slice(0, at).some((earlier) => earlier.name === section.within))
}

/**
 * A recipe a record or the chat holds, from its file format and its sections written as JSON, or null for anything Kuna could
 * not run: text that is not JSON, a test, a field or a kind of a shape it does not know, a section with no kind, a section
 * within one that does not come before it, and a table file with other than one section. A recipe read here runs as one Kuna brings does.
 */
export function readRecipe(id: string, name: string, file: RecipeFile, sectionsJson: string): Recipe | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(sectionsJson)
  } catch {
    return null
  }
  const sections = listOf(parsed, sectionOf)
  if (sections === null || sections.length === 0 || (file.format === 'table' && sections.length !== 1) || !withinEarlier(sections)) return null
  return { id, name, file, sections }
}
