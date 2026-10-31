import { language } from '../text/language'
import { AMOUNT_MULTIPLIER_ZEROS, AMOUNT_SEPARATORS } from './typedAmount'

/** A money field's text after an edit, and where its caret goes. */
export interface AmountEdit {
  readonly text: string
  readonly caret: number
}

/** Thirteen whole digits reach ten trillion, and keep the cents a safe integer. */
const MOST_WHOLE_DIGITS = 13

const CENT_PLACES = 2

const LARGEST_MULTIPLIER_ZEROS = Math.max(...Object.values(AMOUNT_MULTIPLIER_ZEROS))

const { group: GROUP, decimal: DECIMAL } = AMOUNT_SEPARATORS[language]

interface Piece {
  /**
   * A digit, a k or an m, the decimal mark, or the group mark typed where a decimal mark could go. That last one is
   * read as the decimal mark until a third digit follows it, which makes it a group mark.
   */
  readonly kind: 'digit' | 'multiplier' | 'mark' | 'pending'
  readonly text: string
}

interface Amount {
  readonly whole: string
  readonly fraction: string | null
  readonly pending: boolean
  readonly multiplied: boolean
}

const PASTED_PLAIN = /^\d*(?:[.,]\d{0,2})?$/
const PASTED_GROUPED = /^\d{1,3}([.,])\d{3}(?:\1\d{3})*(?:([.,])\d{0,2})?$/
/** An amount in the language's own marks: digits and group marks, then the decimal mark and its digits. */
const OWN_MARKS = new RegExp(`^[\\d\\${GROUP}]*(?:\\${DECIMAL}\\d*)?$`)
const STORED = /^(\d+)(?:\.(\d+))?$/
const OWN_DECIMALS = new RegExp(`^(\\d+)\\${DECIMAL}(\\d{3,})$`)
const SHOWN = new RegExp(`^\\d{1,3}(?:\\${GROUP}\\d{3})*(?:[${GROUP}${DECIMAL}]\\d{0,2})?$`)

/**
 * The text a money field shows after an edit turned `previous` into `next`, grouped as the language on screen writes
 * amounts, and where its caret goes. A decimal mark takes two digits, or up to eight at the end of the field, where a k
 * or an m can still follow. A group mark typed after a number is shown as typed and read as the decimal mark until a
 * third digit makes it a group mark, as `typedAmount` reads it. A k or an m multiplies the whole amount at once, and is
 * refused when the decimals before it would leave a fraction of a cent. A paste that does not read as one amount leaves
 * the field as it was.
 */
export function amountTyped(previous: string, next: string, caret: number, forward = false): AmountEdit {
  const start = Math.min(commonStart(previous, next), caret)
  const inserted = next.slice(start, caret)
  const after = next.slice(caret)
  const afterStart = previous.length - after.length
  const pending = pendingMark(previous)
  let beforePieces = keptPieces(next.slice(0, start), pending)
  let afterPieces = keptPieces(after, pending - afterStart)
  const pendingDeleted = pending >= start && pending < afterStart
  if (inserted === '' && !pendingDeleted && next.length < previous.length && withoutGroups(next) === withoutGroups(previous)) {
    // Deleting a group mark alone would change nothing, so the digit beside it goes too.
    if (forward) afterPieces = withoutPiece(afterPieces, afterPieces.findIndex(isDigit))
    else beforePieces = withoutPiece(beforePieces, beforePieces.map(isDigit).lastIndexOf(true))
  }
  const fieldHasMark = [...beforePieces, ...afterPieces].some(isMark)
  const added = inserted.length > 1 ? pastedPieces(inserted, fieldHasMark) : typedPieces(inserted, fieldHasMark)
  const decimals = afterPieces.some(isDigit) ? CENT_PLACES : CENT_PLACES + LARGEST_MULTIPLIER_ZEROS
  const amount = added === null ? null : amountOf([...beforePieces, ...added, ...afterPieces], decimals)
  if (amount === null || amount.whole.length > MOST_WHOLE_DIGITS) return { text: previous, caret: start }
  const text = amountText(amount)
  const afterCaret = afterPieces.filter((piece) => isDigit(piece) || amount.fraction !== null).length
  return { text, caret: amount.multiplied ? text.length : caretBefore(text, afterCaret, pendingMark(text)) }
}

