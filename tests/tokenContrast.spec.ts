import { describe, expect, it } from 'vitest'

import { contrastRatio } from '../src/shared/charts/colour'
import { DARK_TOKENS, LIGHT_TOKENS, SHARED_TOKENS } from './fixtures/tokens'

/** WCAG 2's minimum for body text, and for large text, icons and other marks. */
const TEXT = 4.5
const MARK = 3
const DEEMPHASIS = '--chart-deemphasis'
/** The grey a chart sets back is often drawn thin or under a hatch, which reads fainter than its token, so it keeps a margin over 3:1. */
const DEEMPHASIS_MARK = 3.15

const SURFACES = ['--surface-page', '--surface-raised', '--surface-elevated']
const INKS = ['--ink-strong', '--ink', '--ink-secondary', '--ink-muted']
/** The tones Nuxt UI paints as success, error, warning and info. */
const TONES = ['--tone-positive', '--tone-negative', '--tone-warning', '--tone-info']
/** Money coming in and going out, each the soft depth of the full tone beside it. */
const SOFT_TONES = [
  { soft: '--tone-positive-soft', full: '--tone-positive' },
  { soft: '--tone-negative-soft', full: '--tone-negative' },
] as const
/** How far a soft tone may sit from its full tone's OKLCH lightness, and from 60% of its chroma, after rounding to #rrggbb. */
const SOFT_LIGHTNESS_MARGIN = 0.005
const SOFT_CHROMA = 0.6
const SOFT_CHROMA_MARGIN = 0.02
/** The accent, which Nuxt UI paints as primary. */
const ACCENT = '--accent'
/**
 * The surfaces a wash lies on, since an alert or a badge sits on the page or on a card. Kuna has no
 * primary alert, so text in the accent on its own wash, a primary badge, sits on a card only.
 */
const WASHED_SURFACES = ['--surface-page', '--surface-raised']
/** An app's identity colour, which paints its icon on a tile of the same colour at `APP_TILE_WASH` over the page or a card. */
const APP_COLOURS = ['--app-company', '--app-loans', '--app-investments', '--app-assets', '--app-spending']
const APP_TILE_WASH = 0.14
const CHART_INKS = ['--chart-ink', '--chart-ink-secondary', '--chart-ink-muted']
/** The gain and loss steps, which tint a tile or a cell under a figure in ink. */
const STEPS = ['--gain-1', '--gain-2', '--gain-3', '--loss-1', '--loss-2', '--loss-3']
/** The families of tokens a chart paints its bars, slices, lines and dots with. */
const CHART_MARK_FAMILY = /^--(chart|series|bucket|pay|loan|scenario|invest|net|ageing)-/
/** The chart tokens that are no mark: the surfaces, the recessive grid, axis, ghost, hatch and tooltip edge, and the inks, which carry text. */
const NOT_CHART_MARKS = ['--chart-surface', '--chart-tooltip', '--chart-tooltip-border', '--chart-grid', '--chart-axis', '--chart-ghost', '--chart-hatch', '--chart-on-fill', ...CHART_INKS]

/** Every chart mark the theme sets, through the block both themes share as well. */
function chartMarksOf(tokens: ReadonlyMap<string, string>): readonly string[] {
  return [...new Set([...tokens.keys(), ...SHARED_TOKENS.keys()])].filter((name) => CHART_MARK_FAMILY.test(name) && !NOT_CHART_MARKS.includes(name))
}
/** The edge of a checkbox or a radio and of a switch that is off, a mark on the surfaces a control sits on. */
const CONTROL_EDGE = '--control-edge'
/** The twelve categorical slots, which a category may wear as its swatch beside its name on the page, a card and a popover. */
const SERIES = Array.from({ length: 12 }, (_, place) => `--series-${place + 1}`)

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
 * filled chart mark, which carries icons and large text only, each categorical slot as a mark on the page, a card and a popover, ink on each gain and loss step and on each net position's tint, every chart mark on the card and the chart's surface, and the edge of a checkbox, a radio or an off switch as a mark.
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
    ...[...INKS, ...TONES, ...SOFT_TONES.map(({ soft }) => soft), ACCENT].flatMap((ink) => SURFACES.map((surface) => pair(ink, surface))),
    ...TONES.flatMap((tone) => WASHED_SURFACES.map((surface) => pair(tone, `its wash on ${surface}`, TEXT, over(colour(tone), colour(surface), 0.1)))),
    pair(ACCENT, 'its wash on --surface-raised', TEXT, over(colour(ACCENT), colour('--surface-raised'), 0.1)),
    ...['--ink-strong', '--ink', '--accent-strong'].flatMap((ink) => WASHED_SURFACES.map((surface) => pair(ink, `--accent-wash on ${surface}`, TEXT, over(colour('--accent-wash'), colour(surface))))),
    ...APP_COLOURS.flatMap((app) => SURFACES.map((surface) => pair(app, surface))),
    ...APP_COLOURS.flatMap((app) => WASHED_SURFACES.map((surface) => pair(app, `its tile on ${surface}`, MARK, over(colour(app), colour(surface), APP_TILE_WASH)))),
    pair('--accent-ink', '--accent'),
    ...CHART_INKS.flatMap((ink) => ['--chart-surface', '--chart-tooltip'].map((surface) => pair(ink, surface))),
    ...SERIES.map((series) => pair('--chart-on-fill', series, MARK)),
    ...SERIES.flatMap((series) => SURFACES.map((surface) => pair(series, surface, MARK))),
    ...SURFACES.map((surface) => pair(CONTROL_EDGE, surface, MARK)),
    ...chartMarksOf(tokens).flatMap((mark) => ['--surface-raised', '--chart-surface'].map((surface) => pair(mark, surface, mark === DEEMPHASIS ? DEEMPHASIS_MARK : MARK))),
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
  { chart: 'a bank loan you share', dots: ['--loan-lowers', '--loan-interest'], lines: ['--loan-you-owe', '--loan-ahead', '--loan-your-part'] },
  { chart: 'an informal loan you owe', dots: ['--loan-lowers', '--loan-raises'], lines: ['--loan-you-owe', '--loan-ahead'] },
  { chart: 'an informal loan owed to you', dots: ['--loan-lowers', '--loan-raises'], lines: ['--loan-owed-to-you', '--loan-ahead'] },
] as const

