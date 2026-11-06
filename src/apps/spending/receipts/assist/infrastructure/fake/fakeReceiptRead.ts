import { READ_RECEIPT } from '../../application/readReceipt'
import type { AnsweredLine, ReceiptAnswer } from '../../../domain/receiptDraft'
import { placeInJpeg } from '../../../domain/photoPlace'
import { registerFakeAnswer } from '../../../../../../shared/ai/infrastructure/fake/fakeModel'
import { today } from '../../../../../../shared/calendar/civilDate'
import { language } from '../../../../../../shared/text/language'

/** A made-up OIB whose check digit is right. */
export const MADE_UP_MERCHANT_OIB = '12345678903'
/** Another, the made-up buyer of an R1 receipt. */
export const MADE_UP_BUYER_OIB = '11111111119'

const GROCERIES = ['Groceries', 'Namirnice']
const HOUSEHOLD = ['Household goods', 'Kućanske potrepštine']

function line(printed: string, text: string, lineTotal: number, category: string, fields: Partial<AnsweredLine> = {}): AnsweredLine {
  return { printed, text, kind: 'product', quantity: null, unitPrice: null, lineTotal, category, newCategory: null, ...fields }
}

/**
 * The fake build's made-up read of the sample €23.49 receipt, as `?receipt=` names it: `sum-off` a discount misread so the
 * lines give €22.99, `r1` the same with a buyer's OIB, `r1-bare` marked R1 with none. It checks the request carries a photo with no GPS in it, so the page's own downscale ran.
 */
export function registerFakeReceiptRead(): void {
  registerFakeAnswer(READ_RECEIPT, (request): ReceiptAnswer => {
    const turn = request.turns[0]
    const parts = turn?.role === 'user' ? turn.parts : []
    const photo = parts.find((part) => part.kind === 'image')
    if (photo === undefined || photo.base64.length === 0) throw new Error('The request holds no photo.')
    if (placeInJpeg(Uint8Array.from(atob(photo.base64), (character) => character.charCodeAt(0))) !== null) throw new Error('The photo sent still holds its GPS position.')
    const text = parts.flatMap((part) => (part.kind === 'text' ? [part.text] : [])).join('\n')
    const categories = JSON.parse(/Categories:\n(.*)\n\nPast lines/s.exec(text)?.[1] ?? '[]') as readonly { readonly ref: string; readonly name: string }[]
    const refOf = (names: readonly string[]): string => categories.find((category) => names.includes(category.name))?.ref ?? 'new'
    const variant = new URLSearchParams(window.location.search).get('receipt')
    const groceries = refOf(GROCERIES)
    return {
      merchant: { name: 'Corner market', oib: MADE_UP_MERCHANT_OIB },
      buyerOib: variant === 'r1' ? MADE_UP_BUYER_OIB : null,
      markedR1: variant === 'r1' || variant === 'r1-bare',
      issuedOn: today(),
      issuedAt: '18:42',
      jir: null,
      zki: null,
      lines: [
        line('MLIJ.TR.2,8%1L', 'mlijeko trajno 2,8% 1 l', 12.3, groceries),
        line('KRUH POLUBIJ.', 'kruh polubijeli', 3.2, groceries, { quantity: 2, unitPrice: 1.6 }),
        line('POPUST', 'popust', variant === 'sum-off' ? -1.51 : -1.01, groceries, { kind: 'discount' }),
        line('DET.TEK.', 'deterdžent tekući', 5.5, refOf(HOUSEHOLD)),
        line('PSEC.HR.', 'pseća hrana', 3.5, 'new', { newCategory: language === 'hr' ? 'Hrana za ljubimce' : 'Pet food' }),
      ],
      vat: [{ base: 18.79, tax: 4.7 }],
      total: 23.49,
      unreadable: [],
    }
  })
}
