import { describe, expect, it } from 'vitest'

import { READ_RECEIPT, readReceipt } from '../src/apps/spending/receipts/assist/application/readReceipt'
import type { ReadReceiptInput } from '../src/apps/spending/receipts/assist/application/readReceipt'
import { categoryRefs } from '../src/apps/spending/receipts/domain/receiptDraft'
import { schemaProblems } from '../src/shared/ai/domain/strictSchema'
import type { StrictSchema } from '../src/shared/ai/domain/strictSchema'
import { runTask } from '../src/shared/ai/application/runTask'
import type { ModelPort } from '../src/shared/ai/application/modelPort'
import { sentSize } from '../src/shared/ai/presentation/imagePartOf'
import { LINE_RECORDS, RECEIPT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { CATEGORIES, category } from './fixtures/spending'

const PHOTO = { kind: 'image', mediaType: 'image/jpeg', base64: 'bWFkZS11cA==' } as const
const INPUT: ReadReceiptInput = { photo: PHOTO, book: { categories: CATEGORIES, receipts: [], lines: [] }, qr: null, merchant: '', companyOib: '' }

const ANSWER = {
  merchant: { name: 'Corner market', oib: null },
  buyerOib: null,
  markedR1: false,
  issuedOn: '2026-11-03',
  issuedAt: null,
  jir: null,
  zki: null,
  lines: [{ printed: 'A', text: 'a', kind: 'product', quantity: null, unitPrice: 1.5, lineTotal: 23.49, category: 'c1', newCategory: null }],
  vat: [],
  total: 23.49,
  unreadable: [],
}

/** Every object of the schema requires each of its properties and allows no other, as the strict subset asks. */
function strictObjects(schema: StrictSchema): boolean {
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties).sort()
    return schema.additionalProperties === false && JSON.stringify(keys) === JSON.stringify([...schema.required].sort()) && Object.values(schema.properties).every(strictObjects)
  }
  return schema.type === 'array' ? strictObjects(schema.items) : true
}

function modelAnswering(text: string, seen: unknown[] = []): ModelPort {
  return {
    model: { name: 'Sonnet 5.5', inputPerMillion: 2, outputPerMillion: 10 },
    readsPdf: true,
    send: async (request) => {
      seen.push(request)
      return { kind: 'answer', text, tokens: { input: 5000, output: 1500 } }
    },
  }
}

