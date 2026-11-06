import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')
const screens = globSync('src/**/*.vue', { cwd: root })
const VUE_BUILT_INS = new Set(['Teleport', 'Transition', 'TransitionGroup', 'KeepAlive', 'Suspense'])

/** The components a file's template names that its script does not import, which `components: false` leaves unresolved and blank on screen. */
function unresolved(file: string): string[] {
  const text = readFileSync(join(root, file), 'utf8')
  const template = text.slice(text.indexOf('<template'))
  const named = new Set([...template.matchAll(/<([A-Z]\w+)/g)].map((match) => match[1] ?? ''))
  return [...named].filter((name) => !VUE_BUILT_INS.has(name) && !new RegExp(`import\\s+(?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name}\\b)`).test(text) && !new RegExp(`const\\s+${name}\\b`).test(text))
}

describe('the components a template names', () => {
  it('are each imported by the file', () => {
    expect(screens.flatMap((file) => unresolved(file).map((name) => `${file}: ${name}`))).toEqual([])
  })
})