/** The common dot as the charts paint it, a buy on a price chart and what lowers what is owed on a balance line. */
const COMMON_DOTS = ['--invest-buy', '--loan-lowers']
/** Every class colour on the class ring, which the common dot must not be mistaken for. */
const CLASS_RING = ['--invest-stocks', '--invest-bonds', '--invest-money-market', '--invest-cash', '--invest-gold', '--invest-crypto']
/** The colours of an open list's mix, the colours `MoneyText` paints a gain, a loss, money coming in and going out, and the accent. */
const MIX_MONEY_FLOW_AND_ACCENT = [
  '--series-1',
  '--series-2',
  '--series-3',
  '--series-4',
  DEEMPHASIS,
  '--tone-positive',
  '--tone-negative',
  '--tone-positive-soft',
  '--tone-negative-soft',
  '--ink',
  ACCENT,
]

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

/** The least OKLab distance, times 100, between the grey a chart sets back and the chart's inks, so a set-back bar reads as neither text nor the muted bar of last year beside a set-back year. */
const DEEMPHASIS_APART_FROM_INK = 10

describe('the de-emphasis grey', () => {
  for (const [theme, tokens] of [
    ['light', LIGHT_TOKENS],
    ['dark', DARK_TOKENS],
  ] as const) {
    it(`stays apart from every chart ink in the ${theme} theme`, () => {
      const failing = CHART_INKS.flatMap((ink) => {
        const { normal } = distancesOf(colourOf(tokens, DEEMPHASIS), colourOf(tokens, ink))
        return normal >= DEEMPHASIS_APART_FROM_INK ? [] : [`${DEEMPHASIS} and ${ink}: ${normal.toFixed(1)}`]
      })
      expect(failing).toEqual([])
    })
  }
})

/** The cost buckets, which Overview and Analysis stack edge to edge in every month's bar. */
const COST_BUCKETS = ['--bucket-operating', '--bucket-taxes', '--bucket-owner-pay', '--bucket-financing']
/** The least OKLab distance, times 100, between two cost buckets in normal vision and with protanopia or deuteranopia, the floor the palette validator allows beside a name. */
const BUCKETS_APART = 10
const BUCKETS_APART_RED_GREEN = 6

describe('the cost buckets', () => {
  for (const [theme, tokens] of [
    ['light', LIGHT_TOKENS],
    ['dark', DARK_TOKENS],
  ] as const) {
    it(`keep every pair apart in normal vision and with red-green colour blindness in the ${theme} theme`, () => {
      const failing = COST_BUCKETS.flatMap((bucket, index) =>
        COST_BUCKETS.slice(index + 1).flatMap((other) => {
          const one = colourOf(tokens, bucket)
          const two = colourOf(tokens, other)
          const apart = (seen?: readonly (readonly number[])[]): number => 100 * Math.hypot(...oklabOf(one, seen).map((part, place) => part - (oklabOf(two, seen)[place] ?? 0)))
          const normal = apart()
          const redGreen = Math.min(apart(COLOUR_BLINDNESS['protanopia']), apart(COLOUR_BLINDNESS['deuteranopia']))
          return normal >= BUCKETS_APART && redGreen >= BUCKETS_APART_RED_GREEN ? [] : [`${bucket} and ${other}: ${normal.toFixed(1)}, red-green ${redGreen.toFixed(1)}`]
        }),
      )
      expect(failing).toEqual([])
    })
  }
})

