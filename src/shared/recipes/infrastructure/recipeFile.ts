import { decodedText } from '../../text/decodedText'
import { readFirstSheetCells } from '../../xlsx/sheetGrids'
import { sectionColumns } from '../domain/recipe'
import type { Recipe, RecipeFileReading, RecipeSection, SourceRow, SourceRows, XmlFile } from '../domain/recipe'

/** The attachment names a recipe's format can be, by their ending. */
const ENDINGS: Readonly<Record<Recipe['file']['format'], RegExp>> = { xml: /\.xml$/i, table: /\.(csv|xlsx|xls|ods)$/i }

export function fileNameFits(recipe: Pick<Recipe, 'file'>, name: string): boolean {
  return ENDINGS[recipe.file.format].test(name)
}

function childrenNamed(element: Element, name: string): Element[] {
  return [...element.children].filter((child) => child.localName === name)
}

/** A column of a section that reads elements, as `RecipeSection.cells` says. */
function elementCell(row: Element, column: string): string {
  const at = column.indexOf('@')
  const path = at < 0 ? column : column.slice(0, at)
  const steps = path === '' ? [] : path.split('/')
  const last = steps.at(-1)
  const joins = at < 0 && last !== undefined && last.endsWith('*')
  const reached = (joins ? steps.slice(0, -1) : steps).reduce<Element | null>((current, step) => (current === null ? null : (childrenNamed(current, step)[0] ?? null)), row)
  if (reached === null) return ''
  if (joins) {
    return childrenNamed(reached, last.slice(0, -1))
      .map((line) => (line.textContent ?? '').trim())
      .filter((line) => line !== '')
      .join(' ')
  }
  return at < 0 ? (reached.textContent ?? '').trim() : (reached.getAttribute(column.slice(at + 1)) ?? '').trim()
}

function rowOf(section: RecipeSection, element: Element): SourceRow {
  if (section.cells !== 'elements') return new Map([...element.attributes].map((attribute) => [attribute.name, attribute.value]))
  return new Map([...new Set([...sectionColumns(section), ...section.shown])].map((column) => [column, elementCell(element, column)]))
}

/**
 * Each row of a section, wherever its section elements sit below the root, or under each row of the section it sits within.
 * A section with no element is absent, and an empty one has no rows. Elements are matched by their local name, so a file
 * whose elements carry a namespace prefix reads the same.
 */
function xmlRows(recipe: Recipe<XmlFile>, root: Element): { readonly rows: SourceRows; readonly parents: ReadonlyMap<string, readonly number[]> } {
  const rows = new Map<string, readonly SourceRow[]>()
  const parents = new Map<string, readonly number[]>()
  const elements = new Map<string, readonly Element[]>()
  for (const section of recipe.sections) {
    let found: { readonly element: Element; readonly parent: number }[]
    if (section.within === undefined) {
      const [container = '', element = ''] = section.rows.split('/')
      const containers = [...root.getElementsByTagNameNS('*', container)]
      if (containers.length === 0) continue
      found = containers.flatMap((holder) => childrenNamed(holder, element).map((child) => ({ element: child, parent: 0 })))
    } else {
      const holders = elements.get(section.within)
      if (holders === undefined) continue
      found = holders.flatMap((holder, parent) => childrenNamed(holder, section.rows).map((child) => ({ element: child, parent })))
      parents.set(
        section.name,
        found.map(({ parent }) => parent),
      )
    }
    elements.set(
      section.name,
      found.map(({ element }) => element),
    )
    rows.set(
      section.name,
      found.map(({ element }) => rowOf(section, element)),
    )
  }
  return { rows, parents }
}

/** An XML file's rows by the recipe's sections, or why it is not that kind of file. Whether the rows fit is the recipe run's question. */
export function readRecipeFile(recipe: Recipe<XmlFile>, bytes: ArrayBuffer): RecipeFileReading {
  const document = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml')
  if (document.getElementsByTagName('parsererror').length > 0) return { kind: 'misfit', misfit: { kind: 'not-readable' } }
  return readRecipeDocument(recipe, document)
}

/** An XML document's rows by the recipe's sections, as `readRecipeFile` reads them from a file already parsed. */
export function readRecipeDocument(recipe: Recipe<XmlFile>, document: Document): RecipeFileReading {
  if (document.documentElement.localName !== recipe.file.root) return { kind: 'misfit', misfit: { kind: 'no-root', root: recipe.file.root } }
  return { kind: 'read', ...xmlRows(recipe, document.documentElement) }
}

/** A table file's first sheet as text for `tableRows`: a csv or txt decoded by what its bytes are, anything else read by SheetJS. */
export async function tableFileCells(fileName: string, bytes: ArrayBuffer): Promise<string[][]> {
  return readFirstSheetCells(/\.(csv|txt)$/i.test(fileName) ? decodedText(bytes) : bytes)
}
