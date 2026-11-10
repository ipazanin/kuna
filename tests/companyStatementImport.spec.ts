// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { ROWS_A_PART } from '../src/shared/app/proposedWrites'
import { words } from '../src/apps/company/assistant/operations/words'
import { transcribedStatement } from '../src/apps/company/imports/domain/importedStatement'
import { loadImportFile } from '../src/apps/company/imports/infrastructure/importFiles'
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
    reading: { kind: 'kuna', format: { app: 'company', name: 'ISO 20022 bank statement', operation: 'import-statement' } },
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
      profile: null,
      account: desk.ref(ACCOUNT_RECORDS.name, 'main'),
      opening,
      closing,
      rows: rows.map((row) => ({ ...row, counterparty: 'Supplier d.o.o.', iban: null, description: 'Goods' })),
      lookAlikes: 'ask',
      newAccount: null,
      part: 1,
    },
  }
}

/** A file Kuna reads no format of, which goes to the AI as cells. */
function cellsFile(name: string, text: string): ChatAttachment {
  return { ...attached('csv', name, new TextEncoder().encode(text)), reading: { kind: 'cells', sheets: [], characters: text.length } }
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

  it('refuses one printed balance without the other', async () => {
    const desk = await companyDesk(used)
    for (const missing of [{ opening: null }, { closing: null }]) {
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

  it(`goes in parts of ${ROWS_A_PART} rows, each after the one before`, async () => {
    const desk = await companyDesk(used)
    const rows = Array.from({ length: ROWS_A_PART + 10 }, (_, at) => ({ date: `2026-11-${String(2 + Math.floor(at / 10)).padStart(2, '0')}`, amount: -1 }))
    const statement = transcribed(desk, 760 - rows.length, rows)
    const before = rowsOf(desk, 'main').length
    await desk.propose([statement])
    await desk.accept()
    expect(rowsOf(desk, 'main')).toHaveLength(before + ROWS_A_PART)
    await desk.propose([{ ...statement, input: { ...statement.input, part: 2 } }])
    await desk.accept()
    expect(rowsOf(desk, 'main')).toHaveLength(before + rows.length)
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
    expect(rowsOf(desk, 'savings').map((row) => row.statement)).toEqual(['savings 2026-11-02/2026-11-02'])
  })
})

describe('an attached file', () => {
  it('reads a camt file through Import, and starts an account with no rows at its opening, saying so on the card', async () => {
    const desk = await companyDesk(used, { readStatementFile: loadImportFile })
    const input = { file: 'a1', profile: null, account: null, opening: null, closing: null, rows: [], lookAlikes: 'ask', newAccount: null, part: 1 }
    expect((await desk.propose([{ op: 'import-statement', input }], [attached('xml', 'camt.xml')])).isError).toBe(false)
    expect(warnings(desk)).toContain(words.accountStarted('fresh'))
    await desk.accept()
    expect(rowsOf(desk, 'fresh').length).toBeGreaterThan(0)
  })

  const ATTACHED = { op: 'import-statement', input: { file: 'a1', profile: null, account: null, opening: null, closing: null, rows: [], lookAlikes: 'ask', newAccount: null, part: 1 } }

  it('sends the AI to read a photo, and a sheet no saved profile reads, with read_attachment', async () => {
    const desk = await companyDesk(used, { readStatementFile: loadImportFile })
    const photo = await desk.propose([ATTACHED], [attached('pdf', 'statement-ties.pdf')])
    expect(photo.isError).toBe(true)
    expect(photo.text).toContain('read_attachment')
    const sheet = await desk.propose([ATTACHED], [cellsFile('bank-export.csv', 'Booked,Value,Text\n2026-11-02,-12.50,Paper\n')])
    expect(sheet.isError).toBe(true)
    expect(sheet.text).toContain('read_attachment')
    expect(sheet.text).toContain('save-import-profile')
    expect(desk.cards).toEqual([])
  })

  it('imports rows the AI copied from a file of cells by its id, and names the file on the card', async () => {
    const desk = await companyDesk(used, { readStatementFile: loadImportFile })
    const step = transcribed(desk, 720.5)
    const answer = await desk.propose([{ ...step, input: { ...step.input, file: 'a1', opening: null, closing: null } }], [cellsFile('bank-export.csv', 'Booked,Value\n')])
    expect(answer.isError, answer.text).toBe(false)
    expect(warnings(desk)[0]).toBe('The AI read 2 rows from bank-export.csv. Kuna could not check that the statement adds up, so check them against it.')
  })

  it('refuses copied rows beside a file Kuna reads itself', async () => {
    const desk = await companyDesk(used, { readStatementFile: loadImportFile })
    const step = transcribed(desk, 720.5)
    const answer = await desk.propose([{ ...step, input: { ...step.input, file: 'a1' } }], [attached('xml', 'camt.xml')])
    expect(answer.isError).toBe(true)
    expect(answer.text).toContain('Kuna reads this file itself')
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
