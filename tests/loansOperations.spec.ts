import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { LOANS_OPERATIONS } from '../src/apps/loans/assistant/operations/loansOperations'
import { KEPT_BY_KUNA } from '../src/apps/loans/assistant/operations/proposalLines'
import { words } from '../src/apps/loans/assistant/words'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import { EXAMPLE_RECORDS, loansDesk } from './fixtures/loansDesk'
import type { LoansDesk } from './fixtures/loansDesk'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const bookOf = ({ store }: LoansDesk) => store.state.workbook!

/** The file's records of each kind, in the order of their ids, since an Undo may put them back in another order. */
function recordsOf({ store }: LoansDesk): string {
  return JSON.stringify(Object.entries(store.state.records!).map(([part, read]) => [part, read.records.map((stored: { readonly record: unknown }) => JSON.stringify(stored.record)).sort()]))
}

/** The example's input with each record it names as a ref the chat handed out. */
function exampleInput(desk: LoansDesk, operation: (typeof LOANS_OPERATIONS)[number]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(operation.example).map(([field, value]) => {
      const kind = operation.refs[field]
      return [field, kind !== undefined && typeof value === 'string' ? desk.ref(kind, EXAMPLE_RECORDS[value]!) : value]
    }),
  )
}

/** A field's value as the card reads it, where an empty text and a missing value both say nothing. */
function said(value: unknown): unknown {
  return value === undefined || value === '' ? null : value
}

/** The card's names of the fields a change sets, leaving out the ones Kuna keeps by itself. */
function namesSet(before: Readonly<Record<string, unknown>> | null, after: Readonly<Record<string, unknown>>): string[] {
  const fields = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after)])].filter((field) => !KEPT_BY_KUNA.has(field))
  const altered = fields.filter((field) => JSON.stringify(said(before?.[field])) !== JSON.stringify(said(after[field])))
  return altered.filter((field) => said(after[field]) !== null || said(before?.[field]) !== null).map((field) => (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field)
}

/** The add-offer example with other terms, as an offer the document fixtures print. */
function printedOffer(bankEks: string | null): Record<string, unknown> {
  const example = LOANS_OPERATIONS.find((operation) => operation.name === 'add-offer')!.example
  return { ...example, lender: 'Example Bank d.d.', principal: 150000, rate: '3.18', instalments: 360, payout: '2026-11-07', fixedYears: null, thenVariable: null, upfrontCost: 1000, bankEks }
}

describe('every Loans operation', () => {
  it.each(LOANS_OPERATIONS.map((operation) => [operation.name, operation] as const))(
    'has an example that passes the checks of the file, a card that names every field it sets, and one Undo: %s',
    async (_name, operation) => {
      expect(Object.keys(operation.input.type === 'object' ? operation.input.properties : {}).filter((field) => KEPT_BY_KUNA.has(field))).toEqual([])
      const desk = await loansDesk(used)
      const before = recordsOf(desk)

      const answer = await desk.propose([{ op: operation.name, input: exampleInput(desk, operation) }])

      expect(answer.text).toContain('The card shows')
      expect(answer.isError).toBe(false)
      const [card] = desk.cards
      const { changes } = card!.held as { readonly changes: readonly RuledChange[] }
      const linesTaken = new Map<string, number>()
      for (const { change } of changes) {
        if (change.verb === 'repair' || change.verb === 'discard') continue
        const group = card!.groups.find((candidate) => candidate.verb === change.verb && candidate.noun === change.kind.noun)!
        const at = linesTaken.get(`${change.verb}/${change.kind.name}`) ?? 0
        linesTaken.set(`${change.verb}/${change.kind.name}`, at + 1)
        if (change.verb === 'remove') continue
        const was = change.verb === 'change' ? (change.before as Readonly<Record<string, unknown>>) : null
        expect(group.lines[at]!.fields.map((field) => field.name)).toEqual(expect.arrayContaining(namesSet(was, change.after as Readonly<Record<string, unknown>>)))
      }
      expect(card!.undoable).toBe(true)
      const result = await desk.accept()
      expect(result.kind).toBe('done')
      if (result.kind === 'done') expect((await result.undo!()).kind).toBe('undone')
      expect(recordsOf(desk)).toBe(before)
    },
  )
})

