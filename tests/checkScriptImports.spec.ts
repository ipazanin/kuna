import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { en as homeEnglish, hr as homeCroatian } from '../src/shell/home/words'
import { en as settingsEnglish, hr as settingsCroatian } from '../src/shell/settings/words'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SCRIPTS = join(ROOT, 'scripts')
const SUPPORT = join(SCRIPTS, 'support')

/** The loader that lets a script import TypeScript. Importing it here would register its hooks inside the test run. */
const LOADER = 'typescriptResolve.mjs'

interface NamedImport {
  /** The importing script and line, such as `scripts/visual-check.mjs:461`. */
  readonly at: string
  readonly target: string
  /** The names it takes, with `default` for a default import. */
  readonly names: readonly string[]
}

const checkScripts = [
  ...readdirSync(SCRIPTS)
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => join(SCRIPTS, name)),
  ...readdirSync(SUPPORT)
    .filter((name) => name.endsWith('.mjs'))
    .map((name) => join(SUPPORT, name)),
]

/** Every relative import declaration of a check script, with the names it takes from the module. */
function relativeImports(path: string): readonly NamedImport[] {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.JS)
  return source.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return []
    const specifier = statement.moduleSpecifier.text
    if (!specifier.startsWith('.')) return []
    const clause = statement.importClause
    const bindings = clause?.namedBindings
    const names = [
      ...(clause?.name === undefined ? [] : ['default']),
      ...(bindings !== undefined && ts.isNamedImports(bindings) ? bindings.elements.map((element) => (element.propertyName ?? element.name).text) : []),
    ]
    const line = source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1
    return [{ at: `${relative(ROOT, path)}:${line}`, target: resolve(dirname(path), specifier), names }]
  })
}

/** The screen titles a check script reads from the words modules, so a rename reaches every check and a typo fails to compile. */
const TITLES_FROM_WORDS = [homeEnglish.title, homeCroatian.title, settingsEnglish.menu, settingsCroatian.menu]

/** Each line of a check script that spells one of those titles by hand where a screen's title goes: a `title:`, a title waited for, or the title after a hash. */
function spelledTitles(path: string): readonly string[] {
  const titles = TITLES_FROM_WORDS.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const spelled = new RegExp(`(title: |Title\\([^)]*|'#/[^']*', )'(${titles})'`)
  return readFileSync(path, 'utf8')
    .split('\n')
    .flatMap((line, index) => (spelled.test(line) ? [`${relative(ROOT, path)}:${index + 1}`] : []))
}

describe('check scripts', () => {
  it('read the titles of Home and Kuna settings from the words modules', () => {
    expect(checkScripts.flatMap(spelledTitles)).toEqual([])
  })

  it('import only files that exist', () => {
    const missing = checkScripts.flatMap(relativeImports).filter((imported) => !existsSync(imported.target))
    expect(missing.map((imported) => `${imported.at} imports ${relative(ROOT, imported.target)}`)).toEqual([])
  })

  it.each(checkScripts.filter((path) => path.startsWith(SUPPORT) && !path.endsWith(LOADER)).map((path) => relative(ROOT, path)))('%s loads', { timeout: 60_000 }, async (path) => {
    await expect(import(/* @vite-ignore */ pathToFileURL(join(ROOT, path)).href)).resolves.toBeDefined()
  })

  it('take only names their modules export', { timeout: 60_000 }, async () => {
    const imports = checkScripts.flatMap(relativeImports).filter((imported) => imported.names.length > 0 && existsSync(imported.target))
    const unexported: string[] = []
    for (const { at, target, names } of imports) {
      const module = (await import(/* @vite-ignore */ pathToFileURL(target).href)) as Record<string, unknown>
      unexported.push(...names.filter((name) => !(name in module)).map((name) => `${at} takes ${name} from ${relative(ROOT, target)}`))
    }
    expect(unexported).toEqual([])
  })
})
