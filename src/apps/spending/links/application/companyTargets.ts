import type { MoneyWithOwnerOfApp, PublishedMoneyWithOwner, PublishedOwnerAdvance, PublishedOwnerPayment } from '../../../../shared/app/moneyWithOwner'
import type { AppTargets, TargetsOfApp } from '../domain/linkTarget'
import type { ShownTarget } from './linkTargets'

/** A payment between your company and you as Spending reads it, with the link and the page Company gives it. */
function companyTargetOf({ link, day, amount, direction, ownerIban, parts, to }: PublishedOwnerPayment): ShownTarget {
  return { kind: 'owner-payment', link, day, amount, direction, ownerIban, parts, to }
}

/** A cost you paid for your company as Spending reads it, with the link and the page Company gives it. */
export function advanceTargetOf({ link, day, amount, description, categoryName, to }: PublishedOwnerAdvance): ShownTarget {
  return { kind: 'owner-advance', link, day, amount, description, categoryName, to }
}

function targetsOfMoney({ payments, advances }: PublishedMoneyWithOwner): readonly ShownTarget[] {
  return [...payments.map(companyTargetOf), ...advances.map(advanceTargetOf)]
}

/** Each app's money with its owner as records a row can link to, under the app's id, each with its own wait, failure or not set up. */
export function companyTargetsFrom(published: readonly MoneyWithOwnerOfApp[]): readonly TargetsOfApp<ShownTarget>[] {
  return published.map(({ app, money }): TargetsOfApp<ShownTarget> => {
    const targets: AppTargets<ShownTarget> = money === null || typeof money === 'string' ? money : targetsOfMoney(money)
    return { app, targets }
  })
}

let readMoneyWithOwner: () => readonly MoneyWithOwnerOfApp[] = () => []

/** Keeps how Spending reads the money between a company and its owner, which `app.ts` takes from what the shell hands over as Spending installs. */
export function readMoneyWithOwnerThrough(read: () => readonly MoneyWithOwnerOfApp[]): void {
  readMoneyWithOwner = read
}

/** The payments and costs of every app that keeps any, as records a row can link to. */
export function companyTargets(): readonly TargetsOfApp<ShownTarget>[] {
  return companyTargetsFrom(readMoneyWithOwner())
}
