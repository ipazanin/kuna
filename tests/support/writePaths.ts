import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** The verbs of a record kind's writes, as `unit.of(KIND_WRITES).add(...)` calls them. */
const VERBS = new Set(['add', 'change', 'remove'])

/** The workbook store's members that act on the file as a whole, which a screen calls on the store it is handed. */
export const FILE_ACTIONS = ['sync', 'chooseDriveFile', 'folderBesideFile', 'moveIntoKuna', 'keepOnDrive', 'dropWorkbook', 'trashBackups', 'replaceLocalWorkbook', 'recordExport'] as const

/**
 * The store's members that change nothing a person chose, by reading, by writing records through a `UnitOfWork` whose record writes the scan
 * reads from the callback, or by following another tab.
 */
export const NOT_FILE_ACTIONS = [
  'state',
  'open',
  'canSyncSilently',
  'pickDriveFolder',
  'driveHomeOfApp',
  'hasKunaFolder',
  'planMoveIntoKuna',
  'driveFilePlace',
  'backupsOnDrive',
  'forgottenElsewhere',
  'chosenElsewhere',
  'write',
  'check',
  'undo',
  'settled',
] as const

const FILE_ACTION_NAMES = new Set<string>(FILE_ACTIONS)

/** A top-level declaration of a file, as `src/a/b.ts#name`. */
type SymbolKey = string

export interface Script {
  readonly source: ts.SourceFile
  /** The line of the file the script's first line is on. */
  readonly firstLine: number
}

export interface Module {
  readonly file: string
  readonly scripts: readonly Script[]
  /** A single-file component's template, which names imports too. */
  readonly template: { readonly text: string; readonly firstLine: number } | null
  /** Each imported name, by its local name, with the file it comes from, or null for a package. */
  readonly imports: ReadonlyMap<string, { readonly file: string | null; readonly name: string }>
  /** Each name the file exports from another file. */
  readonly reExports: ReadonlyMap<string, { readonly file: string; readonly name: string }>
  readonly starExports: readonly string[]
  /** Each top-level declaration, with the script it is in. */
  readonly declarations: ReadonlyMap<string, readonly { readonly node: ts.Node; readonly script: Script }[]>
}

/** One place code names something that writes, as `file:line`. */
export interface Site {
  readonly at: string
}

/**
 * What a screen writes through. It is a write function outside the screens, such as `src/apps/assets/asset/application/assetWrites.ts#removeAsset`,
 * or a record kind's writes with its verb, such as `src/apps/assets/asset/application/assetWrites.ts#ASSET_WRITES.add`, or with none when the
 * kind's writes are handed on whole. It can also be a screen's own device write, named by the screen file and the function that sets the browser key.
 * A path through shared code or a store's file action starts with the app whose screen names it, or `shared` for a shared screen, as
 * `company: store.dropWorkbook` does.
 */
export type WritePath = string

function sourceFiles(): string[] {
  return readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.(ts|vue)$/.test(name) && !name.endsWith('.d.ts'))
    .map((name) => join('src', name))
}

function resolvedFile(directory: string, specifier: string): string {
  const base = resolve(directory, specifier)
  const found = [base, `${base}.ts`, `${base}.vue`, join(base, 'index.ts')].find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
  return relative(ROOT, found ?? base)
}

