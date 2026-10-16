/**
 * Euro amounts in en-GB grouping with the sign in front, as the owner's Sheet shows them. Inputs are
 * integer cents. Negative amounts use a true minus sign so columns of figures stay the same width.
 */

export type SignDisplay = 'negative' | 'always' | 'magnitude'

const MINUS = '−'

const fullFormat = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const wholeFormat = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const compactFormat = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  notation: 'compact',
  maximumFractionDigits: 1,
})

function withSign(signed: number, magnitudeText: string, sign: SignDisplay): string {
  if (sign === 'magnitude' || signed === 0) return magnitudeText
  if (signed < 0) return `${MINUS}${magnitudeText}`
  return sign === 'always' ? `+${magnitudeText}` : magnitudeText
}

export function formatEuros(cents: number, sign: SignDisplay = 'negative'): string {
  return withSign(cents, fullFormat.format(Math.abs(cents) / 100), sign)
}

/** Whole euros, for KPI values and labels where the cents are noise. */
export function formatWholeEuros(cents: number, sign: SignDisplay = 'negative'): string {
  return withSign(cents, wholeFormat.format(Math.round(Math.abs(cents) / 100)), sign)
}

/** €12.4k style, for axis ticks and tight labels. */
export function formatCompactEuros(cents: number, sign: SignDisplay = 'negative'): string {
  return withSign(cents, compactFormat.format(Math.abs(cents) / 100), sign)
}

const percentFormat = new Intl.NumberFormat('en-GB', { style: 'percent', maximumFractionDigits: 1 })

export function formatPercent(fraction: number, sign: SignDisplay = 'negative'): string {
  return withSign(fraction, percentFormat.format(Math.abs(fraction)), sign)
}
