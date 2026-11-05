const COMBINING_MARKS = /[̀-ͯ]/g

/**
 * Text folded for comparison: accents stripped, upper case, runs of whitespace collapsed. `đ` has
 * no decomposition, so it is mapped to `d` by hand before the accents go.
 */
export function fold(text: string): string {
  return text.replace(/đ/g, 'd').replace(/Đ/g, 'D').normalize('NFD').replace(COMBINING_MARKS, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

/**
 * Text folded for the rules: accents stripped, upper case, whitespace collapsed. Unlike `fold`,
 * `đ` survives, so stored rules keep matching the rows they were written for.
 */
export function foldRuleText(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

/** An IBAN as the bank prints it, minus the grouping spaces statements disagree about. */
export function normaliseIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase()
}
