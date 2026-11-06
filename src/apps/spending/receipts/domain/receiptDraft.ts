import type { FiscalQr } from './fiscalQr'
import { isValidOib, oibIn } from './oib'
import { words } from './words'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMoney, moneyFromAmount, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { fold } from '../../../../shared/text/fold'

/** How a line's choice names a new category the model suggests. */
export const NEW_CHOICE_PREFIX = 'new:'

/** The category a model's answer names for a line that fits none of the list. */
export const NEW_CATEGORY = 'new'

export const LINE_KINDS = ['product', 'discount', 'deposit', 'tip', 'fee'] as const

/** One line as the model wrote it. */
export interface AnsweredLine {
  readonly printed: string
  readonly text: string
  readonly kind: (typeof LINE_KINDS)[number]
  readonly quantity: number | null
  readonly unitPrice: number | null
  readonly lineTotal: number
  /** A category's ref, or `new`. */
  readonly category: string
  readonly newCategory: string | null
}

/** A model's read of a receipt, as the schema lets it answer, with amounts in euros as numbers. */
export interface ReceiptAnswer {
  readonly merchant: { readonly name: string; readonly oib: string | null }
  readonly buyerOib: string | null
  /** The receipt is marked R1, with or without a buyer's OIB. */
  readonly markedR1: boolean
  readonly issuedOn: string | null
  readonly issuedAt: string | null
  readonly jir: string | null
  readonly zki: string | null
  readonly lines: readonly AnsweredLine[]
  readonly vat: readonly { readonly base: number; readonly tax: number }[]
  readonly total: number
  readonly unreadable: readonly string[]
}

/** A line as the draft shows it, its amount signed as money out is, in cents. */
export interface DraftLine {
  readonly printed: string
  readonly text: string
  readonly amount: Money
  /** Null while it waits for you: the model asked for a new category or picked none. */
  readonly category: RecordId | null
  /** The new category the model suggests, which you accept, rename or map. Never made silently. */
  readonly suggested: string | null
}

/** A checked read, which nothing writes until you confirm it. */
export interface ReceiptRead {
  readonly merchant: string
  readonly merchantOib: string
  readonly buyerOib: string
  /** The QR code's when there is one. */
  readonly issuedOn: CivilDate | null
  readonly issuedTime: string
  readonly jir: string
  readonly zki: string
  /** The QR code's when there is one. Null when neither gives one above zero. */
  readonly total: Money | null
  readonly lines: readonly DraftLine[]
  /** A receipt for the company, whose lines all start under For the company. */
  readonly r1: boolean
  /** Marked R1, or naming a buyer, with no OIB to tell whose: only you can say whether it is for the company. */
  readonly r1Asked: boolean
}

/** Your answer to a receipt marked R1 with no buyer's OIB. */
export type R1Answer = 'company' | 'personal'

/** The choice each line starts with: its category, its suggestion, or blank. */
export function firstChoices(read: ReceiptRead): readonly string[] {
  return read.lines.map((line) => line.category ?? (line.suggested === null ? '' : `${NEW_CHOICE_PREFIX}${line.suggested}`))
}

/** Each line's choice after you answer: all under For the company, or back as the read had them. */
export function choicesAfterR1(read: ReceiptRead, answer: R1Answer, company: RecordId): readonly string[] {
  return answer === 'company' ? read.lines.map(() => company) : firstChoices(read)
}

/** A category the model may name, under the ref a request knows it by. */
export interface CategoryRef {
  readonly ref: string
  readonly category: Category
  /** Its group's name, blank for a category with no parent. */
  readonly group: string
}

/** What the model may file a line under: spending categories a person can pick, so no group with children and nothing hidden, itself or by its group. For the company stays with the R1 rule in code. Refs follow the file's order. */
export function categoryRefs(categories: readonly Category[]): readonly CategoryRef[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const parents = new Set(categories.map((category) => category.parent))
  return categories
    .filter((category) => category.kind === 'spending' && !category.hidden && !parents.has(category.id) && !(category.parent !== null && byId.get(category.parent)?.hidden))
    .map((category, place) => ({ ref: `c${place + 1}`, category, group: category.parent === null ? '' : (byId.get(category.parent)?.name ?? '') }))
}

function sameMerchant(heldOib: string, heldName: string, oib: string, name: string): boolean {
  return heldOib !== '' && oib !== '' ? heldOib === oib : fold(heldName) === fold(name)
}

/** Confirmed lines that remember a category, newest receipt first. */
function rememberedLines(
  book: Pick<SpendingBook, 'receipts' | 'lines'>,
  merchantOib: string,
  merchant: string,
): readonly { readonly printed: string; readonly text: string; readonly category: RecordId }[] {
  return [...book.receipts]
    .filter((receipt) => sameMerchant(receipt.merchantOib, receipt.merchant, merchantOib, merchant))
    .sort((one, other) => other.issuedOn.localeCompare(one.issuedOn))
    .flatMap((receipt) => book.lines.filter((line) => line.receipt === receipt.id && line.printed !== ''))
}

/** The newest confirmed lines of a merchant, which a request sends as examples. */
export function recentLinesOf(
  book: Pick<SpendingBook, 'receipts' | 'lines'>,
  merchant: string,
  most: number,
): readonly { readonly printed: string; readonly text: string; readonly category: RecordId }[] {
  return merchant.trim() === '' ? [] : rememberedLines(book, '', merchant).slice(0, most)
}

/** What a read is checked against beside the answer itself. */
export interface DraftContext {
  readonly refs: readonly CategoryRef[]
  readonly qr: FiscalQr | null
  readonly book: Pick<SpendingBook, 'receipts' | 'lines' | 'categories'>
  /** The Company OIB on Settings, blank when none is saved. */
  readonly companyOib: string
}

