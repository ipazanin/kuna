import type { CountedRow } from './countedRow'
import type { MonthTotals } from './monthTotals'
import { rowSide } from '../../categories/domain/rowSide'
import type { Category, CategoryKind } from '../../workbook/domain/category'
import { monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/**
 * What a month kept by Overview's savings rate, income less spending, and what it became: money sent to investments, a bank
 * loan's principal paid back, things bought to own, and the rest, which stays in the accounts. The four add up to what was kept.
 */
export interface KeptMonth {
  readonly month: MonthKey
  readonly kept: Money
  readonly investments: Money
  readonly loanPrincipal: Money
  readonly assets: Money
  readonly rest: Money
  /** Rows of the month on a side or one of these kinds that the rates do not reach yet, so they count as nothing. */
  readonly unrated: number
}

/** The kinds what was kept can go to, each counted as money out above zero. */
const KEPT_KINDS = { saving: 'investments', repayment: 'loanPrincipal', asset: 'assets' } as const satisfies Partial<Record<CategoryKind, keyof KeptMonth>>

function isKeptKind(kind: CategoryKind): kind is keyof typeof KEPT_KINDS {
  return kind in KEPT_KINDS
}

/** Each month's kept money and where it went, from the rows in euros. */
export function keptMoney(rows: readonly CountedRow[], categories: readonly Category[], totalsOf: (month: MonthKey) => MonthTotals, months: readonly MonthKey[]): KeptMonth[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return months.map((month) => {
    const totals = totalsOf(month)
    const went = { investments: ZERO, loanPrincipal: ZERO, assets: ZERO }
    let unrated = 0
    for (const row of rows) {
      if (monthOf(row.day) !== month) continue
      const parts = rowSide(row, byId)
      if (parts.some((part) => part.counted === null && (part.side !== 'nowhere' || (part.category !== null && isKeptKind(part.category.kind))))) unrated += 1
      for (const { category, counted } of parts) {
        if (counted === null || category === null || !isKeptKind(category.kind)) continue
        const into = KEPT_KINDS[category.kind]
        went[into] = addMoney(went[into], counted)
      }
    }
    const kept = subtractMoney(totals.income, totals.spent)
    const rest = subtractMoney(subtractMoney(subtractMoney(kept, went.investments), went.loanPrincipal), went.assets)
    return { month, kept, ...went, rest, unrated }
  })
}
