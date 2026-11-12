import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import type { RowLink } from '../../workbook/domain/rowLink'

/** The app a link to Loans names, the one app whose records Spending reads so far. */
export const LOANS_APP = 'loans'

/** A bank loan's instalment in Loans that a row can pay: when it falls due and what of it you pay. */
export interface InstalmentTarget {
  readonly kind: 'instalment'
  readonly link: RowLink
  readonly loanName: string
  readonly due: CivilDate
  readonly yourShare: Money
  readonly interest: Money
  readonly principal: Money
}

/** Money owed between you and someone else in Loans, which a row can lend, borrow or repay. */
export interface InformalLoanTarget {
  readonly kind: 'informal-loan'
  readonly link: RowLink
  readonly name: string
  readonly counterparty: string
  readonly direction: 'you-owe' | 'owed-to-you'
}

/** A record in another app that a row can be. */
export type LinkTarget = InstalmentTarget | InformalLoanTarget

/** An app's targets, a wait while its file opens, a failure, or null while the app is not set up on this device. */
export type AppTargets<Target> = readonly Target[] | 'opening' | 'failed' | null

/** What a row's link reads as: the record it names, or why that record cannot be shown. A row whose target is not there counts by its category as any row does. */
export type LinkState<Target> =
  { readonly state: 'there'; readonly target: Target } | { readonly state: 'opening' } | { readonly state: 'failed' } | { readonly state: 'not-set-up' } | { readonly state: 'gone' }

/** The record a link names among Loans' targets, or why it is not there. A link to an app Spending does not read reads as gone. */
export function linkStateOf<Target extends { readonly link: RowLink }>(link: RowLink, loans: AppTargets<Target>): LinkState<Target> {
  const targets = link.app === LOANS_APP ? loans : []
  if (targets === null) return { state: 'not-set-up' }
  if (targets === 'opening' || targets === 'failed') return { state: targets }
  const target = targets.find((candidate) => sameRecord(candidate.link, link))
  return target === undefined ? { state: 'gone' } : { state: 'there', target }
}

function sameRecord(one: RowLink, other: RowLink): boolean {
  return one.app === other.app && one.kind === other.kind && one.key === other.key && one.due === other.due
}