const CLOCK = /^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?$/

/** A time as tills print it, such as `6:42`, `18.42` or `18:42:10`, as `HH:mm`, or null for anything else. */
function clockOf(text: string): string | null {
  const [, hours, minutes] = CLOCK.exec(text.trim()) ?? []
  if (hours === undefined || minutes === undefined || Number(hours) > 23 || Number(minutes) > 59) return null
  return `${hours.padStart(2, '0')}:${minutes}`
}

/** The time and codes a confirmed receipt keeps. A read already holds the QR code's, so the two never overwrite each other with a blank. */
export function fiscalFactsOf(read: ReceiptRead | null, qr: FiscalQr | null): Pick<ReceiptRead, 'issuedTime' | 'jir' | 'zki'> {
  const held = read ?? qr
  return { issuedTime: held?.issuedTime ?? '', jir: held?.jir ?? '', zki: held?.zki ?? '' }
}

/**
 * Turns a model's answer into a draft: amounts become cents at once, and the checks run on cents. Each failed check is a note
 * with the difference, and no figure is changed to pass one. The QR code's total and time win over the read's, with a note
 * when they differ. A line's category comes from the newest confirmed line of the same printed text at the same merchant, then
 * the model's pick. A receipt whose buyer is the company, or with no Company OIB saved any receipt naming a buyer, starts
 * every line under For the company. One marked R1 with no buyer's OIB starts them as read, and asks.
 */
export function receiptDraft(answer: ReceiptAnswer, { refs, qr, book, companyOib }: DraftContext): { readonly read: ReceiptRead; readonly notes: readonly string[] } {
  const notes: string[] = []
  const merchantOib = oibIn(answer.merchant.oib ?? '')
  const buyerOib = oibIn(answer.buyerOib ?? '')
  if ((answer.merchant.oib ?? '').trim() !== '' && !isValidOib(merchantOib)) notes.push(words.merchantOib)
  if (buyerOib !== '' && !isValidOib(buyerOib)) notes.push(words.buyerOib)

  const company = book.categories.find((category) => category.kind === 'company')?.id ?? null
  const r1 = buyerOib !== '' && company !== null && (companyOib === '' || buyerOib === companyOib)
  const r1Asked = buyerOib === '' && company !== null && (answer.markedR1 || (answer.buyerOib ?? '').trim() !== '')
  const remembered = rememberedLines(book, merchantOib, answer.merchant.name)
  const refOf = new Map(refs.map(({ ref, category }) => [ref, category.id]))
  const pickable = new Set(refOf.values())

  const answered = answer.lines.flatMap((line) => {
    const cents = moneyFromAmount(line.lineTotal)
    if (cents === 0) {
      notes.push(words.noAmount(line.printed))
      return []
    }
    if (line.quantity !== null && line.unitPrice !== null) {
      const worked = moneyFromAmount(line.quantity * line.unitPrice)
      if (Math.abs(worked - cents) > 1) notes.push(words.lineOff(line.printed, worked, cents))
    }
    if (line.kind === 'discount' && cents > 0) notes.push(words.discountAboveZero(line.printed))
    const memory = line.printed === '' ? undefined : remembered.find((held) => fold(held.printed) === fold(line.printed))
    // A line remembered under For the company, or a category hidden since, says nothing of this receipt.
    const picked = (memory !== undefined && pickable.has(memory.category) ? memory.category : refOf.get(line.category)) ?? null
    const suggested = picked === null && line.category === NEW_CATEGORY && (line.newCategory ?? '').trim() !== '' ? line.newCategory!.trim() : null
    return [{ cents, line: { printed: line.printed, text: line.text, amount: negateMoney(cents), category: r1 ? company : picked, suggested: r1 ? null : suggested } }]
  })

  const readTotal = moneyFromAmount(answer.total)
  if (qr === null && readTotal <= 0) notes.push(words.noTotal)
  if (qr !== null && qr.total !== readTotal) notes.push(words.qrTotal(qr.total))
  const total = qr?.total ?? (readTotal > 0 ? readTotal : null)

  const sum = sumMoney(answered.map(({ cents }) => cents))
  if (total !== null && answered.length > 0 && Math.abs(subtractMoney(sum, total)) > answered.length) notes.push(words.linesOff(sum, total))
  if (total !== null && answer.vat.length > 0) {
    const table = answer.vat.reduce((held, row) => addMoney(addMoney(held, moneyFromAmount(row.base)), moneyFromAmount(row.tax)), 0 as Money)
    if (Math.abs(subtractMoney(table, total)) > answer.vat.length) notes.push(words.vatOff(table, total))
  }

  const readOn = answer.issuedOn === null ? null : parseCivilDate(answer.issuedOn)
  if (qr === null && readOn === null) notes.push(words.noDate)
  const readTime = answer.issuedAt === null ? null : clockOf(answer.issuedAt)
  if (qr === null && answer.issuedAt !== null && readTime === null) notes.push(words.timeUnread(answer.issuedAt))
  if (qr !== null && ((readOn !== null && readOn !== qr.issuedOn) || (readTime !== null && readTime !== qr.issuedTime))) notes.push(words.qrIssued(qr.issuedOn, qr.issuedTime))
  notes.push(...answer.unreadable.map((part) => words.unreadable(part)))

  return {
    read: {
      merchant: answer.merchant.name.trim(),
      merchantOib,
      buyerOib,
      issuedOn: qr?.issuedOn ?? readOn,
      issuedTime: qr?.issuedTime ?? readTime ?? '',
      jir: qr?.jir || (answer.jir ?? ''),
      zki: qr?.zki || (answer.zki ?? ''),
      total,
      lines: answered.map(({ line }) => line),
      r1,
      r1Asked,
    },
    notes,
  }
}
