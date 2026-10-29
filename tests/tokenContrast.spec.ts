import { describe, expect, it } from 'vitest'

import { contrastRatio } from '../src/shell/gallery/contrast'
import { DARK_TOKENS, LIGHT_TOKENS, SHARED_TOKENS } from './fixtures/tokens'

/** WCAG 2's minimum for body text, and for large text, icons and other marks. */
const TEXT = 4.5
const MARK = 3

const SURFACES = ['--surface-page', '--surface-raised', '--surface-elevated']
const INKS = ['--ink-strong', '--ink', '--ink-secondary', '--ink-muted']
/** The tones Nuxt UI paints as success, error, warning and info. */
const TONES = ['--tone-positive', '--tone-negative', '--tone-warning', '--tone-info']
/** The accent, which Nuxt UI paints as primary. */
const ACCENT = '--accent'
/**
 * The surfaces a wash lies on, since an alert or a badge sits on the page or on a card. Kuna has no
 * primary alert, so text in the accent on its own wash, a primary badge, sits on a card only.
 */
const WASHED_SURFACES = ['--surface-page', '--surface-raised']
/** An app's identity colour, which paints its icon on a tile of the same colour at `APP_TILE_WASH` over the page or a card. */
const APP_COLOURS = ['--app-company', '--app-loans']
const APP_TILE_WASH = 0.14
const CHART_INKS = ['--chart-ink', '--chart-ink-secondary', '--chart-ink-muted']
const SERIES = ['--series-1', '--series-2', '--series-3', '--series-4', '--series-5', '--series-6', '--series-7', '--series-8']

interface Pair {
  readonly name: string
  readonly foreground: string
  readonly background: string
  readonly minimum: number
}

/** The red, green, blue and opacity of a colour written as #rrggbb or rgba(). */
function channelsOf(colour: string): readonly number[] {
  if (colour.startsWith('#')) return [...[1, 3, 5].map((start) => parseInt(colour.slice(start, start + 2), 16)), 1]
  return colour
    .replace(/^rgba\(|\)$/g, '')
    .split(',')
    .map(Number)
}

/** A colour laid over an opaque surface at its own opacity times `opacity`, as #rrggbb. */
function over(colour: string, surface: string, opacity = 1): string {
  const [red = 0, green = 0, blue = 0, own = 1] = channelsOf(colour)
  const below = channelsOf(surface)
  const alpha = own * opacity
  return `#${[red, green, blue]
    .map((channel, index) =>
      Math.round(channel * alpha + (below[index] ?? 0) * (1 - alpha))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/**
 * The pairs that carry text in one theme: every ink and tone on the page, a card and a popover, each
 * tone on the 10% wash of itself that Nuxt UI's subtle badges and alerts lie on, ink on the accent
 * wash of a picked row or tab, each app's colour on the surfaces as text and on its own tile as a mark, the label of a primary button, the chart's ink, and the ink inside a
 * filled chart mark, which carries icons and large text only.
 */
function pairsOf(tokens: ReadonlyMap<string, string>): readonly Pair[] {
  const colour = (name: string): string => tokens.get(name) ?? SHARED_TOKENS.get(name) ?? name
  const pair = (foreground: string, background: string, minimum = TEXT, backgroundColour = colour(background)): Pair => ({
    name: `${foreground} on ${background}`,
    foreground: colour(foreground),
    background: backgroundColour,
    minimum,
  })
  return [
    ...[...INKS, ...TONES, ACCENT].flatMap((ink) => SURFACES.map((surface) => pair(ink, surface))),
    ...TONES.flatMap((tone) => WASHED_SURFACES.map((surface) => pair(tone, `its wash on ${surface}`, TEXT, over(colour(tone), colour(surface), 0.1)))),
    pair(ACCENT, 'its wash on --surface-raised', TEXT, over(colour(ACCENT), colour('--surface-raised'), 0.1)),
    ...['--ink-strong', '--ink', '--accent-strong'].flatMap((ink) => WASHED_SURFACES.map((surface) => pair(ink, `--accent-wash on ${surface}`, TEXT, over(colour('--accent-wash'), colour(surface))))),
    ...APP_COLOURS.flatMap((app) => SURFACES.map((surface) => pair(app, surface))),
    ...APP_COLOURS.flatMap((app) => WASHED_SURFACES.map((surface) => pair(app, `its tile on ${surface}`, MARK, over(colour(app), colour(surface), APP_TILE_WASH)))),
    pair('--accent-ink', '--accent'),
    ...CHART_INKS.flatMap((ink) => ['--chart-surface', '--chart-tooltip'].map((surface) => pair(ink, surface))),
    ...SERIES.map((series) => pair('--chart-on-fill', series, MARK)),
  ]
}

describe('the token contrast', () => {
  for (const [theme, tokens] of [
    ['light', LIGHT_TOKENS],
    ['dark', DARK_TOKENS],
  ] as const) {
    it(`gives text 4.5:1 and marks 3:1 in the ${theme} theme`, () => {
      const failing = pairsOf(tokens).flatMap((pair) => {
        const ratio = contrastRatio(pair.foreground, pair.background)
        return ratio !== null && ratio >= pair.minimum ? [] : [`${pair.name}: ${ratio?.toFixed(2) ?? `${pair.foreground} or ${pair.background} is not #rrggbb`}`]
      })
      expect(failing).toEqual([])
    })
  }
})
