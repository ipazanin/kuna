import type { CashMovementsOfApp, PublishedCashMovement } from '../../../../shared/app/cashMovements'
import type { AppTargets, TargetsOfApp } from '../domain/linkTarget'
import type { ShownTarget } from './linkTargets'

/** A deposit or a withdrawal of a broker's account as Spending reads it, with the link and the page Investments gives it. */
function cashMovementTargetOf({ link, accountName, day, kind, euros, to }: PublishedCashMovement): ShownTarget {
  return { kind: 'cash-movement', link, accountName, day, movement: kind, amount: euros, to }
}

/** Each app's deposits and withdrawals as records a row can link to, under the app's id, each with its own wait, failure or not set up. */
export function investmentTargetsFrom(published: readonly CashMovementsOfApp[]): readonly TargetsOfApp<ShownTarget>[] {
  return published.map(({ app, movements }): TargetsOfApp<ShownTarget> => {
    const targets: AppTargets<ShownTarget> = movements === null || typeof movements === 'string' ? movements : movements.map(cashMovementTargetOf)
    return { app, targets }
  })
}

let readCashMovements: () => readonly CashMovementsOfApp[] = () => []

/** Keeps how Spending reads the deposits and withdrawals other apps publish, which `app.ts` takes from what the shell hands over as Spending installs. */
export function readCashMovementsThrough(read: () => readonly CashMovementsOfApp[]): void {
  readCashMovements = read
}

/** The deposits and withdrawals of every app that keeps brokers' accounts, as records a row can link to. */
export function investmentTargets(): readonly TargetsOfApp<ShownTarget>[] {
  return investmentTargetsFrom(readCashMovements())
}