function moduleOf(file: string): Module {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const blocks = file.endsWith('.vue') ? parse(text, { filename: file }).descriptor : null
  const scripts: Script[] =
    blocks === null
      ? [{ source: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true), firstLine: 1 }]
      : [blocks.script, blocks.scriptSetup].flatMap((block) =>
          block === null ? [] : [{ source: ts.createSourceFile(file, block.content, ts.ScriptTarget.Latest, true), firstLine: block.loc.start.line }],
        )
  const imports = new Map<string, { file: string | null; name: string }>()
  const reExports = new Map<string, { file: string; name: string }>()
  const starExports: string[] = []
  const declarations = new Map<string, { node: ts.Node; script: Script }[]>()
  const declare = (name: string, node: ts.Node, script: Script) => declarations.set(name, [...(declarations.get(name) ?? []), { node, script }])
  const fileOf = (specifier: string) => (specifier.startsWith('.') ? resolvedFile(dirname(join(ROOT, file)), specifier) : null)
  for (const script of scripts) {
    for (const statement of script.source.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
        const from = fileOf(statement.moduleSpecifier.text)
        const clause = statement.importClause
        if (clause?.name !== undefined) imports.set(clause.name.text, { file: from, name: 'default' })
        const bindings = clause?.namedBindings
        if (bindings !== undefined && ts.isNamedImports(bindings)) {
          bindings.elements.forEach((element) => imports.set(element.name.text, { file: from, name: (element.propertyName ?? element.name).text }))
        }
      } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)) {
        const from = fileOf(statement.moduleSpecifier.text)
        if (from === null) continue
        const clause = statement.exportClause
        if (clause === undefined) starExports.push(from)
        else if (ts.isNamedExports(clause)) clause.elements.forEach((element) => reExports.set(element.name.text, { file: from, name: (element.propertyName ?? element.name).text }))
      } else if (ts.isVariableStatement(statement)) {
        statement.declarationList.declarations.forEach((declaration) => {
          if (ts.isIdentifier(declaration.name)) declare(declaration.name.text, declaration, script)
        })
      } else if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name !== undefined) {
        declare(statement.name.text, statement, script)
      }
    }
  }
  scripts.forEach((script) => dynamicImports(script.source).forEach(({ local, specifier, name }) => imports.set(local, { file: fileOf(specifier), name })))
  const template = blocks?.template === null || blocks?.template === undefined ? null : { text: blocks.template.content, firstLine: blocks.template.loc.start.line }
  return { file, scripts, template, imports, reExports, starExports, declarations }
}

