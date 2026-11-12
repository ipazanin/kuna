import { describe, expect, it } from 'vitest'

import { MADE_UP_BUYER_OIB, MADE_UP_MERCHANT_OIB } from '../src/apps/spending/assistant/infrastructure/fake/fakeReceiptsChat'
import { entryCategoryChoices } from '../src/apps/spending/entries/presentation/categoryChoices'
import { receiptCategories, receiptDraft, withR1Answer } from '../src/apps/spending/receipts/domain/receiptDraft'
import type { AnsweredLine, DraftContext, ReceiptAnswer } from '../src/apps/spending/receipts/domain/receiptDraft'
import type { FiscalQr } from '../src/apps/spending/receipts/domain/fiscalQr'
import { PART_RECORDS, RECEIPT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { accountMoneyFromAmount } from '../src/shared/money/accountMoney'
import { civil, euros } from './fixtures/ledger'
import { CATEGORIES, category } from './fixtures/spending'

const refOf = (path: string): string => category(path).id

const CONTEXT: DraftContext = { qr: null, book: { receipts: [], lines: [], categories: CATEGORIES }, companyOib: '' }
const QR: FiscalQr = { jir: '1a2b3c4d-0000-4000-8000-1234567890ab', zki: '', issuedOn: civil('2026-11-03'), issuedTime: '18:42', total: euros(23.49) }

function line(printed: string, lineTotal: number, fields: Partial<AnsweredLine> = {}): AnsweredLine {
  return { printed, text: '', kind: 'product', quantity: null, unitPrice: null, lineTotal, category: refOf('Food/Groceries'), ...fields }
}

const ANSWER: ReceiptAnswer = {
  merchant: { name: ' Corner market ', oib: MADE_UP_MERCHANT_OIB },
  buyerOib: null,
  markedR1: false,
  issuedOn: '2026-11-03',
  issuedAt: '18:42',
  jir: null,
  zki: null,
  lines: [line('MLIJEKO', 20), line('KRUH', 3.49)],
  vat: [{ base: 18.79, tax: 4.7 }],
  total: 23.49,
  unreadable: [],
}

describe('a read receipt', () => {
  it('turns amounts into cents, signed as money out, with no note when every check holds', () => {
    const { read, notes } = receiptDraft(ANSWER, CONTEXT)

    expect(notes).toEqual([])
    expect(read).toMatchObject({ merchant: 'Corner market', merchantOib: MADE_UP_MERCHANT_OIB, issuedOn: civil('2026-11-03'), issuedTime: '18:42', total: euros(23.49), r1: false })
    expect(read.lines.map((held) => held.amount)).toEqual([accountMoneyFromAmount(-20), accountMoneyFromAmount(-3.49)])
  })

  it('notes lines that do not add up and changes no figure', () => {
    const { read, notes } = receiptDraft({ ...ANSWER, lines: [line('MLIJEKO', 20), line('KRUH', 2.99)] }, CONTEXT)

    expect(notes).toEqual(['The lines add up to €22.99, the receipt says €23.49'])
    expect(read.total).toEqual(euros(23.49))
    expect(read.lines.map((held) => held.amount)).toEqual([accountMoneyFromAmount(-20), accountMoneyFromAmount(-2.99)])
  })

  it('lets the sum be off by a cent a line, for rounding per line', () => {
    expect(receiptDraft({ ...ANSWER, lines: [line('MLIJEKO', 20), line('KRUH', 3.47)] }, CONTEXT).notes).toEqual([])
    expect(receiptDraft({ ...ANSWER, lines: [line('MLIJEKO', 20), line('KRUH', 3.46)] }, CONTEXT).notes).toHaveLength(1)
  })

  it("notes a line whose quantity times price is off by more than a cent, and keeps the line's amount", () => {
    const { read, notes } = receiptDraft({ ...ANSWER, lines: [line('MLIJEKO', 20), line('KRUH', 3.49, { quantity: 2, unitPrice: 1.5 })] }, CONTEXT)

    expect(notes).toEqual(['KRUH: quantity times price gives €3.00, the line says €3.49'])
    expect(read.lines[1]!.amount).toEqual(accountMoneyFromAmount(-3.49))
  })

  it('takes weighed goods within a cent', () => {
    expect(receiptDraft({ ...ANSWER, lines: [line('MLIJEKO', 21.9), line('JABUKE', 1.59, { quantity: 0.532, unitPrice: 2.99 })] }, CONTEXT).notes).toEqual([])
  })

  it('counts a discount line against the sum, as money back', () => {
    const { read, notes } = receiptDraft({ ...ANSWER, lines: [line('MLIJEKO', 25), line('POPUST', -1.51, { kind: 'discount' })] }, CONTEXT)

    expect(notes).toEqual([])
    expect(read.lines[1]!.amount).toEqual(accountMoneyFromAmount(1.51))
  })

  it('notes a VAT table that does not reach the total, and shows no note without a table', () => {
    expect(receiptDraft({ ...ANSWER, vat: [{ base: 18, tax: 4.5 }] }, CONTEXT).notes).toEqual(['The VAT table gives €22.50, the receipt says €23.49'])
    expect(receiptDraft({ ...ANSWER, vat: [] }, CONTEXT).notes).toEqual([])
  })

  it("lets the QR code's total and time win, with a note", () => {
    const { read, notes } = receiptDraft({ ...ANSWER, total: 32.49, vat: [], lines: [line('A', 32.49)], issuedAt: '18:24' }, { ...CONTEXT, qr: QR })

    expect(read).toMatchObject({ total: euros(23.49), issuedTime: '18:42', jir: QR.jir })
    expect(notes).toContain('The QR code says €23.49, the read says otherwise. The QR total is used.')
    expect(notes).toContain('The lines add up to €32.49, the receipt says €23.49')
    expect(notes.some((note) => note.startsWith('The QR code says') && note.includes('18:42'))).toBe(true)
  })

  it('shows no QR note when the read agrees', () => {
    expect(receiptDraft(ANSWER, { ...CONTEXT, qr: QR }).notes).toEqual([])
  })

  it('notes a misread OIB and keeps it as read', () => {
    const wrong = `${MADE_UP_MERCHANT_OIB.slice(0, 10)}0`
    const { read, notes } = receiptDraft({ ...ANSWER, merchant: { name: 'Shop', oib: wrong } }, CONTEXT)

    expect(notes).toEqual(["The merchant's OIB check digit is wrong"])
    expect(read.merchantOib).toBe(wrong)
  })

  it('leaves a line under a category it may not go under without one, so the chat refuses it', () => {
    const { read } = receiptDraft(
      { ...ANSWER, lines: [line('MLIJEKO', 20), line('ULOG', 3.49, { category: refOf('For the company') }), line('PSEC.HR.', 3.49, { category: 'no-such-category' })] },
      CONTEXT,
    )

    expect(read.lines.map((held) => held.category)).toEqual([category('Food/Groceries').id, null, null])
  })

  it('names what could not be read, a missing total and a missing date', () => {
    const { read, notes } = receiptDraft({ ...ANSWER, total: 0, issuedOn: null, lines: [], vat: [], unreadable: ['the bottom edge'] }, CONTEXT)

    expect(read.total).toBeNull()
    expect(notes).toEqual(['The read gave no total above zero', 'The read gave no date', 'Could not read: the bottom edge'])
  })

  it('leaves out a line with no amount and says so', () => {
    const { read, notes } = receiptDraft({ ...ANSWER, lines: [line('MLIJEKO', 23.49), line('VREĆICA', 0)] }, CONTEXT)

    expect(read.lines).toHaveLength(1)
    expect(notes).toEqual(['VREĆICA has no amount, so it is left out'])
  })
})

describe('what the review found in a read', () => {
  it.each([
    ['18:42:10', '18:42'],
    ['6:42', '06:42'],
    ['18.42', '18:42'],
    ['18:42', '18:42'],
  ])('keeps a time printed as %s as %s, which the store can write', (printed, kept) => {
    expect(receiptDraft({ ...ANSWER, issuedAt: printed }, CONTEXT).read.issuedTime).toBe(kept)
    expect(receiptDraft({ ...ANSWER, issuedAt: printed }, CONTEXT).notes).toEqual([])
  })

  it.each(['25:00', 'evening', '1842'])('leaves out a time of %s with a note, so it cannot block the save', (printed) => {
    const { read, notes } = receiptDraft({ ...ANSWER, issuedAt: printed }, CONTEXT)

    expect(read.issuedTime).toBe('')
    expect(notes).toEqual([`The read gave the time as ${printed}, which is left out`])
  })

  it('finds no difference between a time with seconds and the QR code', () => {
    expect(receiptDraft({ ...ANSWER, issuedAt: '18:42:10' }, { ...CONTEXT, qr: QR }).notes).toEqual([])
  })

  it('reads the OIB out of R1 before it, and treats the receipt as R1', () => {
    const { read, notes } = receiptDraft({ ...ANSWER, buyerOib: `R1 ${MADE_UP_BUYER_OIB}` }, { ...CONTEXT, companyOib: MADE_UP_BUYER_OIB })

    expect([read.buyerOib, read.r1, notes]).toEqual([MADE_UP_BUYER_OIB, true, []])
  })

  it('asks about a receipt marked R1 with no OIB, and sends nothing to For the company until you answer', () => {
    const { read, notes } = receiptDraft({ ...ANSWER, markedR1: true }, CONTEXT)

    expect([read.buyerOib, read.r1, read.r1Asked, notes]).toEqual(['', false, true, []])
    expect(read.lines.map((held) => held.category)).toEqual([category('Food/Groceries').id, category('Food/Groceries').id])
  })

  it('asks too when the buyer field holds no OIB, such as a bare R1', () => {
    const { read } = receiptDraft({ ...ANSWER, buyerOib: 'R1' }, CONTEXT)

    expect([read.buyerOib, read.r1, read.r1Asked]).toEqual(['', false, true])
  })

  it('does not ask when a receipt marked R1 has its OIB, which behaves as built', () => {
    const { read } = receiptDraft({ ...ANSWER, markedR1: true, buyerOib: MADE_UP_BUYER_OIB }, { ...CONTEXT, companyOib: MADE_UP_BUYER_OIB })

    expect([read.r1, read.r1Asked]).toEqual([true, false])
  })

  it('does not ask with no mark and no buyer', () => {
    expect(receiptDraft(ANSWER, CONTEXT).read.r1Asked).toBe(false)
  })

  it('puts every line under For the company on that answer, and back as read on Personal', () => {
    const company = category('For the company').id
    const { read } = receiptDraft({ ...ANSWER, markedR1: true, lines: [line('A', 20), line('B', 3.49, { category: refOf('Food/Coffee') })] }, CONTEXT)

    expect(withR1Answer(read, 'company', company).lines.map((held) => held.category)).toEqual([company, company])
    expect(withR1Answer(read, 'personal', company).lines.map((held) => held.category)).toEqual([category('Food/Groceries').id, category('Food/Coffee').id])
  })

  it('reads an OIB with HR before it or in groups', () => {
    expect(receiptDraft({ ...ANSWER, merchant: { name: 'Shop', oib: `HR${MADE_UP_MERCHANT_OIB}` } }, CONTEXT).read.merchantOib).toBe(MADE_UP_MERCHANT_OIB)
    expect(receiptDraft({ ...ANSWER, merchant: { name: 'Shop', oib: '123 456 789 03' } }, CONTEXT).read.merchantOib).toBe(MADE_UP_MERCHANT_OIB)
  })

  it('notes a merchant OIB too short to be one', () => {
    expect(receiptDraft({ ...ANSWER, merchant: { name: 'Shop', oib: '12345' } }, CONTEXT).notes).toEqual(["The merchant's OIB check digit is wrong"])
  })

  it('notes a discount whose amount reads as a cost, and keeps the amount', () => {
    const { read, notes } = receiptDraft({ ...ANSWER, lines: [line('MLIJEKO', 22.48), line('POPUST', 1.01, { kind: 'discount' })] }, CONTEXT)

    expect(notes).toEqual(['POPUST is a discount, but its amount reads as a cost'])
    expect(read.lines[1]!.amount).toEqual(accountMoneyFromAmount(-1.01))
  })

  it('keeps a JIR from the QR code and a ZKI only the read has, and the reverse', () => {
    const zki = '0123456789abcdef0123456789abcdef'
    const { read } = receiptDraft({ ...ANSWER, zki }, { ...CONTEXT, qr: QR })

    expect([read.issuedTime, read.jir, read.zki]).toEqual(['18:42', QR.jir, zki])
    expect(receiptDraft({ ...ANSWER, jir: 'read-jir' }, CONTEXT).read.jir).toBe('read-jir')
  })
})

describe('what the model may file a line under', () => {
  const filed = (categories = CATEGORIES) => receiptCategories(categories).map((held) => held.id)

  it('holds no fixed category, so only the R1 rule starts a line under For the company', () => {
    expect(filed()).not.toContain(category('For the company').id)
    expect(filed()).not.toContain(category('Saved to investments').id)
    expect(filed()).toContain(category('Food/Groceries').id)
  })

  it('holds no child of a hidden group, as the review picker offers none', () => {
    const hiddenFood = CATEGORIES.map((held) => (held.id === category('Food').id ? { ...held, hidden: true } : held))

    expect(filed(hiddenFood)).not.toContain(category('Food/Groceries').id)
    expect(
      entryCategoryChoices(hiddenFood, 'out', null)
        .flat()
        .map((choice) => choice.value),
    ).not.toContain(category('Food/Groceries').id)
  })
})

describe('a line remembered from a confirmed receipt', () => {
  const receipt = (key: string, merchant: string, merchantOib: string, issuedOn: string) => ({
    id: recordIdOf(RECEIPT_RECORDS, key),
    transaction: recordIdOf(RECEIPT_RECORDS, key),
    account: null,
    merchant,
    merchantOib,
    buyerOib: '',
    issuedOn: civil(issuedOn),
    issuedTime: '',
    total: euros(1),
    jir: '',
    zki: '',
    readBy: '',
    photo: '',
    latitude: '',
    longitude: '',
  })
  const held = (key: string, receiptKey: string, printed: string, path: string) => ({
    id: recordIdOf(PART_RECORDS, key),
    transaction: recordIdOf(RECEIPT_RECORDS, receiptKey),
    receipt: recordIdOf(RECEIPT_RECORDS, receiptKey),
    printed,
    text: '',
    amount: accountMoneyFromAmount(-1),
    category: category(path).id,
  })
  const OLD = '5e000000-0000-4000-8000-000000008001'
  const NEW = '5e000000-0000-4000-8000-000000008002'
  const book = {
    categories: CATEGORIES,
    receipts: [receipt(OLD, 'Corner market', MADE_UP_MERCHANT_OIB, '2026-09-01'), receipt(NEW, 'Corner mkt', MADE_UP_MERCHANT_OIB, '2026-10-01')],
    lines: [held('5e000000-0000-4000-8000-000000008101', OLD, 'det.tek.', 'Food/Groceries'), held('5e000000-0000-4000-8000-000000008102', NEW, 'DET.TEK.', 'Home/Household goods')],
  }

  it('goes before the model, the newest at the same OIB, folded', () => {
    const { read } = receiptDraft({ ...ANSWER, lines: [line('Det.Tek.', 23.49, { category: refOf('Food/Coffee') })] }, { ...CONTEXT, book })

    expect(read.lines[0]!.category).toBe(category('Home/Household goods').id)
  })

  it('never starts a personal line under For the company because an R1 receipt filed it there', () => {
    const company = { ...book, lines: [held('5e000000-0000-4000-8000-000000008103', NEW, 'KRUH', 'For the company')] }
    const { read } = receiptDraft({ ...ANSWER, lines: [line('KRUH', 23.49)] }, { ...CONTEXT, book: company })

    expect([read.r1, read.lines[0]!.category]).toEqual([false, category('Food/Groceries').id])
  })

  it("stays with the model's pick for a category hidden since", () => {
    const hidden = CATEGORIES.map((entry) => (entry.id === category('Home/Household goods').id ? { ...entry, hidden: true } : entry))
    const { read } = receiptDraft({ ...ANSWER, lines: [line('DET.TEK.', 23.49, { category: refOf('Food/Coffee') })] }, { ...CONTEXT, book: { ...book, categories: hidden } })

    expect(read.lines[0]!.category).not.toBe(category('Home/Household goods').id)
  })

  it("stays with the model's pick at another merchant", () => {
    const { read } = receiptDraft({ ...ANSWER, merchant: { name: 'Other shop', oib: MADE_UP_BUYER_OIB }, lines: [line('DET.TEK.', 23.49, { category: refOf('Food/Coffee') })] }, { ...CONTEXT, book })

    expect(read.lines[0]!.category).toBe(category('Food/Coffee').id)
  })
})

describe('an R1 receipt', () => {
  const COMPANY = category('For the company').id

  it('sets every line to For the company when its buyer is the Company OIB, whatever the read filed it under', () => {
    const { read } = receiptDraft({ ...ANSWER, buyerOib: MADE_UP_BUYER_OIB, lines: [line('A', 20), line('B', 3.49, { category: 'no-such-category' })] }, { ...CONTEXT, companyOib: MADE_UP_BUYER_OIB })

    expect(read.r1).toBe(true)
    expect(read.lines.map((held) => held.category)).toEqual([COMPANY, COMPANY])
  })

  it('flags any buyer OIB with no Company OIB saved', () => {
    expect(receiptDraft({ ...ANSWER, buyerOib: MADE_UP_BUYER_OIB }, CONTEXT).read.r1).toBe(true)
  })

  it('leaves a receipt for another buyer alone once a Company OIB is saved', () => {
    const { read } = receiptDraft({ ...ANSWER, buyerOib: MADE_UP_BUYER_OIB }, { ...CONTEXT, companyOib: MADE_UP_MERCHANT_OIB })

    expect(read.r1).toBe(false)
    expect(read.lines[0]!.category).toBe(category('Food/Groceries').id)
  })
})
