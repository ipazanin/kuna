import { describe, expect, it } from 'vitest'

import { SWATCHES } from '../src/apps/company/workbook/domain/categoryColour'
import { swatchToken } from '../src/apps/company/workbook/presentation/categoryColours'
import { DARK_TOKENS, LIGHT_TOKENS } from './fixtures/tokens'

describe('the category palette', () => {
  it('stores each swatch as the light step tokens.css gives its token', () => {
    expect(SWATCHES.map((swatch) => [swatch.name, LIGHT_TOKENS.get(swatchToken(swatch))])).toEqual(SWATCHES.map((swatch) => [swatch.name, swatch.hex]))
  })

  it('has a dark step for every swatch, and nine distinct swatches', () => {
    expect(SWATCHES.filter((swatch) => !/^#[0-9a-f]{6}$/.test(DARK_TOKENS.get(swatchToken(swatch)) ?? '')).map((swatch) => swatch.name)).toEqual([])
    expect(new Set(SWATCHES.map((swatch) => swatch.hex)).size).toBe(9)
    expect(new Set(SWATCHES.map(swatchToken)).size).toBe(9)
  })
})