/** Each name bound from an `import()`, as `const { a } = await import('./x')` or `const [{ a }, { b }] = await Promise.all([import('./x'), import('./y')])` bind them. */
function dynamicImports(source: ts.SourceFile): { readonly local: string; readonly specifier: string; readonly name: string }[] {
  const found: { local: string; specifier: string; name: string }[] = []
  const specifierOf = (node: ts.Expression): string | null =>
    ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] !== undefined && ts.isStringLiteral(node.arguments[0]) ? node.arguments[0].text : null
  const bind = (pattern: ts.BindingName, specifier: string | null) => {
    if (specifier === null || !ts.isObjectBindingPattern(pattern)) return
    pattern.elements.forEach((element) => {
      if (ts.isIdentifier(element.name)) found.push({ local: element.name.text, specifier, name: (element.propertyName ?? element.name).getText(source) })
    })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.initializer !== undefined && ts.isAwaitExpression(node.initializer)) {
      const awaited = node.initializer.expression
      if (ts.isObjectBindingPattern(node.name)) bind(node.name, specifierOf(awaited))
      const list = ts.isCallExpression(awaited) && awaited.expression.getText(source) === 'Promise.all' ? awaited.arguments[0] : undefined
      if (ts.isArrayBindingPattern(node.name) && list !== undefined && ts.isArrayLiteralExpression(list)) {
        node.name.elements.forEach((element, index) => {
          const loaded = list.elements[index]
          if (ts.isBindingElement(element) && loaded !== undefined) bind(element.name, specifierOf(loaded))
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** Whether a declaration is a record kind's write rules, typed `WriteRules<...>` or made by `settingWrites`. */
function isWriteRules(node: ts.Node): boolean {
  if (!ts.isVariableDeclaration(node)) return false
  if (node.type !== undefined && ts.isTypeReferenceNode(node.type) && node.type.typeName.getText() === 'WriteRules') return true
  return node.initializer !== undefined && ts.isCallExpression(node.initializer) && node.initializer.expression.getText() === 'settingWrites'
}

/** What a stretch of code names that writes: each symbol it names, a record kind's writes with the verb, and a store's file action. */
interface Named {
  readonly symbols: { readonly key: SymbolKey; readonly at: string; readonly verb: string | null }[]
  readonly fileActions: { readonly name: string; readonly at: string }[]
  /** Lines that set or clear something this browser keeps. */
  readonly deviceWrites: string[]
}

/** The program's files and what each top-level declaration names and writes, read once. */
export interface WriteGraph {
  readonly modules: ReadonlyMap<string, Module>
  /** Where a name a file imports or exports is declared. */
  declaredAt(file: string, name: string): SymbolKey | null
  named(key: SymbolKey): Named
  /** What one stretch of a file's code names. */
  namedIn(module: Module, script: Script, node: ts.Node): Named
  isWriteRules(key: SymbolKey): boolean
  /** Whether running the declaration may write: it names a record kind's writes, a file action, a device write or a download, or names a declaration that does. */
  writes(key: SymbolKey): boolean
}

export function writeGraph(): WriteGraph {
  const modules = new Map(sourceFiles().map((file) => [file, moduleOf(file)]))
  const declaredCache = new Map<string, SymbolKey | null>()
  const declaredAt = (file: string, name: string, seen: ReadonlySet<string> = new Set()): SymbolKey | null => {
    const asked = `${file}#${name}`
    if (declaredCache.has(asked)) return declaredCache.get(asked)!
    const module = modules.get(file)
    if (module === undefined || seen.has(asked)) return null
    const next = new Set([...seen, asked])
    const reExported = module.reExports.get(name)
    const imported = module.imports.get(name)
    const found = module.declarations.has(name)
      ? asked
      : reExported !== undefined
        ? declaredAt(reExported.file, reExported.name, next)
        : imported !== undefined && imported.file !== null && name !== 'default'
          ? declaredAt(imported.file, imported.name, next)
          : (module.starExports.map((star) => declaredAt(star, name, next)).find((key) => key !== null) ?? null)
    declaredCache.set(asked, found)
    return found
  }
  const writeRulesKeys = new Set(
    [...modules.values()].flatMap((module) => [...module.declarations].filter(([, found]) => found.some(({ node }) => isWriteRules(node))).map(([name]) => `${module.file}#${name}`)),
  )
  const namedIn = (module: Module, script: Script, node: ts.Node, into: Named = { symbols: [], fileActions: [], deviceWrites: [] }): Named => {
    const at = (inner: ts.Node) => `${module.file}:${script.firstLine + script.source.getLineAndCharacterOfPosition(inner.getStart(script.source)).line}`
    const visit = (inner: ts.Node): void => {
      if (ts.isIdentifier(inner) && !isOnlyAName(inner)) {
        const key = module.declarations.has(inner.text) ? `${module.file}#${inner.text}` : module.imports.has(inner.text) ? symbolOfImport(module, inner.text) : null
        if (key !== null && !isWriteRulesRead(inner, key)) into.symbols.push({ key, at: at(inner), verb: writeRulesKeys.has(key) ? verbOf(inner) : null })
      }
      if (ts.isPropertyAccessExpression(inner) && ts.isCallExpression(inner.parent) && inner.parent.expression === inner) {
        const name = inner.name.text
        if (FILE_ACTION_NAMES.has(name)) into.fileActions.push({ name, at: at(inner) })
        if ((name === 'setItem' || name === 'removeItem') && inner.expression.getText(script.source) === 'localStorage') into.deviceWrites.push(at(inner))
      }
      ts.forEachChild(inner, visit)
    }
    visit(node)
    return into
  }
  const symbolOfImport = (module: Module, local: string): SymbolKey | null => {
    const imported = module.imports.get(local)!
    return imported.file === null ? null : declaredAt(imported.file, imported.name)
  }
  // A kind's write rules write when a call takes them, as `unit.of(KIND_WRITES)` or `replaceRows(unit, KIND_WRITES, ...)` do, or when a field
  // hands them on, as `{ rules: KIND_WRITES }` does for code that calls `unit.of(kind.rules)`. Listed in a pack's kinds or read for their
  // `kind`, they write nothing.
  const isWriteRulesRead = (identifier: ts.Identifier, key: SymbolKey): boolean =>
    writeRulesKeys.has(key) &&
    !(ts.isCallExpression(identifier.parent) && identifier.parent.arguments.includes(identifier)) &&
    !(ts.isPropertyAssignment(identifier.parent) && identifier.parent.initializer === identifier)
  const namedCache = new Map<SymbolKey, Named>()
  const named = (key: SymbolKey): Named => {
    const cached = namedCache.get(key)
    if (cached !== undefined) return cached
    const [file, name] = key.split('#') as [string, string]
    const module = modules.get(file)!
    const found: Named = { symbols: [], fileActions: [], deviceWrites: [] }
    namedCache.set(key, found)
    module.declarations.get(name)?.forEach(({ node, script }) => namedIn(module, script, node, found))
    return found
  }
  const writesCache = new Map<SymbolKey, boolean>()
  const writes = (key: SymbolKey): boolean => {
    const cached = writesCache.get(key)
    if (cached !== undefined) return cached
    writesCache.set(key, false)
    if (OPAQUE.has(key)) return false
    const found = named(key)
    const result =
      writeRulesKeys.has(key) ||
      key === DOWNLOAD ||
      found.fileActions.length > 0 ||
      found.deviceWrites.length > 0 ||
      found.symbols.some((symbol) => symbol.key !== key && (writeRulesKeys.has(symbol.key) || writes(symbol.key)))
    writesCache.set(key, result)
    return result
  }
  return {
    modules,
    declaredAt: (file, name) => declaredAt(file, name),
    named,
    namedIn: (module, script, node) => namedIn(module, script, node),
    isWriteRules: (key) => writeRulesKeys.has(key),
    writes,
  }
}

/**
 * Where the scan stops. Making a store writes nothing a person chose, and what a screen does with the store is its record writes and the
 * file actions it calls on it, which the scan reads at the screen.
 */
const OPAQUE: ReadonlySet<SymbolKey> = new Set([
  'src/shared/storage/application/createWorkbookStore.ts#createWorkbookStore',
  'src/shared/storage/infrastructure/pageWorkbookStore.ts#pageWorkbookStore',
  // A token for a Google call keeps what Google granted. Asking for access is a path of its own, `requestAccess`.
  'src/shared/google/googleAuth.ts#tokenFor',
])

/** The shared function that hands the browser a file to save. */
export const DOWNLOAD: SymbolKey = 'src/shared/files/downloadFile.ts#downloadFile'

/** A name that is a property, a member or the name a declaration gives, rather than a use of something in scope. */
function isOnlyAName(identifier: ts.Identifier): boolean {
  const parent = identifier.parent
  if (ts.isPropertyAccessExpression(parent) && parent.name === identifier) return true
  if ((ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) && parent.name === identifier) return true
  if ((ts.isVariableDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isParameter(parent) || ts.isBindingElement(parent)) && parent.name === identifier) return true
  return ts.isImportSpecifier(parent) || ts.isImportClause(parent) || ts.isExportSpecifier(parent)
}

/** The verb of `unit.of(KIND_WRITES).add(...)`, or null when the kind's writes are handed on whole. */
function verbOf(identifier: ts.Identifier): string | null {
  const call = identifier.parent
  if (!ts.isCallExpression(call) || !ts.isPropertyAccessExpression(call.expression) || call.expression.name.text !== 'of') return null
  const member = call.parent
  return ts.isPropertyAccessExpression(member) && member.expression === call && VERBS.has(member.name.text) ? member.name.text : null
}

/** Whether a file is a screen: a component or presentation code of an app, Kuna's shell or the shared screens, but not the chat or a gallery. */
export function isScreenFile(file: string): boolean {
  if (/\/(assistant|gallery)\//.test(file) || file.startsWith('src/shared/ai/')) return false
  if (!/^src\/(apps|shell|shared)\//.test(file)) return false
  return file.endsWith('.vue') || file.includes('/presentation/')
}

/** Whether a file holds the chat's operations, whose plans are what the chat can write. */
export function isOperationsFile(file: string): boolean {
  return file.includes('/assistant/operations/') || file === 'src/shell/assistant/kunaOperations.ts'
}

/** Where every screen writes, by path, with each place a screen names it. */
export function screenWrites(graph: WriteGraph): ReadonlyMap<WritePath, readonly Site[]> {
  const paths = new Map<WritePath, Site[]>()
  const add = (path: WritePath, at: string) => paths.set(path, [...(paths.get(path) ?? []), { at }])
  for (const module of [...graph.modules.values()].filter((found) => isScreenFile(found.file))) {
    const named: Named = { symbols: [], fileActions: [], deviceWrites: [] }
    const deviceWrites: { readonly owner: string; readonly at: string }[] = []
    for (const script of module.scripts) {
      for (const statement of script.source.statements) {
        const before = named.deviceWrites.length
        namedInStatement(graph, module, script, statement, named)
        named.deviceWrites.slice(before).forEach((at) => deviceWrites.push({ owner: ownerOf(statement), at }))
      }
    }
    templateNames(module).forEach(({ local, at }) => {
      const key = graph.declaredAt(module.file, local)
      if (key !== null) named.symbols.push({ key, at, verb: null })
    })
    const app = appOf(module.file)
    const sharedPath = (path: string) => `${app}: ${path}`
    for (const symbol of named.symbols) {
      const file = symbol.key.split('#')[0]!
      if (isScreenFile(file)) continue
      const path = graph.isWriteRules(symbol.key) ? (symbol.verb === null ? symbol.key : `${symbol.key}.${symbol.verb}`) : graph.writes(symbol.key) ? symbol.key : null
      if (path !== null) add(appOf(file) === SHARED ? sharedPath(path) : path, symbol.at)
    }
    named.fileActions.forEach(({ name, at }) => add(sharedPath(`store.${name}`), at))
    deviceWrites.forEach(({ owner, at }) => add(`${module.file}#${owner}`, at))
  }
  return paths
}

/** What the chat's operations of one app reach: every declaration their files name, through every declaration those name, with each record kind's verbs. */
export interface ChatReach {
  readonly symbols: ReadonlySet<SymbolKey>
  /** Each record kind's writes reached, with its verbs, or `*` when handed on whole. */
  readonly verbs: ReadonlyMap<SymbolKey, ReadonlySet<string>>
  readonly fileActions: ReadonlySet<string>
  /** The declarations reached only because an operation runs the page's sync, which the chat runs as a whole and never calls one by one. */
  readonly ranBySync: ReadonlySet<SymbolKey>
}

/** Code shared by every app, and the shared screens every app shows. */
export const SHARED = 'shared'

/** The app a file belongs to, `kuna` for Kuna's shell, or `shared`. */
export function appOf(file: string): string {
  const app = /^src\/apps\/([^/]+)\//.exec(file)?.[1]
  return app ?? (file.startsWith('src/shell/') ? 'kuna' : SHARED)
}

/** What each app's operations reach, from its operations files and from the ports its `app.ts` hands their proposer, by the app's id. */
export function chatReach(graph: WriteGraph): ReadonlyMap<string, ChatReach> {
  interface Walk {
    readonly symbols: Set<SymbolKey>
    readonly verbs: Map<SymbolKey, Set<string>>
    readonly fileActions: Set<string>
    readonly pending: SymbolKey[]
  }
  const reaches = new Map<string, Walk>()
  const reachOf = (app: string): Walk => {
    const held: Walk = reaches.get(app) ?? { symbols: new Set(), verbs: new Map(), fileActions: new Set(), pending: [] }
    reaches.set(app, held)
    return held
  }
  const take = (app: string, named: Named) => {
    const reach = reachOf(app)
    named.fileActions.forEach(({ name }) => reach.fileActions.add(name))
    for (const symbol of named.symbols) {
      if (graph.isWriteRules(symbol.key)) reach.verbs.set(symbol.key, new Set([...(reach.verbs.get(symbol.key) ?? []), symbol.verb ?? '*']))
      if (!reach.symbols.has(symbol.key)) {
        reach.symbols.add(symbol.key)
        reach.pending.push(symbol.key)
      }
    }
  }
  for (const module of [...graph.modules.values()].filter((found) => isOperationsFile(found.file))) {
    const named: Named = { symbols: [], fileActions: [], deviceWrites: [] }
    module.scripts.forEach((script) => script.source.statements.forEach((statement) => namedInStatement(graph, module, script, statement, named)))
    take(appOf(module.file), named)
  }
  for (const module of graph.modules.values()) {
    for (const script of module.scripts) {
      wiringCalls(graph, module, script).forEach((call) => call.arguments.forEach((argument) => take(appOf(module.file), wiredNames(graph, module, script, argument, new Set()))))
    }
  }
  const walkPending = (): void => {
    for (const [app, reach] of reaches) {
      while (reach.pending.length > 0) {
        const key = reach.pending.pop()!
        if (!isScreenFile(key.split('#')[0]!) && !OPAQUE.has(key)) take(app, graph.named(key))
      }
    }
  }
  walkPending()
  const beforeSync = new Map([...reaches].map(([app, reach]) => [app, new Set(reach.symbols)]))
  const syncRun = pageSyncRun(graph)
  // The page's sync reads each app's books again, so an operation that runs it runs each app's `store.sync`.
  if ([...reaches.values()].some((reach) => reach.symbols.has(PAGE_SYNC))) syncGroupApps(graph).forEach((app) => reachOf(app).fileActions.add('sync'))
  for (const [app, reach] of reaches) {
    if (!reach.symbols.has(PAGE_SYNC)) continue
    const queue = syncRun.symbols.map((symbol) => symbol.key)
    const walked = new Set<SymbolKey>()
    take(app, syncRun)
    while (queue.length > 0) {
      const key = queue.pop()!
      if (walked.has(key) || OPAQUE.has(key) || !graph.modules.has(key.split('#')[0]!)) continue
      walked.add(key)
      const named = graph.named(key)
      take(app, named)
      queue.push(...named.symbols.map((symbol) => symbol.key))
    }
  }
  walkPending()
  return new Map([...reaches].map(([app, { symbols, verbs, fileActions }]) => [app, { symbols, verbs, fileActions, ranBySync: new Set([...symbols].filter((key) => !beforeSync.get(app)!.has(key))) }]))
}

/** The page's one sync, which an operation runs once it names it. */
const PAGE_SYNC: SymbolKey = 'src/shared/sync/presentation/pageSync.ts#usePageSync'

/** The read of an app's books, which the page's sync runs before the app's own steps. */
const BOOKS_STEP_RUN: SymbolKey = 'src/shared/sync/presentation/pageSync.ts#booksStep'

/**
 * What a run of the page's sync names: the read of each app's books, and the `steps` each app's sync group lists, as the `syncGroup` of its
 * `app.ts` names the group. The rest of a group, such as its export control and its Undo, is not the run's. An operation that runs the sync
 * reaches what these name through screen code too, since an app builds its steps in its presentation code.
 */
function pageSyncRun(graph: WriteGraph): Named {
  const run: Named = { symbols: [], fileActions: [], deviceWrites: [] }
  const books = graph.named(BOOKS_STEP_RUN)
  run.symbols.push(...books.symbols)
  run.fileActions.push(...books.fileActions)
  for (const module of [...graph.modules.values()].filter((found) => /^src\/apps\/[^/]+\/app\.ts$/.test(found.file))) {
    for (const script of module.scripts) {
      const visit = (node: ts.Node): void => {
        if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === 'syncGroup' && ts.isIdentifier(node.initializer)) {
          const group = graph.declaredAt(module.file, node.initializer.text)
          const declared = group === null ? undefined : graph.modules.get(group.split('#')[0]!)
          declared?.declarations.get(group!.split('#')[1]!)?.forEach(({ node: declaration, script: groupScript }) => {
            const steps = stepsOfGroup(declaration)
            if (steps === null) return
            const named = wiredNames(graph, declared, groupScript, steps, new Set())
            run.symbols.push(...named.symbols)
            run.fileActions.push(...named.fileActions)
          })
        }
        ts.forEachChild(node, visit)
      }
      visit(script.source)
    }
  }
  return run
}

/** The apps whose `app.ts` hands the page's sync a group. */
function syncGroupApps(graph: WriteGraph): string[] {
  return [...graph.modules.values()]
    .filter((module) => /^src\/apps\/[^/]+\/app\.ts$/.test(module.file) && module.scripts.some((script) => /\bsyncGroup:/.test(script.source.text)))
    .map((module) => appOf(module.file))
}

/** The `steps` member of the object a sync group function returns, or null. */
function stepsOfGroup(declaration: ts.Node): ts.Expression | null {
  let steps: ts.Expression | null = null
  const visit = (node: ts.Node): void => {
    if (ts.isReturnStatement(node) && node.expression !== undefined && ts.isObjectLiteralExpression(node.expression)) {
      const member = node.expression.properties.find((property) => ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && property.name.text === 'steps')
      if (member !== undefined && ts.isPropertyAssignment(member)) steps = member.initializer
    }
    ts.forEachChild(node, visit)
  }
  visit(declaration)
  return steps
}

/** Each call that hands an app's ports to the chat's proposer or acceptance, such as `companyProposer(store, ports)` in `app.ts`. */
function wiringCalls(graph: WriteGraph, module: Module, script: Script): ts.CallExpression[] {
  const calls: ts.CallExpression[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /(Proposer|Acceptance)$/.test(node.expression.text) && module.imports.has(node.expression.text)) {
      const key = graph.declaredAt(module.file, node.expression.text)
      if (key !== null && isOperationsFile(key.split('#')[0]!)) calls.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(script.source)
  return calls
}

/**
 * What a stretch of wiring names, following each local it names to the local's value, as `const ports = { ... }` before the call. A screen's
 * function handed on as a port, such as `give: confirmHistoryComplete`, is what the port writes, so what it names counts. A screen's composable
 * the wiring calls, such as `usePrices()`, only builds the port, and the chat reaches what the port's members do through the operations.
 */
function wiredNames(graph: WriteGraph, module: Module, script: Script, node: ts.Node, seen: Set<ts.Node>): Named {
  const found = graph.namedIn(module, script, node)
  const handed = found.symbols.filter(({ key }) => isScreenFile(key.split('#')[0]!) && !calledIn(node, key.split('#')[1]!))
  handed.forEach(({ key }) => {
    const named = graph.named(key)
    found.symbols.push(...named.symbols)
    found.fileActions.push(...named.fileActions)
  })
  const visit = (inner: ts.Node): void => {
    if (ts.isIdentifier(inner) && !isOnlyAName(inner) && !module.declarations.has(inner.text) && !module.imports.has(inner.text)) {
      const local = localValue(inner)
      if (local !== null && !seen.has(local)) {
        seen.add(local)
        const named = wiredNames(graph, module, script, local, seen)
        found.symbols.push(...named.symbols)
        found.fileActions.push(...named.fileActions)
      }
    }
    ts.forEachChild(inner, visit)
  }
  visit(node)
  return found
}

/** Whether the stretch of code calls a function by this name, rather than handing it on. */
function calledIn(node: ts.Node, name: string): boolean {
  let called = false
  const visit = (inner: ts.Node): void => {
    if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === name) called = true
    ts.forEachChild(inner, visit)
  }
  visit(node)
  return called
}

/** The value of the local a name stands for, declared in a block around it, or null. */
function localValue(identifier: ts.Identifier): ts.Node | null {
  for (let scope: ts.Node | undefined = identifier.parent; scope !== undefined; scope = scope.parent) {
    if (!ts.isBlock(scope)) continue
    for (const statement of scope.statements) {
      if (!ts.isVariableStatement(statement)) continue
      const declaration = statement.declarationList.declarations.find((candidate) => ts.isIdentifier(candidate.name) && candidate.name.text === identifier.text)
      if (declaration?.initializer !== undefined) return declaration.initializer
    }
  }
  return null
}

/**
 * Whether the chat reaches a path a screen writes through. A path through shared code, such as `investments: src/shared/...`, counts only
 * when that app's operations reach it, and one on a shared screen when any app's do. A write function the chat does not name is still reached
 * when it writes nothing itself and only goes through write functions and file actions the chat reaches, as `deleteRule` goes through `writeRules`. A helper its
 * file keeps to itself does not carry that on, and neither does a function the chat reaches only by running the page's sync.
 */
export function chatCovers(graph: WriteGraph, reaches: ReadonlyMap<string, ChatReach>, path: WritePath): boolean {
  const scoped = /^([a-z-]+): (.*)$/.exec(path)
  const app = scoped?.[1] ?? SHARED
  const within = app === SHARED ? [...reaches.values()] : [reaches.get(app)].filter((reach) => reach !== undefined)
  return within.some((reach) => reachedBy(graph, reach, scoped?.[2] ?? path, new Set()))
}

function reachedBy(graph: WriteGraph, reach: ChatReach, path: string, seen: ReadonlySet<string>): boolean {
  if (path.startsWith('store.')) return reach.fileActions.has(path.slice('store.'.length))
  const verb = /^(.*#[A-Z_]+)\.(add|change|remove)$/.exec(path)
  if (verb !== null) {
    const reached = reach.verbs.get(verb[1]!)
    return reached !== undefined && (reached.has(verb[2]!) || reached.has('*'))
  }
  if (reach.symbols.has(path) || reach.verbs.has(path)) return seen.size === 0 || !reach.ranBySync.has(path)
  if (seen.has(path) || graph.isWriteRules(path) || !graph.modules.has(path.split('#')[0]!)) return false
  const named = graph.named(path)
  const writing = named.symbols.filter((symbol) => symbol.key !== path && graph.writes(symbol.key))
  if (named.fileActions.some((action) => !reach.fileActions.has(action.name)) || named.deviceWrites.length > 0) return false
  if ((writing.length === 0 && named.fileActions.length === 0) || writing.some((symbol) => graph.isWriteRules(symbol.key) || !isExported(graph, symbol.key))) return false
  return writing.every((symbol) => reachedBy(graph, reach, symbol.key, new Set([...seen, path])))
}

/** Whether a declaration is exported. One its file keeps to itself, such as a helper that sets a browser key, is that file's own way to write. */
function isExported(graph: WriteGraph, key: SymbolKey): boolean {
  const [file, name] = key.split('#') as [string, string]
  return (graph.modules.get(file)?.declarations.get(name) ?? []).some(({ node }) => {
    const statement = ts.isVariableDeclaration(node) ? node.parent.parent : node
    return ts.canHaveModifiers(statement) && (ts.getModifiers(statement) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  })
}

function namedInStatement(graph: WriteGraph, module: Module, script: Script, statement: ts.Statement, into: Named): void {
  if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) return
  const found = graph.namedIn(module, script, statement)
  into.symbols.push(...found.symbols)
  into.fileActions.push(...found.fileActions)
  into.deviceWrites.push(...found.deviceWrites)
}

/** The name a top-level statement declares, or `(top level)` for one that declares none. */
function ownerOf(statement: ts.Statement): string {
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name !== undefined) return statement.name.text
  if (ts.isVariableStatement(statement)) {
    const first = statement.declarationList.declarations[0]
    if (first !== undefined && ts.isIdentifier(first.name)) return first.name.text
  }
  return '(top level)'
}

/** Each name a component's template uses that its script imports, with the first line that uses it. */
function templateNames(module: Module): { readonly local: string; readonly at: string }[] {
  if (module.template === null) return []
  const locals = [...module.imports.keys()]
  const lines = module.template.text.split('\n')
  return locals.flatMap((local) => {
    const pattern = new RegExp(`(?<![\\w.$-])${local.replace(/\$/g, '\\$')}(?![\\w$-])`)
    const index = lines.findIndex((line) => pattern.test(line))
    return index === -1 ? [] : [{ local, at: `${module.file}:${module.template!.firstLine + index}` }]
  })
}
