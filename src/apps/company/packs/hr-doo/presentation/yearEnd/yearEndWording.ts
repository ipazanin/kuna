import type { AdjustmentId } from '../../domain/accrual/accrualAdjustment'
import type { LineStatus } from '../../domain/yearEnd/yearEndComparison'
import type { OpenItemGroup } from '../../domain/yearEnd/yearEndOpenItems'
import { words } from './words'

/** What each year-end line is called on screen. The accountant's printed label shows beside it. */
export const LINE_LABELS: Readonly<Record<string, string>> = words.lines

export function lineLabel(statement: string, line: string): string {
  return LINE_LABELS[`${statement}:${line}`] ?? line
}

/** Short names for the bridge's bars and the "explained by" lists. The adjustment's own label says the rest. */
export const ADJUSTMENT_LABELS: Readonly<Record<AdjustmentId, string>> = words.adjustments

export interface StatusWording {
  readonly label: string
  readonly icon: string
  readonly color: 'success' | 'info' | 'warning' | 'error' | 'neutral'
  readonly meaning: string
}

export const STATUS_WORDING: Readonly<Record<LineStatus, StatusWording>> = {
  matched: { ...words.statuses.matched, icon: 'i-lucide-circle-check', color: 'success' },
  explained: { ...words.statuses.explained, icon: 'i-lucide-route', color: 'info' },
  judgement: { ...words.statuses.judgement, icon: 'i-lucide-scale', color: 'warning' },
  open: { ...words.statuses.open, icon: 'i-lucide-circle-alert', color: 'error' },
}

export const STATUSES: readonly LineStatus[] = ['matched', 'explained', 'judgement', 'open']

export const GROUP_WORDING: Readonly<Record<OpenItemGroup, { readonly title: string; readonly description: string }>> = words.groups
