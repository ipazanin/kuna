import type { ChartTokens } from './chartTokens'
import { formatEuros } from '../money/euroFormat'

interface AxisTooltipPoint {
  readonly seriesName?: string
  readonly name?: string
  readonly axisValueLabel?: string
  readonly value?: unknown
  readonly color?: unknown
}

export interface AxisTooltipSettings {
  readonly tokens: ChartTokens
  /** Category labels (usually months) whose period is not over yet. */
  readonly incompleteCategories?: readonly string[]
  /** How the hovered category reads in the header, when the axis holds keys such as `2026-10`. */
  readonly categoryLabel?: (category: string) => string
  readonly formatAmount?: (amount: number, seriesName: string) => string
}

/**
 * One tooltip for every series at the hovered category. The value leads and the series name
 * follows, keyed by a short stroke of the series colour. Series and category names come from the
 * user's Sheet, so they are escaped before they reach the tooltip's HTML.
 */
export function axisTooltip(settings: AxisTooltipSettings): (points: unknown) => string {
  const {
    tokens,
    incompleteCategories = [],
    formatAmount = (amount: number) => formatEuros(amount),
    categoryLabel = (category: string) => category,
  } = settings
  return (points: unknown) => {
    const rows = (Array.isArray(points) ? points : [points]) as AxisTooltipPoint[]
    const category = rows[0]?.axisValueLabel ?? rows[0]?.name ?? ''
    const header = `<div style="font-weight:600;color:${tokens.ink};margin-bottom:4px">${escapeHtml(categoryLabel(category))}</div>`
    const incomplete = incompleteCategories.includes(category)
      ? `<div style="color:${tokens.inkMuted};margin:-2px 0 6px">Incomplete month, figures so far</div>`
      : ''
    const body = rows
      .map((row) => {
        const amount = numericValue(row.value)
        const amountText = amount === null ? 'no data' : formatAmount(amount, row.seriesName ?? '')
        const keyColour = typeof row.color === 'string' ? row.color : tokens.inkMuted
        return (
          `<span style="width:10px;height:2px;border-radius:1px;background:${keyColour}"></span>` +
          `<span style="justify-self:end;font-weight:600;font-variant-numeric:tabular-nums;color:${tokens.ink}">${escapeHtml(amountText)}</span>` +
          `<span style="color:${tokens.inkSecondary}">${escapeHtml(row.seriesName ?? '')}</span>`
        )
      })
      .join('')
    return `${header}${incomplete}<div style="display:grid;grid-template-columns:10px auto auto;align-items:center;column-gap:8px;row-gap:2px">${body}</div>`
  }
}

function numericValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (Array.isArray(raw)) return numericValue(raw[raw.length - 1])
  return null
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`)
}
