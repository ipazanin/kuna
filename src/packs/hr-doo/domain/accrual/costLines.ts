import type { Category } from '../../../../features/workbook/domain/workbook'
import type { YearEndLine } from '../../../../features/workbook/domain/yearEnd'
import { ZERO, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { PACK_ROLES } from '../packRoles'

export const COST_LINES = [
  'material-costs',
  'personnel-costs',
  'depreciation',
  'other-costs',
  'impairment-provisions-other',
  'financial-expenses',
] as const

export type CostLine = (typeof COST_LINES)[number]

/** The profit and loss line of each cost class of the Croatian chart of accounts, by a konto's first two digits. */
const KONTO_CLASS_LINES: Readonly<Record<string, CostLine>> = {
  '40': 'material-costs',
  '41': 'material-costs',
  '42': 'personnel-costs',
  '43': 'depreciation',
  '44': 'impairment-provisions-other',
  '45': 'impairment-provisions-other',
  '46': 'other-costs',
  '47': 'financial-expenses',
  '48': 'impairment-provisions-other',
}

/**
 * The cost line a category counts on: where the accountant's konto lines put it, by the konto line
 * of the latest year-end at or before the year that names it, the largest when several do. A
 * category no konto line names counts by its bucket.
 */
export function costLineOf(category: Category, year: number, yearEnd: readonly YearEndLine[]): CostLine {
  const kontoYears = yearEnd.filter((line) => line.statement === 'konto' && line.year <= year).map((line) => line.year)
  const latest = Math.max(...kontoYears)
  const byLine = new Map<CostLine, Money>()
  for (const line of yearEnd) {
    const costLine = KONTO_CLASS_LINES[line.line.slice(0, 2)]
    if (line.statement === 'konto' && line.year === latest && costLine !== undefined && line.categories.includes(category.slug) && line.figure.kind === 'money') {
      byLine.set(costLine, addMoney(byLine.get(costLine) ?? ZERO, line.figure.amount))
    }
  }
  const named = [...byLine].sort(([, larger], [, smaller]) => smaller - larger)[0]
  return named?.[0] ?? bucketDefault(category)
}

function bucketDefault(category: Category): CostLine {
  if (category.bucket === 'owner-pay' || (category.bucket === 'taxes' && category.roles.includes(PACK_ROLES.ownerPayTax))) {
    return 'personnel-costs'
  }
  return category.bucket === 'taxes' ? 'other-costs' : 'material-costs'
}
