/** Words a slug carries in lower case that read as acronyms on screen. */
const ACRONYMS = new Set(['ai', 'vat', 'it'])

/** A slug with spaces for hyphens and a capital first letter, such as "AI services". */
export function slugInWords(slug: string): string {
  const text = slug
    .split('-')
    .filter((word) => word !== '')
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word))
    .join(' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}
