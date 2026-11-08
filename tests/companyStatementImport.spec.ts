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

function attached(kind: ChatAttachment['kind'], file: string): ChatAttachment {
  const bytes = new Uint8Array(readFileSync(join(DOCUMENTS, file)))
  return { id: 'a1', kind, name: file, bytes, original: new Blob([bytes]), pages: 1, sent: null }
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
      newAccount: null,
      part: 1,
    },
  }
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

describe('one card', () => {
  it('imports into an account an earlier step on the card adds, by its $ name', async () => {
    const desk = await companyDesk(used)
    const statement = transcribed(desk, 70, [{ date: '2026-11-02', amount: -30 }], 100)

    const answer = await desk.propose([
      { op: 'add-account', input: { account: 'savings', label: 'Savings', iban: 'HR1210010051863000160', currency: '' }, as: '$savings' },
      { ...statement, input: { ...statement.input, account: '$savings' } },
    ])

    expect(answer.isError, answer.text).toBe(false)
    expect((await desk.accept()).kind).toBe('done')
    expect(rowsOf(desk, 'savings').map((row) => row.statement)).toEqual(['savings 2026-11-02/2026-11-02'])
  })
})

describe('an attached file', () => {
  it('reads a camt file through Import, and starts an account with no rows at its opening, saying so on the card', async () => {
    const desk = await companyDesk(used, { readStatementFile: loadImportFile })
    const input = { file: 'a1', profile: null, account: null, opening: null, closing: null, rows: [], newAccount: null, part: 1 }
    expect((await desk.propose([{ op: 'import-statement', input }], [attached('xml', 'camt.xml')])).isError).toBe(false)
    const warnings = desk.cards[0]!.groups.flatMap((group) => group.lines).map((line) => line.warning)
    expect(warnings).toContain(words.accountStarted('fresh'))
    await desk.accept()
    expect(rowsOf(desk, 'fresh').length).toBeGreaterThan(0)
  })

  it('sends a photo back to be transcribed', async () => {
    const desk = await companyDesk(used, { readStatementFile: loadImportFile })
    const input = { file: 'a1', profile: null, account: null, opening: null, closing: null, rows: [], newAccount: null, part: 1 }
    const answer = await desk.propose([{ op: 'import-statement', input }], [attached('pdf', 'statement-ties.pdf')])
    expect(answer.text).toContain('transcribe')
  })
})

describe('statements the folder sync held back', () => {
  it('files them, starting the account at the statement’s opening', async () => {
    const statement = transcribedStatement('fresh', 'fresh-statement-001', moneyFromAmount(200), moneyFromAmount(150), [
      { date: parseCivilDate('2026-10-20')!, amount: moneyFromAmount(-50), counterparty: 'Supplier', counterpartyIban: '', description: 'Goods' },
    ])
    const desk = await companyDesk(used, { heldStatements: () => [{ statement }] })
    await desk.propose([{ op: 'file-held-statements', input: { newAccount: null, part: 1 } }])
    await desk.accept()
    expect(rowsOf(desk, 'fresh').map((row) => row.balance)).toEqual([15000])
  })
})
