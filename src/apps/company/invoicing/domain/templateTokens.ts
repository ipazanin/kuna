const TOKEN = /\{[^}]*\}/g

/** The words in braces a template names that the app does not fill in, in the order they appear. */
export function unknownTokensIn(template: string, known: readonly string[]): string[] {
  return (template.match(TOKEN) ?? []).filter((token) => !known.includes(token))
}
