import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { parse } from 'vue/compiler-sfc'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

interface Import {
  /** The importing file and line, such as `src/main.ts:7`. */
  readonly at: string
  readonly from: string
  readonly specifier: string
  /** The imported file from the repo root, or null for a package. */
  readonly target: string | null
  /** An `import()` call rather than a declaration. */
  readonly dynamic: boolean
}

/** Every import in `src`, with type-only ones, `export ... from` and dynamic imports, each relative one resolved to its file. */
function importsInSource(): Import[] {
  const files = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' }).filter((name) => /\.(ts|vue)$/.test(name))
  return files.flatMap((name) => {
    const path = join(ROOT, 'src', name)
    const from = relative(ROOT, path)
    return scriptsOf(path).flatMap(({ code, firstLine }) =>
      ts.preProcessFile(code, true, true).importedFiles.map((imported) => ({
        at: `${from}:${firstLine + code.slice(0, imported.pos).split('\n').length - 1}`,
        from,
        specifier: imported.fileName,
        target: imported.fileName.startsWith('.') ? resolvedFile(dirname(path), imported.fileName) : null,
        dynamic: /\bimport\s*\(\s*$/.test(code.slice(0, imported.pos)),
      })),
    )
  })
}

/** The code of a file, or of each script block of a single-file component, with the line it starts on. */
function scriptsOf(path: string): { readonly code: string; readonly firstLine: number }[] {
  const text = readFileSync(path, 'utf8')
  if (!path.endsWith('.vue')) {
    return [{ code: text, firstLine: 1 }]
  }
  const { descriptor } = parse(text, { filename: path })
  return [descriptor.script, descriptor.scriptSetup].flatMap((block) => (block === null ? [] : [{ code: block.content, firstLine: block.loc.start.line }]))
}

function resolvedFile(directory: string, specifier: string): string {
  const base = resolve(directory, specifier)
  const found = [base, `${base}.ts`, `${base}.vue`, join(base, 'index.ts')].find((candidate) => existsSync(candidate) && statSync(candidate).isFile())
  return relative(ROOT, found ?? base)
}

const IMPORTS = importsInSource()

const SOURCE_FILES = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
  .filter((name) => /\.(ts|vue)$/.test(name))
  .map((name) => join('src', name))

/** Each line of `src`, templates included, that holds the pattern, as `file:line`, outside the files `allowed` keeps. */
function linesHolding(pattern: RegExp, allowed: (file: string) => boolean): string[] {
  return SOURCE_FILES.filter((file) => !allowed(file)).flatMap((file) =>
    readFileSync(join(ROOT, file), 'utf8')
      .split('\n')
      .flatMap((line, index) => (pattern.test(line) ? [`${file}:${index + 1}`] : [])),
  )
}

/** The app a file belongs to, such as `company` for `src/apps/company/`, or null outside the apps. */
function appOf(file: string): string | null {
  return /^src\/apps\/([^/]+)\//.exec(file)?.[1] ?? null
}

/** The pack folder a file belongs to, such as `src/apps/company/packs/hr-doo/`, or null outside the packs. */
function packOf(file: string): string | null {
  return /^src\/apps\/[^/]+\/packs\/[^/]+\//.exec(file)?.[0] ?? null
}

/** The file through which main.ts installs an app, and which installs the app's pack. */
function isAppEntry(file: string): boolean {
  return /^src\/apps\/[^/]+\/app\.ts$/.test(file)
}

/** Domain code: a `domain` folder, and a pack's ruleset outside its presentation, which holds the law the domain computes with. */
function isDomain(file: string): boolean {
  return /\/domain\//.test(file) || (packOf(file) !== null && /\/ruleset\//.test(file) && !/\/presentation\//.test(file))
}

const DOMAIN_SHARED = ['src/shared/storage/domain/', 'src/shared/calendar/', 'src/shared/money/', 'src/shared/text/']

/** Where the books are kept: the kernel's document storage and each app's workbook. */
function isStorage(file: string): boolean {
  return file.startsWith('src/shared/storage/') || /^src\/apps\/[^/]+\/workbook\//.test(file)
}

function isStorageAdapter(file: string): boolean {
  return isStorage(file) && /\/infrastructure\//.test(file)
}

/** The spreadsheet adapter's mapping of kinds to tabs, which a pack's own mappings build on. */
const SPREADSHEET_MAPPING = ['spreadsheetTab.ts', 'packTabs.ts', 'workbookTemplate.ts', 'cellFormats.ts'].map((file) => `src/apps/company/workbook/infrastructure/${file}`)

/** The files that wire adapters to the application: the workbook store's, and the invoice run's Google ports. */
const ADAPTER_WIRING = [
  'src/apps/company/workbook/application/workbookStore.ts',
  'src/apps/company/invoicing/application/invoiceGoogle.ts',
  'src/apps/loans/workbook/application/loansStore.ts',
  'src/apps/investments/workbook/application/investmentsStore.ts',
]

/** Data of the fake build, which only the fake build loads. */
function isFakeSeed(file: string): boolean {
  return /\/infrastructure\/fake\//.test(file)
}

function broken(rule: (entry: Import) => boolean): string[] {
  return IMPORTS.filter((entry) => !rule(entry)).map((entry) => `${entry.at} imports ${entry.specifier}`)
}

describe('import boundaries', () => {
  it('reads the imports it checks', () => {
    for (const app of ['company', 'loans', 'investments']) {
      expect(IMPORTS.some((entry) => entry.from === 'src/main.ts' && entry.dynamic && entry.target === `src/apps/${app}/app.ts`)).toBe(true)
      expect(IMPORTS.some((entry) => appOf(entry.from) === app && entry.target?.startsWith(`src/apps/${app}/`))).toBe(true)
    }
    expect(IMPORTS.some((entry) => entry.from === 'src/apps/company/app.ts' && !entry.dynamic && entry.target === 'src/apps/company/packs/hr-doo/hrDooPack.ts')).toBe(true)
    expect(IMPORTS.some((entry) => entry.from.endsWith('.vue') && entry.target?.includes('/domain/'))).toBe(true)
    expect(IMPORTS.filter((entry) => entry.target !== null && !existsSync(join(ROOT, entry.target))).map((entry) => entry.at)).toEqual([])
  })

  it('keeps the shared kernel off the shell and the apps', () => {
    expect(broken((entry) => !entry.from.startsWith('src/shared/') || entry.target === null || entry.target.startsWith('src/shared/'))).toEqual([])
  })

  it('keeps the shell off the apps, which main.ts installs by importing each app.ts when it starts', () => {
    expect(
      broken((entry) => entry.target === null || !entry.target.startsWith('src/apps/') || appOf(entry.from) !== null || (entry.from === 'src/main.ts' && entry.dynamic && isAppEntry(entry.target))),
    ).toEqual([])
  })

  it('keeps each app to its own folder and the shared kernel, so no app imports another', () => {
    expect(broken((entry) => appOf(entry.from) === null || entry.target === null || entry.target.startsWith('src/shared/') || appOf(entry.target) === appOf(entry.from))).toEqual([])
  })

  it("keeps an app's code outside its packs free of pack code, which only its app.ts installs", () => {
    expect(broken((entry) => appOf(entry.from) === null || packOf(entry.from) !== null || isAppEntry(entry.from) || entry.target === null || packOf(entry.target) === null)).toEqual([])
  })

  it('keeps a pack to its own folder, its app and the shared kernel', () => {
    expect(
      broken(
        (entry) =>
          packOf(entry.from) === null ||
          entry.target === null ||
          entry.target.startsWith('src/shared/') ||
          packOf(entry.target) === packOf(entry.from) ||
          (appOf(entry.target) === appOf(entry.from) && packOf(entry.target) === null),
      ),
    ).toEqual([])
  })

  it("keeps domain code to its own app's domain code, the record types and the calendar, money and text helpers", () => {
    expect(
      broken(
        (entry) =>
          !isDomain(entry.from) ||
          (entry.target !== null && ((isDomain(entry.target) && appOf(entry.target) === appOf(entry.from)) || DOMAIN_SHARED.some((folder) => entry.target!.startsWith(folder)))),
      ),
    ).toEqual([])
  })

  it('leaves row numbers to the spreadsheet adapter, and record ids to their maker', () => {
    expect(linesHolding(/\bsheetRow\b/, () => false).length).toBeGreaterThan(0)
    expect(linesHolding(/\bsheetRows?\b/, isStorageAdapter)).toEqual([])
    expect(linesHolding(/\bas RecordId\b/, (file) => file === 'src/shared/storage/domain/recordId.ts')).toEqual([])
  })

  it("keeps the storage adapters inside the kernel's storage and the app's workbook, which its app.ts wires in and a pack maps its tabs with", () => {
    expect(
      broken(
        (entry) =>
          entry.target === null ||
          !isStorageAdapter(entry.target) ||
          isStorage(entry.from) ||
          isAppEntry(entry.from) ||
          isFakeSeed(entry.from) ||
          (packOf(entry.from) !== null && /\/infrastructure\//.test(entry.from) && SPREADSHEET_MAPPING.includes(entry.target)),
      ),
    ).toEqual([])
  })

  it('keeps application code off infrastructure, but for the files that wire the adapters', () => {
    expect(broken((entry) => !/\/application\//.test(entry.from) || entry.target === null || !/\/infrastructure\//.test(entry.target) || ADAPTER_WIRING.includes(entry.from))).toEqual([])
  })
})
