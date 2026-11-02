import type { HoldingMix } from '../domain/holdingMix'
import { HOLDINGS_ROUTE } from './holdingLinks'
import { words } from './words'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { ClassGroup, Mix, Region } from '../../workbook/domain/mixGroup'
import { REGIONS } from '../../workbook/domain/mixGroup'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, sumMoney } from '../../../../shared/money/money'
import { formatMoney, formatShare } from '../../../../shared/money/moneyFormat'
import { countryName } from '../../../../shared/text/countryName'
import type { DonutPart } from '../../../../shared/ui/DonutCard.vue'

/** What a `DonutCard` of one mix shows. */
export interface MixDonut {
  readonly parts: readonly DonutPart[]
  readonly total: string
  readonly totalLabel: string
  readonly description: string
  /** The largest group and its share for the card's collapsed line, or the total when there is no group. */
  readonly summary: string
  /** What a part's link opens, for a screen reader, when its parts open Holdings grouped that way. */
  readonly opens: string | undefined
}

const SHOWN = 4
const OPEN_COLOURS = ['--series-1', '--series-2', '--series-3', '--series-4']
const OTHER_COLOUR = '--chart-deemphasis'
const CLASS_COLOURS: Readonly<Record<ClassGroup, string>> = {
  stocks: '--invest-stocks',
  bonds: '--invest-bonds',
  'money-market': '--invest-money-market',
  crypto: '--invest-crypto',
  gold: '--invest-gold',
  cash: '--invest-cash',
}

/**
 * A mix as the parts of a ring. Class is a fixed list, so every class keeps its own colour. The others are open lists:
 * the four largest groups take the series colours by size, and the rest with what no source places yet is one grey
 * part. Class and currency parts open Holdings grouped that way, at the day `on` names, or today when it is null.
 */
export function mixDonut<Of extends Mix>(mix: HoldingMix<Of>, book: Pick<InvestmentBook, 'accounts'>, on: CivilDate | null): MixDonut {
  const kind: Mix = mix.mix
  const opened = kind === 'class' || kind === 'currency' ? kind : null
  const to = opened === null ? null : { path: HOLDINGS_ROUTE, query: on === null ? { group: opened } : { group: opened, on } }
  const coloured =
    kind === 'class' ? mix.parts.map((part) => ({ part, colour: CLASS_COLOURS[part.group as ClassGroup] })) : mix.parts.slice(0, SHOWN).map((part, place) => ({ part, colour: OPEN_COLOURS[place]! }))
  const folded = mix.parts.slice(coloured.length)
  const rest = sumMoney([mix.unknown, ...folded.map((part) => part.value)])
  const parts: DonutPart[] = [
    ...coloured.map(({ part, colour }) => ({ key: part.group, label: groupName(kind, part.group, book), value: part.value, colour, to })),
    ...(rest === ZERO ? [] : [{ key: 'other', label: words.mixes.other, value: rest, colour: OTHER_COLOUR, to }]),
  ]
  const title = words.mixes.titles[kind]
  const total = formatMoney(mix.whole)
  const largest = mix.parts[0]
  return {
    parts,
    total,
    totalLabel: kind === 'sector' || kind === 'country' ? words.mixes.ofHoldings : words.mixes.value,
    description: words.mixes.description(title, total, parts.map((part) => words.mixes.part(part.label, formatMoney(part.value), shareOf(part.value, mix.whole))).join(', ')),
    summary: largest === undefined ? total : words.mixes.largest(groupName(kind, largest.group, book), shareOf(largest.value, mix.whole)),
    opens: opened === null ? undefined : words.mixes.opens[opened],
  }
}

function shareOf(value: number, whole: number): string {
  return whole === 0 ? '–' : formatShare(value / whole)
}

/** A group as the screen names it: a class, a sector or a region in words, a country by its name, an account by its own and a currency by its code. */
export function groupName(mix: Mix, group: string, book: Pick<InvestmentBook, 'accounts'>): string {
  switch (mix) {
    case 'class':
      return words.classes[group as ClassGroup]
    case 'sector':
      return words.sectors[group as keyof typeof words.sectors]
    case 'country':
      return (REGIONS as readonly string[]).includes(group) ? words.regions[group as Region] : countryName(group)
    case 'account':
      return book.accounts.find((account) => account.id === group)?.name ?? group
    case 'currency':
      return group
  }
}
