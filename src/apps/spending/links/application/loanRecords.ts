import type { LoanTargetsOfApp, PublishedLoanTargets } from '../../../../shared/app/loanTargets'
import type { AppTargets, TargetsOfApp } from '../domain/linkTarget'
import type { ShownTarget } from './linkTargets'

/** The instalments, extra payments, movements and informal loans a loans app publishes, as Spending reads them, each with the link the app gives it. */
export function loanTargetsFrom(published: PublishedLoanTargets): readonly ShownTarget[] {
  return [
    ...published.instalments.map(({ kind, link, loanName, lender, number, count, due, youPay, interest, principal, to }): ShownTarget => ({
      kind: 'instalment',
      interim: kind === 'interim-interest',
      link,
      loanName,
      lender,
      number,
      count,
      due,
      youPay,
      interest,
      principal,
      to,
    })),
    ...published.extraPayments.map(({ link, loanName, day, amount, to }): ShownTarget => ({ kind: 'extra-payment', link, loanName, day, amount, to })),
    ...published.informalLoans.flatMap(({ link, name, counterparty, direction, movements, to }): ShownTarget[] => [
      { kind: 'informal-loan', link, name, counterparty, direction, to },
      ...movements.map((movement): ShownTarget => ({
        kind: 'movement',
        link: movement.link,
        loan: link,
        loanName: name,
        counterparty,
        direction,
        day: movement.day,
        movement: movement.kind,
        amount: movement.amount,
        to,
      })),
    ]),
  ]
}

/** The targets read from each published set, which a loans app builds once per read of its books, so Spending maps them once too. */
const shown = new WeakMap<PublishedLoanTargets, readonly ShownTarget[]>()

function shownOnce(published: PublishedLoanTargets): readonly ShownTarget[] {
  const held = shown.get(published)
  if (held !== undefined) return held
  const targets = loanTargetsFrom(published)
  shown.set(published, targets)
  return targets
}

/** Each loans app's records as records a row can link to, under the app's id, each with its own wait, failure or not set up. */
export function loanAppsFrom(published: readonly LoanTargetsOfApp[]): readonly TargetsOfApp<ShownTarget>[] {
  return published.map(({ app, targets }): TargetsOfApp<ShownTarget> => ({ app, targets: targets === null || typeof targets === 'string' ? targets : shownOnce(targets) }))
}

let readLoanTargets: () => readonly LoanTargetsOfApp[] = () => []

/** Keeps how Spending reads the loan records other apps publish, which `app.ts` takes from what the shell hands over as Spending installs. */
export function readLoanTargetsThrough(read: () => readonly LoanTargetsOfApp[]): void {
  readLoanTargets = read
}

/** Every loans app's records a row can link to. */
export function loanApps(): readonly TargetsOfApp<ShownTarget>[] {
  return loanAppsFrom(readLoanTargets())
}

/** The records of the loans app a row can link to, a wait while it opens, a failure, or null while no loans app is set up. */
export function loanTargets(): AppTargets<ShownTarget> {
  return loanApps()[0]?.targets ?? null
}
