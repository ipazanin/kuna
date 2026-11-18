import type { AppOwnerPayments, PublishedOwnerPayment } from '../../../../shared/app/moneyWithOwner'
import type { AppTargets, TargetsOfApp } from '../domain/linkTarget'
import type { ShownTarget } from './linkTargets'

/** A payment between your company and you as Spending reads it, with the link and the page Company gives it. */
function companyTargetOf({ link, day, amount, direction, ownerIban, parts, to }: PublishedOwnerPayment): ShownTarget {
  return { kind: 'owner-payment', link, day, amount, direction, ownerIban, parts, to }
}

/** Each app's payments with its owner as records a row can link to, under the app's id, each with its own wait, failure or not set up. */
export function companyTargetsFrom(published: readonly AppOwnerPayments[]): readonly TargetsOfApp<ShownTarget>[] {
  return published.map(({ app, payments }): TargetsOfApp<ShownTarget> => {
    const targets: AppTargets<ShownTarget> = payments === null || typeof payments === 'string' ? payments : payments.map(companyTargetOf)
    return { app, targets }
  })
}

let readMoneyWithOwner: () => readonly AppOwnerPayments[] = () => []

/** Keeps how Spending reads the payments between a company and its owner, which `app.ts` takes from what the shell hands over as Spending installs. */
export function readMoneyWithOwnerThrough(read: () => readonly AppOwnerPayments[]): void {
  readMoneyWithOwner = read
}

/** The payments of every app that keeps any, as records a row can link to. */
export function companyTargets(): readonly TargetsOfApp<ShownTarget>[] {
  return companyTargetsFrom(readMoneyWithOwner())
}
