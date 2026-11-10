import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { LOANS_OPERATIONS } from '../src/apps/loans/assistant/operations/loansOperations'
import { KEPT_BY_KUNA, proposalFieldName } from '../src/apps/loans/assistant/operations/proposalLines'
import { words } from '../src/apps/loans/assistant/words'
import { BANK_LOAN_RECORDS, LOAN_SCENARIO_RECORDS, RATE_PERIOD_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import type { ProposalGroup, ProposalLine } from '../src/shared/app/assistantOperations'
import { formatMoney } from '../src/shared/money/moneyFormat'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import type { RecordNoun } from '../src/shared/storage/domain/recordKind'
import { saveScenario } from '../src/apps/loans/scenarios/application/scenarioWrites'
import { NO_COSTS } from '../src/apps/loans/scenarios/domain/loanScenario'
import type { LoanScenario } from '../src/apps/loans/scenarios/domain/loanScenario'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { percent } from './fixtures/loans'
import { EXAMPLE_RECORDS, loansDesk } from './fixtures/loansDesk'
import type { LoansDesk } from './fixtures/loansDesk'
import { forgetCaches } from './fixtures/writeBack'
import { expectCountsOfChanges } from './fixtures/cardCounts'

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
  return altered.filter((field) => said(after[field]) !== null || said(before?.[field]) !== null).map((field) => proposalFieldName(field, after))
}

/** The add-offer example with other terms, as an offer the document fixtures print. */
function printedOffer(bankEks: string | null, bankInstalment: number | null = null): Record<string, unknown> {
  const example = LOANS_OPERATIONS.find((operation) => operation.name === 'add-offer')!.example
  return {
    ...example,
    lender: 'Example Bank d.d.',
    principal: 150000,
    rate: '3.18',
    instalments: 360,
    payout: '2026-11-07',
    fixedYears: null,
    thenVariable: null,
    upfrontCost: 1000,
    bankEks,
    bankInstalment,
  }
}

/** The add-bank-loan example with the instalment its contract prints. */
function printedLoan(bankInstalment: number | null): Record<string, unknown> {
  return { ...LOANS_OPERATIONS.find((operation) => operation.name === 'add-bank-loan')!.example, bankInstalment }
}

