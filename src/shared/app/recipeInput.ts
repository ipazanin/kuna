import type { StrictSchema } from '../ai/domain/strictSchema'
import { TEXT, TEXT_OR_NULL, inputOf } from './operationInput'
import { DRAFT_DATE_FORMATS } from '../recipes/domain/tableRecipeDraft'
import type { TableRecipeFields } from '../recipes/domain/tableRecipeDraft'

/** A table recipe as an operation takes it, the same fields a recipe editor sets, with the optional columns and the kinds of the app's fields. `draftOfInput` reads it. */
export function tableRecipeInput(fields: TableRecipeFields): Readonly<Record<string, StrictSchema>> {
  return {
    name: TEXT,
    dateColumn: TEXT,
    dateFormat: { type: 'string', enum: DRAFT_DATE_FORMATS },
    amountColumn: TEXT_OR_NULL,
    debitColumn: TEXT_OR_NULL,
    creditColumn: TEXT_OR_NULL,
    decimalMark: { type: 'string', enum: ['comma', 'point'] },
    columns: inputOf(Object.fromEntries(fields.optional.map(({ field }) => [field, TEXT_OR_NULL]))),
    kinds: {
      type: 'array',
      items: inputOf({ kind: { type: 'string', enum: fields.kinds.map(({ kind }) => kind) }, column: TEXT_OR_NULL, equals: { type: ['array', 'null'], items: TEXT } }),
    },
  }
}
