import { describe, expect, it } from 'vitest'

import { colourDistance, contrastRatio, oklchOf } from '../src/shared/charts/colour'
import {
  CHART_SLOTS,
  DARK_SURFACES,
  LIGHT_SURFACES,
  SWATCHES,
  darkStepOf,
  looksAlike,
  nearestPassing,
  ownSwatch,
  paletteSwatchOf,
  passesInLight,
  slotsTakenBy,
  swatchOf,
  swatchToken,
} from '../src/shared/charts/swatches'
import { DARK_TOKENS, LIGHT_TOKENS } from './fixtures/tokens'

/** How far a worked-out step may turn from the hue it started at, in degrees, after rounding to #rrggbb. */
const HUE_MARGIN = 2

function hueTurn(one: string, other: string): number {
  const turn = Math.abs(oklchOf(one).hue - oklchOf(other).hue) % 360
  return Math.min(turn, 360 - turn)
}

describe('the category palette', () => {
  it('stores each swatch as the light step tokens.css gives its token', () => {
    expect(SWATCHES.map((swatch) => [swatch.name, LIGHT_TOKENS.get(swatchToken(swatch))])).toEqual(SWATCHES.map((swatch) => [swatch.name, swatch.hex]))
  })

  it('has twelve chart slots and the grey, each with a dark step, and no two neighbours alike', () => {
    expect(CHART_SLOTS).toBe(12)
    expect(SWATCHES.filter((swatch) => !/^#[0-9a-f]{6}$/.test(DARK_TOKENS.get(swatchToken(swatch)) ?? '')).map((swatch) => swatch.name)).toEqual([])
    expect(new Set(SWATCHES.map(swatchToken)).size).toBe(13)
    const slots = SWATCHES.filter((swatch) => swatch.slot !== null)
    const alike = slots.flatMap((swatch, index) => {
      const next = slots[(index + 1) % slots.length]!
      return looksAlike(swatch.hex, next.hex) ? [`${swatch.name} and ${next.name}`] : []
    })
    expect(alike).toEqual([])
  })

  it('holds an own colour to the light and the dark surfaces tokens.css gives', () => {
    expect(['--surface-page', '--surface-raised', '--surface-elevated'].map((surface) => LIGHT_TOKENS.get(surface))).toEqual(LIGHT_SURFACES)
    expect(['--surface-page', '--surface-raised', '--surface-elevated'].map((surface) => DARK_TOKENS.get(surface))).toEqual(DARK_SURFACES)
  })

  it('reads the steps older files hold as their slot, in any case', () => {
    expect(['#1BAF7A', '#eb6834', '#eda100', '#e87ba4', '#e34948'].map((stored) => paletteSwatchOf(stored)?.slot)).toEqual([1, 2, 4, 5, 8])
  })
})

describe('an own colour', () => {
  it('is any #rrggbb that keeps 3:1 in the light theme, and a pale tint or a word is none', () => {
    expect(swatchOf('#7A3E12')).toEqual({ name: 'Own colour #7A3E12', hex: '#7a3e12', slot: null, own: true })
    expect(swatchOf('#dce9f9')).toBeNull()
    expect(swatchOf('brown')).toBeNull()
    expect(swatchToken(swatchOf('#7a3e12')!)).toBe('--own-colour-7a3e12')
  })

  it('offers, for a colour too pale for the light theme, the same hue darkened until it passes', () => {
    for (const pale of ['#ffd27a', '#9ee6c4', '#c9b8ff', '#ff9aa2']) {
      const offered = nearestPassing(pale)
      expect(passesInLight(pale)).toBe(false)
      expect(passesInLight(offered)).toBe(true)
      expect(hueTurn(offered, pale)).toBeLessThanOrEqual(HUE_MARGIN)
      expect(oklchOf(offered).lightness).toBeLessThan(oklchOf(pale).lightness)
    }
  })

  it('takes a dark step at its hue that passes 3:1 on the dark page, card and popover, no darker than its light one', () => {
    for (const light of ['#7a3e12', '#1d3c8f', '#b0006a', '#2f6b2f', '#5a5a5a', ...SWATCHES.map((swatch) => swatch.hex)]) {
      const dark = darkStepOf(light)
      expect(DARK_SURFACES.map((surface) => contrastRatio(dark, surface)! >= 3)).toEqual([true, true, true])
      expect(oklchOf(dark).lightness).toBeGreaterThanOrEqual(oklchOf(light).lightness - 0.001)
      if (oklchOf(light).chroma > 0.02) expect(hueTurn(dark, light)).toBeLessThanOrEqual(HUE_MARGIN)
    }
  })

  it('keeps a light step that already passes on the dark surfaces as its own dark step', () => {
    expect(darkStepOf('#008300')).toBe('#008300')
  })

  it('refuses a colour that passes on a card and fails on the light page', () => {
    const onCardOnly = '#909090'
    expect(contrastRatio(onCardOnly, '#ffffff')! >= 3).toBe(true)
    expect(passesInLight(onCardOnly)).toBe(false)
    expect(swatchOf(onCardOnly)).toBeNull()
  })

  it('looks like another colour close in normal vision, or close for a reader with protanopia or deuteranopia', () => {
    expect(looksAlike('#2a78d6', '#2b7ad8')).toBe(true)
    expect(looksAlike('#2a78d6', '#2a78d6')).toBe(true)
    expect(looksAlike('#2a78d6', '#6250d6')).toBe(false)
    expect(colourDistance('#2a78d6', '#2a78d6')).toBe(0)
    // Green and Teal sit 6.2 apart in normal vision, Orange and Dark green 29 apart but 0.9 with deuteranopia.
    expect(looksAlike('#1c9b5e', '#0f9b89')).toBe(true)
    expect(looksAlike('#dd5e1a', '#008300')).toBe(true)
  })

  it('keeps every slot it looks like from a category that takes the next free one, where a swatch of the palette keeps its own', () => {
    expect(slotsTakenBy(paletteSwatchOf('#1c9b5e')!)).toEqual([1])
    expect(slotsTakenBy(paletteSwatchOf('#a3adb9')!)).toEqual([])
    expect(slotsTakenBy(ownSwatch('#139a6c'))).toEqual([1, 9])
  })
})
