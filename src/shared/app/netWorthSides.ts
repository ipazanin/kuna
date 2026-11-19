import { sumMoney } from '../money/money'
import type { Money } from '../money/money'
import type { CountedHubPart } from './appContribution'
import type { PersonalApp } from './personalNet'

/** A part on one side of Net worth with the app it comes from. */
export interface SidePart<App> {
  readonly app: App
  readonly part: CountedHubPart
}

/** What you have or what you owe: its parts, largest first, and their total. */
export interface NetWorthSide<App> {
  readonly parts: readonly SidePart<App>[]
  readonly total: Money
}

export interface NetWorthSides<App> {
  readonly has: NetWorthSide<App>
  readonly owes: NetWorthSide<App>
}

/** The parts the set-up apps that have figures add to Net worth, split into what you have and what you owe, each largest first. */
export function netWorthSides<App extends PersonalApp>(apps: readonly App[]): NetWorthSides<App> {
  const parts = apps.flatMap((app) => (app.notSetUp || typeof app.figures !== 'object' || app.figures === null ? [] : app.figures.parts.map((part) => ({ app, part }))))
  const side = (which: CountedHubPart['side']): NetWorthSide<App> => {
    const onSide = parts.filter(({ part }) => part.side === which).sort((left, right) => right.part.cents - left.part.cents)
    return { parts: onSide, total: sumMoney(onSide.map(({ part }) => part.cents)) }
  }
  return { has: side('has'), owes: side('owes') }
}
