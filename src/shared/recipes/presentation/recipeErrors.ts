import type { DraftPlace } from '../domain/tableRecipeDraft'

/** A field of the recipe editor that shows a problem under it. */
export type RecipeErrorField = 'name' | 'bank' | 'currency' | 'day' | 'format' | 'amount' | 'kinds'

/** A part of one kind of row that shows a problem under it. */
export type KindErrorPart = 'kind' | 'column' | 'values'

/**
 * The problems of a recipe in the editor, in the app's words: one under each field, one under each part of a kind by the
 * kind's place, and a rule across fields, which shows only once every field is fine.
 */
export interface RecipeErrors {
  readonly fields: Readonly<Partial<Record<RecipeErrorField, string>>>
  readonly kinds: Readonly<Record<number, Readonly<Partial<Record<KindErrorPart, string>>>>>
  readonly across: string | null
}

export const NO_RECIPE_ERRORS: RecipeErrors = { fields: {}, kinds: {}, across: null }

/** The errors of a recipe from its problems, each with where it sits and its words. The first problem of a place shows there. */
export function recipeErrorsOf(problems: readonly { readonly place: DraftPlace | 'bank' | 'currency'; readonly text: string }[]): RecipeErrors {
  const fields: Partial<Record<RecipeErrorField, string>> = {}
  const kinds: Record<number, Partial<Record<KindErrorPart, string>>> = {}
  const across: string[] = []
  for (const { place, text } of problems) {
    if (place === 'across') across.push(text)
    else if (typeof place === 'string') fields[place] ??= text
    else (kinds[place.at] ??= {})[place.part] ??= text
  }
  const fieldsFine = Object.keys(fields).length === 0 && Object.keys(kinds).length === 0
  return { fields, kinds, across: fieldsFine ? (across[0] ?? null) : null }
}
