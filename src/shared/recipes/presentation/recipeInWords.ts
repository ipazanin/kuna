import type { SavedRecipe } from '../domain/savedRecipe'
import { draftOfRecipe } from '../domain/tableRecipeDraft'
import type { DraftKind, TableRecipeDraft, TableRecipeFields } from '../domain/tableRecipeDraft'
import { dayExample } from './dayExample'
import { words } from './words'

/** What an app calls the fields it reads from a recipe's rows and its kinds of row, by their keys. */
export interface RecipeNames {
  readonly fields: Readonly<Record<string, string>>
  readonly kinds: Readonly<Record<string, string>>
}

function kindLine({ kind, test }: DraftKind, names: RecipeNames): string {
  const name = names.kinds[kind] ?? kind
  if (test === null) return words.inWords.everyRow(name)
  return 'filled' in test ? words.inWords.whenFilled(name, test.column) : words.inWords.whenIs(name, test.column, test.is.join(words.inWords.or))
}

/** A draft in plain words, a line per field it reads and per kind of row, in the order they are tried. */
function draftLines(draft: TableRecipeDraft, fields: TableRecipeFields, names: RecipeNames): readonly string[] {
  const fieldName = (field: string): string => names.fields[field] ?? field
  const amount =
    'column' in draft.amount
      ? [words.inWords.readsFrom(fieldName(fields.amount), draft.amount.column)]
      : [words.inWords.readsFrom(fieldName(fields.debit), draft.amount.debit), words.inWords.readsFrom(fieldName(fields.credit), draft.amount.credit)]
  const optional = fields.optional.flatMap(({ field }) => {
    const column = draft.columns[field]
    return column === undefined ? [] : [words.inWords.readsFrom(fieldName(field), column)]
  })
  return [
    words.inWords.dayFrom(draft.date.column, dayExample(draft.date.format)),
    ...amount.map((line) => `${line}, ${words.inWords.marks[draft.mark]}`),
    ...optional,
    ...draft.kinds.map((kind) => kindLine(kind, names)),
  ]
}

/** A saved recipe in plain words, as a chat card shows it, or the note that it reads as Kuna keeps it where no draft holds it. */
export function recipeInWords(saved: SavedRecipe, fields: TableRecipeFields, names: RecipeNames): string {
  const draft = draftOfRecipe(saved.recipe, fields)
  return draft === null ? words.inWords.notEditable : draftLines(draft, fields, names).join(' · ')
}
