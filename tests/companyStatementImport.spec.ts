// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { ROWS_A_PART } from '../src/shared/app/proposedWrites'
import { transcribedStatement } from '../src/apps/company/imports/domain/importedStatement'
import { ACCOUNT_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { ChatAttachment } from '../src/shared/ai/domain/chatAttachments'
import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { moneyFromAmount } from '../src/shared/money/money'
import { companyDesk } from './fixtures/companyDesk'
import type { CompanyDesk } from './fixtures/companyDesk'
import { forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

const DOCUMENTS = join(import.meta.dirname, 'fixtures', 'documents')

function attached(kind: ChatAttachment['kind'], file: string, bytes = new Uint8Array(readFileSync(join(DOCUMENTS, file)))): ChatAttachment {
  return {
    id: 'a1',
    kind,
    name: file,
    bytes,
    original: new Blob([bytes]),
    pages: 1,
    sent: null,
    reading: { kind: 'cells', sheets: [], characters: bytes.length, reads: 1 },
  }
}

/** A statement of the main account as the model transcribes it off a page, which runs on from the account's balance of 760. */
function transcribed(
  desk: CompanyDesk,
  closing: number,
  rows = [
    { date: '2026-11-02', amount: -12.5 },
    { date: '2026-11-03', amount: -27 },
  ],
  opening = 760,
) {
  return {
    op: 'import-statement',
    input: {
      file: null,
      account: desk.ref(ACCOUNT_RECORDS.name, 'main'),
      statementName: 'Statement 5',
      opening,
      closing,
      rows: rows.map((row) => ({ ...row, counterparty: 'Supplier d.o.o.', iban: null, description: 'Goods' })),
      lookAlikes: 'ask',
      newAccount: null,
      part: 1,
    },
  }
}

/** A file the chat sends as cells. */
function cellsFile(name: string, text: string): ChatAttachment {
  return attached('csv', name, new TextEncoder().encode(text))
}

/** The warned lines of the last card. */
function warnings(desk: CompanyDesk): readonly string[] {
  return desk.cards
    .at(-1)!
    .groups.flatMap((group) => group.notes)
    .map((note) => note.text)
}

const rowsOf = (desk: CompanyDesk, account: string) => desk.store.state.workbook!.transactions.filter((row) => row.account === account)

describe('a statement read off a page', () => {
  it('imports rows that tie, filed by the rules, with one Undo', async () => {
    const desk = await companyDesk(used)
    const before = rowsOf(desk, 'main').length
    expect((await desk.propose([transcribed(desk, 720.5)])).isError).toBe(false)
    const accepted = await desk.accept()
    expect(rowsOf(desk, 'main')).toHaveLength(before + 2)
    expect(rowsOf(desk, 'main').find((row) => row.amount === -2700)!.balance).toBe(72050)
    if (accepted.kind === 'done') await accepted.undo!()
    expect(rowsOf(desk, 'main')).toHaveLength(before)
  })

  it('refuses a statement that does not tie, with the gap', async () => {
    const desk = await companyDesk(used)
    const answer = await desk.propose([transcribed(desk, 721)])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('does not add up')
    expect(answer.text).toContain('0.50')
  })

  it('refuses the closing balance without the opening, and the opening alone on a part after the first', async () => {
    const desk = await companyDesk(used)
    for (const missing of [{ opening: null }, { closing: null, part: 2 }]) {
      const step = transcribed(desk, 720.5)
      const answer = await desk.propose([{ ...step, input: { ...step.input, ...missing } }])
      expect(answer.isError).toBe(true)
      expect(answer.text).toContain('or neither')
    }
    expect(desk.cards).toEqual([])
  })

  it('imports rows without printed balances, running them on from the ledger, and warns that Kuna could not check them', async () => {
    const desk = await companyDesk(used)
    const step = transcribed(desk, 720.5)
    expect((await desk.propose([{ ...step, input: { ...step.input, opening: null, closing: null } }])).isError).toBe(false)
    const [copied, ...notes] = warnings(desk)
    expect(copied).toBe('The AI read 2 rows from the chat. Kuna could not check that the statement adds up, so check them against it.')
    expect(notes.join(' ')).toContain('gives no balances')
    await desk.accept()
    expect(rowsOf(desk, 'main').find((row) => row.amount === -2700)!.balance).toBe(72050)
  })

  it('tells to check rows whose printed balances tie against the statement', async () => {
    const desk = await companyDesk(used)
    await desk.propose([transcribed(desk, 720.5)])
    expect(warnings(desk)).toEqual(['The AI read 2 rows from the chat. Check them against the statement.'])
  })

  it('starts an account with no rows at zero for copied rows without balances, and says so on the card', async () => {
    const desk = await companyDesk(used)
    const step = transcribed(desk, 720.5)
    const answer = await desk.propose([{ ...step, input: { ...step.input, account: desk.ref(ACCOUNT_RECORDS.name, 'fresh'), opening: null, closing: null } }])
    expect(answer.isError).toBe(false)
    expect(warnings(desk)).toContain('The account had no rows in Kuna, so its balance starts at €0.00 before the first row. Fix the opening if it held money before.')
    await desk.accept()
    // The two copied rows are -12.50 and -27.00 from a start of zero, so the later one leaves -39.50.
    expect(rowsOf(desk, 'fresh').map((row) => row.balance)).toEqual(expect.arrayContaining([-1250, -3950]))
    expect(rowsOf(desk, 'fresh').find((row) => row.amount === -2700)!.balance).toBe(-3950)
  })

  it('refuses a statement whose opening is not where the account stands', async () => {
    const desk = await companyDesk(used)
    expect((await desk.propose([transcribed(desk, 760.5, undefined, 800)])).isError).toBe(true)
  })

  it('imports nothing from the same statement read twice', async () => {
    const desk = await companyDesk(used)
    await desk.propose([transcribed(desk, 720.5)])
    await desk.accept()
    const again = await desk.propose([transcribed(desk, 720.5)])
    expect(again.isError).toBe(true)
    expect(again.text).toContain('on the ledger already')
  })
})

describe('a statement in parts', () => {
  /** Three rows on each of three days from the given one in November, after the main account's newest row. */
  const partRows = (firstDay: number) => [0, 1, 2].map((offset) => ({ date: `2026-11-${String(firstDay + offset).padStart(2, '0')}`, amount: -(firstDay + offset) }))
  const PARTS = [partRows(2), partRows(5), partRows(8)]
  // The account's 760.00 less the nine rows of 2.00 to 10.00, which add up to 54.00, leaves 706.00.
  const CLOSING = 706
  const part = (desk: CompanyDesk, number: number, opening: number | null, closing: number | null) => {
    const step = transcribed(desk, 0, PARTS[number - 1])
    return { ...step, input: { ...step.input, opening, closing, part: number } }
  }

  it('carries only its own rows on each card, and ties on the last part against where the earlier parts left the ledger', async () => {
    const desk = await companyDesk(used)
    const before = rowsOf(desk, 'main').length
    for (const step of [part(desk, 1, 760, null), part(desk, 2, null, null)]) {
      const answer = await desk.propose([step])
      expect(answer.isError, answer.text).toBe(false)
      expect(warnings(desk)[0]).toBe('The AI read 3 rows from the chat. Kuna checks that the statement adds up once its last part gives the closing balance.')
      await desk.accept()
    }
    const last = await desk.propose([part(desk, 3, 760, CLOSING)])
    expect(last.isError, last.text).toBe(false)
    expect(warnings(desk)[0]).toBe('The AI read 3 rows from the chat. Check them against the statement.')
    await desk.accept()
    expect(rowsOf(desk, 'main')).toHaveLength(before + 9)
    expect(
      rowsOf(desk, 'main')
        .filter((row) => row.statement === 'main, Statement 5')
        .map((row) => row.balance),
    ).toContain(70600)
  })

  it("keeps the parts one statement when the account is renamed between them, and names it on the card by the account's name", async () => {
    const desk = await companyDesk(used)
    for (const step of [part(desk, 1, 760, null), part(desk, 2, null, null)]) {
      await desk.propose([step])
      await desk.accept()
    }
    await desk.propose([{ op: 'change-account', input: { account: desk.ref(ACCOUNT_RECORDS.name, 'main'), name: null, label: 'Business current', iban: null, currency: null } }])
    await desk.accept()

    const last = await desk.propose([part(desk, 3, 760, CLOSING)])
    expect(last.isError, last.text).toBe(false)
    expect(desk.cards.at(-1)!.groups.flatMap((group) => group.notes)[0]!.label).toBe('Business current, Statement 5')
    await desk.accept()
    expect(rowsOf(desk, 'main').filter((row) => row.statement === 'main, Statement 5')).toHaveLength(9)
  })

  it('refuses a last part that does not add up with the earlier parts, and names the gap', async () => {
    const desk = await companyDesk(used)
    for (const step of [part(desk, 1, 760, null), part(desk, 2, null, null)]) {
      await desk.propose([step])
      await desk.accept()
    }
    const answer = await desk.propose([part(desk, 3, 760, CLOSING + 0.5)])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('its earlier parts leave main at')
    expect(answer.text).toContain('0.50')
  })

  it('refuses a part whose earlier parts are not on the ledger, and one that starts on a day they reach', async () => {
    const desk = await companyDesk(used)
    const early = await desk.propose([part(desk, 2, null, null)])
    expect(early.isError).toBe(true)
    expect(early.text).toContain('from part 1')
    await desk.propose([part(desk, 1, 760, null)])
    await desk.accept()
    const step = part(desk, 2, null, null)
    const overlapping = await desk.propose([{ ...step, input: { ...step.input, rows: [{ ...step.input.rows[0]!, date: '2026-11-04', amount: -0.5 }, ...step.input.rows] } }])
    expect(overlapping.isError).toBe(true)
    expect(overlapping.text).toContain('A part starts on the day after the one before it ends.')
  })

  it(`refuses a card of more than ${ROWS_A_PART} copied rows`, async () => {
    const desk = await companyDesk(used)
    const rows = Array.from({ length: ROWS_A_PART + 1 }, () => ({ date: '2026-11-02', amount: -1 }))
    const answer = await desk.propose([transcribed(desk, 760 - rows.length, rows)])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain(`at most ${ROWS_A_PART} copied rows`)
  })
})

describe('an import card', () => {
  it('holds only the rows it imports, so a new account goes on a card before it', async () => {
    const desk = await companyDesk(used)
    const statement = transcribed(desk, 70, [{ date: '2026-11-02', amount: -30 }], 100)
    const addAccount = { op: 'add-account', input: { account: 'savings', label: 'Savings', iban: 'HR1210010051863000160', currency: '' } }

    const together = await desk.propose([
      { ...addAccount, as: '$savings' },
      { ...statement, input: { ...statement.input, account: '$savings' } },
    ])
    expect(together.isError).toBe(true)
    expect(together.text).toContain('Propose add-account on a card of its own first')
    expect(desk.cards).toEqual([])

    expect((await desk.propose([addAccount])).isError).toBe(false)
    expect((await desk.accept()).kind).toBe('done')
    const imported = await desk.propose([{ ...statement, input: { ...statement.input, account: desk.ref(ACCOUNT_RECORDS.name, 'savings') } }])
    expect(imported.isError, imported.text).toBe(false)
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsOf(desk, 'savings').map((row) => row.statement)).toEqual(['savings, Statement 5'])
  })
})

describe('an attached file', () => {
  const ATTACHED = {
    op: 'import-statement',
    input: { file: 'a1', account: null, statementName: null, opening: null, closing: null, rows: [], lookAlikes: 'ask', newAccount: null, part: 1 },
  }

  it('sends the AI to read and copy any attached file it gave no rows of, a camt file and a bank sheet included', async () => {
    const desk = await companyDesk(used)
    for (const file of [attached('pdf', 'statement-ties.pdf'), attached('xml', 'camt.xml'), cellsFile('bank-export.csv', 'Booked,Value,Text\n2026-11-02,-12.50,Paper\n')]) {
      const answer = await desk.propose([ATTACHED], [file])
      expect(answer.isError).toBe(true)
      expect(answer.text).toContain('read_attachment')
    }
    expect(desk.cards).toEqual([])
  })

  it('takes no saved import profile on the card', async () => {
    const desk = await companyDesk(used)
    const step = transcribed(desk, 720.5)
    const answer = await desk.propose([{ ...step, input: { ...step.input, profile: 'otp-business' } }])
    expect(answer.isError).toBe(true)
  })

  it('imports rows the AI copied from a file of cells by its id, and names the file on the card', async () => {
    const desk = await companyDesk(used)
    const step = transcribed(desk, 720.5)
    const answer = await desk.propose([{ ...step, input: { ...step.input, file: 'a1', opening: null, closing: null } }], [cellsFile('bank-export.csv', 'Booked,Value\n')])
    expect(answer.isError, answer.text).toBe(false)
    expect(warnings(desk)[0]).toBe('The AI read 2 rows from bank-export.csv. Kuna could not check that the statement adds up, so check them against it.')
  })

  it('imports rows the AI copied off a camt file as off any other file', async () => {
    const desk = await companyDesk(used)
    const step = transcribed(desk, 720.5)
    expect((await desk.propose([{ ...step, input: { ...step.input, file: 'a1' } }], [attached('xml', 'camt.xml')])).isError).toBe(false)
    expect(warnings(desk)[0]).toBe('The AI read 2 rows from camt.xml. Check them against the statement.')
  })
})

describe('statements the folder sync held back', () => {
  it('files them, starting the account at the statement’s opening', async () => {
    const statement = transcribedStatement(
      'fresh',
      'fresh-statement-001',
      moneyFromAmount(200),
      moneyFromAmount(150),
      [{ date: parseCivilDate('2026-10-20')!, amount: moneyFromAmount(-50), counterparty: 'Supplier', counterpartyIban: '', description: 'Goods' }],
      'ask',
    )
    const desk = await companyDesk(used, { heldStatements: () => [{ statement }] })
    await desk.propose([{ op: 'file-held-statements', input: { newAccount: null, part: 1 } }])
    await desk.accept()
    expect(rowsOf(desk, 'fresh').map((row) => row.balance)).toEqual([15000])
  })
})
