import { listInWords } from './listInWords'

/** "4‑1‑26 and 5‑1‑26", with each hyphen a non-breaking one, so a line never breaks inside a number such as an invoice's. */
export function numbersInWords(numbers: readonly string[]): string {
  return listInWords(numbers.map((number) => number.replaceAll('-', '‑')))
}
