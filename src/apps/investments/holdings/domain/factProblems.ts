import { investmentLots } from './lots'
import type { FactProblem, FactsBook } from '../../prices/domain/factsBook'
import type { Instrument } from '../../workbook/domain/instrument'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'

/** A holding held now, and what vendors sent nothing Kuna can use for. */
export interface HoldingFactProblems {
  readonly instrument: Instrument
  readonly problems: readonly FactProblem[]
}

/** The holdings held now that a vendor sent nothing usable for, in the file's order. A sold one is asked about no more, so it is left out. */
export function holdingsWithFactProblems(book: InvestmentBook, facts: FactsBook): HoldingFactProblems[] {
  const lots = investmentLots(book)
  return book.instruments.flatMap((instrument) => {
    const held = (lots.get(instrument.id)?.open ?? []).some((lot) => lot.quantity > DECIMAL_ZERO)
    const problems = held ? facts.problemsOf(instrument) : []
    return problems.length === 0 ? [] : [{ instrument, problems }]
  })
}
