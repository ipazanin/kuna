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
const APP_COLOURS = ['--app-company', '--app-loans', '--app-investments']
const APP_TILE_WASH = 0.14
const CHART_INKS = ['--chart-ink', '--chart-ink-secondary', '--chart-ink-muted']
/** The gain and loss steps, which tint a tile or a cell under a figure in ink. */
const STEPS = ['--gain-1', '--gain-2', '--gain-3', '--loss-1', '--loss-2', '--loss-3']
/** The class ring's colours that are not series, marks on the card and on the chart's surface. */
const CLASS_MARKS = ['--invest-gold', '--invest-crypto']
/** The dots that mark a buy, a sale or a loan's movement on a time chart, and the ring of a new rate, as marks on the card and on the chart's surface. */
const DOT_MARKS = ['--invest-buy', '--invest-sale', '--loan-lowers', '--loan-raises', '--loan-interest']
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

/** A token's colour in one theme, through its `var()` aliases. */
function colourOf(tokens: ReadonlyMap<string, string>, name: string): string {
  const value = tokens.get(name) ?? SHARED_TOKENS.get(name) ?? name
  const alias = /^var\((--[\w-]+)\)$/.exec(value)?.[1]
  return alias === undefined ? value : colourOf(tokens, alias)
}

/**
 * The pairs that carry text in one theme: every ink and tone on the page, a card and a popover, each
 * tone on the 10% wash of itself that Nuxt UI's subtle badges and alerts lie on, ink on the accent
 * wash of a picked row or tab, each app's colour on the surfaces as text and on its own tile as a mark, the label of a primary button, the chart's ink, and the ink inside a
 * filled chart mark, which carries icons and large text only, ink on each gain and loss step, and each class colour and each dot colour as a mark.
 */
function pairsOf(tokens: ReadonlyMap<string, string>): readonly Pair[] {
  const colour = (name: string): string => colourOf(tokens, name)
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
    ...[...CLASS_MARKS, ...DOT_MARKS].flatMap((mark) => ['--surface-raised', '--chart-surface'].map((surface) => pair(mark, surface, MARK))),
    ...STEPS.flatMap((step) => ['--ink', '--ink-strong', '--chart-ink'].map((ink) => pair(ink, step))),
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

/** The least OKLab distance, times 100, between a dot and what it sits on or beside, in normal vision and under each simulated colour blindness, as the dataviz palette validator measures it. */
const DOT_APART = 12
const DOT_APART_COLOUR_BLIND = 8

/** Machado, Oliveira and Fernandes (2009) at full severity, on linear sRGB. */
const COLOUR_BLINDNESS: Readonly<Record<string, readonly (readonly number[])[]>> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

/** A colour written as #rrggbb in OKLab, as seen in normal vision or through one simulated colour blindness. */
function oklabOf(hex: string, seen?: readonly (readonly number[])[]): readonly number[] {
  const linear = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  const [red = 0, green = 0, blue = 0] =
    seen === undefined
      ? linear
      : seen.map((row) =>
          Math.min(
            1,
            Math.max(
              0,
              row.reduce((sum, weight, index) => sum + weight * (linear[index] ?? 0), 0),
            ),
          ),
        )
  const [long, medium, short] = [
    0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue,
    0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue,
    0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue,
  ].map(Math.cbrt) as [number, number, number]
  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ]
}

/** How far apart two colours are, OKLab distance times 100, in normal vision and then under each colour blindness. */
function distancesOf(one: string, other: string): { readonly normal: number; readonly colourBlind: number } {
  const apart = (seen?: readonly (readonly number[])[]): number => 100 * Math.hypot(...oklabOf(one, seen).map((part, index) => part - (oklabOf(other, seen)[index] ?? 0)))
  return { normal: apart(), colourBlind: Math.min(...Object.values(COLOUR_BLINDNESS).map(apart)) }
}

/**
 * Each chart that draws dots, with its dots and the lines they sit on. A price chart draws a buy and a sale on the
 * price line and the grey reference. A bank loan draws what lowers what is owed and the ring of a new rate on the red
 * line and the brass plan, and an informal loan draws what lowers and what raises it on a red or green line. The
 * chart's ink stands in for a dot in ink, which reads white on the dark card.
 */
const DOTTED_CHARTS = [
  { chart: 'a price chart', dots: ['--invest-buy', '--invest-sale'], lines: ['--invest-portfolio', '--invest-reference'] },
  { chart: 'a bank loan', dots: ['--loan-lowers', '--loan-interest'], lines: ['--loan-you-owe', '--loan-ahead'] },
  { chart: 'an informal loan you owe', dots: ['--loan-lowers', '--loan-raises'], lines: ['--loan-you-owe', '--loan-ahead'] },
  { chart: 'an informal loan owed to you', dots: ['--loan-lowers', '--loan-raises'], lines: ['--loan-owed-to-you', '--loan-ahead'] },
] as const

/** The common dot as the charts paint it, a buy on a price chart and what lowers what is owed on a balance line. */
const COMMON_DOTS = ['--invest-buy', '--loan-lowers']
/** Every class colour on the class ring, which the common dot must not be mistaken for. */
const CLASS_RING = ['--invest-stocks', '--invest-bonds', '--invest-money-market', '--invest-cash', '--invest-gold', '--invest-crypto']
/** The colours of an open list's mix, the colours `MoneyText` paints money coming in, going out and below zero, and the accent. */
const MIX_MONEY_FLOW_AND_ACCENT = ['--series-1', '--series-2', '--series-3', '--series-4', '--chart-deemphasis', '--tone-positive', '--tone-negative', '--ink', ACCENT]

describe('the dot colours', () => {
  for (const [theme, tokens] of [
    ['light', LIGHT_TOKENS],
    ['dark', DARK_TOKENS],
  ] as const) {
    it(`keep each dot apart from its chart's lines, the chart's ink and the other dot for every kind of colour vision in the ${theme} theme`, () => {
      const failing = DOTTED_CHARTS.flatMap(({ chart, dots, lines }) =>
        dots.flatMap((dot, index) =>
          [...lines, '--chart-ink', ...dots.slice(index + 1)].flatMap((other) => {
            const { normal, colourBlind } = distancesOf(colourOf(tokens, dot), colourOf(tokens, other))
            return normal >= DOT_APART && colourBlind >= DOT_APART_COLOUR_BLIND ? [] : [`${dot} and ${other} on ${chart}: ${normal.toFixed(1)}, colour blind ${colourBlind.toFixed(1)}`]
          }),
        ),
      )
      expect(failing).toEqual([])
    })

    it(`keep the common dot apart from every class on the class ring, every mix colour, the money-flow colours and the accent in the ${theme} theme`, () => {
      const failing = COMMON_DOTS.flatMap((dot) =>
        [...CLASS_RING, ...MIX_MONEY_FLOW_AND_ACCENT].flatMap((other) => {
          const { normal } = distancesOf(colourOf(tokens, dot), colourOf(tokens, other))
          return normal >= DOT_APART ? [] : [`${dot} and ${other}: ${normal.toFixed(1)}`]
        }),
      )
      expect(failing).toEqual([])
    })
  }
})
