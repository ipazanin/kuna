import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { allTargets, sourceIn } from '../application/linkTargets'
import type { ShownTarget } from '../application/linkTargets'
import { arrivedBeyond } from '../domain/cashMovementOffers'
import { beyondPlan } from '../domain/instalmentParts'
import { beyondRecord } from '../domain/linkFiling'
import { assetUseOf, linkStateOf, targetsIn } from '../domain/linkTarget'
import type { AppTargets, CashMovementTarget, LinkState, LinkTarget, TargetSource } from '../domain/linkTarget'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import { linkText, targetText, words } from './words'
import { absAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { formatAccountMoney, formatMoney } from '../../../../shared/money/moneyFormat'

/** How a link shows: its record is there, Loans is still opening or not set up here, or Loans failed or no longer has the record. */
export type LinkLook = 'there' | 'waiting' | 'missing'

/** A row's link in words: the record it names with its page, or why that record is not shown, with the icon that goes with it. */
export interface LinkLine {
  readonly text: string
  readonly look: LinkLook
  /** Left out where the line's warning tone gives the icon. */
  readonly icon: string | undefined
  readonly to: RouteLocationRaw | null
  /** Which kind of app the link names, which the words of its Open button follow. */
  readonly source: TargetSource
}

const LOOKS: Readonly<Record<LinkState<unknown>['state'], { readonly look: LinkLook; readonly icon: string | undefined }>> = {
  there: { look: 'there', icon: 'i-lucide-link' },
  opening: { look: 'waiting', icon: 'i-lucide-link' },
  'not-set-up': { look: 'waiting', icon: 'i-lucide-info' },
  failed: { look: 'missing', icon: undefined },
  gone: { look: 'missing', icon: undefined },
}

/** The row a link is on, whose money its line compares with the plan. */
export interface LinkedRow {
  readonly amount: Transaction['amount']
  readonly currency: CurrencyCode
  /** Whether its linked parts are filed under Bought assets, which reads a link to an asset as its purchase. */
  readonly bought: boolean
}

/**
 * The record a row is linked to in words, with what the row paid above or below an instalment's plan, or a movement's or extra
 * payment's amount and how much more or less the row moved, or how much more or less arrived at or from a broker. Entries and the
 * import's dry run both say it this way.
 */
export function targetLineOf(target: LinkTarget, row: LinkedRow): string {
  const money = (amount: AccountMoney): string => formatAccountMoney(absAccountMoney(amount), row.currency)
  const plan = beyondPlan(target, row, row.currency)
  const record = beyondRecord(target, row, row.currency)
  const amount = target.kind === 'movement' || target.kind === 'extra-payment' || target.kind === 'owner-payment' ? [formatMoney(target.amount)] : []
  const differs = [
    ...(plan === null || plan === 0 ? [] : [(plan > 0 ? words.above : words.below)(money(plan))]),
    ...(record === null || record === 0 ? [] : [(record > 0 ? words.moreThanLoans : words.lessThanLoans)(money(record))]),
    ...(target.kind === 'cash-movement' ? arrivedText(target, row) : []),
  ]
  const named = target.kind === 'asset' ? { ...target, use: assetUseOf(target, row, row.bought) } : target
  return [targetText(named), ...amount, ...differs].join(', ')
}

/** How much more or less arrived at or from the broker than left, or nothing when the two are equal or do not compare. */
function arrivedText(target: CashMovementTarget, row: LinkedRow): readonly string[] {
  const arrived = arrivedBeyond(target, row, row.currency)
  if (arrived === null || arrived === 0) return []
  return [(arrived > 0 ? words.investments.more : words.investments.less)(formatAccountMoney(absAccountMoney(arrived), row.currency))]
}

/** The line a link reads as against its app's records, with what the row paid above or below an instalment's plan. */
export function linkLineOf(link: RowLink, targets: AppTargets<ShownTarget>, source: TargetSource, row: LinkedRow): LinkLine {
  const read = linkStateOf(link, targets)
  return { text: read.state === 'there' ? targetLineOf(read.target, row) : linkText(read, source), ...LOOKS[read.state], to: read.state === 'there' ? read.target.to : null, source }
}

/** The tone of a link's line by its look: muted while Loans waits, a warning while its record is missing. */
export const LINK_TONE: Readonly<Record<LinkLook, 'muted' | 'warning' | undefined>> = { there: undefined, waiting: 'muted', missing: 'warning' }

/** The line of each link, against the files on screen of the apps it names, read once for every row. */
export function useLinkLines(): ComputedRef<(link: RowLink, row: LinkedRow) => LinkLine> {
  const apps = computed(() => allTargets())
  return computed(() => {
    const held = apps.value
    return (link, row) => linkLineOf(link, targetsIn(held, link.app), sourceIn(held, link.app), row)
  })
}
