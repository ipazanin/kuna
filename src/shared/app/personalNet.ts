import { moneyFromCents, negateMoney, sumMoney } from '../money/money'
import type { Money } from '../money/money'
import type { CountedHubPart, HubState } from './appContribution'

/** An app whose figures add up into the personal sum, as Net worth reads it. */
export interface PersonalApp {
  readonly name: string
  /** The app has not been set up, so it counts as nothing. */
  readonly notSetUp: boolean
  readonly currency: string
  readonly figures: HubState<CountedHubPart>
}

/** The sum, or why it is not shown: no app set up to add up, an app still opening, apps that failed to open, or apps that keep different currencies. */
export type PersonalSum<App> =
  | { readonly state: 'ready'; readonly cents: Money }
  | { readonly state: 'nothing' }
  | { readonly state: 'opening' }
  | { readonly state: 'failed'; readonly apps: readonly App[] }
  | { readonly state: 'currencies' }

export interface PersonalNet<App> {
  readonly sum: PersonalSum<App>
  readonly notSetUp: readonly App[]
  /** What the apps' parts leave out. */
  readonly leavesOut: readonly string[]
}

/**
 * What you have less what you owe over the personal apps. An app not set up, or set up with nothing
 * to show, counts as nothing, and with no app set up there is nothing to add up. One still opening
 * holds the sum back until it is read, and one that failed holds it back for good.
 */
export function personalNet<App extends PersonalApp>(apps: readonly App[]): PersonalNet<App> {
  const counted = apps.filter((app) => !app.notSetUp)
  const withFigures = counted.flatMap((app) => (typeof app.figures === 'object' && app.figures !== null ? [{ app, figures: app.figures }] : []))
  const failed = counted.filter((app) => app.figures === 'failed')
  const currencies = new Set(withFigures.map((entry) => entry.app.currency))
  const parts = withFigures.flatMap((entry) => entry.figures.parts)
  const sum: PersonalSum<App> =
    counted.length === 0
      ? { state: 'nothing' }
      : failed.length > 0
        ? { state: 'failed', apps: failed }
        : counted.some((app) => app.figures === 'opening')
          ? { state: 'opening' }
          : currencies.size > 1
            ? { state: 'currencies' }
            : { state: 'ready', cents: sumMoney(parts.map((part) => (part.side === 'has' ? moneyFromCents(part.cents) : negateMoney(moneyFromCents(part.cents))))) }
  return { sum, notSetUp: apps.filter((app) => app.notSetUp), leavesOut: withFigures.flatMap((entry) => entry.figures.notes) }
}
