import { intlLocale } from './language'

/** How English writes a counted phrase: one, and every other count. */
export interface EnglishForms {
  readonly one: string
  readonly other: string
}

/** How Croatian writes a counted phrase: 1 and 21 take `one`, 2 to 4 and 22 take `few`, and 5, 11 and 1.5 take `other`. */
export interface CroatianForms {
  readonly one: string
  readonly few: string
  readonly other: string
}

/**
 * The Croatian words for an English dictionary: the same keys and parameters, and the three forms
 * wherever English has two. A counted phrase is a function that takes the count first.
 */
export type Translation<English> = {
  readonly [Key in keyof English]: English[Key] extends string
    ? string
    : English[Key] extends (...inputs: infer Inputs) => EnglishForms
      ? (...inputs: Inputs) => CroatianForms
      : English[Key] extends (...inputs: infer Inputs) => string
        ? (...inputs: Inputs) => string
        : Translation<English[Key]>
}

const PLURAL_RULES = new Intl.PluralRules(intlLocale)

/** The form the language on screen writes `count` with. */
export function plural(forms: EnglishForms | CroatianForms, count: number): string {
  const byCategory: Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> = forms
  return byCategory[PLURAL_RULES.select(count)] ?? forms.other
}