describe('an offer from the bank', () => {
  it("warns on the card when Kuna's EKS is not the one the bank printed, and names both", async () => {
    const desk = await loansDesk(used)
    await desk.propose([{ op: 'add-offer', input: printedOffer('2.28') }])
    const [line] = desk.cards[0]!.groups.find((group) => group.verb === 'add' && group.lines.some((candidate) => candidate.warning !== null))!.lines
    expect(line!.warning).toContain('2.28')
    expect(line!.warning).toContain(', 1 point apart.')
    expect(line!.fields.map((field) => field.name)).toEqual(expect.arrayContaining([words.proposals.fields.kunaEks, words.proposals.fields.bankEks]))
  })

  it('says nothing more when the two agree, and names the offer as the editor would', async () => {
    const desk = await loansDesk(used)
    await desk.propose([{ op: 'add-offer', input: printedOffer('3.28') }])
    const lines = desk.cards[0]!.groups.flatMap((group) => group.lines)
    expect(lines.every((line) => line.warning === null)).toBe(true)
    expect((await desk.accept()).kind).toBe('done')
    expect(bookOf(desk).scenarios.at(-1)!.scenario.name).toMatch(/150[,.]000/)
  })

  it('refuses terms the editor refuses, and a change on a saved try', async () => {
    const desk = await loansDesk(used)
    expect((await desk.propose([{ op: 'add-offer', input: { ...printedOffer(null), rate: '3,1,8' } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'add-offer', input: { ...printedOffer(null), fixedYears: 40, thenVariable: '4' } }])).isError).toBe(true)
    const change = LOANS_OPERATIONS.find((operation) => operation.name === 'change-offer')!
    const onTry = { ...exampleInput(desk, change), scenario: desk.ref('loan-scenario', EXAMPLE_RECORDS['loan-scenario-try']!) }
    expect((await desk.propose([{ op: 'change-offer', input: onTry }])).text).toContain('not an offer')
  })
})

describe('a change that names only some fields', () => {
  it("keeps an offer's extra payments and later rates with laterTerms keep, and refuses a list beside it", async () => {
    const desk = await loansDesk(used)
    const change = LOANS_OPERATIONS.find((operation) => operation.name === 'change-offer')!
    const changesOf = () =>
      bookOf(desk)
        .scenarios.find((scenario) => scenario.scenario.id === EXAMPLE_RECORDS['loan-scenario'])!
        .changes.map((held) => held.kind)
    const before = changesOf()
    const input = { ...exampleInput(desk, change), laterTerms: 'keep', changes: [] }

    expect((await desk.propose([{ op: 'change-offer', input: { ...input, changes: change.example['changes'] as unknown[] } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'change-offer', input }])).isError).toBe(false)
    await desk.accept()

    expect(changesOf()).toEqual(before)
  })

  it("keeps a subsidy's payer when a step names only the monthly amount", async () => {
    const desk = await loansDesk(used)
    const loan = desk.ref('bank-loan', EXAMPLE_RECORDS['bank-loan']!)
    await desk.propose([{ op: 'set-subsidy', input: { loan, monthly: 20, payer: 'APN', firstInstalment: 1, instalments: 6 } }])
    await desk.accept()
    await desk.propose([{ op: 'set-subsidy', input: { loan, monthly: 25, payer: null, firstInstalment: null, instalments: null } }])
    await desk.accept()

    expect(bookOf(desk).bankLoans[0]!.loan.subsidy).toMatchObject({ payer: 'APN', firstInstalment: 1, instalments: 6 })
  })

  it('says a bank loan added on the card is changed on a card after it', async () => {
    const desk = await loansDesk(used)
    const add = LOANS_OPERATIONS.find((operation) => operation.name === 'add-bank-loan')!
    const answer = await desk.propose([
      { op: 'add-bank-loan', input: add.example, as: '$car' },
      { op: 'set-subsidy', input: { loan: '$car', monthly: 20, payer: 'APN', firstInstalment: 1, instalments: 6 } },
    ])
    expect(answer.text).toContain('is changed, and takes its tries, on a card after it')
  })
})

