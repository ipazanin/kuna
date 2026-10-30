import { globSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')
const catalogue = readFileSync(join(root, '.agents/skills/kuna-design/components.md'), 'utf8')
const specimens = globSync(['src/shell/gallery/**/*.vue', 'src/apps/*/gallery/**/*.vue'], { cwd: root })
  .map((file) => readFileSync(join(root, file), 'utf8'))
  .join('\n')
const components = globSync('src/shared/ui/*.vue', { cwd: root }).map((file) => basename(file, '.vue'))

/** A component the gallery shows only inside the component that draws it. */
const SHOWN_THROUGH: Readonly<Record<string, string>> = { ChartCanvas: 'ChartCard' }

/** The areas whose files a catalogue row counts, by the column that holds the count. A gallery specimen is not a use. */
const AREAS: Readonly<Record<string, string>> = {
  Company: 'src/apps/company/**/*.vue',
  Loans: 'src/apps/loans/**/*.vue',
  Investments: 'src/apps/investments/**/*.vue',
  Shell: 'src/shell/**/*.vue',
  Shared: 'src/shared/**/*.vue',
}
const sources = Object.entries(AREAS).map(([area, pattern]) => ({
  area,
  files: globSync(pattern, { cwd: root })
    .filter((file) => !file.includes('/gallery/'))
    .map((file) => ({ path: file, name: basename(file, '.vue'), text: readFileSync(join(root, file), 'utf8') })),
}))

interface CatalogueRow {
  readonly name: string
  readonly usedBy: Readonly<Record<string, number>>
}

/** The rows of every catalogue table whose header starts with "Component", with the count of files each area column gives. */
function catalogueRows(markdown: string): CatalogueRow[] {
  let header: readonly string[] | null = null
  return markdown.split('\n').flatMap((line) => {
    if (!line.startsWith('|')) {
      header = null
      return []
    }
    const cells = line
      .split(/(?<!\\)\|/)
      .slice(1, -1)
      .map((cell) => cell.trim())
    if (cells[0] === 'Component') {
      header = cells
      return []
    }
    const name = /^`([A-Z]\w*)`$/.exec(cells[0] ?? '')?.[1]
    const columns = header
    if (columns === null || name === undefined) return []
    return [{ name, usedBy: Object.fromEntries(Object.keys(AREAS).map((area) => [area, Number(cells[columns.indexOf(area)])])) }]
  })
}

/** Whether the file imports the shared component, rather than one of its own app's that has the same name. */
function importsShared(file: { readonly path: string; readonly text: string }, name: string): boolean {
  const shared = join(root, 'src/shared/ui', `${name}.vue`)
  return [...file.text.matchAll(new RegExp(`from '([^']*/${name}\\.vue)'`, 'g'))].some((found) => resolve(join(root, dirname(file.path)), found[1]!) === shared)
}

/** How many files of each area render the shared component, leaving out the component's own file. */
function usesOf(name: string): Record<string, number> {
  const tag = new RegExp(`<${name}[\\s/>]`)
  return Object.fromEntries(sources.map(({ area, files }) => [area, files.filter((file) => file.name !== name && tag.test(file.text) && importsShared(file, name)).length]))
}

const rows = catalogueRows(catalogue)
const catalogued = rows.map((row) => row.name)

describe('design catalogue', () => {
  it.each(components)('lists %s in components.md', (name) => {
    expect(catalogued).toContain(name)
  })

  it.each(components)('shows %s in the gallery', (name) => {
    expect(specimens).toMatch(new RegExp(`<${SHOWN_THROUGH[name] ?? name}[\\s/>]`))
  })

  it.each(rows.map((row) => [row.name, row] as const))('counts the files that use %s', (name, row) => {
    expect(usesOf(name)).toEqual(row.usedBy)
  })

  it('lists only components that exist', () => {
    expect(catalogued.filter((name) => !components.includes(name))).toEqual([])
  })
})
