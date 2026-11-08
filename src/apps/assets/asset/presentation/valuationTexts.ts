import { words as assetsWords } from '../../words'
import type { Valuation } from '../../workbook/domain/valuation'
import { words } from './words'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'

/** What the valuation dialog's fields hold while they are typed. */
export interface ValuationTexts {
  readonly date: string
  readonly value: string
}

/** What a valuation is checked against: the day its asset was bought, and the asset's other valuations. */
export interface ValuationContext {
  readonly bought: CivilDate | null
  readonly valuations: readonly Pick<Valuation, 'id' | 'date'>[]
  /** The valuation being changed, or null for a new one. */
  readonly editing: Valuation['id'] | null
}

/** What each field says is wrong with it, null for a field that is fine. */
export type ValuationErrors = {
  readonly date: string | null
  readonly value: string | null
}

/**
 * The day and value the dialog's fields give, with what is wrong under each, as the dialog checks them: a real day, not
 * before the asset was bought and not on a day another valuation has, and a value of zero or more. The terms are null while any field is wrong.
 */
export function typedValuationTerms(
  texts: ValuationTexts,
  context: ValuationContext,
): { readonly errors: ValuationErrors; readonly terms: { readonly date: CivilDate; readonly value: Money } | null } {
  const day = parseCivilDate(texts.date)
  const value = typedAmount(texts.value)
  const errors: ValuationErrors = {
    date:
      day === null
        ? assetsWords.form.aDate(civilDate(2026, 5, 1))
        : context.bought !== null && day < context.bought
          ? words.valuationDialog.notBeforeBought
          : context.valuations.some((other) => other.date === day && other.id !== context.editing)
            ? words.valuationDialog.sharesDay
            : null,
    value: value === null ? words.valuationDialog.anAmount : null,
  }
  return { errors, terms: errors.date !== null || errors.value !== null || day === null || value === null ? null : { date: day, value } }
}
