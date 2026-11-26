const TOKEN = /\{[^}]*\}/g

/** The words in braces a template names that the app does not fill in, in the order they appear. */
export function unknownTokensIn(template: string, known: readonly string[]): string[] {
  return (template.match(TOKEN) ?? []).filter((token) => !known.includes(token))
}

/** Why an invoice number, filing path or mail pattern cannot be used. */
export type PatternProblem =
  | { readonly kind: 'unknown-tokens'; readonly unknown: readonly string[]; readonly known: readonly string[] }
  | { readonly kind: 'blank-pattern' }
  | { readonly kind: 'sequence-not-once' }
  | { readonly kind: 'path-not-pdf' }
  | { readonly kind: 'blank-folder' }

/** The words in braces a pattern names that the app does not fill in, as a problem, or null when it fills in all of them. */
export function unknownTokensProblem(pattern: string, known: readonly string[]): PatternProblem | null {
  const unknown = unknownTokensIn(pattern, known)
  return unknown.length === 0 ? null : { kind: 'unknown-tokens', unknown, known }
}
