import { readFileSync } from 'node:fs'

const TOKENS = readFileSync(new URL('../../src/shared/styles/tokens.css', import.meta.url), 'utf8')

/** The custom properties a block of tokens.css sets, such as the one that opens with `:root {`. */
function propertiesOf(opening: string): ReadonlyMap<string, string> {
  const start = TOKENS.indexOf(`\n${opening}`)
  const block = TOKENS.slice(start, TOKENS.indexOf('\n}', start))
  return new Map([...block.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(([, name, value]) => [name!, value!.trim()]))
}

export const LIGHT_TOKENS = propertiesOf(':root {')
export const DARK_TOKENS = propertiesOf('.dark {')
/** The first block both themes share, which holds the bucket aliases and the ink inside a filled mark. */
export const SHARED_TOKENS = propertiesOf(':root,\n.dark {')
