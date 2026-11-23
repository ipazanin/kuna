import type { Money } from '../../../../../shared/money/money'
import type { YearEndLine } from './yearEnd/yearEnd'

/**
 * The share capital the accountant's latest balance sheet of the year or before states, with that year, or null while no year-end
 * tab holds one. The capital is the company's registered fact, so a later year keeps it until a balance sheet states another.
 */
export function filedShareCapital(yearEndLines: readonly YearEndLine[], upTo: number): { readonly year: number; readonly amount: Money } | null {
  let latest: { readonly year: number; readonly amount: Money } | null = null
  for (const line of yearEndLines) {
    if (line.year > upTo || line.statement !== 'balance' || line.line !== 'share-capital' || line.figure.kind !== 'money') continue
    if (latest === null || line.year > latest.year) latest = { year: line.year, amount: line.figure.amount }
  }
  return latest
}