/** The one line of the card's group that adds records of the noun. */
function addedLine(desk: LoansDesk, noun: RecordNoun) {
  return desk.cards[0]!.groups.find((group) => group.verb === 'add' && group.noun === noun)!.lines[0]!
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
      expectCountsOfChanges(card!)
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
    expect(line!.warning).toContain('3.28%')
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

describe('the first instalment the bank printed', () => {
  // 15,000 at 4.5% over 60 months: 15,000 x 0.00375 / (1 - 1.00375^-60) = 279.65.
  it("sets Kuna's first instalment beside the contract's and says nothing more when they agree within a cent", async () => {
    const desk = await loansDesk(used)
    await desk.propose([{ op: 'add-bank-loan', input: printedLoan(279.66) }])
    const line = addedLine(desk, BANK_LOAN_RECORDS.noun)
    expect(line.warning).toBeNull()
    const shown = Object.fromEntries(line.fields.map((field) => [field.name, field.after]))
    expect(shown[words.proposals.fields.kunaInstalment]).toMatch(/279[,.]65/)
    expect(shown[words.proposals.fields.bankInstalment]).toMatch(/279[,.]66/)
  })

  it("warns on a loan whose printed instalment is more than a cent from Kuna's, names both, and keeps neither in the file", async () => {
    const desk = await loansDesk(used)
    await desk.propose([{ op: 'add-bank-loan', input: printedLoan(285) }])
    const line = addedLine(desk, BANK_LOAN_RECORDS.noun)
    expect(line.warning).toMatch(/279[,.]65/)
    expect(line.warning).toMatch(/285[,.]00/)
    expect((await desk.accept()).kind).toBe('done')
    expect(recordsOf(desk)).not.toContain('bankInstalment')
  })

  it('shows no instalment when the contract prints none, and refuses one of zero', async () => {
    const desk = await loansDesk(used)
    await desk.propose([{ op: 'add-bank-loan', input: printedLoan(null) }])
    const names = addedLine(desk, BANK_LOAN_RECORDS.noun).fields.map((field) => field.name)
    expect(names).not.toContain(words.proposals.fields.kunaInstalment)
    expect(names).not.toContain(words.proposals.fields.bankInstalment)
    expect((await desk.propose([{ op: 'add-bank-loan', input: printedLoan(0) }])).isError).toBe(true)
  })

  it("warns on an offer whose printed instalment is not Kuna's, beside an EKS that agrees", async () => {
    const desk = await loansDesk(used)
    await desk.propose([{ op: 'add-offer', input: printedOffer('3.28', 600) }])
    const line = addedLine(desk, LOAN_SCENARIO_RECORDS.noun)
    expect(line.warning).toMatch(/600[,.]00/)
    expect(line.warning).not.toContain('EKS')
    expect(line.fields.map((field) => field.name)).toEqual(expect.arrayContaining([words.proposals.fields.kunaInstalment, words.proposals.fields.bankInstalment]))
  })

  it('gives both warnings on an offer whose EKS and instalment both disagree', async () => {
    const desk = await loansDesk(used)
    await desk.propose([{ op: 'add-offer', input: printedOffer('2.28', 600) }])
    const { warning } = addedLine(desk, LOAN_SCENARIO_RECORDS.noun)
    expect(warning).toContain('2.28')
    expect(warning).toMatch(/600[,.]00/)
  })
})

describe('the printed instalment heard by the model', () => {
  const bankFigure = (line: { readonly fields: readonly { readonly name: string; readonly after: string | null }[] }) =>
    line.fields.find((field) => field.name === words.proposals.fields.bankInstalment)?.after ?? null

  it('tells the model when an instalment differs, and nothing when they agree', async () => {
    const desk = await loansDesk(used)
    expect((await desk.propose([{ op: 'add-bank-loan', input: printedLoan(285) }])).text).toContain("Kuna's instalment is not the printed one on one line of the card.")
    expect((await desk.propose([{ op: 'add-bank-loan', input: printedLoan(279.66) }])).text).not.toContain('not the printed one')
  })

  it('gives each of two loans on one card its own printed figure', async () => {
    const desk = await loansDesk(used)
    const answer = await desk.propose([
      { op: 'add-bank-loan', input: printedLoan(285) },
      { op: 'add-bank-loan', input: { ...printedLoan(600), name: 'Second car loan', principal: 30000 } },
    ])
    const lines = desk.cards[0]!.groups.find((group) => group.verb === 'add' && group.noun === BANK_LOAN_RECORDS.noun)!.lines

    expect(lines.map(bankFigure).map((figure) => figure?.replace(/\D/g, ''))).toEqual(['28500', '60000'])
    expect(lines[0]!.warning).toMatch(/285[,.]00/)
    expect(lines[1]!.warning).toMatch(/600[,.]00/)
    expect(answer.text).toContain('on 2 lines of the card')
  })

  it('keeps the printed figure of each card when two are checked at once', async () => {
    const desk = await loansDesk(used)
    await Promise.all([desk.propose([{ op: 'add-bank-loan', input: printedLoan(285) }]), desk.propose([{ op: 'add-offer', input: printedOffer('3.28', 600) }])])

    const figures = desk.cards.map((card) => bankFigure(card.groups.find((group) => group.verb === 'add')!.lines[0]!)?.replace(/\D/g, ''))
    expect(figures.sort()).toEqual(['28500', '60000'])
  })

  it('shows no instalment on a card that changes an offer whose document prints none', async () => {
    const desk = await loansDesk(used)
    const change = LOANS_OPERATIONS.find((operation) => operation.name === 'change-offer')!
    await desk.propose([{ op: 'change-offer', input: exampleInput(desk, change) }])

    const names = desk.cards[0]!.groups.flatMap((group) => group.lines.flatMap((line) => line.fields.map((field) => field.name)))
    expect(names).not.toContain(words.proposals.fields.kunaInstalment)
  })
})

describe('the instalment printed on a change', () => {
  const figureOf = (line: ProposalLine, name: string) => line.fields.find((field) => field.name === name)?.after ?? null
  const changedLine = (desk: LoansDesk, verb: ProposalGroup['verb'], noun: RecordNoun) => desk.cards.at(-1)!.groups.find((group) => group.verb === verb && group.noun === noun)!.lines[0]!

  /** Proposes the step with a printed instalment far from any Kuna works out, and gives the line that checks it, with Kuna's figure as the card writes it in English and in euros. */
  async function differing(desk: LoansDesk, op: string, input: Record<string, unknown>, verb: ProposalGroup['verb'], noun: RecordNoun) {
    const answer = await desk.propose([{ op, input: { ...input, bankInstalment: 9999 } }])
    const line = changedLine(desk, verb, noun)
    const kuna = figureOf(line, words.proposals.fields.kunaInstalment)!
    return { answer, line, kuna, euros: Number(kuna.replace(/[^\d.]/g, '')) }
  }

  /** Proposes the step again with Kuna's own figure a cent off, which agrees. */
  async function agreeing(desk: LoansDesk, op: string, input: Record<string, unknown>, euros: number, verb: ProposalGroup['verb'], noun: RecordNoun) {
    const answer = await desk.propose([{ op, input: { ...input, bankInstalment: Math.round(euros * 100 + 1) / 100 } }])
    return { answer, line: changedLine(desk, verb, noun) }
  }

  it("sets Kuna's first instalment at a corrected loan's new terms beside the printed one, and warns only when they differ", async () => {
    const desk = await loansDesk(used)
    const input = {
      ...exampleInput(
        desk,
        LOANS_OPERATIONS.find((operation) => operation.name === 'change-bank-loan')!,
      ),
      principal: 2400,
      note: null,
    }

    const off = await differing(desk, 'change-bank-loan', input, 'change', BANK_LOAN_RECORDS.noun)
    expect(off.line.warning).toContain(off.kuna)
    expect(off.line.warning).toMatch(/9[,.]?999[,.]00/)
    expect(off.answer.text).toContain("Kuna's instalment is not the printed one on one line of the card.")
    const on = await agreeing(desk, 'change-bank-loan', input, off.euros, 'change', BANK_LOAN_RECORDS.noun)
    expect(on.line.warning).toBeNull()
    expect(on.answer.text).not.toContain('not the printed one')

    expect((await desk.accept()).kind).toBe('done')
    const first = bookOf(desk).bankLoans[0]!.plan!.find((row) => row.number === 1)!
    expect(formatMoney(first.payment)).toBe(off.kuna)
  })

  it("sets Kuna's instalment at a notice's new rate from its due date beside the printed one, and warns only when they differ", async () => {
    const desk = await loansDesk(used)
    const input = exampleInput(
      desk,
      LOANS_OPERATIONS.find((operation) => operation.name === 'add-rate-period')!,
    )
    const dueBefore = bookOf(desk).bankLoans[0]!.plan!.find((row) => row.date === input['from'])!.payment

    const off = await differing(desk, 'add-rate-period', input, 'add', RATE_PERIOD_RECORDS.noun)
    expect(off.line.warning).toContain(off.kuna)
    expect(off.line.warning).toMatch(/9[,.]?999[,.]00/)
    expect(off.answer.text).toContain("Kuna's instalment is not the printed one on one line of the card.")
    const on = await agreeing(desk, 'add-rate-period', input, off.euros, 'add', RATE_PERIOD_RECORDS.noun)
    expect(on.line.warning).toBeNull()
    expect(on.answer.text).not.toContain('not the printed one')

    expect((await desk.accept()).kind).toBe('done')
    const due = bookOf(desk).bankLoans[0]!.plan!.find((row) => row.date === input['from'])!.payment
    expect(formatMoney(due)).toBe(off.kuna)
    expect(due).not.toBe(dueBefore)
  })

  it("sets Kuna's instalment at a corrected notice's rate from the period's due date beside the printed one, and warns only when they differ", async () => {
    const desk = await loansDesk(used)
    const input = exampleInput(
      desk,
      LOANS_OPERATIONS.find((operation) => operation.name === 'change-rate-period')!,
    )
    const from = bookOf(desk).bankLoans[0]!.ratePeriods.find((period) => period.id === EXAMPLE_RECORDS['rate-period-later'])!.from
    const dueBefore = bookOf(desk).bankLoans[0]!.plan!.find((row) => row.date === from)!.payment

    const off = await differing(desk, 'change-rate-period', input, 'change', RATE_PERIOD_RECORDS.noun)
    expect(off.line.warning).toContain(off.kuna)
    expect(off.line.warning).toMatch(/9[,.]?999[,.]00/)
    expect(off.answer.text).toContain("Kuna's instalment is not the printed one on one line of the card.")
    const on = await agreeing(desk, 'change-rate-period', input, off.euros, 'change', RATE_PERIOD_RECORDS.noun)
    expect(on.line.warning).toBeNull()
    expect(on.answer.text).not.toContain('not the printed one')

    expect((await desk.accept()).kind).toBe('done')
    const due = bookOf(desk).bankLoans[0]!.plan!.find((row) => row.date === from)!.payment
    expect(formatMoney(due)).toBe(off.kuna)
    expect(due).not.toBe(dueBefore)
  })

  // 90,000 at 3.5% over 240 months: 90,000 x 0.035/12 / (1 - (1 + 0.035/12)^-240) = 262.50 / 0.50291 = 521.96.
  it("sets Kuna's first instalment at a revised offer's new terms beside the printed one, and warns only when they differ", async () => {
    const desk = await loansDesk(used)
    const input = exampleInput(
      desk,
      LOANS_OPERATIONS.find((operation) => operation.name === 'change-offer')!,
    )

    const off = await differing(desk, 'change-offer', input, 'change', LOAN_SCENARIO_RECORDS.noun)
    expect(off.kuna).toMatch(/521[,.]96/)
    expect(off.line.warning).toContain(off.kuna)
    expect(off.answer.text).toContain("Kuna's instalment is not the printed one on one line of the card.")
    const on = await agreeing(desk, 'change-offer', input, off.euros, 'change', LOAN_SCENARIO_RECORDS.noun)
    expect(on.line.warning).toBeNull()
    expect(figureOf(on.line, words.proposals.fields.bankInstalment)).toMatch(/521[,.]97/)
    expect(on.answer.text).not.toContain('not the printed one')
  })

  it("shows no printed instalment on a later card about the same loan from an earlier card's check", async () => {
    const desk = await loansDesk(used)
    const loan = desk.ref('bank-loan', EXAMPLE_RECORDS['bank-loan']!)
    await differing(
      desk,
      'change-bank-loan',
      {
        ...exampleInput(
          desk,
          LOANS_OPERATIONS.find((operation) => operation.name === 'change-bank-loan')!,
        ),
        principal: 2400,
      },
      'change',
      BANK_LOAN_RECORDS.noun,
    )
    const answer = await desk.propose([{ op: 'set-subsidy', input: { loan, monthly: 20, payer: 'APN', firstInstalment: 1, instalments: 6 } }])

    expect(changedLine(desk, 'change', BANK_LOAN_RECORDS.noun).fields.map((field) => field.name)).not.toContain(words.proposals.fields.bankInstalment)
    expect(answer.text).not.toContain('not the printed one')
  })

  it('shows no instalment on a change or rate notice that prints none', async () => {
    const desk = await loansDesk(used)
    for (const op of ['change-bank-loan', 'add-rate-period', 'change-rate-period']) {
      await desk.propose([
        {
          op,
          input: exampleInput(
            desk,
            LOANS_OPERATIONS.find((operation) => operation.name === op)!,
          ),
        },
      ])
      const names = desk.cards.at(-1)!.groups.flatMap((group) => group.lines.flatMap((line) => line.fields.map((field) => field.name)))
      expect(names).not.toContain(words.proposals.fields.kunaInstalment)
    }
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
    expect(answer.text).toContain('is changed, and takes its tries and late instalments, on a card after it')
  })
})

describe('what the screens refuse', () => {
  it('refuses a rate from a day that is no due date, and taking the first rate away', async () => {
    const desk = await loansDesk(used)
    const loan = desk.ref('bank-loan', EXAMPLE_RECORDS['bank-loan']!)
    expect((await desk.propose([{ op: 'add-rate-period', input: { loan, from: '2026-10-06', rate: '3.9', rateType: 'variable', note: '', bankInstalment: null } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'delete-rate-period', input: { period: desk.ref('rate-period', EXAMPLE_RECORDS['rate-period-first']!) } }])).isError).toBe(true)
    expect((await desk.propose([{ op: 'add-rate-period', input: { loan, from: '2026-10-05', rate: '3.18%', rateType: 'variable', note: '', bankInstalment: null } }])).isError).toBe(true)
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

describe("an offer's move to another bank", () => {
  const change = () => LOANS_OPERATIONS.find((operation) => operation.name === 'change-offer')!
  const MOVED = recordIdOf(LOAN_SCENARIO_RECORDS, 'scenario-moved')

  /** The desk's offer copied with a move to Other Bank after the instalment due on 2030-01-01, over 180 instalments at a fixed 3%. */
  async function movedOffer(desk: LoansDesk): Promise<void> {
    const offer = bookOf(desk).scenarios.find((held) => held.scenario.id === EXAMPLE_RECORDS['loan-scenario'])!.scenario
    const moved: LoanScenario = { ...offer, id: MOVED, name: 'Offer A, moved' }
    await desk.store.write('A moved offer', (unit) =>
      saveScenario(
        unit,
        desk.store.state.records!,
        moved,
        [
          { kind: 'rate-change', from: civil('2027-01-01'), rate: percent('3.5'), rateType: 'fixed' },
          { kind: 'move', on: civil('2030-01-01'), lender: 'Other Bank', rate: percent('3'), rateType: 'fixed', instalments: 180, costs: NO_COSTS },
        ],
        null,
      ),
    )
  }

  const move = (fields: Record<string, unknown>) => ({
    kind: 'move',
    date: '2030-01-01',
    amount: null,
    effect: null,
    every: null,
    until: null,
    rate: '3',
    rateType: 'fixed',
    lender: 'Other Bank',
    instalments: 180,
    upfrontCost: 0,
    monthlyCost: 0,
    yearlyCost: 0,
    ...fields,
  })

  const changeInput = (desk: LoansDesk, scenario: string, changes: readonly unknown[]) => ({
    ...exampleInput(desk, change()),
    scenario: desk.ref(LOAN_SCENARIO_RECORDS.name, scenario),
    principal: null,
    laterTerms: 'replace',
    changes,
  })

  it('edits the lender and costs of the move an offer holds, and keeps the one move', async () => {
    const desk = await loansDesk(used)
    await movedOffer(desk)
    const answer = await desk.propose([{ op: 'change-offer', input: changeInput(desk, MOVED, [move({ lender: 'Better Bank', upfrontCost: 800, monthlyCost: 5.5 })]) }])
    expect(answer.isError).toBe(false)
    await desk.accept()

    const moves = bookOf(desk)
      .scenarios.find((held) => held.scenario.id === MOVED)!
      .changes.filter((held) => held.kind === 'move')
    expect(moves).toEqual([expect.objectContaining({ lender: 'Better Bank', on: '2030-01-01', instalments: 180, costs: { upfront: euros(800), monthly: euros(5.5), yearly: euros(0) } })])
  })

  it('refuses a move on the last due date, which leaves the old loan nothing to repay', async () => {
    const desk = await loansDesk(used)
    await movedOffer(desk)
    const answer = await desk.propose([{ op: 'change-offer', input: changeInput(desk, MOVED, [move({ date: '2046-12-01' })]) }])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('changes 1 due')
  })

  it('refuses a cost below zero', async () => {
    const desk = await loansDesk(used)
    await movedOffer(desk)
    expect((await desk.propose([{ op: 'change-offer', input: changeInput(desk, MOVED, [move({ monthlyCost: -5 })]) }])).isError).toBe(true)
  })

  it('adds no move to an offer that holds none, new or kept, as its editor adds none', async () => {
    const desk = await loansDesk(used)
    const kept = await desk.propose([{ op: 'change-offer', input: changeInput(desk, EXAMPLE_RECORDS['loan-scenario']!, [move({})]) }])
    expect(kept.isError).toBe(true)
    expect(kept.text).toContain('adds no move')
    const added = await desk.propose([{ op: 'add-offer', input: { ...printedOffer(null), changes: [move({})] } }])
    expect(added.text).toContain('adds no move')
  })
})
