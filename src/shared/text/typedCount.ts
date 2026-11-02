/** A whole number above zero typed as digits, such as an instalment's number, or null for anything else. */
export function typedCount(text: string): number | null {
  const typed = text.trim()
  return /^\d+$/.test(typed) && Number(typed) >= 1 ? Number(typed) : null
}
