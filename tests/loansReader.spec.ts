import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { loansAssistant } from '../src/apps/loans/assistant/loansAssistant'
import { loansReader } from '../src/apps/loans/assistant/loansReader'
import { LOANS_OPERATIONS } from '../src/apps/loans/assistant/operations/loansOperations'
import { INFORMAL_LOAN_WRITES } from '../src/apps/loans/informalLoans/application/informalLoanWrites'
import { INFORMAL_LOAN_RECORDS } from '../src/apps/loans/workbook/domain/loanKinds'
import { findRecords } from '../src/shared/ai/application/chatReads'
import type { ChatReads, FindRecordsInput } from '../src/shared/ai/application/chatReads'
import { chatRefs } from '../src/shared/ai/domain/chatRefs'
import { newPseudonyms } from '../src/shared/privacy/domain/pseudonyms'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { bankLoanFigures } from '../src/apps/loans/bankLoans/domain/bankLoanFigures'
import { workedOffers } from '../src/apps/loans/scenarios/domain/workedScenario'
import type { AppReader, ReadableField, ReportFigure } from '../src/shared/app/assistantReader'
import { civil } from './fixtures/ledger'
import { informalLoan } from './fixtures/loans'
import { EXAMPLE_RECORDS, loansDesk } from './fixtures/loansDesk'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

async function readerOfDesk(): Promise<{ readonly reader: AppReader; readonly desk: Awaited<ReturnType<typeof loansDesk>> }> {
  const desk = await loansDesk(used)
  return { desk, reader: loansReader({ status: () => 'open', book: () => desk.store.state.workbook }) }
}

/** The chat's reads over the desk's Loans, with Anonymise on and the people Loans names known. */
function chatReadsOf(desk: Awaited<ReturnType<typeof loansDesk>>): ChatReads {
  const reading = { status: () => 'open' as const, book: () => desk.store.state.workbook }
  return {
    readers: new Map([['loans', { name: 'Loans', reader: loansReader(reading) }]]),
    pseudonyms: newPseudonyms(),
    refs: chatRefs(),
    anonymising: () => true,
    persons: () => loansAssistant(reading).persons(),
    mayRead: async () => true,
  }
}

function everyRecord(kind: string): FindRecordsInput {
  return { app: 'loans', kind, query: null, from: null, to: null, about: null, only: null, limit: null, cursor: null }
}

function fieldsOf(reader: AppReader, kind: string, id: string): Readonly<Record<string, ReadableField>> {
  const row = reader.kinds
    .find((candidate) => candidate.name === kind)!
    .rows()
    .find((candidate) => candidate.id === id)!
  return Object.fromEntries(row.fields.map((field) => [field.name, field]))
}

function figureOf(figures: readonly ReportFigure[], label: string): ReportFigure {
  const figure = figures.find((candidate) => candidate.label === label)
  if (figure === undefined) throw new Error(`No figure ${label} among ${figures.map((candidate) => candidate.label).join(' | ')}`)
  return figure
}

