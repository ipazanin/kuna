import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { Recipe } from '../../../../shared/recipes/domain/recipe'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A recipe the Spending file keeps for a bank's statement files, which Import tries after the ones Kuna brings. */
export interface SavedRecipe {
  readonly id: RecordId
  /** The bank whose accounts take the rows, by the name its accounts give it. */
  readonly bank: string
  /** The currency of every row, for a file whose rows name none, or null when each row names its own. */
  readonly currency: CurrencyCode | null
  readonly recipe: Recipe
}
