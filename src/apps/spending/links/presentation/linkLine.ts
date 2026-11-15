import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { loanTargets } from '../application/loanTargets'
import type { ShownTarget } from '../application/loanTargets'
import { beyondPlan, beyondRecord } from '../domain/instalmentSplit'
import { linkStateOf } from '../domain/linkTarget'
import type { AppTargets, LinkState, LinkTarget } from '../domain/linkTarget'
import type { RowLink } from '../../workbook/domain/rowLink'
import type { Transaction } from '../../workbook/domain/transaction'
import { linkText, words } from './words'
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
}

/**
 * The record a row is linked to in words, with what the row paid above or below an instalment's plan, or a movement's or extra
 * payment's amount and how much more or less the row moved. Entries and the import's dry run both say it this way.
 */
export function targetLineOf(target: LinkTarget, row: LinkedRow): string {
  const money = (amount: AccountMoney): string => formatAccountMoney(absAccountMoney(amount), row.currency)
  const plan = beyondPlan(target, row, row.currency)
  const record = beyondRecord(target, row, row.currency)
  const amount = target.kind === 'movement' || target.kind === 'extra-payment' ? [formatMoney(target.amount)] : []
  const differs = [
    ...(plan === null || plan === 0 ? [] : [(plan > 0 ? words.above : words.below)(money(plan))]),
    ...(record === null || record === 0 ? [] : [(record > 0 ? words.moreThanLoans : words.lessThanLoans)(money(record))]),
  ]
  return [linkText({ state: 'there', target }), ...amount, ...differs].join(', ')
}

/** The line a link reads as against Loans' records, with what the row paid above or below an instalment's plan. */
export function linkLineOf(link: RowLink, loans: AppTargets<ShownTarget>, row: LinkedRow): LinkLine {
  const read = linkStateOf(link, loans)
  return { text: read.state === 'there' ? targetLineOf(read.target, row) : linkText(read), ...LOOKS[read.state], to: read.state === 'there' ? read.target.to : null }
}

/** The tone of a link's line by its look: muted while Loans waits, a warning while its record is missing. */
export const LINK_TONE: Readonly<Record<LinkLook, 'muted' | 'warning' | undefined>> = { there: undefined, waiting: 'muted', missing: 'warning' }

/** The line of each link, against the Loans file on screen, read once for every row. */
export function useLinkLines(): ComputedRef<(link: RowLink, row: LinkedRow) => LinkLine> {
  const loans = computed(() => loanTargets())
  return computed(() => {
    const held = loans.value
    return (link, row) => linkLineOf(link, held, row)
  })
}
