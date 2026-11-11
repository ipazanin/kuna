import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { transcribedImportKeys } from '../src/apps/spending/statements/domain/statementRows'
import { tieRefusal } from '../src/apps/spending/assistant/operations/statementImport'
import type { AccountMoney } from '../src/shared/money/accountMoney'
import { partRefusal, splitDays, statementTies } from '../src/shared/money/statementTies'
import type { PrintedStatement } from '../src/shared/money/statementTies'
import { accountMoneyFromCents } from '../src/shared/money/accountMoney'
import { EURO } from '../src/shared/money/currencyCode'
import { civil } from './fixtures/ledger'
import { OTP } from './fixtures/spending'

interface Transcription {
  readonly file: string
  readonly opening: number
  readonly closing: number
  readonly rows: readonly { readonly date: string; readonly payee: string; readonly description: string; readonly cents: number }[]
}

const TRANSCRIPTIONS: readonly Transcription[] = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', 'documents', 'statements.json'), 'utf8'))

function transcription(file: string): Transcription {
  const found = TRANSCRIPTIONS.find((statement) => statement.file === file)
  if (found === undefined) throw new Error(`no transcription of ${file}`)
  return found
}

function printed(file: string): PrintedStatement<AccountMoney> {
  const { opening, closing, rows } = transcription(file)
  return { opening: accountMoneyFromCents(opening), amounts: rows.map((row) => accountMoneyFromCents(row.cents)), closing: accountMoneyFromCents(closing) }
}

function rowsOf(file: string) {
  return transcription(file).rows.map((row) => ({ account: OTP.id, date: civil(row.date), amount: accountMoneyFromCents(row.cents), payee: row.payee }))
}

describe("a printed statement's balances", () => {
  it.each(['statement-ties.pdf', 'statement-pasted.txt'])('tie in %s', (file) => {
    expect(statementTies(printed(file))).toEqual({ kind: 'ties' })
  })

  it('refuse a statement a cent off, naming the gap', () => {
    const tie = statementTies(printed('statement-not-tying.pdf'))
    if (tie.kind !== 'off') throw new Error('expected the statement to be off')

    expect([tie.rows, tie.reached, tie.gap]).toEqual([accountMoneyFromCents(225_324), accountMoneyFromCents(350_324), accountMoneyFromCents(1)])
    expect(tieRefusal(tie, EURO)).toContain('0.01')
  })

  it('tie with no rows only when the opening is the closing', () => {
    expect(statementTies({ opening: accountMoneyFromCents(500), amounts: [], closing: accountMoneyFromCents(500) })).toEqual({ kind: 'ties' })
    expect(statementTies({ opening: accountMoneyFromCents(500), amounts: [], closing: accountMoneyFromCents(400) })).toMatchObject({ kind: 'off', gap: accountMoneyFromCents(-100) })
  })
})

describe('the import keys of transcribed rows', () => {
  it('are the same when the statement is read twice, so its rows are skipped', () => {
    expect(transcribedImportKeys(rowsOf('statement-pasted.txt'))).toEqual(transcribedImportKeys(rowsOf('statement-ties.pdf')))
  })

  it('tell two equal coffees on one day apart, and never look like a bank sync key', () => {
    const keys = transcribedImportKeys(rowsOf('statement-ties.pdf'))

    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.at(-1)).toMatch(/^read-[0-9a-f]{16}-2$/)
    expect(keys.every((key) => key.startsWith('read-'))).toBe(true)
  })

  it('stay the same when a second read spells the payees differently', () => {
    const rows = rowsOf('statement-ties.pdf')
    const reread = rows.map((row) => ({ ...row, payee: row.payee === 'Cafe on the square' ? 'CAFE ON THE SQ.' : row.payee.replace(' d.o.o.', '') }))

    expect(transcribedImportKeys(reread)).toEqual(transcribedImportKeys(rows))
  })
})

describe('the days a copied card splits', () => {
  it('are the days of the card that Kuna holds other rows of from the same source, each once', () => {
    expect(splitDays(['2026-03-02', '2026-03-04', '2026-03-04'], ['2026-03-04', '2026-03-03', '2026-03-04', '2026-03-02'])).toEqual(['2026-03-02', '2026-03-04'])
  })

  it('are none when the rows Kuna holds are on other days', () => {
    expect(splitDays(['2026-03-01'], ['2026-03-02', '2026-03-03'])).toEqual([])
  })

  it('never let a later part of a statement start on a day the parts before it reach', () => {
    expect(partRefusal(2, ['2026-03-01', '2026-03-02'], '2026-03-02')).toBe('day-reached')
    expect(partRefusal(2, ['2026-03-01'], '2026-03-02')).toBeNull()
    expect(partRefusal(2, [], '2026-03-02')).toBe('parts-before-missing')
  })
})
