/**
 * Runs the specs that cover the changed files: every spec that imports a changed file directly or through other files,
 * every spec that names a changed file's path, and the specs that read the whole tree when a file is added, moved or
 * renamed or when a shared file changes. CI runs the full suite, so this is the local run. It prints the vitest filter it
 * ran, which is what a report names.
 *   npm run test:changed                     the working tree against HEAD, untracked files included
 *   npm run test:changed -- --base main      everything since main, such as a lane's work
 *   npm run test:changed -- --list           print the filter without running it
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const { values } = parseArgs({ options: { base: { type: 'string', default: 'HEAD' }, list: { type: 'boolean' } } })

/** The specs that read the whole source tree or the docs instead of importing what they check, so no import leads to them. */
const TREE_SPECS = ['importBoundaries', 'designCatalogue', 'machinePaths', 'docsIndex', 'uiImports', 'checkScriptImports', 'chatCatalogue', 'dialogErrors', 'appOrder']

/** Paths whose change can break a tree spec without adding or moving a file. */
const TREE_PATHS = [/^src\/shared\/ui\//, /words\.ts$/, /^docs\//, /^\.agents\/skills\/kuna-design\//, /^scripts\/lint-baseline\.json$/, /^src\/shell\/gallery\//]

const SOURCE_ENDINGS = ['.ts', '.mjs', '.js', '.vue']

function git(...args) {
  const run = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
  if (run.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${run.stderr}`)
  return run.stdout.split('\n').filter((line) => line !== '')
}

/** Each changed path with whether it was added, deleted or renamed, which is what the tree specs care about. */
function changes() {
  const listed = git('diff', '--name-status', '--find-renames', values.base).map((line) => {
    const [status, ...paths] = line.split('\t')
    return { path: paths.at(-1), moved: /^[ADR]/.test(status), gone: status.startsWith('D') }
  })
  const untracked = git('ls-files', '--others', '--exclude-standard').map((path) => ({ path, moved: true, gone: false }))
  return [...listed, ...untracked]
}

function filesUnder(folder) {
  const full = join(ROOT, folder)
  if (!existsSync(full)) return []
  return readdirSync(full, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && SOURCE_ENDINGS.some((ending) => entry.name.endsWith(ending)))
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)))
}

/** The repository path a relative import points at, trying the endings an import may leave out. */
function resolvedImport(from, specifier) {
  const target = join(dirname(from), specifier)
  const candidates = [target, ...SOURCE_ENDINGS.map((ending) => target + ending), ...SOURCE_ENDINGS.map((ending) => join(target, 'index' + ending))]
  return candidates.find((candidate) => existsSync(join(ROOT, candidate)) && statSync(join(ROOT, candidate)).isFile()) ?? null
}

/** For each file, the files that import it, read from relative import and export specifiers. */
function importersByFile(files) {
  const importers = new Map()
  const specifiers = /(?:from\s+|import\s*\(\s*|import\s+)['"](\.{1,2}\/[^'"]+)['"]/g
  for (const file of files) {
    for (const match of readFileSync(join(ROOT, file), 'utf8').matchAll(specifiers)) {
      const target = resolvedImport(file, match[1])
      if (target === null) continue
      if (!importers.has(target)) importers.set(target, new Set())
      importers.get(target).add(file)
    }
  }
  return importers
}

const changed = changes()
const files = [...filesUnder('src'), ...filesUnder('scripts'), ...filesUnder('tests')]
const importers = importersByFile(files)
const specs = new Set()

const waiting = changed.filter((change) => !change.gone).map((change) => change.path)
const seen = new Set(waiting)
while (waiting.length > 0) {
  const file = waiting.pop()
  if (file.endsWith('.spec.ts')) specs.add(file)
  for (const importer of importers.get(file) ?? []) {
    if (seen.has(importer)) continue
    seen.add(importer)
    waiting.push(importer)
  }
}

const specFiles = files.filter((file) => file.endsWith('.spec.ts'))
for (const spec of specFiles) {
  const text = readFileSync(join(ROOT, spec), 'utf8')
  if (changed.some((change) => text.includes(change.path))) specs.add(spec)
}

const touchesTree = changed.some((change) => change.moved || TREE_PATHS.some((pattern) => pattern.test(change.path)))
if (touchesTree) for (const name of TREE_SPECS) specs.add(`tests/${name}.spec.ts`)

const filter = [...specs].filter((spec) => existsSync(join(ROOT, spec))).sort()
if (filter.length === 0) {
  console.log(`No spec covers the ${changed.length} changed file(s) against ${values.base}.`)
  process.exit(0)
}
console.log(`npx vitest run ${filter.join(' ')}`)
if (values.list) process.exit(0)
const run = spawnSync('npx', ['vitest', 'run', ...filter], { cwd: ROOT, stdio: 'inherit' })
process.exit(run.status ?? 1)
