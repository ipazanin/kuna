import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { runTask } from '../src/shared/ai/application/runTask'
import type { ModelPort, ModelRequest } from '../src/shared/ai/application/modelPort'
import type { AiTextPart } from '../src/shared/ai/domain/aiTask'
import { MOST_ROWS, namesEmployee, sendsEmployees, sentRows, suggestCategories } from '../src/apps/company/assist/application/suggestCategories'
import type { SuggestInput } from '../src/apps/company/assist/application/suggestCategories'
import { en, hr } from '../src/apps/company/assist/presentation/words'
import type { Account } from '../src/apps/company/workbook/domain/workbook'
import { CATEGORIES, category } from './fixtures/ownerShareExample'
import { ledger } from './fixtures/ledger'

const EMPLOYEE_IBAN = 'HR2123400091110123456'
const ROWS = ledger([
  { date: '2026-10-08', amount: -6.4, counterparty: 'Snack Kiosk Žminj', description: 'Card purchase, OIB 12345678903', flaggedBy: 'ai' },
  { date: '2026-10-09', amount: -38.9, counterparty: 'Gadget Corner', iban: 'HR1210010051863000160', description: 'Paid to HR12 1001 0051 8630 0016 0', flaggedBy: 'ai' },
  { date: '2026-10-10', amount: -1500, counterparty: 'Ana Example', iban: EMPLOYEE_IBAN, description: 'Salary October', flaggedBy: 'ai' },
  { date: '2026-10-11', amount: 1200, counterparty: 'Client Example', description: 'Invoice 7', flaggedBy: 'ai' },
]).reverse()
const ACCOUNTS: readonly Account[] = [{ slug: 'main', label: 'Main account', iban: 'HR9923400091110000001', currency: '' }]
const CLIENT_REFUND = category('client-refund', 'income', ['client-refund'])

function inputOf(change: Partial<SuggestInput> = {}): SuggestInput {
  return {
    rows: ROWS,
    categories: [...CATEGORIES, CLIENT_REFUND],
    accounts: ACCOUNTS,
    employeeIbans: new Set([EMPLOYEE_IBAN]),
    employeeNames: ['Mia Primjer', 'Đuro Šimić'],
    includeEmployees: false,
    packPairSides: { 'owner-loan-out': 'debit', 'owner-loan-repaid': 'credit' },
    ...change,
  }
}

function sentText(input: SuggestInput): string {
  return suggestCategories
    .input(input)
    .map((part) => (part as AiTextPart).text)
    .join('\n')
}

/** A model that answers with the given JSON, noting the request it was sent. */
function answering(answer: unknown): ModelPort & { readonly sent: ModelRequest[] } {
  const sent: ModelRequest[] = []
  return {
    sent,
    readsPdf: true,
    model: { name: 'Haiku 5.5', price: { inputPerMillion: 0.1, cacheReadPerMillion: 0.01, cacheWritePerMillion: 0.125, outputPerMillion: 0.5 } },
    async send(request) {
      sent.push(request)
      return { kind: 'answer', text: JSON.stringify(answer), raw: null, tokens: { input: 4800, cacheRead: 0, cacheWrite: 0, output: 1200 } }
    },
  }
}

describe('what Suggest categories sends', () => {
  it('folds the counterparty, sends the signed amount, the account name and the month, and never the counterparty IBAN', () => {
    const rows = JSON.parse(sentText(inputOf()).split('Rows:\n')[1]!)
    expect(rows[0]).toEqual({ ref: 'r1', counterparty: 'SNACK KIOSK ZMINJ', description: 'Card purchase, OIB 12345678903', amount: '-6.40', account: 'Main account', month: '2026-10' })
    expect(sentText(inputOf())).not.toContain('HR1210010051863000160')
  })

  it('masks an IBAN and an OIB in a description once the run sends it', async () => {
    const model = answering({ suggestions: [] })
    await runTask(suggestCategories, inputOf(), { model, appOn: true, employees: { sends: false, on: false } })
    const text = (model.sent[0]!.turns[0] as { parts: readonly AiTextPart[] }).parts[0]!.text
    expect(text).toContain('Card purchase, OIB [OIB]')
    expect(text).toContain('Paid to HR•• ••••0160')
    expect(text).not.toMatch(/12345678903|1001 0051/)
  })

  it('sends the categories with their slug, name, family, bucket and roles', () => {
    const categories = JSON.parse(/Categories:\n(.*)\n\nRows:/s.exec(sentText(inputOf()))![1]!)
    expect(categories).toContainEqual({ slug: 'revenue', name: 'revenue', family: 'income', bucket: 'income', roles: ['revenue'] })
  })

  it('leaves the rows paid to employees out until their switch is on', () => {
    expect(sentRows(inputOf()).map(({ row }) => row.counterparty)).toEqual(['Snack Kiosk Žminj', 'Gadget Corner', 'Client Example'])
    expect(sentText(inputOf())).not.toContain('Ana Example'.toUpperCase())
    expect(sendsEmployees(inputOf())).toBe(false)
    expect(sentRows(inputOf({ includeEmployees: true })).map(({ ref }) => ref)).toEqual(['r1', 'r2', 'r3', 'r4'])
    expect(sendsEmployees(inputOf({ includeEmployees: true }))).toBe(true)
  })

  it(`sends at most ${MOST_ROWS} rows in one request`, () => {
    const many = ledger(Array.from({ length: MOST_ROWS + 5 }, (_, index) => ({ date: '2026-10-01', amount: -1 - index, counterparty: `Shop ${index}`, flaggedBy: 'ai' })))
    expect(sentRows(inputOf({ rows: many }))).toHaveLength(MOST_ROWS)
  })

  it("holds the queue's refs and the defined slugs in the schema's enums, and no name", () => {
    const schema = JSON.stringify(suggestCategories.output(inputOf()))
    const item = (suggestCategories.output(inputOf()) as unknown as { properties: { suggestions: { items: { properties: Record<string, { enum?: readonly string[] }> } } } }).properties.suggestions
      .items.properties
    expect(item.row!.enum).toEqual(['r1', 'r2', 'r3'])
    expect(item.category!.enum).toEqual([...CATEGORIES, CLIENT_REFUND].map((entry) => entry.slug))
    expect(item.confidence!.enum).toEqual(['high', 'medium', 'low'])
    expect(schema).not.toMatch(/SNACK|Gadget|Client Example|Ana/i)
  })
})

