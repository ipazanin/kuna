/** The text with its first letter in upper case, for a phrase that starts a sentence. */
export function capitalised(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`
}

/**
 * The text with its first letter in lower case, for a label that goes inside a sentence. A first
 * word in capitals, such as PDV or II., keeps them.
 */
export function uncapitalised(text: string): string {
  return /^\p{Lu}[\p{Lu}.]/u.test(text) ? text : `${text.charAt(0).toLowerCase()}${text.slice(1)}`
}
