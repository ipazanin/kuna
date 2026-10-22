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

/** Domain code: a `domain` folder, and a pack's ruleset outside its presentation, which holds the law the domain computes with. */
function isDomain(file: string): boolean {
  return /\/domain\//.test(file) || (/^src\/packs\/[^/]+\/ruleset\//.test(file) && !/\/presentation\//.test(file))
}

const DOMAIN_SHARED = ['src/shared/calendar/', 'src/shared/money/', 'src/shared/text/']

function isCore(file: string): boolean {
  return file.startsWith('src/features/') || file.startsWith('src/shared/') || file === 'src/App.vue'
}

function broken(rule: (entry: Import) => boolean): string[] {
  return IMPORTS.filter((entry) => !rule(entry)).map((entry) => `${entry.at} imports ${entry.specifier}`)
}

describe('import boundaries', () => {
  it('reads the imports it checks', () => {
    expect(IMPORTS.some((entry) => entry.at.startsWith('src/main.ts:') && entry.target === 'src/packs/hr-doo/hrDooPack.ts')).toBe(true)
    expect(IMPORTS.some((entry) => entry.from.endsWith('.vue') && entry.target?.includes('/domain/'))).toBe(true)
    expect(IMPORTS.filter((entry) => entry.target !== null && !existsSync(join(ROOT, entry.target))).map((entry) => entry.at)).toEqual([])
  })

  it('keeps domain code to domain code and the calendar, money and text helpers', () => {
    expect(broken((entry) => !isDomain(entry.from) || (entry.target !== null && (isDomain(entry.target) || DOMAIN_SHARED.some((folder) => entry.target!.startsWith(folder)))))).toEqual([])
  })

  it('keeps core free of pack code, which only main.ts installs', () => {
    expect(broken((entry) => !isCore(entry.from) || entry.target === null || !entry.target.startsWith('src/packs/'))).toEqual([])
  })
})
