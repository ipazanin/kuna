import type { AppContribution, AppHomeCard, CountedHubPart } from '../../shared/app/appContribution'
import type { NetWorthSide, NetWorthSides } from '../../shared/app/netWorthSides'
import { ratioOf, sumMoney } from '../../shared/money/money'
import { formatMoney, formatShare } from '../../shared/money/moneyFormat'
import type { MoneyFormat } from '../../shared/money/moneyFormat'
import { ZERO_SHARE } from '../../shared/money/percent'
import type { DonutPart } from '../../shared/ui/DonutCard.vue'
import { DEBT_LIST_COLOURS, FOLDED_COLOUR, foldOpenList } from '../../shared/ui/donutParts'
import { words } from './words'

/** An app as the rings read it: its colour and icon, and where it opens. */
export interface RingApp {
  readonly app: Pick<AppContribution, 'colour'> & { readonly homeCard: Pick<AppHomeCard, 'icon'> }
  /** Where the app opens, for a part that folds its parts. */
  readonly opens: string
}

/** What one `DonutCard` of Net worth shows. */
export interface NetWorthRing {
  readonly kind: 'ring'
  readonly side: 'has' | 'owes'
  readonly title: string
  readonly parts: readonly DonutPart[]
  readonly total: string
  readonly totalLabel: string
  readonly description: string
}

/** A side of Net worth with one part, shown as that part's row alone, since a ring of one part compares nothing. */
export interface NetWorthLonePart {
  readonly kind: 'part'
  readonly side: 'has' | 'owes'
  readonly title: string
  readonly app: RingApp['app']
  readonly part: CountedHubPart
  readonly figure: string
}

/**
 * The two sides of Net worth, each a ring from two parts up and a lone row with one. What you have is a fixed list, each part in its app's colour.
 * What you owe is an open list, its three largest parts in the debt colours by size and the rest in grey, folded into one part when there are two or more.
 * A side with no part shows nothing.
 */
export function netWorthRings<App extends RingApp>(sides: NetWorthSides<App>, format: MoneyFormat): (NetWorthRing | NetWorthLonePart)[] {
  const has = sides.has.parts.map(({ app, part }) => ({ ...partOf(part), colour: app.app.colour }))
  const { kept, folded } = foldOpenList(sides.owes.parts, DEBT_LIST_COLOURS)
  const foldedApps = new Set(folded.map(({ app }) => app.opens))
  const owes = [
    ...kept.map(({ part: { part }, colour }) => ({ ...partOf(part), colour })),
    ...(folded.length === 0
      ? []
      : folded.length === 1
        ? [{ ...partOf(folded[0]!.part), colour: FOLDED_COLOUR }]
        : [
            {
              key: 'other debts',
              label: words.otherDebts,
              value: sumMoney(folded.map(({ part }) => part.cents)),
              colour: FOLDED_COLOUR,
              to: foldedApps.size === 1 ? [...foldedApps][0]! : null,
            },
          ]),
  ]
  return [side('has', words.has, has, sides.has, format), side('owes', words.owes, owes, sides.owes, format)].flatMap((shown) => (shown === null ? [] : [shown]))
}

function partOf(part: NetWorthSide<RingApp>['parts'][number]['part']): Omit<DonutPart, 'colour'> {
  return { key: part.key, label: part.label, value: part.cents, to: part.to, caption: part.caption }
}

function side(which: NetWorthRing['side'], title: string, parts: readonly DonutPart[], of: NetWorthSide<RingApp>, format: MoneyFormat): NetWorthRing | NetWorthLonePart | null {
  const [only, ...more] = of.parts
  if (only === undefined) return null
  const total = formatMoney(of.total, 'negative', format)
  if (more.length === 0) return { kind: 'part', side: which, title, app: only.app.app, part: only.part, figure: total }
  return {
    kind: 'ring',
    side: which,
    title,
    parts,
    total,
    totalLabel: words.inAll,
    description: words.ringDescription(
      title,
      total,
      parts.map((part) => words.ringPart(part.label, formatMoney(part.value, 'negative', format), formatShare(ratioOf(part.value, of.total) ?? ZERO_SHARE))),
    ),
  }
}
