import { activeTheme } from '../theme/theme'
import type { Theme } from '../theme/theme'

/**
 * The chart colours, read from tokens.css at runtime so the canvas and the page never disagree.
 * One read is kept per theme. Reading the active theme makes a computed chart option redraw when
 * Settings switches it.
 */

export type BucketTone = 'income' | 'operating' | 'taxes' | 'owner-pay' | 'financing' | 'neutral'

export interface ChartTokens {
  readonly fontFamily: string
  readonly surface: string
  readonly ink: string
  readonly inkSecondary: string
  readonly inkMuted: string
  readonly grid: string
  readonly axis: string
  readonly ghost: string
  readonly deemphasis: string
  readonly hatch: string
  readonly tooltip: string
  readonly tooltipBorder: string
  readonly onFill: string
  readonly positive: string
  readonly negative: string
  readonly accent: string
  /** The eight categorical slots in their validated order. Assign them in sequence, never cycled. */
  readonly series: readonly string[]
  readonly buckets: Readonly<Record<BucketTone, string>>
  /** One hue from the first step to the fifth, for an ordered scale such as how late money owed is. */
  readonly ageing: readonly string[]
}

const BUCKET_TONES: readonly BucketTone[] = ['income', 'operating', 'taxes', 'owner-pay', 'financing', 'neutral']

/** The colour a bucket wears. A row with no defined bucket wears the neutral grey. */
export function bucketTone(bucket: string): BucketTone {
  return (BUCKET_TONES as readonly string[]).includes(bucket) ? (bucket as BucketTone) : 'neutral'
}

let resolved: { readonly theme: Theme; readonly tokens: ChartTokens } | null = null

export function chartTokens(): ChartTokens {
  const theme = activeTheme.value
  if (resolved?.theme !== theme) {
    resolved = { theme, tokens: readChartTokens(getComputedStyle(document.documentElement)) }
  }
  return resolved.tokens
}

function readChartTokens(style: CSSStyleDeclaration): ChartTokens {
  const read = (name: string): string => style.getPropertyValue(name).trim()
  return {
    fontFamily: read('--font-sans') || 'Inter, system-ui, sans-serif',
    surface: read('--chart-surface'),
    ink: read('--chart-ink'),
    inkSecondary: read('--chart-ink-secondary'),
    inkMuted: read('--chart-ink-muted'),
    grid: read('--chart-grid'),
    axis: read('--chart-axis'),
    ghost: read('--chart-ghost'),
    deemphasis: read('--chart-deemphasis'),
    hatch: read('--chart-hatch'),
    tooltip: read('--chart-tooltip'),
    tooltipBorder: read('--chart-tooltip-border'),
    onFill: read('--chart-on-fill'),
    positive: read('--tone-positive'),
    negative: read('--tone-negative'),
    accent: read('--accent'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => read(`--series-${slot}`)),
    buckets: Object.fromEntries(BUCKET_TONES.map((tone) => [tone, read(`--bucket-${tone}`)])) as Record<BucketTone, string>,
    ageing: [1, 2, 3, 4, 5].map((step) => read(`--ageing-${step}`)),
  }
}

/** Any colour token of tokens.css, such as `--bucket-taxes`, as the active theme sets it, for a canvas that cannot read CSS variables. */
export function tokenColour(token: string): string {
  void activeTheme.value
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}
