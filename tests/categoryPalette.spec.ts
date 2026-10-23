import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { SWATCHES } from '../src/features/workbook/domain/categoryColour'
import { swatchToken } from '../src/features/workbook/presentation/categoryColours'

const TOKENS = readFileSync(new URL('../src/shared/styles/tokens.css', import.meta.url), 'utf8')

/** The custom properties a block of tokens.css sets, such as the one that opens with `:root {`. */
function propertiesOf(opening: string): ReadonlyMap<string, string> {
  const start = TOKENS.indexOf(`\n${opening}`)
  const block = TOKENS.slice(start, TOKENS.indexOf('\n}', start))
  return new Map([...block.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(([, name, value]) => [name!, value!.trim()]))
}

const LIGHT = propertiesOf(':root {')
const DARK = propertiesOf('.dark {')

describe('the category palette', () => {
  it('stores each swatch as the light step tokens.css gives its token', () => {
    expect(SWATCHES.map((swatch) => [swatch.name, LIGHT.get(swatchToken(swatch))])).toEqual(SWATCHES.map((swatch) => [swatch.name, swatch.hex]))
  })

  it('has a dark step for every swatch, and nine distinct swatches', () => {
    expect(SWATCHES.filter((swatch) => !/^#[0-9a-f]{6}$/.test(DARK.get(swatchToken(swatch)) ?? '')).map((swatch) => swatch.name)).toEqual([])
    expect(new Set(SWATCHES.map((swatch) => swatch.hex)).size).toBe(9)
    expect(new Set(SWATCHES.map(swatchToken)).size).toBe(9)
  })
})
