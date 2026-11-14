import type { RouteLocationRaw } from 'vue-router'

import { publishedLoanTargets } from '../../../loans/facts'
import type { PublishedLoanTargets } from '../../../loans/facts'
import { LOANS_APP } from '../domain/linkTarget'
import type { AppTargets, LinkTarget } from '../domain/linkTarget'

/** A record in Loans as Spending shows it on a row, with its page in Loans. */
export type ShownTarget = LinkTarget & { readonly to: RouteLocationRaw }

/** The instalments and informal loans Loans publishes, as Spending reads them. */
export function loanTargetsFrom(published: PublishedLoanTargets): readonly ShownTarget[] {
  return [
    ...published.instalments.map(({ kind, loan, loanName, due, yourShare, interest, principal, to }): ShownTarget => ({
      kind: 'instalment',
      interim: kind === 'interim-interest',
      link: { app: LOANS_APP, kind: 'bank-loan', key: loan, due },
      loanName,
      due,
      yourShare,
      interest,
      principal,
      to,
    })),
    ...published.informalLoans.map(({ key, name, counterparty, direction, to }): ShownTarget => ({
      kind: 'informal-loan',
      link: { app: LOANS_APP, kind: 'informal-loan', key, due: null },
      name,
      counterparty,
      direction,
      to,
    })),
  ]
}

/** The records of the Loans file on screen that a row can link to, a wait while it opens, a failure, or null while Loans is not set up. */
export function loanTargets(): AppTargets<ShownTarget> {
  const published = publishedLoanTargets()
  return published === null || typeof published === 'string' ? published : loanTargetsFrom(published)
}