/** The amount a field shows once left, with its cents, such as 1,500.00 for 1,500. Text that is not an amount stays as it is, a blank field included. */
export function finishedAmount(text: string): string {
  if (!SHOWN.test(text)) return text
  const pending = pendingMark(text)
  const decided = pending === -1 ? text : `${text.slice(0, pending)}${DECIMAL}${text.slice(pending + 1)}`
  const [whole, fraction = ''] = withoutGroups(decided).split(DECIMAL)
  return `${grouped(whole!)}${DECIMAL}${fraction.padEnd(2, '0')}`
}

/**
 * An amount given from outside the field, such as `1500.00` from `plainAmount`, as the field shows it once left. Stored
 * decimal text is never read as grouped, and more than two decimals stay as they are with the language's decimal mark,
 * so `typedAmount` refuses them. Other text is read as a paste and shown as it is when it is not an amount.
 */
export function amountShown(text: string): string {
  const decimal = STORED.exec(text) ?? OWN_DECIMALS.exec(text)
  if (decimal !== null) {
    const [, whole, fraction = ''] = decimal
    return fraction.length > 2 ? `${whole}${DECIMAL}${fraction}` : `${grouped(whole!)}${DECIMAL}${fraction.padEnd(2, '0')}`
  }
  const pieces = pastedPieces(text, false)
  const amount = pieces === null ? null : amountOf(pieces, CENT_PLACES)
  return amount === null ? text : finishedAmount(amountText(amount))
}

/** Null when the amount keeps more than `decimals` decimals, or any fraction of a cent once a k or an m multiplies it. */
function amountOf(pieces: readonly Piece[], decimals: number): Amount | null {
  const markAt = pieces.findIndex(isMark)
  const digits = (from: number, to: number) =>
    pieces
      .slice(from, to)
      .filter(isDigit)
      .map((piece) => piece.text)
      .join('')
  let whole = digits(0, markAt === -1 ? pieces.length : markAt)
  let fraction = markAt === -1 ? null : digits(markAt + 1, pieces.length)
  if (fraction !== null && fraction.length > CENT_PLACES && pieces[markAt]!.kind === 'pending') {
    whole += fraction
    fraction = null
  }
  const zeros = pieces.filter((piece) => piece.kind === 'multiplier').reduce((count, piece) => count + AMOUNT_MULTIPLIER_ZEROS[piece.text]!, 0)
  const multiplied = zeros > 0 && whole + (fraction ?? '') !== ''
  if (fraction !== null && fraction.length > (multiplied ? CENT_PLACES + zeros : decimals)) return null
  if (multiplied) {
    const shifted = (fraction ?? '').padEnd(zeros, '0')
    whole += shifted.slice(0, zeros)
    fraction = shifted.length > zeros ? shifted.slice(zeros) : null
  }
  whole = whole.replace(/^0+(?=\d)/, '')
  if (whole === '' && fraction !== null) whole = '0'
  return { whole, fraction, pending: fraction !== null && pieces[markAt]!.kind === 'pending', multiplied }
}

function amountText(amount: Amount): string {
  return `${grouped(amount.whole)}${amount.fraction === null ? '' : `${amount.pending ? GROUP : DECIMAL}${amount.fraction}`}`
}

/** Where the field's text holds a group mark still read as the decimal mark, which only such a mark leaves with fewer than three digits after it. */
function pendingMark(text: string): number {
  const at = text.lastIndexOf(GROUP)
  return at !== -1 && !text.includes(DECIMAL) && /^\d{0,2}$/.test(text.slice(at + 1)) ? at : -1
}