describe('the read-a-receipt task', () => {
  it("names itself under Spending's switch", () => {
    expect([readReceipt.id, readReceipt.app, readReceipt.tools]).toEqual([READ_RECEIPT, 'spending', []])
  })

  it('has a schema in the strict subset, whose answer passes', () => {
    const schema = readReceipt.output(INPUT)

    expect(strictObjects(schema)).toBe(true)
    expect(schemaProblems(ANSWER, schema)).toEqual([])
  })

  it('has a category enum that follows the file, plus new, with spending categories a person can pick and nothing else', () => {
    const schema = readReceipt.output(INPUT)
    const lines = schema.type === 'object' ? schema.properties.lines : null
    const item = lines?.type === 'array' ? lines.items : null
    const field = item?.type === 'object' ? item.properties.category : null
    const refs = categoryRefs(CATEGORIES)

    expect(field).toMatchObject({ enum: [...refs.map(({ ref }) => ref), 'new'] })
    const filed = refs.map(({ category: held }) => held.id)
    expect(filed).toContain(category('Food/Groceries').id)
    expect(filed).not.toContain(category('For the company').id)
    expect(filed).not.toContain(category('Food').id)
    expect(filed).not.toContain(category('Income/Salary').id)
    expect(filed).not.toContain(category('Between my accounts').id)
  })

  it('refuses a category the file does not hold', () => {
    const answer = { ...ANSWER, lines: [{ ...ANSWER.lines[0], category: 'c999' }] }

    expect(schemaProblems(answer, readReceipt.output(INPUT))).toEqual(['lines.0.category is not one of the allowed values'])
  })

  it('sends the photo and the categories, and only lines of the merchant known', () => {
    const receipt = {
      id: recordIdOf(RECEIPT_RECORDS, '5e000000-0000-4000-8000-000000008001'),
      transaction: recordIdOf(RECEIPT_RECORDS, '5e000000-0000-4000-8000-000000008001'),
      merchant: 'Corner market',
      merchantOib: '',
      buyerOib: '',
      issuedOn: civil('2026-10-01'),
      issuedTime: '',
      total: euros(1),
      jir: '',
      zki: '',
      readBy: '',
      photo: '',
      latitude: '',
      longitude: '',
    }
    const line = {
      id: recordIdOf(LINE_RECORDS, '5e000000-0000-4000-8000-000000008101'),
      transaction: receipt.transaction,
      receipt: receipt.id,
      printed: 'DET.TEK.',
      text: '',
      amount: euros(-1),
      category: category('Food/Groceries').id,
    }
    const book = { categories: CATEGORIES, receipts: [receipt], lines: [line] }
    const textOf = (merchant: string): string =>
      readReceipt
        .input({ ...INPUT, book, merchant })
        .flatMap((part) => (part.kind === 'text' ? [part.text] : []))
        .join('')

    expect(readReceipt.input(INPUT)[0]).toBe(PHOTO)
    expect(textOf('Corner market')).toContain('DET.TEK.')
    expect(textOf('Other shop')).not.toContain('DET.TEK.')
    expect(textOf('')).not.toContain('DET.TEK.')
  })

  it('sends no place, even with one on an earlier receipt, since only the file keeps it', () => {
    const receipt = {
      id: recordIdOf(RECEIPT_RECORDS, '5e000000-0000-4000-8000-000000008001'),
      transaction: recordIdOf(RECEIPT_RECORDS, '5e000000-0000-4000-8000-000000008001'),
      merchant: 'Corner market',
      merchantOib: '',
      buyerOib: '',
      issuedOn: civil('2026-10-01'),
      issuedTime: '',
      total: euros(1),
      jir: '',
      zki: '',
      readBy: '',
      photo: '',
      latitude: '43.508100',
      longitude: '16.440200',
    }
    const line = {
      id: recordIdOf(LINE_RECORDS, '5e000000-0000-4000-8000-000000008101'),
      transaction: receipt.transaction,
      receipt: receipt.id,
      printed: 'DET.TEK.',
      text: '',
      amount: euros(-1),
      category: category('Food/Groceries').id,
    }
    const sent = JSON.stringify(readReceipt.input({ ...INPUT, book: { categories: CATEGORIES, receipts: [receipt], lines: [line] }, merchant: 'Corner market' })) + JSON.stringify(readReceipt.system())

    expect(sent).not.toContain('43.508100')
    expect(sent).not.toContain('16.440200')
    expect(sent).not.toMatch(/latitude|longitude/)
  })

  it('runs to a draft with its notes and what it spent, and writes nothing, since it holds no way to', async () => {
    const seen: unknown[] = []
    const result = await runTask(readReceipt, INPUT, { model: modelAnswering(JSON.stringify({ ...ANSWER, total: 30 }), seen), appOn: true, employees: { sends: false, on: false } })

    expect(result).toMatchObject({ kind: 'draft', problems: ['The lines add up to €23.49, the receipt says €30.00'], usage: { inputTokens: 5000, outputTokens: 1500, dollars: 0.025 } })
    expect(seen).toHaveLength(1)
  })

  it('sends nothing while Spending is switched off', async () => {
    const seen: unknown[] = []

    expect(await runTask(readReceipt, INPUT, { model: modelAnswering('{}', seen), appOn: false, employees: { sends: false, on: false } })).toEqual({ kind: 'switched-off', which: 'app' })
    expect(seen).toEqual([])
  })

  it('stays under the input cap with a photo at its largest size', async () => {
    const photo = { ...PHOTO, base64: 'A'.repeat(Math.ceil((600_000 * 4) / 3)) }

    expect(await runTask(readReceipt, { ...INPUT, photo }, { model: modelAnswering(JSON.stringify(ANSWER)), appOn: true, employees: { sends: false, on: false } })).toMatchObject({ kind: 'draft' })
  })
})

describe('the size a photo is sent at', () => {
  it('keeps a small photo as it is', () => {
    expect(sentSize(800, 1000)).toEqual({ width: 800, height: 1000 })
  })

  it('cuts a phone photo by its area', () => {
    const { width, height } = sentSize(3000, 4000)

    expect(width * height).toBeLessThanOrEqual(1_801_000)
    expect(width / height).toBeCloseTo(0.75, 2)
  })

  it('keeps a tall receipt wide enough to read, under the long edge', () => {
    expect(sentSize(1000, 6000)).toEqual({ width: 429, height: 2576 })
  })
})