describe('the check of the suggestions', () => {
  const check = (suggestions: readonly object[]) => suggestCategories.check({ suggestions }, inputOf(), { answers: [] })
  const one = (row: string, slug: string) => ({ row, category: slug, confidence: 'high', why: 'A shop for devices.' })

  it('keeps a suggestion for a sent row in a defined category, by the row id', () => {
    expect(check([one('r2', 'equipment')])).toEqual({ draft: { suggestions: [{ rowId: ROWS[1]!.id, category: 'equipment', confidence: 'high', why: 'A shop for devices.' }], asked: 3 }, problems: [] })
  })

  it('drops an unknown slug, an unknown ref and a second suggestion for one row', () => {
    const { draft, problems } = check([one('r1', 'groceries'), one('r9', 'equipment'), one('r2', 'equipment'), one('r2', 'other-costs')])
    expect(draft.suggestions.map((suggestion) => suggestion.category)).toEqual(['equipment'])
    expect(problems).toHaveLength(3)
  })

  it('drops the side of a credit and debit pair that the row’s sign contradicts', () => {
    // r3 is money in, so a client refund, money out, cannot be it. r2 is money out, so revenue cannot be it.
    const { draft, problems } = check([one('r3', 'client-refund'), one('r2', 'revenue'), one('r3', 'revenue')])
    expect(draft.suggestions.map((suggestion) => [suggestion.rowId, suggestion.category])).toEqual([[ROWS[3]!.id, 'revenue']])
    expect(problems).toHaveLength(2)
  })

  it('counts the rows sent, so the screen can say how many got no suggestion', async () => {
    const result = await runTask(suggestCategories, inputOf(), { model: answering({ suggestions: [one('r2', 'equipment')] }), appOn: true, employees: { sends: false, on: false } })
    expect(result).toMatchObject({ kind: 'draft', draft: { asked: 3, suggestions: [{ category: 'equipment' }] } })
  })
})

describe('a row that names an employee', () => {
  const noIban = { employeeIbans: new Set<string>(), employeeNames: ['Mia Primjer', 'Đuro Šimić'] }
  const row = (counterparty: string, description = '', counterpartyIban = '') => ({ counterparty, description, counterpartyIban })

  it('counts by a name in its counterparty or description, whatever its IBAN, the case, the accents or the order', () => {
    expect(namesEmployee(row('MIA PRIMJER', '', 'HR1210010051863000160'), noIban)).toBe(true)
    expect(namesEmployee(row('', 'Placa za mia primjer'), noIban)).toBe(true)
    expect(namesEmployee(row('PRIMJER MIA'), noIban)).toBe(true)
    expect(namesEmployee(row('DURO SIMIC'), noIban)).toBe(true)
  })

  it('does not count on part of a name or inside a longer word', () => {
    expect(namesEmployee(row('Mia Shop'), noIban)).toBe(false)
    expect(namesEmployee(row('MIAMI PRIMJERAK'), noIban)).toBe(false)
    expect(namesEmployee(row('Anyone'), { employeeIbans: new Set(), employeeNames: ['-'] })).toBe(false)
  })

  it('stays home with the switch off, and with it on the request says it sends one', () => {
    const rows = ledger([
      { date: '2026-10-10', amount: -1500, counterparty: 'MIA PRIMJER', iban: 'HR1210010051863000160', description: 'Salary', flaggedBy: 'ai' },
      { date: '2026-10-11', amount: -20, counterparty: 'Gadget Corner', flaggedBy: 'ai' },
    ])
    expect(sentRows(inputOf({ rows })).map(({ row: sent }) => sent.counterparty)).toEqual(['Gadget Corner'])
    expect(sendsEmployees(inputOf({ rows, includeEmployees: true }))).toBe(true)
  })

  it('leaves nothing to send when every waiting row names one', () => {
    const rows = ledger([{ date: '2026-10-10', amount: -1500, counterparty: 'MIA PRIMJER', flaggedBy: 'ai' }])
    expect(sentRows(inputOf({ rows }))).toEqual([])
  })
})

describe('what the task says it sends', () => {
  it('names the month, in both languages and on the privacy page', () => {
    expect(en.suggest.sends).toContain('months')
    expect(hr.suggest.sends).toContain('mjesece')
    expect(readFileSync(join(import.meta.dirname, '..', 'public/privacy.html'), 'utf8')).toMatch(/descriptions, amounts, months and accounts/)
  })
})