describe('what the chat reads of Loans', () => {
  it('reads the eight kinds, with each rate as a percent and each amount in euros', async () => {
    const { reader } = await readerOfDesk()
    expect(reader.kinds.map((kind) => kind.name)).toEqual(['bank-loan', 'rate-period', 'extra-payment', 'late-instalment', 'informal-loan', 'movement', 'loan-scenario', 'scenario-change'])
    expect(fieldsOf(reader, 'rate-period', EXAMPLE_RECORDS['rate-period-later']!)['rate']).toMatchObject({ exposure: 'plain', value: '4%' })
    expect(fieldsOf(reader, 'bank-loan', EXAMPLE_RECORDS['bank-loan']!)['principal']).toMatchObject({ of: 'app', cents: 120000, currency: 'EUR' })
    expect(fieldsOf(reader, 'informal-loan', EXAMPLE_RECORDS['informal-loan']!)['counterparty']).toMatchObject({ exposure: 'party', value: 'Ana' })
  })

  it('gives an offer its terms as lines and a saved try the loan it starts from', async () => {
    const { reader } = await readerOfDesk()
    const offer = fieldsOf(reader, 'loan-scenario', EXAMPLE_RECORDS['loan-scenario']!)
    expect(offer['loan']).toMatchObject({ exposure: 'ref', id: null })
    expect(offer['offer']).toMatchObject({ value: expect.arrayContaining(['amount borrowed 100000.00 EUR', 'instalments 240']) })
    const tried = fieldsOf(reader, 'loan-scenario', EXAMPLE_RECORDS['loan-scenario-try']!)
    expect(tried['loan']).toMatchObject({ exposure: 'ref', id: EXAMPLE_RECORDS['bank-loan'] })
    const changes = reader.kinds.find((kind) => kind.name === 'scenario-change')!.rows()
    expect(changes.map((row) => row.fields.find((field) => field.name === 'on'))).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: '2027-01-01' }), expect.objectContaining({ value: '2026-09-01' })]),
    )
  })

  it('sends the person of an owed-to-you loan under an alias with Anonymise on, in the counterparty and in the name', async () => {
    const desk = await loansDesk(used)
    const owedToYou = informalLoan({ id: recordIdOf(INFORMAL_LOAN_RECORDS, 'to-ivana'), name: 'To Ivana', counterparty: 'Ivana', direction: 'owed-to-you' })
    await desk.store.write('Lent', (unit) => unit.of(INFORMAL_LOAN_WRITES).add(owedToYou))
    const reads = chatReadsOf(desk)

    const answer = await findRecords(everyRecord('informal-loan'), reads)

    expect(answer.isError).toBe(false)
    expect(answer.text).not.toMatch(/Ivana/)
    const sent = (JSON.parse(answer.text) as { records: Record<string, string>[] }).records.find((record) => record['direction'] === 'owed-to-you')!
    expect([sent['counterparty'], sent['name']]).toEqual(['Person 1', 'To Person 1'])
  })

  it("lets an answer quote a rate and an offer's terms Kuna wrote as text, without calling them figures it did not compute", async () => {
    const desk = await loansDesk(used)
    const reads = chatReadsOf(desk)

    await findRecords(everyRecord('rate-period'), reads)
    await findRecords(everyRecord('loan-scenario'), reads)

    expect(reads.refs.holdsStrayFigure('Your rate goes from 3.5% to 4% in August.')).toBe(false)
    expect(reads.refs.holdsStrayFigure('The offer lends 100,000.00 EUR.')).toBe(false)
    expect(reads.refs.holdsStrayFigure('Your rate goes to 4.25%.')).toBe(true)
  })

  it('links a bank loan and an informal loan to their own pages', async () => {
    const { reader } = await readerOfDesk()
    expect(Object.fromEntries(reader.kinds.flatMap((kind) => (kind.page === undefined ? [] : [[kind.name, kind.page]])))).toEqual({
      'bank-loan': '/loans/bank-loan',
      'informal-loan': '/loans/informal-loan',
    })
  })
})

describe("Loans' reports", () => {
  it('counts what each loan owes on a day as its page does, and names an informal loan by its start, never its person', async () => {
    const { reader, desk } = await readerOfDesk()
    const balances = reader.reports.find((report) => report.id === 'balances')!
    const figures = balances.figures('2026-07-01')
    const book = desk.store.state.workbook!
    const owed = bankLoanFigures(book.bankLoans[0]!, civil('2026-07-01'))!.owed
    expect(figureOf(figures, 'bank loan from Example Bank paid out 2026-01-05: owed')).toMatchObject({ cents: owed })
    expect(figureOf(figures, 'informal loan started 2026-03-01: you owe, below zero when they owe you')).toMatchObject({ cents: 250000 })
    expect(figures.map((figure) => figure.label).join(' ')).not.toMatch(/Ana/)
    expect(() => balances.figures('July')).toThrow(RangeError)
  })

  it("compares the offers with Kuna's EKS, as the Scenarios screen works them out", async () => {
    const { reader, desk } = await readerOfDesk()
    const figures = reader.reports.find((report) => report.id === 'offers')!.figures(null)
    const [worked] = workedOffers(desk.store.state.workbook!.scenarios)
    const named = 'offer from Example Bank of 100000.00 EUR over 240 instalments at 3.5% fixed first, 0.00 EUR up front'
    expect(figureOf(figures, `${named}: total paid`)).toMatchObject({ cents: worked!.outcome!.total })
    // 3.5% a year paid monthly comes to an effective 3.56%.
    expect(figureOf(figures, `${named}: Kuna's EKS estimate`)).toMatchObject({ basisPoints: 356 })
  })

  it('keeps two offers alike apart, with a number after the second', async () => {
    const { reader, desk } = await readerOfDesk()
    const copy = LOANS_OPERATIONS.find((operation) => operation.name === 'copy-scenario')!
    await desk.propose([{ op: 'copy-scenario', input: { ...copy.example, scenario: desk.ref('loan-scenario', EXAMPLE_RECORDS['loan-scenario']!) } }])
    expect((await desk.accept()).kind).toBe('done')

    const labels = reader.reports
      .find((report) => report.id === 'offers')!
      .figures(null)
      .map((figure) => figure.label)

    expect(labels.filter((label) => label.endsWith(': total paid'))).toEqual([
      'offer from Example Bank of 100000.00 EUR over 240 instalments at 3.5% fixed first, 0.00 EUR up front: total paid',
      'offer from Example Bank of 100000.00 EUR over 240 instalments at 3.5% fixed first, 0.00 EUR up front (2): total paid',
    ])
  })
})
