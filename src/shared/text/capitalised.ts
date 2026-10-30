/** The text with its first letter in upper case, for a phrase that starts a sentence. */
export function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}