describe('what the screens refuse', () => {
  it('refuses a rate from a day that is no due date, and taking the first rate away', async () => {
    const desk = await loansDesk(used)
    const loan = desk.ref('bank-loan', EXAMPLE_RECORDS['bank-loan']!)
    expect((await desk.propose([{ op: 'add-rate-period', input: { loan, from: '2026-10-06', rate: '3.9', rateType: 'variable', note: '' } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'delete-rate-period', input: { period: desk.ref('rate-period', EXAMPLE_RECORDS['rate-period-first']!) } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'add-rate-period', input: { loan, from: '2026-10-05', rate: '3.18%', rateType: 'variable', note: '' } }])).isError).toBe(true)
  })

  it('refuses an extra payment before the payout or with a part of a cent, and a late instalment paid before it fell due', async () => {
    const desk = await loansDesk(used)
    const loan = desk.ref('bank-loan', EXAMPLE_RECORDS['bank-loan']!)
    expect((await desk.propose([{ op: 'add-extra-payment', input: { loan, date: '2025-12-01', amount: 100, effect: 'shorter-term' } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'add-extra-payment', input: { loan, date: '2026-09-01', amount: 100.123, effect: 'shorter-term' } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'add-late-instalment', input: { loan, due: '2026-04-05', paid: '2026-04-05' } }])).isError).toBe(true)
  })

  it('refuses a subsidy past the last instalment, and a loan whose first instalment is not after its payout', async () => {
    const desk = await loansDesk(used)
    const loan = desk.ref('bank-loan', EXAMPLE_RECORDS['bank-loan']!)
    expect((await desk.propose([{ op: 'set-subsidy', input: { loan, monthly: 20, payer: 'APN', firstInstalment: 10, instalments: 6 } }])).isError).toBe(true)
    const add = LOANS_OPERATIONS.find((operation) => operation.name === 'add-bank-loan')!
    expect((await desk.propose([{ op: 'add-bank-loan', input: { ...add.example, firstInstalment: '2026-11-02' } }])).isError).toBe(true)
  })
})

describe('one write, one Undo', () => {
  it('deletes a bank loan with everything under it, its saved try too, and puts it all back', async () => {
    const desk = await loansDesk(used)
    const before = recordsOf(desk)
    await desk.propose([{ op: 'delete-bank-loan', input: { loan: desk.ref('bank-loan', EXAMPLE_RECORDS['bank-loan']!) } }])
    const result = await desk.accept()
    expect(bookOf(desk).bankLoans).toEqual([])
    expect(bookOf(desk).scenarios.map((scenario) => scenario.scenario.name)).toEqual(['Offer A'])
    if (result.kind === 'done') await result.undo!()
    expect(recordsOf(desk)).toBe(before)
  })

  it('adds a bank loan and an extra payment on it by its $ name, on one card', async () => {
    const desk = await loansDesk(used)
    const add = LOANS_OPERATIONS.find((operation) => operation.name === 'add-bank-loan')!
    const answer = await desk.propose([
      { op: 'add-bank-loan', input: add.example, as: '$car' },
      { op: 'add-extra-payment', input: { loan: '$car', date: '2027-01-02', amount: 1000, effect: 'shorter-term' } },
    ])
    expect(answer.isError).toBe(false)
    await desk.accept()
    const car = bookOf(desk).bankLoans.find((loanBook) => loanBook.loan.drawdown === '2026-11-02')!
    expect(car.extraPayments.map((payment) => payment.amount)).toEqual([100000])
    expect(car.ratePeriods).toHaveLength(1)
  })
})
