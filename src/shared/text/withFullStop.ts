/** The text closed with a full stop, unless it already ends with one, as a Croatian date such as 1. 5. 2024. does. */
export function withFullStop(text: string): string {
  return text.endsWith('.') ? text : `${text}.`
}