describe("the app colours on Net worth's What you have ring", () => {
  for (const [theme, tokens] of [
    ['light', LIGHT_TOKENS],
    ['dark', DARK_TOKENS],
  ] as const) {
    it(`keep every pair apart in normal vision and with red-green colour blindness in the ${theme} theme, since any two may sit side by side`, () => {
      const failing = APP_COLOURS.flatMap((app, index) =>
        APP_COLOURS.slice(index + 1).flatMap((other) => {
          const one = colourOf(tokens, app)
          const two = colourOf(tokens, other)
          const apart = (seen?: readonly (readonly number[])[]): number => 100 * Math.hypot(...oklabOf(one, seen).map((part, place) => part - (oklabOf(two, seen)[place] ?? 0)))
          const normal = apart()
          const redGreen = Math.min(apart(COLOUR_BLINDNESS['protanopia']), apart(COLOUR_BLINDNESS['deuteranopia']))
          return normal >= BUCKETS_APART && redGreen >= BUCKETS_APART_RED_GREEN ? [] : [`${app} and ${other}: ${normal.toFixed(1)}, red-green ${redGreen.toFixed(1)}`]
        }),
      )
      expect(failing).toEqual([])
    })
  }
})

/** The debts on Net worth's What you owe ring, largest first, with the grey the rest folds into. */
const DEBT_RING = ['--net-debt-1', '--net-debt-2', '--net-debt-3', DEEMPHASIS]
/** The colours a debt must not be taken for: the two bars above the rings, and a gain or a loss. */
const NOT_A_DEBT = ['--net-has', '--net-owes', '--tone-positive', '--tone-negative']
/** The least OKLab distance, times 100, between a debt and a colour that means something else on Net worth. */
const DEBT_APART_FROM_MEANING = 8

describe('the debt ring', () => {
  for (const [theme, tokens] of [
    ['light', LIGHT_TOKENS],
    ['dark', DARK_TOKENS],
  ] as const) {
    it(`keeps every pair of debts apart, and each debt apart from the bars, a gain and a loss, in the ${theme} theme`, () => {
      const pairs = DEBT_RING.flatMap((debt, index) => DEBT_RING.slice(index + 1).map((other) => [debt, other] as const))
      const close = pairs.flatMap(([debt, other]) => {
        const one = colourOf(tokens, debt)
        const two = colourOf(tokens, other)
        const apart = (seen?: readonly (readonly number[])[]): number => 100 * Math.hypot(...oklabOf(one, seen).map((part, place) => part - (oklabOf(two, seen)[place] ?? 0)))
        const normal = apart()
        const redGreen = Math.min(apart(COLOUR_BLINDNESS['protanopia']), apart(COLOUR_BLINDNESS['deuteranopia']))
        return normal >= BUCKETS_APART && redGreen >= BUCKETS_APART_RED_GREEN ? [] : [`${debt} and ${other}: ${normal.toFixed(1)}, red-green ${redGreen.toFixed(1)}`]
      })
      const misread = DEBT_RING.slice(0, -1).flatMap((debt) =>
        NOT_A_DEBT.flatMap((other) => {
          const { normal } = distancesOf(colourOf(tokens, debt), colourOf(tokens, other))
          return normal >= DEBT_APART_FROM_MEANING ? [] : [`${debt} and ${other}: ${normal.toFixed(1)}`]
        }),
      )
      expect([...close, ...misread]).toEqual([])
    })
  }
})

/** A colour written as #rrggbb as OKLCH lightness and chroma. */
function lightnessAndChromaOf(hex: string): { readonly lightness: number; readonly chroma: number } {
  const [lightness = 0, a = 0, b = 0] = oklabOf(hex)
  return { lightness, chroma: Math.hypot(a, b) }
}

describe('the soft tones', () => {
  for (const [theme, tokens] of [
    ['light', LIGHT_TOKENS],
    ['dark', DARK_TOKENS],
  ] as const) {
    it(`keep their full tone's lightness at 60% of its chroma in the ${theme} theme`, () => {
      const failing = SOFT_TONES.flatMap(({ soft, full }) => {
        const softLook = lightnessAndChromaOf(colourOf(tokens, soft))
        const fullLook = lightnessAndChromaOf(colourOf(tokens, full))
        const chromaShare = softLook.chroma / fullLook.chroma
        const keepsLightness = Math.abs(softLook.lightness - fullLook.lightness) <= SOFT_LIGHTNESS_MARGIN
        const softens = Math.abs(chromaShare - SOFT_CHROMA) <= SOFT_CHROMA_MARGIN
        return keepsLightness && softens ? [] : [`${soft}: lightness ${softLook.lightness.toFixed(3)} against ${fullLook.lightness.toFixed(3)}, chroma at ${chromaShare.toFixed(3)} of ${full}`]
      })
      expect(failing).toEqual([])
    })
  }
})
