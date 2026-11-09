/** The most characters of a cell that leave. A longer one is cut, with `[cut]` after it. */
export const MOST_CELL_CHARACTERS = 200

/** What a cell shaped like a key leaves as. */
export const KEY_REMOVED = '[key removed]'

/** What a cut cell ends with. */
export const CUT = '[cut]'

/**
 * Control characters, zero-width characters, the marks that turn text right to left, variation selectors and the tag
 * characters a model reads as hidden letters, all of which can hide what a cell says.
 */
const UNSEEN =
  /[\u{0000}-\u{0008}\u{000B}\u{000C}\u{000E}-\u{001F}\u{007F}-\u{009F}\u{00AD}\u{061C}\u{180E}\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2060}-\u{2069}\u{FE00}-\u{FE0F}\u{FEFF}\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu

/** A cell kept on the device this long at most, so aliasing a huge cell stays quick. Longer than what leaves, so a cut never splits an IBAN that would then pass unmasked. */
const MOST_CELL_HELD = 1_000

/** A cell's text with what a person cannot see stripped, line breaks and tabs as spaces, and anything past what is held dropped. */
export function cleanCell(cell: string): string {
  return cell
    .replace(UNSEEN, '')
    .replace(/[\t\r\n\u2028\u2029]+/gu, ' ')
    .trim()
    .slice(0, MOST_CELL_HELD)
}

/** A cell as it leaves, cut at the most characters that leave. */
export function cutCell(cell: string): string {
  return cell.length > MOST_CELL_CHARACTERS ? `${cell.slice(0, MOST_CELL_CHARACTERS)} ${CUT}` : cell
}

/** A header or a path that names an account, an IBAN, an OIB or a card, in English or in Croatian, whose cells go whole under a token. */
const IDENTIFIER_HEADER = /\b(?:iban|oib|account|acct|ra[čc]un|card|kartic)/iu

/** A header that names an amount, a balance, a day or a currency, such as `Iznos u valuti računa`, whose cells are never identifiers. */
const FIGURE_HEADER = /iznos|stanje|saldo|amount|balance|datum|date|valut|currency/iu

/** An amount with a decimal mark, such as `1.234,56`, `-2,500.00` or `12 345,67 EUR`. */
const AMOUNT_SHAPE = /^[-+−]?\s*\d[\d\s.,'\u00A0\u202F]*[.,]\d{1,2}(?:\s*[A-Z]{3})?$/u

/** A day, with or without a time, such as `07.11.2026.`, `2026-11-07` or `11/7/26 14:05`. */
const DATE_SHAPE = /^\d{1,4}[./-]\s?\d{1,2}[./-]\s?\d{1,4}\.?(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/u

/** Whether a header cell, or the path of a value in XML or JSON, names identifiers rather than an amount, a day or a currency of an account. */
export function namesIdentifiers(header: string): boolean {
  return IDENTIFIER_HEADER.test(header) && !FIGURE_HEADER.test(header)
}

/** Whether a cell named as an identifier is shaped like one: six digits or more, and neither an amount nor a day. An account's name stays words. */
export function holdsIdentifier(cell: string): boolean {
  const trimmed = cell.trim()
  return (trimmed.match(/\d/g)?.length ?? 0) >= 6 && !AMOUNT_SHAPE.test(trimmed) && !DATE_SHAPE.test(trimmed)
}

/** The value after a tag that names an account in a file of lines, such as OFX's `<ACCTID>` or MT940's `:25:`. */
export const ACCOUNT_TAGGED = /(<ACCTID>|^:25:)([^<\s]+)/giu
