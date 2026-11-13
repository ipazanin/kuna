import type { Category } from '../../../../workbook/domain/workbook'
import type { YearEndLine } from '../yearEnd/yearEnd'
import { ZERO, addMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { taxClassOf } from '../../preset/domain/taxClassOf'
import { PACK_ROLES } from '../packRoles'

/** The income lines a category counted in profit goes on. Sales come from the invoices, so no category goes there. */
export const INCOME_LINES = ['other-operating-income', 'financial-income'] as const

export type IncomeLine = (typeof INCOME_LINES)[number]

export const COST_LINES = ['material-costs', 'personnel-costs', 'depreciation', 'other-costs', 'impairment-provisions-other', 'financial-expenses'] as const

export type CostLine = (typeof COST_LINES)[number]

/** A profit and loss line a category counts on. */
export type CategoryLine = IncomeLine | CostLine

/** The profit and loss line of each class of the Croatian chart of accounts, by a konto's first two digits. */
const KONTO_CLASS_LINES: Readonly<Record<string, CategoryLine>> = {
  '40': 'material-costs',
  '41': 'material-costs',
  '42': 'personnel-costs',
  '43': 'depreciation',
  '44': 'impairment-provisions-other',
  '45': 'impairment-provisions-other',
  '46': 'other-costs',
  '47': 'financial-expenses',
  '48': 'impairment-provisions-other',
  '77': 'financial-income',
  '78': 'other-operating-income',
}

/**
 * The income line a category counts on: where the accountant's konto lines put it, else where
 * its tax class puts it, else on other operating income.
 */
export function incomeLineOf(category: Category, year: number, yearEnd: readonly YearEndLine[]): IncomeLine {
  return kontoLineOf(category, year, yearEnd, INCOME_LINES) ?? classLineOf(category, INCOME_LINES) ?? 'other-operating-income'
}

/**
 * The cost line a category counts on: where the accountant's konto lines put it, else on
 * personnel costs for a tax owed because someone was paid, else on other costs when the category
 * says so, else where its tax class puts it. A category with no class counts by its bucket.
 */
export function costLineOf(category: Category, year: number, yearEnd: readonly YearEndLine[]): CostLine {
  const named = kontoLineOf(category, year, yearEnd, COST_LINES)
  if (named !== null) {
    return named
  }
  if (category.roles.includes(PACK_ROLES.ownerPayTax)) {
    return 'personnel-costs'
  }
  if (category.roles.includes(PACK_ROLES.otherCostsLine)) {
    return 'other-costs'
  }
  return classLineOf(category, COST_LINES) ?? bucketDefault(category)
}

/**
 * The line the konto lines of the latest year-end at or before the year put the category on,
 * the largest when several do, or null when none of them names it on one of the lines.
 */
function kontoLineOf<Line extends CategoryLine>(category: Category, year: number, yearEnd: readonly YearEndLine[], lines: readonly Line[]): Line | null {
  const kontoYears = yearEnd.filter((line) => line.statement === 'konto' && line.year <= year).map((line) => line.year)
  const latest = Math.max(...kontoYears)
  const byLine = new Map<Line, Money>()
  for (const line of yearEnd) {
    const placed = lines.find((candidate) => candidate === KONTO_CLASS_LINES[line.line.slice(0, 2)])
    if (line.statement === 'konto' && line.year === latest && placed !== undefined && line.categories.includes(category.slug) && line.figure.kind === 'money') {
      byLine.set(placed, addMoney(byLine.get(placed) ?? ZERO, line.figure.amount))
    }
  }
  const named = [...byLine].sort(([, larger], [, smaller]) => smaller - larger)[0]
  return named?.[0] ?? null
}

/** The line the category's tax class names for its bucket, or null when it has no class or the class names none there. */
function classLineOf<Line extends CategoryLine>(category: Category, lines: readonly Line[]): Line | null {
  const taxClass = category.roles.map(taxClassOf).find((candidate) => candidate !== null)
  const line = taxClass?.profitAndLossLines[category.bucket]
  return lines.find((candidate) => candidate === line) ?? null
}

function bucketDefault(category: Category): CostLine {
  switch (category.bucket) {
    case 'owner-pay':
      return 'personnel-costs'
    case 'taxes':
      return 'other-costs'
    default:
      return 'material-costs'
  }
}
