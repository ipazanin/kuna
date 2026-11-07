import type { Recipe, RecipeMisfit, SourceRow, SourceRows } from '../domain/recipe'

export type RecipeFileReading = { readonly kind: 'read'; readonly rows: SourceRows } | { readonly kind: 'misfit'; readonly misfit: RecipeMisfit }

/** The attachment names a recipe's format can be, by their ending. */
const ENDINGS: Readonly<Record<Recipe['file']['format'], RegExp>> = { xml: /\.xml$/i }

export function fileNameFits(recipe: Pick<Recipe, 'file'>, name: string): boolean {
  return ENDINGS[recipe.file.format].test(name)
}

/** Each row under a section's elements as its attributes, wherever those section elements sit below the root. A section with no element is absent, and an empty one has no rows. */
function xmlRows(recipe: Recipe, root: Element): SourceRows {
  const rows = new Map<string, readonly SourceRow[]>()
  for (const section of recipe.sections) {
    const [container = '', element = ''] = section.rows.split('/')
    const containers = [...root.getElementsByTagName(container)]
    if (containers.length === 0) continue
    const rowElements = containers.flatMap((found) => [...found.children].filter((child) => child.tagName === element))
    rows.set(
      section.name,
      rowElements.map((rowElement) => new Map([...rowElement.attributes].map((attribute) => [attribute.name, attribute.value]))),
    )
  }
  return rows
}

/** A file's rows by the recipe's sections, or why it is not that kind of file. Whether the rows fit is the recipe run's question. */
export function readRecipeFile(recipe: Recipe, bytes: ArrayBuffer): RecipeFileReading {
  const document = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml')
  if (document.getElementsByTagName('parsererror').length > 0) return { kind: 'misfit', misfit: { kind: 'not-readable' } }
  if (document.documentElement.tagName !== recipe.file.root) return { kind: 'misfit', misfit: { kind: 'no-root', root: recipe.file.root } }
  return { kind: 'read', rows: xmlRows(recipe, document.documentElement) }
}