function commonStart(left: string, right: string): number {
  let index = 0
  while (index < left.length && index < right.length && left[index] === right[index]) index += 1
  return index
}

function withoutGroups(text: string): string {
  return text.replaceAll(GROUP, '')
}

function grouped(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+$)/g, GROUP)
}

function isDigit(piece: Piece): boolean {
  return piece.kind === 'digit'
}

function isMark(piece: Piece): boolean {
  return piece.kind === 'mark' || piece.kind === 'pending'
}

function withoutPiece(pieces: readonly Piece[], index: number): Piece[] {
  return pieces.filter((_piece, at) => at !== index)
}

function keptPieces(text: string, pendingAt: number): Piece[] {
  return [...text].flatMap((character, index): Piece[] => {
    if (/\d/.test(character)) return [{ kind: 'digit', text: character }]
    if (character === DECIMAL) return [{ kind: 'mark', text: character }]
    return index === pendingAt ? [{ kind: 'pending', text: character }] : []
  })
}

function typedPieces(key: string, fieldHasMark: boolean): Piece[] {
  const character = key.toLowerCase()
  if (/^\d$/.test(character)) return [{ kind: 'digit', text: character }]
  if (Object.hasOwn(AMOUNT_MULTIPLIER_ZEROS, character)) return [{ kind: 'multiplier', text: character }]
  if (fieldHasMark) return []
  if (character === DECIMAL) return [{ kind: 'mark', text: character }]
  return character === GROUP ? [{ kind: 'pending', text: character }] : []
}

/**
 * A pasted amount, grouped either way, with an optional currency sign, spaces and one k or m at the end. When both
 * marks appear, the one after the groups of three is the decimal mark. Before a k or an m, an amount in the language's
 * own marks reads as typing it would, so 1.255m in English is 1,255,000 and 1,255m is 1,255,000,000. Null for anything
 * else.
 */
function pastedPieces(text: string, fieldHasMark: boolean): Piece[] | null {
  const cleaned = text.toLowerCase().replace(/[\s€$£]/g, '')
  const multiplier = Object.hasOwn(AMOUNT_MULTIPLIER_ZEROS, cleaned.slice(-1)) ? cleaned.slice(-1) : ''
  const number = cleaned.slice(0, cleaned.length - multiplier.length)
  if (multiplier !== '' && /\d/.test(number) && OWN_MARKS.test(number)) {
    if (number.includes(DECIMAL) && fieldHasMark) return null
    return [...keptPieces(number, pendingMark(number)), { kind: 'multiplier', text: multiplier }]
  }
  const grouping = PASTED_GROUPED.exec(number)
  const plain = PASTED_PLAIN.test(number)
  if (!/\d/.test(number) || (!plain && (grouping === null || grouping[1] === grouping[2]))) return null
  const decimalAt = plain ? number.search(/[.,]/) : grouping![2] === undefined ? -1 : number.lastIndexOf(grouping![2])
  if (decimalAt !== -1 && fieldHasMark) return null
  const pieces = [...number].flatMap((character, index): Piece[] => (/\d/.test(character) ? [{ kind: 'digit', text: character }] : index === decimalAt ? [{ kind: 'mark', text: DECIMAL }] : []))
  return multiplier === '' ? pieces : [...pieces, { kind: 'multiplier', text: multiplier }]
}

/** The caret position with `significant` digits and marks after it, left of any group mark there, so it sits beside the digit before it. */
function caretBefore(text: string, significant: number, pendingAt: number): number {
  const counts = (index: number) => text[index] !== GROUP || index === pendingAt
  let index = text.length
  for (let seen = 0; index > 0 && seen < significant; index -= 1) {
    if (counts(index - 1)) seen += 1
  }
  while (index > 0 && !counts(index - 1)) index -= 1
  return index
}
